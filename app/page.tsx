'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowTrendingUpIcon,
    HashtagIcon,
    UserGroupIcon,
    ChartBarIcon,
    SparklesIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/post-card'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { formatNumber } from '@/lib/utils'

export default function PublicHomePage() {
    const router = useRouter()
    const { user } = useAuth()
    const [trendingPosts, setTrendingPosts] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isHydrated, setIsHydrated] = useState(false)

    // Prevent hydration mismatches
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Redirect authenticated users to feed
    useEffect(() => {
        if (user) {
            router.push('/feed')
        }
    }, [user, router])

    // Load trending posts (public data)
    useEffect(() => {
        const loadTrendingPosts = async () => {

            try {
                // Simulate loading trending posts - in production this would be public data
                const mockTrendingPosts = [
                    {
                        id: '1',
                        content: 'Just deployed my first dApp on Dash Platform! 🚀 The future is decentralized.',
                        author: {
                            id: 'trending1',
                            username: 'cryptodev',
                            handle: 'cryptodev'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                        likes: 342,
                        replies: 45,
                        reposts: 89,
                        views: 5234
                    },
                    {
                        id: '2',
                        content: 'Dash Platform makes building decentralized apps so much easier. No more worrying about backend infrastructure!',
                        author: {
                            id: 'trending2',
                            username: 'web3builder',
                            handle: 'web3builder'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                        likes: 567,
                        replies: 78,
                        reposts: 123,
                        views: 8901
                    },
                    {
                        id: '3',
                        content: 'The decentralized social media revolution is here. Own your data, own your identity. #Web3Social',
                        author: {
                            id: 'trending3',
                            username: 'defimaster',
                            handle: 'defimaster'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
                        likes: 891,
                        replies: 156,
                        reposts: 234,
                        views: 12567
                    }
                ]

                setTrendingPosts(mockTrendingPosts)
            } catch (error) {
                console.error('Failed to load trending posts:', error)
            } finally {
                setIsLoading(false)
            }
        }

        // Load immediately for better perceived performance
        loadTrendingPosts()
    }, [])

    const trendingTopics = [
        { topic: '#DashPlatform', posts: 1234, trend: '+15%' },
        { topic: '#Web3Social', posts: 892, trend: '+23%' },
        { topic: '#Decentralized', posts: 567, trend: '+8%' },
        { topic: '#Blockchain', posts: 3421, trend: '+45%' },
        { topic: '#Yappr', posts: 234, trend: 'New' },
    ]

    const stats = [
        { label: 'Active Users', value: '10K+', icon: UserGroupIcon },
        { label: 'Posts Today', value: '50K+', icon: ChartBarIcon },
        { label: 'Communities', value: '100+', icon: HashtagIcon },
    ]

    // Show loading skeleton during hydration
    if (!isHydrated) {
        return (
            <div className="min-h-screen flex">
                {/* Sidebar skeleton */}
                <div className="fixed h-screen w-[275px] px-2 py-4">
                    <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-6 animate-pulse" />

                    <div className="space-y-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
                        ))}
                    </div>

                    <div className="mt-8 h-12 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
                </div>

                {/* Main content skeleton */}
                <main className="flex-1 max-w-[1200px] mx-auto px-8 py-16">
                    <div className="text-center mb-16">
                        <div className="h-16 w-96 bg-gray-200 dark:bg-gray-800 rounded mx-auto mb-4 animate-pulse" />
                        <div className="h-6 w-[500px] bg-gray-100 dark:bg-gray-900 rounded mx-auto mb-8 animate-pulse" />

                        <div className="flex gap-4 justify-center">
                            <div className="h-12 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                            <div className="h-12 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="flex-1 max-w-[1200px] mx-auto px-8">
                {/* Hero Section */}
                <section className="py-16 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-5xl font-bold mb-4">
                            Welcome to <span className="text-gradient">Yappr</span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                            The decentralized social platform where you own your data, your identity, and your voice.
                            Built on Dash Platform.
                        </p>

                        <div className="flex gap-4 justify-center">
                            <Button size="lg" asChild className="shadow-yappr-lg">
                                <Link href="/login">
                                    Get Started
                                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>

                            <Button size="lg" variant="outline" asChild>
                                <Link href="/explore">
                                    Explore Public Posts
                                </Link>
                            </Button>
                        </div>
                    </motion.div>
                </section>

                {/* Stats Section */}
                <section className="py-8 border-y border-gray-200 dark:border-gray-800">
                    <div className="grid grid-cols-3 gap-8">
                        {stats.map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="text-center"
                            >
                                <stat.icon className="h-8 w-8 text-yappr-500 mx-auto mb-2" />
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <div className="text-sm text-gray-500">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Trending Topics */}
                <section className="py-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-yappr-500" />
                        Trending Topics
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {trendingTopics.map((topic, index) => (
                            <motion.div
                                key={topic.topic}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors cursor-pointer"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-lg">
                                            {topic.topic}
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            {formatNumber(topic.posts)} posts
                                        </p>
                                    </div>

                                    <span className={`text-sm font-medium ${
                                        topic.trend === 'New'
                                        ? 'text-yappr-500'
                                        : topic.trend.startsWith('+')
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                    }`}>
                                        {topic.trend}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Trending Posts */}
                <section className="py-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <SparklesIcon className="h-6 w-6 text-yappr-500" />
                        Trending Posts
                    </h2>

                    {isLoading ? (
                        <div className="max-w-2xl mx-auto space-y-4">
                            {/* Post loading skeletons */}
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />

                                        <div className="flex-1 space-y-3">
                                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />

                                            <div className="space-y-2">
                                                <div className="h-4 w-full bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                                                <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                                            </div>

                                            <div className="flex gap-6 pt-2">
                                                <div className="h-4 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                                                <div className="h-4 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                                                <div className="h-4 w-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                                                <div className="h-4 w-10 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-4">
                            {trendingPosts.map((post) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                                >
                                    <PostCard post={post} />
                                </motion.div>
                            ))}

                            <div className="text-center pt-8">
                                <Button variant="outline" asChild>
                                    <Link href="/login">
                                        Sign in to see more
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                {/* CTA Section */}
                <section className="py-16 text-center border-t border-gray-200 dark:border-gray-800">
                    <h2 className="text-3xl font-bold mb-4">Ready to join the conversation?</h2>

                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                        Create your decentralized identity and start sharing your thoughts.
                    </p>

                    <Button size="lg" asChild className="shadow-yappr-lg">
                        <Link href="/login">
                            Create Account
                            <ArrowRightIcon className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </section>
            </main>
        </div>
    )
}
