// app/notifications/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    HeartIcon,
    ArrowPathRoundedSquareIcon,
    ChatBubbleLeftIcon,
    UserPlusIcon,
    BellIcon,
    Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { Button } from '@/components/ui/button'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import {
    fetchUserInteractions,
    markNotificationsRead,
    Notification,
    NotificationType
} from '@/lib/services/notification-service'
import Link from 'next/link'

function NotificationsPage() {
    const { user } = useAuth()
    const { network } = useNetwork()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<NotificationType | 'all'>('all')

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            if (!user?.identityId) return

            try {
                setIsLoading(true)

                const items = await fetchUserInteractions(
                    user.identityId,
                    user.dpnsUsername,
                    network
                )

                if (!cancelled) setNotifications(items)
            } catch (error) {
                console.error('Failed to load notifications:', error)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [user?.identityId, user?.dpnsUsername, network])

    const getIcon = (type: NotificationType) => {
        switch (type) {
        case 'like':
            return <HeartIconSolid className="h-5 w-5 text-red-500" />
        case 'remix':
            return <ArrowPathRoundedSquareIcon className="h-5 w-5 text-green-500" />
        case 'reply':
            return <ChatBubbleLeftIcon className="h-5 w-5 text-blue-500" />
        case 'follow':
            return <UserPlusIcon className="h-5 w-5 text-purple-500" />
        case 'mention':
            return <BellIcon className="h-5 w-5 text-yellow-500" />
        }
    }

    const formatTime = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'just now'
        if (minutes < 60) return `${minutes}m`
        if (hours < 24) return `${hours}h`
        if (days < 7) return `${days}d`

        return date.toLocaleDateString()
    }

    const filteredNotifications = filter === 'all'
        ? notifications
        : notifications.filter(n => n.type === filter)

    const markAllAsRead = () => {
        if (user?.identityId && notifications.length > 0) {
            markNotificationsRead(user.identityId, notifications[0].timestamp.getTime())
        }

        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="flex-1 mr-[350px] max-w-[600px] border-x border-gray-200 dark:border-gray-800">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between px-4 py-3">
                        <h1 className="text-xl font-bold">Notifications</h1>

                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                            <Cog6ToothIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex border-b border-gray-200 dark:border-gray-800">
                        {['all', 'like', 'remix', 'reply', 'follow', 'mention'].map((filterType) => (
                            <button
                                key={filterType}
                                onClick={() => setFilter(filterType as any)}
                                className={`flex-1 py-4 text-sm font-medium capitalize transition-colors relative ${
                                    filter === filterType
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {filterType === 'all' ? 'All' : filterType === 'remix' ? 'Reposts' : filterType + 's'}

                                {filter === filterType && (
                                    <motion.div
                                        layoutId="notificationTab"
                                        className="absolute bottom-0 left-0 right-0 h-1 bg-evonext-500"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </header>

                {notifications.some(n => !n.read) && (
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="text-evonext-500 hover:text-evonext-600"
                        >
                            Mark all as read
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading notifications...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No notifications yet</p>

                        <p className="text-sm text-gray-400 mt-2">
                            When someone interacts with your posts, you&apos;ll see it here
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredNotifications.map((notification) => (
                            <motion.div
                                key={notification.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors ${
                                    !notification.read ? 'bg-evonext-50/20 dark:bg-evonext-950/10' : ''
                                }`}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-1">{getIcon(notification.type)}</div>

                                    <div className="flex-1">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                                <AvatarCanvas
                                                    seed={notification.actor.avatarData || notification.actor.id}
                                                    size={40}
                                                />
                                            </div>

                                            <div className="flex-1">
                                                <p className="text-sm">
                                                    <span className="font-semibold">{notification.actor.displayName}</span>
                                                    {' '}
                                                    {notification.message}

                                                    <span className="text-gray-500 ml-2">
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                </p>

                                                {notification.postContent && notification.postId && (
                                                    <Link
                                                        href={`/post#${notification.postId}`}
                                                        className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg block text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                                    >
                                                        {notification.postContent}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {!notification.read && (
                                        <div className="w-2 h-2 bg-evonext-500 rounded-full mt-2" />
                                    )}
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

export default withAuth(NotificationsPage)
