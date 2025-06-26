import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  RugplayApiClient,
  CachedData,
  CacheManager,
  TopCoinsResponse,
  MarketDataResponse,
  CoinDetailsResponse,
  HoldersResponse
} from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatValue(value: number, decimals: number = 2): string {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(decimals) + 'B';
  } else if (value >= 1e6) {
    return (value / 1e6).toFixed(decimals) + 'M';
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(decimals) + 'K';
  }
  return value.toFixed(decimals);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(value);
}

export function formatPercentage(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0.00%';
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-gray-500';
}

export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function getCoinImageUrl(iconPath: string | null | undefined): string {
  if (!iconPath) {
    return '/rugplay.svg';
  }

  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    return iconPath;
  }

  const baseUrl = 'https://s3.eu-central-003.backblazeb2.com/rugplay/';

  const cleanPath = iconPath.startsWith('/') ? iconPath.slice(1) : iconPath;

  return baseUrl + cleanPath;
}

export function getUserImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) {
    return '/rugplay.svg';
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  const baseUrl = 'https://s3.eu-central-003.backblazeb2.com/rugplay/';

  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  return baseUrl + cleanPath;
}

export class LocalStorageCacheManager implements CacheManager {
  private prefix = 'rugplay_cache_';

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  get<T>(key: string): CachedData<T> | null {
    if (!this.isClient()) return null;

    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;
      return JSON.parse(item);
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T): void {
    if (!this.isClient()) return;

    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(cachedData));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  isStale(key: string, maxAge: number): boolean {
    const cached = this.get(key);
    if (!cached) return true;
    return Date.now() - cached.timestamp > maxAge;
  }

  clear(key?: string): void {
    if (!this.isClient()) return;

    if (key) {
      localStorage.removeItem(this.prefix + key);
    } else {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.prefix))
        .forEach(k => localStorage.removeItem(k));
    }
  }

  getStats() {
    if (!this.isClient()) {
      return {
        totalEntries: 0,
        totalSize: '0 KB',
        oldestEntry: 'None',
        newestEntry: 'None'
      };
    }

    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
    const entries = keys.map(k => {
      const item = localStorage.getItem(k);
      return item ? { key: k, size: item.length, data: JSON.parse(item) } : null;
    }).filter(Boolean);

    const totalSize = entries.reduce((sum, entry) => sum + (entry?.size || 0), 0);
    const timestamps = entries.map(e => e?.data.timestamp).filter(Boolean);

    return {
      totalEntries: entries.length,
      totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
      oldestEntry: timestamps.length ? formatTimestamp(Math.min(...timestamps)) : 'None',
      newestEntry: timestamps.length ? formatTimestamp(Math.max(...timestamps)) : 'None'
    };
  }
}

export const cacheManager = new LocalStorageCacheManager();

export function createApiClient(apiKey: string, useCache: boolean = true): RugplayApiClient {
  const baseUrl = '/api/v1';

  const client = {
    apiKey,

    async get<T>(endpoint: string, params?: Record<string, any>, forceRefresh?: boolean): Promise<T> {
      const cacheKey = `${endpoint}_${JSON.stringify(params || {})}_${apiKey}`;
      const maxAge = 5 * 60 * 1000;

      if (useCache && !(forceRefresh === true) && !cacheManager.isStale(cacheKey, maxAge)) {
        const cached = cacheManager.get<T>(cacheKey);
        if (cached) {
          return cached.data;
        }
      }

      const url = new URL(`${baseUrl}${endpoint}`, window.location.origin);

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, value.toString());
          }
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (useCache) {
        cacheManager.set(cacheKey, data);
      }

      return data;
    },

    async getTopCoins() {
      return this.get<TopCoinsResponse>('/top');
    },

    async getMarketData(params: {
      search?: string;
      sortBy?: 'marketCap' | 'currentPrice' | 'change24h' | 'volume24h' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      priceFilter?: 'all' | 'under1' | '1to10' | '10to100' | 'over100';
      changeFilter?: 'all' | 'gainers' | 'losers' | 'hot' | 'wild';
      page?: number;
      limit?: number;
    }) {
      return this.get<MarketDataResponse>('/market', params);
    },

    async getCoinDetails(symbol: string, timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1m') {
      return this.get<CoinDetailsResponse>(`/coin/${symbol}`, { timeframe });
    },

    async getCoinHolders(symbol: string) {
      return this.get<HoldersResponse>(`/holders/${symbol}`);
    }
  };

  return client;
} 