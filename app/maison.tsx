// app/maison.tsx

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    ArrowTrendingUpIcon,
    SquaresPlusIcon,
    UserGroupIcon,
    SparklesIcon,
    HeartIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/post-card'
import { useNetwork } from '@/contexts/network-context'
import Link from 'next/link'
import { formatNumber } from '@/lib/utils'
import { getDashPlatformClient } from '@/lib/dash-platform-client'
import { readCachedNetworkStats, refreshNetworkStats, NetworkStats } from '@/lib/network-stats'
import { transformPostDoc, resolveItemAuthors } from '@/lib/post-helpers'
import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'

const getContractId = (_network: string): any => {
    /* Initialize locals. */
    let contractId

    /* Handle network. */
    if (_network === 'mainnet') {
        contractId = EVONEXT_CONTRACT_ID_MAINNET
    } else {
        contractId = EVONEXT_CONTRACT_ID_TESTNET
    }

    return contractId
}

interface TopicStat {
    topic: string
    posts: number
}

export function MaisonPage() {
    const { network } = useNetwork()
    const [trendingPosts, setTrendingPosts] = useState<any[]>([])
    const [trendingTopics, setTrendingTopics] = useState<TopicStat[]>([])
    const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Network-wide stats (shared full-pagination counter, cached in
    // localStorage for an hour).
    useEffect(() => {
        let cancelled = false

        const load = async () => {
            // The app convention: anything that is not 'mainnet' runs against
            // testnet (localhost/IPFS hosts resolve to a raw host string).
            if (network === 'mainnet') return

            try {
                // Serve the cached snapshot immediately (if any); refresh in
                // the background when it's missing or stale.
                const cached = readCachedNetworkStats()

                if (cached) setNetworkStats(cached.stats)

                if (!cached || cached.stale) {
                    const fresh = await refreshNetworkStats()

                    if (!cancelled) setNetworkStats(fresh)
                }
            } catch (error) {
                console.error('Home: Failed to load network stats:', error)
            }
        }

        load()
        return () => { cancelled = true }
    }, [network])

    // Trending posts and topics from the real on-chain data: the most
    // recent posts ranked by engagement, and hashtags counted from their
    // content.
    useEffect(() => {
        let cancelled = false

        const loadTrendingPosts = async () => {
            try {
                setIsLoading(true)

                const dashClient = getDashPlatformClient(getContractId(network!))
                const posts = await dashClient.queryPosts({ limit: 20 })

                // Transform to the PostCard shape (epoch-seconds createdAt).
                const transformed = await Promise.all(
                    (Array.isArray(posts) ? posts : []).map((doc: any) => transformPostDoc(doc))
                )

                // Real interaction counts for every post on screen.
                if (transformed.length > 0) {
                    try {
                        const counts = await dashClient.getInteractionCounts(
                            transformed.map(p => p.id)
                        )

                        for (const post of transformed) {
                            const count = counts[post.id]

                            if (count) {
                                post.likes = count.likes
                                post.replies = count.replies
                                post.remixes = count.remixes
                            }
                        }
                    } catch (countError) {
                        console.error('Home: Failed to load interaction counts:', countError)
                    }
                }

                // Real author names (profile + DPNS), same helper as the feed.
                let named = transformed
                try {
                    named = await resolveItemAuthors(transformed)
                } catch (authorError) {
                    console.error('Home: Failed to resolve author names:', authorError)
                }

                if (cancelled) return

                // Trending = highest engagement (likes + replies + remixes).
                const ranked = [...named].sort((a, b) =>
                    (b.likes + b.replies + b.remixes) - (a.likes + a.replies + a.remixes)
                ).slice(0, 3)

                setTrendingPosts(ranked)

                // Trending topics: hashtags counted across the recent posts.
                const tagCounts = new Map<string, number>()

                for (const post of named) {
                    const tags = (post.content as string).match(/#([a-zA-Z0-9_]+)/g) || []

                    for (const raw of tags) {
                        const tag = raw.toLowerCase()
                        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
                    }
                }

                const topics: TopicStat[] = [...tagCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([tag, count]) => ({ topic: tag, posts: count }))

                setTrendingTopics(topics)
            } catch (error) {
                console.error('Failed to load trending posts:', error)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        loadTrendingPosts()
        return () => { cancelled = true }
    }, [network])

    const stats = [
        { label: 'Active Users', value: networkStats ? formatNumber(networkStats.uniquePosters) : '…', icon: UserGroupIcon },
        { label: 'Total Posts', value: networkStats ? formatNumber(networkStats.totalPosts) : '…', icon: SquaresPlusIcon },
        { label: 'Total Likes', value: networkStats ? formatNumber(networkStats.totalLikes) : '…', icon: HeartIcon },
    ]

    return (
        <div className="min-h-screen flex">
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
                            ΞvoNext
                        </h1>

                        <h2 className="text-3xl text-sky-700 dark:text-sky-300 mb-8 max-w-2xl mx-auto font-bold tracking-widest">
                            <span className="text-4xl font-extrabold text-sky-600">F</span>ree and <span className="text-4xl font-extrabold text-sky-600">F</span>earless
                        </h2>

                        <p className="text-lg/7 text-slate-600 dark:text-slate-400 sm:max-w-2xl mb-8 mx-auto tracking-wider text-pretty">
                            Discover safe and enjoyable spaces to <span className="font-extrabold">Explore. Curate. Share YOUR Truth</span> Fearlessly ✊
                            <span className="px-2 inline-block">secured by Dash Platform 🛡️</span>
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

                {/* Trending Topics — real hashtags counted from recent posts */}
                <section className="py-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <ArrowTrendingUpIcon className="h-6 w-6 text-evonext-500" />
                        Trending Topics
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {trendingTopics.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                No trending topics yet — add a #hashtag to a post.
                            </p>
                        ) : trendingTopics.map((topic, index) => (
                            <motion.div
                                key={topic.topic}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-lg">
                                            {topic.topic}
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            {formatNumber(topic.posts)} {topic.posts === 1 ? 'post' : 'posts'}
                                        </p>
                                    </div>
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
                    ) : trendingPosts.length === 0 ? (
                        <p className="text-center text-sm text-gray-500">
                            No posts yet — be the first to share something!
                        </p>
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

                    <p className="text-lg text-slate-600 dark:text-gray-400 mb-8">
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
