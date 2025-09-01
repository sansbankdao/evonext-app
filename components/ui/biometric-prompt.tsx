'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FingerPrintIcon, FaceSmileIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface BiometricPromptProps {
    isOpen: boolean
    onClose?: () => void
}

export function BiometricPrompt({ isOpen, onClose }: BiometricPromptProps) {
    const [deviceType, setDeviceType] = useState<'touch' | 'face' | 'generic'>('generic')

    useEffect(() => {
        // Detect device type for appropriate icon
        const userAgent = navigator.userAgent.toLowerCase()

        if (userAgent.includes('mac') && 'ontouchstart' in window) {
            setDeviceType('touch')
        } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            setDeviceType('face')
        } else {
            setDeviceType('generic')
        }
    }, [])

    const getIcon = () => {
        switch (deviceType) {
        case 'touch':
            return <FingerPrintIcon className="h-16 w-16" />
        case 'face':
            return <FaceSmileIcon className="h-16 w-16" />
        default:
            return <LockClosedIcon className="h-16 w-16" />
        }
    }

    const getTitle = () => {
        switch (deviceType) {
        case 'touch':
            return 'Touch ID Required'
        case 'face':
            return 'Face ID Required'
        default:
            return 'Authentication Required'
        }
    }

    const getDescription = () => {
        switch (deviceType) {
        case 'touch':
            return 'Place your finger on the Touch ID sensor'
        case 'face':
            return 'Look at your device to authenticate'
        default:
            return 'Use your device authentication to continue'
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Prompt */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-sm mx-auto">
                            <div className="text-center space-y-4">
                                <div className="mx-auto text-purple-500 dark:text-purple-400">
                                    {getIcon()}
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                        {getTitle()}
                                    </h2>

                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {getDescription()}
                                    </p>
                                </div>

                                <div className="flex justify-center">
                                    <div className="flex space-x-1">
                                        <motion.div
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                                            className="h-2 w-2 bg-purple-500 rounded-full"
                                        />

                                        <motion.div
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                                            className="h-2 w-2 bg-purple-500 rounded-full"
                                        />

                                        <motion.div
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                                            className="h-2 w-2 bg-purple-500 rounded-full"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                    Waiting for authentication...
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
