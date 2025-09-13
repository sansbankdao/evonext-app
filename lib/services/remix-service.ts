/* Import modules. */
import { BaseDocumentService, QueryOptions } from './document-service'
import { stateTransitionService } from './state-transition-service'

export interface RemixDocument {
    $id: string;
    $ownerId: string;
    $createdAt: number;
    postId: string;
}

class RemixService extends BaseDocumentService<RemixDocument> {
    constructor(_contractId: string | undefined) {
        super(_contractId, 'remix')
    }

    /**
     * Transform document
     */
    protected transformDocument(doc: any): RemixDocument {
        return {
            $id: doc.$id,
            $ownerId: doc.$ownerId,
            $createdAt: doc.$createdAt,
            postId: doc.postId
        }
    }

    /**
     * Remix a post
     */
    async remixPost(postId: string, ownerId: string): Promise<boolean> {
        try {
            // Check if already remixed
            const existing = await this.getRemix(postId, ownerId);

            if (existing) {
                console.log('Post already remixed');
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
            console.error('Error remixing:', error);
            return false;
        }
    }

    /**
     * Remove remix
     */
    async removeRemix(postId: string, ownerId: string): Promise<boolean> {
        try {
            const remix = await this.getRemix(postId, ownerId);

            if (!remix) {
                console.log('Post not remixed');
                return true;
            }

            // Use state transition service for deletion
            const result = await stateTransitionService.deleteDocument(
                this.contractId,
                this.documentType,
                remix.$id,
                ownerId
            )

            return result.success
        } catch (error) {
            console.error('Error removing remix:', error);
            return false;
        }
    }

    /**
     * Check if post is remixed by user
     */
    async isRemixed(postId: string, ownerId: string): Promise<boolean> {
        const remix = await this.getRemix(postId, ownerId)

        return remix !== null
    }

    /**
     * Get remix by post and owner
     */
    async getRemix(postId: string, ownerId: string): Promise<RemixDocument | null> {
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
            console.error('Error getting remix:', error);
            return null;
        }
    }

    /**
     * Get remixes for a post
     */
    async getPostRemixs(postId: string, options: QueryOptions = {}): Promise<RemixDocument[]> {
        try {
            const result = await this.query({
                where: [['postId', '==', postId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents
        } catch (error) {
            console.error('Error getting post remixes:', error);
            return [];
        }
    }

    /**
     * Get user's remixes
     */
    async getUserRemixs(userId: string, options: QueryOptions = {}): Promise<RemixDocument[]> {
        try {
            const result = await this.query({
                where: [['$ownerId', '==', userId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            })

            return result.documents;
        } catch (error) {
            console.error('Error getting user remixes:', error);
            return [];
        }
    }

    /**
     * Count remixes for a post
     */
    async countRemixs(postId: string): Promise<number> {
        const remixes = await this.getPostRemixs(postId);

        return remixes.length;
    }
}

// Singleton instance
export const remixService = new RemixService(undefined)
