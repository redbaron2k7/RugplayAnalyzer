import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, { message: 'Missing or invalid authorization header' });
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy') || 'marketCap';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const priceFilter = url.searchParams.get('priceFilter') || 'all';
    const changeFilter = url.searchParams.get('changeFilter') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 100);

    const validSortBy = ['marketCap', 'currentPrice', 'change24h', 'volume24h', 'createdAt'];
    if (!validSortBy.includes(sortBy)) {
      throw error(400, { message: 'Invalid sortBy parameter' });
    }

    const validSortOrder = ['asc', 'desc'];
    if (!validSortOrder.includes(sortOrder)) {
      throw error(400, { message: 'Invalid sortOrder parameter' });
    }

    const validPriceFilter = ['all', 'under1', '1to10', '10to100', 'over100'];
    if (!validPriceFilter.includes(priceFilter)) {
      throw error(400, { message: 'Invalid priceFilter parameter' });
    }

    const validChangeFilter = ['all', 'gainers', 'losers', 'hot', 'wild'];
    if (!validChangeFilter.includes(changeFilter)) {
      throw error(400, { message: 'Invalid changeFilter parameter' });
    }

    if (isNaN(page) || page < 1) {
      throw error(400, { message: 'Invalid page parameter' });
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw error(400, { message: 'Invalid limit parameter' });
    }

    const queryParams = new URLSearchParams({
      ...(search && { search }),
      sortBy,
      sortOrder,
      priceFilter,
      changeFilter,
      page: page.toString(),
      limit: limit.toString()
    });

    const response = await fetch(`https://api.rugplay.com/api/v1/market?${queryParams}`, {
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