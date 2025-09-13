'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    BookmarkIcon,
    MagnifyingGlassIcon,
    EllipsisHorizontalIcon,
    ShareIcon,
    TrashIcon
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { PostCard } from '@/components/post/post-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { withAuth, useAuth } from '@/contexts/auth-context'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import toast from 'react-hot-toast'

interface BookmarkedPost {
    id: string
    content: string
    author: {
        id: string
        docId: string
        username: string
        handle: string
        displayName: string
        avatar: string
        followers: number
        following: number
        verified?: boolean
        joinedAt: Date
        revision: number
    }
    createdAt: Date
    timestamp: string
    likes: number
    replies: number
    remixes: number
    views: number
    bookmarkedAt: Date
}

function RemixesPage() {
    const { user } = useAuth()
    const [remixes, setRemixes] = useState<BookmarkedPost[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent')

    useEffect(() => {
        // In a real app, this would fetch bookmarked posts from Dash Platform
        // For now, we'll simulate some bookmarked posts
        setTimeout(() => {
            const mockRemixes: BookmarkedPost[] = [
                {
                    id: '1',
                    content: 'Just deployed my first dApp on Dash Platform! 🚀 The future is decentralized.',
                    author: {
                        id: 'user123',
                        docId: 'abc123',
                        username: 'user123...',
                        handle: 'user123',
                        displayName: 'User 123',
                        avatar: '',
                        followers: 0,
                        following: 0,
                        joinedAt: new Date(),
                        revision: 1,
                    },
                    createdAt: new Date(Date.now() - 1000 * 60 * 60),
                    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                    likes: 42,
                    replies: 5,
                    remixes: 12,
                    views: 234,
                    bookmarkedAt: new Date(Date.now() - 1000 * 60 * 30)
                },
                {
                    id: '2',
                    content: 'Building decentralized social media is the future. No more centralized control over our data and conversations.',
                    author: {
                        id: 'user456',
                        docId: 'abc456',
                        username: 'user456...',
                        handle: 'user456',
                        displayName: 'User 456',
                        avatar: '',
                        followers: 0,
                        following: 0,
                        joinedAt: new Date(),
                        revision: 1,
                    },
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                    likes: 128,
                    replies: 23,
                    remixes: 45,
                    views: 1234,
                    bookmarkedAt: new Date(Date.now() - 1000 * 60 * 60 * 2)
                },
                {
                    id: '3',
                    content: 'Dash Platform makes it so easy to build decentralized applications. The developer experience is amazing! #DashPlatform #Web3',
                    author: {
                        id: 'user789',
                        docId: 'abc789',
                        username: 'user789...',
                        handle: 'user789',
                        displayName: 'User 789',
                        avatar: '',
                        followers: 0,
                        following: 0,
                        joinedAt: new Date(),
                        revision: 1,
                    },
                    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
                    likes: 89,
                    replies: 17,
                    remixes: 28,
                    views: 567,
                    bookmarkedAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
                }
            ]
            setRemixes(mockRemixes)
            setIsLoading(false)
        }, 1000)
    }, [])

    const removeBookmark = (postId: string) => {
        setRemixes(prev => prev.filter(post => post.id !== postId))
        toast.success('Removed from remixes')
    }

    const clearAllRemixes = () => {
        if (confirm('Are you sure you want to clear all remixes?')) {
            setRemixes([])
            toast.success('All remixes cleared')
        }
    }

    const filteredRemixes = remixes
        .filter(post =>
            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.author.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const timeA = a.bookmarkedAt.getTime()
            const timeB = b.bookmarkedAt.getTime()
            return sortBy === 'recent' ? timeB - timeA : timeA - timeB
        })

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="pt-16 flex-1 border-x border-gray-200 dark:border-gray-800 h-screen overflow-y-scroll">
                <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div>
                            <h1 className="text-xl font-bold">
                                Remixes
                            </h1>

                            <p className="text-sm text-gray-500">
                                {remixes.length} remixed posts
                            </p>
                        </div>

                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                                    <EllipsisHorizontalIcon className="h-5 w-5" />
                                </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="min-w-[200px] bg-white dark:bg-black rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50"
                                    sideOffset={5}
                                >
                                    <DropdownMenu.Item
                                        className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none flex items-center gap-2"
                                        onClick={() => setSortBy(sortBy === 'recent' ? 'oldest' : 'recent')}
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                        </svg>

                                        Sort by {sortBy === 'recent' ? 'oldest' : 'most recent'}
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

                                    <DropdownMenu.Item
                                        className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none flex items-center gap-2 text-red-600"
                                        onClick={clearAllRemixes}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        Clear all remixes
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    </div>

                    {remixes.length > 0 && (
                        <div className="px-4 pb-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />

                                <Input
                                    type="text"
                                    placeholder="Search remixes"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    )}
                </header>

                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading remixes...</p>
                    </div>
                ) : remixes.length === 0 ? (
                    <div className="p-8 text-center">
                        <BookmarkIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />

                        <h2 className="text-xl font-semibold mb-2">Save posts for later</h2>

                        <p className="text-gray-500 text-sm">
                            Don&apos;t let the good ones fly away! Bookmark posts to easily find them again.
                        </p>
                    </div>
                ) : filteredRemixes.length === 0 ? (
                    <div className="p-8 text-center">
                        <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No remixes found matching &quot;{searchQuery}&quot;</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredRemixes.map((post) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative group"
                            >
                                <PostCard post={post} />

                                {/* Bookmark Options Overlay */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger asChild>
                                            <button className="p-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-900">
                                                <EllipsisHorizontalIcon className="h-5 w-5" />
                                            </button>
                                        </DropdownMenu.Trigger>

                                        <DropdownMenu.Portal>
                                            <DropdownMenu.Content
                                                className="min-w-[180px] bg-white dark:bg-black rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50"
                                                sideOffset={5}
                                            >
                                                <DropdownMenu.Item
                                                    className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none flex items-center gap-2"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
                                                        toast.success('Link copied to clipboard')
                                                    }}
                                                >
                                                    <ShareIcon className="h-4 w-4" />
                                                    Share post
                                                </DropdownMenu.Item>

                                                <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

                                                <DropdownMenu.Item
                                                    className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none flex items-center gap-2 text-red-600"
                                                    onClick={() => removeBookmark(post.id)}
                                                >
                                                    <BookmarkIcon className="h-4 w-4" />
                                                    Remove bookmark
                                                </DropdownMenu.Item>
                                            </DropdownMenu.Content>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Root>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            <RightSidebar />
        </div>
    )
}

export default withAuth(RemixesPage)
