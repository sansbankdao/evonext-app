'use client'

// Import the WASM SDK functions we need
import {
    identity_fetch,
    get_documents
} from './dash-wasm/wasm_sdk'

// Import the centralized WASM service
import { wasmSdkService } from './services/wasm-sdk-service'

type Network = 'mainnet' | 'testnet' | string | null;

interface NetworkContextType {
    active: Network;
    error: string | null;
}

/**
 * Get Network
 *
 * Returns the currently active network:
 *   - mainnet
 *   - testnet
 *   - localhost (NOT YET SUPPORTED)
 * @returns
 */
const getNetwork = () => {
    /* Set host. */
    const host = window.location.host

    /* Initialize locals. */
    let network

    /* Handle host. */
// FIXME Handle mainnet for localhost and IPFS.
    switch(host) {
    case 'evonext.app':
        network = 'mainnet'
        break
    default:
        network = 'testnet'
        break
    }

    /* Return network. */
    return network
}

export class DashPlatformClient {
    private sdk: any = null
    // private network: string | null = null
    private contractId: string | null = null
    private identityId: string | null = null
    private isInitializing: boolean = false
    private postsCache: Map<string, { posts: any[], timestamp: number }> = new Map()
    private readonly CACHE_TTL = 30000 // 30 seconds for posts cache
    private pendingQueries: Map<string, Promise<any[]>> = new Map() // Prevent duplicate queries

    constructor(_contractId: string) {
console.log('DPC CONSTRUCTING (contract ID)', _contractId)
        // SDK will be initialized on first use
        this.contractId = _contractId
    }

    /**
     * Initialize the SDK using the centralized WASM service
     */
    public async ensureInitialized() {
        if (this.sdk || this.isInitializing) {
            // Already initialized or initializing
            while (this.isInitializing) {
                // Wait for initialization to complete
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            return
        }

        this.isInitializing = true

        try {
            // Use the centralized WASM service
            const localNetwork = (getNetwork() as 'mainnet' | 'testnet')  || 'testnet'
console.log('CONTRACT ID', this.contractId)
            console.log('DashPlatformClient: Initializing via WasmSdkService for network:', getNetwork())

            // Initialize the WASM SDK service if not already done
            await wasmSdkService.initialize({
                network: localNetwork,
                contractId: this.contractId!,
            })

            // Get the SDK instance
            this.sdk = await wasmSdkService.getSdk()

            console.log('DashPlatformClient: WASM SDK initialized successfully via service')
        } catch (error) {
            console.error('DashPlatformClient: Failed to initialize WASM SDK:', error)
            throw error
        } finally {
            this.isInitializing = false
        }
    }

    /**
     * Set the identity ID for document operations
     * This is called by the auth system after identity verification
     */
    setIdentity(identityId: string) {
        this.identityId = identityId
        console.log('DashPlatformClient: Identity set to:', identityId)
    }

    /**
     * Create a post document
     */
    async createPost(
        content: string,
        options?: {
            replyToPostId?: string
            mediaUrl?: string
            primaryHashtag?: string
        }
    ) {
        // Get identity ID from instance or auth context
        let identityId = this.identityId

        if (!identityId) {
            // Try to get from auth context via user session
            if (typeof window !== 'undefined') {
                const savedSession = localStorage.getItem('evonext_session')

                if (savedSession) {
                    try {
                        const sessionData = JSON.parse(savedSession)

                        identityId = sessionData.user?.identityId

                        if (identityId) {
                            // Set it for future use
                            this.identityId = identityId
                            console.log('DashPlatformClient: Identity restored from session:', identityId)
                        }
                    } catch (e) {
                        console.error('Failed to parse session data:', e)
                    }
                }
            }
        }

        if (!identityId) {
            throw new Error('Not logged in - no identity found')
        }

        try {
            await this.ensureInitialized()

            console.log('Creating post for identity:', identityId)

            // Get the private key from secure storage (with biometric fallback)
            const { getPrivateKey } = await import('./secure-storage')

            let privateKeyWIF = getPrivateKey(identityId)

            // If not in memory, try biometric storage
            if (!privateKeyWIF) {
                try {
                    console.log('Private key not in memory, attempting biometric retrieval...')

                    const { getPrivateKeyWithBiometric } = await import('./biometric-storage')

                    privateKeyWIF = await getPrivateKeyWithBiometric(identityId)

                    if (privateKeyWIF) {
                        console.log('Retrieved private key with biometric authentication')
                        // Also store in memory for this session to avoid repeated biometric prompts
                        const { storePrivateKey } = await import('./secure-storage')

                        storePrivateKey(identityId, privateKeyWIF, 3600000) // 1 hour TTL
                    }
                } catch (e) {
                    console.log('Biometric retrieval failed:', e)
                }
            }

            if (!privateKeyWIF) {
                throw new Error('Private key not found. Please log in again.')
            }

            // Private key retrieved successfully

            // Create the post document using WASM SDK
            // Note: The actual contract doesn't have authorId - it uses $ownerId system field
            const postData: any = {
                content: content.trim()
            }

            // Convert replyToPostId if provided
            if (options?.replyToPostId) {
                try {
                    const bs58Module = await import('bs58')
                    const bs58 = bs58Module.default

                    postData.replyToPostId = Array.from(bs58.decode(options.replyToPostId))
                } catch (e) {
                    console.error('Failed to decode replyToPostId:', e)
                    throw new Error('Invalid reply post ID format')
                }
            }

            // Add other optional fields
            if (options?.mediaUrl) {
                postData.mediaUrl = options.mediaUrl
            }

            if (options?.primaryHashtag) {
                postData.primaryHashtag = options.primaryHashtag.replace('#', '')
            }

            // Add language (defaults to 'en' in the contract, but let's be explicit)
            postData.language = 'en'

            // Add sensitive content flag
            postData.isSensitive = false

            console.log('Creating post with data:', postData)

            // Generate entropy (32 bytes)
            const entropy = new Uint8Array(32)

            crypto.getRandomValues(entropy)

            const entropyHex = Array.from(entropy)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')

            // Create the document using the SDK
            let result
console.log('DOCUMENT CREATE', {
    contractId: this.contractId,
    identityId,
    postData,
    entropyHex,
    privateKeyWIF
})
            try {
                result = await this.sdk.documentCreate(
                    this.contractId,
                    'post',
                    identityId,
                    JSON.stringify(postData),
                    entropyHex,
                    privateKeyWIF
                )
            } catch (sdkError) {
                console.error('SDK documentCreate error:', sdkError)
                console.error('Error type:', typeof sdkError)
                console.error('Error details:', {
                    message: sdkError instanceof Error ? sdkError.message : String(sdkError),
                    stack: sdkError instanceof Error ? sdkError.stack : undefined,
                    keys: sdkError && typeof sdkError === 'object' ? Object.keys(sdkError) : []
                })

                throw sdkError
            }

            console.log('Post created successfully!')

            // Check if we got a valid result
            if (!result) {
                console.error('WASM SDK returned undefined/null result')
                throw new Error('Post creation failed - no result returned from SDK')
            }

            // Invalidate posts cache since we created a new post
            this.postsCache.clear()

            // Convert result if needed
            if (result && typeof result.toJSON === 'function') {
                return result.toJSON()
            }

            return result
        } catch (error) {
            console.error('Failed to create post:', error)
            throw error
        }
    }

    /**
     * Get user profile
     */
    async getUserProfile(
        // network: string,
        contractId: string,
        identityId: string,
    ) {
        try {
            await this.ensureInitialized()

            console.log('Fetching profile for identity:', identityId)

            // Query profile document for this identity
            const query = {
                where: [
                    ['$ownerId', '==', identityId]
                ],
                limit: 1
            }

            const profileResponse = await get_documents(
                this.sdk,
                contractId,
                'profile',
                JSON.stringify(query.where),
                null,
                query.limit,
                null,
                null
            )

            console.log('Profile query response:', profileResponse)

            // Convert response if needed
            let profiles

            if (profileResponse && typeof profileResponse.toJSON === 'function') {
                profiles = profileResponse.toJSON()
            } else {
                profiles = profileResponse
            }

            console.log('Profiles found:', profiles)

            if (profiles && profiles.length > 0) {
                return profiles[0]
            }

            return null
        } catch (error) {
            console.error('Failed to fetch profile:', error)
            // Return null if profile doesn't exist

            return null
        }
    }

    /**
     * Query posts with caching
     */
    async queryPosts(
        options?: {
            limit?: number
            startAfter?: any
            authorId?: string
            forceRefresh?: boolean
        }
    ) {
        try {
            // Create cache key based on options
            const cacheKey = JSON.stringify({
                limit: options?.limit || 20,
                authorId: options?.authorId,
                startAfter: options?.startAfter
            })

            // Check if there's already a pending query for this exact request
            if (!options?.forceRefresh && this.pendingQueries.has(cacheKey)) {
                console.log('DashPlatformClient: Returning pending query result')
                return await this.pendingQueries.get(cacheKey)!
            }

            // Check cache first (unless force refresh)
            if (!options?.forceRefresh) {
                const cached = this.postsCache.get(cacheKey)

                if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                    console.log('DashPlatformClient: Returning cached posts')
                    return cached.posts
                }
            }

            await this.ensureInitialized()

            console.log('DashPlatformClient: Querying posts from contract:', this.contractId)

            // Create the query promise and store it to prevent duplicates
            const queryPromise = this._executePostsQuery(options, cacheKey)

            this.pendingQueries.set(cacheKey, queryPromise)

            try {
                const result = await queryPromise

                return result
            } finally {
                // Clean up the pending query
                this.pendingQueries.delete(cacheKey)
            }
        } catch (error) {
            console.error('DashPlatformClient: Failed to query posts:', error)
            throw error
        }
    }

    /**
     * Execute the actual posts query (separated to allow proper pending query management)
     */
    private async _executePostsQuery(
        options: any,
        cacheKey: string,
    ): Promise<any[]> {
        try {
            // Build where clause
            const where: any[] = []

            if (options?.authorId) {
                // Query by $ownerId (system field)
                where.push(['$ownerId', '==', options.authorId])
            }

            // Build order by clause - most recent first
            const orderBy = [['$createdAt', 'desc']]

            try {
                const postsResponse = await get_documents(
                    this.sdk,
                    this.contractId!,
                    'post',
                    where.length > 0 ? JSON.stringify(where) : null,
                    JSON.stringify(orderBy),
                    options?.limit || 20,
                    options?.startAfter || null,
                    null // startAt
                )

                console.log('DashPlatformClient: Posts query response received')

                // Convert response if needed
                let posts

                if (postsResponse && typeof postsResponse.toJSON === 'function') {
                    posts = postsResponse.toJSON()
                } else if (postsResponse && postsResponse.documents) {
                    posts = postsResponse.documents
                } else {
                    posts = postsResponse || []
                }

                console.log(`DashPlatformClient: Found ${posts.length} posts`)

                // Cache the results
                this.postsCache.set(cacheKey, {
                    posts,
                    timestamp: Date.now()
                })

                return posts
            } catch (queryError) {
                console.log('DashPlatformClient: Document query failed, this may be expected for new contracts:', queryError)

                // For contract-related errors, return empty array instead of throwing
                const errorMessage = queryError instanceof Error ? queryError.message : String(queryError)
                if (errorMessage.includes('contract') || errorMessage.includes('Contract') ||
                    errorMessage.includes('not found') || errorMessage.includes('Not found')) {
                    console.log('DashPlatformClient: Contract-related error, returning empty posts array')

                    return []
                }

                // Re-throw other errors
                throw queryError
            }
        } catch (error) {
            console.error('DashPlatformClient: Failed to query posts:', error)
            throw error
        }
    }

    /**
     * Clear the posts cache and pending queries
     */
    clearPostsCache() {
        this.postsCache.clear()
        this.pendingQueries.clear()
        console.log('DashPlatformClient: Posts cache and pending queries cleared')
    }

    /**
     * Get key type name
     */
    private getKeyTypeName(type: number): string {
        const types = [
            'ECDSA_SECP256K1',
            'BLS12_381',
            'ECDSA_HASH160',
            'BIP13_SCRIPT_HASH',
            'EDDSA_25519_HASH160'
        ]

        return types[type] || 'UNKNOWN'
    }

    /**
     * Get key purpose name
     */
    private getKeyPurposeName(purpose: number): string {
        const purposes = [
            'AUTHENTICATION',
            'ENCRYPTION',
            'DECRYPTION',
            'TRANSPORT',
            'SYSTEM',
            'VOTING'
        ]

        return purposes[purpose] || 'UNKNOWN'
    }

    /**
     * Get security level name
     */
    private getSecurityLevelName(level: number): string {
        const levels = [
            'MASTER',
            'CRITICAL',
            'HIGH',
            'MEDIUM',
            'LOW'
        ]

        return levels[level] || 'UNKNOWN'
    }
}

// Singleton instance
let dashClient: DashPlatformClient | null = null

export function getDashPlatformClient(
    // _network: string,
    _contractId: string,
): DashPlatformClient {
    if (!dashClient) {
        dashClient = new DashPlatformClient(_contractId)
    }

    return dashClient
}

// Reset the client (useful for handling errors)
export function resetDashPlatformClient(): void {
    if (dashClient) {
        dashClient = null
    }
}
