'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
    ArrowRightOnRectangleIcon,
    BellIcon,
    BookmarkIcon,
    Cog6ToothIcon,
    EllipsisHorizontalIcon,
    EnvelopeIcon,
    HashtagIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    SparklesIcon,
    UserIcon,
    UserGroupIcon,
    UsersIcon,
    WalletIcon,
} from '@heroicons/react/24/outline'

import {
    BellIcon as BellIconSolid,
    BookmarkIcon as BookmarkIconSolid,
    EnvelopeIcon as EnvelopeIconSolid,
    HashtagIcon as HashtagIconSolid,
    HomeIcon as HomeIconSolid,
    MagnifyingGlassIcon as SearchIconSolid,
    SparklesIcon as SparklesIconSolid,
    UserIcon as UserIconSolid,
    UserGroupIcon as UserGroupIconSolid,
    UsersIcon as UsersIconSolid,
    WalletIcon as WalletIconSolid,
} from '@heroicons/react/24/solid'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'
import { getInitials } from '@/lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import { generateAvatarV2, decodeAvatarFeaturesV2 } from '@/lib/avatar-generator-v2'
import { useAuth } from '@/contexts/auth-context'

const getNavigation = (isLoggedIn: boolean) => {
    if (!isLoggedIn) {
        return [
            { name: 'Home', href: '/', icon: HomeIcon, activeIcon: HomeIconSolid },
            { name: 'Explore', href: '/explore', icon: HashtagIcon, activeIcon: HashtagIconSolid },
            { name: 'Claim', href: '/claim', icon: UserIcon, activeIcon: UserIconSolid },
        ]
    }

    return [
        { name: 'Home', href: '/posts', icon: HomeIcon, activeIcon: HomeIconSolid },
        // { name: 'Following', href: '/following', icon: UserGroupIcon, activeIcon: UserGroupIconSolid },
        // { name: 'Followers', href: '/followers', icon: UsersIcon, activeIcon: UsersIconSolid },
        { name: 'Explore', href: '/explore', icon: MagnifyingGlassIcon, activeIcon: SearchIconSolid },
        { name: 'Remix', href: '/remix', icon: SparklesIcon, activeIcon: SparklesIconSolid },
        // { name: 'Messages', href: '/messages', icon: EnvelopeIcon, activeIcon: EnvelopeIconSolid },
        { name: 'Bookmarks', href: '/bookmarks', icon: BookmarkIcon, activeIcon: BookmarkIconSolid },
        { name: 'Wallet', href: '/wallet', icon: WalletIcon, activeIcon: WalletIconSolid },
        { name: 'Profile', href: '/profile', icon: UserIcon, activeIcon: UserIconSolid },
    ]
}

export function Sidebar() {
    const pathname = usePathname()
    const { setComposeOpen } = useAppStore()
    const { user, logout } = useAuth()
    const [isHydrated, setIsHydrated] = useState(false)

    // Prevent hydration mismatches
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Get navigation based on auth status (use safe defaults during SSR)
    const navigation = getNavigation(isHydrated ? !!user : false)

    // Generate avatar based on identity ID
    const avatarFeatures = user && isHydrated ? generateAvatarV2(user.identityId) : null

    // Format identity ID for display (show first 6 and last 4 chars)
    const formatIdentityId = (id: string) => {
        if (id.length <= 10) {
            return id
        }

        return `${id.slice(0, 6)}...${id.slice(-4)}`
    }

    return (
        <div className="hidden h-screen max-w-sm w-full pt-16 lg:flex flex-col px-2 sticky top-0">
            <div className="flex-1 space-y-1 py-4 overflow-y-auto scrollbar-hide">
                <nav className="space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = isActive ? item.activeIcon : item.icon

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-4 px-3 py-3 text-xl rounded-full transition-all duration-200',
                                    'hover:bg-gray-100 dark:hover:bg-gray-900',
                                    isActive && 'font-bold'
                                )}
                            >
                                <Icon className="h-7 w-7" />
                                <span className="block">
                                    {item.name}
                                </span>
                            </Link>
                        )
                    })}

                    {user && isHydrated && (
                        <Link
                            href="/settings"
                            className="flex items-center gap-4 px-3 py-3 text-xl rounded-full transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                            <Cog6ToothIcon className="h-7 w-7" />
                            <span className="block">
                                Settings
                            </span>
                        </Link>
                    )}
                </nav>

                {isHydrated && user ? (
                    <Button
                        onClick={() => setComposeOpen(true)}
                        className="w-full mt-8 h-12 text-base xl:text-lg shadow-evonext-lg"
                        size="lg"
                    >
                        <PencilSquareIcon className="h-6 w-6 xl:hidden" />
                        <span className="block">
                            Post
                        </span>
                    </Button>
                ) : isHydrated ? (
                    <div className="mt-8 space-y-3">
                        <Button
                            asChild
                            className="w-full h-12 text-base xl:text-lg shadow-evonext-lg"
                            size="lg"
                        >
                            <Link href="/connect">
                                Connect
                            </Link>
                        </Button>

                        <p className="text-xs text-center text-gray-500 px-4">
                            Join EvoNext to share your voice on the decentralized web
                        </p>
                    </div>
                ) : (
                    // Show loading state during SSR/hydration
                    <div className="mt-8">
                        <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                )}
            </div>

            <div className="space-y-2 flex-shrink-0 pb-4">
                {user && isHydrated && (
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="flex items-center gap-3 p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors w-full">
                                <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                    {avatarFeatures ? (
                                        <AvatarCanvas features={avatarFeatures} size={40} />
                                    ) : (
                                        <Avatar>
                                            <AvatarFallback>
                                                {formatIdentityId(user.identityId).slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>

                                <div className="flex flex-1 text-left">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">
                                            Identity
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            {formatIdentityId(user.identityId)}
                                        </p>
                                    </div>

                                    <EllipsisHorizontalIcon className="h-5 w-5 text-gray-500" />
                                </div>
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className="min-w-[200px] bg-white dark:bg-black rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50"
                                sideOffset={5}
                            >
                                <DropdownMenu.Item
                                    className="px-4 py-3 text-sm outline-none"
                                    disabled
                                >
                                    <div className="text-xs text-gray-500">
                                        Balance
                                    </div>

                                    <div className="font-mono">
                                        {(() => {
                                            const balance = user.balance || 0

                                            // Balance is in duffs, convert to DASH (1 DASH = 100,000,000 duffs)
                                            const dashBalance = balance / 100000000

                                            return `${dashBalance.toFixed(8)} DASH`
                                        })()}
                                    </div>
                                </DropdownMenu.Item>

                                <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-800 my-1" />

                                <DropdownMenu.Item
                                    className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer outline-none flex items-center gap-2"
                                    onClick={logout}
                                >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                    Log out
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
            </div>
        </div>
    )
}
