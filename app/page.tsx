// app/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { LandingPage } from './landing'
import { MaisonPage } from './maison'
import { Sidebar } from '@/components/layout/sidebar'

export default function PublicHomePage() {
    const router = useRouter()
    const { user, isLoading: isAuthLoading } = useAuth()
    const [isHydrated, setIsHydrated] = useState(false)

    // Prevent hydration mismatches
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    useEffect(() => {
        // Only run redirect logic if hydration is complete and auth context is ready
        if (isHydrated && !isAuthLoading) {
            if (user) {
                // If user is authenticated, ensure they are on the dashboard
                // (Optional: You can rely on MaisonPage's internal redirect,
                // but doing it here prevents a flash of the landing page)
                // router.replace('/posts')
            } else {
                // If user is NOT authenticated, MaisonPage will handle redirecting to /
                // However, to ensure a clean state, we don't need to do anything here.
            }
        }
    }, [user, isHydrated, isAuthLoading, router])

    // Show loading skeleton during hydration or initial auth check
    if (!isHydrated || isAuthLoading) {
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

    // Route Logic:
    // - If user exists, show MaisonPage (Dashboard)
    // - If no user, show LandingPage (Guest)
    // NOTE: Ensure you haven't hardcoded redirects inside MaisonPage or LandingPage
    // that conflict with this logic.
    return user ? <MaisonPage /> : <LandingPage />
}
