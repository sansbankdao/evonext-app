'use client'

import { AppModal } from './app-modal'
import { useAppModal } from '@/hooks/use-app-modal'

export function AppModalProvider() {
    const { isOpen, identityId, close } = useAppModal()

    return <AppModal isOpen={isOpen} onClose={close} customIdentityId={identityId} />
}
