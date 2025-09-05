'use client'

import { useState, useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { XMarkIcon, PhotoIcon, GifIcon, FaceSmileIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '@/lib/store'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { getInitials } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import { generateAvatarV2 } from '@/lib/avatar-generator-v2'

export function ComposeModal() {
    const { isComposeOpen, setComposeOpen, replyingTo, setReplyingTo } = useAppStore()
    const { user } = useAuth()
    const [content, setContent] = useState('')
    const [isPosting, setIsPosting] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Generate avatar based on identity ID
    const avatarFeatures = user ? generateAvatarV2(user.identityId) : null

    const characterLimit = 500
    const remainingCharacters = characterLimit - content.length
    const progressPercentage = (content.length / characterLimit) * 100

    useEffect(() => {
        if (isComposeOpen && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [isComposeOpen])

    const handlePost = async () => {
        if (!content.trim() || content.length > characterLimit || !user) {
            return
        }

        setIsPosting(true)

        const postContent = content.trim()

        try {
            const { getDashPlatformClient } = await import('@/lib/dash-platform-client')
            const { retryPostCreation, isNetworkError } = await import('@/lib/retry-utils')

            console.log('Creating post with Dash SDK...')

            // Use retry logic for post creation
            const result = await retryPostCreation(async () => {
                const dashClient = getDashPlatformClient()

                return await dashClient.createPost(postContent, {
                    replyToPostId: replyingTo?.id
                })
            })
console.log('COMPOSE RESULT', result)
            if (result.success) {
                toast.success('Post created successfully!')

                // Clear the form and close modal
                setContent('')
                setComposeOpen(false)
                setReplyingTo(null)

                // Trigger feed refresh if possible
                window.dispatchEvent(new CustomEvent('post-created', {
                    detail: { post: result.data }
                }))
            } else {
                throw result.error || new Error('Post creation failed')
            }
        } catch (error) {
            console.error('Failed to create post:', error)

            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
console.log('COMPOSE ERROR', errorMessage)
            if (errorMessage.includes('no available addresses') || errorMessage.includes('Missing response message')) {
                toast.error('Dash Platform is temporarily unavailable. Please try again in a few moments.')
            } else if (errorMessage.includes('Network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
                toast.error('Network error. Please check your connection and try again.')
            } else if (errorMessage.includes('Private key not found')) {
                toast.error('Your session has expired. Please log in again.')
            } else if (errorMessage.includes('Not logged in')) {
                toast.error('Please log in to create posts.')
            } else {
                toast.error(`Failed to create post: ${errorMessage}`)
            }
        } finally {
            setIsPosting(false)
        }
    }

    const handleClose = () => {
        setComposeOpen(false)
        setReplyingTo(null)
        setContent('')
    }

    return (
        <Dialog.Root open={isComposeOpen} onOpenChange={setComposeOpen}>
            <AnimatePresence>
                {isComposeOpen && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/50 z-50"
                            />
                        </Dialog.Overlay>

                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-[600px] bg-white dark:bg-black rounded-2xl shadow-xl z-50"
                            >
                                {/* Add Dialog Title for accessibility */}
                                <Dialog.Title className="sr-only">
                                    {replyingTo ? 'Reply to post' : 'Create a new post'}
                                </Dialog.Title>

                                <Dialog.Description className="sr-only">
                                    {replyingTo ? 'Write your reply to the post' : 'Share your thoughts with the community'}
                                </Dialog.Description>

                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                                    <IconButton onClick={handleClose}>
                                        <XMarkIcon className="h-5 w-5" />
                                    </IconButton>

                                    <Button
                                        onClick={handlePost}
                                        disabled={!content.trim() || content.length > characterLimit || isPosting}
                                        size="sm"
                                    >
                                        {isPosting ? (
                                            <span className="flex items-center gap-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>

                                                {replyingTo ? 'Replying...' : 'Posting...'}
                                            </span>
                                        ) : (
                                            replyingTo ? 'Reply' : 'Post'
                                        )}
                                    </Button>
                                </div>

                                <div className="p-4">
                                    {replyingTo && (
                                        <div className="mb-4 text-sm text-gray-500">
                                            Replying to <span className="text-evonext-500">@{replyingTo.author.username}</span>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                                            {avatarFeatures ? (
                                                <AvatarCanvas features={avatarFeatures} size={48} />
                                            ) : (
                                                <Avatar>
                                                    <AvatarFallback>
                                                        {user?.identityId.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <textarea
                                                ref={textareaRef}
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder={replyingTo ? "Post your reply" : "What's happening?"}
                                                className="w-full min-h-[120px] text-lg resize-none outline-none bg-transparent placeholder:text-gray-500"
                                            />

                                            <div className="mt-4 flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <IconButton variant="primary">
                                                        <PhotoIcon className="h-5 w-5" />
                                                    </IconButton>

                                                    <IconButton variant="primary">
                                                        <GifIcon className="h-5 w-5" />
                                                    </IconButton>

                                                    <IconButton variant="primary">
                                                        <FaceSmileIcon className="h-5 w-5" />
                                                    </IconButton>

                                                    <IconButton variant="primary">
                                                        <MapPinIcon className="h-5 w-5" />
                                                    </IconButton>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {content.length > 0 && (
                                                        <div className="relative">
                                                            <svg className="h-8 w-8 -rotate-90">
                                                                <circle
                                                                    cx="16"
                                                                    cy="16"
                                                                    r="12"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    className="text-gray-200 dark:text-gray-800"
                                                                />

                                                                <circle
                                                                    cx="16"
                                                                    cy="16"
                                                                    r="12"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeDasharray={`${2 * Math.PI * 12}`}
                                                                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - progressPercentage / 100)}`}
                                                                    className={
                                                                        remainingCharacters < 0
                                                                        ? 'text-red-500'
                                                                        : remainingCharacters < 20
                                                                        ? 'text-yellow-500'
                                                                        : 'text-evonext-500'
                                                                    }
                                                                />
                                                            </svg>

                                                            {remainingCharacters < 20 && (
                                                                <span className={`absolute inset-0 flex items-center justify-center text-xs font-medium
                                                                    ${remainingCharacters < 0 ? 'text-red-500' : ''}`}>
                                                                    {remainingCharacters}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    )
}
