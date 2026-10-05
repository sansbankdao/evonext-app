/* Import modules. */
import { getWasmSdk } from './wasm-sdk-service'
import { PlatformVersion } from '../dash-wasm/compat'
import { BaseDocumentService, QueryOptions } from './document-service'
import { stateTransitionService } from './state-transition-service'
import { getContractId, getNetwork } from '../network'

export interface LikeDocument {
    $id: string;
    $ownerId: string;
    $createdAt: number;
    postId: string;
}

class LikeService extends BaseDocumentService<LikeDocument> {
    constructor(_contractId: string | undefined) {
        super(_contractId, 'like')
    }

    /**
     * Transform document
     */
    protected transformDocument(doc: any): LikeDocument {
        return {
            $id: doc.$id,
            $ownerId: doc.$ownerId,
            $createdAt: doc.$createdAt,
            postId: doc.postId
        }
    }

    /**
     * Like a post
     */
    async likePost(
        postId: string,
        ownerId: string,
    ): Promise<boolean> {
        try {
            const sdk = await getWasmSdk()

            // Check if already liked
            const existing = await this.getLike(postId, ownerId)
console.log('EXISTING LIKE', existing)

            if (existing) {
                console.log('Post already liked')
                return true
            }

            // The Yappr like schema stores postId AND postOwnerId as
            // identifier fields; postOwnerId feeds the postOwnerLikes index
            // used for like counts, so fetch the parent POST to get its
            // owner. NOTE: the parent lives in the 'post' document type —
            // this.documentType here is 'like' (verified: fetching 'like'
            // returned "Post not found for like"). The 4.2 SDK accepts
            // base58 identifier strings directly.
            const parent = await sdk.getDocument(
                this.contractId, 'post', postId
            )
            const parentJson: any = parent && typeof (parent as any).toJSON === 'function'
                ? (parent as any).toJSON(PlatformVersion.current())
                : parent
            const parentOwnerId = parentJson?.$ownerId || parentJson?.ownerId

            if (!parentOwnerId) {
                console.error('Post not found for like:', postId)
                return false
            }

            console.log(`Liking ${this.documentType} document:`, postId)

            // Use state transition service for creation
            const result = await stateTransitionService.createDocument(
                this.contractId,
                this.documentType,
                ownerId,
                { postId, postOwnerId: parentOwnerId }
            )

            return result.success
        } catch (error) {
            console.error('Error liking post:', error)
            return false
        }
    }

    /**
     * Unlike a post
     */
    async unlikePost(
        postId: string,
        ownerId: string,
    ): Promise<boolean> {
        try {
            const sdk = await getWasmSdk()

            const like = await this.getLike(postId, ownerId)
console.log('EXISTING LIKE', like)

            if (!like) {
                console.log('Post not liked')
                return true;
            }

            // Use state transition service for deletion
            const result = await stateTransitionService.deleteDocument(
                this.contractId,
                this.documentType,
                like.$id,
                ownerId
            )

            return result.success
        } catch (error) {
            console.error('Error unliking post:', error)
            return false
        }
    }

    /**
     * Check if post is liked by user
     */
    async isLiked(
        postId: string,
        ownerId: string,
    ): Promise<boolean> {
        const like = await this.getLike(postId, ownerId)

        return like !== null
    }

    /**
     * Get like by post and owner
     */
    async getLike(
        postId: string,
        ownerId: string,
    ): Promise<LikeDocument | null> {
        try {
            const sdk = await getWasmSdk()

            // Import necessary modules
            const { getDashPlatformClient } = await import('../dash-platform-client')
            const { get_documents } = await import('../dash-wasm/compat')

            // Get SDK instance
            const dashClient = getDashPlatformClient(this.contractId)

            await dashClient.ensureInitialized()

            // Identifier fields are queried as base58 STRINGS on the 4.x SDK
            // (byte-array where clauses fail with "where clause on non
            // indexed property"), and the orderBy must match the postAndOwner
            // index [postId, $ownerId].
            const where = [
                ['postId', '==', postId],
                ['$ownerId', '==', ownerId]
            ]
            const orderBy = [['postId', 'asc'], ['$ownerId', 'asc']]
            // Query directly
            const response = await get_documents(
                sdk,
                this.contractId,
                'like',
                JSON.stringify(where),
                JSON.stringify(orderBy),
                1,    // limit
                null, // startAfter
                null  // startAt
            )
console.log('GET LIKE (response)', response)
            // Convert response
            let documents

            if (response && typeof response.toJSON === 'function') {
                documents = response.toJSON()
            } else if (response && response.documents) {
                documents = response.documents
            } else if (Array.isArray(response)) {
                documents = response
            } else {
                documents = []
            }

            return documents.length > 0 ? this.transformDocument(documents[0]) : null
        } catch (error) {
            console.error('Error getting like:', error)
            return null
        }
    }

    /**
     * Get likes for a post
     */
    async getPostLikes(
        postId: string,
        options: QueryOptions = {}
    ): Promise<LikeDocument[]> {
        try {
            console.log('Getting likes for post:', postId)

            // Import necessary modules
            const { getDashPlatformClient } = await import('../dash-platform-client')
            const { get_documents } = await import('../dash-wasm/compat')

            // Get SDK instance
            const dashClient = getDashPlatformClient(this.contractId)

            await dashClient.ensureInitialized()

            const sdk = await import('../services/wasm-sdk-service')
                .then(m => m.getWasmSdk())

            // Identifier fields are queried as base58 STRINGS on the 4.x SDK
            // (a byte-array where clause fails with "where clause on non
            // indexed property" once the query needs an index), and the
            // orderBy must match the postAndOwner index [postId, $ownerId].
            const where = [['postId', '==', postId]]
            const orderBy = [['postId', 'asc'], ['$ownerId', 'asc']]

            console.log('Querying likes for post:', postId)

            // Query directly using get_documents
            const response = await get_documents(
                sdk,
                this.contractId,
                'like',
                JSON.stringify(where),
                JSON.stringify(orderBy),
                options.limit || 50,
                null, // startAfter
                null  // startAt
            )

            // Convert response
            let documents

            if (response && typeof response.toJSON === 'function') {
                documents = response.toJSON()
            } else if (response && response.documents) {
                documents = response.documents
            } else if (Array.isArray(response)) {
                documents = response;
            } else {
                documents = []
            }

            console.log(`Found ${documents.length} likes for post ${postId}`)

            // Transform documents
            return documents.map((doc: any) => this.transformDocument(doc))
        } catch (error) {
            console.error('Error getting post likes:', error)
            return []
        }
    }

    /**
     * Get user's likes
     */
    async getUserLikes(
        userId: string,
        options: QueryOptions = {}
    ): Promise<LikeDocument[]> {
        try {
            const result = await this.query({
                where: [['$ownerId', '==', userId]],
                orderBy: [['$createdAt', 'desc']],
                limit: 50,
                ...options
            });

            return result.documents;
        } catch (error) {
            console.error('Error getting user likes:', error)
            return []
        }
    }

    /**
     * Count likes for a post
     */
    async countLikes(
        postId: string
    ): Promise<number> {
        // In a real implementation, this would be more efficient
        const likes = await this.getPostLikes(postId)

        return likes.length
    }
}

// Singleton instance
// CHANGE: resolved the real contract ID (was undefined — queries/state
// transitions received an undefined contractId and could not work).
export const likeService = new LikeService(getContractId(getNetwork()))
