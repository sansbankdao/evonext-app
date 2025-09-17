'use client'

import { useState } from 'react'
import {
    ArrowLeftIcon,
    CheckIcon,
    CodeBracketIcon,
    BuildingStorefrontIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'

interface Market {
    id: string;
    name: string;
    description: string;
    imgUrl: string;
}

export default function MarketplacePage() {
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
            name: `GreenLeaf Organics`,
            description: `An online-ONLY brand offering a wide range of organic clothing, focusing on sustainability and eco-friendly materials, with a commitment to ethical sourcing and production practices.`,
            imgUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80',
        },
        {
            id: '2',
            name: `TechGuru Gadgets`,
            description: `Provides a vast selection of cutting-edge technology, from smartphones to smart home devices, catering to tech enthusiasts with a focus on innovation and user experience..`,
            imgUrl: 'https://images.unsplash.com/photo-1735964366700-9eedefcf0065?q=80',
        },
        {
            id: '3',
            name: `FashionFwd Boutique`,
            description: `Offers a curate collection of trendy, sustainable fashion and accessories, prioritizing ethical manufacturing and unique designs that reflect current fashion trends.`,
            imgUrl: 'https://images.unsplash.com/photo-1728577740843-5f29c7586afe?q=80',
        },
        {
            id: '4',
            name: `Artisans Cooperative`,
            description: `Showcases handmade, unique items crafted by skilled artisans, supporting local craftsmanship and traditional techniques, while fostering a community of creators and buyers.`,
            imgUrl: 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?q=80',
        },
    ]

    return (
        <div className="pt-14 py-10 min-h-screen bg-gray-50 dark:bg-gray-950 h-screen">
            <div className="sm:mt-2 lg:mt-4 max-w-7xl mx-auto px-4 py-8 h-full overflow-y-scroll">
                <div className="w-full flex justify-end mb-8">
                    <button
                        className="px-5 py-1 inline-flex items-center gap-2 text-gray-600 dark:text-sky-400 hover:text-sky-100 dark:hover:text-sky-100 transition-colors border border-sky-500 bg-sky-50 hover:bg-sky-700 rounded-xl"
                    >
                        <BuildingStorefrontIcon className="h-5" />
                        Post an Item For Sale
                    </button>
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
                                        Launch Market
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
