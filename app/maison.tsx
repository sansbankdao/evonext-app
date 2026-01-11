'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/post/post-card'
import { useNetwork } from '@/contexts/network-context'
import Link from 'next/link'

export function DashboardPage() {
    const router = useRouter()
    const { user } = useAuth()
    const { network } = useNetwork()

    // Redirect authenticated users to timeline
    useEffect(() => {
        if (!user) {
            router.push('/')
        }
    }, [user, router])

    if (!user) return null

    const trendingPosts = [
        {
            id: '1BUMQzBg2cgCMHTxZgL2YEWZzKYxf37gNr7dipW76WAY3',
            content: `Just deployed my first dApp on Dash (${network}) Platform! 🚀 The future is decentralized.`,
            author: {
                id: 'trending1',
                username: 'cryptodev',
                handle: 'cryptodev',
                displayName: 'Crypto Dev',
                avatar: '',
                followers: 0,
                following: 0,
                bio: '',
                createdAt: Math.floor(new Date().getTime() / 1000),
                joinedAt: new Date(),
                revision: 1
            },
            createdAt: new Date(Date.now() - 1000 * 60 * 30).getTime() / 1000,
            likes: 342,
            replies: 45,
            remixes: 1,
            views: 5234
        },
        {
            id: 'HVRX262VXKnVh8VYU3WsJiSdA45CwZSwAUrV1KnTGxiu',
            content: 'Dash Platform makes building decentralized apps so much easier. No more worrying about backend infrastructure!',
            author: {
                id: 'trending2',
                username: 'web3builder',
                handle: 'web3builder',
                displayName: 'Web3 Builder',
                avatar: '',
                followers: 0,
                following: 0,
                bio: '',
                createdAt: Math.floor(new Date().getTime() / 1000),
                joinedAt: new Date(),
                revision: 1
            },
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).getTime() / 1000,
            likes: 567,
            replies: 78,
            remixes: 5,
            views: 8901
        },
        {
            id: '3H37sQc8LHhNT7A1uXe2AJQi5iJD3N72RQHDgRP3ktw1',
            content: 'The decentralized social media revolution is here. Own your data, own your identity. #Web3Social',
            author: {
                id: 'trending3',
                username: 'defimaster',
                handle: 'defimaster',
                displayName: 'DeFi Master',
                avatar: '',
                followers: 0,
                following: 0,
                bio: '',
                createdAt: Math.floor(new Date().getTime() / 1000),
                joinedAt: new Date(),
                revision: 1
            },
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).getTime() / 1000,
            likes: 891,
            replies: 156,
            remixes: 2,
            views: 12567
        }
    ]

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="pt-16 pb-32 w-full flex flex-col px-3 sm:px-8 h-screen overflow-y-scroll">
                <section className="py-12">
                    <h2 className="text-2xl font-bold mb-6">Your Timeline</h2>
                    <div className="max-w-2xl mx-auto space-y-4">
                        {trendingPosts.map((post) => (
                            <div
                                key={post.id}
                                className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                            >
                                <PostCard post={post} />
                            </div>
                        ))}
                        <div className="text-center pt-8">
                            <Button variant="outline" asChild>
                                <Link href="/posts" className="text-lg">
                                    View All Posts
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
