'use client'

import {
    MagnifyingGlassIcon,
    ChartBarIcon,
    ClockIcon,
    FireIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline'
import { formatNumber, formatTime } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { EVONEXT_CONTRACT_ID } from '@/lib/constants'

export function RightSidebar() {
    const { user } = useAuth()
    const { network } = useNetwork()

    return (
        <div className="hidden max-w-md w-full h-screen overflow-y-auto lg:flex flex-col px-4 py-4 space-y-4">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />

                <input
                    type="text"
                    placeholder="Search"
                    className="w-full h-12 pl-12 pr-4 bg-gray-100 dark:bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-evonext-500 focus:bg-transparent dark:focus:bg-transparent"
                />
            </div>

            <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
                <h2 className="text-xl font-bold px-4 py-3">
                    Platform Info
                </h2>

                <div className="px-4 py-3 space-y-2">
                    <div>
                        <p className="text-sm text-gray-500">Contract ID</p>
                        <p className="text-xs font-mono break-all">{EVONEXT_CONTRACT_ID}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Dash Platform Network</p>
                        <p className="text-sm font-semibold capitalize">{network || 'testnet'}</p>
                    </div>

                    {/* <div>
                        <p className="text-sm text-gray-500">Document Types</p>
                        <p className="text-sm">13 types available</p>
                    </div> */}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
                <h2 className="text-xl font-bold px-4 py-3">
                    Getting Started
                </h2>

                <div className="px-4 py-3 space-y-3 text-sm">
                    <p className="text-gray-600 dark:text-gray-400">
                        Welcome to EvoNext
                        <br />Here&apos;s what you can do:
                    </p>

                    <ul className="space-y-2 pl-5 list-decimal text-gray-600 dark:text-gray-400">
                        <li>Register your Platform Identity</li>
                        <li>Customize your Platform Identity</li>
                        <li>Share Your First Post</li>
                        <li>Remix Your First Post</li>
                    </ul>
                </div>
            </div>

            {user && (
                <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
                    <h2 className="text-xl font-bold px-4 py-3 flex items-center gap-2">
                        <ChartBarIcon className="h-5 w-5" />
                        Stats
                    </h2>

                    <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Last Post
                                </p>
                            </div>

                            <p className="text-sm font-medium">
                                2 hours ago
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FireIcon className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Posting Streak
                                </p>
                            </div>

                            <p className="text-sm font-medium">
                                7 days
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Followers</p>
                            </div>

                            <p className="text-sm font-medium">{formatNumber(342)}</p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total Posts</span>
                                <span className="font-medium">{formatNumber(128)}</span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total Likes</span>
                                <span className="font-medium">{formatNumber(1234)}</span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Engagement Rate</span>
                                <span className="font-medium">12.3%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-4 py-2 text-xs text-gray-500 space-x-2">
                <a href="/terms" className="hover:underline">Terms</a>
                <a href="/privacy" className="hover:underline">Privacy</a>
                <a href="/cookies" className="hover:underline">Cookies</a>
                <a href="/about" className="hover:underline">About</a>
            </div>
        </div>
    )
}
