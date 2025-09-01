'use client'

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
        this.storage.set(key, value)

        // Clear any existing timer for this key
        const existingTimer = this.timers.get(key)

        if (existingTimer) {
            clearTimeout(existingTimer)
        }

        // Set TTL if provided
        if (ttlMs && ttlMs > 0) {
            const timer = setTimeout(() => {
                this.delete(key)
            }, ttlMs)

            this.timers.set(key, timer)
        }
    }

    /**
     * Get a value from secure storage
     */
    get(key: string): any {
        return this.storage.get(key)
    }

    /**
     * Check if a key exists
     */
    has(key: string): boolean {
        return this.storage.has(key)
    }

    /**
     * Delete a value from secure storage
     */
    delete(key: string): boolean {
        // Clear timer if exists
        const timer = this.timers.get(key)

        if (timer) {
            clearTimeout(timer)
            this.timers.delete(key)
        }

        return this.storage.delete(key)
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

// Helper functions for common use cases
export const storePrivateKey = (identityId: string, privateKey: string, ttlMs: number = 3600000) => {
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
}
