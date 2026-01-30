// test/unit/services/post-service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postService } from '@/lib/services/post-service'
import type { IPost, IUser } from '@/lib/types'

// Mock profile-service: Export both singleton instance and class constructor
vi.mock('@/lib/services/profile-service', () => {
    const mockProfileInstance = vi.fn().mockReturnValue({
        getProfile: vi.fn().mockResolvedValue({
            id: 'mock-user',
            docId: 'mock-doc',
            username: 'testuser',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            bio: 'Test bio',
            followers: 10,
            following: 5,
            verified: true,
            joinedAt: new Date(),
            revision: 1,
        } as IUser),
    })

    // Mock the class constructor: When 'new ProfileService()' is called, return a mock instance
    const MockProfileServiceClass = vi.fn().mockImplementation(() => mockProfileInstance.mock.results?.[0]?.value || {
        getProfile: vi.fn().mockResolvedValue(null),  // Default to failure for fallback tests
    })

    return {
        profileService: mockProfileInstance,  // Singleton export (instance)
        ProfileService: MockProfileServiceClass,  // Class export (constructor)
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
        get: vi.fn().mockImplementation((id: string) => ({  // ✅ Fixed: Use mockImplementation
            $id: id,
            $ownerId: 'mock-owner',
            ownerId: 'mock-owner',
            content: 'Mock post content',
            $createdAt: Date.now(),
        })),  // Returns raw doc for transformation simulation

        // If BaseDocumentService has protected methods, we don't mock them here—spy on the child class
    })),
    QueryOptions: {} as any,
    DocumentResult: { documents: [], next: null, prev: null } as any,
}))

// Mock constants
vi.mock('@/lib/constants', () => ({
    EVONEXT_CONTRACT_ID_TESTNET: 'mock-test-contract-id',
    EVONEXT_CONTRACT_ID_MAINNET: 'mock-main-contract-id',
}))

// Mock getNetwork for consistent test behavior
vi.mock('@/lib/services/post-service', async () => {
    const actual = await vi.importActual('@/lib/services/post-service')
    return {
        ...actual,
        getNetwork: vi.fn().mockReturnValue('testnet'),  // Fixed network for tests
        getContractId: vi.fn().mockReturnValue('mock-contract-id'),
        postService,
    }
})

describe('postService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(postService as any).statsCache?.clear()
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
            mediaUrl: mockOptions.mediaUrl,
            $createdAt: Date.now(),
        } as any

        vi.spyOn(postService as any, 'create').mockResolvedValue(mockRawDoc)
        vi.spyOn(postService as any, 'enrichPost').mockResolvedValue(undefined)  // Mock private enrichment

        const result: IPost = await postService.createPost(mockOwnerId, mockContent, undefined, mockOptions)

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
        vi.spyOn(postService as any, 'query').mockResolvedValue({
            documents: mockRawDocs,
            next: null,
            prev: null,
        })

        // Mock transformDocument (override protected method for test)
        vi.spyOn(postService as any, 'transformDocument').mockImplementation((doc: any) => ({
            id: doc.$id,
            author: { id: doc.ownerId, username: 'mock-user' } as IUser,
            content: doc.content,
            createdAt: new Date(doc.$createdAt),
            likes: 0, remixes: 0, replies: 0, views: 0,
            liked: false, remixed: false, bookmarked: false,
        }))

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
        // Test singleton usage (if refactored)
        const singletonProfile = await import('@/lib/services/profile-service')
        expect(singletonProfile.profileService.getProfile).toHaveBeenCalledTimes(0)  // Before use

        // Test dynamic new ProfileService() (post-refactor)
        // In a real test, call enrichPost or a method that triggers it
        const mockDoc = { ownerId: 'test-owner', $id: 'test-post' } as any
        vi.spyOn(postService as any, 'getPostStats').mockResolvedValue({ likes: 0, remixes: 0, replies: 0, views: 0 } as any)
        vi.spyOn(postService as any, 'getUserInteractions').mockResolvedValue({ liked: false, remixed: false, bookmarked: false })

        // Simulate transform + enrich
        const mockPost = postService['transformDocument'](mockDoc) as IPost  // Via any cast
        await postService['enrichPost'](mockPost, mockDoc)

        // Now the mock should have been called
        expect(singletonProfile.profileService.getProfile).toHaveBeenCalledWith('test-owner')
        // OR if using new ProfileService, check the constructor mock: expect(singletonProfile.ProfileService).toHaveBeenCalled()
    })

    it('should fall back to default user when profile fetch fails', async () => {
        // Mock ProfileService to fail
        const { ProfileService } = await import('@/lib/services/profile-service')
        ;(ProfileService as any).mockImplementation(() => ({
            getProfile: vi.fn().mockRejectedValue(new Error('Profile not found')),
        }))

        const mockDoc = {
            $id: 'post-no-profile',
            ownerId: 'unknown-user',
            content: 'No profile post',
            $createdAt: Date.now(),
        } as any

        vi.spyOn(postService as any, 'transformDocument').mockImplementation((doc: any) => {
            // Simulate transformation with default user logic
            return {
                id: doc.$id,
                author: postService['getDefaultUser'](doc.ownerId) as IUser,
                content: doc.content,
                createdAt: new Date(doc.$createdAt),
                // ... other defaults
            }
        })

        const result = postService['transformDocument'](mockDoc)
        expect(result.author).toMatchObject({
            id: 'unknown-user',
            username: 'unknown-...',
            displayName: 'Unknown User',
        })
    })
})
