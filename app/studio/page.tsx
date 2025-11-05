'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
    Squares2X2Icon,
    CodeBracketIcon,
    BoltIcon,
    UserGroupIcon,
    BookOpenIcon,
    ArrowTopRightOnSquareIcon,
    RocketLaunchIcon
} from '@heroicons/react/24/outline'

// Data for the resource cards
const resources = [
    {
        icon: BookOpenIcon,
        title: 'Getting Started Guide',
        description: 'Your first steps into building and publishing a mini app on the EvoNext platform.',
        href: 'https://docs.evonext.app/studio/getting-started'
    },
    {
        icon: CodeBracketIcon,
        title: 'EvoNext SDK Reference',
        description: 'Explore the complete API for interacting with user data, UI components, and more.',
        href: 'https://docs.evonext.app/sdk/reference'
    },
    {
        icon: UserGroupIcon,
        title: 'Builder Community',
        description: 'Connect with other creators, ask questions, and share your work in our community forum.',
        href: 'https://community.evonext.app/c/builders'
    }
]

export default function StudioPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div className="pt-20 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header and CTA Button */}
                <div className="w-full flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div /> {/* Spacer */}
                    <Link
                        href="https://studio.evonext.app"
                        target="_blank"
                        className="px-5 py-2 inline-flex items-center gap-3 text-sky-600 dark:text-sky-400 hover:text-white dark:hover:text-white transition-colors border border-sky-500 bg-sky-100 dark:bg-sky-500/10 hover:bg-sky-600 dark:hover:bg-sky-600 rounded-xl font-semibold"
                    >
                        <Squares2X2Icon className="h-5 w-5" />
                        Launch Studio
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white dark:bg-black rounded-2xl shadow-lg overflow-hidden"
                >
                    {/* Page Hero Section */}
                    <div className="bg-gradient-evonext p-8 text-white">
                        <div className="flex items-center gap-4 mb-4">
                            <RocketLaunchIcon className="h-8 w-8" />
                            <h1 className="text-3xl font-bold">
                                Mini Apps Studio by EvoNext
                            </h1>
                        </div>
                        <p className="text-lg opacity-90">
                            The ultimate browser-based IDE for creating, testing, and deploying custom experiences directly into the EvoNext ecosystem.
                        </p>
                    </div>

                    <div className="p-8">
                        {/* Benefits Section */}
                        <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">
                            Empowering Builders
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6 text-gray-700 dark:text-gray-300">
                            {/* Seamless Integration */}
                            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <BoltIcon className="h-6 w-6 text-sky-500" />
                                    <h3 className="text-xl font-semibold">
                                        Seamless Integration
                                    </h3>
                                </div>
                                <p>
                                    Build apps that feel native to EvoNext. Access user profiles, post data, and interact with the platform's UI using our powerful, easy-to-use SDK.
                                </p>
                            </div>

                            {/* Instant Deployment */}
                            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <UserGroupIcon className="h-6 w-6 text-green-500" />
                                    <h3 className="text-xl font-semibold">
                                        Reach a Built-in Audience
                                    </h3>
                                </div>
                                <p>
                                    Deploy your creations instantly to the entire EvoNext user base. No need to worry about hosting, distribution, or app stores.
                                </p>
                            </div>
                        </div>

                        {/* Resources Section */}
                        <div className="mt-12">
                            <h3 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-200">
                                Articles & Resources
                            </h3>
                            <div className="grid md:grid-cols-3 gap-6">
                                {resources.map((resource) => (
                                    <Link
                                        href={resource.href}
                                        key={resource.title}
                                        target="_blank"
                                        className="group block bg-gray-50 dark:bg-gray-950 rounded-lg p-6 hover:bg-sky-50 dark:hover:bg-sky-900/50 transition-colors"
                                    >
                                        <resource.icon className="h-8 w-8 mb-4 text-sky-500" />
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                            {resource.title}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                            {resource.description}
                                        </p>
                                        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold text-sm">
                                            Read More
                                            <ArrowTopRightOnSquareIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
