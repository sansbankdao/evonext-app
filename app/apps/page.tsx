'use client'

import { useState } from 'react'
import {
    ArrowLeftIcon,
    CheckIcon,
    CodeBracketIcon,
    ComputerDesktopIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'

export default function AppsPage() {
    const [copied, setCopied] = useState(false)
    const contractString = JSON.stringify(dataContract, null, 2)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(contractString)
            setCopied(true)
            toast.success('Contract copied to clipboard')
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            toast.error('Failed to copy contract')
        }
    }

    const documentCount = Object.keys(dataContract.documents).length
    const totalIndices = Object.values(dataContract.documents).reduce((acc, doc: any) =>
        acc + (doc.indices?.length || 0), 0
    )

    return (
        <div className="pt-14 min-h-screen bg-gray-50 dark:bg-gray-950 h-screen">
            <div className="sm:mt-2 lg:mt-4 max-w-7xl mx-auto px-4 py-8 overflow-y-scroll">
                <div className="w-full flex justify-between mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        <ArrowLeftIcon className="h-6" />
                        Back to EvoNext
                    </Link>

                    <Link
                        href="/studio"
                        className="px-5 py-1 inline-flex items-center gap-2 text-gray-600 dark:text-sky-400 hover:text-sky-100 dark:hover:text-sky-100 transition-colors border-2 border-sky-500 bg-sky-50 hover:bg-sky-700 rounded-xl"
                    >
                        Builder Studio
                        <ComputerDesktopIcon className="h-5" />
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-black rounded-2xl shadow-lg overflow-hidden"
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

                        {/* App 1 */}
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                            <Image
                                src="https://images.unsplash.com/photo-1735964366700-9eedefcf0065?q=80"
                                alt="Tech Tools"
                                className="w-full h-48 object-cover"
                                width={0}
                                height={0}
                            />

                            <div className="p-4">
                                <h2 className="text-xl font-semibold mb-2">
                                    Tech Tools
                                </h2>

                                <p className="text-slate-700">
                                    A comprehensive suite of tools for developers, including code snippets, API documentation, and project management features.
                                </p>

                                <Link href="#" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                    View App
                                </Link>
                            </div>
                        </div>

                        {/* App 1 */}
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                            <Image
                                src="https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80"
                                alt="Home Hunter"
                                className="w-full h-48 object-cover"
                                width={0}
                                height={0}
                            />

                            <div className="p-4">
                                <h2 className="text-xl font-semibold mb-2">
                                    Home Hunter
                                </h2>

                                <p className="text-slate-700">
                                    An app that helps users find their dream homes with personalized recommendations and virtual tours.
                                </p>

                                <Link href="#" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                    View App
                                </Link>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>
        </div>
    )
}
