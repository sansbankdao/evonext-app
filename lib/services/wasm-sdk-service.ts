/* Import modules. */
import init, {
    WasmSdkBuilder,
    WasmSdk,
    WasmTrustedContext,
} from '../dash-wasm/wasm_sdk'

import { contractService } from './contract-service'

export interface WasmSdkConfig {
    network: 'testnet' | 'mainnet';
    contractId: string;
}

class WasmSdkService {
    /* F56f — the trusted-context MEMO: the prefetch (quorum keys + the DAPI
     * discovery) is EXPENSIVE and FLAKY (live-observed 2026-11-15:
     * "Failed to prefetch quorums: HTTP request error" killed the service
     * init, the dashboard's Transparent/Total reads, AND the send spinner).
     * One success is cached per network and reused for every later init. */
    private static trustedContextCache = new Map<'testnet' | 'mainnet', any>();

    private sdk: WasmSdk | null = null
    private initPromise: Promise<void> | null = null
    private config: WasmSdkConfig | null = null
    private _isInitialized = false
    private _isInitializing = false
    private static wasmModuleInitialized = false
    private static wasmInitPromise: Promise<void> | null = null

    /**
     * Initialize the WASM SDK with configuration
     */
    async initialize(config: WasmSdkConfig): Promise<void> {
        // If already initialized with same config, return immediately
        if (this._isInitialized && this.config &&
            this.config.network === config.network &&
            this.config.contractId === config.contractId
        ) {
            return
        }

        // If currently initializing, wait for it to complete
        if (this._isInitializing && this.initPromise) {
            await this.initPromise
            return
        }

        // If config changed, cleanup first
        if (
            this._isInitialized && this.config &&
            (this.config.network !== config.network || this.config.contractId !== config.contractId)
        ) {
            await this.cleanup()
        }

        this.config = config
        this._isInitializing = true

        this.initPromise = this._performInitialization()

        try {
            await this.initPromise
        } finally {
            this._isInitializing = false
        }
    }

    /**
     * Ensure WASM module is initialized (shared static method to prevent race conditions)
     */
    private static async _ensureWasmModuleInitialized(): Promise<void> {
        if (WasmSdkService.wasmModuleInitialized) {
            return
        }

        if (WasmSdkService.wasmInitPromise) {
            await WasmSdkService.wasmInitPromise

            return
        }

        /* RETRY (F56d): the 26.5MB wasm fetch through the Pages Function is
         * FLAKY — an abort ("Response body loading was aborted") left the
         * main thread's glue uninitialized and any direct glue consumer
         * (the wallet-manager key derivation) crashed with "Cannot read
         * properties of undefined (reading
         * 'wasmsdk_deriveKeyFromSeedWithPath')". Retry the load up to 3×
         * with a backoff before surfacing. */
        const MAX_WASM_LOAD_ATTEMPTS = 3
        WasmSdkService.wasmInitPromise = (async () => {
            let lastError: unknown
            for (let attempt = 1; attempt <= MAX_WASM_LOAD_ATTEMPTS; attempt++) {
                try {
                    // Use the same pattern as the working index.html - just call init() without parameters
                    // The init() function will automatically fetch and load the WASM file
                    await init()

                    WasmSdkService.wasmModuleInitialized = true
                    return
                } catch (error) {
                    lastError = error
                    console.warn(`WasmSdkService: wasm load failed (attempt ${attempt}/${MAX_WASM_LOAD_ATTEMPTS}):`, String((error as any)?.message ?? error).slice(0, 140))
                    if (attempt < MAX_WASM_LOAD_ATTEMPTS) {
                        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
                    }
                }
            }
            // Reset on error so retry is possible
            WasmSdkService.wasmInitPromise = null
            throw lastError
        })()

        await WasmSdkService.wasmInitPromise
    }

    private async _ensureWasmModuleInitialized(): Promise<void> {
        return WasmSdkService._ensureWasmModuleInitialized()
    }

    /**
     * We need to avoid network requests for our yappr contract.
     * The solution is to perform a controlled fetch that provides local contract data.
     */
    private async _preloadEvoNextContract(): Promise<void> {
        if (!this.config || !this.sdk) {
            return
        }

        try {

            const contractId = this.config.contractId

            // Since we can't directly insert the contract, we need to intercept or mock the fetch.
            // For now, let's try the fetch and see if it succeeds (it might if the contract exists on testnet)
            try {
                // v4.1.1 API: getDataContract fetches (with proof) and caches the
                // contract in the SDK's contract store; resolves undefined when
                // the contract is not on the network.
                const contract = await this.sdk.getDataContract(contractId)
                if (contract) {
                } else {
                }
            } catch (error) {

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
        // Ensure WASM module is initialized first (shared across all
        // instances; the LOAD itself is retried inside _ensure...).
        await this._ensureWasmModuleInitialized()

        /* F56f — the PREFETCH+BUILD retry: the trusted-context prefetch (the
         * DAPI discovery) is the OTHER flaky step — live-observed
         * "Failed to prefetch quorums: HTTP request error" failing every
         * init for a stretch. Retry the prefetch+build 3x (the wasm load is
         * NOT re-attempted here — its own retry already ran). */
        const MAX_PREFETCH_ATTEMPTS = 5
        let lastError: unknown
        for (let attempt = 1; attempt <= MAX_PREFETCH_ATTEMPTS; attempt++) {
            try {
                await this._buildSdkWithTrustedContext()
                await this._preloadEvoNextContract()
                this._isInitialized = true
                return
            } catch (error) {
                lastError = error
                console.warn(`WasmSdkService: init attempt ${attempt}/${MAX_PREFETCH_ATTEMPTS} failed:`, String((error as any)?.message ?? error).slice(0, 140))
                if (attempt < MAX_PREFETCH_ATTEMPTS) {
                    /* F57: the discovery endpoint flakes in BURSTS — a longer
                     * ladder (2/4/8/16s ≈ 30s of retrying) outlives them. */
                    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)))
                }
            }
        }
        throw lastError
    }

    private async _buildSdkWithTrustedContext(): Promise<void> {
        try {

            // Now create the SDK instance for this service
            // Prefetch trusted quorums and create SDK builder based on network
            if (this.config!.network === 'testnet') {

                // v4.1.1 API: the trusted context fetches quorum keys AND discovers
                // live masternode addresses at runtime, replacing the removed
                // hard-coded address list of older SDK builds.
                const context = (WasmSdkService.trustedContextCache.get('testnet')
                    ?? await WasmTrustedContext.prefetchTestnet().then((c: any) => {
                        WasmSdkService.trustedContextCache.set('testnet', c);
                        return c;
                    }));

                // Create builder - returns a builder preconfigured for the network
                let builder;

                try {
                    builder = WasmSdkBuilder.testnet().withTrustedContext(context);
                } catch (error) {
                    console.error('WasmSdkService: Failed to create testnet builder:', error);
                    throw error;
                }

                // Set request timeout to 8 seconds (8000ms)

                try {
                    builder = builder.withSettings(undefined, 8000, undefined, undefined);
                } catch (error) {
                    console.error('WasmSdkService: Failed to apply settings:', error);
                    throw error;
                }


                try {
                    this.sdk = builder.build();
                } catch (error) {
                    console.error('WasmSdkService: Failed to build SDK:', error);
                    throw error;
                }
            } else {

                const context = (WasmSdkService.trustedContextCache.get('mainnet')
                    ?? await WasmTrustedContext.prefetchMainnet().then((c: any) => {
                        WasmSdkService.trustedContextCache.set('mainnet', c);
                        return c;
                    }));

                // Create builder - returns a builder preconfigured for the network

                let builder;

                try {
                    builder = WasmSdkBuilder.mainnet().withTrustedContext(context);
                } catch (error) {
                    console.error('WasmSdkService: Failed to create mainnet builder:', error);
                    throw error;
                }

                // Set request timeout to 8 seconds (8000ms)

                try {
                    builder = builder.withSettings(undefined, 8000, undefined, undefined);
                } catch (error) {
                    console.error('WasmSdkService: Failed to apply settings:', error);
                    throw error;
                }


                try {
                    this.sdk = builder.build();
                } catch (error) {
                    console.error('WasmSdkService: Failed to build SDK:', error);
                    throw error;
                }
            }
            /* (the _isInitialized + the contract preload now happen in
             * _performInitialization after the build succeeds) */
        } catch (error) {
            console.error('WasmSdkService: Failed to initialize WASM SDK:', error);
            console.error('WasmSdkService: Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            })

            this.initPromise = null

            this._isInitialized = false

            throw error
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

        return this.sdk!
    }

    /**
     * Check if SDK is initialized
     */
    isReady(): boolean {
        return this._isInitialized && this.sdk !== null;
    }

    /** The network the CURRENT SDK instance was built for (null = not
     *  initialized). Callers that need a specific network must compare this
     *  and re-initialize when it differs — initialize() no-ops when the
     *  config matches, so a testnet-initialized service would otherwise
     *  silently serve testnet data to a mainnet caller (F37). */
    initializedNetwork(): 'testnet' | 'mainnet' | null {
        return this.config?.network ?? null;
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
        return this.config
    }

    /**
     * Reinitialize with new configuration
     */
    async reinitialize(config: WasmSdkConfig): Promise<void> {
        await this.cleanup()

        await this.initialize(config)
    }
}

// Singleton instance
export const wasmSdkService = new WasmSdkService()

// Export helper to ensure SDK is initialized
export async function getWasmSdk(): Promise<WasmSdk> {
    return wasmSdkService.getSdk()
}

// Initialize from environment on import - removed to prevent race conditions
// SDK will be initialized on first use instead
