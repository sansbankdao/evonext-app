// app/landing.tsx

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

export function LandingPage() {
    return (
        // 3. Changed to h-[100dvh] and overflow-y-auto for independent scrolling
        <div className="relative h-[100dvh] w-full pt-72 sm:pt-48 mb-5 bg-[#0e0f14] flex items-center justify-center overflow-y-auto selection:bg-purple-500/30">

            {/* Dark Purple Gradient Background */}
            <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#1a0c2e] via-[#110b1e] to-[#0e0f14]" />

            {/* Subtle Grid/Texture Overlay */}
            <div className="fixed inset-0 z-0 opacity-20"
                 style={{ backgroundImage: 'radial-gradient(#6b21a8 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />

            {/* Content Container */}
            <div className="relative z-10 flex w-full max-w-[1400px] min-h-screen px-4 sm:px-8 lg:px-12">

                {/* Left Side: Content & Downloads */}
                <div className="flex flex-col justify-center w-full lg:w-1/2 py-16 lg:py-8 space-y-10">

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-6"
                    >
                        <h1 className="text-5xl sm:text-7xl font-bold text-white tracking-tight leading-tight">
                            Enjoy
                            <span className="mx-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400">
                                Free
                            </span>
                            and

                            <span className="block">
                                <span className="mr-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400">
                                    Fearless
                                </span>
                                Social
                            </span>
                        </h1>

                        <p className="text-pretty text-lg sm:text-xl text-slate-200 max-w-lg leading-9">
                            Connect with early-stage <span className="font-bold">Founders</span> and <span className="font-bold">Creators</span> — enhance your daily life with the hottest collection of Mini Apps <span className="font-bold">designed to streamline your workflow and simplify everyday tasks.</span>
                        </p>
                    </motion.div>

                    {/* DOWNLOAD ACTIONS */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="space-y-6"
                    >
                        {/* Primary Call to Action */}
                        <div className="flex flex-col gap-4 max-w-md">
                            <Link href="https://github.com/sansbankdao/evonext-desktop/releases" target="_blank" rel="noopener noreferrer">
                                <Button
                                    size="lg"
                                    className="w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-lg font-bold border-none shadow-[0_0_20px_rgba(124,58,237,0.3)] group"
                                >
                                    <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                                    EvoNext for Desktop
                                    <ArrowRightIcon className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>

                            <Link href="https://sansbank.org/bootstrap" target="_blank" rel="noopener noreferrer">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full h-14 bg-white/5 border-white/20 hover:bg-white/10 text-white text-lg font-bold backdrop-blur-sm flex items-center justify-between px-6"
                                >
                                    <span className="flex items-center">
                                        {/* Apple Logo Placeholder (SVG) */}
                                        <svg className="w-6 h-6 mr-3 fill-current" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.8-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.5 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.27-2.15 3.77.03 2.97 2.63 3.97 2.65 4-.01.07-.41 1.41-1.35 2.9M13 3.85c.69-.83 1.16-1.99 1.03-3.15-1 .04-2.22.67-2.94 1.51-.64.75-1.2 1.93-1.05 3.04 1.12.09 2.27-.6 2.96-1.4z"/></svg>
                                        Download for iOS
                                    </span>
                                </Button>
                            </Link>

                            <Link href="https://apk.evonext.app" rel="noopener noreferrer">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full h-14 bg-white/5 border-white/20 hover:bg-white/10 text-white text-lg font-bold backdrop-blur-sm flex items-center justify-between px-6"
                                >
                                    <span className="flex items-center">
                                        {/* Android Logo Placeholder (SVG) */}
                                        <svg className="w-6 h-6 mr-3 fill-current" viewBox="0 0 24 24"><path d="M17.523 15.3414C17.523 16.7262 16.3822 17.8514 14.979 17.8514C13.5757 17.8514 12.4349 16.7262 12.4349 15.3414C12.4349 13.9566 13.5757 12.8314 14.979 12.8314C16.3822 12.8314 17.523 13.9566 17.523 15.3414ZM6.21143 15.3414C6.21143 16.7262 5.07063 17.8514 3.6674 17.8514C2.26416 17.8514 1.12336 16.7262 1.12336 15.3414C1.12336 13.9566 2.26416 12.8314 3.6674 12.8314C5.07063 12.8314 6.21143 13.9566 6.21143 15.3414Z"/><path d="M21.9543 10.5563C21.749 10.222 21.4415 9.96064 21.0737 9.80854C20.9938 9.7763 20.5086 9.58666 19.4976 9.32291C19.4596 8.2579 19.1199 7.21514 18.5273 6.31743C18.3357 6.03377 18.1234 5.76845 17.8938 5.52473L17.7317 5.35452C17.6178 5.23603 17.5008 5.12231 17.3812 5.01365C16.6506 4.36029 15.746 4.00818 14.8336 4.00818C14.6991 4.00818 14.5653 4.01642 14.4334 4.03164C13.9165 3.13323 12.9438 2.56212 11.9354 2.56212C11.6734 2.56212 11.4119 2.59523 11.1565 2.66085C10.5921 2.80951 10.1049 3.12799 9.75365 3.5739C9.4024 3.12799 8.91519 2.80951 8.35078 2.66085C8.09543 2.59523 7.83396 2.56212 7.57195 2.56212C6.56352 2.56212 5.59087 3.13323 5.07395 4.03164C4.94196 4.01642 4.80821 4.00818 4.67372 4.00818C3.76128 4.00818 2.85674 4.36029 2.12615 5.01365C2.00653 5.12231 1.88958 5.23603 1.77565 5.35452L1.6135 5.52473C1.38395 5.76845 1.17157 6.03377 0.979998 6.31743C0.387436 7.21514 0.0477366 8.2579 0.00972035 9.32292C-1.00126 9.58666 -1.48649 9.7763 -1.56634 9.80854C-1.9342 9.96064 -2.24163 10.222 -2.44691 10.5563L-2.51754 10.6736L-2.51978 14.2929L-2.63786 14.3115C-3.17491 14.4001 -3.57315 14.8705 -3.57315 15.4148C-3.57315 16.0296 -3.07366 16.5291 -2.45888 16.5291L-2.16503 16.5291L-2.14925 19.0682C-2.14434 19.8423 -1.5121 20.4745 -0.738001 20.4745L1.60687 20.4745C2.40313 20.4745 3.10413 19.8573 3.20319 19.0665L3.51977 16.5291L14.9875 16.5291L15.3041 19.0665C15.4032 19.8573 16.1042 20.4745 16.9004 20.4745L19.2453 20.4745C20.0194 20.4745 20.6517 19.8423 20.6566 19.0682L20.6723 16.5291L20.9662 16.5291C21.581 16.5291 22.0805 16.0296 22.0805 15.4148C22.0805 14.8705 21.6822 14.4001 21.1452 14.3115L21.0271 14.2929L21.0248 10.6736L21.9543 10.5563ZM19.9868 13.2004L19.9754 14.2065L18.6382 14.2065L18.6723 11.3987C18.6723 11.3987 18.6731 11.396 18.6731 11.3943C18.6731 11.3943 18.6743 11.3914 18.6743 11.3891C19.6987 11.6546 19.9868 13.2004 19.9868 13.2004ZM1.38303 9.69528C2.01998 10.2381 2.78272 10.6198 3.60262 10.8086L3.60262 11.3941C3.60262 11.396 3.6034 11.3986 3.6034 11.4007L3.56937 14.2065L2.23212 14.2065L2.24355 13.2004C2.24355 13.2004 2.53162 11.6546 3.55597 11.3891C3.55597 11.3914 3.55719 11.3943 3.55719 11.3943C3.55719 11.396 3.558 11.3986 3.558 11.3987C2.81663 11.2144 2.15935 10.8226 1.59606 10.2748L1.38303 9.69528Z"/></svg>
                                        Get it on Android
                                    </span>
                                </Button>
                            </Link>
                        </div>
                    </motion.div>

                    <div className="pt-8 text-gray-500 text-sm">
                        <span className="block my-2">
                            Powered by ⚡️ <Link href="https://www.dash.org/platform" target="_blank" className="font-bold hover:text-purple-400">Dash Ξvolution Platform</Link>
                        </span>

                        &copy; {new Date().getFullYear()}
                        <Link href="https://sansbank.org" target="_blank" className="pl-1 font-bold hover:text-purple-400">Sansbank DAO</Link>.
                        All rights reserved.

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-2 font-medium text-gray-400">
                            <Link href="https://studio.evonext.dev" target="_blank" className="hover:text-purple-400">
                                Mini App Studio
                            </Link>
                            <span className="hidden sm:inline-flex">•</span>
                            <Link href="#" className="hover:text-purple-400">
                                Support
                            </Link>
                            <span className="hidden sm:inline-flex">•</span>
                            <Link href="#" className="hover:text-purple-400">
                                Privacy
                            </Link>
                            <span className="hidden sm:inline-flex">•</span>
                            <Link href="#" className="hover:text-purple-400">
                                Terms
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Side: Phone Mockup */}
                <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative pl-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="relative w-[320px] h-[650px]"
                    >
                        {/* Phone Frame */}
                        <div className="absolute inset-0 bg-[#000] rounded-[3rem] border-8 border-[#1a1a1a] shadow-2xl overflow-hidden">
                            {/* Screen Glow */}
                            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none z-10" />

                            {/* 1. Screen Content: Replaced with next/image */}
                            <div className="relative w-full h-full bg-[#111]">
                                <Image
                                    src="/screenshot.webp"
                                    alt="EvoNext App Interface"
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>

                        {/* Decorative elements floating */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600 rounded-full blur-[80px] opacity-40 animate-pulse" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600 rounded-full blur-[80px] opacity-40 animate-pulse" />
                    </motion.div>
                </div>

            </div>
        </div>
    )
}
