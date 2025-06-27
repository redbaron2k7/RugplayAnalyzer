import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface MarketIntelligence {
    trending: any[];
    risky: any[];
    opportunities: any[];
    marketOverview: any;
    alerts: any[];
}

const RUGSTATS_BASE_URL = 'https://api.rugstats.top';

async function fetchRugStatsData(endpoint: string) {
    const response = await fetch(`${RUGSTATS_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`Market data API error: ${response.status}`);
    }
    return response.json();
}

function analyzeTrendingOpportunities(coins: any[]) {
    return coins.map(coin => {
        const volumeToMcRatio = (coin.info.coin.volume24h / coin.info.coin.marketCap) * 100;
        const priceChange = coin.info.coin.change24h;

        let opportunityScore = 50;
        let opportunityType = 'neutral';

        if (volumeToMcRatio > 5 && priceChange > 10 && priceChange < 100) {
            opportunityScore += 30;
            opportunityType = 'momentum_play';
        }

        if (priceChange < -20 && volumeToMcRatio > 3) {
            opportunityScore += 25;
            opportunityType = 'reversal_candidate';
        }

        if (coin.riskScore < 30 && priceChange > 5) {
            opportunityScore += 20;
            opportunityType = 'safe_growth';
        }

        return {
            ...coin.info.coin,
            riskScore: coin.riskScore,
            opportunityScore: Math.min(100, opportunityScore),
            opportunityType,
            volumeToMcRatio,
            timeframe: '24h'
        };
    }).filter(coin => coin.opportunityScore > 65)
        .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function generateMarketAlerts(stats: any, riskyCoins: any[], topCoins: any[]) {
    const alerts = [];

    if (riskyCoins.length > 0) {
        const criticalRiskCoins = riskyCoins.filter(coin => coin.riskScore > 80);
        if (criticalRiskCoins.length > 0) {
            alerts.push({
                type: 'danger',
                title: 'Critical Risk Alert',
                message: `${criticalRiskCoins.length} coins showing critical rug pull risk`,
                coins: criticalRiskCoins.slice(0, 3).map(c => c.info.coin.symbol),
                priority: 'high'
            });
        }
    }

    const highVolatilityCoins = topCoins.filter(coin =>
        Math.abs(coin.info.coin.change24h) > 50
    );

    if (highVolatilityCoins.length > 5) {
        alerts.push({
            type: 'warning',
            title: 'High Market Volatility',
            message: `${highVolatilityCoins.length} trending coins showing extreme volatility`,
            coins: highVolatilityCoins.slice(0, 3).map(c => c.info.coin.symbol),
            priority: 'medium'
        });
    }

    const volumeSurgeCoins = topCoins.filter(coin => {
        const volumeToMc = (coin.info.coin.volume24h / coin.info.coin.marketCap) * 100;
        return volumeToMc > 10;
    });

    if (volumeSurgeCoins.length > 0) {
        alerts.push({
            type: 'info',
            title: 'Volume Surge Detected',
            message: `${volumeSurgeCoins.length} coins experiencing significant volume increases`,
            coins: volumeSurgeCoins.slice(0, 3).map(c => c.info.coin.symbol),
            priority: 'low'
        });
    }

    return alerts;
}

function calculateMarketOverview(stats: any, topCoins: any[], riskyCoins: any[]) {
    const gainers = topCoins.filter(coin => coin.info.coin.change24h > 0);
    const losers = topCoins.filter(coin => coin.info.coin.change24h < 0);

    const totalVolume = topCoins.reduce((sum, coin) =>
        sum + coin.info.coin.volume24h, 0
    );

    const averageChange = topCoins.reduce((sum, coin) =>
        sum + coin.info.coin.change24h, 0
    ) / topCoins.length;

    const marketSentiment = averageChange > 5 ? 'bullish' :
        averageChange < -5 ? 'bearish' : 'neutral';

    return {
        totalCoins: stats.totalCoins,
        rugRiskCoins: stats.rugRiskCoins,
        total24hVolume: totalVolume,
        marketSentiment,
        averageChange: averageChange.toFixed(2),
        gainersCount: gainers.length,
        losersCount: losers.length,
        highRiskPercentage: ((stats.rugRiskCoins / stats.totalCoins) * 100).toFixed(1),
        marketHealth: stats.rugRiskCoins / stats.totalCoins < 0.3 ? 'healthy' :
            stats.rugRiskCoins / stats.totalCoins < 0.5 ? 'caution' : 'risky'
    };
}

export const GET: RequestHandler = async () => {
    try {
        const [stats, topCoins, riskyCoins, moonCoins] = await Promise.all([
            fetchRugStatsData('/stats'),
            fetchRugStatsData('/topcoins'),
            fetchRugStatsData('/rugcoins'),
            fetchRugStatsData('/mooncoins')
        ]);

        const opportunities = analyzeTrendingOpportunities(topCoins);

        const alerts = generateMarketAlerts(stats, riskyCoins, topCoins);

        const marketOverview = calculateMarketOverview(stats, topCoins, riskyCoins);

        const trendingCoins = topCoins.slice(0, 20).map((coin: any) => ({
            ...coin.info.coin,
            riskScore: coin.riskScore,
            volumeRatio: (coin.info.coin.volume24h / coin.info.coin.marketCap) * 100,
            category: coin.info.coin.category || 'trending'
        }));

        const riskyCoinsData = riskyCoins.slice(0, 10).map((coin: any) => ({
            ...coin.info.coin,
            riskScore: coin.riskScore,
            riskLevel: coin.riskScore > 80 ? 'critical' :
                coin.riskScore > 60 ? 'high' :
                    coin.riskScore > 40 ? 'medium' : 'low',
            timeSinceCreation: Date.now() - new Date(coin.info.coin.createdAt).getTime()
        }));

        const intelligence: MarketIntelligence = {
            trending: trendingCoins,
            risky: riskyCoinsData,
            opportunities: opportunities.slice(0, 15),
            marketOverview,
            alerts
        };

        return json(intelligence);

    } catch (error) {
        console.error('Market intelligence API error:', error);
        return json(
            { error: 'Failed to fetch market intelligence' },
            { status: 500 }
        );
    }
}; 