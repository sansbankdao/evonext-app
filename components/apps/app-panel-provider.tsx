'use client'

import { AppPanel } from './app-panel'
import { useAppPanel } from '@/hooks/use-app-panel'

export function AppPanelProvider() {
    const { isOpen, identityId, close } = useAppPanel()

    return <AppPanel isOpen={isOpen} onClose={close} customIdentityId={identityId} />
}
