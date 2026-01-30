// test/unit/services/post-service.test.ts

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { IPost, IUser } from '@/lib/types'

// FIXED: ProfileService mock as a spied constructor returning mock instance
vi.mock('@/lib/services/profile-service', () => {
    // Mock constructor: new ProfileService(contractId) returns { getProfile: vi.fn() }
    const MockProfileServiceConstructor = vi.fn((contractId: string) => ({
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

    // Mock singleton instance
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
        ProfileService: MockProfileServiceConstructor,  // Constructor spy
        profileService: mockProfileInstance,  // Singleton
    }
})

// Mock like-service
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

// Mock BaseDocumentService as a direct class constructor with prototyped spies
vi.mock('@/lib/services/document-service', () => {
    // Define the mock class (inheritable)
    class MockBaseDocumentService {
        constructor(public contractId: string, public documentType: string) {}

        // Instance methods as class fields (modern JS, auto on prototype)
        query = vi.fn().mockResolvedValue({
            documents: [],
            nextCursor: null,
            prevCursor: null,
        })

        create = vi.fn().mockResolvedValue({
            $id: 'mock-doc-id',
            $ownerId: 'mock-owner',
            ownerId: 'mock-owner',
            $createdAt: Date.now(),
        })

        get = vi.fn().mockImplementation(async (id: string) => ({
            $id: id,
            $ownerId: 'mock-owner',
            ownerId: 'mock-owner',
            content: 'Mock post content',
            $createdAt: Date.now(),
        }))
    }

    return {
        BaseDocumentService: MockBaseDocumentService as any,  // 'as any' for TS mock flexibility
        QueryOptions: {},
        DocumentResult: { documents: [], nextCursor: null, prevCursor: null } as any,
    }
})

// Mock constants
vi.mock('@/lib/constants', () => ({
    EVONEXT_CONTRACT_ID_TESTNET: 'mock-test-contract-id',
    EVONEXT_CONTRACT_ID_MAINNET: 'mock-main-contract-id',
}))

// Mock post-service functions (partial, preserve singleton but override utils)
vi.mock('@/lib/services/post-service', async () => {
    const actual = await vi.importActual<typeof import('@/lib/services/post-service')>('@/lib/services/post-service')
    return {
        ...actual,
        getNetwork: vi.fn().mockReturnValue('testnet'),
        getContractId: vi.fn().mockReturnValue('mock-contract-id'),
        // Singleton will now extend the mocked base successfully
    }
})

let postService: any

describe('postService', () => {
    beforeAll(async () => {
        const postModule = await import('@/lib/services/post-service')
        postService = postModule.postService
    })

    beforeEach(() => {
        vi.clearAllMocks()
        if (postService?.statsCache) postService.statsCache.clear()
    })

    it('should create a post document correctly', async () => {
        const mockOwnerId = 'mock-user-id'
        const mockContent = 'Hello World'
        const mockOptions = { mediaUrl: 'https://example.com/image.jpg' }

        const mockRawDoc = {
            id: 'new-post-id',
            author: { id: 'default-author' } as IUser,
            content: mockContent,
            createdAt: new Date(),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
            media: [{ type: 'image', url: mockOptions.mediaUrl }],
        } as IPost

        vi.spyOn(postService, 'create').mockResolvedValue(mockRawDoc)
        vi.spyOn(postService, 'enrichPost' as any).mockResolvedValue(undefined)

        const result = await postService.createPost(mockOwnerId, mockContent, undefined, mockOptions)

        expect(postService.create).toHaveBeenCalledWith(mockOwnerId, {
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

        const mockQueryResponse = {
            documents: mockRawDocs,
            nextCursor: null,
            prevCursor: null,
        }
        vi.spyOn(postService, 'query').mockResolvedValue(mockQueryResponse)

        vi.spyOn(postService, 'transformDocument' as any).mockImplementation((doc: any) => ({
            id: doc.$id,
            author: { id: doc.ownerId, username: 'mock-user' } as IUser,
            content: doc.content,
            createdAt: new Date(doc.$createdAt),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
        } as IPost))

        const result = await postService.getUserPosts(mockUserId, { limit: 10 })

        expect(postService.query).toHaveBeenCalledWith({
            where: [['$ownerId', '==', mockUserId]],
            orderBy: [['$createdAt', 'desc']],
            limit: 10,
        })
        expect(result.documents).toHaveLength(1)
        expect(result.documents[0].content).toBe('User post')
    })

    it('should handle profileService correctly in enrichment (singleton vs new)', async () => {
        // Get the mocked ProfileService constructor
        const { ProfileService } = await import('@/lib/services/profile-service')

        vi.spyOn(postService, 'getPostStats' as any).mockResolvedValue({
            likes: 0, remixes: 0, replies: 0, views: 0,
        })
        vi.spyOn(postService, 'getUserInteractions' as any).mockResolvedValue({
            liked: false, remixed: false, bookmarked: false,
        })

        const mockDoc = { ownerId: 'test-owner', $id: 'test-post' } as any
        const mockPost: IPost = {
            id: 'test-post',
            author: {} as IUser,
            content: 'Test post',
            createdAt: new Date(),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
        }

        vi.spyOn(postService, 'transformDocument' as any).mockImplementation((doc: any) => {
            postService.enrichPost(mockPost, mockDoc)
            return mockPost
        })

        await postService.getUserPosts('test-owner', { limit: 1 })

        // FIXED: Cast for callability - constructor spy tracks args
        expect(ProfileService as any).toHaveBeenCalledWith('mock-contract-id')

        // Get the returned instance from constructor call and assert on it
        const mockInstance = (ProfileService as any)() as { getProfile: any }
        expect(mockInstance.getProfile).toHaveBeenCalledWith('test-owner')
    })

    it('should fall back to default user when profile fetch fails', async () => {
        const { ProfileService } = await import('@/lib/services/profile-service')

        // Mock the constructor to return a failing instance
        ;(ProfileService as any).mockImplementation((contractId: string) => ({
            getProfile: vi.fn().mockRejectedValue(new Error('Profile not found')),
        }))

        const mockDoc = {
            $id: 'post-no-profile',
            ownerId: 'unknown-user',
            content: 'No profile post',
            $createdAt: Date.now(),
        } as any

        vi.spyOn(postService, 'transformDocument' as any).mockImplementation(async (doc: any) => {
            const post: IPost = {
                id: doc.$id,
                author: postService.getDefaultUser(doc.ownerId) as IUser,
                content: doc.content,
                createdAt: new Date(doc.$createdAt),
                likes: 0, remixes: 0, replies: 0, views: 0,
                liked: false, remixed: false, bookmarked: false,
            }
            await postService.enrichPost(post, doc)
            return post
        })

        vi.spyOn(postService, 'getPostStats' as any).mockResolvedValue({
            likes: 0, remixes: 0, replies: 0, views: 0
        })
        vi.spyOn(postService, 'getUserInteractions' as any).mockResolvedValue({
            liked: false, remixed: false, bookmarked: false
        })

        const result = await postService.transformDocument(mockDoc)
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

        // FIXED: Assert on constructor call and instance
        expect(ProfileService as any).toHaveBeenCalledWith('mock-contract-id')
        const failingInstance = (ProfileService as any)() as { getProfile: any }
        expect(failingInstance.getProfile).toHaveBeenCalledWith('unknown-user')
    })

    it('should handle post stats caching', async () => {
        const mockPostId = 'cached-post-789'

        vi.spyOn(postService, 'countLikes' as any).mockResolvedValue(5)
        vi.spyOn(postService, 'countRemixes' as any).mockResolvedValue(2)
        vi.spyOn(postService, 'countReplies' as any).mockResolvedValue(1)

        const firstCall = await postService.getPostStats(mockPostId)
        expect(firstCall.likes).toBe(5)
        expect(firstCall.remixes).toBe(2)
        expect(firstCall.replies).toBe(1)

        vi.useFakeTimers()
        vi.advanceTimersByTime(5000)
        const secondCall = await postService.getPostStats(mockPostId)
        expect(secondCall).toEqual(firstCall)

        vi.advanceTimersByTime(6000)
        const thirdCall = await postService.getPostStats(mockPostId)
        expect(thirdCall.likes).toBe(5)
    })
})
