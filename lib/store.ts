/* Import modules. */
import { create } from 'zustand'
import { IAppState } from './types'
import { generateAvatarV2, encodeAvatarFeaturesV2 } from './avatar-generator-v2'

const currentUserAvatarFeatures = generateAvatarV2('londynnlee')
const currentUserAvatarData = encodeAvatarFeaturesV2(currentUserAvatarFeatures)

export const useAppStore = create<IAppState>((set) => ({
    currentUser: {
        id: '1',
        docID: 'abc',
        username: 'londynnlee',
        displayName: 'Londynn Lee',
        avatar: '',
        avatarData: currentUserAvatarData,
        bio: 'Building the future of social media',
        followers: 1337,
        following: 456,
        verified: true,
        joinedAt: new Date('2024-05-05'),
        revision: 1,
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
