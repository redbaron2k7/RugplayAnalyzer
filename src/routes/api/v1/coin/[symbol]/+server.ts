import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, url }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, { message: 'Missing or invalid authorization header' });
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { symbol } = params;

    if (!symbol) {
      throw error(400, { message: 'Missing coin symbol parameter' });
    }

    const timeframe = url.searchParams.get('timeframe') || '1m';
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      throw error(400, { message: 'Invalid timeframe parameter' });
    }

    const response = await fetch(`https://rugplay.com/api/v1/coin/${symbol}?timeframe=${timeframe}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw error(response.status, { message: errorData.message || response.statusText });
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    if (err instanceof Error) {
      throw error(500, { message: err.message });
    }
    throw error(500, { message: 'Internal server error' });
  }
}; 