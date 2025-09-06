'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { PostCard } from '@/components/post/post-card'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Post } from '@/lib/types'
import toast from 'react-hot-toast'

interface Reply extends Post {
    replyToId: string
}

function PostDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useAuth()
    const [post, setPost] = useState<Post | null>(null)
    const [replies, setReplies] = useState<Reply[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [replyContent, setReplyContent] = useState('')
    const [isReplying, setIsReplying] = useState(false)

    useEffect(() => {
        if (!params.id || !user) return

        const loadPost = async () => {
            try {
                setIsLoading(true)

                // In a real app, this would fetch the specific post from Dash Platform
                // For now, we'll simulate it
                const mockPost: Post = {
                    id: params.id as string,
                    content: 'This is a sample post content. In a real app, this would be loaded from Dash Platform.',
                    author: {
                        id: 'user123',
                        username: 'user123...',
                        displayName: 'User 123',
                        avatar: '',
                        followers: 0,
                        following: 0,
                        joinedAt: new Date()
                    },
                    createdAt: new Date(Date.now() - 1000 * 60 * 60),
                    likes: 42,
                    replies: 5,
                    reposts: 12,
                    views: 234
                }

                const mockReplies: Reply[] = [
                    {
                        id: 'reply1',
                        content: 'Great post! Thanks for sharing.',
                        author: {
                            id: 'user456',
                            username: 'user456...',
                            displayName: 'User 456',
                            avatar: '',
                            followers: 0,
                            following: 0,
                            joinedAt: new Date()
                        },
                        createdAt: new Date(Date.now() - 1000 * 60 * 30),
                        likes: 3,
                        replies: 0,
                        reposts: 0,
                        views: 45,
                        replyToId: params.id as string
                    },
                    {
                        id: 'reply2',
                        content: 'I totally agree with this perspective.',
                        author: {
                            id: 'user789',
                            username: 'user789...',
                            displayName: 'User 789',
                            avatar: '',
                            followers: 0,
                            following: 0,
                            joinedAt: new Date()
                        },
                        createdAt: new Date(Date.now() - 1000 * 60 * 15),
                        likes: 7,
                        replies: 0,
                        reposts: 1,
                        views: 89,
                        replyToId: params.id as string
                    }
                ]

                setPost(mockPost)
                setReplies(mockReplies)
            } catch (error) {
                console.error('Failed to load post:', error)
                toast.error('Failed to load post')
            } finally {
                setIsLoading(false)
            }
        }

        loadPost()
    }, [
        params.id,
        user,
    ])

    const handleReply = async () => {
        if (!replyContent.trim() || !post || !user) return

        setIsReplying(true)

        try {
            // In a real app, this would create a reply on Dash Platform
            const newReply: Reply = {
                id: `reply${Date.now()}`,
                content: replyContent,
                author: {
                    id: user.identityId,
                    username: user.identityId.slice(0, 8) + '...',
                    displayName: user.identityId.slice(0, 8) + '...',
                    avatar: '',
                    followers: 0,
                    following: 0,
                    joinedAt: new Date()
                },
                createdAt: new Date(),
                likes: 0,
                replies: 0,
                reposts: 0,
                views: 0,
                replyToId: post.id
            }

            setReplies(prev => [newReply, ...prev])
            setReplyContent('')

            toast.success('Reply posted!')

            // Update reply count
            setPost(prev => prev ? { ...prev, replies: prev.replies + 1 } : null)
        } catch (error) {
            console.error('Failed to post reply:', error)
            toast.error('Failed to post reply')
        } finally {
            setIsReplying(false)
        }
    }

    return (
        <div className="py-16 min-h-screen flex">
            <Sidebar />

            <main className="flex-1 border-x border-gray-200 dark:border-gray-800">
                <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4 px-4 py-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>

                        <h1 className="text-xl font-bold">Post</h1>
                    </div>
                </header>

                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading post...</p>
                    </div>
                ) : post ? (
                    <>
                        {/* Main Post */}
                        <div className="border-b border-gray-200 dark:border-gray-800">
                            <PostCard post={post} />
                        </div>

                        {/* Reply Form */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    handleReply()
                                }}
                                className="space-y-3"
                            >
                                <Input
                                    type="text"
                                    placeholder="Post your reply"
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    className="w-full"
                                    maxLength={280}
                                />

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">
                                        {replyContent.length}/280
                                    </span>

                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={!replyContent.trim() || isReplying}
                                    >
                                        {isReplying ? 'Posting...' : 'Reply'}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Replies */}
                        <div className="divide-y divide-gray-200 dark:divide-gray-800">
                            {replies.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-gray-500">
                                        No replies yet. Be the first to reply!
                                    </p>
                                </div>
                            ) : (
                                replies.map((reply) => (
                                    <PostCard key={reply.id} post={reply} />
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <p className="text-gray-500">
                            Post not found
                        </p>
                    </div>
                )}
            </main>

            <RightSidebar />
        </div>
    )
}

export default withAuth(PostDetailPage)
