'use client'

import { useState } from 'react'
import {
    ArrowLeftIcon,
    GiftIcon,
    QrCodeIcon,
    PaperAirplaneIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

/* Import (local) components. */
import { GiftsHero } from '@/components/gifts/GiftsHero'
import { CreateGiftFlow } from '@/components/gifts/CreateGiftFlow'
import { ClaimGiftFlow } from '@/components/gifts/ClaimGiftFlow'
import { GiftsActivity } from '@/components/gifts/GiftsActivity'

export default function GiftsPage() {
    const [mode, setMode] = useState<'menu' | 'create' | 'claim'>('menu')

    const resetFlow = () => {
        setMode('menu')
    }

    return (
        // overflow-y-auto is required here because the root layout has overflow-y-hidden
        <div className="w-full h-full overflow-y-auto bg-gray-50 dark:bg-gray-950 relative">

            {/* Navigation Bar - Sticky Top */}
            <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={mode === 'menu' ? () => {} : resetFlow}
                        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        {mode === 'menu' ? (
                            <Link href="/" className="inline-flex items-center gap-2">
                                <ArrowLeftIcon className="h-5 w-5" />
                                Back to App
                            </Link>
                        ) : (
                            <div className="inline-flex items-center gap-2 cursor-pointer">
                                <ArrowLeftIcon className="h-5 w-5" />
                                Back
                            </div>
                        )}
                    </button>

                    <div className="flex items-center gap-2">
                        <GiftIcon className="h-6 w-6 text-evonext-500" />
                        <span className="font-bold text-lg tracking-tight">Evo Gifts</span>
                    </div>

                    {/* Spacer to balance layout */}
                    <div className="w-16"></div>
                </div>
            </nav>

            <main className="w-full max-w-7xl mx-auto px-4 py-8 pb-20">

                {/* SECTION: HERO HEADER */}
                <GiftsHero />

                {/* SECTION: MAIN CONTENT AREA */}
                <AnimatePresence mode="wait">

                    {/* VIEW: MENU (Cards with Images) */}
                    {mode === 'menu' && (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid md:grid-cols-2 gap-8 mb-16"
                        >
                            {/* Create Gift Card */}
                            <button
                                onClick={() => setMode('create')}
                                className="group relative h-80 w-full rounded-2xl overflow-hidden shadow-lg text-left transition-all hover:shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gray-900">
                                    {/* Using a fallback solid color + gradient instead of external image for safety */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                                </div>

                                <div className="relative h-full flex flex-col justify-end p-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-2xl font-bold text-white">Create Gift</h3>
                                        <div className="h-10 w-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg group-hover:bg-evonext-500 group-hover:border-evonext-500 transition-colors">
                                            <PaperAirplaneIcon className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <p className="text-gray-300 text-sm opacity-80 max-w-md">
                                        Lock Dash in a smart contract and share the code.
                                    </p>
                                </div>
                            </button>

                            {/* Claim Gift Card */}
                            <button
                                onClick={() => setMode('claim')}
                                className="group relative h-80 w-full rounded-2xl overflow-hidden shadow-lg text-left transition-all hover:shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gray-900">
                                    <div className="absolute inset-0 bg-gradient-to-bl from-cyan-500 via-blue-500 to-indigo-500 opacity-80" />
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                                </div>

                                <div className="relative h-full flex flex-col justify-end p-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-2xl font-bold text-white">Claim Gift</h3>
                                        <div className="h-10 w-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg group-hover:bg-white group-hover:text-black transition-colors">
                                            <QrCodeIcon className="h-5 w-5 text-white group-hover:text-black" />
                                        </div>
                                    </div>
                                    <p className="text-gray-300 text-sm opacity-80 max-w-md">
                                        Enter your unique code to unlock funds instantly.
                                    </p>
                                </div>
                            </button>
                        </motion.div>
                    )}

                    {/* VIEW: CREATE FLOW */}
                    {mode === 'create' && <CreateGiftFlow />}

                    {/* VIEW: CLAIM FLOW */}
                    {mode === 'claim' && <ClaimGiftFlow />}

                </AnimatePresence>

                {/* SECTION: SCROLLABLE FEED (Mock Data) */}
                <GiftsActivity />

                <div className="h-20"></div>
            </main>
        </div>
    )
}
