'use client'

import { AppModalProvider } from '@/components/apps/app-modal-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { NetworkProvider } from '@/contexts/network-context'
import { SdkProvider } from '@/contexts/sdk-context'
import { UsernameModalProvider } from '@/components/dpns/username-modal-provider'
import { BiometricPrompt } from '@/components/ui/biometric-prompt'
import { useBiometricPrompt } from '@/hooks/use-biometric-prompt'

function BiometricPromptWrapper() {
    const { isOpen } = useBiometricPrompt()
    return <BiometricPrompt isOpen={isOpen} />
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <NetworkProvider>
            <SdkProvider>
                <AuthProvider>
                    {children}

                    <AppModalProvider />
                    <UsernameModalProvider />

                    <BiometricPromptWrapper />
                </AuthProvider>
            </SdkProvider>
        </NetworkProvider>
    )
}
