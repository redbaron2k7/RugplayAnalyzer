import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, 'Missing or invalid authorization header');
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { symbol } = params;
    
    if (!symbol) {
      throw error(400, 'Missing coin symbol parameter');
    }
    
    // Make request to Rugplay API
    const response = await fetch(`https://rugplay.com/api/v1/holders/${encodeURIComponent(symbol)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw error(401, 'Invalid API key');
      }
      if (response.status === 404) {
        throw error(404, 'Coin not found');
      }
      if (response.status === 429) {
        throw error(429, 'Rate limit exceeded');
      }
      throw error(response.status, `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    console.error('Holders API error:', err);
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    throw error(500, 'Internal server error');
  }
};