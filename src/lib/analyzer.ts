import type {
    CoinDetailsResponse,
    HoldersResponse,
    TopCoinsResponse,
    MarketDataResponse,
    HopiumResponse,
    AnalysisResult,
    RiskLevel,
    Recommendation,
    RugplayApiClient,
    CandlestickData,
    RugPullAnalysis,
    RugPullIndicator
} from './types';

interface HolderAnalysis {
    isWhale: boolean;
    isSuspicious: boolean;
    recentActivity: 'buying' | 'selling' | 'none';
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    reasoning: string[];
}

interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

export class CryptoAnalyzer {
    private minuteData: CoinDetailsResponse = {
        coin: {
            id: 0,
            name: '',
            symbol: '',
            icon: '',
            currentPrice: 0,
            marketCap: 0,
            volume24h: 0,
            change24h: 0,
            poolCoinAmount: 0,
            poolBaseCurrencyAmount: 0,
            poolLiquidity: 0,
            poolPrice: 0,
            poolWeight: 0,
            creatorAddress: '',
            creatorName: '',
            creatorImage: '',
            holders: [],
            totalSupply: 0,
            circulatingSupply: 0,
            createdAt: '',
            initialSupply: 0,
            isListed: false,
            creatorId: 0,
            creatorUsername: '',
            creatorBio: ''
        },
        candlestickData: [],
        volumeData: [],
        timeframe: '1m'
    };

    private retryConfig: RetryConfig = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2
    };

    constructor(private apiClient: RugplayApiClient) { }

    async analyzeWithIntelligence(coinSymbol: string, forceRefresh: boolean = false): Promise<AnalysisResult> {
        try {
            const intelligenceResponse = await fetch(`/api/v1/analysis/${coinSymbol}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!intelligenceResponse.ok) {
                return this.analyzeCoin(coinSymbol, forceRefresh);
            }

            const intelligenceData = await intelligenceResponse.json();
            return this.processIntelligenceData(intelligenceData, coinSymbol, forceRefresh);

        } catch (error) {
            console.error('Intelligence analysis failed, falling back to basic analysis:', error);
            return this.analyzeCoin(coinSymbol, forceRefresh);
        }
    }

    private async processIntelligenceData(data: any, coinSymbol: string, forceRefresh: boolean): Promise<AnalysisResult> {
        const [minuteData, holders] = await Promise.all([
            this.fetchWithRetry<CoinDetailsResponse>(`/coin/${coinSymbol}`, { timeframe: '1m' }, forceRefresh),
            this.fetchWithRetry<HoldersResponse>(`/holders/${coinSymbol}`, undefined, forceRefresh)
        ]);

        this.minuteData = minuteData;

        const enhancedRugPullAnalysis = this.createEnhancedRugPullAnalysis(data);

        const { riskLevel, confidence } = this.calculateIntelligentRiskLevel(data);

        const recommendation = this.generateIntelligentRecommendation(data, riskLevel);

        const technicalAnalysis = this.enhanceTechnicalAnalysis(data, minuteData);

        return {
            coin: minuteData.coin,
            recommendation,
            riskLevel,
            confidence,
            summary: this.generateIntelligentSummary(data, recommendation, riskLevel, confidence),
            rugPullAnalysis: enhancedRugPullAnalysis,
            factors: {
                technical: technicalAnalysis,
                sentiment: this.analyzeSentimentWithIntelligence(data),
                liquidity: this.analyzeLiquidityWithIntelligence(data),
                concentration: this.analyzeConcentrationWithIntelligence(data),
                fundamental: this.analyzeFundamentalWithIntelligence(data)
            },
            tradingOpportunities: this.analyzeIntelligentTradingOpportunities(data),
            warnings: this.generateIntelligentWarnings(data),
            opportunities: this.generateIntelligentOpportunities(data)
        };
    }

    private createEnhancedRugPullAnalysis(data: any): RugPullAnalysis {
        const rugPullData = data.riskAssessment;
        const tradingData = data.tradingIntelligence;
        const holderData = data.holderAnalysis;

        const indicators: RugPullIndicator[] = [];
        let overallRisk = rugPullData.overallRiskScore || 0;

        if (rugPullData.riskLevel === 'HIGH' || rugPullData.riskLevel === 'CRITICAL') {
            indicators.push({
                name: 'Risk Assessment',
                severity: rugPullData.riskLevel === 'CRITICAL' ? 'critical' : 'high',
                description: `Market intelligence indicates ${rugPullData.riskLevel.toLowerCase()} risk level`,
                value: overallRisk
            });
        }

        if (holderData.holderBehavior) {
            const suspiciousHolders = holderData.holderBehavior.filter((h: any) => h.riskScore > 70);
            if (suspiciousHolders.length > 0) {
                indicators.push({
                    name: 'Suspicious Holder Activity',
                    severity: suspiciousHolders.length > 2 ? 'critical' : 'high',
                    description: `${suspiciousHolders.length} major holders showing suspicious trading patterns`,
                    value: suspiciousHolders.length * 20
                });
                overallRisk += suspiciousHolders.length * 15;
            }
        }

        if (holderData.concentrationRisk === 'high') {
            const isRapidGrowth = data.basicInfo.change24h > 20 && data.basicInfo.volume24h > 10000;
            const severity = isRapidGrowth ? 'medium' : 'critical';

            indicators.push({
                name: 'Concentration Risk',
                severity,
                description: `Top holder controls ${holderData.topHolderPercentage.toFixed(1)}% of supply`,
                value: holderData.topHolderPercentage
            });

            overallRisk += isRapidGrowth ? 15 : 30;
        }

        overallRisk = Math.min(100, overallRisk);

        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        let suggestedAction: string;
        let shortDescription: string;

        if (overallRisk >= 80) {
            riskLevel = 'critical';
            suggestedAction = 'Immediate exit recommended';
            shortDescription = 'Critical risk - Multiple severe indicators detected';
        } else if (overallRisk >= 60) {
            riskLevel = 'high';
            suggestedAction = 'Exercise extreme caution, consider exiting';
            shortDescription = 'High risk - Several concerning indicators present';
        } else if (overallRisk >= 35) {
            riskLevel = 'medium';
            suggestedAction = 'Monitor closely, use tight stop losses';
            shortDescription = 'Moderate risk - Some indicators require attention';
        } else {
            riskLevel = 'low';
            suggestedAction = 'Standard risk management applies';
            shortDescription = 'Lower risk - Normal market conditions';
        }

        return {
            overallRisk,
            riskLevel,
            shortDescription,
            indicators,
            suggestedAction
        };
    }

    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        endpoint: string,
        attempt: number = 1
    ): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            const isServerError = error?.response?.status === 500;
            if (!isServerError || attempt > this.retryConfig.maxRetries) {
                throw error;
            }

            const delay = Math.min(
                this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
                this.retryConfig.maxDelay
            );

            console.warn(`Retry attempt ${attempt} for ${endpoint} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryWithBackoff(operation, endpoint, attempt + 1);
        }
    }

    private async fetchWithRetry<T>(endpoint: string, params?: any, forceRefresh: boolean = false): Promise<T> {
        return this.retryWithBackoff(
            () => this.apiClient.get<T>(endpoint, params, forceRefresh),
            endpoint
        );
    }

    async analyzeCoin(coinSymbol: string, forceRefresh: boolean = false): Promise<AnalysisResult> {
        try {
            const [minuteData, hourData, dayData, holders, topCoins, marketData] = await Promise.all([
                this.fetchWithRetry<CoinDetailsResponse>(`/coin/${coinSymbol}`, { timeframe: '1m' }, forceRefresh),
                this.fetchWithRetry<CoinDetailsResponse>(`/coin/${coinSymbol}`, { timeframe: '1h' }, forceRefresh),
                this.fetchWithRetry<CoinDetailsResponse>(`/coin/${coinSymbol}`, { timeframe: '1d' }, forceRefresh),
                this.fetchWithRetry<HoldersResponse>(`/holders/${coinSymbol}`, undefined, forceRefresh),
                this.fetchWithRetry<TopCoinsResponse>('/top', undefined, forceRefresh),
                this.fetchWithRetry<MarketDataResponse>('/market', { search: coinSymbol }, forceRefresh)
            ]);

            this.minuteData = minuteData;

            const technical = this.analyzeTechnical(minuteData, hourData, dayData);
            const sentiment = this.analyzeSentiment(minuteData.coin);
            const liquidity = this.analyzeLiquidity(minuteData.coin);
            const concentration = this.analyzeConcentration(holders);
            const fundamental = this.analyzeFundamental(minuteData.coin, topCoins, marketData);
            const rugPullAnalysis = this.analyzeRugPullRisk(minuteData.coin, minuteData.candlestickData, holders);
            const suspiciousPatterns = this.detectSuspiciousPatterns(minuteData, hourData, holders);
            const { riskLevel, confidence } = this.calculateRiskLevel(
                technical.score,
                fundamental.score,
                sentiment.score,
                liquidity.score,
                concentration.score,
                suspiciousPatterns.riskLevel
            );

            let baseRecommendation = this.generateRecommendation(
                technical.score,
                fundamental.score,
                sentiment.score,
                liquidity.score,
                concentration.score,
                riskLevel,
                suspiciousPatterns.riskLevel
            );

            let finalConfidence = confidence;
            let finalSummary = this.generateSummary(baseRecommendation, riskLevel, finalConfidence, minuteData.coin);
            let finalRecommendation = baseRecommendation;

            if (rugPullAnalysis.riskLevel === 'critical') {
                finalRecommendation = 'STRONG_SELL';
                finalConfidence = Math.min(finalConfidence, 90);
                finalSummary = `DANGER: ${rugPullAnalysis.shortDescription}. ${finalSummary}`;
            } else if (rugPullAnalysis.riskLevel === 'high') {
                if (baseRecommendation !== 'STRONG_SELL') {
                    finalRecommendation = 'SELL';
                    finalConfidence = Math.min(finalConfidence, 80);
                }
                finalSummary = `WARNING: ${rugPullAnalysis.shortDescription}. ${finalSummary}`;
            }

            return {
                coin: minuteData.coin,
                recommendation: finalRecommendation,
                riskLevel,
                confidence: finalConfidence,
                summary: finalSummary,
                rugPullAnalysis,
                factors: {
                    technical,
                    sentiment,
                    liquidity,
                    concentration,
                    fundamental
                },
                tradingOpportunities: this.analyzeTradingOpportunities(technical, fundamental, liquidity, concentration),
                warnings: this.generateWarnings(minuteData.coin, holders, liquidity, concentration),
                opportunities: this.generateOpportunities(minuteData.coin, technical, fundamental)
            };
        } catch (error) {
            console.error('Error in analyzeCoin:', error);
            throw error;
        }
    }

    private analyzeRugPullRisk(
        coin: CoinDetailsResponse['coin'],
        priceHistory: CandlestickData[],
        holders: HoldersResponse
    ): RugPullAnalysis {
        const indicators: RugPullIndicator[] = [];
        let overallRisk = 0;

        if (this.isRugPulled({
            coin,
            candlestickData: priceHistory,
            volumeData: priceHistory.map(p => ({ time: p.time, volume: p.volume })),
            timeframe: '1m'
        })) {
            return {
                overallRisk: 100,
                riskLevel: 'critical',
                shortDescription: 'Rug pull detected - trading activity has ceased',
                indicators: [{
                    name: 'Rug Pull',
                    severity: 'critical',
                    description: 'Trading activity has ceased after significant price drop',
                    value: 100
                }],
                suggestedAction: 'Trading not recommended'
            };
        }

        const recentPrices = priceHistory.slice(-30);
        if (recentPrices.length > 0) {
            const priceChanges = recentPrices.map((p, i) => {
                if (i === 0) return 0;
                return ((p.close - recentPrices[i - 1].close) / recentPrices[i - 1].close) * 100;
            });

            const maxPump = Math.max(...priceChanges);
            const maxDump = Math.min(...priceChanges);

            let pumpPhase = false;
            let dumpPhase = false;
            let totalPump = 0;
            let totalDump = 0;

            for (let i = 1; i < priceChanges.length; i++) {
                if (!pumpPhase && priceChanges[i] > 10) {
                    pumpPhase = true;
                    totalPump = priceChanges[i];
                } else if (pumpPhase && priceChanges[i] > 5) {
                    totalPump += priceChanges[i];
                } else if (pumpPhase && priceChanges[i] < -10) {
                    dumpPhase = true;
                    totalDump = priceChanges[i];
                } else if (dumpPhase && priceChanges[i] < -5) {
                    totalDump += priceChanges[i];
                }
            }

            if (pumpPhase && dumpPhase && totalPump > 50 && totalDump < -30) {
                indicators.push({
                    name: 'Pump and Dump',
                    severity: 'critical',
                    description: `${totalPump.toFixed(1)}% pump followed by ${Math.abs(totalDump).toFixed(1)}% dump`,
                    value: Math.abs(totalDump)
                });
                overallRisk += 80;
            } else if (maxPump > 100) {
                indicators.push({
                    name: 'Suspicious Pump',
                    severity: 'high',
                    description: `Rapid ${maxPump.toFixed(1)}% price increase`,
                    value: maxPump
                });
                overallRisk += 40;
            } else if (maxDump < -30) {
                indicators.push({
                    name: 'Price Drop',
                    severity: 'critical',
                    description: `Rapid ${Math.abs(maxDump).toFixed(1)}% price decline`,
                    value: Math.abs(maxDump)
                });
                overallRisk += 60;
            }

            const volatility = this.calculateVolatility(recentPrices.map(p => p.close));
            if (volatility > 50) {
                indicators.push({
                    name: 'Volatility',
                    severity: 'high',
                    description: 'Extreme price volatility detected',
                    value: volatility
                });
                overallRisk += 30;
            }
        }

        const volumes = priceHistory.map(p => p.volume);
        const recentVolumes = volumes.slice(-10);
        const volumeAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const recentVolumeAvg = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const volumeSpikes = recentVolumes.map((v, i) => i === 0 ? 0 : (v / recentVolumes[i - 1] - 1) * 100);
        const maxVolumeSpike = Math.max(...volumeSpikes);
        const volumeTrend = (recentVolumeAvg / volumeAvg - 1) * 100;

        if (maxVolumeSpike > 500 && volumeTrend < -70) {
            indicators.push({
                name: 'Volume Pattern',
                severity: 'critical',
                description: 'Volume spike followed by significant decline',
                value: Math.abs(volumeTrend)
            });
            overallRisk += 70;
        } else if (recentVolumeAvg === 0) {
            indicators.push({
                name: 'Volume',
                severity: 'critical',
                description: 'Trading volume has ceased',
                value: 0
            });
            overallRisk += 60;
        }

        const totalSupply = holders.holders.reduce((acc, h) => acc + h.balance, 0);
        const topHolders = holders.holders.slice(0, 5);
        const topHoldersBalance = topHolders.reduce((acc, h) => acc + h.balance, 0);
        const topHoldersPercentage = (topHoldersBalance / totalSupply) * 100;

        if (topHoldersPercentage > 90) {
            indicators.push({
                name: 'Concentration',
                severity: 'critical',
                description: `Top 5 wallets control ${topHoldersPercentage.toFixed(1)}% of supply`,
                value: topHoldersPercentage
            });
            overallRisk += 70;
        } else if (topHoldersPercentage > 70) {
            indicators.push({
                name: 'Concentration',
                severity: 'high',
                description: `Top 5 wallets control ${topHoldersPercentage.toFixed(1)}% of supply`,
                value: topHoldersPercentage
            });
            overallRisk += 40;
        }

        overallRisk = Math.min(100, overallRisk);

        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        let suggestedAction: string;
        let shortDescription: string;

        if (overallRisk >= 70) {
            riskLevel = 'critical';
            suggestedAction = 'Trading not recommended';
            shortDescription = 'Critical risk - Multiple adverse indicators detected';
        } else if (overallRisk >= 50) {
            riskLevel = 'high';
            suggestedAction = 'Exercise extreme caution';
            shortDescription = 'High risk - Adverse indicators present';
        } else if (overallRisk >= 30) {
            riskLevel = 'medium';
            suggestedAction = 'Monitor closely';
            shortDescription = 'Moderate risk - Some concerning indicators';
        } else {
            riskLevel = 'low';
            suggestedAction = 'Standard trading risks apply';
            shortDescription = 'Lower risk - No immediate concerns';
        }

        return {
            overallRisk,
            riskLevel,
            shortDescription,
            indicators,
            suggestedAction
        };
    }

    private calculateRiskLevel(
        technicalScore: number,
        fundamentalScore: number,
        sentimentScore: number,
        liquidityScore: number,
        concentrationScore: number,
        suspiciousPatterns: number
    ): { riskLevel: RiskLevel; confidence: number } {
        if (suspiciousPatterns >= 90) {
            return { riskLevel: 'VERY_HIGH', confidence: 95 };
        }
        if (suspiciousPatterns >= 70) {
            return { riskLevel: 'HIGH', confidence: 85 };
        }

        const weights = {
            technical: 0.25,
            sentiment: 0.15,
            liquidity: 0.15,
            fundamental: 0.05,
            concentration: 0.05,
            suspiciousPatterns: 0.35
        };

        const weightedScore = (
            technicalScore * weights.technical +
            fundamentalScore * weights.fundamental +
            sentimentScore * weights.sentiment +
            liquidityScore * weights.liquidity +
            concentrationScore * weights.concentration +
            suspiciousPatterns * weights.suspiciousPatterns
        );

        let riskLevel: RiskLevel;
        if (weightedScore >= 80) riskLevel = 'VERY_LOW';
        else if (weightedScore >= 65) riskLevel = 'LOW';
        else if (weightedScore >= 50) riskLevel = 'MEDIUM';
        else if (weightedScore >= 35) riskLevel = 'HIGH';
        else riskLevel = 'VERY_HIGH';

        const recentIndicators = [technicalScore, liquidityScore, 100 - suspiciousPatterns];
        const meanScore = recentIndicators.reduce((a, b) => a + b, 0) / recentIndicators.length;
        const variance = recentIndicators.reduce((a, b) => a + Math.pow(b - meanScore, 2), 0) / recentIndicators.length;
        const confidence = Math.max(70, Math.min(95, 95 - Math.sqrt(variance)));

        return { riskLevel, confidence };
    }

    private generateRecommendation(
        technicalScore: number,
        fundamentalScore: number,
        sentimentScore: number,
        liquidityScore: number,
        concentrationScore: number,
        riskLevel: RiskLevel,
        suspiciousRiskLevel: number
    ): Recommendation {
        if (suspiciousRiskLevel >= 90) {
            return 'STRONG_SELL';
        }

        if (suspiciousRiskLevel >= 70) {
            return 'SELL';
        }

        const overallScore = (
            technicalScore * 0.30 +
            sentimentScore * 0.15 +
            liquidityScore * 0.15 +
            fundamentalScore * 0.05 +
            concentrationScore * 0.05 +
            (100 - suspiciousRiskLevel) * 0.30
        );

        if (overallScore >= 75) return 'STRONG_BUY';
        if (overallScore >= 65) return 'BUY';
        if (overallScore >= 50) return 'HOLD';
        if (overallScore >= 30) return 'SELL';
        return 'STRONG_SELL';
    }

    private analyzeTechnical(
        minuteData: CoinDetailsResponse,
        hourData: CoinDetailsResponse,
        dayData: CoinDetailsResponse
    ) {
        const minuteAnalysis = this.analyzeSingleTimeframe(minuteData, '1m');
        const hourAnalysis = this.analyzeSingleTimeframe(hourData, '1h');
        const dayAnalysis = this.analyzeSingleTimeframe(dayData, '1d');

        const score = (
            minuteAnalysis.score * 0.2 +
            hourAnalysis.score * 0.3 +
            dayAnalysis.score * 0.5
        );

        const indicators = [
            ...minuteAnalysis.indicators.map(i => `1m: ${i}`),
            ...hourAnalysis.indicators.map(i => `1h: ${i}`),
            ...dayAnalysis.indicators.map(i => `1d: ${i}`)
        ];

        const reasoning = `Short-term: ${minuteAnalysis.reasoning}. Medium-term: ${hourAnalysis.reasoning}. Long-term: ${dayAnalysis.reasoning}`;

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            indicators
        };
    }

    private analyzeSingleTimeframe(data: CoinDetailsResponse, timeframe: string) {
        const indicators = [] as string[];
        let score = 50;
        let reasoning = '';

        const candlesticks = data.candlestickData;
        if (candlesticks.length === 0) {
            return {
                score: 50,
                reasoning: 'Insufficient data for technical analysis',
                indicators: ['No candlestick data available']
            };
        }

        const currentPrice = data.coin.currentPrice;
        const prices = candlesticks.map(c => c.close);
        const volumes = data.volumeData.map(v => v.volume);

        const rsi = this.calculateRSI(prices, 14);
        if (rsi < 30) {
            indicators.push(`${timeframe} RSI indicates oversold conditions (${rsi.toFixed(2)})`);
            score += 15;
            reasoning += `${timeframe} RSI indicates oversold conditions (${rsi.toFixed(2)}). `;
        } else if (rsi > 70) {
            indicators.push(`${timeframe} RSI indicates overbought conditions (${rsi.toFixed(2)})`);
            score -= 15;
            reasoning += `${timeframe} RSI indicates overbought conditions (${rsi.toFixed(2)}). `;
        } else {
            indicators.push(`${timeframe} RSI in neutral territory (${rsi.toFixed(2)})`);
            reasoning += `${timeframe} RSI in neutral territory (${rsi.toFixed(2)}). `;
        }

        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);

        if (currentPrice > sma20 && sma20 > sma50) {
            indicators.push(`${timeframe} Price above both SMAs - bullish trend`);
            score += 10;
            reasoning += `${timeframe} Price above both SMAs - bullish trend. `;
        } else if (currentPrice < sma20 && sma20 < sma50) {
            indicators.push(`${timeframe} Price below both SMAs - bearish trend`);
            score -= 10;
            reasoning += `${timeframe} Price below both SMAs - bearish trend. `;
        }

        const macd = this.calculateMACD(prices);
        if (macd.histogram > 0 && macd.histogram > macd.previousHistogram) {
            indicators.push(`${timeframe} MACD showing increasing bullish momentum`);
            score += 8;
            reasoning += `${timeframe} MACD showing increasing bullish momentum. `;
        } else if (macd.histogram < 0 && macd.histogram < macd.previousHistogram) {
            indicators.push(`${timeframe} MACD showing increasing bearish momentum`);
            score -= 8;
            reasoning += `${timeframe} MACD showing increasing bearish momentum. `;
        }

        const bbands = this.calculateBollingerBands(prices);
        if (currentPrice > bbands.upper) {
            indicators.push(`${timeframe} Price above upper Bollinger Band - potential reversal`);
            score -= 5;
            reasoning += `${timeframe} Price above upper Bollinger Band - potential reversal. `;
        } else if (currentPrice < bbands.lower) {
            indicators.push(`${timeframe} Price below lower Bollinger Band - potential reversal`);
            score += 5;
            reasoning += `${timeframe} Price below lower Bollinger Band - potential reversal. `;
        }

        const vwap = this.calculateVWAP(candlesticks);
        if (currentPrice > vwap) {
            indicators.push(`${timeframe} Price above VWAP - bullish`);
            score += 5;
            reasoning += `${timeframe} Price above VWAP - bullish. `;
        } else {
            indicators.push(`${timeframe} Price below VWAP - bearish`);
            score -= 5;
            reasoning += `${timeframe} Price below VWAP - bearish. `;
        }

        const { nearestSupport, nearestResistance } = this.findSupportResistance(candlesticks);
        if (nearestSupport) {
            indicators.push(`${timeframe} Strong support level at ${nearestSupport.toFixed(2)}`);
            score += 5;
            reasoning += `${timeframe} Strong support level at ${nearestSupport.toFixed(2)}. `;
        }
        if (nearestResistance) {
            indicators.push(`${timeframe} Resistance level at ${nearestResistance.toFixed(2)}`);
            score -= 3;
            reasoning += `${timeframe} Resistance level at ${nearestResistance.toFixed(2)}. `;
        }

        const volumeTrend = this.calculateVolumeTrend(volumes);
        if (volumeTrend > 0.1) {
            indicators.push(`${timeframe} Increasing volume trend supports price movement`);
            score += 8;
            reasoning += `${timeframe} Increasing volume trend supports price movement. `;
        } else if (volumeTrend < -0.1) {
            indicators.push(`${timeframe} Decreasing volume may signal weakening momentum`);
            score -= 5;
            reasoning += `${timeframe} Decreasing volume may signal weakening momentum. `;
        }

        const volatility = this.calculateVolatility(prices);
        if (volatility > 0.2) {
            indicators.push(`${timeframe} High volatility presents both opportunity and risk`);
            score -= 5;
            reasoning += `${timeframe} High volatility presents both opportunity and risk. `;
        } else if (volatility < 0.1) {
            indicators.push(`${timeframe} Low volatility may indicate consolidation`);
            reasoning += `${timeframe} Low volatility may indicate consolidation. `;
        }

        const priceAction = this.analyzePriceAction(candlesticks);
        score += priceAction.score;
        indicators.push(...priceAction.patterns.map(p => `${timeframe} ${p}`));
        reasoning += `Price Action Analysis: ${priceAction.patterns.join(', ')}. `;

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning: reasoning.trim(),
            indicators
        };
    }

    private analyzeFundamental(coin: any, topCoins: TopCoinsResponse, marketData: MarketDataResponse) {
        const signals = [] as string[];
        let score = 50;
        let reasoning = '';

        const coinAge = Date.now() - new Date(coin.createdAt).getTime();
        const ageInDays = coinAge / (1000 * 60 * 60 * 24);

        if (ageInDays < 1) {
            signals.push('Extremely new coin - high risk');
            score -= 30;
            reasoning += 'Extremely new coin - high risk';
        } else if (ageInDays < 7) {
            signals.push('Very new coin - proceed with caution');
            score -= 20;
            reasoning += 'Very new coin - proceed with caution';
        } else if (ageInDays < 30) {
            signals.push('New coin - elevated risk');
            score -= 10;
            reasoning += 'New coin - elevated risk';
        } else {
            signals.push('Established coin with price history');
            score += 5;
            reasoning += 'Established coin with price history';
        }

        const marketCapRank = topCoins.coins.findIndex(c => c.symbol === coin.symbol) + 1;
        if (marketCapRank > 0 && marketCapRank <= 10) {
            signals.push('Top 10 coin by market cap');
            score += 20;
            reasoning += 'Top 10 coin by market cap';
        } else if (marketCapRank > 0 && marketCapRank <= 50) {
            signals.push('Top 50 coin by market cap');
            score += 10;
            reasoning += 'Top 50 coin by market cap';
        } else {
            signals.push('Lower market cap coin - higher risk/reward potential');
            score -= 5;
            reasoning += 'Lower market cap coin - higher risk/reward potential';
        }

        const volumeRatio = coin.volume24h / coin.marketCap;
        if (volumeRatio > 0.1) {
            signals.push('High trading volume relative to market cap');
            score += 10;
            reasoning += 'High trading volume relative to market cap';
        } else if (volumeRatio < 0.01) {
            signals.push('Low trading volume - liquidity concerns');
            score -= 15;
            reasoning += 'Low trading volume - liquidity concerns';
        }

        if (coin.isListed) {
            signals.push('Listed status provides additional legitimacy');
            score += 5;
            reasoning += 'Listed status provides additional legitimacy';
        }

        const supplyRatio = coin.circulatingSupply / coin.initialSupply;
        if (supplyRatio === 1) {
            signals.push('All tokens in circulation - no additional dilution risk');
            score += 5;
            reasoning += 'All tokens in circulation - no additional dilution risk';
        } else {
            signals.push(`${((1 - supplyRatio) * 100).toFixed(1)}% of supply not yet circulating`);
            score -= 3;
            reasoning += `${((1 - supplyRatio) * 100).toFixed(1)}% of supply not yet circulating`;
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            signals
        };
    }

    private analyzeSentiment(coin: any) {
        const metrics: Record<string, number> = {};
        let score = 50;
        let reasoning = '';

        const change24h = coin.change24h;
        if (change24h > 50) {
            metrics['price_action'] = 5;
            score += 25;
            reasoning += 'Extremely positive price action in 24h';
        } else if (change24h > 20) {
            metrics['price_action'] = 4;
            score += 15;
            reasoning += 'Strong positive price momentum';
        } else if (change24h > 5) {
            metrics['price_action'] = 3;
            score += 8;
            reasoning += 'Positive price movement';
        } else if (change24h < -50) {
            metrics['price_action'] = 0;
            score -= 25;
            reasoning += 'Severe price decline in 24h';
        } else if (change24h < -20) {
            metrics['price_action'] = 1;
            score -= 15;
            reasoning += 'Significant price decline';
        } else if (change24h < -5) {
            metrics['price_action'] = 2;
            score -= 8;
            reasoning += 'Negative price movement';
        } else {
            metrics['price_action'] = 2.5;
            reasoning += 'Stable price action';
        }

        if (coin.creatorName && coin.creatorName !== 'Anonymous') {
            metrics['creator_reputation'] = 1;
            score += 5;
            reasoning += 'Known creator adds credibility';
        } else {
            metrics['creator_reputation'] = 0;
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            metrics
        };
    }

    private analyzeLiquidity(coin: any) {
        const warnings = [] as string[];
        let score = 50;
        let reasoning = '';

        const poolValue = coin.poolBaseCurrencyAmount;
        const poolRatio = coin.poolCoinAmount / coin.circulatingSupply;

        if (poolValue < 1000) {
            warnings.push('Very low liquidity pool - high slippage risk');
            score -= 20;
            reasoning += 'Very low liquidity pool - high slippage risk';
        } else if (poolValue < 5000) {
            warnings.push('Low liquidity pool - moderate slippage risk');
            score -= 10;
            reasoning += 'Low liquidity pool - moderate slippage risk';
        } else if (poolValue < 10000) {
            score += 5;
            reasoning += 'Moderate liquidity pool';
        } else {
            score += 15;
            reasoning += 'Good liquidity depth';
        }

        if (poolRatio > 0.7) {
            warnings.push('High percentage of tokens in liquidity pool');
            score -= 10;
            reasoning += 'High percentage of tokens in liquidity pool';
        } else if (poolRatio < 0.05) {
            warnings.push('Very low percentage of tokens in liquidity pool');
            score -= 15;
            reasoning += 'Very low percentage of tokens in liquidity pool';
        } else {
            score += 10;
            reasoning += 'Healthy token distribution in liquidity pool';
        }

        const volumeToLiquidityRatio = coin.volume24h / poolValue;
        if (volumeToLiquidityRatio > 5) {
            warnings.push('High trading volume relative to liquidity');
            score -= 10;
            reasoning += 'High trading volume relative to liquidity';
        } else if (volumeToLiquidityRatio > 2) {
            score += 5;
            reasoning += 'Active trading with sufficient liquidity';
        } else if (volumeToLiquidityRatio < 0.1) {
            warnings.push('Low trading activity relative to available liquidity');
            score -= 5;
            reasoning += 'Low trading activity relative to available liquidity';
        } else {
            score += 10;
            reasoning += 'Healthy trading volume relative to liquidity';
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            warnings
        };
    }

    private analyzeConcentration(holders: HoldersResponse) {
        const risks = [] as string[];
        let score = 50;
        let reasoning = '';

        const totalHolders = holders.totalHolders;
        const totalSupply = holders.holders.reduce((sum, h) => sum + h.balance, 0);
        const top5Balance = holders.holders.slice(0, 5).reduce((sum, h) => sum + h.balance, 0);
        const top5Percentage = (top5Balance / totalSupply) * 100;

        if (top5Percentage > 95) {
            risks.push('Extreme concentration - top 5 holders own >95%');
            score -= 25;
            reasoning += 'Extreme concentration - top 5 holders own >95%';
        } else if (top5Percentage > 85) {
            risks.push('High concentration - top 5 holders own >85%');
            score -= 15;
            reasoning += 'High concentration - top 5 holders own >85%';
        } else if (top5Percentage > 70) {
            risks.push('Moderate concentration - top 5 holders own >70%');
            score -= 5;
            reasoning += 'Moderate concentration - top 5 holders own >70%';
        } else {
            score += 10;
            reasoning += 'Well-distributed token holdings';
        }

        if (holders.totalHolders < 5) {
            risks.push('Very few total holders');
            score -= 15;
            reasoning += 'Very few total holders';
        } else if (holders.totalHolders < 20) {
            risks.push('Limited holder base');
            score -= 5;
            reasoning += 'Limited holder base';
        } else if (holders.totalHolders > 100) {
            score += 15;
            reasoning += 'Large, distributed holder base';
        } else {
            score += 5;
            reasoning += 'Growing holder base';
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            reasoning,
            risks
        };
    }

    private generateSummary(
        recommendation: Recommendation,
        riskLevel: RiskLevel,
        confidence: number,
        coin: CoinDetailsResponse['coin']
    ): string {
        return `Analysis Summary for ${coin.name} (${coin.symbol}):

• Risk Level: ${riskLevel}
• Confidence: ${confidence.toFixed(1)}%
• Current Price: $${coin.currentPrice.toFixed(6)}
• Market Cap: $${coin.marketCap.toFixed(2)}
• 24h Volume: $${coin.volume24h.toFixed(2)}

${this.getRiskLevelDescription(riskLevel)}

${this.getRecommendationDescription(recommendation)}`;
    }

    private getRecommendationDescription(recommendation: Recommendation): string {
        switch (recommendation) {
            case 'STRONG_BUY':
                return 'Strong buy signal. Multiple indicators suggest significant upside potential.';
            case 'BUY':
                return 'Buy signal. Favorable conditions for entry.';
            case 'HOLD':
                return 'Hold position. Current conditions suggest maintaining existing positions.';
            case 'SELL':
                return 'Sell signal. Consider reducing exposure.';
            case 'STRONG_SELL':
                return 'Strong sell signal. Multiple indicators suggest increased risk.';
            default:
                return 'No clear recommendation at this time.';
        }
    }

    private calculateSMA(prices: number[], period: number): number {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const sum = prices.slice(-period).reduce((sum, price) => sum + price, 0);
        return sum / period;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;

        const gains: number[] = [];
        const losses: number[] = [];

        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? -change : 0);
        }

        const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateVolatility(prices: number[]): number {
        if (prices.length < 2) return 0;

        const returns = prices.slice(1).map((price, i) =>
            ((price - prices[i]) / prices[i]) * 100
        );

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;

        return Math.sqrt(variance);
    }

    private calculateVolumeTrend(volumes: number[]): number {
        if (volumes.length < 10) return 0;

        const recent = volumes.slice(-5).reduce((sum, vol) => sum + vol, 0) / 5;
        const previous = volumes.slice(-10, -5).reduce((sum, vol) => sum + vol, 0) / 5;

        return (recent - previous) / previous;
    }

    private analyzePriceAction(candlestickData: any[]): { score: number; patterns: string[] } {
        const patterns = [];
        let score = 0;

        if (candlestickData.length < 3) {
            return { score: 0, patterns: ['Insufficient data for pattern analysis'] };
        }

        const recent = candlestickData.slice(-3);

        const isHammer = recent.some(candle => {
            const body = Math.abs(candle.close - candle.open);
            const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
            return lowerShadow > body * 2;
        });

        if (isHammer) {
            patterns.push('Hammer pattern detected - potential reversal signal');
            score += 5;
        }

        const consecutiveGreen = recent.every(c => c.close > c.open);
        const consecutiveRed = recent.every(c => c.close < c.open);

        if (consecutiveGreen) {
            patterns.push('Strong bullish momentum - consecutive green candles');
            score += 8;
        } else if (consecutiveRed) {
            patterns.push('Strong bearish momentum - consecutive red candles');
            score -= 8;
        }

        return { score, patterns };
    }

    private calculateEMA(prices: number[], period: number): number {
        const multiplier = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    private calculateMACD(prices: number[]): { histogram: number; previousHistogram: number } {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macdLine = ema12 - ema26;
        const signalLine = this.calculateEMA([macdLine], 9);
        const currentHistogram = macdLine - signalLine;

        const previousPrices = prices.slice(0, -1);
        const prevEma12 = this.calculateEMA(previousPrices, 12);
        const prevEma26 = this.calculateEMA(previousPrices, 26);
        const prevMacdLine = prevEma12 - prevEma26;
        const prevSignalLine = this.calculateEMA([prevMacdLine], 9);
        const previousHistogram = prevMacdLine - prevSignalLine;

        return { histogram: currentHistogram, previousHistogram };
    }

    private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
        const sma = this.calculateSMA(prices, period);
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const std = Math.sqrt(variance);

        return {
            upper: sma + (stdDev * std),
            middle: sma,
            lower: sma - (stdDev * std)
        };
    }

    private calculateVWAP(candlesticks: any[]): number {
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;

        for (let i = 0; i < candlesticks.length; i++) {
            const typicalPrice = (candlesticks[i].high + candlesticks[i].low + candlesticks[i].close) / 3;
            cumulativeTPV += typicalPrice * candlesticks[i].volume;
            cumulativeVolume += candlesticks[i].volume;
        }

        return cumulativeTPV / cumulativeVolume;
    }

    private findSupportResistance(candlesticks: any[]): { nearestSupport: number | undefined; nearestResistance: number | undefined } {
        const supports: number[] = [];
        const resistances: number[] = [];

        for (let i = 2; i < candlesticks.length - 2; i++) {
            if (candlesticks[i].low < candlesticks[i - 1].low && candlesticks[i].low < candlesticks[i - 2].low &&
                candlesticks[i].low < candlesticks[i + 1].low && candlesticks[i].low < candlesticks[i + 2].low) {
                supports.push(candlesticks[i].low);
            }
            if (candlesticks[i].high > candlesticks[i - 1].high && candlesticks[i].high > candlesticks[i - 2].high &&
                candlesticks[i].high > candlesticks[i + 1].high && candlesticks[i].high > candlesticks[i + 2].high) {
                resistances.push(candlesticks[i].high);
            }
        }

        supports.sort((a, b) => Math.abs(candlesticks[candlesticks.length - 1].close - a) - Math.abs(candlesticks[candlesticks.length - 1].close - b));
        resistances.sort((a, b) => Math.abs(candlesticks[candlesticks.length - 1].close - a) - Math.abs(candlesticks[candlesticks.length - 1].close - b));

        return {
            nearestSupport: supports[0],
            nearestResistance: resistances[0]
        };
    }

    private generateWarnings(
        coin: CoinDetailsResponse['coin'],
        holders: HoldersResponse,
        liquidity: { score: number; reasoning: string; warnings: string[] },
        concentration: { score: number; reasoning: string; risks: string[] }
    ): string[] {
        const warnings = [];

        warnings.push(...liquidity.warnings);
        warnings.push(...concentration.risks);

        const coinAge = Date.now() - new Date(coin.createdAt).getTime();
        const ageInDays = coinAge / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) {
            warnings.push('Extremely new coin - high probability of volatility and potential scam');
        }

        if (coin.volume24h / coin.marketCap < 0.01) {
            warnings.push('Very low trading volume relative to market cap');
        }

        if (holders.totalHolders < 50) {
            warnings.push('Very limited holder base increases manipulation risk');
        }

        return warnings;
    }

    private generateOpportunities(
        coin: CoinDetailsResponse['coin'],
        technical: { score: number; reasoning: string; indicators: string[] },
        fundamental: { score: number; reasoning: string; signals: string[] }
    ): string[] {
        const opportunities = [];

        if (technical.score > 50) {
            opportunities.push('Technical indicators suggest potential upward momentum');
        }

        if (fundamental.score > 50) {
            opportunities.push('Strong fundamentals provide good long-term potential');
        }

        if (coin.change24h < -10 && technical.score > 40) {
            opportunities.push('Recent price decline may present buying opportunity if fundamentals remain strong');
        }

        const volumeRatio = coin.volume24h / coin.marketCap;
        if (volumeRatio > 0.05) {
            opportunities.push('Active trading indicates market interest');
        }

        if (coin.poolBaseCurrencyAmount > 5000) {
            opportunities.push('Good liquidity provides stable trading conditions');
        }

        if (coin.change24h > 5) {
            opportunities.push('Recent positive price movement shows market confidence');
        }

        return opportunities;
    }

    private getRiskLevelDescription(riskLevel: RiskLevel): string {
        switch (riskLevel) {
            case 'VERY_LOW':
                return 'Minimal risk for the cryptocurrency space, but still requires careful monitoring.';
            case 'LOW':
                return 'Lower risk relative to other cryptocurrencies, but still volatile.';
            case 'MEDIUM':
                return 'Moderate risk. Use standard risk management practices.';
            case 'HIGH':
                return 'High risk. Significant potential for losses. Only trade with funds you can afford to lose.';
            case 'VERY_HIGH':
                return 'Extremely high risk of rugpull or significant losses. Exercise maximum caution.';
            default:
                return 'Unknown risk level';
        }
    }

    private getRecentVolumes(): number[] {
        return this.minuteData.volumeData
            .slice(-60)
            .map(v => v.volume);
    }

    private getRecentCandles(): CandlestickData[] {
        return this.minuteData.candlestickData
            .slice(-60);
    }

    private calculateMomentum(): number {
        const recentCandles = this.getRecentCandles();
        if (recentCandles.length < 2) return 50;

        const priceChanges = recentCandles.map((candle, i) => {
            if (i === 0) return 0;
            return ((candle.close - recentCandles[i - 1].close) / recentCandles[i - 1].close) * 100;
        });

        const momentum = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
        return Math.min(100, Math.max(0, 50 + momentum * 10));
    }

    private analyzeHolderBehavior(holders: HoldersResponse): HolderAnalysis[] {
        const analyses: HolderAnalysis[] = [];

        const sortedHolders = [...holders.holders].sort((a, b) => b.balance - a.balance);

        const totalSupply = sortedHolders.reduce((sum, holder) => sum + holder.balance, 0);

        sortedHolders.forEach((holder, index) => {
            const percentage = (holder.balance / totalSupply) * 100;
            const analysis: HolderAnalysis = {
                isWhale: percentage > 5,
                isSuspicious: false,
                recentActivity: 'none',
                riskLevel: 'low',
                reasoning: []
            };

            if (percentage > 80) {
                analysis.riskLevel = 'extreme';
                analysis.isSuspicious = true;
                analysis.reasoning.push(`Single holder owns ${percentage.toFixed(2)}% of supply`);
            } else if (percentage > 50) {
                analysis.riskLevel = 'high';
                analysis.isSuspicious = true;
                analysis.reasoning.push(`Major holder owns ${percentage.toFixed(2)}% of supply`);
            } else if (percentage > 20) {
                analysis.riskLevel = 'medium';
                analysis.reasoning.push(`Significant holder with ${percentage.toFixed(2)}% of supply`);
            }

            if (holder.balance % 1000000 === 0 || holder.balance % 1000000000 === 0) {
                analysis.isSuspicious = true;
                analysis.reasoning.push("Suspiciously round number holdings");
            }

            analyses.push(analysis);
        });

        return analyses;
    }

    private isRugPulled(minuteData: CoinDetailsResponse): boolean {
        const recentCandles = minuteData.candlestickData.slice(-30);
        if (recentCandles.length < 2) return false;

        const priceDrops = recentCandles.map((candle, i) => {
            if (i === 0) return 0;
            return ((candle.close - recentCandles[i - 1].close) / recentCandles[i - 1].close) * 100;
        });

        const allTimeHigh = Math.max(...minuteData.candlestickData.map(c => c.high));
        const currentPrice = recentCandles[recentCandles.length - 1].close;
        const dropFromATH = ((allTimeHigh - currentPrice) / allTimeHigh) * 100;

        const recentVolumes = minuteData.volumeData.slice(-5);
        const volumeAvg = minuteData.volumeData.reduce((a, b) => a + b.volume, 0) / minuteData.volumeData.length;
        const recentVolumeAvg = recentVolumes.reduce((a, b) => a + b.volume, 0) / recentVolumes.length;
        const volumeDrop = ((volumeAvg - recentVolumeAvg) / volumeAvg) * 100;

        const recentPriceChanges = recentCandles.slice(-5).map((candle, i, arr) => {
            if (i === 0) return 0;
            return Math.abs((candle.close - arr[i - 1].close) / arr[i - 1].close) * 100;
        });

        const isFlatlining = recentPriceChanges.every(change => change < 0.1);
        const hasMassiveDrop = dropFromATH > 90;
        const hasVolumeDeath = recentVolumeAvg === 0 || volumeDrop > 95;
        const hasNoRecovery = priceDrops.slice(-5).every(drop => drop <= 0.1);

        return (hasMassiveDrop && hasVolumeDeath) ||
            (dropFromATH > 70 && hasNoRecovery && isFlatlining) ||
            (recentVolumeAvg === 0 && isFlatlining);
    }

    private detectSuspiciousPatterns(
        minuteData: CoinDetailsResponse,
        hourData: CoinDetailsResponse,
        holders: HoldersResponse
    ): { patterns: string[]; riskLevel: number } {
        const patterns: string[] = [];
        let riskScore = 0;

        if (this.isRugPulled(minuteData)) {
            patterns.push("Dead coin detected - No trading activity");
            riskScore = 100;
            return { patterns, riskLevel: riskScore };
        }

        const recentCandles = minuteData.candlestickData.slice(-30);
        const priceChanges = recentCandles.map((candle, i) => {
            if (i === 0) return 0;
            return ((candle.close - recentCandles[i - 1].close) / recentCandles[i - 1].close) * 100;
        });

        const maxPriceChange = Math.max(...priceChanges);
        const minPriceChange = Math.min(...priceChanges);

        if (maxPriceChange > 500) {
            patterns.push("⚠️ Extreme pump detected (>500% spike)");
            riskScore += 60;
        } else if (maxPriceChange > 200) {
            patterns.push("Warning: Large pump detected (>200% spike)");
            riskScore += 40;
        }

        if (minPriceChange < -30) {
            patterns.push("⚠️ Major dump in progress");
            riskScore += 50;
        }

        const recentVolumes = minuteData.volumeData.slice(-30);
        const averageVolume = recentVolumes.reduce((sum, v) => sum + v.volume, 0) / recentVolumes.length;
        const latestVolume = recentVolumes[recentVolumes.length - 1].volume;

        if (latestVolume === 0) {
            patterns.push("⚠️ Zero volume - potential death");
            riskScore += 70;
        } else if (latestVolume < averageVolume * 0.1) {
            patterns.push("Volume dying out");
            riskScore += 40;
        }

        const holderAnalyses = this.analyzeHolderBehavior(holders);
        const topHolder = holders.holders[0];
        const totalSupply = holders.holders.reduce((sum, h) => sum + h.balance, 0);

        if (topHolder) {
            const topHolderPercentage = (topHolder.balance / totalSupply) * 100;
            if (topHolderPercentage > 90) {
                patterns.push("🚨 Single wallet owns >90% - Extreme rug pull risk");
                riskScore += 80;
            } else if (topHolderPercentage > 50) {
                patterns.push("⚠️ Single wallet owns >50% - High rug pull risk");
                riskScore += 60;
            }
        }

        if (holderAnalyses.some(h => h.riskLevel === 'extreme') &&
            maxPriceChange > 100 &&
            minPriceChange < -20) {
            patterns.push("🚨 Rug pull in progress");
            riskScore += 90;
        }

        return {
            patterns,
            riskLevel: Math.min(100, riskScore)
        };
    }

    private analyzeTradingOpportunities(
        technical: any,
        fundamental: any,
        liquidity: any,
        concentration: any
    ): {
        shortTerm: { potential: number; reasoning: string[] };
        midTerm: { potential: number; reasoning: string[] };
        longTerm: { potential: number; reasoning: string[] };
    } {
        const opportunities = {
            shortTerm: { potential: 70, reasoning: [] as string[] },
            midTerm: { potential: 40, reasoning: [] as string[] },
            longTerm: { potential: 30, reasoning: [] as string[] }
        };

        if (technical.score > 50) {
            opportunities.shortTerm.potential += 25;
            opportunities.shortTerm.reasoning.push("Strong technical indicators for quick gains");
        }

        if (liquidity.score < 25) {
            opportunities.shortTerm.potential -= 40;
            opportunities.shortTerm.reasoning.push("Very low liquidity - high exit risk");
        }

        if (technical.score > 40 && liquidity.score > 30) {
            opportunities.midTerm.potential += 20;
            opportunities.midTerm.reasoning.push("Decent technical setup with adequate liquidity");
        }

        if (concentration.score < 15) {
            opportunities.midTerm.potential -= 30;
            opportunities.midTerm.reasoning.push("Extreme concentration - high rug pull risk");
        }

        if (technical.score > 60 && liquidity.score > 40 && concentration.score > 20) {
            opportunities.longTerm.potential += 20;
            opportunities.longTerm.reasoning.push("Strong technical setup with decent liquidity");
        } else {
            opportunities.longTerm.potential -= 20;
            opportunities.longTerm.reasoning.push("Long-term holding very risky in current market");
        }

        opportunities.shortTerm.potential = Math.max(0, Math.min(100, opportunities.shortTerm.potential));
        opportunities.midTerm.potential = Math.max(0, Math.min(100, opportunities.midTerm.potential));
        opportunities.longTerm.potential = Math.max(0, Math.min(100, opportunities.longTerm.potential));

        return opportunities;
    }

    private calculateIntelligentRiskLevel(data: any): { riskLevel: RiskLevel; confidence: number } {
        const entryExit = data.tradingIntelligence?.entryExit;
        const marketPsych = data.tradingIntelligence?.marketPsychology;
        const holderData = data.holderAnalysis;
        const riskData = data.riskAssessment;

        let riskScore = riskData.overallRiskScore || 50;
        let confidence = 75;

        if (entryExit) {
            if (entryExit.currentPosition === 'oversold' && entryExit.confidence > 70) {
                riskScore -= 15;
                confidence += 10;
            } else if (entryExit.currentPosition === 'overbought' && entryExit.confidence > 70) {
                riskScore += 20;
                confidence += 5;
            }
        }

        if (marketPsych) {
            if (marketPsych.sentiment === 'extreme_fear' && marketPsych.buyPressure > 60) {
                riskScore -= 10;
            } else if (marketPsych.sentiment === 'extreme_greed' && marketPsych.sellPressure > 60) {
                riskScore += 15;
            }
        }

        if (holderData.holderBehavior) {
            const legitimateWhales = holderData.holderBehavior.filter((h: any) =>
                h.isWhale && h.riskScore < 30 && h.activityLevel === 'low'
            );
            if (legitimateWhales.length > 0) {
                riskScore -= legitimateWhales.length * 5;
            }
        }

        riskScore = Math.max(0, Math.min(100, riskScore));

        let riskLevel: RiskLevel;
        if (riskScore >= 80) riskLevel = 'VERY_HIGH';
        else if (riskScore >= 65) riskLevel = 'HIGH';
        else if (riskScore >= 50) riskLevel = 'MEDIUM';
        else if (riskScore >= 35) riskLevel = 'LOW';
        else riskLevel = 'VERY_LOW';

        return { riskLevel, confidence: Math.min(95, confidence) };
    }

    private generateIntelligentRecommendation(data: any, riskLevel: RiskLevel): Recommendation {
        const entryExit = data.tradingIntelligence?.entryExit;
        const marketPsych = data.tradingIntelligence?.marketPsychology;
        const isGrowthCoin = data.basicInfo.change24h > 20 && data.basicInfo.volume24h > 10000;

        if (riskLevel === 'VERY_HIGH') {
            return 'STRONG_SELL';
        }

        if (entryExit && entryExit.confidence > 70) {
            switch (entryExit.recommendation) {
                case 'buy':
                    if (riskLevel === 'LOW' || riskLevel === 'VERY_LOW') {
                        return isGrowthCoin ? 'STRONG_BUY' : 'BUY';
                    } else if (riskLevel === 'MEDIUM') {
                        return 'BUY';
                    } else {
                        return 'HOLD';
                    }
                case 'sell':
                    return riskLevel === 'HIGH' ? 'STRONG_SELL' : 'SELL';
                case 'wait':
                    return 'HOLD';
                default:
                    return 'HOLD';
            }
        }

        switch (riskLevel) {
            case 'VERY_LOW': return isGrowthCoin ? 'STRONG_BUY' : 'BUY';
            case 'LOW': return 'BUY';
            case 'MEDIUM': return 'HOLD';
            case 'HIGH': return 'SELL';
            default: return 'STRONG_SELL';
        }
    }

    private enhanceTechnicalAnalysis(data: any, minuteData: CoinDetailsResponse) {
        const entryExit = data.tradingIntelligence?.entryExit;
        const baseAnalysis = this.analyzeTechnical(minuteData, minuteData, minuteData);

        if (!entryExit) return baseAnalysis;

        const enhancedIndicators = [
            ...baseAnalysis.indicators,
            `Market Position: ${entryExit.currentPosition}`,
            `Entry Target: ${entryExit.targetEntry?.toFixed(6) || 'N/A'}`,
            `Exit Target: ${entryExit.targetExit?.toFixed(6) || 'N/A'}`,
            `Stop Loss: ${entryExit.stopLoss?.toFixed(6) || 'N/A'}`
        ];

        if (entryExit.technicalLevels) {
            const levels = entryExit.technicalLevels;
            enhancedIndicators.push(
                `RSI: ${levels.rsi?.toFixed(2) || 'N/A'}`,
                `Support: ${levels.support?.toFixed(6) || 'N/A'}`,
                `Resistance: ${levels.resistance?.toFixed(6) || 'N/A'}`,
                `Volume Profile: ${levels.volumeProfile?.toFixed(2) || 'N/A'}x`
            );
        }

        return {
            score: Math.min(100, baseAnalysis.score + entryExit.confidence * 0.3),
            reasoning: `${baseAnalysis.reasoning} Enhanced with market intelligence: ${entryExit.currentPosition} position detected.`,
            indicators: enhancedIndicators
        };
    }

    private generateIntelligentSummary(data: any, recommendation: Recommendation, riskLevel: RiskLevel, confidence: number): string {
        const coin = data.basicInfo;
        const entryExit = data.tradingIntelligence?.entryExit;
        const marketPsych = data.tradingIntelligence?.marketPsychology;

        let summary = `Intelligence Analysis for ${coin.name} (${coin.symbol}):\n\n`;
        summary += `• Current Price: $${coin.currentPrice?.toFixed(6) || 'N/A'}\n`;
        summary += `• 24h Change: ${coin.change24h?.toFixed(2) || 'N/A'}%\n`;
        summary += `• Market Cap: $${coin.marketCap?.toLocaleString() || 'N/A'}\n`;
        summary += `• Risk Level: ${riskLevel}\n`;
        summary += `• Confidence: ${confidence.toFixed(1)}%\n\n`;

        if (entryExit) {
            summary += `📊 Technical Position: ${entryExit.currentPosition.replace('_', ' ')}\n`;
            summary += `🎯 Recommendation: ${entryExit.recommendation} (${entryExit.confidence}% confidence)\n\n`;
        }

        if (marketPsych) {
            summary += `🧠 Market Psychology: ${marketPsych.sentiment.replace('_', ' ')}\n`;
            summary += `📈 Buy Pressure: ${marketPsych.buyPressure?.toFixed(1) || 'N/A'}%\n`;
            summary += `🐋 Whale Activity: ${marketPsych.whaleActivity?.toFixed(1) || 'N/A'}%\n\n`;
        }

        summary += this.getRecommendationDescription(recommendation);

        return summary;
    }

    private analyzeSentimentWithIntelligence(data: any) {
        const marketPsych = data.tradingIntelligence?.marketPsychology;
        const baseSentiment = this.analyzeSentiment(data.basicInfo);

        if (!marketPsych) return baseSentiment;

        let enhancedScore = baseSentiment.score;
        let enhancedReasoning = baseSentiment.reasoning;

        if (marketPsych.sentiment === 'extreme_greed') {
            enhancedScore -= 15;
            enhancedReasoning += ' Market showing extreme greed - potential reversal risk.';
        } else if (marketPsych.sentiment === 'extreme_fear') {
            enhancedScore += 20;
            enhancedReasoning += ' Market in extreme fear - potential opportunity.';
        }

        const pressureDiff = marketPsych.buyPressure - marketPsych.sellPressure;
        enhancedScore += pressureDiff * 0.2;

        return {
            score: Math.max(0, Math.min(100, enhancedScore)),
            reasoning: enhancedReasoning,
            metrics: {
                ...baseSentiment.metrics,
                marketPsychology: marketPsych.sentiment,
                buyPressure: marketPsych.buyPressure,
                fearGreedIndex: marketPsych.fearGreedIndex
            }
        };
    }

    private analyzeLiquidityWithIntelligence(data: any) {
        const liquidityData = data.liquidityAnalysis;
        const baseLiquidity = this.analyzeLiquidity(data.basicInfo);

        if (!liquidityData) return baseLiquidity;

        let enhancedScore = baseLiquidity.score;
        let enhancedReasoning = baseLiquidity.reasoning;
        const enhancedWarnings = [...baseLiquidity.warnings];

        if (liquidityData.liquidityRisk === 'high') {
            enhancedScore -= 25;
            enhancedWarnings.push('High liquidity risk detected by market intelligence');
        } else if (liquidityData.liquidityRisk === 'low') {
            enhancedScore += 15;
        }

        if (liquidityData.poolPercentage < 20) {
            enhancedWarnings.push(`Only ${liquidityData.poolPercentage.toFixed(1)}% of supply in liquidity pool`);
        }

        return {
            score: Math.max(0, Math.min(100, enhancedScore)),
            reasoning: enhancedReasoning + ` Pool analysis: ${liquidityData.poolPercentage.toFixed(1)}% of supply pooled.`,
            warnings: enhancedWarnings
        };
    }

    private analyzeConcentrationWithIntelligence(data: any) {
        const holderData = data.holderAnalysis;
        const baseConcentration = this.analyzeConcentration({
            totalHolders: 100,
            holders: []
        });

        if (!holderData) return baseConcentration;

        let enhancedScore = 50;
        let enhancedReasoning = '';
        const enhancedRisks = [];

        if (holderData.topHolderPercentage > 50) {
            enhancedScore -= 30;
            enhancedRisks.push(`Top holder controls ${holderData.topHolderPercentage.toFixed(1)}% of supply`);
        } else if (holderData.topHolderPercentage > 20) {
            enhancedScore -= 15;
            enhancedRisks.push(`Moderate concentration with top holder at ${holderData.topHolderPercentage.toFixed(1)}%`);
        }

        if (holderData.top5HolderPercentage > 80) {
            enhancedScore -= 25;
            enhancedRisks.push(`Top 5 holders control ${holderData.top5HolderPercentage.toFixed(1)}% of supply`);
        }

        if (holderData.holderBehavior) {
            const suspiciousHolders = holderData.holderBehavior.filter((h: any) => h.riskScore > 50);
            if (suspiciousHolders.length > 0) {
                enhancedScore -= suspiciousHolders.length * 10;
                enhancedRisks.push(`${suspiciousHolders.length} major holders showing concerning patterns`);
            }
        }

        enhancedReasoning = `Concentration analysis based on on-chain intelligence. ${holderData.concentrationRisk} risk level.`;

        return {
            score: Math.max(0, Math.min(100, enhancedScore)),
            reasoning: enhancedReasoning,
            risks: enhancedRisks
        };
    }

    private analyzeFundamentalWithIntelligence(data: any) {
        const baseFundamental = this.analyzeFundamental(data.basicInfo, { coins: [] }, {
            coins: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0
        });

        const creatorProfile = data.intelligence?.creatorProfile;
        const marketPosition = data.intelligence?.marketPosition;

        let enhancedScore = baseFundamental.score;
        const enhancedSignals = [...baseFundamental.signals];

        if (creatorProfile?.name && creatorProfile.name !== 'Anonymous') {
            enhancedScore += 10;
            enhancedSignals.push('Identified creator adds credibility');
        }

        if (marketPosition === 'trending') {
            enhancedScore += 15;
            enhancedSignals.push('Coin in trending category');
        } else if (marketPosition === 'moon') {
            enhancedScore += 5;
            enhancedSignals.push('Coin marked as potential moonshot');
        }

        return {
            score: Math.max(0, Math.min(100, enhancedScore)),
            reasoning: baseFundamental.reasoning + ' Enhanced with creator and market position analysis.',
            signals: enhancedSignals
        };
    }

    private analyzeIntelligentTradingOpportunities(data: any) {
        const entryExit = data.tradingIntelligence?.entryExit;
        const marketPsych = data.tradingIntelligence?.marketPsychology;

        const baseOpportunities = this.analyzeTradingOpportunities({}, {}, {}, {});

        if (!entryExit) return baseOpportunities;

        let shortTermPotential = 50;
        const shortTermReasoning = [];

        if (entryExit.currentPosition === 'oversold' && entryExit.confidence > 70) {
            shortTermPotential += 30;
            shortTermReasoning.push('Strong oversold signal with high confidence');
        } else if (entryExit.currentPosition === 'accumulation_zone') {
            shortTermPotential += 20;
            shortTermReasoning.push('Price in accumulation zone');
        }

        if (marketPsych?.buyPressure > 70) {
            shortTermPotential += 15;
            shortTermReasoning.push('Strong buying pressure detected');
        }

        let midTermPotential = 40;
        const midTermReasoning = [];

        if (entryExit.technicalLevels?.rsi < 40) {
            midTermPotential += 20;
            midTermReasoning.push('RSI indicates good entry opportunity');
        }

        if (marketPsych?.sentiment === 'fear' && marketPsych.momentum > 0) {
            midTermPotential += 25;
            midTermReasoning.push('Fear sentiment with positive momentum');
        }

        let longTermPotential = 30;
        const longTermReasoning = [];

        if (data.riskAssessment?.stabilityScore > 70) {
            longTermPotential += 25;
            longTermReasoning.push('High stability score indicates sustainable growth potential');
        }

        if (data.holderAnalysis?.concentrationRisk === 'low') {
            longTermPotential += 20;
            longTermReasoning.push('Low concentration risk supports long-term holding');
        }

        return {
            shortTerm: {
                potential: Math.min(100, shortTermPotential),
                reasoning: shortTermReasoning
            },
            midTerm: {
                potential: Math.min(100, midTermPotential),
                reasoning: midTermReasoning
            },
            longTerm: {
                potential: Math.min(100, longTermPotential),
                reasoning: longTermReasoning
            }
        };
    }

    private generateIntelligentWarnings(data: any): string[] {
        const warnings = [];
        const riskData = data.riskAssessment;
        const holderData = data.holderAnalysis;
        const tradingData = data.tradingIntelligence;

        if (riskData?.riskLevel === 'HIGH' || riskData?.riskLevel === 'CRITICAL') {
            warnings.push(`${riskData.riskLevel} risk level detected by market intelligence`);
        }

        if (holderData?.holderBehavior) {
            const suspiciousCount = holderData.holderBehavior.filter((h: any) => h.suspiciousPatterns?.length > 0).length;
            if (suspiciousCount > 0) {
                warnings.push(`${suspiciousCount} major holders showing suspicious trading patterns`);
            }
        }

        if (tradingData?.marketPsychology?.sentiment === 'extreme_greed') {
            warnings.push('Market in extreme greed - consider taking profits');
        }

        if (tradingData?.entryExit?.currentPosition === 'overbought') {
            warnings.push('Technical analysis indicates overbought conditions');
        }

        return warnings;
    }

    private generateIntelligentOpportunities(data: any): string[] {
        const opportunities = [];
        const entryExit = data.tradingIntelligence?.entryExit;
        const marketPsych = data.tradingIntelligence?.marketPsychology;
        const riskData = data.riskAssessment;

        if (entryExit?.currentPosition === 'oversold' && entryExit.confidence > 70) {
            opportunities.push(`Strong oversold signal - potential entry opportunity (${entryExit.confidence}% confidence)`);
        }

        if (marketPsych?.sentiment === 'extreme_fear' && marketPsych.buyPressure > 60) {
            opportunities.push('Market fear with strong buying pressure - contrarian opportunity');
        }

        if (riskData?.stabilityScore > 70 && data.basicInfo?.change24h > 10) {
            opportunities.push('High stability with positive momentum - quality growth opportunity');
        }

        if (marketPsych?.tradingIntensity === 'high' && marketPsych.buyPressure > 65) {
            opportunities.push('High trading intensity with buy dominance');
        }

        return opportunities;
    }
} 