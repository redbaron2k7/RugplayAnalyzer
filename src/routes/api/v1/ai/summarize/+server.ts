import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GOOGLE_API_KEY } from '$env/static/private';
import type { AnalysisResult } from '$lib/types';
import { formatCurrency } from '$lib/utils';

// --- EDIT THIS SYSTEM PROMPT TO CHANGE THE AI'S BEHAVIOR ---
const SYSTEM_PROMPT = `
You are a professional cryptocurrency analyst named "Rugplay AI". Your task is to provide a concise, easy-to-understand summary and final verdict based on the detailed analysis data provided below. Format your response as plain text, using newlines for structure. Do not use Markdown, bolding, or asterisks.

Your analysis MUST include the following sections in this exact order:
1.  **Final Verdict:** A single, direct sentence stating your overall recommendation (e.g., "This project is extremely high-risk and resembles a classic pump-and-dump scheme.").
2.  **Summary:** A short paragraph explaining the key factors influencing your verdict.
3.  **Bullish Points:** A bulleted list of positive indicators. Use a hyphen (-) for bullets.
4.  **Bearish Points:** A bulleted list of negative indicators and major red flags. Use a hyphen (-) for bullets.
5.  **Conclusion:** A final thought on the project's legitimacy and long-term viability.

Interpret the data, do not just repeat it. Be critical, objective, and focus on investor risk.

---
**ANALYSIS DATA FOR {COIN_NAME} ({COIN_SYMBOL})**

**Core Metrics:**
- Current Price: {CURRENT_PRICE}
- Market Cap: {MARKET_CAP}
- 24h Volume: {VOLUME_24H}
- Overall Recommendation: {RECOMMENDATION} with {CONFIDENCE}% confidence.
- Overall Risk Level: {RISK_LEVEL}

**Rug Pull Analysis:**
- Risk Level: {RUG_PULL_RISK_LEVEL} ({RUG_PULL_RISK_SCORE}%)
- Summary: {RUG_PULL_SUMMARY}
- Key Indicators:
{RUG_PULL_INDICATORS}

**Factor Scores:**
- Technical Score: {TECHNICAL_SCORE}/100
- Fundamental Score: {FUNDAMENTAL_SCORE}/100
- Liquidity Score: {LIQUIDITY_SCORE}/100
- Holder Concentration Score: {CONCENTRATION_SCORE}/100 (Lower is worse)

**Key Warnings:**
{KEY_WARNINGS}

**Key Opportunities:**
{KEY_OPPORTUNITIES}
---

Now, provide your expert analysis based on this data. REMEMBER THIS IS A GAME! NOT REAL MONEY! COINS ARE ALWAYS PRETTY YOUNG AND EVERY COIN STARTS AT $0.000001 and a Market Cap of $1.00K. You are talking to a user who is not that smart so use terms like Risk and Opportunities not bearish or bullish. Use the data provided to help you decide whether the user should buy or not. At the end of every message put your reccomendation like 'Recommendation: (either buy, hold, or sell)' You are a risk analyst.
`;
// --- END OF SYSTEM PROMPT ---

function buildPrompt(data: AnalysisResult): string {
	const rugPullIndicators =
		data.rugPullAnalysis.indicators
			.map((i) => `  - ${i.description} (Severity: ${i.severity})`)
			.join('\n') || '  - None';

	const keyWarnings = data.warnings.map((w) => `- ${w}`).join('\n') || '- None';
	const keyOpportunities = data.opportunities.map((o) => `- ${o}`).join('\n') || '- None';

	let prompt = SYSTEM_PROMPT;
	prompt = prompt.replace('{COIN_NAME}', data.coin.name);
	prompt = prompt.replace('{COIN_SYMBOL}', data.coin.symbol);
	prompt = prompt.replace('{CURRENT_PRICE}', formatCurrency(data.coin.currentPrice));
	prompt = prompt.replace('{MARKET_CAP}', formatCurrency(data.coin.marketCap));
	prompt = prompt.replace('{VOLUME_24H}', formatCurrency(data.coin.volume24h));
	prompt = prompt.replace('{RECOMMENDATION}', data.recommendation);
	prompt = prompt.replace('{CONFIDENCE}', data.confidence.toFixed(1));
	prompt = prompt.replace('{RISK_LEVEL}', data.riskLevel);
	prompt = prompt.replace('{RUG_PULL_RISK_LEVEL}', data.rugPullAnalysis.riskLevel.toUpperCase());
	prompt = prompt.replace('{RUG_PULL_RISK_SCORE}', data.rugPullAnalysis.overallRisk.toString());
	prompt = prompt.replace('{RUG_PULL_SUMMARY}', data.rugPullAnalysis.shortDescription);
	prompt = prompt.replace('{RUG_PULL_INDICATORS}', rugPullIndicators);
	prompt = prompt.replace('{TECHNICAL_SCORE}', data.factors.technical.score.toFixed(0));
	prompt = prompt.replace('{FUNDAMENTAL_SCORE}', data.factors.fundamental.score.toFixed(0));
	prompt = prompt.replace('{LIQUIDITY_SCORE}', data.factors.liquidity.score.toFixed(0));
	prompt = prompt.replace('{CONCENTRATION_SCORE}', data.factors.concentration.score.toFixed(0));
	prompt = prompt.replace('{KEY_WARNINGS}', keyWarnings);
	prompt = prompt.replace('{KEY_OPPORTUNITIES}', keyOpportunities);

	return prompt.trim();
}

export const POST: RequestHandler = async ({ request }) => {
	if (!GOOGLE_API_KEY) {
		throw error(
			500,
			'The GOOGLE_API_KEY is not configured on the server. Please add it to your .env file.',
		);
	}

	try {
		const coinAnalysis: AnalysisResult = await request.json();

		if (!coinAnalysis || !coinAnalysis.coin) {
			throw error(400, 'Invalid analysis data provided.');
		}

		const prompt = buildPrompt(coinAnalysis);

		const apiResponse = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${GOOGLE_API_KEY}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.4,
						topK: 32,
						topP: 1,
						maxOutputTokens: 1024,
					},
				}),
			},
		);

		if (!apiResponse.ok) {
			const errorBody = await apiResponse.json();
			console.error('Google AI API Error:', errorBody);
			throw error(
				apiResponse.status,
				`Failed to get analysis from AI: ${errorBody.error?.message || 'Unknown error'}`,
			);
		}

		const responseData = await apiResponse.json();
		const summary = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

		if (!summary) {
			throw error(500, 'AI returned an empty or invalid response.');
		}

		return json({ summary });
	} catch (err) {
		console.error('AI summarization error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'An internal error occurred while generating the AI summary.');
	}
};