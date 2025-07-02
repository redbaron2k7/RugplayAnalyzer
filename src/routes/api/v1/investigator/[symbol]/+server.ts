import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RUGPLAY_API_BASE = 'https://api.rugplay.com/api/v1';

async function fetchRugplayData(endpoint: string, apiKey: string) {
    const response = await fetch(`${RUGPLAY_API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw error(response.status, errorData.message || `Failed to fetch from ${endpoint}`);
    }
    return response.json();
}

export const GET: RequestHandler = async ({ params, request }) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return error(401, 'Authorization header required');
    }
    const apiKey = authHeader.replace('Bearer ', '');
    const { symbol } = params;
    if (!symbol) {
        return error(400, 'Symbol is required');
    }

    try {
        const [coinDetails, holdersData] = await Promise.all([
            fetchRugplayData(`/coin/${symbol.toUpperCase()}`, apiKey),
            fetchRugplayData(`/holders/${symbol.toUpperCase()}`, apiKey),
        ]);

        // NOTE: The official API does not provide a global trade feed, so detailed
        // cross-holder and suspicious trade analysis like in the original version
        // is not possible. This is a simplified, functional version based on available data.

        const simplifiedHolderAnalysis = holdersData.holders.slice(0, 10).map((h: any) => {
            let riskScore = 0;
            const riskFactors: string[] = [];

            if (h.percentage > 90) {
                riskScore += 80;
                riskFactors.push('Extreme concentration (>90%)');
            } else if (h.percentage > 50) {
                riskScore += 50;
                riskFactors.push('High concentration (>50%)');
            } else if (h.percentage > 20) {
                 riskScore += 20;
                 riskFactors.push('Moderate concentration (>20%)');
            }
            
            return {
                userId: h.userId,
                username: h.username,
                name: h.name,
                quantity: h.quantity,
                percentage: h.percentage,
                trades: { // Return empty trade data as it's not available
                    recentTrades: [],
                    buyCount: 0,
                    sellCount: 0,
                    totalVolume: 0,
                    averageTradeSize: 0,
                    largestTrade: null,
                    tradeFrequency: 0,
                    priceImpact: 0,
                    suspiciousPatterns: []
                },
                riskFactors,
                riskScore: Math.min(100, riskScore),
                isCreator: h.userId === coinDetails.coin.creatorId
            };
        });

        const overallRiskScore = simplifiedHolderAnalysis.reduce((acc, holder) => Math.max(acc, holder.riskScore), 0);

        const response = {
            info: { info: coinDetails },
            holders: holdersData,
            tradingMetrics: { // Mocked data as it's not available from the official API
                volume24h: coinDetails.coin.volume24h,
                trades24h: 0,
                uniqueTraders24h: holdersData.totalHolders,
                buyPressure: 50,
                sellPressure: 50,
                priceImpact: 0,
                largestTrade: null,
                suspiciousPatterns: []
            },
            riskScore: overallRiskScore,
            majorHolderAnalysis: simplifiedHolderAnalysis,
        };

        return json(response);

    } catch (err: any) {
        console.error('Investigation failed:', err);
        throw error(err.status || 500, `Investigation failed: ${err.body?.message || err.message}`);
    }
};