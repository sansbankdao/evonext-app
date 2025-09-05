'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
    ChatBubbleOvalLeftIcon,
    SparklesIcon,
    HeartIcon,
    CurrencyDollarIcon,
    BookmarkIcon,
    EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline'

import {
    HeartIcon as HeartIconSolid,
    BookmarkIcon as BookmarkIconSolid
} from '@heroicons/react/24/solid'

import { Post } from '@/lib/types'
import { formatTime, formatNumber } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { IconButton } from '@/components/ui/icon-button'
import { getInitials, cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import toast from 'react-hot-toast'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import { decodeAvatarFeaturesV2, generateAvatarV2 } from '@/lib/avatar-generator-v2'
import { LikesModal } from './likes-modal'

interface PostCardProps {
    post: Post
    hideAvatar?: boolean
    isOwnPost?: boolean
}

export function PostCard({ post, hideAvatar = false, isOwnPost = false }: PostCardProps) {
    const [liked, setLiked] = useState(post.liked || false)
    const [likes, setLikes] = useState(post.likes)
    const [reposted, setReposted] = useState(post.reposted || false)
    const [reposts, setReposts] = useState(post.reposts)
    const [bookmarked, setBookmarked] = useState(post.bookmarked || false)
    const [showLikesModal, setShowLikesModal] = useState(false)
    const { setReplyingTo, setComposeOpen } = useAppStore()

    const avatarFeatures = post.author.avatarData
        ? decodeAvatarFeaturesV2(post.author.avatarData)
        : generateAvatarV2(post.author.username)

    const handleLike = () => {
        if (hideAvatar) {
            // On "Your Posts" tab, show who liked instead of liking
            setShowLikesModal(true)
        } else {
            // Normal like behavior
            setLiked(!liked)
            setLikes(liked ? likes - 1 : likes + 1)
        }
    }

    const handleRepost = () => {
        setReposted(!reposted)
        setReposts(reposted ? reposts - 1 : reposts + 1)
        toast.success(reposted ? 'Removed remix' : 'Remixed!')
    }

    const handleBookmark = () => {
        setBookmarked(!bookmarked)
        toast.success(bookmarked ? 'Removed from bookmarks' : 'Added to bookmarks')
    }

    const handleReply = () => {
        setReplyingTo(post)
        setComposeOpen(true)
    }

    const handleShare = () => {
        navigator.clipboard.writeText(`https://evonext.app/posts/${post.id}`)
        toast.success('Link copied to clipboard')
    }

    return (
        <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors cursor-pointer"
        >
            <div className="flex gap-3">
                {!hideAvatar && (
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                        {isOwnPost ? (
                            <Image
                                src="/icon.png"
                                alt="EvoNext World"
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <AvatarCanvas features={avatarFeatures} size={48} />
                        )}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-sm">
                            {isOwnPost ? (
                                <span className="text-gray-500">
                                    You wrote {formatTime(post.createdAt)}:
                                </span>
                            ) : (
                                <>
                                    {!hideAvatar && (
                                        <>
                                            <span className="font-semibold hover:underline">{post.author.displayName}</span>

                                            {post.author.verified && (
                                                <svg className="h-4 w-4 text-evonext-500" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                                                </svg>
                                            )}

                                            <span className="text-gray-500">
                                                @{post.author.username}
                                            </span>
                                            <span className="text-gray-500">·</span>
                                        </>
                                    )}

                                    <span className="text-gray-500 hover:underline">{formatTime(post.createdAt)}</span>
                                </>
                            )}
                        </div>

                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <IconButton>
                                    <EllipsisHorizontalIcon className="h-5 w-5" />
                                </IconButton>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="min-w-[200px] bg-white dark:bg-black rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50"
                                    sideOffset={5}
                                >
                                    <DropdownMenu.Item className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none">
                                        Follow @{post.author.username}
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none">
                                        Add to Lists
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none">
                                        Mute @{post.author.username}
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none text-red-500">
                                        Block @{post.author.username}
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    </div>

                    <div className="mt-1 whitespace-pre-wrap break-words">
                        {post.content}
                    </div>

                    {post.quotedPost && (
                        <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors">
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Avatar className="h-5 w-5">
                                    <AvatarImage src={post.quotedPost.author.avatar} />

                                    <AvatarFallback>
                                        {getInitials(post.quotedPost.author.displayName)}
                                    </AvatarFallback>
                                </Avatar>

                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {post.quotedPost.author.displayName}
                                </span>

                                <span>
                                    @{post.quotedPost.author.username}
                                </span>
                                <span>·</span>

                                <span>
                                    {formatTime(post.quotedPost.createdAt)}
                                </span>
                            </div>

                            <div className="mt-1 text-sm">
                                {post.quotedPost.content}
                            </div>
                        </div>
                    )}

                    {post.media && post.media.length > 0 && (
                        <div className={cn(
                            'mt-3 grid gap-1 rounded-xl overflow-hidden',
                            post.media.length === 1 && 'grid-cols-1',
                            post.media.length === 2 && 'grid-cols-2',
                            post.media.length === 3 && 'grid-cols-2',
                            post.media.length >= 4 && 'grid-cols-2'
                        )}>
                            {post.media.map((media, index) => (
                                <div
                                    key={media.id}
                                    className={cn(
                                        'relative aspect-video bg-gray-100 dark:bg-gray-900',
                                        post.media!.length === 3 && index === 0 && 'row-span-2'
                                    )}
                                >
                                    <Image
                                        src={media.url}
                                        alt={media.alt || ''}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-3 -ml-2">
                        <Tooltip.Provider>
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        onClick={handleReply}
                                        className="group flex items-center gap-1 p-2 rounded-full hover:bg-evonext-50 dark:hover:bg-evonext-950 transition-colors"
                                    >
                                        <ChatBubbleOvalLeftIcon className="h-5 w-5 text-gray-500 group-hover:text-evonext-500 transition-colors" />
                                        <span className="text-sm text-gray-500 group-hover:text-evonext-500 transition-colors">
                                            {post.replies > 0 && formatNumber(post.replies)}
                                        </span>
                                    </button>
                                </Tooltip.Trigger>

                                <Tooltip.Portal>
                                    <Tooltip.Content
                                        className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                        sideOffset={5}
                                    >
                                        Reply
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            {/* WAS PREVIOUSLY RE-POST */}

                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button
                                        onClick={handleLike}
                                        className={cn(
                                            'group flex items-center gap-1 p-2 rounded-full transition-colors',
                                            liked
                                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                                            : 'hover:bg-red-50 dark:hover:bg-red-950'
                                        )}
                                    >
                                        <motion.div
                                            whileTap={{ scale: 0.8 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                        >
                                            {liked ? (
                                                <HeartIconSolid className="h-5 w-5 text-red-500" />
                                            ) : (
                                                <HeartIcon className="h-5 w-5 text-gray-500 group-hover:text-red-500 transition-colors" />
                                            )}
                                        </motion.div>

                                        <span className={cn(
                                            'text-sm transition-colors',
                                            liked ? 'text-red-500' : 'text-gray-500 group-hover:text-red-500'
                                        )}>
                                            {likes > 0 && formatNumber(likes)}
                                        </span>
                                    </button>
                                </Tooltip.Trigger>

                                <Tooltip.Portal>
                                    <Tooltip.Content
                                        className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                        sideOffset={5}
                                    >
                                        Like
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>

                            <div className="flex items-center gap-1">
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button
                                            onClick={handleRepost}
                                            className={cn(
                                                'group flex items-center gap-1 p-2 rounded-full transition-colors',
                                                reposted
                                                ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-950'
                                                : 'hover:bg-green-50 dark:hover:bg-green-950'
                                            )}
                                        >
                                            <SparklesIcon className={cn(
                                                'h-5 w-5 transition-colors',
                                                reposted ? 'text-green-500' : 'text-gray-500 group-hover:text-green-500'
                                            )} />

                                            <span className={cn(
                                                'text-sm transition-colors',
                                                reposted ? 'text-green-500' : 'text-gray-500 group-hover:text-green-500'
                                            )}>
                                                {reposts > 0 && formatNumber(reposts)}
                                            </span>
                                        </button>
                                    </Tooltip.Trigger>

                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                            sideOffset={5}
                                        >
                                            Remix
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                                {/* <Tooltip.Root>9
                                    <Tooltip.Trigger asChild>
                                        <button
                                            onClick={handleBookmark}
                                            className="p-2 rounded-full hover:bg-evonext-50 dark:hover:bg-evonext-950 transition-colors"
                                        >
                                            {bookmarked ? (
                                                <BookmarkIconSolid className="h-5 w-5 text-evonext-500" />
                                            ) : (
                                                <BookmarkIcon className="h-5 w-5 text-gray-500 hover:text-evonext-500 transition-colors" />
                                            )}
                                        </button>
                                    </Tooltip.Trigger>

                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                            sideOffset={5}
                                        >
                                            Bookmark
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root> */}

                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button
                                            onClick={handleShare}
                                            className="p-2 rounded-full hover:bg-evonext-50 dark:hover:bg-evonext-950 transition-colors"
                                        >
                                            <CurrencyDollarIcon className="h-5 w-5 text-gray-500 hover:text-evonext-500 transition-colors" />
                                        </button>
                                    </Tooltip.Trigger>

                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            className="bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                                            sideOffset={5}
                                        >
                                            Send a Tip
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            </div>
                        </Tooltip.Provider>
                    </div>
                </div>
            </div>

            <LikesModal
                isOpen={showLikesModal}
                onClose={() => setShowLikesModal(false)}
                postId={post.id}
            />
        </motion.article>
    )
}
