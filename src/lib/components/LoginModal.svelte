<script lang="ts">
  import { Key, Eye, EyeOff, X } from 'lucide-svelte';
  import { userStore } from '$lib/stores';

  let { open = $bindable() } = $props();
  
  let apiKey = $state('');
  let showApiKey = $state(false);
  let isLoading = $state(false);
  let error = $state('');

  function handleLogin() {
    if (!apiKey.trim()) {
      error = 'Please enter your API key';
      return;
    }

    isLoading = true;
    error = '';
    
    try {
      userStore.login(apiKey.trim());
      apiKey = '';
      open = false;
    } catch (e) {
      error = 'Failed to authenticate. Please check your API key.';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin();
    }
    if (event.key === 'Escape') {
      open = false;
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      open = false;
    }
  }
</script>

{#if open}
  <!-- Modal Overlay -->
  <div 
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="login-title"
  >
    <!-- Modal Content -->
    <div class="bg-background border rounded-lg shadow-lg w-full max-w-md">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 id="login-title" class="text-lg font-semibold">Connect to Rugplay</h2>
        <button
          onclick={() => open = false}
          class="text-muted-foreground hover:text-foreground rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        <div class="text-center space-y-2">
          <p class="text-sm text-muted-foreground">
            Enter your Rugplay API key to start monitoring your favorite (definitely not fake) cryptocurrencies.
          </p>
        </div>

        <div class="space-y-4">
          <!-- API Key Input -->
          <div>
            <label for="modal-api-key" class="block text-sm font-medium mb-2">
              <Key class="inline h-4 w-4 mr-1" />
              Rugplay API Key
            </label>
            <div class="relative">
              <input
                id="modal-api-key"
                type={showApiKey ? 'text' : 'password'}
                bind:value={apiKey}
                onkeydown={handleKeydown}
                placeholder="rgpl_your_api_key_here"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onclick={() => showApiKey = !showApiKey}
                class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {#if showApiKey}
                  <EyeOff class="h-4 w-4" />
                {:else}
                  <Eye class="h-4 w-4" />
                {/if}
              </button>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              Get your API key from <a href="https://rugplay.com/api" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">rugplay.com/api</a>
            </p>
          </div>

          <!-- Error Display -->
          {#if error}
            <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p class="text-destructive text-sm">{error}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end space-x-2 p-6 border-t">
        <button
          onclick={() => open = false}
          class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          onclick={handleLogin}
          disabled={isLoading || !apiKey.trim()}
          class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
        >
          {#if isLoading}
            <div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
            Connecting...
          {:else}
            Connect
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if} 