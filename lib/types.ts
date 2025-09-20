export interface IApp {
    id: string;
    type: 'blog' | 'game' | null | undefined;
    engine: 'p5' | 'phaser' | 'godot' | null | undefined;
    creator: IUser;
    content: string;
    createdAt: Date;
    likes: number;
    postId: string;
}

export interface IAppState {
    currentUser: IUser | null;
    theme: 'light' | 'dark';
    isComposeOpen: boolean;
    replyingTo: IPost | null;

    setCurrentUser: (user: IUser | null) => void;
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    setComposeOpen: (open: boolean) => void;
    setReplyingTo: (post: IPost | null) => void;
}

export interface IComment {
    id: string;
    author: IUser;
    content: string;
    createdAt: Date;
    likes: number;
    liked?: boolean;
    postId: string;
}

export interface ICurrency {
    USD: any;
}

export interface IMedia {
    id: string;
    type: 'image' | 'video' | 'gif';
    url: string;
    thumbnail?: string;
    alt?: string;
    width?: number;
    height?: number;
}

export interface INotification {
    id: string;
    type: 'like' | 'remix' | 'follow' | 'reply' | 'mention';
    from: IUser;
    post?: IPost;
    createdAt: Date;
    read: boolean;
}

export interface IPost {
    id: string;
    author: IUser;
    content: string;
    createdAt: Date;
    likes: number;
    remixes: number;
    replies: number;
    views: number;
    liked?: boolean;
    remixed?: boolean;
    bookmarked?: boolean;
    media?: IMedia[];
    replyTo?: IPost;
    quotedPost?: IPost;
}

export interface IToken {
    id: string;
    name: string;
    ticker: string;
    token_id_hex: string;
    iconUrl: string;
    duffs?: bigint;
    amount?: bigint;
    decimal_places: number;
    fiat: ICurrency;
}

export interface ITrend {
    topic: string;
    posts: number;
    category?: string;
}

export interface ITxError {
    code: number;
    message: string;
    suggestions?: [string];
}

export interface ITxSuccess {
    txid: string;
}

export interface IUser {
    id: string;
    docId?: string;         // Document that stores the user's profile
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
