'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowTrendingUpIcon,
    SquaresPlusIcon,
    UserGroupIcon,
    SparklesIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/post-card'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import Link from 'next/link'
import { formatNumber } from '@/lib/utils'

export default function PublicHomePage() {
    const router = useRouter()
    const { user } = useAuth()
    const { network } = useNetwork()
    const [trendingPosts, setTrendingPosts] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isHydrated, setIsHydrated] = useState(false)

    // Prevent hydration mismatches
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Redirect authenticated users to timeline
    useEffect(() => {
        if (user) {
            router.push('/posts')
        }
    }, [user, router])

    // Load trending posts (public data)
    useEffect(() => {
        const loadTrendingPosts = async () => {

            try {
                // Simulate loading trending posts - in production this would be public data
                const mockTrendingPosts = [
                    {
                        id: '1BUMQzBg2cgCMHTxZgL2YEWZzKYxf37gNr7dipW76WAY3',
                        content: `Just deployed my first dApp on Dash (${network}) Platform! 🚀 The future is decentralized.`,
                        author: {
                            id: 'trending1',
                            username: 'cryptodev',
                            handle: 'cryptodev'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                        likes: 342,
                        replies: 45,
                        reposts: '0.01',
                        views: 5234
                    },
                    {
                        id: 'HVRX262VXKnVh8VYU3WsJiSdA45CwZSwAUrV1KnTGxiu',
                        content: 'Dash Platform makes building decentralized apps so much easier. No more worrying about backend infrastructure!',
                        author: {
                            id: 'trending2',
                            username: 'web3builder',
                            handle: 'web3builder'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                        likes: 567,
                        replies: 78,
                        reposts: '0.05',
                        views: 8901
                    },
                    {
                        id: '3H37sQc8LHhNT7A1uXe2AJQi5iJD3N72RQHDgRP3ktw1',
                        content: 'The decentralized social media revolution is here. Own your data, own your identity. #Web3Social',
                        author: {
                            id: 'trending3',
                            username: 'defimaster',
                            handle: 'defimaster'
                        },
                        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
                        likes: 891,
                        replies: 156,
                        reposts: '0.02',
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
    }, [network])

    const trendingTopics = [
        { topic: '#DashPlatform', posts: 1234, trend: '+15%' },
        { topic: '#Web3Social', posts: 892, trend: '+23%' },
        { topic: '#Decentralized', posts: 567, trend: '+8%' },
        { topic: '#Blockchain', posts: 3421, trend: '+45%' },
        { topic: '#EvoNext', posts: 234, trend: 'New' },
    ]

    const stats = [
        { label: 'Active Users', value: '3K+', icon: UserGroupIcon },
        { label: 'Remixes Today', value: '873', icon: SparklesIcon },
        { label: 'Mini Apps', value: '42', icon: SquaresPlusIcon },
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
                <main className="flex-1 mx-auto px-8 py-16">
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

            <main className="pt-16 pb-32 w-full flex flex-col px-3 sm:px-8 h-screen overflow-y-scroll">
                {/* Hero Section */}
                <section className="py-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h3 className="text-2xl font-medium uppercase text-slate-500 tracking-widest">
                            Welcome to
                        </h3>

                        <h1 className="-mt-3 text-gradient text-7xl sm:text-8xl font-bold text-slate-500 tracking-widest">
                            EvoNext
                        </h1>

                        <h2 className="text-2xl text-sky-700 dark:text-sky-300 mb-8 max-w-2xl mx-auto font-bold tracking-widest">
                            <span className="text-3xl font-bold text-sky-600">F</span>un -n- <span className="text-3xl font-bold text-sky-600">F</span>earless <span className="text-3xl font-bold text-sky-600">S</span>ocial
                        </h2>

                        <p className="text-lg/7 text-slate-600 dark:text-slate-400 sm:max-w-2xl mb-8 mx-auto tracking-wider text-pretty">
                            Free Your Inhibitions ⛓️‍💥 Discover safe and enjoyable spaces to <span className="font-extrabold">Explore. Curate. Share YOUR TRUTH</span> without the fear of social consequence.
                        </p>

                        <div className="flex gap-4 justify-center">
                            <Button size="lg" asChild className="shadow-evonext-lg text-2xl font-medium">
                                <Link href="/connect">
                                    Connect
                                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>

                            <Button size="lg" variant="outline" asChild className="text-2xl font-medium">
                                <Link href="/explore">
                                    Explore
                                    <ArrowRightIcon className="ml-2 h-5 w-5" />
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
                                <stat.icon className="h-8 w-8 text-evonext-500 mx-auto mb-2" />
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <div className="text-sm text-gray-500">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Trending Topics */}
                <section className="py-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-evonext-500" />
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
                                        ? 'text-evonext-500'
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
                        <SparklesIcon className="h-6 w-6 text-evonext-500" />
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
                                    <Link href="/connect" className="text-lg">
                                        Connect to see more
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                {/* CTA Section */}
                <section className="py-20 text-center border-t border-gray-200 dark:border-gray-800">
                    <h2 className="text-3xl font-bold mb-4">Ready to join the conversation?</h2>

                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                        Create your decentralized identity and start sharing your thoughts.
                    </p>

                    <Button size="lg" asChild className="shadow-evonext-lg text-xl">
                        <Link href="/connect">
                            Create Account
                            <ArrowRightIcon className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </section>
            </main>
        </div>
    )
}
