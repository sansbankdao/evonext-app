'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import { YAPPR_CONTRACT_ID } from '@/lib/constants'

interface NetworkContextType {
    isReady: boolean
    error: string | null
}

const NetworkContext = createContext<NetworkContextType>({ isReady: false, error: null })

export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const initializeNetwork = async () => {
            try {
                console.log('NetworkProvider: Starting WASM SDK initialization for testnet...')

                // Initialize with testnet configuration
                await wasmSdkService.initialize({
                    network: 'testnet',
                    contractId: YAPPR_CONTRACT_ID
                })

                setIsReady(true)
                console.log('NetworkProvider: WASM SDK initialized successfully, isReady = true')
            } catch (err) {
                console.error('NetworkProvider: Failed to initialize WASM SDK:', err)
                setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
                // Still set isReady to false explicitly
                setIsReady(false)
            }
        }

        // Only initialize in browser
        if (typeof window !== 'undefined') {
            console.log('NetworkProvider: Running in browser, starting initialization...')
            initializeNetwork()
        } else {
            console.log('NetworkProvider: Not in browser, skipping initialization')
        }
    }, [])

    return (
        <NetworkContext.Provider value={{ isReady, error }}>
            {children}
        </NetworkContext.Provider>
    )
}

export function useNetwork() {
    const context = useContext(NetworkContext)

    if (!context) {
        throw new Error('useNetwork must be used within NetworkProvider')
    }

    return context
}
