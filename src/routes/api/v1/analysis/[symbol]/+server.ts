import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RUGPLAY_API_BASE = 'https://api.rugplay.com/api/v1';

// A more robust fetch function with retries and timeouts
async function fetchRugplayData(endpoint: string, apiKey: string, retries = 3, timeout = 8000) {
	for (let i = 0; i < retries; i++) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(`${RUGPLAY_API_BASE}${endpoint}`, {
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				return response.json();
			}

			// Don't retry for client errors (like 404 Not Found or 401 Unauthorized)
			if (response.status >= 400 && response.status < 500) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to parse error' }));
				throw new Error(`Rugplay API Client Error: ${response.status} - ${errorData.message || 'Unknown client error'}`);
			}
			
			// For server errors (5xx), log and prepare to retry
			console.warn(`Rugplay API Server Error: ${response.status}. Retrying (attempt ${i + 1}/${retries})...`);

		} catch (e: any) {
            clearTimeout(timeoutId);
			console.warn(`Fetch failed for ${endpoint}. Retrying (attempt ${i + 1}/${retries})...`, e.message);
			if (i === retries - 1) { // If it's the last retry, throw the error
				throw e;
			}
		}
		
		// Wait before retrying
		await new Promise(res => setTimeout(res, 1000 * (i + 1)));
	}
	throw new Error(`Failed to fetch ${endpoint} after ${retries} attempts.`);
}

export const GET: RequestHandler = async ({ params, request }) => {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return error(401, 'Authorization header is required');
	}
	const apiKey = authHeader.replace('Bearer ', '');
	const { symbol } = params;

	if (!symbol) {
		return error(400, 'Symbol is required');
	}

	try {
		// Fetch all required data from the official Rugplay endpoints
		const [coinDetails, holdersData] = await Promise.all([
			fetchRugplayData(`/coin/${symbol.toUpperCase()}`, apiKey),
			fetchRugplayData(`/holders/${symbol.toUpperCase()}`, apiKey)
		]);
		
		// --- Simplified Analysis Logic using Official API Data ---
		const { coin } = coinDetails;
		const { holders, totalHolders, circulatingSupply } = holdersData;

		// Holder Analysis
		const topHolder = holders?.[0];
		const topHolderPercentage = topHolder?.percentage || 0;
		const top5Holders = holders?.slice(0, 5) || [];
		const top5HolderPercentage = top5Holders.reduce((sum: number, h: any) => sum + h.percentage, 0);

		let concentrationRisk = 'low';
		if (topHolderPercentage > 50) concentrationRisk = 'high';
		else if (topHolderPercentage > 20) concentrationRisk = 'medium';

		// Liquidity Analysis
		const poolPercentage = (coin.poolCoinAmount / circulatingSupply) * 100;
		let liquidityRisk = 'low';
		if (poolPercentage < 20 || coin.poolBaseCurrencyAmount < 1000) liquidityRisk = 'high';
		else if (poolPercentage < 50 || coin.poolBaseCurrencyAmount < 5000) liquidityRisk = 'medium';
		
		// Basic Risk Scoring
		let riskScore = 0;
		if (topHolderPercentage > 80) riskScore += 50;
		else if (topHolderPercentage > 50) riskScore += 30;
		if (totalHolders < 100) riskScore += 20;
		if (liquidityRisk === 'high') riskScore += 30;

		const riskLevel = riskScore > 75 ? 'CRITICAL' : riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MEDIUM' : 'LOW';

		// Construct a response object that resembles the old structure
		// This minimizes changes needed in the frontend CryptoAnalyzer class
		const comprehensiveAnalysis = {
			basicInfo: {
                name: coin.name,
                symbol: coin.symbol,
                currentPrice: coin.currentPrice,
                marketCap: coin.marketCap,
                volume24h: coin.volume24h,
                change24h: coin.change24h,
                createdAt: coin.createdAt,
                category: "N/A" // This info isn't in the official /coin endpoint
            },
			riskAssessment: {
                overallRiskScore: Math.min(100, riskScore),
                riskLevel: riskLevel,
				recommendation: riskScore > 50 ? 'sell' : 'buy',
				stabilityScore: 100 - riskScore, // Simplified
				rugPullRisk: {
					level: riskLevel,
					topHolderPct: topHolderPercentage,
					top5Pct: top5HolderPercentage,
					poolPctSupply: poolPercentage,
					priceChange24h: coin.change24h
				}
            },
			holderAnalysis: {
				topHolderPercentage: topHolderPercentage,
                top5HolderPercentage: top5HolderPercentage,
                holderBehavior: [], // This cannot be replicated with the official API
                concentrationRisk: concentrationRisk,
			},
			liquidityAnalysis: {
				poolPercentage: poolPercentage,
                poolValue: coin.poolBaseCurrencyAmount,
                liquidityRisk: liquidityRisk,
			},
			// These sections are simplified as the data isn't available
			tradingIntelligence: {
				entryExit: { recommendation: 'wait', confidence: 0 },
				marketPsychology: { sentiment: 'neutral', buyPressure: 50 },
				priceAction: { trend: 'neutral' }
			},
			historicalData: {},
			intelligence: {
				creatorProfile: {
					name: coin.creatorName,
					username: coin.creatorUsername,
					id: coin.creatorId,
				},
			}
		};

		return json(comprehensiveAnalysis);

	} catch (e: any) {
		console.error(`Full analysis failed for ${symbol}:`, e);
		return error(500, `Failed to perform analysis for ${symbol}: ${e.message}`);
	}
};