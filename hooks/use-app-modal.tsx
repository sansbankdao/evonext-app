import { create } from 'zustand'

interface AppModalStore {
    isOpen: boolean
    identityId?: string
    open: (identityId?: string) => void
    close: () => void
}

export const useAppModal = create<AppModalStore>((set) => ({
    isOpen: false,
    identityId: undefined,
    open: (identityId) => set({ isOpen: true, identityId }),
    close: () => set({ isOpen: false, identityId: undefined }),
}))
