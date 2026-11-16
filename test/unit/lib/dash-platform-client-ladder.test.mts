// test/unit/lib/dash-platform-client-ladder.test.mts
// F57 Phase 3 regression — the document reads ride the ladder (proxy FIRST,
// wasm per-call fallback) AND the hard-won index shapes from F26o/F26p must
// survive the rewiring: the global feed's languageTimeline shape, the author
// feed's ownerAndTime shape, the replies' parentAndTime shape, the
// interaction counts' `in` batches, and the wasm fallback legs keeping their
// JSON-stringified clause serialization.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const getDocumentsMock = vi.hoisted(() => vi.fn())
const getDocumentMock = vi.hoisted(() => vi.fn())
const identityFetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/dash-wasm/compat', () => ({
    get_documents: getDocumentsMock,
    get_document: getDocumentMock,
    identity_fetch: identityFetchMock,
    PlatformVersion: { current: () => 1 },
}))

import { DashPlatformClient } from '@/lib/dash-platform-client'

const CONTRACT = 'EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJYNg63F'
const AUTHOR = '8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy'

function okEnvelope(result: unknown) {
    return { ok: true, json: async () => ({ success: true, result }) } as Response
}

function lastRequestBody(): { method: string; params: any; network: string } {
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    return JSON.parse((call[1] as RequestInit).body as string)
}

function makeClient(): any {
    const client = new DashPlatformClient(CONTRACT)
    /* Skip ensureInitialized (the wasm service singleton) — the ladder
     * methods only need this.sdk set for the fallback legs. */
    client.ensureInitialized = async () => undefined
    client.sdk = { __mockSdk: true }
    return client
}

describe('dash-platform-client: the document reads on the ladder (F57 Phase 3)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
        getDocumentsMock.mockReset()
        getDocumentMock.mockReset()
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('the GLOBAL feed keeps the F26o languageTimeline shape and goes proxy-first', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]))

        const posts = await client.queryPosts({ limit: 20, forceRefresh: true })

        expect(posts).toEqual([])
        const body = lastRequestBody()
        expect(body.method).toBe('get_documents')
        expect(body.network).toBe('testnet')
        expect(body.params.dataContractId).toBe(CONTRACT)
        expect(body.params.documentType).toBe('post')
        /* THE F26o SHAPE: language equality + the $createdAt range, ordered
         * by the languageTimeline index. Losing this = the stale-feed bug. */
        expect(body.params.whereClause).toEqual([['language', '==', 'en'], ['$createdAt', '>', 0]])
        expect(body.params.orderBy).toEqual([['language', 'asc'], ['$createdAt', 'desc']])
        expect(body.params.limit).toBe(20)
        expect(getDocumentsMock).not.toHaveBeenCalled()
    })

    it('the AUTHOR feed keeps the F26o ownerAndTime shape', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]))

        await client.queryPosts({ authorId: AUTHOR, limit: 20, forceRefresh: true })

        const body = lastRequestBody()
        expect(body.params.whereClause).toEqual([['$ownerId', '==', AUTHOR], ['$createdAt', '>', 0]])
        expect(body.params.orderBy).toEqual([['$ownerId', 'asc'], ['$createdAt', 'desc']])
    })

    it('getReplies keeps the F26p parentAndTime shape (oldest first)', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]))

        const replies = await client.getReplies('POST_ID_1')

        expect(replies).toEqual([])
        const body = lastRequestBody()
        expect(body.params.documentType).toBe('reply')
        expect(body.params.whereClause).toEqual([['parentId', '==', 'POST_ID_1']])
        expect(body.params.orderBy).toEqual([['parentId', 'asc'], ['$createdAt', 'asc']])
    })

    it('the interaction counts keep the F26p `in`-batch shapes', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]))

        await client.getInteractionCounts(['P1', 'P2'], 'VIEWER')

        const bodies = (fetch as unknown as ReturnType<typeof vi.fn>)
            .mock.calls.map((c: any[]) => JSON.parse((c[1] as RequestInit).body as string))
        const inClauses = bodies
            .map((b) => b.params.whereClause?.[0])
            .filter((w: any) => Array.isArray(w) && w[1] === 'in')
        /* like -> postId, reply -> parentId, remix/quote -> quotedPostId. */
        const fields = inClauses.map((w: any[]) => w[0]).sort()
        expect(fields).toEqual(['parentId', 'postId', 'quotedPostId'])
        expect(inClauses.every((w: any[]) => JSON.stringify(w[2]) === JSON.stringify(['P1', 'P2']))).toBe(true)
        expect(getDocumentsMock).not.toHaveBeenCalled()
    })

    it('getPostById uses the proxy get_document; a definitive miss does NOT burn the wasm fallback', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ success: false, error: 'Document not found' }),
        } as unknown as Response)

        const doc = await client.getPostById('MISSING_ID')

        expect(doc).toBeUndefined()
        expect(getDocumentMock).not.toHaveBeenCalled()
    })

    it('on a proxy failure the wasm fallback legs keep the EXACT prior serialization', async () => {
        const client = makeClient()
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({ success: false, error: 'Upstream DAPI unavailable' }),
        } as unknown as Response)

        await client.getReplies('POST_ID_1')

        /* The fallback leg must serialize the clauses EXACTLY like the
         * pre-ladder call sites did (JSON strings through compat). */
        expect(getDocumentsMock).toHaveBeenCalledTimes(1)
        expect(getDocumentsMock.mock.calls[0].slice(0, 8)).toEqual([
            { __mockSdk: true },
            CONTRACT,
            'reply',
            JSON.stringify([['parentId', '==', 'POST_ID_1']]),
            JSON.stringify([['parentId', 'asc'], ['$createdAt', 'asc']]),
            100,
            null,
            null,
        ])
    })
})
