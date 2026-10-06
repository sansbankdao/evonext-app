// lib/network-stats.ts
//
// Network-wide stats for the Yappr social contract. The contract has no
// countable indexes, so totals are computed by paginating every document
// (100 per query) and cached in localStorage to avoid rescanning often.
//
// Shared by the right sidebar's "Network Stats" tab and the home page
// stats section.

import { getWasmSdk } from './services/wasm-sdk-service'
import { get_documents } from './dash-wasm/compat'
import { YAPPR_CONTRACT_ID_TESTNET } from './constants'

export interface NetworkStats {
    totalPosts: number
    totalLikes: number
    totalFollows: number
    totalReplies: number
    uniquePosters: number
    posts24h: number
    lastPostAt: number | null
}

export const NETWORK_STATS_CACHE_KEY = 'evonext_network_stats_testnet'
export const NETWORK_STATS_TTL_MS = 60 * 60 * 1000 // 1 hour

// Query a contract document type and return the raw docs (up to limit).
// Dash Platform caps a single query at 100 docs, so counts are "at least".
export async function fetchDocs(
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

// Count all documents of a type by paginating (orderBy $id asc + startAfter).
// Optionally accumulates per-document data via onDocs (called per page).
export async function countAllDocuments(
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

export async function loadNetworkStats(contractId: string): Promise<NetworkStats> {
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

/**
 * Read the cached network stats from localStorage. Returns null when no
 * (parseable) entry exists; stale=true when the entry is older than the
 * TTL (caller decides whether to show it and refresh in background).
 */
export function readCachedNetworkStats(): { stats: NetworkStats; stale: boolean } | null {
    try {
        const raw = typeof window !== 'undefined'
            ? localStorage.getItem(NETWORK_STATS_CACHE_KEY)
            : null

        if (!raw) return null

        const { ts, data } = JSON.parse(raw)

        return { stats: data as NetworkStats, stale: Date.now() - ts > NETWORK_STATS_TTL_MS }
    } catch {
        /* corrupt cache entry — treat as missing */
        return null
    }
}

/**
 * Run a fresh full scan and persist it to the localStorage cache
 * (best-effort write).
 */
export async function refreshNetworkStats(
    contractId: string = YAPPR_CONTRACT_ID_TESTNET,
): Promise<NetworkStats> {
    const fresh = await loadNetworkStats(contractId)

    try {
        localStorage.setItem(
            NETWORK_STATS_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data: fresh })
        )
    } catch {
        /* storage full/unavailable — cache write is best effort */
    }

    return fresh
}
