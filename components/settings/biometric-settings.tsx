'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { biometricStorage, clearBiometricPrivateKey } from '@/lib/biometric-storage'
import { Switch } from '@radix-ui/react-switch'
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { ShieldCheckIcon, FingerPrintIcon, FaceSmileIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export function BiometricSettings() {
    const { user } = useAuth()
    const [isAvailable, setIsAvailable] = useState(false)
    const [isEnabled, setIsEnabled] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        checkBiometricStatus()
    }, [user])

    const checkBiometricStatus = async () => {
        if (!user) {
            setIsLoading(false)
            return
        }

        try {
            // Check if biometric is available on this device
            const available = await biometricStorage.isAvailable()
            setIsAvailable(available)

            if (available) {
                // Check if already registered
                const credentialData = localStorage.getItem('yappr_bio_credential')
                setIsEnabled(!!credentialData)
            }
        } catch (error) {
            console.error('Error checking biometric status:', error)
        } finally {
            setIsLoading(false)
        }

        const handleToggleBiometric = async () => {
            if (!user) return

            try {
                if (isEnabled) {
                    // Disable biometric
                    await clearBiometricPrivateKey(user.identityId)

                    localStorage.removeItem('yappr_bio_credential')

                    setIsEnabled(false)

                    toast.success('Biometric authentication disabled')
                } else {
                    // Enable biometric
                    const registered = await biometricStorage.register(user.identityId)

                    if (registered) {
                        setIsEnabled(true)

                        toast.success('Biometric authentication enabled! Your private key will be protected.')
                    } else {
                        toast.error('Failed to enable biometric authentication')
                    }
                }
            } catch (error) {
                console.error('Error toggling biometric:', error)
                toast.error('Failed to update biometric settings')
            }
        }

        if (isLoading) {
            return (
                <div>CARD GOES HERE</div>
                // <Card>
                //   <CardContent className="pt-6">
                //     <div className="animate-pulse space-y-2">
                //       <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                //       <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                //     </div>
                //   </CardContent>
                // </Card>
            )
        }

        if (!isAvailable) {
            return (
                <div>CARD GOES HERE</div>
                // <Card>
                //   <CardHeader>
                //     <CardTitle className="flex items-center gap-2">
                //       <ShieldCheckIcon className="h-5 w-5" />
                //       Biometric Authentication
                //     </CardTitle>
                //     <CardDescription>
                //       Biometric authentication is not available on this device
                //     </CardDescription>
                //   </CardHeader>
                //   <CardContent>
                //     <p className="text-sm text-gray-500">
                //       Your device doesn&apos;t support Touch ID, Face ID, or Windows Hello.
                //       Private keys will be stored in memory for the duration of your session only.
                //     </p>
                //   </CardContent>
                // </Card>
            )
        }

        return (
            <div>CARD GOES HERE</div>
            // <Card>
            //   <CardHeader>
            //     <CardTitle className="flex items-center gap-2">
            //       <ShieldCheckIcon className="h-5 w-5" />
            //       Biometric Authentication
            //     </CardTitle>
            //     <CardDescription>
            //       Protect your private key with your device&apos;s biometric authentication
            //     </CardDescription>
            //   </CardHeader>
            //   <CardContent className="space-y-4">
            //     <div className="flex items-center justify-between">
            //       <div className="space-y-1">
            //         <div className="flex items-center gap-2">
            //           <FingerPrintIcon className="h-4 w-4 text-gray-500" />
            //           <span className="font-medium">Enable Biometric Protection</span>
            //         </div>
            //         <p className="text-sm text-gray-500">
            //           Store your private key securely for up to 30 days
            //         </p>
            //       </div>
            //       <Switch
            //         checked={isEnabled}
            //         onCheckedChange={handleToggleBiometric}
            //         disabled={!user}
            //       />
            //     </div>

            //     {isEnabled && (
            //       <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            //         <div className="flex gap-3">
            //           <FaceSmileIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            //           <div className="space-y-1">
            //             <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            //               Biometric protection is active
            //             </p>
            //             <p className="text-sm text-blue-700 dark:text-blue-300">
            //               You&apos;ll be prompted to authenticate with Touch ID, Face ID, or Windows Hello when posting or performing other actions.
            //               Your private key is encrypted and will expire after 30 days.
            //             </p>
            //           </div>
            //         </div>
            //       </div>
            //     )}

            //     <div className="pt-4 border-t">
            //       <h4 className="font-medium mb-2">How it works:</h4>
            //       <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            //         <li className="flex gap-2">
            //           <span className="text-purple-500">•</span>
            //           Your private key is encrypted using your device&apos;s secure enclave
            //         </li>
            //         <li className="flex gap-2">
            //           <span className="text-purple-500">•</span>
            //           Biometric authentication is required to decrypt and use the key
            //         </li>
            //         <li className="flex gap-2">
            //           <span className="text-purple-500">•</span>
            //           The encrypted key is stored locally and expires after 30 days
            //         </li>
            //         <li className="flex gap-2">
            //           <span className="text-purple-500">•</span>
            //           You can disable this feature at any time
            //         </li>
            //       </ul>
            //     </div>
            //   </CardContent>
            // </Card>
        )
    }
}
