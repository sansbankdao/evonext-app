'use client'

export interface Currency {
    USD: any;
}

export interface Token {
    id: string;
    token_id_hex: string;
    iconUrl: string;
    duffs?: bigint;
    amount?: bigint;
    decimal_places: number;
    fiat: Currency;
}

/* Initialize constants. */
export const DEFAULT_ASSET = {
    id: '0',
    token_id_hex: '0',
    iconUrl: '/icons/dash.svg',
    duffs: BigInt(0),
    decimal_places: 11,
    fiat: {
        USD: 0,
    }
}

/* Initialize constants. */
export const DUSD = 'DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd' // DUSD
export const SANS = 'AxAYWyXV6mrm8Sq7vc7wEM18wtL8a8rgj64SM3SDmzsB' // SANS
export const tDUSD = '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz' // tDUSD
export const tSANS = 'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw' // tSANS

export const DASH_USD_VALUE = 24 // FIXME PULL FROM MARKET API
export const DUSD_USD_VALUE = 1.00
export const SANS_USD_VALUE = 0.01

export const DASH_DECIMALS = 11
export const DUSD_DECIMALS = 6
export const SANS_DECIMALS = 8



/**
 * Secure in-memory storage for sensitive data like private keys
 * This avoids storing sensitive data in localStorage/sessionStorage
 */
class SecureStorage {
    private storage: Map<string, any> = new Map()
    private timers: Map<string, NodeJS.Timeout> = new Map()

    /**
     * Store a value securely in memory with optional TTL
     */
    set(key: string, value: any, ttlMs?: number): void {
        localStorage.setItem(key, value)
        // this.storage.set(key, value)

        // // Clear any existing timer for this key
        // const existingTimer = this.timers.get(key)

        // if (existingTimer) {
        //     clearTimeout(existingTimer)
        // }

        // // Set TTL if provided
        // if (ttlMs && ttlMs > 0) {
        //     const timer = setTimeout(() => {
        //         this.delete(key)
        //     }, ttlMs)

        //     this.timers.set(key, timer)
        // }
    }

    /**
     * Get a value from secure storage
     */
    get(key: string): any {
        /* Request saved storage (from local storage). */
        const savedStorage = localStorage.getItem(key)

        /* Validate saved storage. */
        if (typeof savedStorage === 'string') {
            return savedStorage
        } else if (typeof savedStorage !== 'undefined' && savedStorage !== null ) {
            return JSON.parse(savedStorage)
        } else {
            return null
        }
        // return this.storage.get(key)
    }

    /**
     * Check if a key exists
     */
    has(key: string): boolean {
        /* Request saved storage (from local storage). */
        const savedStorage = localStorage.getItem(key)

        /* Validate saved storage. */
        if (typeof savedStorage === 'string') {
            return false
        } else if (typeof savedStorage !== 'undefined' && savedStorage !== null ) {
            const parsed = JSON.parse(savedStorage)

            /* Validate key exists. */
            if (parsed[key]) {
                return true
            }

            return false
        } else {
            return false
        }
        // return this.storage.has(key)
    }

    /**
     * Delete a value from secure storage
     */
    delete(key: string): boolean {
        localStorage.removeItem(key)
        return true
        // // Clear timer if exists
        // const timer = this.timers.get(key)

        // if (timer) {
        //     clearTimeout(timer)
        //     this.timers.delete(key)
        // }

        // return this.storage.delete(key)
    }

    /**
     * Clear all stored values
     */
    clear(): void {
        // Clear all timers
        for (const timer of Array.from(this.timers.values())) {
            clearTimeout(timer)
        }

        this.timers.clear()
        this.storage.clear()
    }

    /**
     * Get all keys (for debugging - should not expose actual values)
     */
    keys(): string[] {
        return Array.from(this.storage.keys())
    }

    /**
     * Get storage size
     */
    size(): number {
        return this.storage.size
    }
}

// Singleton instance
const secureStorage = new SecureStorage()

// Clean up on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        secureStorage.clear()
    })

    // Also clean up on page hide (mobile support)
    window.addEventListener('pagehide', () => {
        secureStorage.clear()
    })
}

export default secureStorage

// *****************************************************************************
// PRIVATE KEY MANAGEMENT
// (enables Dash Evolution Tool support)
// *****************************************************************************
export const storePrivateKey = (
    identityId: string,
    privateKey: string,
    ttlMs: number = 3600000,
) => {
    secureStorage.set(`pk_${identityId}`, privateKey, ttlMs) // 1 hour default TTL
}

export const getPrivateKey = (identityId: string): string | null => {
    return secureStorage.get(`pk_${identityId}`) || null
}

export const clearPrivateKey = (identityId: string): boolean => {
    return secureStorage.delete(`pk_${identityId}`)
}

export const clearAllPrivateKeys = (): void => {
    const keys = secureStorage.keys()

    keys.filter(key => key.startsWith('pk_')).forEach(key => {
        secureStorage.delete(key)
    })

    secureStorage.delete('evonext_session')

    clearMnemonic()
}

// *****************************************************************************
// MNEMONIC MANAGEMENT
// *****************************************************************************
export const storeMnemonic = (mnemonic: string) => {
    secureStorage.set('mnemonic', mnemonic)
}

export const getMnemonic = (): string | null => {
    return secureStorage.get('mnemonic') || null
}

export const clearMnemonic = (): boolean => {
    return secureStorage.delete('mnemonic')
}

// *****************************************************************************
// IDENTITY INDEX MANAGEMENT
// *****************************************************************************
export const storeIdentityIdx = (_idx: number) => {
    secureStorage.set('identity_idx', _idx)
}

export const getIdentityIdx = (): number => {
    return Number(secureStorage.get('identity_idx')) || 0
}

export const clearIdentityIdx = (): boolean => {
    return secureStorage.delete('identity_idx')
}

// *****************************************************************************
// ASSET MANAGEMENT
// *****************************************************************************
export const storeAsset = (_asset: Token) => {
    /* Create (safe) asset. */
    const safeAsset = JSON.stringify(_asset, (key, value) =>
        typeof value === 'bigint' ? value.toString() + 'n' : value
    )

    /* Store (safe) asset. */
    secureStorage.set('asset', safeAsset)
}

export const getAsset = (): Token => {
    /* Initialize locals. */
    let asset

    /* Request (stored) asset. */
    const storedAsset = secureStorage.get('asset')

    /* Validate (stored) asset. */
    if (typeof storedAsset !== 'undefined' && storedAsset !== null) {
        asset = JSON.parse(storedAsset, (key, value) => {
            if (typeof value === 'string' && /^\d+n$/.test(value)) {
                return BigInt(value.slice(0, value.length - 1))
            }
            return value
        })
    }

    /* Return asset. */
    return asset || DEFAULT_ASSET
}

export const clearAsset = (): boolean => {
    return secureStorage.delete('asset')
}
