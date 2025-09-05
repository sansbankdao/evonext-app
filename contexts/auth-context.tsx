'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { YAPPR_CONTRACT_ID_ALT } from '@/lib/constants'

export interface AuthUser {
    identityId: string
    balance: number
    dpnsUsername?: string
    publicKeys: Array<{
        id: number
        type: string
        purpose: string
        securityLevel: string
    }>
}

interface AuthContextType {
    user: AuthUser | null
    isLoading: boolean
    error: string | null
    login: (identityId: string, privateKey: string, skipUsernameCheck?: boolean) => Promise<void>
    logout: () => void
    updateDPNSUsername: (username: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    // Check for saved session on mount
    useEffect(() => {
        const restoreSession = async () => {
            const savedSession = localStorage.getItem('yappr_session')

            if (savedSession) {
                try {
                    const sessionData = JSON.parse(savedSession)
                    const savedUser = sessionData.user

                    // Set user immediately with cached data
                    setUser(savedUser)

                    // Set identity in DashPlatformClient for document operations

                    try {
                        const { getDashPlatformClient } = await import('@/lib/dash-platform-client')
                        const dashClient = getDashPlatformClient()

                        dashClient.setIdentity(savedUser.identityId)
                        console.log('Auth: DashPlatformClient identity restored from session')
                    } catch (err) {
                        console.error('Auth: Failed to set DashPlatformClient identity:', err)
                    }

                    // If user doesn't have DPNS username, fetch it in background
                    if (savedUser && !savedUser.dpnsUsername) {
                        console.log('Auth: Fetching DPNS username in background...')

                        // Don't await - let it happen in background
                        import('@/lib/services/dpns-service').then(async ({ dpnsService }) => {
                            try {
                                const dpnsUsername = await dpnsService.resolveUsername(savedUser.identityId)

                                if (dpnsUsername) {
                                    console.log('Auth: Found DPNS username:', dpnsUsername)
                                    // Update user state

                                    setUser(prev => prev ? { ...prev, dpnsUsername } : prev)
                                    // Update saved session

                                    const updatedSession = { ...sessionData, user: { ...savedUser, dpnsUsername } }
                                    localStorage.setItem('yappr_session', JSON.stringify(updatedSession))
                                }
                            } catch (e) {
                                console.error('Auth: Background DPNS fetch failed:', e)
                            }
                        })
                    }
                } catch (e) {
                    console.error('Failed to restore session:', e)
                    localStorage.removeItem('yappr_session')
                }
            }
        }

        restoreSession()
    }, [])

    const login = useCallback(async (identityId: string, privateKey: string, skipUsernameCheck = false) => {
        setIsLoading(true)
        setError(null)

        try {
            // Validate inputs
            if (!identityId || !privateKey) {
                throw new Error('Identity ID and private key are required')
            }

            // Use the WASM SDK services
            const { identityService } = await import('@/lib/services/identity-service')
            const { wasmSdkService } = await import('@/lib/services/wasm-sdk-service')

            // Initialize SDK if needed
            await wasmSdkService.initialize({
                network: (process.env.NEXT_PUBLIC_NETWORK as 'testnet' | 'mainnet') || 'testnet',
                contractId: YAPPR_CONTRACT_ID_ALT
            })

            console.log('Fetching identity with WASM SDK...')
            const identityData = await identityService.getIdentity(identityId)

            if (!identityData) {
                throw new Error('Identity not found')
            }

            // Check for DPNS username
            const { dpnsService } = await import('@/lib/services/dpns-service')
            const dpnsUsername = await dpnsService.resolveUsername(identityData.id)

            const authUser: AuthUser = {
                identityId: identityData.id,
                balance: identityData.balance,
                dpnsUsername: dpnsUsername || undefined,
                publicKeys: identityData.publicKeys
            }

            // Save session (note: private key is not saved, only used for login)
            // Convert any BigInt values to numbers for JSON serialization
            const sessionData = {
                user: {
                    ...authUser,
                    balance: typeof authUser.balance === 'bigint' ? Number(authUser.balance) : authUser.balance
                },
                timestamp: Date.now()
            }

            localStorage.setItem('yappr_session', JSON.stringify(sessionData))

            // Store private key securely in memory for this session only
            // This is needed for signing transactions
            const { storePrivateKey } = await import('@/lib/secure-storage')

            storePrivateKey(identityId, privateKey, 3600000) // 1 hour TTL

            // Also try to store with biometric protection for longer-term access
            try {
                const { storePrivateKeyWithBiometric } = await import('@/lib/biometric-storage')
                const stored = await storePrivateKeyWithBiometric(identityId, privateKey)

                if (stored) {
                    console.log('Private key stored with biometric protection')
                }
            } catch (e) {
                console.log('Biometric storage not available:', e)
            }

            setUser(authUser)

            // Set identity in DashPlatformClient for document operations
            try {
                const { getDashPlatformClient } = await import('@/lib/dash-platform-client')
                const dashClient = getDashPlatformClient()

                dashClient.setIdentity(identityId)
            } catch (err) {
                console.error('Failed to set DashPlatformClient identity:', err)
            }

            // First check if user has DPNS username (unless skipped)
            console.log('Checking for DPNS username...')

            if (!authUser.dpnsUsername && !skipUsernameCheck) {
                console.log('No DPNS username found, opening username modal...')
                // Import and use the username modal store
                const { useUsernameModal } = await import('@/hooks/use-username-modal')
                useUsernameModal.getState().open(identityId)

                return
            }

            // Then check if user has a profile
            console.log('Checking for user profile...')
            const { profileService } = await import('@/lib/services/profile-service')
            const profile = await profileService.getProfile(identityId, authUser.dpnsUsername)

            if (profile) {
                console.log('Profile found, redirecting to home...')
                router.push('/')
            } else {
                console.log('No profile found, redirecting to profile creation...')
                router.push('/profile/create')
            }
        } catch (err) {
            console.error('Login error:', err)
            setError(err instanceof Error ? err.message : 'Failed to login')
            throw err
        } finally {
            setIsLoading(false)
        }
    }, [router])

    const logout = useCallback(async () => {
        localStorage.removeItem('yappr_session')
        sessionStorage.removeItem('yappr_dpns_username')
        sessionStorage.removeItem('yappr_skip_dpns')

        // Clear private key from secure storage
        if (user?.identityId) {
            const { clearPrivateKey } = await import('@/lib/secure-storage')
            clearPrivateKey(user.identityId)
        }

        setUser(null)

        // Clear DashPlatformClient identity
        import('@/lib/dash-platform-client').then(({ getDashPlatformClient }) => {
            const dashClient = getDashPlatformClient()
            dashClient.setIdentity('')
        })

        router.push('/connect')
    }, [router])

    const updateDPNSUsername = useCallback((username: string) => {
        if (user) {
            const updatedUser = { ...user, dpnsUsername: username }
            setUser(updatedUser)

            // Update session storage
            const savedSession = localStorage.getItem('yappr_session')

            if (savedSession) {
                try {
                    const sessionData = JSON.parse(savedSession)
                    sessionData.user.dpnsUsername = username
                    localStorage.setItem('yappr_session', JSON.stringify(sessionData))
                } catch (e) {
                    console.error('Failed to update session:', e)
                }
            }
        }
    }, [user])

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            error,
            login,
            logout,
            updateDPNSUsername
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }

    return context
}

// HOC for protecting routes
export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    options?: {
        allowWithoutProfile?: boolean
        allowWithoutDPNS?: boolean
        optional?: boolean  // Allow access without authentication
    }
) {
    return function AuthenticatedComponent(props: P) {
        const { user } = useAuth()
        const router = useRouter()

        useEffect(() => {
            console.log('withAuth check - user:', user)

            if (!user) {
                if (options?.optional) {
                    console.log('No user found, but auth is optional - continuing...')
                    return
                }

                console.log('No user found, redirecting to login...')
                router.push('/connect')

                return
            }

            // Check if user has DPNS username (unless explicitly allowed without)
            const skipDPNS = sessionStorage.getItem('yappr_skip_dpns') === 'true'

            if (!options?.allowWithoutDPNS && !user.dpnsUsername && !skipDPNS) {
                console.log('No DPNS username found, redirecting to DPNS registration...')
                router.push('/claim')

                return
            }
        }, [user, router])

        if (!user) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
            )
        }

        // If DPNS is required but not present, show loading (redirect will happen)
        const skipDPNS = sessionStorage.getItem('yappr_skip_dpns') === 'true'

        if (!options?.allowWithoutDPNS && !user.dpnsUsername && !skipDPNS) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
            )
        }

        return <Component {...props} />
    }
}
