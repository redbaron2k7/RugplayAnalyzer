import { writable } from 'svelte/store';
import type { UserData, MonitoredCoin } from './types';
import { createApiClient, cacheManager } from './utils';

function createUserStore() {
  const { subscribe, set, update } = writable<UserData>({
    apiKey: '',
    isAuthenticated: false,
    lastLogin: 0,
    watchedCoins: []
  });

  return {
    subscribe,

    login(apiKey: string) {
      update(userData => {
        const newData = {
          apiKey: apiKey.trim(),
          isAuthenticated: true,
          lastLogin: Date.now(),
          watchedCoins: userData.watchedCoins || []
        };
        this.saveToStorage(newData);
        return newData;
      });
    },

    logout() {
      const newData = {
        apiKey: '',
        isAuthenticated: false,
        lastLogin: 0,
        watchedCoins: []
      };
      set(newData);
      this.clearStorage();
    },

    addWatchedCoin(symbol: string) {
      update(userData => {
        if (!userData.watchedCoins.includes(symbol)) {
          const newData = {
            ...userData,
            watchedCoins: [...userData.watchedCoins, symbol]
          };
          this.saveToStorage(newData);
          return newData;
        }
        return userData;
      });
    },

    removeWatchedCoin(symbol: string) {
      update(userData => {
        const newData = {
          ...userData,
          watchedCoins: userData.watchedCoins.filter(s => s !== symbol)
        };
        this.saveToStorage(newData);
        return newData;
      });
    },

    saveToStorage(userData: UserData) {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem('rugplay_user_data', JSON.stringify(userData));
      } catch (error) {
        console.error('Failed to save user data:', error);
      }
    },

    loadFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const saved = localStorage.getItem('rugplay_user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          const userData = {
            ...parsed,
            isAuthenticated: !!parsed.apiKey
          };
          set(userData);
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    },

    clearStorage() {
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem('rugplay_user_data');
        localStorage.removeItem('rugplay-api-key');
      } catch (error) {
        console.error('Failed to clear user data:', error);
      }
    }
  };
}

function createMonitoringStore() {
  const monitoredCoins = writable<MonitoredCoin[]>([]);
  const isLoading = writable(false);
  const lastUpdate = writable<number>(0);

  return {
    monitoredCoins: { subscribe: monitoredCoins.subscribe },
    isLoading: { subscribe: isLoading.subscribe },
    lastUpdate: { subscribe: lastUpdate.subscribe },

    async addCoin(symbol: string, name: string, icon: string, apiKey: string) {
      monitoredCoins.update(coins => {
        const existing = coins.find(c => c.symbol === symbol);
        if (existing) return coins;

        const newCoin: MonitoredCoin = {
          symbol,
          name,
          icon,
          addedAt: Date.now()
        };

        const newCoins = [...coins, newCoin];
        this.saveToStorage(newCoins);

        // Fetch initial data
        this.updateCoin(symbol, apiKey);

        return newCoins;
      });
    },

    removeCoin(symbol: string) {
      monitoredCoins.update(coins => {
        const newCoins = coins.filter(c => c.symbol !== symbol);
        this.saveToStorage(newCoins);
        return newCoins;
      });
    },

    async updateCoin(symbol: string, apiKey: string, forceRefresh: boolean = false) {
      monitoredCoins.update(coins => {
        const coinIndex = coins.findIndex(c => c.symbol === symbol);
        if (coinIndex === -1) return coins;

        this.performCoinUpdate(symbol, apiKey, forceRefresh);

        return coins;
      });
    },

    async performCoinUpdate(symbol: string, apiKey: string, forceRefresh: boolean = false) {
      try {
        const client = createApiClient(apiKey);
        const coinData = await client.get<{ coin: any }>(`/coin/${symbol}`, undefined, forceRefresh);

        monitoredCoins.update(coins => {
          const coinIndex = coins.findIndex(c => c.symbol === symbol);
          if (coinIndex === -1) return coins;

          const updatedCoins = [...coins];
          updatedCoins[coinIndex] = {
            ...updatedCoins[coinIndex],
            lastChecked: Date.now(),
            currentPrice: coinData.coin.currentPrice,
            change24h: coinData.coin.change24h,
            marketCap: coinData.coin.marketCap,
            volume24h: coinData.coin.volume24h
          };

          this.saveToStorage(updatedCoins);
          return updatedCoins;
        });
      } catch (error) {
        console.error(`Failed to update coin ${symbol}:`, error);
      }
    },

    async updateAllCoins(apiKey: string, forceRefresh: boolean = false) {
      if (!apiKey) return;

      monitoredCoins.subscribe(coins => {
        if (coins.length === 0) return;

        isLoading.set(true);

        this.performBatchUpdate(coins, apiKey, forceRefresh);
      })();
    },

    async performBatchUpdate(coins: MonitoredCoin[], apiKey: string, forceRefresh: boolean = false) {
      try {
        const batchSize = 3;
        for (let i = 0; i < coins.length; i += batchSize) {
          const batch = coins.slice(i, i + batchSize);

          await Promise.all(
            batch.map(coin => this.performCoinUpdate(coin.symbol, apiKey, forceRefresh))
          );

          if (i + batchSize < coins.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        lastUpdate.set(Date.now());
      } finally {
        isLoading.set(false);
      }
    },

    setPriceAlert(symbol: string, targetPrice: number, direction: 'above' | 'below') {
      monitoredCoins.update(coins => {
        const coinIndex = coins.findIndex(c => c.symbol === symbol);
        if (coinIndex === -1) return coins;

        const updatedCoins = [...coins];
        updatedCoins[coinIndex] = {
          ...updatedCoins[coinIndex],
          priceAlert: {
            enabled: true,
            targetPrice,
            direction
          }
        };

        this.saveToStorage(updatedCoins);
        return updatedCoins;
      });
    },

    clearPriceAlert(symbol: string) {
      monitoredCoins.update(coins => {
        const coinIndex = coins.findIndex(c => c.symbol === symbol);
        if (coinIndex === -1) return coins;

        const updatedCoins = [...coins];
        updatedCoins[coinIndex] = {
          ...updatedCoins[coinIndex],
          priceAlert: undefined
        };

        this.saveToStorage(updatedCoins);
        return updatedCoins;
      });
    },

    saveToStorage(coins: MonitoredCoin[]) {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem('rugplay_monitored_coins', JSON.stringify(coins));
      } catch (error) {
        console.error('Failed to save monitored coins:', error);
      }
    },

    loadFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const saved = localStorage.getItem('rugplay_monitored_coins');
        if (saved) {
          monitoredCoins.set(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load monitored coins:', error);
      }
    },

    clearStorage() {
      monitoredCoins.set([]);
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem('rugplay_monitored_coins');
      } catch (error) {
        console.error('Failed to clear monitored coins:', error);
      }
    }
  };
}

function createCacheStore() {
  const defaultStats = {
    totalEntries: 0,
    totalSize: '0 KB',
    oldestEntry: 'None',
    newestEntry: 'None'
  };

  const stats = writable(defaultStats);

  if (typeof window !== 'undefined') {
    stats.set(cacheManager.getStats());
  }

  return {
    stats: { subscribe: stats.subscribe },

    refreshStats() {
      stats.set(cacheManager.getStats());
    },

    clearCache(key?: string) {
      cacheManager.clear(key);
      this.refreshStats();
    },

    isCacheStale(key: string, maxAge: number = 5 * 60 * 1000): boolean {
      return cacheManager.isStale(key, maxAge);
    }
  };
}

export const userStore = createUserStore();
export const monitoringStore = createMonitoringStore();
export const cacheStore = createCacheStore();