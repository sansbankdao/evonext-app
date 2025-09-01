'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import { YAPPR_CONTRACT_ID } from '@/lib/constants'

interface SdkContextType {
    isReady: boolean
    error: string | null
}

const SdkContext = createContext<SdkContextType>({ isReady: false, error: null })

export function SdkProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const initializeSdk = async () => {
            try {
                console.log('SdkProvider: Starting WASM SDK initialization for testnet...')

                // Initialize with testnet configuration
                await wasmSdkService.initialize({
                    network: 'testnet',
                    contractId: YAPPR_CONTRACT_ID
                })

                setIsReady(true)
                console.log('SdkProvider: WASM SDK initialized successfully, isReady = true')
            } catch (err) {
                console.error('SdkProvider: Failed to initialize WASM SDK:', err)
                setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
                // Still set isReady to false explicitly
                setIsReady(false)
            }
        }

        // Only initialize in browser
        if (typeof window !== 'undefined') {
            console.log('SdkProvider: Running in browser, starting initialization...')
            initializeSdk()
        } else {
            console.log('SdkProvider: Not in browser, skipping initialization')
        }
    }, [])

    return (
        <SdkContext.Provider value={{ isReady, error }}>
            {children}
        </SdkContext.Provider>
    )
}

export function useSdk() {
    const context = useContext(SdkContext)

    if (!context) {
        throw new Error('useSdk must be used within SdkProvider')
    }

    return context
}
