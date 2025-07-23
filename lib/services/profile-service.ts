import { BaseDocumentService } from './document-service';
import { User } from '../types';
import { dpnsService } from './dpns-service';
import { cacheManager } from '../cache-manager';

export interface ProfileDocument {
  $id: string;
  $ownerId: string;
  $createdAt: number;
  $updatedAt?: number;
  displayName: string;
  bio?: string;
  avatarId?: string;
}

export interface AvatarDocument {
  $id: string;
  $ownerId: string;
  $createdAt: number;
  $updatedAt?: number;
  data: string;
}

class ProfileService extends BaseDocumentService<User> {
  private readonly AVATAR_CACHE = 'avatars';
  private readonly USERNAME_CACHE = 'usernames';
  private readonly PROFILE_CACHE = 'profiles';

  constructor() {
    super('profile');
  }

  /**
   * Transform document to User type
   */
  protected transformDocument(doc: ProfileDocument): User {
    // Return a basic User object - additional data will be loaded separately
    const user: User = {
      id: doc.$ownerId,
      username: doc.$ownerId.substring(0, 8) + '...',
      displayName: doc.displayName,
      avatar: doc.avatarId ? `/api/avatar/${doc.$ownerId}` : '',
      avatarId: doc.avatarId,
      bio: doc.bio,
      followers: 0,
      following: 0,
      verified: false,
      joinedAt: new Date(doc.$createdAt)
    };

    // Queue async operations to enrich the user
    this.enrichUser(user, doc);

    return user;
  }

  /**
   * Enrich user with async data
   */
  private async enrichUser(user: User, doc: ProfileDocument): Promise<void> {
    try {
      // Get username from DPNS
      const username = await this.getUsername(doc.$ownerId);
      if (username) {
        user.username = username;
      }
      
      // Get avatar data if avatarId exists
      if (doc.avatarId) {
        const avatarData = await this.getAvatarData(doc.avatarId);
        if (avatarData) {
          user.avatarData = avatarData;
        }
      }

      // Get follower/following counts
      const stats = await this.getUserStats(doc.$ownerId);
      user.followers = stats.followers;
      user.following = stats.following;
    } catch (error) {
      console.error('Error enriching user:', error);
    }
  }

  /**
   * Get profile by owner ID
   */
  async getProfile(ownerId: string): Promise<User | null> {
    try {
      console.log('ProfileService: Getting profile for owner ID:', ownerId);
      
      // Check cache first
      const cached = cacheManager.get<User>(this.PROFILE_CACHE, ownerId);
      if (cached) {
        console.log('ProfileService: Returning cached profile for:', ownerId);
        return cached;
      }
      
      // Query by owner ID
      const result = await this.query({
        where: [['$ownerId', '==', ownerId]],
        limit: 1
      });

      console.log('ProfileService: Query result:', result);
      console.log('ProfileService: Documents found:', result.documents.length);

      if (result.documents.length > 0) {
        const profile = result.documents[0];
        console.log('ProfileService: Returning profile:', profile);
        
        // Cache the result with profile and user tags
        cacheManager.set(this.PROFILE_CACHE, ownerId, profile, {
          ttl: 300000, // 5 minutes
          tags: ['profile', `user:${ownerId}`]
        });
        
        return profile;
      }

      console.log('ProfileService: No profile found for owner ID:', ownerId);
      return null;
    } catch (error) {
      console.error('ProfileService: Error getting profile:', error);
      return null;
    }
  }

  /**
   * Create user profile
   */
  async createProfile(
    ownerId: string,
    displayName: string,
    bio?: string,
    avatarData?: string
  ): Promise<User> {
    const data: any = {
      displayName,
      bio: bio || ''
    };

    // If avatar data provided, create avatar document first
    if (avatarData) {
      const avatarId = await this.createAvatar(ownerId, avatarData);
      data.avatarId = avatarId;
    }

    const result = await this.create(ownerId, data);
    
    // Invalidate cache for this user
    cacheManager.invalidateByTag(`user:${ownerId}`);
    
    return result;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    ownerId: string,
    updates: {
      displayName?: string;
      bio?: string;
      avatarData?: string;
    }
  ): Promise<User | null> {
    try {
      // Get existing profile
      const profile = await this.getProfile(ownerId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const data: any = {};
      
      if (updates.displayName !== undefined) {
        data.displayName = updates.displayName;
      }
      
      if (updates.bio !== undefined) {
        data.bio = updates.bio;
      }

      // Handle avatar update
      if (updates.avatarData !== undefined) {
        if (updates.avatarData) {
          // Create or update avatar
          const avatarId = await this.createOrUpdateAvatar(ownerId, updates.avatarData, profile.avatarId);
          data.avatarId = avatarId;
        } else {
          // Remove avatar
          data.avatarId = null;
          if (profile.avatarId) {
            await this.deleteAvatar(profile.avatarId, ownerId);
          }
        }
      }

      // Update profile document
      const profileDoc = await this.query({
        where: [['$ownerId', '==', ownerId]],
        limit: 1
      });

      if (profileDoc.documents.length > 0) {
        const docId = profileDoc.documents[0].id;
        const result = await this.update(docId, ownerId, data);
        
        // Invalidate cache for this user
        cacheManager.invalidateByTag(`user:${ownerId}`);
        
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Get username from DPNS
   */
  private async getUsername(ownerId: string): Promise<string | null> {
    // Check cache
    const cached = cacheManager.get<string>(this.USERNAME_CACHE, ownerId);
    if (cached) {
      return cached;
    }

    try {
      const username = await dpnsService.resolveUsername(ownerId);
      
      if (username) {
        // Cache the result with user and username tags
        cacheManager.set(this.USERNAME_CACHE, ownerId, username, {
          ttl: 300000, // 5 minutes
          tags: ['username', `user:${ownerId}`]
        });
      }

      return username;
    } catch (error) {
      console.error('Error resolving username:', error);
      return null;
    }
  }

  /**
   * Get avatar document
   */
  private async getAvatarDocument(avatarId: string): Promise<AvatarDocument | null> {
    try {
      const sdk = await getWasmSdk();
      
      const response = await get_document(
        sdk,
        this.contractId,
        'avatar',
        avatarId
      );

      if (response) {
        // get_document returns an object directly
        return response;
      }
    } catch (error) {
      console.error('Error getting avatar document:', error);
    }

    return null;
  }

  /**
   * Get avatar data
   */
  private async getAvatarData(avatarId: string): Promise<string | undefined> {
    // Check cache
    const cached = cacheManager.get<string>(this.AVATAR_CACHE, avatarId);
    if (cached) {
      return cached;
    }

    try {
      const sdk = await getWasmSdk();
      
      const response = await get_document(
        sdk,
        this.contractId,
        'avatar',
        avatarId
      );

      if (response) {
        // get_document returns an object directly
        const doc = response as AvatarDocument;
        
        // Cache the result with avatar tag
        cacheManager.set(this.AVATAR_CACHE, avatarId, doc.data, {
          ttl: 1800000, // 30 minutes (avatars change less frequently)
          tags: ['avatar', `user:${doc.$ownerId}`]
        });

        return doc.data;
      }
    } catch (error) {
      console.error('Error getting avatar:', error);
    }

    return undefined;
  }

  /**
   * Create avatar document
   */
  private async createAvatar(ownerId: string, avatarData: string): Promise<string> {
    const sdk = await getWasmSdk();
    
    const result = await stateTransitionService.createDocument(
      this.contractId,
      'avatar',
      ownerId,
      { data: avatarData }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create avatar');
    }
    
    return result.document.$id;
  }

  /**
   * Create or update avatar
   */
  private async createOrUpdateAvatar(
    ownerId: string,
    avatarData: string,
    existingAvatarId?: string
  ): Promise<string> {
    if (existingAvatarId) {
      // Update existing avatar
      const sdk = await getWasmSdk();
      
      // Get current avatar document to find revision
      const currentAvatar = await this.getAvatarDocument(existingAvatarId);
      if (!currentAvatar) {
        throw new Error('Avatar not found');
      }
      
      const result = await stateTransitionService.updateDocument(
        this.contractId,
        'avatar',
        existingAvatarId,
        ownerId,
        { data: avatarData },
        (currentAvatar as any).$revision || 0
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update avatar');
      }
      
      // Clear cache
      cacheManager.delete(this.AVATAR_CACHE, existingAvatarId);
      
      return existingAvatarId;
    } else {
      // Create new avatar
      return this.createAvatar(ownerId, avatarData);
    }
  }

  /**
   * Delete avatar document
   */
  private async deleteAvatar(avatarId: string, ownerId: string): Promise<void> {
    try {
      const sdk = await getWasmSdk();
      
      const result = await stateTransitionService.deleteDocument(
        this.contractId,
        'avatar',
        avatarId,
        ownerId
      );
      
      if (!result.success) {
        console.error('Failed to delete avatar:', result.error);
      }
      
      // Clear cache
      cacheManager.delete(this.AVATAR_CACHE, avatarId);
    } catch (error) {
      console.error('Error deleting avatar:', error);
    }
  }

  /**
   * Get user statistics (followers/following)
   */
  private async getUserStats(userId: string): Promise<{
    followers: number;
    following: number;
  }> {
    // This would query follow documents
    // For now, return 0s
    return {
      followers: 0,
      following: 0
    };
  }
}

// Singleton instance
export const profileService = new ProfileService();

// Import at the bottom to avoid circular dependency
import { getWasmSdk } from './wasm-sdk-service';
import { get_document } from '../dash-wasm/wasm_sdk';
import { stateTransitionService } from './state-transition-service';