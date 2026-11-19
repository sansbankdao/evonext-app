'use client'

import { AppPanelProvider } from '@/components/apps/app-panel-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { NetworkProvider } from '@/contexts/network-context'
import { SdkProvider } from '@/contexts/sdk-context'
import { UsernameModalProvider } from '@/components/dpns/username-modal-provider'
/* F61 — the BiometricPrompt mount is REMOVED with lib/biometric-storage
 * (the F27b auth theater — retired; the real unlock UX is the
 * session-lock banner's PRF/password ladder). */

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NetworkProvider>
            <SdkProvider>
                <AuthProvider>
                    {children}

                    <AppPanelProvider />
                    <UsernameModalProvider />
                </AuthProvider>
            </SdkProvider>
        </NetworkProvider>
    )
}
