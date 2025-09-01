/* Import modules. */
import { getWasmSdk } from './wasm-sdk-service'
import { identity_fetch, get_identity_balance } from '../dash-wasm/wasm_sdk'

export interface IdentityInfo {
    id: string;
    balance: number;
    publicKeys: any[];
    revision: number;
}

export interface IdentityBalance {
    confirmed: number;
    total: number;
}

class IdentityService {
    private identityCache: Map<string, { data: IdentityInfo; timestamp: number }> = new Map();
    private balanceCache: Map<string, { data: IdentityBalance; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 60000; // 1 minute cache

    /**
     * Fetch identity information
     */
    async getIdentity(identityId: string): Promise<IdentityInfo | null> {
        try {
            // Check cache
            const cached = this.identityCache.get(identityId);

            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }

            const sdk = await getWasmSdk()

            // Fetch identity
            console.log(`Fetching identity: ${identityId}`);
            const identityResponse = await identity_fetch(sdk, identityId);

            if (!identityResponse) {
                console.warn(`Identity not found: ${identityId}`);
                return null;
            }

            // identity_fetch returns an object with a toJSON method
            const identity = identityResponse.toJSON();

            console.log('Raw identity response:', JSON.stringify(identity, null, 2));
            console.log('Public keys from identity:', identity.publicKeys);

            const identityInfo: IdentityInfo = {
                id: identity.id || identityId,
                balance: identity.balance || 0,
                publicKeys: identity.publicKeys || identity.public_keys || [],
                revision: identity.revision || 0
            }

            // Cache the result
            this.identityCache.set(identityId, {
                data: identityInfo,
                timestamp: Date.now()
            })

            return identityInfo
        } catch (error) {
            console.error('Error fetching identity:', error);
            throw error;
        }
    }

    /**
     * Get identity balance
     */
    async getBalance(identityId: string): Promise<IdentityBalance> {
        try {
            // Check cache
            const cached = this.balanceCache.get(identityId);

            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }

            const sdk = await getWasmSdk()

            // Fetch balance
            console.log(`Fetching balance for: ${identityId}`);
            const balanceResponse = await get_identity_balance(sdk, identityId);

            // get_identity_balance returns an object directly
            const balance = balanceResponse;

            const balanceInfo: IdentityBalance = {
                confirmed: balance.confirmed || 0,
                total: balance.total || balance.confirmed || 0
            }

            // Cache the result
            this.balanceCache.set(identityId, {
                data: balanceInfo,
                timestamp: Date.now()
            })

            return balanceInfo
        } catch (error) {
            console.error('Error fetching balance:', error);
            // Return zero balance on error
            return { confirmed: 0, total: 0 };
        }
    }

    /**
     * Verify if identity exists
   ` */
    async verifyIdentity(identityId: string): Promise<boolean> {
        try {
            const identity = await this.getIdentity(identityId);

            return identity !== null;
        } catch (error) {
            console.error('Error verifying identity:', error);
            return false;
        }
    }

    /**
     * Get identity public keys
     */
    async getPublicKeys(identityId: string): Promise<any[]> {
        try {
            const identity = await this.getIdentity(identityId);

            return identity?.publicKeys || [];
        } catch (error) {
            console.error('Error fetching public keys:', error);
            return []
        }
    }

    /**
     * Clear cache for an identity
     */
    clearCache(identityId?: string): void {
        if (identityId) {
            this.identityCache.delete(identityId);
            this.balanceCache.delete(identityId);
        } else {
            this.identityCache.clear();
            this.balanceCache.clear();
        }
    }

    /**
     * Clear expired cache entries
     */
    cleanupCache(): void {
        const now = Date.now()

        // Clean identity cache
        for (const [key, value] of Array.from(this.identityCache.entries())) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.identityCache.delete(key);
            }
        }

        // Clean balance cache
        for (const [key, value] of Array.from(this.balanceCache.entries())) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.balanceCache.delete(key);
            }
        }
    }
}

// Singleton instance
export const identityService = new IdentityService()

// Set up periodic cache cleanup
if (typeof window !== 'undefined') {
    setInterval(() => {
        identityService.cleanupCache();
    }, 60000); // Clean up every minute
}
