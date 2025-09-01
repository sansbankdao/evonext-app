'use client'

import { create } from 'zustand'

interface BiometricPromptState {
    isOpen: boolean
    open: () => void
    close: () => void
}

export const useBiometricPrompt = create<BiometricPromptState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false })
}))
