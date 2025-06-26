<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    Monitor, RefreshCw, Trash2, AlertTriangle, 
    TrendingUp, TrendingDown, Minus, Loader2, Search,
    BarChart3, PieChart, Activity, DollarSign, Users, Clock,
    Zap, Shield, AlertCircle, CheckCircle, Target,
    ChevronRight, ChevronLeft, Filter,
    Database, X
  } from 'lucide-svelte';
  import { userStore, monitoringStore, cacheStore } from '$lib/stores';
  import { createApiClient, formatCurrency, formatPercentage, getChangeColor, getCoinImageUrl } from '$lib/utils';
  import { CryptoAnalyzer } from '$lib/analyzer';
  import LoginModal from '$lib/components/LoginModal.svelte';
  import type { MonitoredCoin, UserData, AnalysisResult } from '$lib/types';

  let newCoinSymbol = $state('');
  let searchSuggestions = $state<Array<{symbol: string, name: string, icon: string}>>([]);
  let showSuggestions = $state(false);
  let isSearching = $state(false);
  let showCacheSettings = $state(false);
  let showLoginModal = $state(false);
  let selectedCoin = $state<string | null>(null);
  let coinAnalysis = $state<AnalysisResult | null>(null);
  let isAnalyzing = $state(false);
  let sidebarCollapsed = $state(false);
  let viewMode = $state<'overview' | 'analysis'>('overview');
  let filterRisk = $state<string>('all');
  let sortBy = $state<'performance' | 'marketCap' | 'volume' | 'name'>('performance');

  let userData = $state<UserData>({ isAuthenticated: false, apiKey: '', lastLogin: 0, watchedCoins: [] });
  let monitoredCoins = $state<MonitoredCoin[]>([]);
  let lastUpdate = $state(0);
  let cacheStats = $state({ totalEntries: 0, totalSize: '0 KB', newestEntry: 'None', oldestEntry: 'None' });

  $effect(() => {
    const unsubscribeUser = userStore.subscribe(value => userData = value);
    const unsubscribeMonitoring = monitoringStore.monitoredCoins.subscribe(value => monitoredCoins = value);
    const unsubscribeLastUpdate = monitoringStore.lastUpdate.subscribe(value => lastUpdate = value);
    const unsubscribeCache = cacheStore.stats.subscribe(value => cacheStats = value);
    
    return () => {
      unsubscribeUser();
      unsubscribeMonitoring();
      unsubscribeLastUpdate();
      unsubscribeCache();
    };
  });

  $effect(() => {
    if (!userData.isAuthenticated) {
      showLoginModal = true;
    } else {
      showLoginModal = false;
    }
  });

  onMount(() => {
    let interval: number | undefined;
    
    if (userData.isAuthenticated) {
      interval = setInterval(() => {
        monitoringStore.updateAllCoins(userData.apiKey);
      }, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  });

  async function analyzeSelectedCoin(coinSymbol: string, forceRefresh = false) {
    if (!userData.apiKey) return;
    
    isAnalyzing = true;
    selectedCoin = coinSymbol;
    viewMode = 'analysis';
    coinAnalysis = null;
    
    try {
      const apiClient = createApiClient(userData.apiKey);
      const analyzer = new CryptoAnalyzer(apiClient);
      const result = await analyzer.analyzeCoin(coinSymbol, forceRefresh);
      coinAnalysis = result;
    } catch (error) {
      console.error('Analysis failed:', error);
      coinAnalysis = null;
    } finally {
      isAnalyzing = false;
    }
  }

  async function handleCoinInput() {
    const symbol = newCoinSymbol.trim().toUpperCase();
    if (symbol.length < 2) {
      showSuggestions = false;
      return;
    }

    isSearching = true;
    try {
      const apiClient = createApiClient(userData.apiKey);
      const response = await apiClient.get<{coins: Array<{symbol: string, name: string, icon: string}>}>('/market', { 
        limit: 10, 
        search: symbol,
        sortBy: 'marketCap' 
      });
       
      searchSuggestions = response.coins.map((coin) => ({
        symbol: coin.symbol,
        name: coin.name,
        icon: coin.icon
      }));
      
      showSuggestions = searchSuggestions.length > 0;
    } catch (error) {
      console.error('Search failed:', error);
      showSuggestions = false;
    } finally {
      isSearching = false;
    }
  }

  async function addCoin(suggestion: {symbol: string, name: string, icon: string}) {
    userStore.addWatchedCoin(suggestion.symbol);
    await monitoringStore.addCoin(suggestion.symbol, suggestion.name, suggestion.icon, userData.apiKey);
    await monitoringStore.updateCoin(suggestion.symbol, userData.apiKey, true);
    newCoinSymbol = '';
    showSuggestions = false;
  }

  function removeCoin(symbol: string) {
    userStore.removeWatchedCoin(symbol);
    monitoringStore.removeCoin(symbol);
    if (selectedCoin === symbol) {
      selectedCoin = null;
      viewMode = 'overview';
      coinAnalysis = null;
    }
  }

  function getPriceChangeIcon(change: number) {
    if (change > 0) return TrendingUp;
    if (change < 0) return TrendingDown;
    return Minus;
  }

  function getTimeSinceUpdate(timestamp: number): string {
    if (timestamp === 0) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'VERY_LOW': return 'text-green-500';
      case 'LOW': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-500';
      case 'HIGH': return 'text-orange-500';
      case 'VERY_HIGH': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  }

  function getRecommendationColor(recommendation: string): string {
    switch (recommendation) {
      case 'STRONG_BUY': return 'text-green-600 bg-green-50 border-green-200';
      case 'BUY': return 'text-green-500 bg-green-50 border-green-200';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'SELL': return 'text-red-500 bg-red-50 border-red-200';
      case 'STRONG_SELL': return 'text-red-600 bg-red-100 border-red-300';
      default: return 'text-muted-foreground bg-background border-border';
    }
  }

  function getRecommendationText(recommendation: string): string {
    switch (recommendation) {
      case 'STRONG_BUY': return 'Strong Buy';
      case 'BUY': return 'Buy';
      case 'HOLD': return 'Hold';
      case 'SELL': return 'Sell';
      case 'STRONG_SELL': return 'Strong Sell';
      default: return 'Unknown';
    }
  }

  function getRiskText(riskLevel: string): string {
    switch (riskLevel) {
      case 'VERY_LOW': return 'Very Low Risk';
      case 'LOW': return 'Low Risk';
      case 'MEDIUM': return 'Medium Risk';
      case 'HIGH': return 'High Risk';
      case 'VERY_HIGH': return 'Very High Risk';
      default: return 'Unknown Risk';
    }
  }

  function getFilteredCoins() {
    let filtered = [...monitoredCoins];
    
    if (filterRisk !== 'all') {
      filtered = filtered;
    }
    
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return (b.change24h || 0) - (a.change24h || 0);
        case 'marketCap':
          return (b.marketCap || 0) - (a.marketCap || 0);
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    return filtered;
  }

  let filteredCoins = $derived(getFilteredCoins());
</script>

<svelte:head>
  <title>Dashboard - Rugplay Analyzer</title>
  <meta name="description" content="Advanced cryptocurrency analysis dashboard with real-time monitoring and comprehensive market insights." />
</svelte:head>

{#if userData.isAuthenticated}
<div class="flex h-[calc(100vh-3.5rem)] bg-background">
  <div class="flex flex-col {sidebarCollapsed ? 'w-16' : 'w-80'} border-r border-border bg-card/80 backdrop-blur-sm transition-all duration-300">
    <div class="flex items-center justify-between p-4 border-b border-border">
      {#if !sidebarCollapsed}
        <h2 class="font-semibold text-lg">Monitored Coins</h2>
      {/if}
      <button
        onclick={() => sidebarCollapsed = !sidebarCollapsed}
        class="p-2 hover:bg-accent rounded-md transition-colors"
      >
        {#if sidebarCollapsed}
          <ChevronRight class="h-4 w-4" />
        {:else}
          <ChevronLeft class="h-4 w-4" />
        {/if}
      </button>
    </div>

    {#if !sidebarCollapsed}
      <div class="p-4 border-b border-border">
        <div class="relative">
          <input
            type="text"
            bind:value={newCoinSymbol}
            oninput={handleCoinInput}
            onblur={() => setTimeout(() => showSuggestions = false, 200)}
            onfocus={handleCoinInput}
            placeholder="Add coin to monitor..."
            class="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {#if isSearching}
            <Loader2 class="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          {/if}
        </div>
        
        {#if showSuggestions && searchSuggestions.length > 0}
          <div class="absolute z-10 w-72 mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {#each searchSuggestions as suggestion}
              <button
                type="button"
                onclick={() => addCoin(suggestion)}
                class="w-full px-3 py-3 text-left hover:bg-accent border-b border-border last:border-b-0 flex items-center space-x-3"
              >
                <img src={getCoinImageUrl(suggestion.icon)} alt={suggestion.name} class="w-6 h-6 rounded-full" />
                <div>
                  <div class="font-medium">{suggestion.symbol}</div>
                  <div class="text-sm text-muted-foreground">{suggestion.name}</div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="p-4 border-b border-border space-y-3">
        <div class="flex items-center space-x-2">
          <Filter class="h-4 w-4 text-muted-foreground" />
          <select bind:value={sortBy} class="flex-1 text-sm border border-input rounded px-2 py-1 bg-background">
            <option value="performance">Performance</option>
            <option value="marketCap">Market Cap</option>
            <option value="volume">Volume</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto">
      {#if filteredCoins.length === 0}
        <div class="p-4 text-center text-muted-foreground">
          {#if sidebarCollapsed}
            <Monitor class="h-8 w-8 mx-auto mb-2" />
          {:else}
            <Monitor class="h-12 w-12 mx-auto mb-3" />
            <p class="text-sm">No coins monitored</p>
            <p class="text-xs">Add some coins to start</p>
          {/if}
        </div>
      {:else}
        {#each filteredCoins as coin}
          {@const ChangeIcon = getPriceChangeIcon(coin.change24h || 0)}
          <button
            onclick={() => analyzeSelectedCoin(coin.symbol)}
            class="w-full p-3 text-left hover:bg-accent transition-colors border-b border-border {selectedCoin === coin.symbol ? 'bg-accent' : ''}"
          >
            {#if sidebarCollapsed}
              <div class="flex flex-col items-center space-y-1">
                <img src={getCoinImageUrl(coin.icon)} alt={coin.name} class="w-8 h-8 rounded-full" />
                <span class="text-xs font-medium">{coin.symbol}</span>
                {#if coin.change24h !== undefined}
                  {#if coin.change24h >= 0}
                    <TrendingUp class="h-3 w-3 {getChangeColor(coin.change24h)}" />
                  {:else}
                    <TrendingDown class="h-3 w-3 {getChangeColor(coin.change24h)}" />
                  {/if}
                {/if}
              </div>
            {:else}
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <img src={getCoinImageUrl(coin.icon)} alt={coin.name} class="w-8 h-8 rounded-full" />
                  <div>
                    <div class="font-medium">{coin.symbol}</div>
                    <div class="text-sm text-muted-foreground truncate">{coin.name}</div>
                  </div>
                </div>
                <div class="text-right">
                  {#if coin.currentPrice !== undefined}
                    <div class="text-sm font-medium">{formatCurrency(coin.currentPrice)}</div>
                    {#if coin.change24h !== undefined}
                      <div class="flex items-center {getChangeColor(coin.change24h)} text-sm">
                        <ChangeIcon class="h-3 w-3 mr-1" />
                        <span>{formatPercentage(coin.change24h)}</span>
                      </div>
                    {/if}
                  {:else}
                    <div class="text-sm text-muted-foreground">Loading...</div>
                  {/if}
                </div>
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    {#if !sidebarCollapsed}
      <div class="p-4 border-t border-border">
        <div class="text-xs text-muted-foreground space-y-1">
          <div>Monitoring: {filteredCoins.length} coins</div>
          <div>Last update: {getTimeSinceUpdate(lastUpdate)}</div>
          <div class="flex items-center space-x-2">
            <button
              onclick={() => showCacheSettings = true}
              class="text-primary hover:underline text-xs"
            >
              Cache: {cacheStats.totalEntries} items
            </button>
            <button
              onclick={() => monitoringStore.updateAllCoins(userData.apiKey)}
              class="text-muted-foreground hover:text-primary text-xs"
              title="Refresh all coins"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex items-center justify-between p-4 lg:p-6 border-b border-border bg-card/50 backdrop-blur-sm">
      <div>
        <h1 class="text-xl lg:text-2xl font-bold">
          {#if viewMode === 'analysis' && selectedCoin}
            <span class="text-muted-foreground">Analysis:</span> {selectedCoin}
          {:else}
            Portfolio Dashboard
          {/if}
        </h1>
        <p class="text-sm text-muted-foreground">
          {#if viewMode === 'analysis'}
            Comprehensive analysis and insights
          {:else}
            Real-time monitoring and analysis of your cryptocurrency portfolio
          {/if}
        </p>
      </div>
      
      <div class="flex items-center space-x-3">
        {#if viewMode === 'analysis' && selectedCoin}
          <button
            onclick={() => selectedCoin && analyzeSelectedCoin(selectedCoin, true)}
            disabled={isAnalyzing}
            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            <RefreshCw class="h-4 w-4 mr-2 {isAnalyzing ? 'animate-spin' : ''}" />
            Force Refresh
          </button>
          <button
            onclick={() => { viewMode = 'overview'; selectedCoin = null; coinAnalysis = null; }}
            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
          >
            Back to Overview
          </button>
        {:else}
          <button
            onclick={() => monitoringStore.updateAllCoins(userData.apiKey)}
            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            <RefreshCw class="h-4 w-4 mr-2" />
            Refresh All
          </button>
        {/if}
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4 lg:p-6 bg-gradient-to-br from-background to-muted/20">
      {#if viewMode === 'overview'}
        {#if filteredCoins.length === 0}
          <div class="text-center py-16">
            <div class="relative">
              <div class="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl"></div>
              <Monitor class="relative h-20 w-20 mx-auto text-primary mb-6" />
            </div>
            <h3 class="text-2xl font-bold mb-3">Start Monitoring Coins</h3>
            <p class="text-muted-foreground mb-6 max-w-md mx-auto">Add some cryptocurrencies to your watchlist to get started with comprehensive analysis and monitoring.</p>
            <div class="inline-flex items-center space-x-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <Search class="h-4 w-4" />
              <span>Use the search box in the sidebar to add coins</span>
            </div>
          </div>
        {:else}
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div class="bg-card rounded-xl border p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-2 mb-2">
                <div class="p-2 bg-primary/10 rounded-lg">
                  <Monitor class="h-4 w-4 text-primary" />
                </div>
                <span class="text-xs lg:text-sm font-medium text-muted-foreground">Total Coins</span>
              </div>
              <div class="text-xl lg:text-2xl font-bold">{filteredCoins.length}</div>
            </div>
            
            <div class="bg-card rounded-xl border p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-2 mb-2">
                <div class="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <TrendingUp class="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span class="text-xs lg:text-sm font-medium text-muted-foreground">Gainers</span>
              </div>
              <div class="text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">
                {filteredCoins.filter(coin => (coin.change24h || 0) > 0).length}
              </div>
            </div>
            
            <div class="bg-card rounded-xl border p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-2 mb-2">
                <div class="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <TrendingDown class="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <span class="text-xs lg:text-sm font-medium text-muted-foreground">Losers</span>
              </div>
              <div class="text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400">
                {filteredCoins.filter(coin => (coin.change24h || 0) < 0).length}
              </div>
            </div>
            
            <div class="bg-card rounded-xl border p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-2 mb-2">
                <div class="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Clock class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span class="text-xs lg:text-sm font-medium text-muted-foreground">Last Update</span>
              </div>
              <div class="text-sm lg:text-base font-medium text-blue-600 dark:text-blue-400">{getTimeSinceUpdate(lastUpdate)}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {#each filteredCoins as coin}
              {@const ChangeIcon = getPriceChangeIcon(coin.change24h || 0)}
              <div class="bg-card rounded-xl border hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:border-primary/20">
                <div class="p-4 lg:p-6">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <div class="relative">
                        <img src={getCoinImageUrl(coin.icon)} alt={coin.name} class="w-10 h-10 lg:w-12 lg:h-12 rounded-full ring-2 ring-primary/10" />
                        {#if coin.change24h !== undefined}
                          <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center {coin.change24h >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}">
                            {#if coin.change24h >= 0}
                              <TrendingUp class="h-2 w-2 text-green-600 dark:text-green-400" />
                            {:else}
                              <TrendingDown class="h-2 w-2 text-red-600 dark:text-red-400" />
                            {/if}
                          </div>
                        {/if}
                      </div>
                      <div>
                        <h3 class="font-semibold text-base lg:text-lg">{coin.symbol}</h3>
                        <p class="text-xs lg:text-sm text-muted-foreground truncate max-w-32">{coin.name}</p>
                      </div>
                    </div>
                    <button
                      onclick={() => removeCoin(coin.symbol)}
                      class="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                      title="Remove coin"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>

                  {#if coin.currentPrice !== undefined}
                    <div class="space-y-4">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-2xl font-bold">{formatCurrency(coin.currentPrice)}</div>
                          {#if coin.change24h !== undefined}
                            <div class="flex items-center {getChangeColor(coin.change24h)} mt-1">
                              <ChangeIcon class="h-4 w-4 mr-1" />
                              <span class="font-medium">{formatPercentage(coin.change24h)}</span>
                              <span class="text-sm ml-1">24h</span>
                            </div>
                          {/if}
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4 text-sm">
                        {#if coin.marketCap !== undefined}
                          <div>
                            <div class="text-muted-foreground">Market Cap</div>
                            <div class="font-medium">{formatCurrency(coin.marketCap)}</div>
                          </div>
                        {/if}
                        {#if coin.volume24h !== undefined}
                          <div>
                            <div class="text-muted-foreground">Volume 24h</div>
                            <div class="font-medium">{formatCurrency(coin.volume24h)}</div>
                          </div>
                        {/if}
                      </div>

                      <div class="pt-3 border-t border-border">
                        <div class="text-xs text-muted-foreground mb-2">
                          Last checked: {getTimeSinceUpdate(coin.lastChecked || 0)}
                        </div>
                        
                        <div class="flex items-center space-x-2">
                          <button
                            onclick={() => analyzeSelectedCoin(coin.symbol)}
                            class="flex-1 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 h-9 px-3 shadow-sm hover:shadow-md"
                          >
                            <BarChart3 class="h-4 w-4 mr-2" />
                            Analyze
                          </button>
                          <button
                            onclick={() => monitoringStore.updateCoin(coin.symbol, userData.apiKey, true)}
                            class="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9 hover:scale-105"
                            title="Refresh data"
                          >
                            <RefreshCw class="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 class="h-6 w-6 mr-2 animate-spin" />
                      <span>Loading market data...</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else if viewMode === 'analysis' && selectedCoin}
        {#if isAnalyzing}
          <div class="flex items-center justify-center py-12">
            <div class="text-center">
              <Loader2 class="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <h3 class="text-lg font-semibold mb-2">Analyzing {selectedCoin}</h3>
              <p class="text-muted-foreground">Running comprehensive analysis across multiple factors...</p>
            </div>
          </div>
        {:else if !coinAnalysis}
          <div class="text-center py-12">
            <AlertCircle class="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 class="text-xl font-semibold mb-2">Analysis Failed</h3>
            <p class="text-muted-foreground mb-4">Unable to load analysis data for {selectedCoin}. Please try again.</p>
            <button
              onclick={() => selectedCoin && analyzeSelectedCoin(selectedCoin, true)}
              class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
            >
              <RefreshCw class="h-4 w-4 mr-2" />
              Retry Analysis
            </button>
          </div>
        {:else}
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <img 
                  src={getCoinImageUrl(coinAnalysis.coin.icon)} 
                  alt={coinAnalysis.coin.name} 
                  class="w-12 h-12 rounded-full"
                />
                <div>
                  <h1 class="text-2xl font-bold">{coinAnalysis.coin.name}</h1>
                  <p class="text-muted-foreground">{coinAnalysis.coin.symbol}</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="text-2xl font-bold">{formatCurrency(coinAnalysis.coin.currentPrice)}</p>
                  <p class="flex items-center gap-1 {getChangeColor(coinAnalysis.coin.change24h)}">
                    <svelte:component this={getPriceChangeIcon(coinAnalysis.coin.change24h)} class="w-4 h-4" />
                    {formatPercentage(coinAnalysis.coin.change24h)}
                  </p>
                </div>
                <button 
                  onclick={() => selectedCoin && analyzeSelectedCoin(selectedCoin, true)}
                  class="p-2 hover:bg-accent rounded-md transition-colors"
                  disabled={isAnalyzing}
                >
                  <RefreshCw class="w-5 h-5 {isAnalyzing ? 'animate-spin' : ''}" />
                </button>
              </div>
            </div>

            <div class="bg-card rounded-lg border border-border p-4 mb-6 {coinAnalysis.rugPullAnalysis.riskLevel === 'critical' ? 'border-red-500' : coinAnalysis.rugPullAnalysis.riskLevel === 'high' ? 'border-orange-500' : 'border-border'}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Shield class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Rug Pull Risk</h3>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">Risk Level:</span>
                  <span class="px-2 py-1 rounded text-sm font-medium {
                    coinAnalysis.rugPullAnalysis.riskLevel === 'critical' ? 'bg-red-100 text-red-700' :
                    coinAnalysis.rugPullAnalysis.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                    coinAnalysis.rugPullAnalysis.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }">
                    {coinAnalysis.rugPullAnalysis.overallRisk}% - {coinAnalysis.rugPullAnalysis.riskLevel.toUpperCase()}
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                {#if coinAnalysis.rugPullAnalysis.timeToRugPull}
                  <div class="text-red-600 text-sm font-medium">
                    ⚠️ Estimated {coinAnalysis.rugPullAnalysis.timeToRugPull}min until potential rug pull
                  </div>
                {/if}
                <p class="text-sm text-muted-foreground">{coinAnalysis.rugPullAnalysis.shortDescription}</p>
                <p class="text-sm font-medium">{coinAnalysis.rugPullAnalysis.suggestedAction}</p>
              </div>

              {#if coinAnalysis.rugPullAnalysis.indicators.length > 0}
                <div class="mt-3 space-y-2">
                  {#each coinAnalysis.rugPullAnalysis.indicators as indicator}
                    <div class="text-sm flex items-start gap-2 {
                      indicator.severity === 'critical' ? 'text-red-600' :
                      indicator.severity === 'high' ? 'text-orange-600' :
                      'text-muted-foreground'
                    }">
                      <span class="mt-1">•</span>
                      <span>{indicator.description}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-2">
                  <Target class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Recommendation</h3>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-lg font-bold px-3 py-1 rounded-full {getRecommendationColor(coinAnalysis.recommendation)}">
                    {getRecommendationText(coinAnalysis.recommendation)}
                  </span>
                  <span class="text-sm text-muted-foreground">
                    {coinAnalysis.confidence}% confidence
                  </span>
                </div>
              </div>
              
              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-2">
                  <AlertCircle class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Risk Level</h3>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-lg font-bold {getRiskColor(coinAnalysis.riskLevel)}">
                    {getRiskText(coinAnalysis.riskLevel)}
                  </span>
                  <span class="text-sm text-muted-foreground">
                    Confidence: {coinAnalysis.confidence.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-2">
                  <DollarSign class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Market Cap</h3>
                </div>
                <p class="text-lg font-bold">{formatCurrency(coinAnalysis.coin.marketCap)}</p>
                <p class="text-sm text-muted-foreground">24h Volume: {formatCurrency(coinAnalysis.coin.volume24h)}</p>
              </div>
              
              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-2">
                  <Users class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Concentration</h3>
                </div>
                <p class="text-lg font-bold">{coinAnalysis.factors.concentration.score.toFixed(1)}%</p>
                <p class="text-sm text-muted-foreground">Distribution Score</p>
              </div>
            </div>

            <div class="p-6 rounded-lg border border-border bg-card">
              <h2 class="text-xl font-semibold mb-4">Analysis Summary</h2>
              <p class="text-muted-foreground whitespace-pre-line">{coinAnalysis.summary}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <Clock class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Short Term</h3>
                </div>
                <div class="mb-2">
                  <div class="flex justify-between mb-1">
                    <span>Potential</span>
                    <span class="font-bold">{coinAnalysis.tradingOpportunities.shortTerm.potential}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.tradingOpportunities.shortTerm.potential}%"
                    />
                  </div>
                </div>
                <ul class="text-sm space-y-1">
                  {#each coinAnalysis.tradingOpportunities.shortTerm.reasoning as reason}
                    <li class="text-muted-foreground">• {reason}</li>
                  {/each}
                </ul>
              </div>

              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <BarChart3 class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Mid Term</h3>
                </div>
                <div class="mb-2">
                  <div class="flex justify-between mb-1">
                    <span>Potential</span>
                    <span class="font-bold">{coinAnalysis.tradingOpportunities.midTerm.potential}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.tradingOpportunities.midTerm.potential}%"
                    />
                  </div>
                </div>
                <ul class="text-sm space-y-1">
                  {#each coinAnalysis.tradingOpportunities.midTerm.reasoning as reason}
                    <li class="text-muted-foreground">• {reason}</li>
                  {/each}
                </ul>
              </div>

              <div class="p-4 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <PieChart class="w-5 h-5 text-primary" />
                  <h3 class="font-semibold">Long Term</h3>
                </div>
                <div class="mb-2">
                  <div class="flex justify-between mb-1">
                    <span>Potential</span>
                    <span class="font-bold">{coinAnalysis.tradingOpportunities.longTerm.potential}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.tradingOpportunities.longTerm.potential}%"
                    />
                  </div>
                </div>
                <ul class="text-sm space-y-1">
                  {#each coinAnalysis.tradingOpportunities.longTerm.reasoning as reason}
                    <li class="text-muted-foreground">• {reason}</li>
                  {/each}
                </ul>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="p-6 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <Activity class="w-5 h-5 text-primary" />
                  <h3 class="text-lg font-semibold">Technical Analysis</h3>
                </div>
                <div class="mb-4">
                  <div class="flex justify-between mb-1">
                    <span>Overall Score</span>
                    <span class="font-bold">{Math.round(coinAnalysis.factors.technical.score)}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.factors.technical.score}%"
                    />
                  </div>
                </div>
                <div class="space-y-4">
                  <div>
                    <h4 class="font-medium mb-2">Key Indicators</h4>
                    <ul class="text-sm space-y-1">
                      {#each coinAnalysis.factors.technical.indicators as indicator}
                        <li class="text-muted-foreground">• {indicator}</li>
                      {/each}
                    </ul>
                  </div>
                  <div>
                    <h4 class="font-medium mb-2">Analysis</h4>
                    <p class="text-sm text-muted-foreground">{coinAnalysis.factors.technical.reasoning}</p>
                  </div>
                </div>
              </div>

              <div class="p-6 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <Database class="w-5 h-5 text-primary" />
                  <h3 class="text-lg font-semibold">Fundamental Analysis</h3>
                </div>
                <div class="mb-4">
                  <div class="flex justify-between mb-1">
                    <span>Overall Score</span>
                    <span class="font-bold">{Math.round(coinAnalysis.factors.fundamental.score)}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.factors.fundamental.score}%"
                    />
                  </div>
                </div>
                <div class="space-y-4">
                  <div>
                    <h4 class="font-medium mb-2">Key Metrics</h4>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <p class="text-sm text-muted-foreground">Market Cap</p>
                        <p class="font-medium">{formatCurrency(coinAnalysis.coin.marketCap)}</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Volume/MC Ratio</p>
                        <p class="font-medium">{((coinAnalysis.coin?.volume24h ?? 0) / (coinAnalysis.coin?.marketCap ?? 1) * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Supply Ratio</p>
                        <p class="font-medium">{formatPercentage((coinAnalysis.coin?.circulatingSupply ?? 0) / (coinAnalysis.coin?.initialSupply ?? 1) * 100)}</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Age</p>
                        <p class="font-medium">{Math.floor((Date.now() - new Date(coinAnalysis.coin.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 class="font-medium mb-2">Analysis</h4>
                    <p class="text-sm text-muted-foreground">{coinAnalysis.factors.fundamental.reasoning}</p>
                    {#if coinAnalysis.factors.fundamental.signals?.length > 0}
                      <div class="mt-2">
                        <h4 class="font-medium mb-2">Key Findings</h4>
                        <ul class="text-sm space-y-1">
                          {#each coinAnalysis.factors.fundamental.signals as signal}
                            <li class="text-muted-foreground">• {signal}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="p-6 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <Zap class="w-5 h-5 text-primary" />
                  <h3 class="text-lg font-semibold">Liquidity Analysis</h3>
                </div>
                <div class="mb-4">
                  <div class="flex justify-between mb-1">
                    <span>Overall Score</span>
                    <span class="font-bold">{Math.round(coinAnalysis.factors.liquidity.score)}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.factors.liquidity.score}%"
                    />
                  </div>
                </div>
                <div class="space-y-4">
                  <div>
                    <h4 class="font-medium mb-2">Key Metrics</h4>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <p class="text-sm text-muted-foreground">Pool Value</p>
                        <p class="font-medium">{formatCurrency(coinAnalysis.coin.poolBaseCurrencyAmount)}</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Pool Ratio</p>
                        <p class="font-medium">{formatPercentage((coinAnalysis.coin?.poolCoinAmount ?? 0) / (coinAnalysis.coin?.circulatingSupply ?? 1) * 100)}</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Volume/Liquidity</p>
                        <p class="font-medium">{((coinAnalysis.coin?.volume24h ?? 0) / (coinAnalysis.coin?.poolBaseCurrencyAmount ?? 1)).toFixed(2)}x</p>
                      </div>
                      <div>
                        <p class="text-sm text-muted-foreground">Pool Tokens</p>
                        <p class="font-medium">{coinAnalysis.coin.poolCoinAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 class="font-medium mb-2">Analysis</h4>
                    <p class="text-sm text-muted-foreground">{coinAnalysis.factors.liquidity.reasoning}</p>
                    {#if coinAnalysis.factors.liquidity.warnings?.length > 0}
                      <div class="mt-2">
                        <h4 class="font-medium mb-2">Warnings</h4>
                        <ul class="text-sm space-y-1">
                          {#each coinAnalysis.factors.liquidity.warnings as warning}
                            <li class="text-red-600">• {warning}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="p-6 rounded-lg border border-border bg-card">
                <div class="flex items-center gap-2 mb-4">
                  <Shield class="w-5 h-5 text-primary" />
                  <h3 class="text-lg font-semibold">Holder Concentration</h3>
                </div>
                <div class="mb-4">
                  <div class="flex justify-between mb-1">
                    <span>Overall Score</span>
                    <span class="font-bold">{Math.round(coinAnalysis.factors.concentration.score)}%</span>
                  </div>
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary rounded-full h-2" 
                      style="width: {coinAnalysis.factors.concentration.score}%"
                    />
                  </div>
                </div>
                <div class="space-y-4">
                  <div>
                    <h4 class="font-medium mb-2">Risks</h4>
                    <ul class="text-sm space-y-1">
                      {#each coinAnalysis.factors.concentration.risks as risk}
                        <li class="text-red-600">• {risk}</li>
                      {/each}
                    </ul>
                  </div>
                  <div>
                    <h4 class="font-medium mb-2">Analysis</h4>
                    <p class="text-sm text-muted-foreground">{coinAnalysis.factors.concentration.reasoning}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {#if coinAnalysis.warnings.length > 0}
                <div class="p-6 rounded-lg border border-red-200 bg-red-50">
                  <div class="flex items-center gap-2 mb-4">
                    <AlertTriangle class="w-5 h-5 text-red-600" />
                    <h3 class="text-lg font-semibold text-red-900">Risk Warnings</h3>
                  </div>
                  <ul class="space-y-2">
                    {#each coinAnalysis.warnings as warning}
                      <li class="flex items-start gap-2 text-red-700">
                        <span class="mt-1">•</span>
                        <span>{warning}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              {#if coinAnalysis.opportunities.length > 0}
                <div class="p-6 rounded-lg border border-green-200 bg-green-50">
                  <div class="flex items-center gap-2 mb-4">
                    <CheckCircle class="w-5 h-5 text-green-600" />
                    <h3 class="text-lg font-semibold text-green-900">Opportunities</h3>
                  </div>
                  <ul class="space-y-2">
                    {#each coinAnalysis.opportunities as opportunity}
                      <li class="flex items-start gap-2 text-green-700">
                        <span class="mt-1">•</span>
                        <span>{opportunity}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if showCacheSettings}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-card border rounded-xl shadow-2xl w-full max-w-md">
      <div class="flex items-center justify-between p-6 border-b">
        <div class="flex items-center space-x-2">
          <div class="p-2 bg-primary/10 rounded-lg">
            <Database class="h-5 w-5 text-primary" />
          </div>
          <h3 class="text-lg font-semibold">Cache Statistics</h3>
        </div>
        <button
          onclick={() => showCacheSettings = false}
          class="text-muted-foreground hover:text-primary hover:bg-muted/50 p-2 rounded-lg transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
      
      <div class="p-6 space-y-6">
        <div class="grid grid-cols-2 gap-6">
          <div class="text-center p-4 bg-primary/5 rounded-lg">
            <div class="text-3xl font-bold text-primary mb-1">{cacheStats.totalEntries}</div>
            <div class="text-sm text-muted-foreground">Cached Items</div>
          </div>
          <div class="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{cacheStats.totalSize}</div>
            <div class="text-sm text-muted-foreground">Storage Used</div>
          </div>
        </div>
        
        <div class="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-muted-foreground">Latest Entry:</span>
            <span class="text-sm">{cacheStats.newestEntry}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-muted-foreground">Oldest Entry:</span>
            <span class="text-sm">{cacheStats.oldestEntry}</span>
          </div>
        </div>
        
        <button
          onclick={() => { cacheStore.clearCache(); showCacheSettings = false; }}
          class="w-full inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-10 px-4 hover:scale-[1.02]"
        >
          <Trash2 class="h-4 w-4 mr-2" />
          Clear All Cache
        </button>
        
        <div class="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <p class="text-xs text-blue-700 dark:text-blue-300">
            💡 Cache helps reduce API usage. Data is cached for 5 minutes to stay within the 2,500 req/day limit.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<LoginModal bind:open={showLoginModal} />

<style>
    .rug-pull-analysis {
        background: #1a1a1a;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid #333;
    }

    .rug-pull-analysis.critical {
        border-color: #ff4444;
        background: rgba(255, 68, 68, 0.1);
    }

    .rug-pull-analysis.high {
        border-color: #ff8800;
        background: rgba(255, 136, 0, 0.1);
    }

    .risk-meter {
        background: #333;
        height: 24px;
        border-radius: 12px;
        position: relative;
        margin: 1rem 0;
        overflow: hidden;
    }

    .risk-bar {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #FFC107, #FF5722);
        transition: width 0.3s ease;
    }

    .risk-value {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: white;
        font-weight: bold;
        text-shadow: 0 0 2px rgba(0,0,0,0.5);
    }

    .risk-summary {
        margin: 1rem 0;
    }

    .risk-level {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }

    .risk-level.critical { color: #ff4444; }
    .risk-level.high { color: #ff8800; }
    .risk-level.medium { color: #ffbb33; }
    .risk-level.low { color: #00C851; }

    .suggested-action {
        font-size: 1.1rem;
        color: #fff;
        margin-bottom: 0.5rem;
    }

    .time-warning {
        color: #ff4444;
        font-weight: bold;
        margin-top: 0.5rem;
    }

    .indicators {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }

    .indicator {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 1rem;
        border-left: 4px solid transparent;
    }

    .indicator.critical { border-left-color: #ff4444; }
    .indicator.high { border-left-color: #ff8800; }
    .indicator.medium { border-left-color: #ffbb33; }
    .indicator.low { border-left-color: #00C851; }

    .indicator-name {
        font-weight: bold;
        display: block;
        margin-bottom: 0.5rem;
    }

    .indicator-value {
        float: right;
        color: #aaa;
    }

    .indicator-description {
        color: #ddd;
        margin: 0.5rem 0;
        font-size: 0.9rem;
    }

    .indicator-time {
        display: block;
        font-size: 0.8rem;
        color: #888;
        margin-top: 0.5rem;
    }
</style> 
{/if}