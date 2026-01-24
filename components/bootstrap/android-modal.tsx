// components/bootstrap/android-modal.tsx

'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowDownTrayIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XMarkIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface AndroidModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AndroidModal({ open, onOpenChange }: AndroidModalProps) {
    const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false)

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
                            />
                        </Dialog.Overlay>
                        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                            <Dialog.Content asChild>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="relative w-full max-w-lg bg-[#111218] border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl focus:outline-none max-h-[95vh] overflow-y-auto"
                                >
                                    <Dialog.Title className="text-2xl font-bold text-white flex items-center gap-2">
                                        <svg className="w-6 h-6 fill-blue-400" viewBox="0 0 24 24">
                                            <path d="M17.523 15.3414C17.523 16.7262 16.3822 17.8514 14.979 17.8514C13.5757 17.8514 12.4349 16.7262 12.4349 15.3414C12.4349 13.9566 13.5757 12.8314 14.979 12.8314C16.3822 12.8314 17.523 13.9566 17.523 15.3414ZM6.21143 15.3414C6.21143 16.7262 5.07063 17.8514 3.6674 17.8514C2.26416 17.8514 1.12336 16.7262 1.12336 15.3414C1.12336 13.9566 2.26416 12.8314 3.6674 12.8314C5.07063 12.8314 6.21143 13.9566 6.21143 15.3414Z"/>
                                        </svg>
                                        Android Early Access
                                    </Dialog.Title>

                                    <div className="mt-4 space-y-4">
                                        <Dialog.Description className="text-slate-300 leading-relaxed text-sm sm:text-base">
                                            We are currently raising funds via our <strong>Bootstrap Phase</strong> to finalize publishing EvoNext on the <strong>Google Play Store</strong>.
                                            In the meantime, you can join the community test by side-loading the application.
                                        </Dialog.Description>

                                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] sm:text-xs text-amber-200/80 leading-relaxed uppercase font-medium tracking-tight">
                                                <h3 className="block font-bold">Security Notice</h3>
                                                Only download EvoNext APKs from official sources. Never share your seed phrase with third-party sites.
                                            </p>
                                        </div>

                                        {/* ACCORDION WALKTHROUGH */}
                                        <div className="border border-white/5 rounded-xl bg-black/40 overflow-hidden text-sm">
                                            <button
                                                onClick={() => setIsWalkthroughOpen(!isWalkthroughOpen)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-xs">
                                                    <InformationCircleIcon className="w-4 h-4" />
                                                    Sideloading Walkthrough
                                                </div>
                                                <ChevronDownIcon
                                                    className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isWalkthroughOpen ? 'rotate-180' : ''}`}
                                                />
                                            </button>

                                            <motion.div
                                                initial={false}
                                                animate={{
                                                    height: isWalkthroughOpen ? 'auto' : 0,
                                                    opacity: isWalkthroughOpen ? 1 : 0
                                                }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 pt-0 border-t border-white/5">
                                                    <ol className="text-slate-400 space-y-3 list-decimal ml-4 mt-2">
                                                        <li>Tap the <strong>&quot;Download APK&quot;</strong> button below.</li>
                                                        <li>If prompted, allow your browser to <strong>&quot;Install unknown apps&quot;</strong> in your Android settings.</li>
                                                        <li>Open the downloaded file from your <strong>Notification Bar</strong> or File Manager.</li>
                                                        <li>Select <strong>Install</strong>. Once complete, you&apos;re ready for the Evolution.</li>
                                                    </ol>
                                                </div>
                                            </motion.div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex flex-col gap-3 pb-2">
                                        <Link href="https://apk.evonext.app" target="_blank" className="w-full">
                                            <Button className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl rounded-xl">
                                                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                                                Download .APK
                                            </Button>
                                        </Link>

                                        <Link href="https://sansbank.org/bootstrap" target="_blank" className="w-full">
                                            <Button variant="outline" className="w-full h-12 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 font-bold rounded-xl text-lg">
                                                Support Google Play Listing
                                            </Button>
                                        </Link>

                                        <Dialog.Close asChild>
                                            <button className="mt-2 text-slate-500 hover:text-white text-sm transition-colors py-2 font-medium">
                                                Maybe later
                                            </button>
                                        </Dialog.Close>
                                    </div>

                                    <Dialog.Close asChild>
                                        <button className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                                            <XMarkIcon className="w-6 h-6" />
                                        </button>
                                    </Dialog.Close>
                                </motion.div>
                            </Dialog.Content>
                        </div>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    )
}
