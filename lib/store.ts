/* Import modules. */
import { create } from 'zustand'
import { User, Post, Comment } from './types'
import { generateAvatarV2, encodeAvatarFeaturesV2 } from './avatar-generator-v2'

interface AppState {
    currentUser: User | null
    theme: 'light' | 'dark'
    isComposeOpen: boolean
    replyingTo: Post | null

    setCurrentUser: (user: User | null) => void
    setTheme: (theme: 'light' | 'dark') => void
    toggleTheme: () => void
    setComposeOpen: (open: boolean) => void
    setReplyingTo: (post: Post | null) => void
}

const currentUserAvatarFeatures = generateAvatarV2('londynnlee')
const currentUserAvatarData = encodeAvatarFeaturesV2(currentUserAvatarFeatures)

export const useAppStore = create<AppState>((set) => ({
    currentUser: {
        id: '1',
        username: 'londynnlee',
        displayName: 'Londynn Lee',
        avatar: '',
        avatarData: currentUserAvatarData,
        bio: 'Building the future of social media',
        followers: 1337,
        following: 456,
        verified: true,
        joinedAt: new Date('2024-05-05'),
    },
    theme: 'light',
    isComposeOpen: false,
    replyingTo: null,

    setCurrentUser: (user) => set({ currentUser: user }),
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({
        theme: state.theme === 'light' ? 'dark' : 'light'
    })),
    setComposeOpen: (open) => set({ isComposeOpen: open }),
    setReplyingTo: (post) => set({ replyingTo: post }),
}))
