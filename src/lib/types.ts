export interface CoinData {
  symbol: string;
  name: string;
  icon: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  poolCoinAmount: number;
  poolBaseCurrencyAmount: number;
  circulatingSupply: number;
  initialSupply: number;
  isListed: boolean;
  createdAt: string;
  creatorId: number;
  creatorName: string;
  creatorUsername: string;
  creatorBio: string;
  creatorImage: string;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  price: number;
  timestamp: number;  // Unix timestamp in milliseconds
}

export interface VolumeData {
  time: number;
  volume: number;
}

export interface CoinDetailsResponse {
  coin: {
    id: number;
    name: string;
    symbol: string;
    icon: string;
    currentPrice: number;
    marketCap: number;
    volume24h: number;
    change24h: number;
    poolCoinAmount: number;
    poolBaseCurrencyAmount: number;
    poolLiquidity: number;
    poolPrice: number;
    poolWeight: number;
    creatorAddress: string;
    creatorName: string;
    creatorImage: string;
    holders: Array<{ address: string; balance: number }>;
    totalSupply: number;
    circulatingSupply: number;
    createdAt: string;
    initialSupply: number;
    isListed: boolean;
    creatorId: number;
    creatorUsername: string;
    creatorBio: string;
  };
  candlestickData: CandlestickData[];
  volumeData: Array<{
    time: number;
    volume: number;
  }>;
  timeframe: string;
}

export interface HoldersResponse {
  holders: Array<{
    address: string;
    balance: number;
    percentage: number;
    rank: number;
  }>;
  totalHolders: number;
}

export interface TopCoinsResponse {
  coins: Array<{
    symbol: string;
    name: string;
    icon: string;
    price: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
  }>;
}

export interface MarketDataResponse {
  coins: Array<{
    symbol: string;
    name: string;
    icon: string;
    currentPrice: number;
    marketCap: number;
    volume24h: number;
    change24h: number;
    createdAt: string;
    creatorName: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PredictionMarket {
  id: number;
  question: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  resolutionDate: string;
  totalAmount: number;
  yesAmount: number;
  noAmount: number;
  yesPercentage: number;
  noPercentage: number;
  createdAt: string;
  resolvedAt: string | null;
  requiresWebSearch: boolean;
  aiResolution: string | null;
  creator: {
    id: number;
    name: string;
    username: string;
    image: string;
  };
  userBets: any;
}

export interface HopiumResponse {
  questions: Array<{
    id: number;
    question: string;
    yesPercentage: number;
    noPercentage: number;
    totalVotes: number;
    endTime: string;
  }>;
}

export type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type Recommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface TradingOpportunity {
    potential: number;
    reasoning: string[];
}

export interface TradingOpportunities {
    shortTerm: TradingOpportunity;
    midTerm: TradingOpportunity;
    longTerm: TradingOpportunity;
}

export interface RugPullIndicator {
    name: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    value?: number | string;
    timestamp?: number;
}

export interface RugPullAnalysis {
    overallRisk: number;  // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    shortDescription: string;
    indicators: RugPullIndicator[];
    timeToRugPull?: number;  // Estimated minutes until potential rug pull, if high risk
    suggestedAction: string;
}

export interface AnalysisResult {
    coin: CoinDetailsResponse['coin'];
    recommendation: Recommendation;
    riskLevel: RiskLevel;
    confidence: number;
    summary: string;
    rugPullAnalysis: RugPullAnalysis;  // Added rug pull analysis
    factors: {
        technical: {
            score: number;
            reasoning: string;
            indicators: string[];
        };
        fundamental: {
            score: number;
            reasoning: string;
            signals: string[];
        };
        sentiment: {
            score: number;
            reasoning: string;
            metrics: Record<string, number>;
        };
        liquidity: {
            score: number;
            reasoning: string;
            warnings: string[];
        };
        concentration: {
            score: number;
            reasoning: string;
            risks: string[];
        };
    };
    tradingOpportunities: {
        shortTerm: { potential: number; reasoning: string[] };
        midTerm: { potential: number; reasoning: string[] };
        longTerm: { potential: number; reasoning: string[] };
    };
    warnings: string[];
    opportunities: string[];
}

export interface ApiKeyStorage {
  key: string;
  lastUsed: number;
}

export interface RugplayApiClient {
  apiKey: string;
  get<T>(endpoint: string, params?: Record<string, any>, forceRefresh?: boolean): Promise<T>;
  getTopCoins(): Promise<TopCoinsResponse>;
  getMarketData(params: {
    search?: string;
    sortBy?: 'marketCap' | 'currentPrice' | 'change24h' | 'volume24h' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    priceFilter?: 'all' | 'under1' | '1to10' | '10to100' | 'over100';
    changeFilter?: 'all' | 'gainers' | 'losers' | 'hot' | 'wild';
    page?: number;
    limit?: number;
  }): Promise<MarketDataResponse>;
  getCoinDetails(symbol: string, timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'): Promise<CoinDetailsResponse>;
  getCoinHolders(symbol: string): Promise<HoldersResponse>;
}

// New interfaces for caching and monitoring
export interface CachedData<T> {
  data: T;
  timestamp: number;
  lastUpdated: string;
}

export interface UserData {
  apiKey: string;
  isAuthenticated: boolean;
  lastLogin: number;
  watchedCoins: string[];
}

export interface MonitoredCoin {
  symbol: string;
  name: string;
  icon: string;
  addedAt: number;
  lastChecked?: number;
  currentPrice?: number;
  change24h?: number;
  marketCap?: number;
  volume24h?: number;
  lastAnalysis?: AnalysisResult;
  priceAlert?: {
    enabled: boolean;
    targetPrice: number;
    direction: 'above' | 'below';
  };
}

export interface CacheManager {
  get<T>(key: string): CachedData<T> | null;
  set<T>(key: string, data: T): void;
  isStale(key: string, maxAge: number): boolean;
  clear(key?: string): void;
  getStats(): {
    totalEntries: number;
    totalSize: string;
    oldestEntry: string;
    newestEntry: string;
      };
  } 