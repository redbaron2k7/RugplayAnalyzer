import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, 'Missing or invalid authorization header');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const response = await fetch('https://api.rugplay.com/api/v1/hopium', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw error(401, 'Invalid API key');
      }
      if (response.status === 429) {
        throw error(429, 'Rate limit exceeded');
      }
      throw error(response.status, `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    console.error('Hopium API error:', err);
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    throw error(500, 'Internal server error');
  }
};