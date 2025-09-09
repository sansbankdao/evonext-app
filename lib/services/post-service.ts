/* Import modules. */
import { BaseDocumentService, QueryOptions, DocumentResult } from './document-service'
import { Post, User } from '../types'
import { identityService } from './identity-service'
import { profileService } from './profile-service'

export interface PostDocument {
    $id: string;
    $ownerId: string;
    ownerId: string;
    content: string;
    remix?: string;
    mediaUrl?: string;
    replyToId?: string;
    quotedPostId?: string;
    firstMentionId?: string;
    primaryHashtag?: string;
    language?: string;
    isSensitive?: boolean;
    $createdAt: number;
    $updatedAt?: number;
}

export interface PostStats {
    postId: string;
    likes: number;
    reposts: number;
    replies: number;
    views: number;
}

class PostService extends BaseDocumentService<Post> {
    private statsCache: Map<string, { data: PostStats; timestamp: number }> = new Map()

    constructor(_contractId: string) {
        super(_contractId, 'post')
    }

    /**
     * Transform document to Post type
     */
    protected transformDocument(doc: PostDocument): Post {
        // Return a basic Post object - additional data will be loaded separately
        const post: Post = {
            id: doc.$id,
            // author: this.getDefaultUser(doc.$ownerId),
            author: this.getDefaultUser(doc.ownerId),
            content: doc.content,
            createdAt: new Date(doc.$createdAt),
            likes: 0,
            reposts: 0,
            replies: 0,
            views: 0,
            liked: false,
            reposted: false,
            bookmarked: false,
            media: doc.mediaUrl ? [{
                id: doc.$id + '-media',
                type: 'image',
                url: doc.mediaUrl
            }] : undefined
        }

        // Queue async operations to enrich the post
        this.enrichPost(post, doc)

        return post
    }

    /**
     * Enrich post with async data
     */
    private async enrichPost(
        post: Post,
        doc: PostDocument,
    ): Promise<void> {
        try {
            // Get author information
            // const author = await profileService.getProfile(doc.$ownerId)
            const ps = new profileService('')
            const author = await ps.getProfile(doc.ownerId)

            if (author) {
                post.author = author
            }

            // Get post stats
            const stats = await this.getPostStats(doc.$id)
            post.likes = stats.likes
            post.reposts = stats.reposts
            post.replies = stats.replies
            post.views = stats.views

            // Get interaction status for current user
            const interactions = await this.getUserInteractions(doc.$id)
            post.liked = interactions.liked
            post.reposted = interactions.reposted
            post.bookmarked = interactions.bookmarked

            // Load reply-to post if exists
            if (doc.replyToId) {
                const replyTo = await this.get(doc.replyToId)

                if (replyTo) {
                    post.replyTo = replyTo
                }
            }

            // Load quoted post if exists
            if (doc.quotedPostId) {
                const quotedPost = await this.get(doc.quotedPostId)

                if (quotedPost) {
                    post.quotedPost = quotedPost
                }
            }
        } catch (error) {
            console.error('Error enriching post:', error)
        }
    }

    /**
     * Create a new post
     */
    async createPost(
        ownerId: string,
        content: string,
        remix?: string,
        options: {
            mediaUrl?: string;
            replyToId?: string;
            quotedPostId?: string;
            firstMentionId?: string;
            primaryHashtag?: string;
            language?: string;
            isSensitive?: boolean;
        } = {}
    ): Promise<Post> {
        const data: any = {
            content
        }

        // Add optional fields
        if (options.mediaUrl) data.mediaUrl = options.mediaUrl
        if (options.replyToId) data.replyToId = options.replyToId
        if (options.quotedPostId) data.quotedPostId = options.quotedPostId
        if (options.firstMentionId) data.firstMentionId = options.firstMentionId
        if (options.primaryHashtag) data.primaryHashtag = options.primaryHashtag
        if (options.language) data.language = options.language || 'en'
        if (options.isSensitive !== undefined) data.isSensitive = options.isSensitive

        return this.create(ownerId, data)
    }

    /**
     * Get timeline posts
     */
    async getTimeline(options: QueryOptions = {}): Promise<DocumentResult<Post>> {
        const defaultOptions: QueryOptions = {
            orderBy: [['$createdAt', 'desc']],
            limit: 20,
            ...options
        }

        return this.query(defaultOptions)
    }

    /**
     * Get posts by user
     */
    async getUserPosts(
        userId: string,
        options: QueryOptions = {},
    ): Promise<DocumentResult<Post>> {
        const queryOptions: QueryOptions = {
            where: [['$ownerId', '==', userId]],
            orderBy: [['$createdAt', 'desc']],
            limit: 20,
            ...options
        }

        return this.query(queryOptions)
    }

    /**
     * Get replies to a post
     */
    async getReplies(
        postId: string,
        options: QueryOptions = {},
    ): Promise<DocumentResult<Post>> {
        const queryOptions: QueryOptions = {
            where: [['replyToId', '==', postId]],
            orderBy: [['$createdAt', 'asc']],
            limit: 20,
            ...options
        }

        return this.query(queryOptions)
    }

    /**
     * Get posts by hashtag
     */
    async getPostsByHashtag(
        hashtag: string,
        options: QueryOptions = {},
    ): Promise<DocumentResult<Post>> {
        const queryOptions: QueryOptions = {
            where: [['primaryHashtag', '==', hashtag.replace('#', '')]],
            orderBy: [['$createdAt', 'desc']],
            limit: 20,
            ...options
        }

        return this.query(queryOptions)
    }

    /**
     * Get post statistics (likes, reposts, replies)
     */
    private async getPostStats(postId: string): Promise<PostStats> {
        // Check cache
        const cached = this.statsCache.get(postId);

        if (cached && Date.now() - cached.timestamp < 10000) { // 10 second cache for stats
            return cached.data;
        }

        try {
            // In a real implementation, these would be parallel queries
            const stats: PostStats = {
                postId,
                likes: await this.countLikes(postId),
                reposts: await this.countReposts(postId),
                replies: await this.countReplies(postId),
                views: 0 // Views would need a separate tracking mechanism
            }

            // Cache the result
            this.statsCache.set(postId, {
                data: stats,
                timestamp: Date.now()
            })

            return stats
        } catch (error) {
            console.error('Error getting post stats:', error)
            return {
                postId,
                likes: 0,
                reposts: 0,
                replies: 0,
                views: 0,
            }
        }
    }

    /**
     * Count likes for a post
     */
    private async countLikes(postId: string): Promise<number> {
        const { likeService } = await import('./like-service')

        return likeService.countLikes(postId)
    }

    /**
     * Count reposts for a post
     */
    private async countReposts(postId: string): Promise<number> {
        const { repostService } = await import('./repost-service')

        return repostService.countReposts(postId)
    }

    /**
     * Count replies to a post
     */
    private async countReplies(postId: string): Promise<number> {
        try {
            const result = await this.query({
                where: [['replyToId', '==', postId]],
                limit: 1
            })

            // In a real implementation, we'd get the total count from the query
            return result.documents.length
        } catch (error) {
            return 0
        }
    }

    /**
     * Get user interactions with a post
     */
    private async getUserInteractions(postId: string): Promise<{
        liked: boolean;
        reposted: boolean;
        bookmarked: boolean;
    }> {
        // This would check if the current user has liked/reposted/bookmarked
        // For now, return false for all
        return {
            liked: false,
            reposted: false,
            bookmarked: false
        }
    }

    /**
     * Get default user object when profile not found
     */
    private getDefaultUser(userId: string): User {
        return {
            id: userId,
            docId: undefined,
            username: userId.substring(0, 8) + '...',
            displayName: 'Unknown User',
            avatar: '',
            bio: '',
            followers: 0,
            following: 0,
            verified: false,
            joinedAt: new Date(),
            revision: 0,
        }
    }
}

// Singleton instance
export const postService = new PostService('')
