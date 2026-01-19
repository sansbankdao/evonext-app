// app/gifts/page.tsx

'use client'

import { useState } from 'react'
import {
    ArrowLeftIcon,
    GiftIcon,
    QrCodeIcon,
    PaperAirplaneIcon,
    FingerPrintIcon,
    CheckIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

/* Import (local) components. */
import { GiftsHero } from '@/components/gifts/GiftsHero'
import { CreateGiftFlow } from '@/components/gifts/CreateGiftFlow'
import { ClaimGiftFlow } from '@/components/gifts/ClaimGiftFlow'
import { GiftsActivity } from '@/components/gifts/GiftsActivity'

/* Import Passkey Utilities */
import { createPasskey, getPasskey, bufferToHex, type PasskeyResult } from '@/lib/passkey'

export default function GiftsPage() {
    const [mode, setMode] = useState<'menu' | 'create' | 'claim'>('menu')

    // Passkey State
    const [walletResult, setWalletResult] = useState<PasskeyResult | null>(null)
    const [isLoadingPasskey, setIsLoadingPasskey] = useState(false)

    const resetFlow = () => {
        setMode('menu')
    }

    const handleRegisterWallet = async () => {
        setIsLoadingPasskey(true)
        try {
            // 1. Create the Passkey & Get Entropy
            const result = await createPasskey('evonext_user')

            // 2. Set the state (In a real app, you would store this or use it to derive an address)
            setWalletResult(result)

            // 3. Feedback
            console.log('Wallet Entropy (Hex):', bufferToHex(result.entropy))
            toast.success('Wallet Created via Passkey!', {
                duration: 3000,
                style: {
                    border: '1px solid #4ade80',
                    padding: '16px',
                    color: '#fff',
                }
            })
        } catch (err) {
            console.error(err)
            toast.error('Failed to create passkey.')
        } finally {
            setIsLoadingPasskey(false)
        }
    }

    const handleLoginWallet = async () => {
        setIsLoadingPasskey(true)
        try {
            // 1. Get Passkey & Re-derive Entropy
            const result = await getPasskey()

            // 2. Set state
            setWalletResult(result)

            // 3. Feedback
            console.log('Wallet Entropy (Hex):', bufferToHex(result.entropy))
            toast.success('Wallet Signed In via Passkey!', {
                duration: 3000,
                style: {
                    border: '1px solid #60a5fa',
                    padding: '16px',
                    color: '#fff',
                }
            })
        } catch (err) {
            console.error(err)
            toast.error('Failed to sign in.')
        } finally {
            setIsLoadingPasskey(false)
        }
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

                    {/* Passkey Status Indicator */}
                    <div className="w-16 text-right">
                        {walletResult && (
                            <span className="text-xs font-mono text-green-500 flex items-center justify-end gap-1 animate-pulse">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Ready
                            </span>
                        )}
                    </div>
                </div>
            </nav>

            <main className="w-full max-w-7xl mx-auto px-4 py-8 pb-20">

                {/* SECTION: HERO HEADER */}
                <GiftsHero />

                {/* SECTION: PASSKEY WALLET MANAGER (NEW) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <div className="bg-white dark:bg-black rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <FingerPrintIcon className="h-5 w-5 text-gray-900 dark:text-gray-100" />
                                Passkey Wallet
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Create a secure wallet using FaceID/TouchID or sign in to an existing one.
                                No passwords required.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            {!walletResult ? (
                                <>
                                    <button
                                        onClick={handleRegisterWallet}
                                        disabled={isLoadingPasskey}
                                        className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoadingPasskey ? (
                                            <span>Creating...</span>
                                        ) : (
                                            <span>Create Wallet</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleLoginWallet}
                                        disabled={isLoadingPasskey}
                                        className="px-6 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoadingPasskey ? (
                                            <span>Signing...</span>
                                        ) : (
                                            <span>Sign In</span>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Entropy Hash</span>
                                        <span className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate max-w-[150px] md:max-w-xs">
                                            {bufferToHex(walletResult.entropy)}
                                        </span>
                                    </div>
                                    <div className="h-8 w-px bg-gray-200 dark:border-gray-700"></div>
                                    <button
                                        onClick={() => setWalletResult(null)}
                                        className="text-xs text-red-500 hover:text-red-600 font-medium underline"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

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
