// components/bootstrap/ios-modal.tsx

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { RocketLaunchIcon, HeartIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface IosModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function IosModal({ open, onOpenChange }: IosModalProps) {
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
                                    className="relative w-full max-w-md bg-[#16171d] border border-purple-500/30 rounded-3xl p-8 shadow-2xl focus:outline-none"
                                >
                                    <Dialog.Title className="text-2xl font-bold text-white flex items-center gap-2">
                                        <RocketLaunchIcon className="w-6 h-6 text-purple-400" />
                                        iOS is Coming
                                    </Dialog.Title>

                                    <Dialog.Description className="mt-4 text-slate-300 leading-relaxed">
                                        EvoNext Mobile is nearly ready for <strong>Apple TestFlight</strong>.
                                        We are currently in our <span className="text-purple-400 font-bold">Bootstrap Phase</span> to fund final infrastructure and professional delivery to the App Store.
                                    </Dialog.Description>

                                    <div className="mt-6 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 flex items-start gap-3">
                                        <HeartIcon className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-slate-400">
                                            Support our early efforts and participate in the Dutch Auction to help us clear the final hurdle for the App Store.
                                        </p>
                                    </div>

                                    <div className="mt-8 flex flex-col gap-3">
                                        <Link href="https://sansbank.org/bootstrap" target="_blank" className="w-full">
                                            <Button className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl">
                                                View Bootstrap Phase
                                            </Button>
                                        </Link>

                                        <Dialog.Close asChild>
                                            <button className="text-slate-500 hover:text-white font-medium transition-colors text-lg py-2">
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
