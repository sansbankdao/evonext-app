export interface Comment {
    id: string;
    author: User;
    content: string;
    createdAt: Date;
    likes: number;
    liked?: boolean;
    postId: string;
}

export interface Media {
    id: string;
    type: 'image' | 'video' | 'gif';
    url: string;
    thumbnail?: string;
    alt?: string;
    width?: number;
    height?: number;
}

export interface Notification {
    id: string;
    type: 'like' | 'repost' | 'follow' | 'reply' | 'mention';
    from: User;
    post?: Post;
    createdAt: Date;
    read: boolean;
}

export interface Post {
    id: string;
    author: User;
    content: string;
    createdAt: Date;
    likes: number;
    reposts: number;
    replies: number;
    views: number;
    liked?: boolean;
    reposted?: boolean;
    bookmarked?: boolean;
    media?: Media[];
    replyTo?: Post;
    quotedPost?: Post;
}

export interface Trend {
    topic: string;
    posts: number;
    category?: string;
}

export interface User {
    id: string;
    docId: string;          // Document that stores the user's profile
    username: string;       // From DPNS - not stored in profile document
    displayName: string;
    avatar: string;         // URL for display
    avatarId?: string;      // Reference to avatar document (32-byte array as string)
    avatarData?: string;    // The encoded avatar string (16-128 chars)
    bio?: string;
    followers: number;
    following: number;
    verified?: boolean;
    joinedAt: Date;
    revision: number;
}
