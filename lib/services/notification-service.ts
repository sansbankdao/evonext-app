// lib/services/notification-service.ts

'use client'

import { getDashPlatformClient } from '@/lib/dash-platform-client'
import { resolveItemAuthors } from '@/lib/post-helpers'
import { get_documents } from '@/lib/dash-wasm/compat'
import { getWasmSdk } from '@/lib/services/wasm-sdk-service'
import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'

// Local network detection: NetworkProvider sets the raw host string for
// localhost/IPFS, so the testnet fall-through must accept anything that is
// not 'mainnet' (same convention as app/posts/page.tsx).
const getContractIdFor = (network: string): any => {
    let contractId

    if (network === 'mainnet') {
        contractId = EVONEXT_CONTRACT_ID_MAINNET
    } else {
        contractId = EVONEXT_CONTRACT_ID_TESTNET
    }

    return contractId
}

export type NotificationType = 'like' | 'remix' | 'reply' | 'follow' | 'mention'

export interface NotificationActor {
    id: string
    username: string
    displayName: string
    avatarData?: string
}

export interface Notification {
    id: string
    type: NotificationType
    message: string
    timestamp: Date
    read: boolean
    actor: NotificationActor
    postId?: string
    postContent?: string
}

const MESSAGES: Record<NotificationType, string> = {
    like: 'liked your post',
    remix: 'remixed your post',
    reply: 'replied to your post',
    follow: 'started following you',
    mention: 'mentioned you',
}

// Read state is a local concept (there is no on-chain "seen" marker): the
// timestamp of the newest notification the user has already viewed.
const readCursorKey = (identityId: string) =>
    `evonext_notifications_read_${identityId}`

const getReadCursor = (identityId: string): number => {
    try {
        return Number(localStorage.getItem(readCursorKey(identityId))) || 0
    } catch {
        return 0
    }
}

export const markNotificationsRead = (identityId: string, cursorMs: number): void => {
    try {
        localStorage.setItem(readCursorKey(identityId), String(cursorMs))
    } catch {
        // localStorage unavailable (SSR/privacy mode) — read state is cosmetic
    }
}

/**
 * A mention of the viewer inside a post body: `@username` where the
 * username is the viewer's DPNS label, with or without the .dash suffix.
 * Case-insensitive (DPNS normalizes to lowercase).
 */
const contentMentions = (content: string, dpnsUsername?: string): boolean => {
    if (!dpnsUsername) return false

    const label = dpnsUsername.replace(/\.dash$/i, '').toLowerCase()

    if (!label) return false

    return content.toLowerCase().includes(`@${label}`)
}

/**
 * Fetch the viewer's real notifications from the Yappr contract:
 * likes / replies / remixes targeting the viewer's recent posts, new
 * followers, and @mentions of the viewer's DPNS name in recent posts.
 * Interactions by the viewer themself are excluded.
 */
export const fetchUserInteractions = async (
    identityId: string,
    dpnsUsername?: string,
    network?: string | null
): Promise<Notification[]> => {
    const dashClient = getDashPlatformClient(getContractIdFor(network || ''))
    const readCursor = getReadCursor(identityId)

    // 1. The viewer's recent posts (the interaction targets).
    const myPosts = await dashClient.queryPosts({ authorId: identityId, limit: 20 })
    const myPostList = Array.isArray(myPosts) ? myPosts : []
    const myPostIds: string[] = myPostList.map((d: any) => String(d.$id || d.id))
    const postContentById = new Map<string, string>(
        myPostList.map((d: any) => [
            String(d.$id || d.id),
            String((d.content ?? d.data?.content) || ''),
        ])
    )

    // 2-4. Interactions, follows and mention candidates in parallel.
    // Follows are queried directly (same reliable client + testnet
    // fall-through) rather than via followService, whose singleton was
    // constructed from lib/network.ts and can bind to the raw host on
    // localhost/IPFS deployments.
    const fetchFollowers = async () => {
        try {
            const sdk = await getWasmSdk()
            const response = await get_documents(
                sdk,
                dashClient.activeContractId!,
                'follow',
                JSON.stringify([['followingId', '==', identityId]]),
                null, // orderBy — the followers index covers followingId
                100,
                null, // startAfter
                null  // startAt
            )

            return Array.isArray(response) ? response : []
        } catch (error) {
            const message = (error as any)?.message || String(error)
            console.error('Notifications: Failed to fetch followers:', message)
            return []
        }
    }

    const [interactions, followers, recentPosts] = await Promise.all([
        dashClient.getInteractionsForPosts(myPostIds),
        fetchFollowers(),
        // Mention candidates: the recent global feed, filtered below. Only
        // worth fetching when the viewer actually has a DPNS name.
        dpnsUsername
            ? dashClient.queryPosts({ limit: 20 }).catch(() => [])
            : Promise.resolve([]),
    ])

    const notifications: Notification[] = []

    // 2. Likes / replies / remixes on the viewer's posts.
    for (const row of interactions) {
        // Skip the viewer's own interactions with their own posts.
        if (row.ownerId === identityId) continue

        notifications.push({
            id: `${row.kind}_${row.id}`,
            type: row.kind,
            message: MESSAGES[row.kind],
            timestamp: new Date(row.createdAtMs || Date.now()),
            read: row.createdAtMs <= readCursor,
            actor: { id: row.ownerId, username: '', displayName: '' },
            postId: row.postId,
            postContent: postContentById.get(row.postId),
        })
    }

    // 3. Followers.
    for (const doc of followers) {
        const ownerId = String((doc as any).$ownerId || (doc as any).ownerId || '')

        if (!ownerId || ownerId === identityId) continue

        const createdAtMs = Number((doc as any).$createdAt || (doc as any).createdAt || 0)

        notifications.push({
            id: `follow_${(doc as any).$id || (doc as any).id}`,
            type: 'follow',
            message: MESSAGES.follow,
            timestamp: new Date(createdAtMs || Date.now()),
            read: createdAtMs <= readCursor,
            actor: { id: ownerId, username: '', displayName: '' },
        })
    }

    // 4. Mentions of the viewer's DPNS name in recent posts (excludes the
    // viewer's own posts and posts already covered as replies to them).
    const myPostIdSet = new Set(myPostIds)

    for (const doc of (Array.isArray(recentPosts) ? recentPosts : [])) {
        const ownerId = String((doc as any).$ownerId || (doc as any).ownerId || '')
        const docId = String((doc as any).$id || (doc as any).id)
        const content = String((doc as any).content ?? (doc as any).data?.content ?? '')

        if (!ownerId || ownerId === identityId || myPostIdSet.has(docId)) continue
        if (!contentMentions(content, dpnsUsername)) continue

        const createdAtMs = Number((doc as any).$createdAt || (doc as any).createdAt || 0)

        notifications.push({
            id: `mention_${docId}`,
            type: 'mention',
            message: MESSAGES.mention,
            timestamp: new Date(createdAtMs || Date.now()),
            read: createdAtMs <= readCursor,
            actor: { id: ownerId, username: '', displayName: '' },
            postId: docId,
            postContent: content,
        })
    }

    // Resolve actor names (profile + DPNS) with the same shared helper the
    // feed and details page use, then sort newest first.
    const resolved = await resolveItemAuthors(
        notifications.map((n) => ({ ...n, author: n.actor }))
    )

    const result = notifications.map((n, i) => {
        const author = (resolved[i] as any)?.author

        return {
            ...n,
            actor: {
                id: n.actor.id,
                username: author?.username || `user_${n.actor.id.slice(-6)}`,
                displayName: author?.displayName || `User ${n.actor.id.slice(-6)}`,
                avatarData: author?.avatarData,
            },
        }
    })

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return result
}
