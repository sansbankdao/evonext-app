'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
// import { useNetwork } from './network-context'
import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'

interface SdkContextType {
    isReady: boolean
    error: string | null
    /* F57 Phase 1 — the engine initializes ON DEMAND: consumers call
     * ensureReady() when they actually need the wasm SDK (the registrar /
     * username modals, the test page). There is NO eager init on mount:
     * the wasm SDK's trusted context must not be constructed for page
     * loads that never touch it (the dashboard's reads are trustless
     * now — docs/HANDOFF-F57-PHASE1.md). Single-flight: concurrent
     * callers share one initialize; a FAILURE clears the flight so a
     * later caller retries. */
    ensureReady: () => Promise<boolean>
}

const SdkContext = createContext<SdkContextType>({
    isReady: false,
    error: null,
    ensureReady: async () => false,
})

export function SdkProvider({ children }: { children: React.ReactNode }) {
    // const { network } = useNetwork()
    const [isReady, setIsReady] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const ensureReadyRef = useRef<Promise<boolean> | null>(null)

    const ensureReady = useCallback((): Promise<boolean> => {
        if (ensureReadyRef.current) return ensureReadyRef.current

        const run = (async () => {
            try {
                /* Set host. */
                const host = window.location.host

                /* Initialize locals. */
                let contractId
                let network

                /* Handle host. */
                // FIXME Handle mainnet for localhost and IPFS.
                switch (host) {
                case 'evonext.app':
                    network = 'mainnet'
                    break
                default:
                    network = 'testnet'
                    break
                }

                /* Handle network. */
                if (network === 'mainnet') {
                    contractId = EVONEXT_CONTRACT_ID_MAINNET
                } else {
                    contractId = EVONEXT_CONTRACT_ID_TESTNET
                }

                await wasmSdkService.initialize({
                    network: (network as 'mainnet' | 'testnet'),
                    contractId,
                })

                setIsReady(true)
                return true
            } catch (err) {
                console.error('SdkProvider: Failed to initialize WASM SDK:', err)
                setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
                // Still set isReady to false explicitly
                setIsReady(false)
                /* Allow a later caller to retry (the F57 init ladder may
                 * recover the discovery endpoint). */
                ensureReadyRef.current = null
                return false
            }
        })()

        ensureReadyRef.current = run
        return run
    }, [])

    /* F57 Phase 1: the eager mount-time initialization is GONE — the
     * engine is constructed only when a consumer asks for it. */
    useEffect(() => {
        // No eager initialization on mount.
    }, [])

    return (
        <SdkContext.Provider value={{ isReady, error, ensureReady }}>
            {children}
        </SdkContext.Provider>
    )
}

export const useSdk = () => useContext(SdkContext)
