'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { GuestPage } from './landing'
import { DashboardPage } from './maison'

export default function PublicHomePage() {
    const router = useRouter()
    const { user } = useAuth()
    const [isHydrated, setIsHydrated] = useState(false)

    // Prevent hydration mismatches
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Redirect logic is handled within the child components.
    // GuestPage does not redirect, DashboardPage redirects if !user.

    // Show loading skeleton during hydration
    if (!isHydrated) {
        return (
            <div className="min-h-screen flex">
                {/* Sidebar skeleton */}
                <div className="fixed h-screen w-[275px] px-2 py-4">
                    <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-6 animate-pulse" />

                    <div className="space-y-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
                        ))}
                    </div>

                    <div className="mt-8 h-12 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
                </div>

                {/* Main content skeleton */}
                <main className="flex-1 mx-auto px-8 py-16">
                    <div className="text-center mb-16">
                        <div className="h-16 w-96 bg-gray-200 dark:bg-gray-800 rounded mx-auto mb-4 animate-pulse" />
                        <div className="h-6 w-[500px] bg-gray-100 dark:bg-gray-900 rounded mx-auto mb-8 animate-pulse" />

                        <div className="flex gap-4 justify-center">
                            <div className="h-12 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                            <div className="h-12 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return user ? <DashboardPage /> : <GuestPage />
}
