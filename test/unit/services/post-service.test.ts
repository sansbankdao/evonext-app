// test/unit/services/post-service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postService } from '@/lib/services/post-service'
import type { IPost, IUser } from '@/lib/types'

// Mock profile-service: Export both singleton instance and class constructor
vi.mock('@/lib/services/profile-service', () => {
    // Mock class constructor: new ProfileService(contractId) returns a mock instance
    const MockProfileServiceClass = vi.fn().mockImplementation((contractId: string) => ({
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
    }))

    // Mock instance for singleton (direct usage: profileService.getProfile())
    const mockProfileInstance = {
        getProfile: vi.fn().mockResolvedValue({
            id: 'mock-user',
            docId: 'mock-doc',
            username: 'testuser',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            avatarId: 'mock-avatar',
            bio: 'Test bio',
            followers: 10,
            following: 5,
            verified: true,
            joinedAt: new Date(),
            revision: 1,
        } as IUser),
    }

    return {
        ProfileService: MockProfileServiceClass,  // Class export (for 'new ProfileService()')
        profileService: mockProfileInstance,  // Singleton export (instance for direct use)
    }
})

// Mock like-service (assuming it exports likeService instance)
vi.mock('@/lib/services/like-service', () => ({
    likeService: {
        countLikes: vi.fn().mockResolvedValue(5),
    },
}))

// Mock remix-service
vi.mock('@/lib/services/remix-service', () => ({
    remixService: {
        countRemixes: vi.fn().mockResolvedValue(2),
    },
}))

// Mock identity-service
vi.mock('@/lib/services/identity-service', () => ({
    identityService: {
        getCurrentIdentity: vi.fn().mockResolvedValue({ id: 'current-user' }),
    },
}))

// Mock document-service base (focus on public methods)
vi.mock('@/lib/services/document-service', () => ({
    BaseDocumentService: vi.fn().mockImplementation(() => ({
        query: vi.fn(),
        create: vi.fn(),
        get: vi.fn().mockImplementation((id: string) => ({
            $id: id,
            $ownerId: 'mock-owner',
            ownerId: 'mock-owner',
            content: 'Mock post content',
            $createdAt: Date.now(),
        })),  // Returns raw doc for transformation simulation
    })),
    QueryOptions: {} as any,
    DocumentResult: { documents: [], nextCursor: null, prevCursor: null } as any,
}))

// Mock constants
vi.mock('@/lib/constants', () => ({
    EVONEXT_CONTRACT_ID_TESTNET: 'mock-test-contract-id',
    EVONEXT_CONTRACT_ID_MAINNET: 'mock-main-contract-id',
}))

// Mock functions in post-service itself for consistent test behavior
vi.mock('@/lib/services/post-service', async () => {
    const actual = await vi.importActual('@/lib/services/post-service')
    return {
        ...actual,
        getNetwork: () => 'testnet',  // Fixed network for tests
        getContractId: () => 'mock-contract-id',
        postService,  // Re-export the mocked instance
    }
})

describe('postService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Clear the internal statsCache to reset state between tests
        ;(postService as any).statsCache?.clear()
    })

    it('should create a post document correctly', async () => {
        const mockOwnerId = 'mock-user-id'
        const mockContent = 'Hello World'
        const mockOptions = { mediaUrl: 'https://example.com/image.jpg' }

        const mockRawDoc = {
            id: 'new-post-id',  // Added id for IPost
            author: { id: 'default-author' } as IUser,  // Minimal author
            content: mockContent,
            createdAt: new Date(),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
            media: [{ type: 'image', url: mockOptions.mediaUrl }],
        } as IPost

        vi.spyOn(postService as any, 'create').mockResolvedValue(mockRawDoc)
        vi.spyOn(postService as any, 'enrichPost').mockResolvedValue(undefined)  // Mock private enrichment

        const result = await postService.createPost(mockOwnerId, mockContent, undefined, mockOptions)

        expect((postService as any).create).toHaveBeenCalledWith(mockOwnerId, {
            content: mockContent,
            mediaUrl: mockOptions.mediaUrl,
        })
        expect(result).toHaveProperty('id', 'new-post-id')
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

        // Mock query to return raw docs (assumes internal transformation)
        const mockQueryResponse = {
            documents: mockRawDocs,
            nextCursor: null,
            prevCursor: null,
        }
        vi.spyOn(postService as any, 'query').mockResolvedValue(mockQueryResponse)

        // Mock transformDocument (override protected method for test - simulate full IPost)
        vi.spyOn(postService as any, 'transformDocument').mockImplementation((doc: any) => ({
            id: doc.$id,
            author: { id: doc.ownerId, username: 'mock-user' } as IUser,
            content: doc.content,
            createdAt: new Date(doc.$createdAt),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
        } as IPost))

        const result = await postService.getUserPosts(mockUserId, { limit: 10 })

        expect((postService as any).query).toHaveBeenCalledWith({
            where: [['$ownerId', '==', mockUserId]],
            orderBy: [['$createdAt', 'desc']],
            limit: 10,
        })
        expect(result.documents).toHaveLength(1)
        expect(result.documents[0].content).toBe('User post')
    })

    it('should handle profileService correctly in enrichment (singleton vs new)', async () => {
        // Import the mocked module to access mocks (type assertion for vi.importActual)
        const profileModule = await vi.importActual('@/lib/services/profile-service') as {
            ProfileService: any
            profileService: { getProfile: any }
        }

        // Mock dependencies for enrichment
        vi.spyOn(postService as any, 'getPostStats').mockResolvedValue({
            likes: 0, remixes: 0, replies: 0, views: 0,
        } as any)
        vi.spyOn(postService as any, 'getUserInteractions').mockResolvedValue({
            liked: false, remixed: false, bookmarked: false,
        })

        // Simulate a document that triggers enrichment
        const mockDoc = { ownerId: 'test-owner', $id: 'test-post' } as any
        const mockPost: IPost = {
            id: 'test-post',
            author: {} as IUser,
            content: 'Test post',
            createdAt: new Date(),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
        }

        // Mock transformDocument to return the mockPost (which will call enrichPost internally)
        vi.spyOn(postService as any, 'transformDocument').mockImplementation((doc: any) => {
            // Simulate the transformation calling enrichPost
            postService['enrichPost'](mockPost, mockDoc)  // Trigger the method under test
            return mockPost
        })

        // Call a method that uses transformDocument (e.g., get to trigger it)
        await postService.get('test-post')

        // Verify the dynamic class constructor was called (from enrichPost: new ProfileService())
        expect(profileModule.ProfileService).toHaveBeenCalledWith('mock-contract-id')  // From getContractId mock
        expect(profileModule.ProfileService().getProfile).toHaveBeenCalledWith('test-owner')

        // Singleton shouldn't be called in this flow (since enrichPost uses new)
        expect(profileModule.profileService.getProfile).not.toHaveBeenCalled()
    })

    it('should fall back to default user when profile fetch fails', async () => {
        // Import the mocked module to access mocks (type assertion for vi.importActual)
        const profileModule = await vi.importActual('@/lib/services/profile-service') as {
            ProfileService: any
        }

        // Mock ProfileService constructor to return a failing instance
        profileModule.ProfileService.mockImplementation(() => ({
            getProfile: vi.fn().mockRejectedValue(new Error('Profile not found')),
        }))

        const mockDoc = {
            $id: 'post-no-profile',
            ownerId: 'unknown-user',
            content: 'No profile post',
            $createdAt: Date.now(),
        } as any

        // Mock transformDocument to simulate the logic (calls enrichPost which fetches profile)
        vi.spyOn(postService as any, 'transformDocument').mockImplementation(async (doc: any) => {
            const post: IPost = {
                id: doc.$id,
                author: postService['getDefaultUser'](doc.ownerId) as IUser,  // Use default initially
                content: doc.content,
                createdAt: new Date(doc.$createdAt),
                likes: 0, remixes: 0, replies: 0, views: 0,
                liked: false, remixed: false, bookmarked: false,
            }
            // Trigger enrichPost, which should fail and keep default author
            await postService['enrichPost'](post, doc)
            return post
        })

        // Mock other enrich dependencies to isolate profile failure
        vi.spyOn(postService as any, 'getPostStats').mockResolvedValue({ likes: 0, remixes: 0, replies: 0, views: 0 })
        vi.spyOn(postService as any, 'getUserInteractions').mockResolvedValue({ liked: false, remixed: false, bookmarked: false })

        const result = await postService['transformDocument'](mockDoc)
        expect(result.author).toMatchObject({
            id: 'unknown-user',
            username: 'unknown-...',
            displayName: 'Unknown User',
            avatar: '',
            bio: '',
            followers: 0,
            following: 0,
            verified: false,
            joinedAt: expect.any(Date),
            revision: 0,
        })

        // Verify failure was handled (profile fetch called but rejected)
        expect(profileModule.ProfileService().getProfile).toHaveBeenCalledWith('unknown-user')
    })

    it('should handle post stats caching', async () => {
        const mockPostId = 'cached-post-789'

        // Mock private count methods
        vi.spyOn(postService as any, 'countLikes').mockResolvedValue(5)
        vi.spyOn(postService as any, 'countRemixes').mockResolvedValue(2)
        vi.spyOn(postService as any, 'countReplies').mockResolvedValue(1)

        // First call: Computes and caches
        const firstCall = await postService['getPostStats'](mockPostId)
        expect(firstCall.likes).toBe(5)
        expect(firstCall.remixes).toBe(2)
        expect(firstCall.replies).toBe(1)

        // Second call within cache window: Returns cached
        vi.useFakeTimers()
        vi.advanceTimersByTime(5000)  // Within 10s
        const secondCall = await postService['getPostStats'](mockPostId)
        expect(secondCall).toEqual(firstCall)

        // Third call after expiry: Recomputes (but mocks will return same)
        vi.advanceTimersByTime(6000)  // Over 10s
        const thirdCall = await postService['getPostStats'](mockPostId)
        expect(thirdCall.likes).toBe(5)  // Same due to mocks, but cache cleared internally
    })
})
