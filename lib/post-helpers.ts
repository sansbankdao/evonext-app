/**
 * Helper functions for creating and managing posts on Dash Platform
 */

import { AuthUser } from '@/contexts/auth-context'

export interface PostDocument {
    authorId: Uint8Array; // 32-byte identity ID
    content: string;
    remix?: string;
    mediaUrl?: string; // Optional media URL (simplified from media array)
    replyToPostId?: Uint8Array; // Optional reference to parent post
    quotedPostId?: Uint8Array; // Optional reference to quoted post
    firstMentionId?: Uint8Array; // Optional first mentioned user (simplified from mentions array)
    primaryHashtag?: string; // Optional primary hashtag (simplified from hashtags array)
    language?: string; // 2-letter language code
    isSensitive?: boolean; // Whether post contains sensitive content
}

/**
 * Convert identity ID string to Uint8Array for document storage
 */
export function identityIdToBytes(identityId: string): Uint8Array {
    // In production, this would use proper base58 decoding
    // For now, we'll create a placeholder
    const bytes = new Uint8Array(32)

    for (let i = 0; i < Math.min(identityId.length, 32); i++) {
        bytes[i] = identityId.charCodeAt(i)
    }

    return bytes
}

/**
 * Create a post document ready for Dash Platform
 */
export function createPostDocument(
    user: AuthUser,
    content: string,
    remix?: string,
    options?: {
        mediaUrl?: string
        replyToPostId?: string
        quotedPostId?: string
        firstMentionId?: string
        primaryHashtag?: string
        language?: string
        isSensitive?: boolean
    }
): PostDocument {
    const post: PostDocument = {
        authorId: identityIdToBytes(user.identityId),
        content: content.trim()
    }

    // Add optional fields if provided
    if (options?.mediaUrl) {
        post.mediaUrl = options.mediaUrl
    }

    if (options?.replyToPostId) {
        post.replyToPostId = identityIdToBytes(options.replyToPostId)
    }

    if (options?.quotedPostId) {
        post.quotedPostId = identityIdToBytes(options.quotedPostId)
    }

    if (options?.firstMentionId) {
        post.firstMentionId = identityIdToBytes(options.firstMentionId)
    }

    if (options?.primaryHashtag) {
        post.primaryHashtag = options.primaryHashtag.replace('#', '')
    }

    if (options?.language) {
        post.language = options.language
    }

    if (options?.isSensitive !== undefined) {
        post.isSensitive = options.isSensitive
    }

    return post
}

/**
 * Extract hashtags from post content
 */
export function extractHashtags(content: string): string[] {
    const regex = /#[a-zA-Z0-9_]{1,100}/g
    const matches = content.match(regex) || []

    return matches.map(tag => tag.slice(1)) // Remove # prefix
}

/**
 * Extract mentions from post content
 */
export function extractMentions(content: string): string[] {
    const regex = /@[a-zA-Z0-9_]{1,100}/g
    const matches = content.match(regex) || []

    return matches.map(mention => mention.slice(1)) // Remove @ prefix
}

/**
 * Validate post content according to contract rules
 */
export function validatePost(content: string): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
        return { valid: false, error: 'Post content cannot be empty' }
    }

    if (content.length > 500) {
        return { valid: false, error: 'Post content cannot exceed 500 characters' }
    }

    return { valid: true }
}
