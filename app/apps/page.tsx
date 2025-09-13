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

interface App {
    id: string;
    name: string;
    description: string;
    imgUrl: string;
}

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

    const apps = [
        {
            id: '1',
            name: `Tech Tools`,
            description: `A comprehensive suite of tools for developers, including code snippets, API documentation, and project management features.`,
            imgUrl: 'https://images.unsplash.com/photo-1735964366700-9eedefcf0065?q=80',
        },
        {
            id: '2',
            name: `Home Hunter`,
            description: `An app that helps users find their dream homes with personalized recommendations and virtual tours.`,
            imgUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80',
        },
        {
            id: '3',
            name: `Avatar Creator`,
            description: `Create and customize your own avatars with a wide range of features and styles.`,
            imgUrl: 'https://images.unsplash.com/photo-1728577740843-5f29c7586afe?q=80',
        },
        {
            id: '4',
            name: `Real Estate Advisor`,
            description: `Get expert advice and insights on the real estate market, including property valuations and investment tips.`,
            imgUrl: 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?q=80',
        },
    ]

    return (
        <div className="pt-14 py-10 min-h-screen bg-gray-50 dark:bg-gray-950 h-screen">
            <div className="sm:mt-2 lg:mt-4 max-w-7xl mx-auto px-4 py-8 h-full overflow-y-scroll">
                <div className="w-full flex justify-end mb-8">
                    <Link
                        href="/studio"
                        className="px-5 py-1 inline-flex items-center gap-2 text-gray-600 dark:text-sky-400 hover:text-sky-100 dark:hover:text-sky-100 transition-colors border border-sky-500 bg-sky-50 hover:bg-sky-700 rounded-xl"
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
                        {apps.map((app) => (
                            <div key={app.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                                <Image
                                    src={app.imgUrl}
                                    alt={app.name}
                                    className="w-full h-48 object-cover"
                                    width={0}
                                    height={0}
                                />

                                <div className="p-4">
                                    <h2 className="text-xl font-semibold mb-2">
                                        {app.name}
                                    </h2>

                                    <p className="text-slate-700">
                                        {app.description}
                                    </p>

                                    <Link
                                        href="#"
                                        className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                    >
                                        Launch App
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
