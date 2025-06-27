import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface RugStatsTradeMsg {
    type: string;
    username: string;
    amount: number;
    coinSymbol: string;
    coinName: string;
    totalValue: number;
    price: number;
    timestamp: number;
    userId: string;
}

interface RugStatsHolder {
    userId: number;
    username: string;
    name: string;
    quantity: number;
    percentage: number;
}

interface RugStatsCoinDetails {
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
        }
    };
    holders: {
        holders: RugStatsHolder[];
    };
    trades: RugStatsTradeMsg[];
    riskScore: number;
}

interface RugStatsRiskAnalysis {
    basic: {
        currentPrice: number;
        change24h: number;
        marketCap: number;
        volume24h: number;
    };
    prediction: {
        trend: string;
        last10UpPct: number;
    };
    rugpullRisk: {
        level: string;
        topHolderPct: number;
        top5Pct: number;
        poolPctSupply: number;
        priceChange24h: number;
    };
    breakdown: any;
    holderAnalysis: {
        topHolderPct: number;
        top5Pct: number;
    };
    recommendation: string;
}

interface RugStatsStabilityAnalysis {
    score: number;
    rugRiskScore: number;
    trend: string;
    topHolderPct: number;
    top5Pct: number;
    poolPctSupply: number;
    priceChange24h: number;
    notes: { [key: string]: string };
}

interface PricePoint {
    timestamp: number;
    price: number;
    volume: number;
}

const RUGSTATS_BASE_URL = 'https://api.rugstats.top';

async function fetchRugStatsData(endpoint: string) {
    const response = await fetch(`${RUGSTATS_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`RugStats API error: ${response.status}`);
    }
    return response.json();
}

async function analyzeHolderBehavior(holders: RugStatsHolder[], allTrades: RugStatsTradeMsg[]) {
    const holderAnalysis = [];

    for (const holder of holders.slice(0, 10)) {
        const holderTrades = allTrades.filter(trade =>
            trade.username === holder.username || trade.userId === holder.userId.toString()
        );

        const recentTrades = holderTrades
            .filter(trade => Date.now() - trade.timestamp < 7 * 24 * 60 * 60 * 1000)
            .sort((a, b) => b.timestamp - a.timestamp);

        const buyTrades = recentTrades.filter(trade => trade.type === 'buy');
        const sellTrades = recentTrades.filter(trade => trade.type === 'sell');

        const totalBuyValue = buyTrades.reduce((sum, trade) => sum + trade.totalValue, 0);
        const totalSellValue = sellTrades.reduce((sum, trade) => sum + trade.totalValue, 0);

        const suspiciousPatterns = [];

        if (sellTrades.length > 0 && buyTrades.length > 0) {
            const avgBuyPrice = buyTrades.reduce((sum, trade) => sum + trade.price, 0) / buyTrades.length;
            const avgSellPrice = sellTrades.reduce((sum, trade) => sum + trade.price, 0) / sellTrades.length;

            if (avgSellPrice > avgBuyPrice * 2) {
                suspiciousPatterns.push('Large profit taking detected');
            }
        }

        if (buyTrades.length > 5 && buyTrades[0].timestamp - buyTrades[buyTrades.length - 1].timestamp < 60 * 60 * 1000) {
            suspiciousPatterns.push('Rapid accumulation pattern');
        }

        if (sellTrades.length > 3) {
            const sellTimes = sellTrades.map(trade => trade.timestamp);
            const timeDiffs = sellTimes.slice(1).map((time, i) => time - sellTimes[i]);
            const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;

            if (avgTimeDiff < 5 * 60 * 1000) {
                suspiciousPatterns.push('Coordinated selling behavior');
            }
        }

        holderAnalysis.push({
            username: holder.username,
            percentage: holder.percentage,
            quantity: holder.quantity,
            recentActivity: {
                buyCount: buyTrades.length,
                sellCount: sellTrades.length,
                totalBuyValue,
                totalSellValue,
                netActivity: totalBuyValue - totalSellValue
            },
            riskScore: Math.min(100, suspiciousPatterns.length * 25 + (holder.percentage > 20 ? 30 : 0)),
            suspiciousPatterns,
            isWhale: holder.percentage > 5,
            activityLevel: recentTrades.length > 10 ? 'high' : recentTrades.length > 3 ? 'medium' : 'low'
        });
    }

    return holderAnalysis;
}

function calculateEntryExitPoints(priceHistory: PricePoint[], currentPrice: number) {
    if (priceHistory.length < 20) {
        return {
            currentPosition: 'insufficient_data',
            recommendation: 'wait',
            confidence: 0,
            targetEntry: currentPrice,
            targetExit: currentPrice,
            stopLoss: currentPrice * 0.9
        };
    }

    const prices = priceHistory.map(p => p.price);
    const volumes = priceHistory.map(p => p.volume);

    const peaks = [];
    const valleys = [];

    for (let i = 2; i < prices.length - 2; i++) {
        if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1] &&
            prices[i] > prices[i - 2] && prices[i] > prices[i + 2]) {
            peaks.push({ price: prices[i], volume: volumes[i], index: i });
        }
        if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1] &&
            prices[i] < prices[i - 2] && prices[i] < prices[i + 2]) {
            valleys.push({ price: prices[i], volume: volumes[i], index: i });
        }
    }

    const period = 20;
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);

    const gains = [];
    const losses = [];
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }

    const avgGain = gains.slice(-14).reduce((sum, gain) => sum + gain, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((sum, loss) => sum + loss, 0) / 14;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const recentVolumes = volumes.slice(-20);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const volumeMultiplier = volumes[volumes.length - 1] / avgVolume;

    let currentPosition = 'neutral';
    let recommendation = 'hold';
    let confidence = 50;

    if (currentPrice < lowerBand && rsi < 30) {
        currentPosition = 'oversold';
        recommendation = 'buy';
        confidence = Math.min(95, 70 + volumeMultiplier * 10);
    } else if (currentPrice > upperBand && rsi > 70) {
        currentPosition = 'overbought';
        recommendation = 'sell';
        confidence = Math.min(95, 70 + volumeMultiplier * 10);
    } else if (rsi < 40 && currentPrice > lowerBand) {
        currentPosition = 'accumulation_zone';
        recommendation = 'buy';
        confidence = Math.min(85, 60 + volumeMultiplier * 8);
    } else if (rsi > 60 && currentPrice < upperBand) {
        currentPosition = 'distribution_zone';
        recommendation = 'wait';
        confidence = Math.min(80, 55 + volumeMultiplier * 5);
    }

    const nearestSupport = valleys.length > 0 ? Math.max(...valleys.slice(-3).map(v => v.price)) : lowerBand;
    const nearestResistance = peaks.length > 0 ? Math.min(...peaks.slice(-3).map(p => p.price)) : upperBand;

    return {
        currentPosition,
        recommendation,
        confidence,
        targetEntry: nearestSupport * 1.02,
        targetExit: nearestResistance * 0.98,
        stopLoss: nearestSupport * 0.95,
        technicalLevels: {
            support: nearestSupport,
            resistance: nearestResistance,
            bollinger: { upper: upperBand, middle: sma, lower: lowerBand },
            rsi,
            volumeProfile: volumeMultiplier
        }
    };
}

function calculateMarketPsychology(trades: RugStatsTradeMsg[], priceHistory: PricePoint[]) {
    const recentTrades = trades.slice(-100);
    const buyTrades = recentTrades.filter(trade => trade.type === 'buy');
    const sellTrades = recentTrades.filter(trade => trade.type === 'sell');

    const buyVolume = buyTrades.reduce((sum, trade) => sum + trade.totalValue, 0);
    const sellVolume = sellTrades.reduce((sum, trade) => sum + trade.totalValue, 0);

    const buyPressure = buyVolume / (buyVolume + sellVolume) * 100;

    const largeTrades = recentTrades.filter(trade => trade.totalValue > 1000);
    const smallTrades = recentTrades.filter(trade => trade.totalValue <= 1000);

    const whaleActivity = largeTrades.length / recentTrades.length * 100;

    const prices = priceHistory.slice(-24).map(p => p.price);
    const momentum = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;

    let fearGreedIndex = 50;

    if (buyPressure > 70) fearGreedIndex += 20;
    if (buyPressure < 30) fearGreedIndex -= 20;
    if (momentum > 10) fearGreedIndex += 15;
    if (momentum < -10) fearGreedIndex -= 15;
    if (whaleActivity > 30) fearGreedIndex += 10;

    fearGreedIndex = Math.max(0, Math.min(100, fearGreedIndex));

    return {
        buyPressure,
        sellPressure: 100 - buyPressure,
        whaleActivity,
        retailActivity: 100 - whaleActivity,
        momentum,
        fearGreedIndex,
        sentiment: fearGreedIndex > 70 ? 'extreme_greed' :
            fearGreedIndex > 55 ? 'greed' :
                fearGreedIndex > 45 ? 'neutral' :
                    fearGreedIndex > 30 ? 'fear' : 'extreme_fear',
        tradingIntensity: recentTrades.length > 50 ? 'high' :
            recentTrades.length > 20 ? 'medium' : 'low'
    };
}

export const GET: RequestHandler = async ({ params }) => {
    try {
        const { symbol } = params;

        if (!symbol) {
            return json({ error: 'Symbol is required' }, { status: 400 });
        }

        const [
            coinDetails,
            riskAnalysis,
            stabilityAnalysis,
            priceHistory,
            allTrades
        ] = await Promise.all([
            fetchRugStatsData(`/coins/${symbol.toUpperCase()}`),
            fetchRugStatsData(`/risk/${symbol.toUpperCase()}`),
            fetchRugStatsData(`/stability/${symbol.toUpperCase()}`),
            fetchRugStatsData(`/history/${symbol.toUpperCase()}`),
            fetchRugStatsData('/trades')
        ]);

        const coinData = coinDetails as RugStatsCoinDetails;
        const riskData = riskAnalysis as RugStatsRiskAnalysis;
        const stabilityData = stabilityAnalysis as RugStatsStabilityAnalysis;
        const priceData = priceHistory as PricePoint[];
        const tradesData = allTrades as RugStatsTradeMsg[];

        const coinTrades = tradesData.filter(trade =>
            trade.coinSymbol.toLowerCase() === symbol.toLowerCase()
        );

        const holderBehaviorAnalysis = await analyzeHolderBehavior(
            coinData.holders.holders,
            coinTrades
        );

        const entryExitAnalysis = calculateEntryExitPoints(
            priceData,
            coinData.info.coin.currentPrice
        );

        const marketPsychology = calculateMarketPsychology(
            coinTrades,
            priceData
        );

        const comprehensiveAnalysis = {
            basicInfo: {
                name: coinData.info.coin.name,
                symbol: coinData.info.coin.symbol,
                currentPrice: coinData.info.coin.currentPrice,
                marketCap: coinData.info.coin.marketCap,
                volume24h: coinData.info.coin.volume24h,
                change24h: coinData.info.coin.change24h,
                createdAt: coinData.info.coin.createdAt,
                category: coinData.info.coin.category
            },
            riskAssessment: {
                overallRiskScore: coinData.riskScore,
                rugPullRisk: riskData.rugpullRisk,
                stabilityScore: stabilityData.score,
                recommendation: riskData.recommendation,
                riskLevel: riskData.rugpullRisk.level
            },
            holderAnalysis: {
                topHolderPercentage: riskData.holderAnalysis.topHolderPct,
                top5HolderPercentage: riskData.holderAnalysis.top5Pct,
                holderBehavior: holderBehaviorAnalysis,
                concentrationRisk: riskData.holderAnalysis.topHolderPct > 50 ? 'high' :
                    riskData.holderAnalysis.topHolderPct > 20 ? 'medium' : 'low'
            },
            tradingIntelligence: {
                entryExit: entryExitAnalysis,
                marketPsychology,
                priceAction: {
                    trend: riskData.prediction.trend,
                    last10TradesChange: riskData.prediction.last10UpPct,
                    technicalScore: entryExitAnalysis.confidence
                }
            },
            liquidityAnalysis: {
                poolPercentage: riskData.rugpullRisk.poolPctSupply,
                poolValue: coinData.info.coin.poolBaseCurrencyAmount,
                liquidityRisk: riskData.rugpullRisk.poolPctSupply < 20 ? 'high' :
                    riskData.rugpullRisk.poolPctSupply < 50 ? 'medium' : 'low'
            },
            historicalData: {
                priceHistory: priceData.slice(-100),
                recentTrades: coinTrades.slice(-50),
                volatilityIndex: stabilityData.rugRiskScore
            },
            intelligence: {
                notes: stabilityData.notes,
                creatorProfile: {
                    name: coinData.info.coin.creatorName,
                    username: coinData.info.coin.creatorUsername,
                    id: coinData.info.coin.creatorId
                },
                marketPosition: coinData.info.coin.category,
                timeToAnalyze: Date.now()
            }
        };

        return json(comprehensiveAnalysis);

    } catch (error) {
        console.error('Analysis API error:', error);
        return json(
            { error: 'Failed to fetch analysis data' },
            { status: 500 }
        );
    }
}; 