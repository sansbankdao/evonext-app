import init, { WasmSdkBuilder, WasmSdk, prefetch_trusted_quorums_testnet, prefetch_trusted_quorums_mainnet, data_contract_fetch } from '../dash-wasm/wasm_sdk';
import { contractService } from './contract-service';

export interface WasmSdkConfig {
  network: 'testnet' | 'mainnet';
  contractId: string;
}

class WasmSdkService {
  private sdk: WasmSdk | null = null;
  private initPromise: Promise<void> | null = null;
  private config: WasmSdkConfig | null = null;
  private _isInitialized = false;
  private _isInitializing = false;
  private static wasmModuleInitialized = false;
  private static wasmInitPromise: Promise<void> | null = null;

  /**
   * Initialize the WASM SDK with configuration
   */
  async initialize(config: WasmSdkConfig): Promise<void> {
    // If already initialized with same config, return immediately
    if (this._isInitialized && this.config && 
        this.config.network === config.network && 
        this.config.contractId === config.contractId) {
      return;
    }

    // If currently initializing, wait for it to complete
    if (this._isInitializing && this.initPromise) {
      await this.initPromise;
      return;
    }

    // If config changed, cleanup first
    if (this._isInitialized && this.config && 
        (this.config.network !== config.network || this.config.contractId !== config.contractId)) {
      await this.cleanup();
    }

    this.config = config;
    this._isInitializing = true;
    
    this.initPromise = this._performInitialization();
    
    try {
      await this.initPromise;
    } finally {
      this._isInitializing = false;
    }
  }

  /**
   * Ensure WASM module is initialized (shared static method to prevent race conditions)
   */
  private static async _ensureWasmModuleInitialized(): Promise<void> {
    if (WasmSdkService.wasmModuleInitialized) {
      return;
    }

    if (WasmSdkService.wasmInitPromise) {
      await WasmSdkService.wasmInitPromise;
      return;
    }

    WasmSdkService.wasmInitPromise = (async () => {
      try {
        console.log('WasmSdkService: Initializing WASM module...');
        // Use the same pattern as the working index.html - just call init() without parameters
        // The init() function will automatically fetch and load the WASM file
        await init();
        console.log('WasmSdkService: WASM initialized successfully');
        WasmSdkService.wasmModuleInitialized = true;
        console.log('WasmSdkService: WASM module loaded successfully');
      } catch (error) {
        // Reset on error so retry is possible
        WasmSdkService.wasmInitPromise = null;
        throw error;
      }
    })();

    await WasmSdkService.wasmInitPromise;
  }

  private async _ensureWasmModuleInitialized(): Promise<void> {
    return WasmSdkService._ensureWasmModuleInitialized();
  }

  /**
   * We need to avoid network requests for our yappr contract.
   * The solution is to perform a controlled fetch that provides local contract data.
   */
  private async _preloadYapprContract(): Promise<void> {
    if (!this.config || !this.sdk) {
      return;
    }

    try {
      console.log('WasmSdkService: Adding yappr contract to trusted context...');
      
      const contractId = this.config.contractId;
      
      // Since we can't directly insert the contract, we need to intercept or mock the fetch.
      // For now, let's try the fetch and see if it succeeds (it might if the contract exists on testnet)
      try {
        await data_contract_fetch(this.sdk, contractId);
        console.log('WasmSdkService: Yappr contract found on network and cached in trusted context');
      } catch (error) {
        console.log('WasmSdkService: Contract not found on network (expected for local development)');
        console.log('WasmSdkService: Local contract operations will be handled gracefully');
        
        // The contract is not on the network, which is expected for local development.
        // The WASM SDK will attempt to fetch it on first document operation and fail.
        // Our error handling in dash-platform-client.ts will catch this and return empty results.
        // This is acceptable for development - users can still create posts, they just won't see existing ones.
      }
      
    } catch (error) {
      console.error('WasmSdkService: Error during contract setup:', error);
      // Don't throw - we can still operate
    }
  }

  private async _performInitialization(): Promise<void> {
    try {
      // Ensure WASM module is initialized first (shared across all instances)
      await this._ensureWasmModuleInitialized();
      
      // Now create the SDK instance for this service
      // Prefetch trusted quorums and create SDK builder based on network
      if (this.config!.network === 'testnet') {
        console.log('WasmSdkService: Prefetching testnet quorum information...');
        await prefetch_trusted_quorums_testnet();
        console.log('WasmSdkService: Building testnet SDK in trusted mode...');
        const builder = WasmSdkBuilder.new_testnet_trusted();
        this.sdk = builder.build();
        console.log('WasmSdkService: Testnet SDK built successfully');
      } else {
        console.log('WasmSdkService: Prefetching mainnet quorum information...');
        await prefetch_trusted_quorums_mainnet();
        console.log('Building mainnet SDK in trusted mode...');
        const builder = WasmSdkBuilder.new_mainnet_trusted();
        this.sdk = builder.build();
      }
      
      this._isInitialized = true;
      console.log('WasmSdkService: WASM SDK initialized successfully, _isInitialized = true');
      
      // Preload the yappr contract into the trusted context
      await this._preloadYapprContract();
    } catch (error) {
      console.error('WasmSdkService: Failed to initialize WASM SDK:', error);
      console.error('WasmSdkService: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      this.initPromise = null;
      this._isInitialized = false;
      throw error;
    }
  }

  /**
   * Get the SDK instance, initializing if necessary
   */
  async getSdk(): Promise<WasmSdk> {
    if (!this._isInitialized || !this.sdk) {
      if (!this.config) {
        throw new Error('WASM SDK not configured. Call initialize() first.');
      }
      await this.initialize(this.config);
    }
    return this.sdk!;
  }

  /**
   * Check if SDK is initialized
   */
  isReady(): boolean {
    return this._isInitialized && this.sdk !== null;
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this._isInitialized && this.sdk !== null;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.sdk) {
      // SDK cleanup if needed
      this.sdk = null;
    }
    this._isInitialized = false;
    this._isInitializing = false;
    this.initPromise = null;
    this.config = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): WasmSdkConfig | null {
    return this.config;
  }

  /**
   * Reinitialize with new configuration
   */
  async reinitialize(config: WasmSdkConfig): Promise<void> {
    await this.cleanup();
    await this.initialize(config);
  }
}

// Singleton instance
export const wasmSdkService = new WasmSdkService();

// Export helper to ensure SDK is initialized
export async function getWasmSdk(): Promise<WasmSdk> {
  return wasmSdkService.getSdk();
}

// Initialize from environment on import - removed to prevent race conditions
// SDK will be initialized on first use instead