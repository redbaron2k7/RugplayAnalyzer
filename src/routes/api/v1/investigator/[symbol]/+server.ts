import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Trade {
    type: 'BUY' | 'SELL';
    username: string;
    amount: number;
    coinSymbol: string;
    coinName: string;
    totalValue: number;
    price: number;
    timestamp: number;
    userId: string;
    analysis: string;
}

interface TradeAnalysis {
    recentTrades: Trade[];
    buyCount: number;
    sellCount: number;
    totalVolume: number;
    averageTradeSize: number;
    largestTrade: Trade;
    tradeFrequency: number;
    priceImpact: number;
    suspiciousPatterns: string[];
}

interface HolderAnalysis {
    userId: number;
    username: string;
    name: string;
    quantity: number;
    percentage: number;
    trades: TradeAnalysis;
    riskFactors: string[];
    riskScore: number;
    isCreator: boolean;
}

interface CoinResponse {
    info: {
        coin: {
            name: string;
            symbol: string;
            price: number;
            currentPrice: number;
            marketCap: number;
            volume24h: number;
            change24h: number;
            circulatingSupply: number;
            initialSupply: number;
            poolCoinAmount: number;
            poolBaseCurrencyAmount: number;
            creatorName: string;
            creatorUsername: string;
            creatorId: number;
            createdAt: string;
            category: string;
            icon?: string;
        }
    };
    holders: {
        holders: Array<{
            userId: number;
            username: string;
            name: string;
            quantity: number;
            percentage: number;
        }>;
    };
    tradingMetrics: {
        volume24h: number;
        trades24h: number;
        uniqueTraders24h: number;
        buyPressure: number;
        sellPressure: number;
        priceImpact: number;
        largestTrade: Trade;
        suspiciousPatterns: string[];
    };
    riskScore: number;
    majorHolderAnalysis: HolderAnalysis[];
}

async function fetchInvestigatorData(symbol: string): Promise<CoinResponse> {
    try {
        const coinResponse = await fetch(`https://api.rugstats.top/coins/${symbol}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!coinResponse.ok) {
            throw new Error(`Failed to fetch coin data: ${coinResponse.status}`);
        }

        const coinData = await coinResponse.json();
        coinData.info.coin.icon = `/coins/${symbol.toLowerCase()}.webp`;

        const majorHolderIds = coinData.holders.holders
            .filter((holder: any) => holder.percentage > 20)
            .map((holder: any) => holder.userId.toString());

        const CHUNK_SIZE = 100;
        const MAX_TRADES = 1000;
        let allTrades = new Map<string, any>();
        let offset = 0;

        console.log('Fetching trades for coin:', symbol);

        while (offset < MAX_TRADES) {
            try {
                console.log(`Fetching trades chunk at offset ${offset}`);
                const tradesResponse = await fetch(`https://api.rugstats.top/trades?limit=${CHUNK_SIZE}&offset=${offset}`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!tradesResponse.ok) {
                    console.warn(`Failed to fetch trades chunk at offset ${offset}: ${tradesResponse.status}`);
                    break;
                }

                const trades = await tradesResponse.json();
                console.log(`Got ${trades.length} trades, filtering for coin ${symbol}`);

                if (!trades.length) break;

                const coinTrades = trades.filter((trade: Trade) => trade.coinSymbol === symbol);
                console.log(`Found ${coinTrades.length} trades for ${symbol}`);

                coinTrades.forEach((trade: Trade) => {
                    const tradeKey = `${trade.timestamp}_${trade.userId}_${trade.amount}_${trade.coinSymbol}`;
                    if (!allTrades.has(tradeKey)) {
                        allTrades.set(tradeKey, trade);
                    }
                });

                offset += CHUNK_SIZE;

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error(`Error fetching trades chunk at offset ${offset}:`, err);
                break;
            }
        }

        console.log('Major holder IDs:', majorHolderIds);
        offset = 0;
        while (offset < MAX_TRADES) {
            try {
                console.log(`Fetching trades for ${majorHolderIds.length} holders at offset ${offset}`);
                const tradesResponse = await fetch(`https://api.rugstats.top/trades?limit=${CHUNK_SIZE}&offset=${offset}`, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!tradesResponse.ok) {
                    console.warn(`Failed to fetch trades at offset ${offset}: ${tradesResponse.status}`);
                    break;
                }

                const trades = await tradesResponse.json();
                if (!trades.length) break;

                const holderTrades = trades.filter((trade: Trade) =>
                    majorHolderIds.includes(trade.userId)
                );
                console.log(`Found ${holderTrades.length} trades for major holders`);

                holderTrades.forEach((trade: Trade) => {
                    const tradeKey = `${trade.timestamp}_${trade.userId}_${trade.amount}_${trade.coinSymbol}`;
                    if (!allTrades.has(tradeKey)) {
                        allTrades.set(tradeKey, trade);
                    }
                });

                offset += CHUNK_SIZE;

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error(`Error fetching holder trades chunk at offset ${offset}:`, err);
                break;
            }
        }

        const uniqueTrades = Array.from(allTrades.values());
        console.log('Total unique trades:', uniqueTrades.length);

        const tradesByCoin = uniqueTrades.reduce((acc: Record<string, Trade[]>, trade: Trade) => {
            if (!acc[trade.coinSymbol]) {
                acc[trade.coinSymbol] = [];
            }
            acc[trade.coinSymbol].push(trade);
            return acc;
        }, {});

        const tradeCounts: Record<string, number> = {};
        for (const [coin, trades] of Object.entries(tradesByCoin)) {
            tradeCounts[coin] = (trades as Trade[]).length;
        }
        console.log('Trades by coin:', tradeCounts);

        const holderTradedCoins = new Set<string>();
        uniqueTrades.forEach(trade => {
            if (majorHolderIds.includes(trade.userId)) {
                holderTradedCoins.add(trade.coinSymbol);
            }
        });
        console.log('Holder traded coins:', Array.from(holderTradedCoins));

        const BATCH_SIZE = 3;
        const MAX_RETRIES = 2;
        const coinSymbols = Array.from(holderTradedCoins);
        const coinHistories: any[] = [];

        console.log('Processing coin histories for:', coinSymbols);

        for (let i = 0; i < coinSymbols.length; i += BATCH_SIZE) {
            const batch = coinSymbols.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (coinSymbol) => {
                for (let retry = 0; retry <= MAX_RETRIES; retry++) {
                    try {
                        const timeout = 5000;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), timeout);

                        const [historyResponse, riskResponse] = await Promise.all([
                            fetch(`https://api.rugstats.top/history/${coinSymbol}`, {
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                signal: controller.signal
                            }),
                            fetch(`https://api.rugstats.top/risk/${coinSymbol}`, {
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                signal: controller.signal
                            })
                        ]);

                        clearTimeout(timeoutId);

                        if (!historyResponse.ok || !riskResponse.ok) {
                            throw new Error('Incomplete data');
                        }

                        const [history, risk] = await Promise.all([
                            historyResponse.json(),
                            riskResponse.json()
                        ]);

                        return {
                            symbol: coinSymbol,
                            history,
                            risk,
                            stability: null
                        };
                    } catch (err) {
                        if (retry === MAX_RETRIES) {
                            console.warn(`Failed to fetch data for ${coinSymbol} after ${MAX_RETRIES} retries`);
                            return null;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
                    }
                }
                return null;
            });

            try {
                const batchResults = await Promise.all(batchPromises);
                coinHistories.push(...batchResults.filter(result => result !== null));

                if (i + BATCH_SIZE < coinSymbols.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (err) {
                console.warn(`Failed to process batch starting at index ${i}:`, err);
                continue;
            }
        }

        const majorHolderAnalysis = await analyzeMajorHolders(
            coinData.holders.holders,
            uniqueTrades,
            coinData.info.coin.creatorId,
            20,
            coinHistories
        );

        const coinTrades = uniqueTrades
            .filter((trade: Trade) => trade.coinSymbol === symbol)
            .sort((a: Trade, b: Trade) => b.timestamp - a.timestamp);

        const tradingMetrics = analyzeTradingMetrics(coinTrades);
        const riskScore = calculateRiskScore(coinData, tradingMetrics, majorHolderAnalysis);

        return {
            info: coinData,
            holders: coinData.holders,
            tradingMetrics,
            riskScore,
            majorHolderAnalysis
        };
    } catch (err: any) {
        console.error('Error in investigation:', err);
        throw new Error(`Failed to fetch data: ${err.message}`);
    }
}

function analyzeTradingMetrics(trades: Trade[]): CoinResponse['tradingMetrics'] {
    const now = Date.now();
    const trades24h = trades.filter(t => now - t.timestamp < 24 * 60 * 60 * 1000);

    const volume24h = trades24h.reduce((sum, t) => sum + t.totalValue, 0);
    const uniqueTraders = new Set(trades24h.map(t => t.userId)).size;

    const buyTrades = trades24h.filter(t => t.type === 'BUY');
    const sellTrades = trades24h.filter(t => t.type === 'SELL');

    const buyVolume = buyTrades.reduce((sum, t) => sum + t.totalValue, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.totalValue, 0);
    const totalVolume = buyVolume + sellVolume;

    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
    const sellPressure = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;

    const priceImpacts = trades24h.map((trade, i) => {
        if (i === trades24h.length - 1) return 0;
        const nextTrade = trades24h[i + 1];
        return Math.abs((trade.price - nextTrade.price) / nextTrade.price) * 100;
    });
    const priceImpact = priceImpacts.reduce((sum, impact) => sum + impact, 0) / priceImpacts.length;

    const largestTrade = trades24h.reduce((largest, trade) =>
        trade.totalValue > (largest?.totalValue || 0) ? trade : largest
        , trades24h[0]);

    const suspiciousPatterns = detectSuspiciousPatterns(trades24h);

    return {
        volume24h,
        trades24h: trades24h.length,
        uniqueTraders24h: uniqueTraders,
        buyPressure,
        sellPressure,
        priceImpact,
        largestTrade,
        suspiciousPatterns
    };
}

async function analyzeMajorHolders(
    holders: CoinResponse['holders']['holders'],
    allTrades: Trade[],
    creatorId: number,
    percentageThreshold: number,
    coinHistories: any[]
): Promise<HolderAnalysis[]> {
    console.log('Analyzing major holders. Total trades:', allTrades.length);
    console.log('Holders above threshold:', holders.filter(holder => holder.percentage > percentageThreshold).length);

    return holders
        .filter(holder => holder.percentage > percentageThreshold)
        .map(holder => {
            console.log(`Analyzing holder ${holder.username} (${holder.userId})`);
            const holderTrades = allTrades.filter(t => t.userId === holder.userId.toString());
            console.log(`Found ${holderTrades.length} trades for holder ${holder.username}`);

            const tradeAnalysis = analyzeHolderTradesWithHistory(holderTrades, allTrades, coinHistories);
            console.log(`Trade analysis for ${holder.username}:`, {
                buyCount: tradeAnalysis.buyCount,
                sellCount: tradeAnalysis.sellCount,
                totalVolume: tradeAnalysis.totalVolume,
                recentTradesCount: tradeAnalysis.recentTrades.length
            });

            const { riskFactors, riskScore } = calculateHolderRiskWithHistory(holder, tradeAnalysis, coinHistories);
            console.log(`Risk analysis for ${holder.username}:`, { riskFactors, riskScore });

            return {
                ...holder,
                trades: tradeAnalysis,
                riskFactors,
                riskScore,
                isCreator: holder.userId === creatorId
            };
        });
}

function analyzeHolderTradesWithHistory(
    holderTrades: Trade[],
    allTrades: Trade[],
    coinHistories: any[]
): TradeAnalysis {
    console.log('Analyzing holder trades. Input trades:', holderTrades.length);

    const defaultAnalysis: TradeAnalysis = {
        recentTrades: [],
        buyCount: 0,
        sellCount: 0,
        totalVolume: 0,
        averageTradeSize: 0,
        largestTrade: null as any,
        tradeFrequency: 0,
        priceImpact: 0,
        suspiciousPatterns: []
    };

    if (!holderTrades.length) {
        console.log('No trades found for holder, returning default analysis');
        return defaultAnalysis;
    }

    const holderId = holderTrades[0].userId;
    const allHolderTrades = allTrades.filter(t => t.userId === holderId);
    console.log(`Found ${allHolderTrades.length} total trades across all coins for holder ${holderId}`);

    if (!allHolderTrades.length) {
        console.log('No trades found across any coins for holder, returning default analysis');
        return defaultAnalysis;
    }

    const tradesByCoin = allHolderTrades.reduce((acc, trade) => {
        if (!acc[trade.coinSymbol]) {
            acc[trade.coinSymbol] = [];
        }
        acc[trade.coinSymbol].push(trade);
        return acc;
    }, {} as Record<string, Trade[]>);
    console.log('Trades by coin:', Object.keys(tradesByCoin).map(coin => `${coin}: ${tradesByCoin[coin].length} trades`));

    const suspiciousTradesWithAnalysis: Trade[] = [];

    for (const [coinSymbol, coinTrades] of Object.entries(tradesByCoin)) {
        const coinHistory = coinHistories.find(h => h.symbol === coinSymbol);
        if (!coinHistory) continue;

        const sortedTrades = coinTrades.sort((a, b) => a.timestamp - b.timestamp);

        const allCoinTrades = allTrades.filter(t => t.coinSymbol === coinSymbol);

        for (let i = 0; i < sortedTrades.length; i++) {
            const trade = sortedTrades[i];

            const tradeTime = trade.timestamp;
            const priceHistory = coinHistory.history || [];
            const pricePoint = priceHistory.find((p: any) => p.timestamp >= tradeTime);
            const priceIndex = priceHistory.indexOf(pricePoint);

            const futurePrices = priceHistory.slice(priceIndex, priceIndex + 100);
            const maxDrop = futurePrices.length > 1
                ? ((futurePrices[0].price - Math.min(...futurePrices.map((p: any) => p.price))) / futurePrices[0].price) * 100
                : 0;

            const wasRugPulled = coinHistory.risk?.rugpullRisk?.level === 'HIGH' ||
                maxDrop > 90 ||
                coinHistory.stability?.rugRiskScore > 80;

            const historicalVolume = priceHistory.slice(Math.max(0, priceIndex - 50), priceIndex)
                .reduce((sum: number, p: any) => sum + (p.volume || 0), 0) / 50;
            const volumeImpact = historicalVolume > 0 ? (trade.totalValue / historicalVolume) * 100 : 0;

            let isSuspicious = false;
            let analysis = '';

            if (wasRugPulled) {
                if (trade.type === 'SELL' && maxDrop > 90) {
                    isSuspicious = true;
                    analysis = `Sold before ${maxDrop.toFixed(1)}% price crash. This coin was rugpulled.`;
                } else if (trade.type === 'BUY' && volumeImpact > 200) {
                    isSuspicious = true;
                    analysis = `Large buy (${volumeImpact.toFixed(1)}% of avg volume) in a coin that was later rugpulled.`;
                }
            }

            const pumpAndDumpScore = coinHistory.risk?.breakdown?.pumpAndDumpRisk || 0;
            if (pumpAndDumpScore > 80) {
                const priceChange = futurePrices.length > 1
                    ? ((Math.max(...futurePrices.map((p: any) => p.price)) - futurePrices[0].price) / futurePrices[0].price) * 100
                    : 0;

                if (trade.type === 'BUY' && priceChange > 200) {
                    isSuspicious = true;
                    analysis = `Bought before ${priceChange.toFixed(1)}% pump in a coin with high pump & dump risk.`;
                }
            }

            const washTrades = allCoinTrades.filter(t =>
                t.userId === trade.userId &&
                t.type !== trade.type &&
                Math.abs(t.timestamp - trade.timestamp) < 30 * 60 * 1000 // 30 minutes
            );

            if (washTrades.length > 0 && volumeImpact > 100) {
                isSuspicious = true;
                analysis += `${washTrades.length} opposite trades detected within 30 minutes. Potential wash trading. `;
            }

            if (coinHistory.stability) {
                const stabilityIssues = [];
                if (coinHistory.stability.rugRiskScore > 80) {
                    stabilityIssues.push('extremely high rug risk');
                }
                if (coinHistory.stability.trend === 'DOWN' && trade.type === 'SELL') {
                    stabilityIssues.push('downward trend');
                }
                if (coinHistory.stability.topHolderPct > 80 && trade.type === 'SELL') {
                    stabilityIssues.push('concentrated holdings');
                }

                if (stabilityIssues.length > 0) {
                    analysis += `Coin had ${stabilityIssues.join(', ')} at time of trade.`;
                    isSuspicious = true;
                }
            }

            if (isSuspicious) {
                suspiciousTradesWithAnalysis.push({
                    ...trade,
                    analysis
                });
            }
        }
    }

    const buyTrades = allHolderTrades.filter(t => t.type === 'BUY');
    const sellTrades = allHolderTrades.filter(t => t.type === 'SELL');
    const totalVolume = allHolderTrades.reduce((sum, t) => sum + t.totalValue, 0);
    const averageTradeSize = totalVolume / allHolderTrades.length;
    const largestTrade = allHolderTrades.reduce((largest, trade) =>
        trade.totalValue > (largest?.totalValue || 0) ? trade : largest,
        allHolderTrades[0]
    );

    const tradingPeriod = allHolderTrades.length > 1
        ? (Math.max(...allHolderTrades.map(t => t.timestamp)) - Math.min(...allHolderTrades.map(t => t.timestamp))) / (24 * 60 * 60 * 1000)
        : 1;
    const tradeFrequency = allHolderTrades.length / Math.max(tradingPeriod, 1);

    const priceImpact = calculatePriceImpact(allHolderTrades, allTrades);

    suspiciousTradesWithAnalysis.sort((a, b) => b.timestamp - a.timestamp);

    return {
        recentTrades: suspiciousTradesWithAnalysis,
        buyCount: buyTrades.length,
        sellCount: sellTrades.length,
        totalVolume,
        averageTradeSize,
        largestTrade,
        tradeFrequency,
        priceImpact,
        suspiciousPatterns: detectHolderSuspiciousPatterns(allHolderTrades, allTrades)
    };
}

function calculatePriceImpact(holderTrades: Trade[], allTrades: Trade[]): number {
    const impacts: number[] = [];

    holderTrades.forEach(trade => {
        const tradeIndex = allTrades.findIndex(t =>
            t.timestamp === trade.timestamp && t.userId === trade.userId
        );

        if (tradeIndex > 0 && tradeIndex < allTrades.length - 1) {
            const beforePrice = allTrades[tradeIndex + 1].price;
            const afterPrice = allTrades[tradeIndex - 1].price;
            const impact = Math.abs((afterPrice - beforePrice) / beforePrice) * 100;
            impacts.push(impact);
        }
    });

    return impacts.length > 0
        ? impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length
        : 0;
}

function detectHolderSuspiciousPatterns(holderTrades: Trade[], allTrades: Trade[]): string[] {
    const patterns: string[] = [];

    const shortTimeFrameTrades = findCloselyTimedTrades(holderTrades);
    if (shortTimeFrameTrades.length > 0) {
        patterns.push('Potential wash trading detected');
    }

    const manipulationAttempts = findPriceManipulation(holderTrades, allTrades);
    if (manipulationAttempts > 0) {
        patterns.push(`${manipulationAttempts} instances of potential price manipulation`);
    }

    const coordinatedTrading = findCoordinatedTrading(holderTrades, allTrades);
    if (coordinatedTrading) {
        patterns.push('Coordinated trading pattern detected');
    }

    return patterns;
}

function findCloselyTimedTrades(trades: Trade[]): Trade[] {
    const closelyTimed: Trade[] = [];
    const THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (let i = 0; i < trades.length - 1; i++) {
        const currentTrade = trades[i];
        const nextTrade = trades[i + 1];

        if (currentTrade.type !== nextTrade.type &&
            Math.abs(currentTrade.timestamp - nextTrade.timestamp) < THRESHOLD) {
            closelyTimed.push(currentTrade, nextTrade);
        }
    }

    return closelyTimed;
}

function findPriceManipulation(holderTrades: Trade[], allTrades: Trade[]): number {
    let manipulationCount = 0;
    const IMPACT_THRESHOLD = 5; // 5% price impact

    holderTrades.forEach(trade => {
        const tradeIndex = allTrades.findIndex(t =>
            t.timestamp === trade.timestamp && t.userId === trade.userId
        );

        if (tradeIndex > 0 && tradeIndex < allTrades.length - 1) {
            const beforePrice = allTrades[tradeIndex + 1].price;
            const afterPrice = allTrades[tradeIndex - 1].price;
            const impact = Math.abs((afterPrice - beforePrice) / beforePrice) * 100;

            if (impact > IMPACT_THRESHOLD) {
                manipulationCount++;
            }
        }
    });

    return manipulationCount;
}

function findCoordinatedTrading(holderTrades: Trade[], allTrades: Trade[]): boolean {
    const THRESHOLD = 10 * 60 * 1000; // 10 minutes

    for (let i = 0; i < holderTrades.length; i++) {
        const trade = holderTrades[i];
        const timeframeTrades = allTrades.filter(t =>
            Math.abs(t.timestamp - trade.timestamp) < THRESHOLD &&
            t.userId !== trade.userId
        );

        if (timeframeTrades.length > 3) {
            const sameDirectionTrades = timeframeTrades.filter(t => t.type === trade.type);
            if (sameDirectionTrades.length / timeframeTrades.length > 0.8) {
                return true;
            }
        }
    }

    return false;
}

function detectSuspiciousPatterns(trades: Trade[]): string[] {
    const patterns: string[] = [];

    const volumeDistribution = analyzeVolumeDistribution(trades);
    if (volumeDistribution.isAbnormal) {
        patterns.push('Abnormal trading volume distribution');
    }

    const pumpAndDump = detectPumpAndDump(trades);
    if (pumpAndDump) {
        patterns.push('Potential pump and dump pattern');
    }

    const washTrading = detectWashTrading(trades);
    if (washTrading > 0) {
        patterns.push(`${washTrading} instances of potential wash trading`);
    }

    return patterns;
}

function analyzeVolumeDistribution(trades: Trade[]): { isAbnormal: boolean; reason?: string } {
    const volumes = trades.map(t => t.totalValue);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const stdDev = Math.sqrt(
        volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length
    );

    const abnormalTrades = volumes.filter(v => Math.abs(v - avgVolume) > stdDev * 3);

    return {
        isAbnormal: abnormalTrades.length > trades.length * 0.1,
        reason: abnormalTrades.length > 0 ? 'High volume outliers detected' : undefined
    };
}

function detectPumpAndDump(trades: Trade[]): boolean {
    if (trades.length < 10) return false;

    const prices = trades.map(t => t.price);
    const maxPrice = Math.max(...prices);
    const maxPriceIndex = prices.indexOf(maxPrice);

    if (maxPriceIndex === 0 || maxPriceIndex === prices.length - 1) return false;

    const preBuyPressure = calculateBuyPressure(trades.slice(0, maxPriceIndex));
    const postSellPressure = calculateSellPressure(trades.slice(maxPriceIndex));

    return preBuyPressure > 70 && postSellPressure > 70;
}

function calculateBuyPressure(trades: Trade[]): number {
    const buyVolume = trades.filter(t => t.type === 'BUY')
        .reduce((sum, t) => sum + t.totalValue, 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.totalValue, 0);

    return totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
}

function calculateSellPressure(trades: Trade[]): number {
    const sellVolume = trades.filter(t => t.type === 'SELL')
        .reduce((sum, t) => sum + t.totalValue, 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.totalValue, 0);

    return totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 0;
}

function detectWashTrading(trades: Trade[]): number {
    let washTrades = 0;
    const THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (let i = 0; i < trades.length - 1; i++) {
        const currentTrade = trades[i];
        const nextTrade = trades[i + 1];

        if (currentTrade.userId === nextTrade.userId &&
            currentTrade.type !== nextTrade.type &&
            Math.abs(currentTrade.timestamp - nextTrade.timestamp) < THRESHOLD &&
            Math.abs(currentTrade.amount - nextTrade.amount) / currentTrade.amount < 0.1) {
            washTrades++;
        }
    }

    return washTrades;
}

function calculateHolderRiskWithHistory(
    holder: CoinResponse['holders']['holders'][0],
    tradeAnalysis: TradeAnalysis,
    coinHistories: any[]
): { riskFactors: string[]; riskScore: number } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    const rugpulledCoins = coinHistories.filter(h =>
        h.risk?.rugpullRisk?.level === 'HIGH' ||
        h.stability?.rugRiskScore > 80
    );

    if (rugpulledCoins.length > 0) {
        riskFactors.push(`Involved in ${rugpulledCoins.length} rugpulled coins`);
        riskScore += rugpulledCoins.length * 20;
    }

    const pumpAndDumpCoins = coinHistories.filter(h =>
        h.risk?.breakdown?.pumpAndDumpRisk > 80
    );

    if (pumpAndDumpCoins.length > 0) {
        riskFactors.push(`Participated in ${pumpAndDumpCoins.length} pump & dumps`);
        riskScore += pumpAndDumpCoins.length * 15;
    }

    if (tradeAnalysis.tradeFrequency > 50) {
        riskFactors.push('Unusually high trading frequency');
        riskScore += 10;
    }

    if (tradeAnalysis.priceImpact > 10) {
        riskFactors.push('High price impact trades');
        riskScore += 15;
    }

    if (holder.percentage > 90) {
        riskFactors.push('Extreme concentration (>90%)');
        riskScore += 40;
    } else if (holder.percentage > 50) {
        riskFactors.push('High concentration (>50%)');
        riskScore += 20;
    }

    riskScore = Math.min(riskScore, 100);

    return { riskFactors, riskScore };
}

function calculateRiskScore(
    coinData: any,
    tradingMetrics: CoinResponse['tradingMetrics'],
    majorHolders: HolderAnalysis[]
): number {
    let score = 50;

    if (tradingMetrics.sellPressure > 70) score += 20;
    if (tradingMetrics.priceImpact > 5) score += 15;
    if (tradingMetrics.suspiciousPatterns.length > 0) {
        score += tradingMetrics.suspiciousPatterns.length * 10;
    }

    if (majorHolders.length > 0) {
        const avgHolderRisk = majorHolders.reduce((sum, h) => sum + h.riskScore, 0) / majorHolders.length;
        score += avgHolderRisk * 0.3;

        const creator = majorHolders.find(h => h.isCreator);
        if (creator && creator.percentage > 50) {
            score += 20;
        }
    }

    const age = Date.now() - new Date(coinData.info.coin.createdAt).getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) score += 20;
    if (ageInDays < 30) score += 10;

    return Math.max(0, Math.min(100, score));
}

export const GET: RequestHandler = async ({ params }) => {
    try {
        const data = await fetchInvestigatorData(params.symbol);
        return json(data);
    } catch (err: any) {
        console.error('Investigation failed:', err);
        throw error(500, `Investigation failed: ${err.message}`);
    }
}; 
