'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrarModal } from '@/components/id/registrar-modal'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'

export default function DPNSRegisterPage() {
    const router = useRouter()
    const { user, logout } = useAuth()
    const [isModalOpen, setIsModalOpen] = useState(false)

    useEffect(() => {
        // Only open modal if user is authenticated
        if (user) {
            setIsModalOpen(true)
        }
    }, [user])

    const handleClose = () => {
        setIsModalOpen(false)
        // Navigate to profile creation without username
        // router.push('/profile/create')
    }

    // If not authenticated, show login prompt
    if (!user) {
        return (
            <>
                <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                            Claim Your DashPay Username in 3 EASY Steps
                        </h2>

                        <p className="text-gray-600 font-medium text-lg dark:text-gray-400 mb-6">
                            To begin, you need to log in with your Dash wallet.
                        </p>

                        <div className="space-y-4">
                            <Link
                                href="/connect"
                                className="block w-full text-center font-bold tracking-wider bg-purple-600 text-slate-100 text-xl py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Get Connected
                            </Link>

                            <Link
                                href="/"
                                className="block w-full text-center font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Username modal */}
                <RegistrarModal isOpen={isModalOpen} onClose={handleClose} />
            </>
        )
    }

    // If user already has a DPNS username, redirect
    if (user.dpnsUsername) {
        router.push('/')

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
                    <p className="text-gray-600 dark:text-gray-400">
                        You already have a DPNS username: {user.dpnsUsername}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Background content */}
            <div className="min-h-screen bg-gray-50 dark:bg-black">
                <div className="flex items-center justify-center min-h-screen">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Register DPNS Username
                            </h2>

                            <button
                                onClick={logout}
                                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                                Logout
                            </button>
                        </div>

                        <p className="text-gray-600 dark:text-gray-400">
                            Setting up your username...
                        </p>
                    </div>
                </div>
            </div>

            {/* Username modal */}
            <RegistrarModal isOpen={isModalOpen} onClose={handleClose} />
        </>
    )
}
