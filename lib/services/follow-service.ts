/* Import modules. */
import { BaseDocumentService, QueryOptions } from './document-service'
import { stateTransitionService } from './state-transition-service'

export interface FollowDocument {
    $id: string;
    $ownerId: string;
    $createdAt: number;
    followingId: string;
}

class FollowService extends BaseDocumentService<FollowDocument> {
    constructor() {
        super('follow')
    }

    /**
     * Transform document
     */
    protected transformDocument(doc: any): FollowDocument {
        console.log('Transforming follow document:', doc);

        // Handle both direct properties and nested data structure
        const id = doc.$id || doc.id;
        const ownerId = doc.$ownerId || doc.ownerId;
        const createdAt = doc.$createdAt || doc.createdAt;
        const data = doc.data || doc;

        // followingId might be a byte array or base58 string
        let followingId = data.followingId;

        // If it's a byte array, convert to base58
        if (followingId && Array.isArray(followingId)) {
            // Import bs58 dynamically
            const bs58 = require('bs58');

            followingId = bs58.encode(Buffer.from(followingId));
        }

        return {
            $id: id,
            $ownerId: ownerId,
            $createdAt: createdAt,
            followingId: followingId
        }
    }

    /**
     * Follow a user
     * @param followerUserId - The identity ID of the user who is following
     * @param targetUserId - The identity ID of the user being followed
     */
    async followUser(
        followerUserId: string,
        targetUserId: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Check if already following
            const existing = await this.getFollow(targetUserId, followerUserId);

            if (existing) {
                console.log('Already following user');
                return { success: true };
            }

            // Use state transition service for creation
            // The WASM SDK should handle the conversion of base58 ID to byte array
            const result = await stateTransitionService.createDocument(
                this.contractId,
                this.documentType,
                followerUserId,
                { followingId: targetUserId }
            )

            return result
        } catch (error) {
            console.error('Error following user:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to follow user'
            }
        }
    }

    /**
     * Unfollow a user
     * @param followerUserId - The identity ID of the user who is unfollowing
     * @param targetUserId - The identity ID of the user being unfollowed
     */
    async unfollowUser(
        followerUserId: string,
        targetUserId: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const follow = await this.getFollow(targetUserId, followerUserId);

            if (!follow) {
                console.log('Not following user');
                return { success: true };
            }

            // Use state transition service for deletion
            const result = await stateTransitionService.deleteDocument(
                this.contractId,
                this.documentType,
                follow.$id,
                followerUserId
            )

            return result
        } catch (error) {
            console.error('Error unfollowing user:', error)

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to unfollow user'
            }
        }
    }

    /**
     * Check if user A follows user B
     */
    async isFollowing(
        targetUserId: string,
        followerUserId: string,
    ): Promise<boolean> {
        const follow = await this.getFollow(targetUserId, followerUserId);

        return follow !== null;
    }

    /**
     * Get follow relationship
     */
    async getFollow(
        targetUserId: string,
        followerUserId: string,
    ): Promise<FollowDocument | null> {
        try {
            const result = await this.query({
                where: [
                    ['followingId', '==', targetUserId],
                    ['$ownerId', '==', followerUserId]
                ],
                limit: 1
            })

            return result.documents.length > 0 ? result.documents[0] : null;
        } catch (error) {
            console.error('Error getting follow:', error);
            return null;
        }
    }

    /**
     * Get followers of a user
     */
    async getFollowers(
        userId: string,
        options: QueryOptions = {},
    ): Promise<FollowDocument[]> {
        try {
            const result = await this.query({
                where: [['followingId', '==', userId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents
        } catch (error) {
            console.error('Error getting followers:', error);

            return [];
        }
    }

    /**
     * Get users that a user follows
     */
    async getFollowing(
        userId: string,
        options: QueryOptions = {},
    ): Promise<FollowDocument[]> {
        try {
            const result = await this.query({
                where: [['$ownerId', '==', userId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents
        } catch (error) {
            console.error('Error getting following:', error);

            return []
        }
    }

    /**
     * Count followers
     */
    async countFollowers(userId: string): Promise<number> {
        const followers = await this.getFollowers(userId);

        return followers.length;
    }

    /**
     * Count following
     */
    async countFollowing(userId: string): Promise<number> {
        const following = await this.getFollowing(userId);

        return following.length;
    }

    /**
     * Check mutual follow (both users follow each other)
     */
    async areMutualFollowers(
        userId1: string,
        userId2: string,
    ): Promise<boolean> {
        const [follows1to2, follows2to1] = await Promise.all([
            this.isFollowing(userId2, userId1),
            this.isFollowing(userId1, userId2)
        ])

        return follows1to2 && follows2to1
    }
}

// Singleton instance
export const followService = new FollowService()
