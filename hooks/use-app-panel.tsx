import { create } from 'zustand'

interface AppPanelStore {
    isOpen: boolean
    identityId?: string
    open: (identityId?: string) => void
    close: () => void
}

export const useAppPanel = create<AppPanelStore>((set) => ({
    isOpen: false,
    identityId: undefined,
    open: (identityId) => set({ isOpen: true, identityId }),
    close: () => set({ isOpen: false, identityId: undefined }),
}))
