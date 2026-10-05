// test/unit/services/post-service.test.ts

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { IPost, IUser } from '@/lib/types'
import type { Mock } from 'vitest'  // For typing mocks

// Helper to flush promises in test env
const flushPromises = () => new Promise(resolve => setImmediate(resolve))

// Mock profile-service
vi.mock('@/lib/services/profile-service', () => {
    // NOTE: post-service calls `new ProfileService(...)`, so this mock MUST be
    // constructable. Use a regular function (not an arrow function) as the
    // implementation; a constructor returning an object yields that object.
    const MockProfileServiceConstructor = vi.fn(function (this: any, contractId: string) {
        return {
            getProfile: vi.fn().mockResolvedValue({
                id: 'dynamic-mock-user',
                docId: 'dynamic-mock-doc',
                username: 'dynamic-testuser',
                displayName: 'Dynamic Test User',
                avatar: 'https://example.com/dynamic-avatar.jpg',
                avatarId: 'dynamic-mock-avatar',
                bio: 'Dynamic test bio',
                followers: 20,
                following: 15,
                verified: false,
                joinedAt: new Date(),
                revision: 2,
            } as IUser),
        }
    })

    const mockProfileInstance = {
        getProfile: vi.fn(),  // Empty mock to verify not called
    }

    return { ProfileService: MockProfileServiceConstructor, profileService: mockProfileInstance }
})

// Mock like-service (for countLikes)
vi.mock('@/lib/services/like-service', () => ({
    likeService: { countLikes: vi.fn().mockResolvedValue(5) },
}))

// Mock remix-service (for countRemixes)
vi.mock('@/lib/services/remix-service', () => ({
    remixService: { countRemixes: vi.fn().mockResolvedValue(2) },
}))

// No reply-service mock needed—replies are counted via get_documents on the
// separate 'reply' document type.

// Mock the WASM layer used by countReplies' dynamic imports (queries the
// 'reply' document type through get_documents; default: no replies).
vi.mock('@/lib/services/wasm-sdk-service', () => ({
    getWasmSdk: vi.fn().mockResolvedValue({}),
    wasmSdkService: { getSdk: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@/lib/dash-wasm/compat', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/dash-wasm/compat')>()
    return {
        ...actual,
        get_documents: vi.fn().mockResolvedValue([]),
    }
})

// Mock identity-service
vi.mock('@/lib/services/identity-service', () => ({
    identityService: { getCurrentIdentity: vi.fn().mockResolvedValue({ id: 'current-user' }) },
}))

// Mock BaseDocumentService
vi.mock('@/lib/services/document-service', () => {
    class MockBaseDocumentService {
        constructor(public contractId: string, public documentType: string) {}
        query = vi.fn().mockResolvedValue({ documents: [], nextCursor: null, prevCursor: null })
        create = vi.fn().mockResolvedValue({ $id: 'mock-doc-id', $ownerId: 'mock-owner', ownerId: 'mock-owner', $createdAt: Date.now() })
        get = vi.fn().mockImplementation(async (id: string) => ({ $id: id, ownerId: 'mock-owner', content: 'Mock reply content', $createdAt: Date.now(), mediaUrl: undefined }))
    }
    return { BaseDocumentService: MockBaseDocumentService as any, QueryOptions: {}, DocumentResult: { documents: [], nextCursor: null, prevCursor: null } as any }
})

// Mock constants (used by internal getContractId)
vi.mock('@/lib/constants', () => ({
    EVONEXT_CONTRACT_ID_TESTNET: 'mock-contract-id',
    EVONEXT_CONTRACT_ID_MAINNET: 'mock-main-contract-id',
}))

// Mock post-service module (preserve singleton, no non-exported additions to avoid TS errors)
vi.mock('@/lib/services/post-service', async () => {
    const actual = await vi.importActual<typeof import('@/lib/services/post-service')>('@/lib/services/post-service')
    return actual
})

let postService: any
let ProfileService: any
let profileServiceSingleton: any

describe('postService', () => {
    beforeAll(async () => {
        const profileModule = await import('@/lib/services/profile-service')
        ProfileService = profileModule.ProfileService
        profileServiceSingleton = profileModule.profileService

        const postModule = await import('@/lib/services/post-service')
        postService = postModule.postService
    })

    beforeEach(async () => {
        vi.clearAllMocks()
        postService.statsCache.clear()

        // FIXED: Mock window.location to prevent crash in internal getNetwork ('localhost' → 'testnet')
        Object.defineProperty(globalThis, 'window', {
            value: {
                location: { host: 'localhost' },  // Triggers 'testnet' in source switch
            },
            writable: true,
        })

        // Re-apply dynamic import mocks after clearAllMocks (for stats test)
        await import('@/lib/services/like-service')
        await import('@/lib/services/remix-service')
        // Pre-import the WASM layer modules used by countReplies' dynamic
        // imports so their vi.mock factories are resolved before use.
        await import('@/lib/services/wasm-sdk-service')
        await import('@/lib/dash-wasm/compat')
    })

    it('should create a post document correctly', async () => {
        const mockOwnerId = 'mock-user-id'
        const mockContent = 'Hello World'
        const mockOptions = { mediaUrl: 'https://example.com/image.jpg' }

        const mockRawDoc = {
            $id: 'new-post-id',
            $ownerId: mockOwnerId,
            ownerId: mockOwnerId,
            content: mockContent,
            $createdAt: Date.now(),
            mediaUrl: mockOptions.mediaUrl,
        } as any

        // Source: createPost calls create, then transformDocument (which enriches async)
        vi.spyOn(postService, 'create').mockResolvedValue(mockRawDoc)

        const result = await postService.createPost(mockOwnerId, mockContent, undefined, mockOptions)

        expect(postService.create).toHaveBeenCalledWith(mockOwnerId, {
            content: mockContent,
            mediaUrl: mockOptions.mediaUrl,
            // Yappr post schema: language and sensitive are required fields.
            language: 'en',
            sensitive: false,
        })
        // NOTE: `create` is mocked to return a raw document (no transform), so
        // the result matches that raw shape, not a transformed IPost.
        expect(result).toHaveProperty('$id', 'new-post-id')
        expect(result).toHaveProperty('content', mockContent)
    })

    it('should get user posts with proper query options', async () => {
        const mockUserId = 'user-456'
        const mockRawDocs = [
            {
                $id: 'post-1',
                $ownerId: mockUserId,
                ownerId: mockUserId,
                content: 'User post',
                $createdAt: Date.now(),
            },
        ]

        const mockQueryResponse = {
            documents: mockRawDocs,
            nextCursor: null,
            prevCursor: null,
        }
        vi.spyOn(postService, 'query').mockResolvedValue(mockQueryResponse)

        const result = await postService.getUserPosts(mockUserId, { limit: 10 })

        expect(postService.query).toHaveBeenCalledWith({
            // ownerAndTime index [$ownerId, $createdAt]
            where: [['$ownerId', '==', mockUserId], ['$createdAt', '>', 0]],
            orderBy: [['$ownerId', 'asc'], ['$createdAt', 'desc']],
            limit: 10,
        })
        expect(result.documents).toHaveLength(1)
        expect(result.documents[0].content).toBe('User post')
    })

    it('should handle profileService correctly in enrichment (singleton vs new)', async () => {
        const mockOwnerId = 'test-owner'
        const mockRawDoc = {
            $id: 'test-post',
            $ownerId: mockOwnerId,
            ownerId: mockOwnerId,
            content: 'Test post',
            $createdAt: Date.now(),
            mediaUrl: undefined,
            replyToId: undefined,
            quotedPostId: undefined,
        } as any

        // Mock get to return empty for replyTo/quoted (not present)
        vi.spyOn(postService, 'get' as any).mockResolvedValue(null)

        // Mock interactions
        vi.spyOn(postService, 'getUserInteractions' as any).mockResolvedValue({
            liked: false, remixed: false, bookmarked: false,
        })

        // Mock query for countRemixes (part of stats). countReplies no
        // longer uses query — it reads the separate 'reply' type via the
        // mocked compat get_documents (returns [] by default).
        vi.spyOn(postService, 'query' as any).mockResolvedValue({
            documents: [],
            nextCursor: null,
            prevCursor: null,
        })

        // Transform triggers enrichPost asynchronously (fire-and-forget)
        const post = postService.transformDocument(mockRawDoc)

        // FIXED: Flush promises and wait for enrichment chain to complete (internal getNetwork → getContractId → ProfileService → getProfile → getPostStats → dynamic imports)
        await flushPromises()
        await vi.waitFor(() => {
            expect(post.likes).toBe(5)  // Side-effect: stats set when enrichment completes
        }, { timeout: 200 })
        await flushPromises()  // Drain any remaining microtasks

        // Internal flow: getNetwork() ('localhost' → 'testnet') → getContractId('testnet') → 'mock-contract-id' (from constants)
        // Verify new ProfileService called (not singleton)
        expect(ProfileService as any).toHaveBeenCalledTimes(1)
        expect(ProfileService as any).toHaveBeenCalledWith('mock-contract-id')

        // Verify getProfile called on instance
        const mockInstance = (ProfileService as any).mock.results[0]?.value as { getProfile: Mock }
        expect(mockInstance.getProfile).toHaveBeenCalledWith(mockOwnerId)

        // Singleton not used (source: new ProfileService, not profileService)
        expect(profileServiceSingleton.getProfile).not.toHaveBeenCalled()

        // Post enriched with async profile data
        expect(post.author.username).toBe('dynamic-testuser')
        expect(post.author.displayName).toBe('Dynamic Test User')

        // Stats from dynamic imports (mocks): likes via likeService.countLikes,
        // remixes via the empty query mock (countRemixes), replies via the
        // empty get_documents mock (countReplies).
        expect(post.likes).toBe(5)
        expect(post.remixes).toBe(0)
        expect(post.replies).toBe(0)
        expect(post.views).toBe(0)
    })

    it('should fall back to default user when profile fetch fails', async () => {
        const mockOwnerId = 'unknown-user'
        const mockRawDoc = {
            $id: 'post-no-profile',
            $ownerId: mockOwnerId,
            ownerId: mockOwnerId,
            content: 'No profile post',
            $createdAt: Date.now(),
            mediaUrl: undefined,
            replyToId: undefined,
            quotedPostId: undefined,
        } as any

        // Make profile fetch fail (reject). Use a regular function so `new`
        // works (see constructable-mock note above).
        ;(ProfileService as any).mockImplementation(function (contractId: string) {
            return {
                getProfile: vi.fn().mockRejectedValue(new Error('Profile not found')),
            }
        })

        // Mock get/interactions/query as above
        vi.spyOn(postService, 'get' as any).mockResolvedValue(null)
        vi.spyOn(postService, 'getUserInteractions' as any).mockResolvedValue({
            liked: false, remixed: false, bookmarked: false,
        })
        vi.spyOn(postService, 'query' as any).mockResolvedValue({  // For countReplies
            documents: [{ $id: 'fake-reply' }],
            nextCursor: null,
            prevCursor: null,
        })

        // Transform sets default author via getDefaultUser (sync), enrichPost runs async.
        const post = postService.transformDocument(mockRawDoc)

        // Flush and wait until the failing profile fetch has been attempted.
        await flushPromises()
        await vi.waitFor(() => {
            expect(ProfileService as any).toHaveBeenCalledTimes(1)
        }, { timeout: 1000 })
        await flushPromises()

        // Verify constructor called (internal flow runs, no crash)
        expect(ProfileService as any).toHaveBeenCalledWith('mock-contract-id')
        const failingInstance = (ProfileService as any).mock.results[0]?.value as { getProfile: Mock }
        expect(failingInstance.getProfile).toHaveBeenCalledWith(mockOwnerId)

        // Author remains default (from transformDocument.getDefaultUser; not overwritten on error)
        const expectedDefault = {
            id: mockOwnerId,
            docId: undefined,
            username: 'unknown-...',  // userId.substring(0,8) + '...'
            displayName: 'Unknown User',
            avatar: '',
            bio: '',
            followers: 0,
            following: 0,
            verified: false,
            joinedAt: expect.any(Date),
            revision: 0,
        }
        expect(post.author).toMatchObject(expectedDefault)

        // SOURCE BEHAVIOR (lib/services/post-service.ts:129-183): the whole
        // enrichment body shares one try/catch. A rejected getProfile jumps to
        // catch, so stats/interactions below it NEVER run and keep their
        // transformDocument defaults (all zero / false).
        expect(post.liked).toBe(false)
        expect(post.likes).toBe(0)
        expect(post.remixes).toBe(0)
        expect(post.replies).toBe(0)
        expect(post.views).toBe(0)
    })

    it('should handle post stats caching', async () => {
        const mockPostId = 'cached-post-789'

        // Re-apply mocks for dynamic imports after clearAllMocks (ensures resolution)
        const likeModule = await import('@/lib/services/like-service')
        const compat = await import('@/lib/dash-wasm/compat')

        // Cast to Mock for TS and re-set implementation (cleared by beforeEach)
        ;(likeModule.likeService.countLikes as unknown as Mock).mockResolvedValue(5)

        // Mock get_documents (countReplies) → 2 reply docs
        ;(compat.get_documents as unknown as Mock).mockResolvedValue([{}, {}])

        // Mock query for countRemixes → 1 quoting post
        vi.spyOn(postService, 'query' as any).mockResolvedValue({
            documents: [{ $id: 'quote-1' }],
            nextCursor: null,
            prevCursor: null,
        })

        // First call: Computes fresh (hits dynamic imports + query)
        const firstCall = await postService.getPostStats(mockPostId)
        expect(firstCall.likes).toBe(5)
        expect(likeModule.likeService.countLikes).toHaveBeenCalledWith(mockPostId)
        expect(firstCall.remixes).toBe(1)
        expect(postService.query).toHaveBeenCalledWith(expect.objectContaining({
            where: [['quotedPostId', '==', mockPostId]],
            orderBy: [['quotedPostId', 'asc'], ['$ownerId', 'asc']],
            limit: 100,  // Source: quotedPostAndOwner index query
        }))
        expect(firstCall.replies).toBe(2)
        expect(compat.get_documents).toHaveBeenCalledWith(
            expect.anything(), // sdk from getWasmSdk
            'mock-contract-id',
            'reply',
            JSON.stringify([['parentId', '==', mockPostId]]),
            JSON.stringify([['parentId', 'asc'], ['$createdAt', 'asc']]),
            100,
            null, // startAfter
            null  // startAt
        )
        expect(firstCall.views).toBe(0)

        // Second: Cache hit (within 10s, no re-fetch)
        vi.useFakeTimers()
        vi.advanceTimersByTime(5000)  // <10000ms
        const secondCall = await postService.getPostStats(mockPostId)
        expect(secondCall).toEqual(firstCall)
        expect(likeModule.likeService.countLikes).toHaveBeenCalledTimes(1)  // No re-call

        // Third: Cache miss (>10s), re-fetches
        vi.advanceTimersByTime(6000)  // Total >10000ms
        const thirdCall = await postService.getPostStats(mockPostId)
        expect(thirdCall).toEqual(firstCall)
        expect(likeModule.likeService.countLikes).toHaveBeenCalledTimes(2)  // Re-called
    })
})
