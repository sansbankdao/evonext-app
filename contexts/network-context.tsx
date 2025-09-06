'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Network = 'mainnet' | 'testnet' | string | null;

interface NetworkContextType {
    active: Network;
    error: string | null;
}

const NetworkContext = createContext<NetworkContextType>({ active: null, error: null })

export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const [active, setActiveNetwork] = useState<Network>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const initializeNetwork = async () => {
            try {
                /* Set host. */
                const host = window.location.host

                /* Handle host. */
                switch(host) {
                case 'evonext.app':
                    setActiveNetwork('mainnet')
                    break
                case 'testnet.evonext.app':
                    setActiveNetwork('testnet')
                    break
                default:
                    setActiveNetwork(host)
                    break
                }
            } catch (err) {
                console.error('NetworkProvider: Failed to initialize WASM SDK:', err)
                setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
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
        <NetworkContext.Provider value={{ active, error }}>
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
