<script lang="ts">
    import {
        Search,
        User,
        Shield,
        AlertTriangle,
        CheckCircle,
        TrendingUp,
        Eye,
        DollarSign,
        Users,
        Activity,
        AlertCircle,
    } from "lucide-svelte";
    import {
        formatCurrency,
        formatPercentage,
        getCoinImageUrl,
    } from "$lib/utils";
    import { onMount } from "svelte";
    import { userStore } from "$lib/stores";
    import type { UserData } from "$lib/types";

    interface Trade {
        type: "BUY" | "SELL";
        username: string;
        amount: number;
        coinSymbol: string;
        coinName: string;
        totalValue: number;
        price: number;
        timestamp: number;
        userId: string;
        analysis?: string;
    }

    interface TradeAnalysis {
        recentTrades: Trade[];
        buyCount: number;
        sellCount: number;
        totalVolume: number;
        averageTradeSize: number;
        largestTrade: Trade;
        tradeFrequency: number;
        priceImpact: number;
        suspiciousPatterns: string[];
    }

    interface HolderAnalysis {
        userId: number;
        username: string;
        name: string;
        quantity: number;
        percentage: number;
        trades: TradeAnalysis;
        riskFactors: string[];
        riskScore: number;
        isCreator: boolean;
    }

    interface InvestigationData {
        info: {
            info: {
                coin: {
                    name: string;
                    symbol: string;
                    price: number;
                    currentPrice: number;
                    marketCap: number;
                    volume24h: number;
                    change24h: number;
                    circulatingSupply: number;
                    initialSupply: number;
                    poolCoinAmount: number;
                    poolBaseCurrencyAmount: number;
                    creatorName: string;
                    creatorUsername: string;
                    creatorId: number;
                    createdAt: string;
                    category: string;
                    icon?: string;
                };
            };
        };
        holders: {
            holders: Array<{
                userId: number;
                username: string;
                name: string;
                quantity: number;
                percentage: number;
            }>;
        };
        tradingMetrics: {
            volume24h: number;
            trades24h: number;
            uniqueTraders24h: number;
            buyPressure: number;
            sellPressure: number;
            priceImpact: number;
            largestTrade: Trade;
            suspiciousPatterns: string[];
        };
        riskScore: number;
        majorHolderAnalysis: HolderAnalysis[];
    }

    interface Props {
        onCoinSelect?: (symbol: string) => void;
    }

    let { onCoinSelect }: Props = $props();

    let searchSymbol = $state("");
    let investigationData = $state<InvestigationData | null>(null);
    let isLoading = $state(false);
    let searchError = $state("");
    let selectedTab = $state<"profile" | "holders" | "suspicious">("profile");
    let selectedTimeframe = $state("24h");
    let userData = $state<UserData>({
        isAuthenticated: false,
        apiKey: "",
        lastLogin: 0,
        watchedCoins: [],
    });

    $effect(() => {
        const unsubscribe = userStore.subscribe((value) => {
            userData = value;
        });
        return unsubscribe;
    });

    async function investigateCoin() {
        if (!searchSymbol.trim()) return;
        if (!userData.apiKey) {
            searchError = "Please connect your API key first";
            return;
        }

        isLoading = true;
        searchError = "";

        try {
            const response = await fetch(
                `/api/v1/investigator/${searchSymbol.trim().toUpperCase()}`,
                {
                    headers: {
                        Authorization: `Bearer ${userData.apiKey}`,
                        "Content-Type": "application/json",
                    },
                },
            );
            if (response.ok) {
                investigationData = await response.json();
            } else {
                const error = await response.json();
                if (response.status === 404) {
                    searchError = "This coin hasn't been indexed yet. Please try another coin or check back later.";
                } else {
                    searchError = error.message || "Failed to investigate coin";
                }
            }
        } catch (error) {
            console.error("Failed to investigate coin:", error);
            searchError = "Failed to load investigation data";
        } finally {
            isLoading = false;
        }
    }

    function getTrustLevelColor(level: string): string {
        switch (level) {
            case "high":
                return "text-green-600 bg-green-50 border-green-200";
            case "medium":
                return "text-yellow-600 bg-yellow-50 border-yellow-200";
            case "low":
                return "text-red-600 bg-red-50 border-red-200";
            default:
                return "text-gray-600 bg-gray-50 border-gray-200";
        }
    }

    function getRiskLevelColor(score: number): string {
        if (score >= 80) return 'border-destructive/50 bg-destructive/5';
        if (score >= 60) return 'border-orange-500/50 bg-orange-500/5 dark:border-orange-400/30 dark:bg-orange-400/5';
        if (score >= 40) return 'border-yellow-500/50 bg-yellow-500/5 dark:border-yellow-400/30 dark:bg-yellow-400/5';
        return 'border-green-500/50 bg-green-500/5 dark:border-green-400/30 dark:bg-green-400/5';
    }

    function getRiskLevelTextColor(score: number): string {
        if (score >= 80) return 'text-destructive';
        if (score >= 60) return 'text-orange-500 dark:text-orange-400';
        if (score >= 40) return 'text-yellow-500 dark:text-yellow-400';
        return 'text-green-500 dark:text-green-400';
    }

    function getRiskLevelBgColor(score: number): string {
        if (score >= 80) return 'bg-destructive/10';
        if (score >= 60) return 'bg-orange-500/10 dark:bg-orange-400/10';
        if (score >= 40) return 'bg-yellow-500/10 dark:bg-yellow-400/10';
        return 'bg-green-500/10 dark:bg-green-400/10';
    }

    function getRiskFactorExplanation(factor: string): string {
        const explanations: Record<string, string> = {
            'Extreme concentration (>90%)': 'A single wallet holds more than 90% of the total supply. This is extremely dangerous as the holder can crash the price by selling.',
            'High concentration (>50%)': 'A single wallet holds more than 50% of the total supply. This gives them significant control over the price.',
            'Potential wash trading detected': 'Multiple trades detected between related wallets. This is a form of market manipulation where a trader simultaneously buys and sells to create fake volume.',
            'Coordinated trading pattern detected': 'Multiple wallets are trading in sync, suggesting they may be controlled by the same person trying to manipulate the price.',
            'Unusually high trading frequency': 'The number of trades is significantly higher than normal, which could indicate automated trading or manipulation.',
            'Suspiciously round number holdings': 'The wallet holds tokens in suspiciously round numbers, which is common in artificial token distribution.',
            'Large sell pressure detected': 'A high volume of pending sell orders detected, which could cause significant price drops.',
            'Rapid accumulation pattern': 'The wallet is quickly buying up tokens, possibly preparing for a pump and dump.',
            'Multiple connected wallets': 'Several wallets showing coordinated behavior, suggesting they\'re controlled by the same entity.',
            '4 instances of potential price manipulation': 'Multiple trades detected that appear designed to artificially move the price up or down.'
        };
        return explanations[factor] || 'Suspicious activity detected requiring further investigation';
    }

    function getSuspiciousPatternExplanation(pattern: string): string {
        if (pattern.includes('Dead coin')) {
            return 'No trading activity detected recently. The coin appears to be abandoned or rugged (developers have disappeared with funds).';
        }
        if (pattern.includes('Extreme pump')) {
            return 'Price increased by more than 500% very quickly. This is often a sign of price manipulation before a large dump.';
        }
        if (pattern.includes('Large pump')) {
            return 'Price increased by more than 200%. While this could be natural growth, it\'s often followed by a dump.';
        }
        if (pattern.includes('Major dump')) {
            return 'Sharp price decrease detected. Large holders are selling their positions, which could crash the price.';
        }
        if (pattern.includes('Zero volume')) {
            return 'No trading volume detected. The coin is either dead or completely illiquid, meaning you can\'t sell.';
        }
        if (pattern.includes('Volume dying')) {
            return 'Trading volume is significantly decreasing. Interest in the coin is dropping, making it harder to sell.';
        }
        if (pattern.includes('Single wallet owns >90%')) {
            return 'One wallet controls over 90% of all tokens. They can crash the price at any time by selling.';
        }
        if (pattern.includes('Single wallet owns >50%')) {
            return 'One wallet controls over 50% of all tokens. They have significant power to manipulate the price.';
        }
        if (pattern.includes('Rug pull in progress')) {
            return 'Multiple high-risk indicators suggest the developers or large holders are actively dumping their tokens.';
        }
        if (pattern.includes('4 instances of potential price manipulation')) {
            return 'Multiple trades detected that appear designed to artificially move the price. This includes wash trading (trading with yourself) and coordinated buys/sells.';
        }
        if (pattern.includes('Coordinated trading pattern')) {
            return 'Multiple wallets are trading in a synchronized pattern, suggesting they\'re controlled by the same person trying to manipulate the market.';
        }
        return 'Unusual trading pattern detected requiring investigation';
    }

    function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    function formatAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    function getTradeTypeColor(type: string): string {
        return type === 'BUY' ? 'text-green-600' : 'text-red-600';
    }

    function getTradeTypeIcon(type: string): string {
        return type === 'BUY' ? '↗' : '↘';
    }

    function getTradeAnalysisColor(analysis: string): string {
        if (analysis.includes('rugpull')) return 'text-red-600';
        if (analysis.includes('manipulation')) return 'text-orange-500';
        if (analysis.includes('wash trading')) return 'text-yellow-500';
        return 'text-gray-600';
    }
</script>

<div class="bg-card rounded-lg border p-6">
    <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold flex items-center">
            <Eye class="h-5 w-5 mr-2 text-primary" />
            Coin Investigator
        </h2>
    </div>

    <!-- Search Bar -->
    <div class="mb-6">
        <div class="flex space-x-2">
            <div class="flex-1 relative">
                <input
                    type="text"
                    bind:value={searchSymbol}
                    onkeydown={(e) => e.key === "Enter" && investigateCoin()}
                    placeholder="Enter coin symbol to investigate (e.g., BTC, ETH)"
                    class="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Search
                    class="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
            </div>
            <button
                onclick={investigateCoin}
                disabled={isLoading || !searchSymbol.trim()}
                class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
                {isLoading ? "Investigating..." : "Investigate"}
            </button>
        </div>
    </div>

    {#if isLoading}
        <div class="flex flex-col items-center justify-center py-12 px-4">
            <div class="bg-primary/10 rounded-full p-4 mb-4">
                <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-r-transparent"></div>
            </div>
            <h3 class="text-lg font-semibold mb-2 text-center">Analyzing Trading Activity</h3>
            <p class="text-muted-foreground text-center max-w-md mb-2">
                We're analyzing millions of transactions across multiple chains to detect suspicious patterns.
                This might take a minute...
            </p>
            <p class="text-sm text-muted-foreground/80 text-center max-w-sm">
                Our AI is checking trading volumes, holder behaviors, and price movements to ensure thorough analysis.
            </p>
        </div>
    {:else if searchError}
        <div class="flex flex-col items-center justify-center py-12 px-4 bg-muted/30 rounded-lg border border-border">
            <div class="bg-primary/10 rounded-full p-3 mb-4">
                <AlertCircle class="h-8 w-8 text-primary" />
            </div>
            <h3 class="text-lg font-semibold mb-2 text-center">Not Indexed Yet</h3>
            <p class="text-muted-foreground text-center max-w-md mb-6">
                This coin hasn't been analyzed by our system yet. We're constantly adding new coins to our database.
                Please try searching for another coin.
            </p>
            <button
                onclick={() => {
                    searchSymbol = "";
                    searchError = "";
                }}
                class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
                Try Another Coin
            </button>
        </div>
    {:else if investigationData}
        <!-- Tab Navigation -->
        <div class="flex space-x-1 mb-6 bg-muted rounded-lg p-1">
            <button
                onclick={() => (selectedTab = "profile")}
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors {selectedTab ===
                'profile'
                    ? 'bg-background shadow-sm text-primary'
                    : 'hover:bg-background/50 text-muted-foreground'}"
            >
                <DollarSign class="h-4 w-4 inline mr-1" />
                Coin Profile
            </button>
            <button
                onclick={() => (selectedTab = "holders")}
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors {selectedTab ===
                'holders'
                    ? 'bg-background shadow-sm text-primary'
                    : 'hover:bg-background/50 text-muted-foreground'}"
            >
                <Users class="h-4 w-4 inline mr-1" />
                Major Holders
            </button>
            <button
                onclick={() => (selectedTab = "suspicious")}
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors {selectedTab ===
                'suspicious'
                    ? 'bg-background shadow-sm text-primary'
                    : 'hover:bg-background/50 text-muted-foreground'}"
            >
                <AlertTriangle class="h-4 w-4 inline mr-1" />
                Suspicious Activity
            </button>
        </div>

        <!-- Content Panels -->
        {#if selectedTab === "profile"}
            <div class="space-y-6">
                <!-- Coin Info Card -->
                <div class="bg-card rounded-xl border p-6">
                    <div class="flex items-start space-x-6">
                        <img
                            src={getCoinImageUrl(
                                investigationData.info.info.coin.icon || null,
                            )}
                            alt={investigationData.info.info.coin.name}
                            class="w-20 h-20 rounded-full bg-muted ring-4 ring-primary/10"
                        />
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-2xl font-bold">
                                        {investigationData.info.info.coin.name}
                                    </h3>
                                    <p class="text-lg text-muted-foreground">
                                        ${investigationData.info.info.coin
                                            .symbol}
                                    </p>
                                </div>
                                <div class="text-right">
                                    <p class="text-2xl font-bold">
                                        {formatCurrency(
                                            investigationData.info.info.coin
                                                .currentPrice,
                                        )}
                                    </p>
                                    <p
                                        class="text-lg {investigationData.info
                                            .info.coin.change24h >= 0
                                            ? 'text-green-600'
                                            : 'text-red-600'} font-semibold"
                                    >
                                        {formatPercentage(
                                            investigationData.info.info.coin
                                                .change24h,
                                        )} (24h)
                                    </p>
                                </div>
                            </div>

                            <div
                                class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6"
                            >
                                <div class="bg-muted/50 rounded-lg p-3 group relative">
                                    <p class="text-sm text-muted-foreground">
                                        Market Cap
                                    </p>
                                    <p class="text-lg font-semibold">
                                        {formatCurrency(
                                            investigationData.info.info.coin
                                                .marketCap,
                                        )}
                                    </p>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                        Total value of all coins in circulation
                                    </div>
                                </div>
                                <div class="bg-muted/50 rounded-lg p-3 group relative">
                                    <p class="text-sm text-muted-foreground">
                                        24h Volume
                                    </p>
                                    <p class="text-lg font-semibold">
                                        {formatCurrency(
                                            investigationData.info.info.coin
                                                .volume24h,
                                        )}
                                    </p>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                        Total value of all trades in the last 24 hours
                                    </div>
                                </div>
                                <div class="bg-muted/50 rounded-lg p-3 group relative">
                                    <p class="text-sm text-muted-foreground">
                                        Circulating Supply
                                    </p>
                                    <p class="text-lg font-semibold">
                                        {investigationData.info.info.coin.circulatingSupply.toLocaleString()}
                                    </p>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                        Number of coins currently in circulation
                                    </div>
                                </div>
                                <div class="bg-muted/50 rounded-lg p-3 group relative">
                                    <p class="text-sm text-muted-foreground">
                                        Initial Supply
                                    </p>
                                    <p class="text-lg font-semibold">
                                        {investigationData.info.info.coin.initialSupply.toLocaleString()}
                                    </p>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                        Total number of coins at launch
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Creator Info -->
                    <div class="mt-6 p-4 bg-muted/30 rounded-lg">
                        <div class="flex items-center space-x-2">
                            <User class="h-5 w-5 text-primary" />
                            <h4 class="font-semibold">Creator Information</h4>
                        </div>
                        <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-muted-foreground">
                                    Creator Name
                                </p>
                                <p class="font-medium">
                                    {investigationData.info.info.coin
                                        .creatorName}
                                </p>
                            </div>
                            <div>
                                <p class="text-sm text-muted-foreground">
                                    Created On
                                </p>
                                <p class="font-medium">
                                    {new Date(
                                        investigationData.info.info.coin.createdAt,
                                    ).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Risk Score -->
                    <div class="mt-6">
                        <div class="flex items-center justify-between">
                            <h4 class="font-semibold flex items-center">
                                <Shield class="h-5 w-5 mr-2 text-primary" />
                                Risk Assessment
                            </h4>
                            <div class="flex items-center space-x-2">
                                <div
                                    class="h-2 w-24 bg-muted rounded-full overflow-hidden"
                                >
                                    <div
                                        class="h-full rounded-full {investigationData.riskScore >=
                                        70
                                            ? 'bg-red-500'
                                            : investigationData.riskScore >= 50
                                              ? 'bg-orange-500'
                                              : investigationData.riskScore >=
                                                  30
                                                ? 'bg-yellow-500'
                                                : 'bg-green-500'}"
                                        style="width: {investigationData.riskScore}%"
                                    ></div>
                                </div>
                                <span
                                    class="font-semibold {investigationData.riskScore >=
                                    70
                                        ? 'text-red-500'
                                        : investigationData.riskScore >= 50
                                          ? 'text-orange-500'
                                          : investigationData.riskScore >= 30
                                            ? 'text-yellow-500'
                                            : 'text-green-500'}"
                                    >{investigationData.riskScore}%</span
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {:else if selectedTab === "holders"}
            <div class="space-y-6">
                <!-- Holders Overview -->
                <div class="bg-card rounded-xl border p-6">
                    <h3 class="text-xl font-semibold mb-6 flex items-center">
                        <Users class="h-6 w-6 mr-2" />
                        Major Holders Analysis
                    </h3>
                    <div class="space-y-6">
                        {#each investigationData.majorHolderAnalysis as holder}
                            <div class="border rounded-lg p-4 {getRiskLevelColor(holder.riskScore)}">
                                <!-- Holder Header -->
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-full {getRiskLevelBgColor(holder.riskScore)}">
                                            <User class="h-5 w-5 {getRiskLevelTextColor(holder.riskScore)}" />
                                        </div>
                                        <div>
                                            <h4 class="font-semibold">{holder.name || holder.username}</h4>
                                            <p class="text-sm text-muted-foreground">
                                                Holds {formatPercentage(holder.percentage)} ({formatCurrency(holder.quantity * investigationData.info.info.coin.currentPrice)})
                                            </p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="flex items-center space-x-2">
                                            <span class="text-sm font-medium">Risk Score:</span>
                                            <span class="font-bold {getRiskLevelTextColor(holder.riskScore)}">{holder.riskScore}%</span>
                                        </div>
                                        {#if holder.isCreator}
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Creator</span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Trading Activity -->
                                <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div class="bg-card rounded-lg p-3 group relative">
                                        <p class="text-sm text-muted-foreground">Trading Volume</p>
                                        <p class="font-semibold">{formatCurrency(holder.trades.totalVolume)}</p>
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                            Total value of all trades by this holder
                                        </div>
                                    </div>
                                    <div class="bg-card rounded-lg p-3 group relative">
                                        <p class="text-sm text-muted-foreground">Trade Count</p>
                                        <p class="font-semibold">Buy: {holder.trades.buyCount} | Sell: {holder.trades.sellCount}</p>
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                            Number of buy and sell transactions
                                        </div>
                                    </div>
                                    <div class="bg-card rounded-lg p-3 group relative">
                                        <p class="text-sm text-muted-foreground">Avg Trade Size</p>
                                        <p class="font-semibold">{formatCurrency(holder.trades.averageTradeSize)}</p>
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
                                            Average value per trade
                                        </div>
                                    </div>
                                </div>

                                {#if holder.riskFactors.length > 0}
                                    <div class="mt-4">
                                        <p class="text-sm font-medium mb-2">Risk Factors:</p>
                                        <div class="flex flex-wrap gap-2">
                                            {#each holder.riskFactors as factor}
                                                <div class="group relative">
                                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                                        <AlertTriangle class="h-3 w-3 mr-1" />
                                                        {factor}
                                                    </span>
                                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded-lg py-2 px-3 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
                                                        {getRiskFactorExplanation(factor)}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                {#if holder.trades.suspiciousPatterns.length > 0}
                                    <div class="mt-4">
                                        <p class="text-sm font-medium mb-2">Suspicious Trading Patterns:</p>
                                        <div class="flex flex-col gap-2">
                                            {#each holder.trades.suspiciousPatterns as pattern}
                                                <div class="group relative">
                                                    <div class="flex items-start space-x-2 bg-destructive/10 text-destructive rounded-lg p-3">
                                                        <AlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p class="font-medium">{pattern}</p>
                                                            <p class="text-xs mt-1">{getSuspiciousPatternExplanation(pattern)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                <!-- Detailed Trade Activity -->
                                {#if holder.trades.recentTrades?.length > 0}
                                    <div class="mt-4">
                                        <p class="text-sm font-medium mb-2">Recent Trade Activity:</p>
                                        <div class="overflow-x-auto">
                                            <table class="w-full text-sm">
                                                <thead>
                                                    <tr class="border-b border-border">
                                                        <th class="text-left py-2 px-3">Time</th>
                                                        <th class="text-left py-2 px-3">Type</th>
                                                        <th class="text-right py-2 px-3">Amount</th>
                                                        <th class="text-right py-2 px-3">Price</th>
                                                        <th class="text-right py-2 px-3">Value</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {#each holder.trades.recentTrades as trade}
                                                        <tr class="border-b border-border hover:bg-muted/50 {trade.analysis ? 'bg-destructive/5' : ''}">
                                                            <td class="py-2 px-3">{new Date(trade.timestamp).toLocaleString()}</td>
                                                            <td class="py-2 px-3">
                                                                <div class="flex items-center gap-2">
                                                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {trade.type === 'BUY' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                                                                        {trade.type}
                                                                    </span>
                                                                    <span class="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                                        {trade.coinSymbol}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td class="py-2 px-3 text-right">{trade.amount.toLocaleString()}</td>
                                                            <td class="py-2 px-3 text-right">{formatCurrency(trade.price)}</td>
                                                            <td class="py-2 px-3 text-right">{formatCurrency(trade.totalValue)}</td>
                                                        </tr>
                                                        {#if trade.analysis}
                                                            <tr class="border-b border-border bg-destructive/5">
                                                                <td colspan="5" class="py-2 px-3">
                                                                    <div class="flex items-start space-x-2 text-destructive text-xs">
                                                                        <AlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                                        <div>
                                                                            <p class="font-medium">Suspicious Trade Detected</p>
                                                                            <p class="mt-1">{trade.analysis}</p>
                                                                            <div class="mt-2 text-muted-foreground">
                                                                                {#if trade.analysis.includes('wash trade')}
                                                                                    <p>Wash trading is a form of market manipulation where a trader simultaneously buys and sells the same asset to create artificial volume and mislead other traders.</p>
                                                                                {:else if trade.analysis.includes('coordinated')}
                                                                                    <p>Coordinated trading occurs when multiple wallets trade in sync, suggesting they may be controlled by the same entity trying to manipulate the market.</p>
                                                                                {:else if trade.analysis.includes('round number')}
                                                                                    <p>Round number amounts are suspicious because they're commonly used in artificial trading or token distribution schemes.</p>
                                                                                {:else if trade.analysis.includes('large trade')}
                                                                                    <p>Unusually large trades can be used to manipulate prices or may indicate insider trading activity.</p>
                                                                                {:else if trade.analysis.includes('price')}
                                                                                    <p>Significant price deviations from the average could indicate price manipulation attempts.</p>
                                                                                {/if}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        {/if}
                                                    {/each}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {:else if selectedTab === "suspicious"}
            <div class="space-y-6">
                <div class="rounded-lg border p-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold flex items-center gap-2">
                            <AlertTriangle class="w-5 h-5 text-destructive" />
                            Suspicious Trading Activity
                        </h3>
                        {#if investigationData.majorHolderAnalysis.some(h => h.trades.recentTrades.length > 0)}
                            <span class="text-sm text-muted-foreground">
                                Showing suspicious trades from major holders
                            </span>
                        {/if}
                    </div>
                    {#if investigationData?.majorHolderAnalysis?.length}
                        {#each investigationData.majorHolderAnalysis as holder}
                            {#if holder.trades.recentTrades.some(trade => trade.analysis)}
                                <div class="mb-8 last:mb-0">
                                    <div class="flex items-center gap-2 mb-3 bg-muted/30 p-3 rounded-md">
                                        <User class="w-4 h-4" />
                                        <h4 class="font-medium">{holder.name} ({holder.username})</h4>
                                        <span class="text-sm text-muted-foreground">
                                            {formatPercentage(holder.percentage)}% holdings
                                        </span>
                                        {#if holder.riskScore > 0}
                                            <span class={`ml-auto text-sm font-medium ${getRiskLevelTextColor(holder.riskScore)}`}>
                                                Risk Score: {holder.riskScore}
                                            </span>
                                        {/if}
                                    </div>
                                    <div class="space-y-4">
                                        {#each holder.trades.recentTrades.filter(trade => trade.analysis) as trade}
                                            <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-muted/10 transition-colors">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-3">
                                                        <span class={`font-semibold ${getTradeTypeColor(trade.type)}`}>
                                                            {getTradeTypeIcon(trade.type)} {trade.type}
                                                        </span>
                                                        <span class="text-sm px-2 py-1 bg-muted rounded font-medium">
                                                            {trade.coinSymbol}
                                                        </span>
                                                        <span class="text-sm text-muted-foreground">
                                                            {trade.coinName}
                                                        </span>
                                                    </div>
                                                    <span class="text-sm text-muted-foreground">
                                                        {formatTimestamp(trade.timestamp)}
                                                    </span>
                                                </div>
                                                <div class="flex items-center gap-4 text-sm">
                                                    <div>
                                                        <span class="text-muted-foreground">Amount:</span>
                                                        <span class="font-medium ml-1">{trade.amount.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span class="text-muted-foreground">Price:</span>
                                                        <span class="font-medium ml-1">{formatCurrency(trade.price)}</span>
                                                    </div>
                                                    <div>
                                                        <span class="text-muted-foreground">Value:</span>
                                                        <span class="font-medium ml-1">{formatCurrency(trade.totalValue)}</span>
                                                    </div>
                                                </div>
                                                {#if trade.analysis}
                                                    <div class="mt-2 flex items-start gap-2 text-destructive text-sm bg-destructive/5 p-3 rounded-md">
                                                        <AlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p class="font-medium">Suspicious Trade Detected</p>
                                                            <p class="mt-1 text-sm">{trade.analysis}</p>
                                                        </div>
                                                    </div>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    {:else}
                        <div class="text-center text-muted-foreground py-8">
                            <AlertCircle class="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No suspicious trading activity detected</p>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    {:else}
        <div class="text-center py-12 text-muted-foreground">
            <Eye class="h-16 w-16 mx-auto mb-4" />
            <h3 class="text-lg font-semibold mb-2">Deep Coin Investigation</h3>
            <p>
                Enter a coin symbol above to get detailed analysis of the
                creator, holders, and trading patterns.
            </p>
        </div>
    {/if}
</div>
