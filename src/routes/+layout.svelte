<script lang="ts">
    import "../app.css";
    import { ModeWatcher } from "mode-watcher";
    import { onMount } from "svelte";
    import {
        Moon,
        Sun,
        TrendingUp,
        BarChart3,
        LogOut,
        User,
        Coffee,
    } from "lucide-svelte";
    import { mode, setMode } from "mode-watcher";
    import { userStore, monitoringStore } from "$lib/stores";

    let mobileMenuOpen = $state(false);
    let userData = $state<import("$lib/types").UserData>({
        isAuthenticated: false,
        apiKey: "",
        lastLogin: 0,
        watchedCoins: [],
    });

    let { children } = $props();

    onMount(() => {
        userStore.loadFromStorage();
        monitoringStore.loadFromStorage();
    });

    $effect(() => {
        const unsubscribe = userStore.subscribe((value) => {
            userData = value;
        });

        return () => unsubscribe();
    });

    function toggleMode() {
        setMode(mode.current === "light" ? "dark" : "light");
    }

    function closeMobileMenu() {
        mobileMenuOpen = false;
    }

    function handleLogout() {
        userStore.logout();
        monitoringStore.clearStorage();
        closeMobileMenu();
    }

    onMount(() => {
        userStore.loadFromStorage();
        monitoringStore.loadFromStorage();

        console.log(
            `%c                                       .--                    
                                      .=--:                   
                                   :=*#*:                     
                               .=******+#*.                   
                            .+*****+*#*+**#*                  
                          :**++**####*###*++#-                
                        =***+*####******###*+#*               
                      =***++#####***+++***%#*+*%:             
                    =*++*###+=++++====****##%#**#=            
                 .+**+=*##=*###+####*#+++*###%#**#=           
               :#*=**####=*#+-*##=-*##+**#####%##*%=          
     .      :+**++*###***++=*#++=*###**######%%%####:.--:     
    .---=******+*###****=***=-**+##*#+*###%%%***##%%#=--:     
     :-:  =#++**##***+++=******#*=##**#%%%##*#%*:             
           .**++*##***++**+**#*####+*%%#**#%+.                
             +***+##*=**=++******##%%*####:                   
              -#+++###***+*######%####%+                      
               .#*++*##**#####%%#**##=                        
                 *#*+*######%%#*###=                          
                  +#**#%%%%##**##-                            
                   =#***#*###%+.                              
                    -%#####*:                                 
                    .=%#*:                                    
                 .=--=.                                       
                   ::`,
            "color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);",
        );
        console.log(
            "%c Welcome to Rugplay Analyzer! Powered by Rugplay API",
            "color: #4962ee; font-family: monospace; font-size: 12px; font-weight: bold; text-shadow: 2px 2px rgba(0,0,0,0.2);",
        );
    });
</script>

<ModeWatcher />

<div class="min-h-screen bg-background text-foreground">
    <!-- Navigation -->
    <nav
        class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
        <div class="container mx-auto flex h-14 items-center px-4">
            <div class="mr-6 flex items-center space-x-2">
                <TrendingUp class="h-6 w-6 text-primary" />
                <span class="text-lg font-semibold">Rugplay Analyzer</span>
            </div>

            <!-- Desktop Navigation -->
            <div
                class="hidden md:flex md:flex-1 md:items-center md:justify-between"
            >
                <div class="flex items-center space-x-6">
                    <a
                        href="/dashboard"
                        class="text-sm font-medium transition-colors hover:text-primary"
                    >
                        <BarChart3 class="inline h-4 w-4 mr-1" />
                        Dashboard
                    </a>
                    <a
                        href="https://coff.ee/redbaron2k7"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm font-medium transition-colors hover:text-primary"
                    >
                        <Coffee class="inline h-4 w-4 mr-1" />
                        Buy me a coffee
                    </a>
                </div>

                <div class="flex items-center space-x-4">
                    {#if userData.isAuthenticated}
                        <div
                            class="flex items-center space-x-2 text-sm text-muted-foreground"
                        >
                            <User class="h-4 w-4" />
                            <span>API Connected</span>
                        </div>
                        <button
                            onclick={handleLogout}
                            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                        >
                            <LogOut class="h-4 w-4 mr-1" />
                            Logout
                        </button>
                    {/if}
                    <button
                        onclick={toggleMode}
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                    >
                        {#if mode.current === "dark"}
                            <Sun class="h-4 w-4" />
                        {:else}
                            <Moon class="h-4 w-4" />
                        {/if}
                        <span class="sr-only">Toggle theme</span>
                    </button>
                </div>
            </div>

            <!-- Mobile menu button -->
            <div class="md:hidden ml-auto">
                <button
                    onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                    aria-label="Toggle mobile menu"
                >
                    <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Mobile Navigation -->
        {#if mobileMenuOpen}
            <div class="md:hidden border-t bg-background">
                <div class="px-4 py-2 space-y-1">
                    <a
                        href="/dashboard"
                        onclick={closeMobileMenu}
                        class="block px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <BarChart3 class="inline h-4 w-4 mr-2" />
                        Dashboard
                    </a>
                    <a
                        href="https://coff.ee/redbaron2k7"
                        target="_blank"
                        rel="noopener noreferrer"
                        onclick={closeMobileMenu}
                        class="block px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <Coffee class="inline h-4 w-4 mr-2" />
                        Buy me a coffee
                    </a>

                    {#if userData.isAuthenticated}
                        <div class="px-3 py-2 text-sm text-muted-foreground">
                            <User class="inline h-4 w-4 mr-2" />
                            API Connected
                        </div>
                        <button
                            onclick={handleLogout}
                            class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <LogOut class="inline h-4 w-4 mr-2" />
                            Logout
                        </button>
                    {/if}

                    <div class="px-3 py-2">
                        <button
                            onclick={toggleMode}
                            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                        >
                            {#if mode.current === "dark"}
                                <Sun class="h-4 w-4" />
                            {:else}
                                <Moon class="h-4 w-4" />
                            {/if}
                            <span class="sr-only">Toggle theme</span>
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </nav>

    <!-- Main Content -->
    <main class="flex-1">
        {@render children()}
    </main>

    <!-- Footer -->
    <footer class="border-t bg-background">
        <div class="container mx-auto px-4 py-6">
            <div
                class="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0"
            >
                <div class="flex items-center space-x-2">
                    <TrendingUp class="h-5 w-5 text-primary" />
                    <span class="font-semibold">Rugplay Analyzer</span>
                    <span class="text-sm text-muted-foreground">
                        Professional crypto analysis powered by Rugplay API
                    </span>
                </div>
                <div
                    class="flex items-center space-x-4 text-sm text-muted-foreground"
                >
                    <a
                        href="/legal/terms"
                        class="hover:text-foreground transition-colors"
                    >
                        Terms
                    </a>
                    <a
                        href="/legal/privacy"
                        class="hover:text-foreground transition-colors"
                    >
                        Privacy
                    </a>
                    <a
                        href="https://rugplay.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="hover:text-foreground transition-colors"
                    >
                        Rugplay.com
                    </a>
                </div>
            </div>
        </div>
    </footer>
</div>
