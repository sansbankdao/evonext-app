'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
    YAPPR_CONTRACT_ID_TESTNET,
} from '@/lib/constants'
import { getWasmSdk } from '@/lib/services/wasm-sdk-service'
import { get_documents } from '@/lib/dash-wasm/compat'

// Network-wide stats for the Yappr social contract. The contract has no
// countable indexes, so totals are computed by paginating every document
// (100 per query) and cached in localStorage to avoid rescanning often.
interface NetworkStats {
    totalPosts: number
    totalLikes: number
    totalFollows: number
    totalReplies: number
    uniquePosters: number
    posts24h: number
    lastPostAt: number | null
}

const NETWORK_STATS_CACHE_KEY = 'evonext_network_stats_testnet'
const NETWORK_STATS_TTL_MS = 60 * 60 * 1000 // 1 hour

// Count all documents of a type by paginating (orderBy $id asc + startAfter).
// Optionally accumulates per-document data via onDocs (called per page).
async function countAllDocuments(
    contractId: string,
    documentType: string,
    onDocs?: (docs: any[]) => void,
): Promise<{ total: number; complete: boolean }> {
    let total = 0
    let after: string | undefined

    for (let page = 0; page < 100; page++) {
        const { docs } = await fetchDocs(
            contractId, documentType, null,
            [['$id', 'asc']], after,
        )

        if (onDocs) onDocs(docs)

        total += docs.length

        if (docs.length < 100) return { total, complete: true }

        after = String(docs[docs.length - 1].$id)
    }

    return { total, complete: false }
}

async function loadNetworkStats(contractId: string): Promise<NetworkStats> {
    const owners = new Set<string>()
    let posts24h = 0
    let lastPostAt: number | null = null
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000

    const [posts, likes, follows, replies] = await Promise.all([
        countAllDocuments(contractId, 'post', (docs) => {
            for (const d of docs) {
                owners.add(String(d.$ownerId))
                const t = Number(d.$createdAt)
                if (t >= dayAgo) posts24h += 1
                if (lastPostAt === null || t > lastPostAt) lastPostAt = t
            }
        }),
        countAllDocuments(contractId, 'like'),
        countAllDocuments(contractId, 'follow'),
        countAllDocuments(contractId, 'reply'),
    ])

    return {
        totalPosts: posts.total,
        totalLikes: likes.total,
        totalFollows: follows.total,
        totalReplies: replies.total,
        uniquePosters: owners.size,
        posts24h,
        lastPostAt,
    }
}

interface YappStats {
    totalPosts: number
    postsTruncated: boolean
    totalFollowers: number
    followersTruncated: boolean
    totalLikes: number
    likesTruncated: boolean
    lastPostAt: number | null
    streak: number
}

const EMPTY_STATS: YappStats = {
    totalPosts: 0,
    postsTruncated: false,
    totalFollowers: 0,
    followersTruncated: false,
    totalLikes: 0,
    likesTruncated: false,
    lastPostAt: null,
    streak: 0,
}

// Query a contract document type and return the raw docs (up to limit).
// Dash Platform caps a single query at 100 docs, so counts are "at least".
async function fetchDocs(
    contractId: string,
    documentType: string,
    where: unknown[][] | null,
    orderBy: [string, 'asc' | 'desc'][] | null,
    startAfter?: string,
): Promise<{ docs: any[]; truncated: boolean }> {
    const sdk = await getWasmSdk()
    const response = await get_documents(
        sdk, contractId, documentType, where, orderBy, 100, startAfter || null, null
    )
    let docs: any[] = []
    if (Array.isArray(response)) {
        docs = response
    } else if (response && typeof (response as any).toJSON === 'function') {
        const j = (response as any).toJSON()
        docs = Array.isArray(j) ? j : (j?.documents || [])
    } else {
        docs = (response as any)?.documents || []
    }
    return { docs: docs.map((d: any) => (d.toJSON ? d.toJSON() : d)), truncated: docs.length >= 100 }
}

// Count consecutive posting days ending today (or yesterday if nothing today).
function computeStreak(createdAtList: number[]): number {
    if (createdAtList.length === 0) return 0
    const days = new Set(
        createdAtList.map((t) => new Date(t).toISOString().slice(0, 10))
    )
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMs = 86400000
    let cursor = today.getTime()
    if (!days.has(new Date(cursor).toISOString().slice(0, 10))) {
        cursor -= dayMs
        if (!days.has(new Date(cursor).toISOString().slice(0, 10))) {
            return 0
        }
    }
    let streak = 0
    while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
        streak += 1
        cursor -= dayMs
    }
    return streak
}

export function RightSidebar() {
    const { user } = useAuth()
    const { network } = useNetwork()

    /* Initialize locals. */
    let contractId

    /* Handle network. */
    if (network === 'mainnet') {
        contractId = EVONEXT_CONTRACT_ID_MAINNET
    } else {
        contractId = EVONEXT_CONTRACT_ID_TESTNET
    }

    // Real stats from the Yappr social contract (testnet). Previously this
    // section was hardcoded mock data ("2 hours ago", 342 followers, etc.).
    const [stats, setStats] = useState<YappStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)

    // Network-wide stats (paginated counts, cached for an hour).
    const [statsTab, setStatsTab] = useState<'my' | 'network'>('my')
    const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null)
    const [networkStatsLoading, setNetworkStatsLoading] = useState(false)
    const [networkStatsStale, setNetworkStatsStale] = useState(false)

    useEffect(() => {
        let cancelled = false

        const refresh = async () => {
            setNetworkStatsLoading(true)

            try {
                const data = await loadNetworkStats(YAPPR_CONTRACT_ID_TESTNET)

                if (cancelled) return

                setNetworkStats(data)
                setNetworkStatsStale(false)
                localStorage.setItem(
                    NETWORK_STATS_CACHE_KEY,
                    JSON.stringify({ ts: Date.now(), data })
                )
            } catch (error) {
                console.error('Failed to load network stats:', error)
            } finally {
                if (!cancelled) setNetworkStatsLoading(false)
            }
        }

        // The app convention: anything that is not 'mainnet' runs against
        // testnet (localhost/IPFS hosts resolve to a raw host string).
        if (network === 'mainnet') return

        // Serve from cache when fresh; refresh in the background when stale.
        try {
            const raw = localStorage.getItem(NETWORK_STATS_CACHE_KEY)

            if (raw) {
                const { ts, data } = JSON.parse(raw)
                setNetworkStats(data)

                if (Date.now() - ts > NETWORK_STATS_TTL_MS) {
                    setNetworkStatsStale(true)
                    refresh()
                }

                return
            }
        } catch {
            /* corrupt cache entry — fall through to a full refresh */
        }

        refresh()
        return () => { cancelled = true }
    }, [network])

    useEffect(() => {
        let cancelled = false

        const loadStats = async () => {
            // The app convention: anything that is not 'mainnet' runs against
            // testnet (localhost/IPFS hosts resolve to a raw host string).
            if (!user?.identityId || network === 'mainnet') {
                setStats(null)
                return
            }

            setStatsLoading(true)

            try {
                const me = user.identityId

                const posts = await fetchDocs(
                    YAPPR_CONTRACT_ID_TESTNET, 'post',
                    [['$ownerId', '==', me]],
                    [['$createdAt', 'desc']],
                )
                const followers = await fetchDocs(
                    YAPPR_CONTRACT_ID_TESTNET, 'follow',
                    [['followingId', '==', me]],
                    null,
                )
                const likes = await fetchDocs(
                    YAPPR_CONTRACT_ID_TESTNET, 'like',
                    [['postOwnerId', '==', me]],
                    null,
                )

                if (cancelled) return

                const lastPostAt = posts.docs.length
                    ? Number(posts.docs[0].$createdAt)
                    : null

                setStats({
                    totalPosts: posts.docs.length,
                    postsTruncated: posts.truncated,
                    totalFollowers: followers.docs.length,
                    followersTruncated: followers.truncated,
                    totalLikes: likes.docs.length,
                    likesTruncated: likes.truncated,
                    lastPostAt,
                    streak: computeStreak(
                        posts.docs.map((d: any) => Number(d.$createdAt))
                    ),
                })
            } catch (error) {
                console.error('Failed to load Yappr stats:', error)
                if (!cancelled) setStats(EMPTY_STATS)
            } finally {
                if (!cancelled) setStatsLoading(false)
            }
        }

        loadStats()
        return () => { cancelled = true }
    }, [user?.identityId, network])

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
                        <p className="text-xs font-mono break-all">{contractId}</p>
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

            {user && (
                <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
                    <h2 className="text-xl font-bold px-4 py-3 flex items-center gap-2">
                        <ChartBarIcon className="h-5 w-5" />
                        Stats
                    </h2>

                    {/* My Stats / Network Stats tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setStatsTab('my')}
                            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
                                statsTab === 'my'
                                    ? 'text-evonext-600 dark:text-evonext-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            My Stats
                            {statsTab === 'my' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-evonext-500" />
                            )}
                        </button>
                        <button
                            onClick={() => setStatsTab('network')}
                            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
                                statsTab === 'network'
                                    ? 'text-evonext-600 dark:text-evonext-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            Network Stats
                            {statsTab === 'network' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-evonext-500" />
                            )}
                        </button>
                    </div>

                    {statsTab === 'my' ? (<div className="px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Last Post
                                </p>
                            </div>

                            <p className="text-sm font-medium">
                                {statsLoading
                                    ? '...'
                                    : stats?.lastPostAt
                                        ? formatTime(new Date(stats.lastPostAt))
                                        : 'Never'}
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
                                {statsLoading ? '...' : `${stats?.streak ?? 0} day${(stats?.streak ?? 0) === 1 ? '' : 's'}`}
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Followers</p>
                            </div>

                            <p className="text-sm font-medium">
                                {statsLoading ? '...' : `${formatNumber(stats?.totalFollowers ?? 0)}${stats?.followersTruncated ? '+' : ''}`}
                            </p>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total Posts</span>
                                <span className="font-medium">
                                    {statsLoading ? '...' : `${formatNumber(stats?.totalPosts ?? 0)}${stats?.postsTruncated ? '+' : ''}`}
                                </span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total Likes</span>
                                <span className="font-medium">
                                    {statsLoading ? '...' : `${formatNumber(stats?.totalLikes ?? 0)}${stats?.likesTruncated ? '+' : ''}`}
                                </span>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Engagement Rate</span>
                                <span className="font-medium">
                                    {statsLoading
                                        ? '...'
                                        : (stats?.postsTruncated || stats?.likesTruncated)
                                            ? '—'
                                            : `${stats && stats.totalPosts > 0
                                                ? ((stats.totalLikes / stats.totalPosts) * 100).toFixed(1)
                                                : '0.0'}%`}
                                </span>
                            </div>
                        </div>

                        <p className="text-2xs text-gray-400">
                            Live from the Yappr social contract (testnet). Counts capped at 100 per query.
                        </p>
                        </div>
                    ) : (
                        <div className="px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Posts</p>
                                <p className="text-sm font-medium">
                                    {networkStats ? formatNumber(networkStats.totalPosts) : (networkStatsLoading ? '...' : '—')}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Posts (24h)</p>
                                <p className="text-sm font-medium">
                                    {networkStats ? formatNumber(networkStats.posts24h) : (networkStatsLoading ? '...' : '—')}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Posters</p>
                                <p className="text-sm font-medium">
                                    {networkStats ? formatNumber(networkStats.uniquePosters) : (networkStatsLoading ? '...' : '—')}
                                </p>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Total Likes</span>
                                    <span className="font-medium">
                                        {networkStats ? formatNumber(networkStats.totalLikes) : (networkStatsLoading ? '...' : '—')}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Total Follows</span>
                                    <span className="font-medium">
                                        {networkStats ? formatNumber(networkStats.totalFollows) : (networkStatsLoading ? '...' : '—')}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Total Replies</span>
                                    <span className="font-medium">
                                        {networkStats ? formatNumber(networkStats.totalReplies) : (networkStatsLoading ? '...' : '—')}
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Last Post</span>
                                    <span className="font-medium">
                                        {networkStats?.lastPostAt ? formatTime(new Date(networkStats.lastPostAt)) : (networkStatsLoading ? '...' : '—')}
                                    </span>
                                </div>
                            </div>

                            <p className="text-2xs text-gray-400">
                                Live from the Yappr social contract (testnet){networkStatsStale ? ' — refreshing…' : ''}: {YAPPR_CONTRACT_ID_TESTNET.slice(0, 6)}…{YAPPR_CONTRACT_ID_TESTNET.slice(-6)}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="px-4 py-2 text-2xs text-gray-500 space-x-2">
                <Link href="/terms" className="hover:underline">Terms</Link>
                <Link href="/privacy" className="hover:underline">Privacy</Link>
                <Link href="/cookies" className="hover:underline">Cookies</Link>
                <Link href="/about" className="hover:underline">About</Link>
            </div>
        </div>
    )
}
