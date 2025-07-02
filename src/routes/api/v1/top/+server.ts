import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, 'Missing or invalid authorization header');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const response = await fetch('https://api.rugplay.com/api/v1/top', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Rugplay API error:', response.status, response.statusText, errorText);

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
    console.error('Top coins API error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    if (err instanceof Error) {
      throw error(500, `Server error: ${err.message}`);
    }

    throw error(500, 'Internal server error');
  }
};