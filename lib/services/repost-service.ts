/* Import modules. */
import { BaseDocumentService, QueryOptions } from './document-service'
import { stateTransitionService } from './state-transition-service'

export interface RepostDocument {
    $id: string;
    $ownerId: string;
    $createdAt: number;
    postId: string;
}

class RepostService extends BaseDocumentService<RepostDocument> {
    constructor(_contractId: string | undefined) {
        super(_contractId, 'repost')
    }

    /**
     * Transform document
     */
    protected transformDocument(doc: any): RepostDocument {
        return {
            $id: doc.$id,
            $ownerId: doc.$ownerId,
            $createdAt: doc.$createdAt,
            postId: doc.postId
        }
    }

    /**
     * Repost a post
     */
    async repostPost(postId: string, ownerId: string): Promise<boolean> {
        try {
            // Check if already reposted
            const existing = await this.getRepost(postId, ownerId);

            if (existing) {
                console.log('Post already reposted');
                return true;
            }

            // Use state transition service for creation
            const result = await stateTransitionService.createDocument(
                this.contractId,
                this.documentType,
                ownerId,
                { postId }
            )

            return result.success;
        } catch (error) {
            console.error('Error reposting:', error);
            return false;
        }
    }

    /**
     * Remove repost
     */
    async removeRepost(postId: string, ownerId: string): Promise<boolean> {
        try {
            const repost = await this.getRepost(postId, ownerId);

            if (!repost) {
                console.log('Post not reposted');
                return true;
            }

            // Use state transition service for deletion
            const result = await stateTransitionService.deleteDocument(
                this.contractId,
                this.documentType,
                repost.$id,
                ownerId
            )

            return result.success
        } catch (error) {
            console.error('Error removing repost:', error);
            return false;
        }
    }

    /**
     * Check if post is reposted by user
     */
    async isReposted(postId: string, ownerId: string): Promise<boolean> {
        const repost = await this.getRepost(postId, ownerId)

        return repost !== null
    }

    /**
     * Get repost by post and owner
     */
    async getRepost(postId: string, ownerId: string): Promise<RepostDocument | null> {
        try {
            const result = await this.query({
                where: [
                    ['postId', '==', postId],
                    ['$ownerId', '==', ownerId]
                ],
                limit: 1
            })

            return result.documents.length > 0 ? result.documents[0] : null;
        } catch (error) {
            console.error('Error getting repost:', error);
            return null;
        }
    }

    /**
     * Get reposts for a post
     */
    async getPostReposts(postId: string, options: QueryOptions = {}): Promise<RepostDocument[]> {
        try {
            const result = await this.query({
                where: [['postId', '==', postId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents
        } catch (error) {
            console.error('Error getting post reposts:', error);
            return [];
        }
    }

    /**
     * Get user's reposts
     */
    async getUserReposts(userId: string, options: QueryOptions = {}): Promise<RepostDocument[]> {
        try {
            const result = await this.query({
                where: [['$ownerId', '==', userId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents;
        } catch (error) {
            console.error('Error getting user reposts:', error);
            return [];
        }
    }

    /**
     * Count reposts for a post
     */
    async countReposts(postId: string): Promise<number> {
        const reposts = await this.getPostReposts(postId);

        return reposts.length;
    }
}

// Singleton instance
export const repostService = new RepostService(undefined)
