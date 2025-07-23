import { BaseDocumentService, QueryOptions } from './document-service';
import { stateTransitionService } from './state-transition-service';

export interface FollowDocument {
  $id: string;
  $ownerId: string;
  $createdAt: number;
  userId: string;
}

class FollowService extends BaseDocumentService<FollowDocument> {
  constructor() {
    super('follow');
  }

  /**
   * Transform document
   */
  protected transformDocument(doc: any): FollowDocument {
    return {
      $id: doc.$id,
      $ownerId: doc.$ownerId,
      $createdAt: doc.$createdAt,
      userId: doc.userId
    };
  }

  /**
   * Follow a user
   */
  async followUser(targetUserId: string, followerUserId: string): Promise<boolean> {
    try {
      // Check if already following
      const existing = await this.getFollow(targetUserId, followerUserId);
      if (existing) {
        console.log('Already following user');
        return true;
      }

      // Use state transition service for creation
      const result = await stateTransitionService.createDocument(
        this.contractId,
        this.documentType,
        followerUserId,
        { userId: targetUserId }
      );

      return result.success;
    } catch (error) {
      console.error('Error following user:', error);
      return false;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(targetUserId: string, followerUserId: string): Promise<boolean> {
    try {
      const follow = await this.getFollow(targetUserId, followerUserId);
      if (!follow) {
        console.log('Not following user');
        return true;
      }

      // Use state transition service for deletion
      const result = await stateTransitionService.deleteDocument(
        this.contractId,
        this.documentType,
        follow.$id,
        followerUserId
      );

      return result.success;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(targetUserId: string, followerUserId: string): Promise<boolean> {
    const follow = await this.getFollow(targetUserId, followerUserId);
    return follow !== null;
  }

  /**
   * Get follow relationship
   */
  async getFollow(targetUserId: string, followerUserId: string): Promise<FollowDocument | null> {
    try {
      const result = await this.query({
        where: [
          ['userId', '==', targetUserId],
          ['$ownerId', '==', followerUserId]
        ],
        limit: 1
      });

      return result.documents.length > 0 ? result.documents[0] : null;
    } catch (error) {
      console.error('Error getting follow:', error);
      return null;
    }
  }

  /**
   * Get followers of a user
   */
  async getFollowers(userId: string, options: QueryOptions = {}): Promise<FollowDocument[]> {
    try {
      const result = await this.query({
        where: [['userId', '==', userId]],
        orderBy: [['$createdAt', 'desc']],
        limit: 50,
        ...options
      });

      return result.documents;
    } catch (error) {
      console.error('Error getting followers:', error);
      return [];
    }
  }

  /**
   * Get users that a user follows
   */
  async getFollowing(userId: string, options: QueryOptions = {}): Promise<FollowDocument[]> {
    try {
      const result = await this.query({
        where: [['$ownerId', '==', userId]],
        orderBy: [['$createdAt', 'desc']],
        limit: 50,
        ...options
      });

      return result.documents;
    } catch (error) {
      console.error('Error getting following:', error);
      return [];
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
  async areMutualFollowers(userId1: string, userId2: string): Promise<boolean> {
    const [follows1to2, follows2to1] = await Promise.all([
      this.isFollowing(userId2, userId1),
      this.isFollowing(userId1, userId2)
    ]);

    return follows1to2 && follows2to1;
  }
}

// Singleton instance
export const followService = new FollowService();