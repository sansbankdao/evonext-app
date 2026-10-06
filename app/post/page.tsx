'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { PostCard } from '@/components/post/post-card'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { getDashPlatformClient } from '@/lib/dash-platform-client'
import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IPost } from '@/lib/types'
import toast from 'react-hot-toast'

interface Reply extends IPost {
    replyToId: string
}

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

/**
 * Transform a raw document (4.x SDK: $-prefixed system fields) into the
 * shape PostCard expects. PostCard renders
 * new Date(post.createdAt * 1000), so the canonical unit here is epoch
 * SECONDS.
 */
const transformPostDoc = (doc: any): IPost => {
    const data = doc?.data || doc || {}
    const authorIdStr = doc?.$ownerId || doc?.ownerId || 'unknown'
    const docId = doc?.$id || doc?.id || ''
    const createdAtMs = Number(doc?.$createdAt ?? doc?.createdAt ?? Date.now())

    return {
        id: docId,
        content: data.content || 'No content',
        author: {
            id: authorIdStr,
            username: `user_${authorIdStr.slice(-6)}`,
            displayName: `User ${authorIdStr.slice(-6)}`,
            avatar: '',
            followers: 0,
            following: 0,
            verified: false,
            joinedAt: new Date(),
            revision: 1,
        },
        createdAt: Math.floor(createdAtMs / 1000),
        likes: 0,
        replies: 0,
        remixes: 0,
        views: 0,
        liked: false,
        remixed: false,
        bookmarked: false
    }
}

/**
 * Replace placeholder authors with real identity info — shared helper
 * (lib/post-helpers.ts) also used by the Posts feed.
 */
import { resolveItemAuthors as applyAuthorProfiles } from '@/lib/post-helpers'

function PostDetailPage() {
    const router = useRouter()
    const { user } = useAuth()
    const { network } = useNetwork()
    const [post, setPost] = useState<IPost | null>(null)
    const [replies, setReplies] = useState<Reply[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [replyContent, setReplyContent] = useState('')
    const [isReplying, setIsReplying] = useState(false)

    useEffect(() => {
        /* Initialize locals. */
        let location: Location
        let hash: string | undefined
        let hashId: string | undefined

        /* Request window location. */
        location = window.location

        /* Validate location. */
        if (typeof location !== 'undefined' && location !== null) {
            /* Set location hash. */
            hash = window.location?.hash
        }

        /* Validate hash. */
        if (typeof hash !== 'undefined' && hash !== null) {
            /* Set hash ID. */
            hashId = hash.substring(1)
        }

        const loadPost = async () => {
            /* Validate the hash ID. */
            if (!hashId) {
                setPost(null)
                setIsLoading(false)

                return
            }

            try {
                setIsLoading(true)

                const dashClient = getDashPlatformClient(getContractId(network!))

                // Fetch the post document by its $id.
                const doc = await dashClient.getPostById(hashId)

                if (!doc) {
                    setPost(null)

                    return
                }

                const postObj = transformPostDoc(doc)

                // Real interaction counts (same batched helper the feed uses)
                // including whether the current user already liked this post.
                const counts = await dashClient.getInteractionCounts([hashId], user?.identityId)
                const count = counts[hashId]

                if (count) {
                    postObj.likes = count.likes
                    postObj.replies = count.replies
                    postObj.remixes = count.remixes
                    postObj.liked = count.likedByMe
                }

                // Resolve the real author profile (displayName, DPNS
                // username, avatar data) instead of the raw placeholder.
                const withAuthor = await applyAuthorProfiles([postObj])

                setPost(withAuthor[0])

                // Real replies from the separate 'reply' document type,
                // oldest first, with their authors' profiles resolved.
                const replyDocs = await dashClient.getReplies(hashId)
                const transformedReplies = await applyAuthorProfiles(
                    replyDocs.map((d: any) => ({
                        ...transformPostDoc(d),
                        replyToId: hashId as string,
                    }))
                )

                setReplies(transformedReplies)
            } catch (error) {
                console.error('Failed to load post:', error)

                toast.error((error as any)?.message || 'Failed to load post')
            } finally {
                setIsLoading(false)
            }
        }

        loadPost()
    }, [user, network])

    const handleReply = async () => {
        if (!replyContent.trim() || !post || !user) return

        setIsReplying(true)

        try {
            // Create the reply on-chain — the Yappr contract stores replies
            // as a separate 'reply' document (parentId + parentOwnerId);
            // createPost switches document types when replyToPostId is set.
            const dashClient = getDashPlatformClient(getContractId(network!))
            await dashClient.createPost(replyContent, { replyToPostId: post.id })

            setReplyContent('')

            toast.success('Reply posted!')

            // Refresh the replies and the reply count from the chain.
            const replyDocs = await dashClient.getReplies(post.id)

            setReplies(
                await applyAuthorProfiles(
                    replyDocs.map((d: any) => ({
                        ...transformPostDoc(d),
                        replyToId: post.id,
                    }))
                )
            )
            setPost(prev => prev ? { ...prev, replies: replyDocs.length } : null)
        } catch (error) {
            console.error('Failed to post reply:', error)

            toast.error((error as any)?.message || 'Failed to post reply')
        } finally {
            setIsReplying(false)
        }
    }

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="py-20 flex-1 border-x border-gray-200 dark:border-gray-800 h-screen overflow-y-scroll">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4 px-4 py-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>

                        <h1 className="text-xl font-bold">
                            Post
                        </h1>
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
                            <PostCard post={post} isOwnPost={user?.identityId === post.author.id} interactive />
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
                                    <PostCard key={reply.id} post={reply} interactive />
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

// export default withAuth(PostDetailPage)
export default PostDetailPage // allow visitors to see post details
