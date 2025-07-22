'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { SdkProvider } from '@/contexts/sdk-context'
import { UsernameModalProvider } from '@/components/dpns/username-modal-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SdkProvider>
      <AuthProvider>
        {children}
        <UsernameModalProvider />
      </AuthProvider>
    </SdkProvider>
  )
}