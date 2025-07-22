import { create } from 'zustand'

interface UsernameModalStore {
  isOpen: boolean
  identityId?: string
  open: (identityId?: string) => void
  close: () => void
}

export const useUsernameModal = create<UsernameModalStore>((set) => ({
  isOpen: false,
  identityId: undefined,
  open: (identityId) => set({ isOpen: true, identityId }),
  close: () => set({ isOpen: false, identityId: undefined }),
}))