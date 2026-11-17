/**
 * lib/wallet-history.ts — F59: the wallet History tab's real data layer.
 *
 * Sources, all honest — no invented transactions anywhere:
 *   (a) WITHDRAWALS TO CORE — the system contract's `withdrawal` documents
 *       (contract 4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6 — verified
 *       live on BOTH networks, see AGENTS.md F32/F48), queried by the
 *       WITHDRAWING identity ($ownerId == identityId — F48 correction: the
 *       doc's $ownerId is the withdrawer, not the all-zeros contract
 *       owner) over the identityRecent($ownerId,$updatedAt,status) index.
 *       Docs are FLAT: amount/outputScript/status/transactionIndex/
 *       transactionSignHeight at top level (F48). Status 2 = signed
 *       (awaiting the L1 payout), 3 = complete. Amount is CREDITS
 *       (1 DASH = 1e11 credits — F32's 200M-credit = 200,000-duff proof).
 *   (b) SWAPS — the wallet's own DashSwap records (localStorage
 *       `evonext_swaps_<network>`, written by components/wallet/swap.tsx —
 *       a map of swapid -> record, the engine's status vocabulary).
 *
 * The previous History tab was unfinished scaffolding (a hardcoded
 * DEFAULT_TX, stub renderers returning '', and a bogus
 * explorer.dash.org/tx/ link with an empty txid — the F53d-class defect).
 */

/* GOTCHA (live-hit 2026-11-17): a 43-char transcription of this id (one
 * dropped 'r', 31 base58 bytes) circulated in session notes and cost a
 * full debugging pass — rc.8's query deserializer REJECTS any identifier
 * that does not decode to exactly 32 bytes, so the History tab died with
 * "Identifier must be 32 bytes long". The verified 44-char id below comes
 * from test/e2e/shield-stage5-withdrawal.live.mts:56 (the F48-verified
 * constant, decodes to exactly 32 bytes) and matches every live F32/F48
 * run. ALWAYS verify a Dash identifier decodes to 32 bytes before
 * trusting a transcription. */
export const SYSTEM_WITHDRAWAL_CONTRACT_ID = '4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6'

/** 1 DASH = 1e11 credits on Platform (verified: F32 200M-credit withdrawal = 200,000 duffs). */
export const CREDITS_PER_DASH = 1e11
/** 1 DASH = 1e8 duffs on Core. */
export const DUFFS_PER_DASH = 1e8

/** The DashSwap engine's pinned status vocabulary (F58 — read from their
 * src/lib/detect.ts; no refund/failure states exist yet). Shared here so
 * swap.tsx and the history tab can never drift. */
export const SWAP_STATUS_LABEL: Record<string, string> = {
    pending: 'Waiting for your deposit',
    detected: 'Deposit detected — confirming on-chain',
    confirmed: 'Deposit confirmed — preparing settlement',
    settling: 'Settling — sending your tokens',
    settled: 'Settled',
}
export const swapStatusLabel = (status: string): string => SWAP_STATUS_LABEL[status] ?? `Status: ${status}`
/** The engine has NO failure states yet (F58) — an unrecognized status is
 * never a fake failure; it renders neutrally via the label above. */
export const swapStatusFailed = (_status: string): boolean => false
export const swapIsSettled = (status: string): boolean => status === 'settled'

/** Truncate (never round) a DASH number to at most `max` decimals, trailing
 * zeros trimmed — the F37b dashOfMax4 pattern.
 *
 * NOT a floor-shift: binary floats sit BELOW true decimal values at the
 * truncation boundary (59820000/1e8 = 0.59819999… → floor gives 0.59819999).
 * Instead round at max+6 decimals (absorbs the float error), then CUT the
 * string — a true truncate at `max` digits. */
export function dashOfMax(value: number, max: number = 4): string {
    if (!Number.isFinite(value)) return '0'
    const s = value.toFixed(max + 6)
    const dot = s.indexOf('.')
    const cut = dot === -1 ? s : s.slice(0, dot + 1 + max)
    const trimmed = cut.replace(/\.?0+$/, '')
    return trimmed || '0'
}

export type ActivityKind = 'withdrawal' | 'transfer' | 'swap'
export type ActivityTone = 'ok' | 'pending' | 'warn' | 'neutral'

export interface ActivityRow {
    key: string
    kind: ActivityKind
    /** Primary amount, already formatted (e.g. "0.001"). */
    amountLabel: string
    /** Asset of the primary amount (e.g. "DASH"). */
    assetLabel: string
    /** e.g. "withdrawn to Core" or "swapped to SANS". */
    directionLabel: string
    /** For transfer rows: which way the value moved (the icon reads it). */
    direction?: 'out' | 'in'
    /** Secondary leg for swaps (e.g. "373.875 SANS"). */
    outLabel?: string
    /** epoch ms, 0 = unknown. */
    when: number
    statusLabel: string
    tone: ActivityTone
    /** Verified explorer deep-link pattern (F48/F58). */
    href?: string
    hrefLabel?: string
}

export interface SwapRecord {
    swapid: string
    direction: string
    amount_in?: number | null
    amount_out?: number | null
    dest_txid?: string | null
    status: string
    created_at: number
    updated_at?: number
}

export const swapListKey = (network: string): string => `evonext_swaps_${network}`

export function readSwapHistory(network: string): SwapRecord[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(swapListKey(network))
        const parsed = raw ? JSON.parse(raw) : null
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
        return Object.values(parsed as Record<string, SwapRecord>).filter(
            (s): s is SwapRecord => !!s && typeof s === 'object' && typeof s.swapid === 'string'
        )
    } catch {
        return []
    }
}

/** Map one flat withdrawal document (F48 shape) to a history row. */
export function withdrawalToRow(doc: any, network: 'mainnet' | 'testnet'): ActivityRow | null {
    if (!doc || typeof doc !== 'object') return null
    const docId: string | undefined = doc.$id ?? doc.id
    if (!docId) return null
    const rawAmount = doc.amount
    const amountNum = typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount ?? 0)
    const credits = Number.isFinite(amountNum) ? BigInt(Math.round(amountNum)) : 0n
    const status = typeof doc.status === 'string' ? Number(doc.status) : Number(doc.status ?? 0)
    const when = Number(doc.$updatedAt ?? doc.$createdAt ?? 0)
    const tone: ActivityTone = status === 3 ? 'ok' : status === 2 ? 'pending' : 'neutral'
    return {
        key: `withdrawal-${docId}`,
        kind: 'withdrawal',
        amountLabel: dashOfMax(Number(credits) / CREDITS_PER_DASH),
        assetLabel: 'DASH',
        directionLabel: 'withdrawn to Core',
        when,
        statusLabel: status === 3 ? 'Paid' : status === 2 ? 'Awaiting payout' : `Status ${status}`,
        tone,
        href: `https://${network === 'mainnet' ? 'www' : 'testnet'}.platform-explorer.com/document/${docId}`,
        hrefLabel: 'view on explorer',
    }
}

/** Map one DashSwap record (the swap.tsx shape) to a history row. */
export function swapToRow(
    swap: SwapRecord,
    outDecimals: number,
    outAsset: string
): ActivityRow | null {
    if (!swap || typeof swap.swapid !== 'string' || typeof swap.direction !== 'string') return null
    const to = swap.direction.includes('SANS') ? 'SANS' : swap.direction.includes('DUSD') ? 'DUSD' : outAsset
    const amountIn = typeof swap.amount_in === 'number' && Number.isFinite(swap.amount_in)
        ? swap.amount_in
        : Number(swap.amount_in ?? 0)
    const amountOut = typeof swap.amount_out === 'number' && Number.isFinite(swap.amount_out)
        ? swap.amount_out
        : Number(swap.amount_out ?? 0)
    const when = Number(swap.updated_at ?? swap.created_at ?? 0)
    const settled = swapIsSettled(swap.status)
    return {
        key: `swap-${swap.swapid}`,
        kind: 'swap',
        amountLabel: dashOfMax(amountIn / DUFFS_PER_DASH, 8),
        assetLabel: 'DASH',
        directionLabel: `swapped to ${to}`,
        outLabel: amountOut > 0
            ? `${dashOfMax(amountOut / Math.pow(10, outDecimals), 8)} ${to}`
            : undefined,
        when,
        statusLabel: swapStatusLabel(swap.status),
        tone: settled ? 'ok' : swapStatusFailed(swap.status) ? 'warn' : 'pending',
        /* dest_txid is the ENGINE's internal 40-hex hash, NOT a chain
         * artifact (the DAPI review) — never link it as one. The settled
         * state is conveyed by the tone icon. */
        href: undefined,
    }
}

/* F57c — the indexer-backed identity activity (the DAPI team's
 * get_identity_activity, contract per the MOBILE team's
 * docs/HANDOFF-platform-indexer.md §10 — the SAME mapping mobile's
 * helpers/platformActivity.ts uses). Only the VALUE-MOVING transitions
 * belong in a wallet history: document/identity-maintenance activity
 * (batch, identityUpdate, …) is social/profile activity, not money. */
export const PLATFORM_ACTIVITY_TYPES = [
    'creditTransfer',
    'identityTopUp',
    'identityCreditWithdrawal',
]

/** Row shape of the proxy's get_identity_activity result (camelCase). */
export interface PlatformActivityRow {
    id: number
    txid: string | null
    transitionId: string
    identityId: string
    height: number
    blocktime: number // unix SECONDS
    type: string
    contractId: string | null
    documentType: string | null
    documentId: string | null
    amount: number | null // credits
    role: string | null
    network: string
}

/** A real state-transition id = 32 bytes as 64 hex chars (the mobile rule:
 * rows without one can neither be verified nor deep-linked). */
const TXID_RE = /^[0-9a-fA-F]{64}$/

/** Map one activity row onto a history row — null when it must not render.
 *
 * - creditTransfer sender/receiver -> sent/received credits (the type-7
 *   identity-to-identity transfers are invisible to EVERY document query —
 *   this indexer row is the only honest source for them).
 * - identityTopUp -> topped up from Core.
 * - identityCreditWithdrawal -> NULL on purpose: the system-contract doc
 *   query (F48) already covers the same transitions WITH the payout status
 *   (Awaiting payout vs Paid) and the document deep-link — rendering the
 *   indexer row too would duplicate every withdrawal.
 * - anything else (batch, identityUpdate, …) -> null (not wallet history). */
export function activityToRow(row: PlatformActivityRow, network: 'mainnet' | 'testnet'): ActivityRow | null {
    if (!row || typeof row !== 'object' || typeof row.type !== 'string') return null
    if (row.type === 'identityCreditWithdrawal') return null
    if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= 0) return null
    if (typeof row.txid !== 'string' || !TXID_RE.test(row.txid)) return null

    let directionLabel: string
    let direction: 'out' | 'in'
    if (row.type === 'creditTransfer') {
        if (row.role === 'sender') { directionLabel = 'sent credits'; direction = 'out' }
        else if (row.role === 'receiver') { directionLabel = 'received credits'; direction = 'in' }
        else return null
    } else if (row.type === 'identityTopUp') {
        directionLabel = 'topped up from Core'; direction = 'in'
    } else {
        return null
    }

    const credits = BigInt(Math.round(row.amount))
    const when = Number(row.blocktime) > 0 ? Number(row.blocktime) * 1000 : 0
    return {
        key: `activity-${row.id}`,
        kind: 'transfer',
        /* 8 decimals — the 4-decimal row format would render a 1M-credit
         * (0.00001 DASH) transfer as '0'. */
        amountLabel: dashOfMax(Number(credits) / CREDITS_PER_DASH, 8),
        assetLabel: 'DASH',
        directionLabel,
        direction,
        when,
        statusLabel: 'On-chain',
        tone: 'ok',
        href: `https://${network === 'mainnet' ? 'www' : 'testnet'}.platform-explorer.com/transaction/${row.txid.toLowerCase()}`,
        hrefLabel: 'view on explorer',
    }
}

/** The narrow activity surface the component wires to the proxy. */
export interface ActivityQueryPort {
    fetchActivities: () => Promise<PlatformActivityRow[]>;
}

/* F57c.1 — TOKEN TRANSFERS via the token-history SYSTEM contract (the DAPI
 * team's Phase A answer to the activity-gaps handoff, live-verified through
 * the proxy: both F58 settlements return with full amounts/counterparties).
 * ONE contract for all tokens; documents are keyed by tokenId. */
export const TOKEN_HISTORY_CONTRACT_ID = '43gujrzZgXqcKBiScLa4T8XTDnRhenR9BLx8GWVHjPxF'

/** The token ids the wallet knows, with the display facts pinned. Testnet:
 * tDUSD (6 dp) + tSANS (8 dp); mainnet: DUSD (6 dp) — there is no SANS
 * token on mainnet (F53). */
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
    '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz': { symbol: 'DUSD', decimals: 6 },
    'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw': { symbol: 'SANS', decimals: 8 },
    'DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd': { symbol: 'DUSD', decimals: 6 },
}

/** The transfer document shape (v1 schema; $createdAt is MILLISECONDS —
 * unlike the activity feed's blocktime, which is seconds). */
export interface TokenTransferDoc {
    $id: string
    $ownerId: string // the SENDER
    toIdentityId: string
    tokenId: string
    amount: number | string // base units
    $createdAt: number
}

/** Whole-number base units -> trimmed decimal string (no rounding drift). */
export function formatTokenAmount(amount: number | string, decimals: number): string {
    const units = BigInt(Math.round(Number(amount)))
    const s = units.toString().padStart(decimals + 1, '0')
    const whole = s.slice(0, s.length - decimals) || '0'
    const frac = decimals > 0 ? s.slice(s.length - decimals).replace(/0+$/, '') : ''
    return frac ? `${whole}.${frac}` : whole
}

/** Map one token-history transfer doc onto a history row — null when it
 * must not render: unknown token, bad amount, and self-transfers (sender
 * == receiver — the direction is ambiguous; the wallet never makes them). */
export function tokenToRow(doc: TokenTransferDoc, identityId: string, network: 'mainnet' | 'testnet'): ActivityRow | null {
    if (!doc || typeof doc !== 'object') return null
    if (typeof doc.$id !== 'string' || typeof doc.$ownerId !== 'string'
        || typeof doc.toIdentityId !== 'string' || typeof doc.tokenId !== 'string') return null
    const token = KNOWN_TOKENS[doc.tokenId]
    if (!token) return null
    const amount = Number(doc.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null
    const isSender = doc.$ownerId === identityId
    const isReceiver = doc.toIdentityId === identityId
    if (isSender === isReceiver) return null
    const direction: 'out' | 'in' = isSender ? 'out' : 'in'
    return {
        key: `token-${doc.$id}`,
        kind: 'transfer',
        amountLabel: formatTokenAmount(amount, token.decimals),
        assetLabel: token.symbol,
        directionLabel: direction === 'out' ? `sent ${token.symbol}` : `received ${token.symbol}`,
        direction,
        when: Number(doc.$createdAt) > 0 ? Number(doc.$createdAt) : 0,
        statusLabel: 'On-chain',
        tone: 'ok',
        href: `https://${network === 'mainnet' ? 'www' : 'testnet'}.platform-explorer.com/document/${doc.$id}`,
        hrefLabel: 'view on explorer',
    }
}

/** The narrow token surface the component wires to the proxy: one call per
 * (tokenId, direction-field) pair — the from/to indices are
 * (tokenId,$ownerId,$createdAt) and (tokenId,toIdentityId,$createdAt), so
 * every query leads with tokenId. */
export interface TokenQueryPort {
    fetchTokenDocs: (tokenId: string, field: '$ownerId' | 'toIdentityId') => Promise<unknown[]>;
}

/** Query BOTH token directions (outgoing = $ownerId, incoming =
 * toIdentityId) for every known token id and map to rows. allSettled: a
 * single failed leg still renders the others, with the honest error line
 * for the partial failure. Same deadline race as the other queries. */
export async function queryTokenRows(
    port: TokenQueryPort,
    identityId: string,
    network: 'mainnet' | 'testnet',
    deadlineMs: number = WITHDRAWAL_QUERY_DEADLINE_MS,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
    const ids = Object.keys(KNOWN_TOKENS)
    const fields: ('$ownerId' | 'toIdentityId')[] = ['$ownerId', 'toIdentityId']
    try {
        const deadline = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('query timed out')), deadlineMs))
        const results = await Promise.race([
            Promise.allSettled(ids.flatMap((tokenId) => fields.map(async (field) => {
                const docs = await port.fetchTokenDocs(tokenId, field)
                if (!Array.isArray(docs)) throw new Error('token result shape unexpected')
                return docs.map((d) => tokenToRow(d as TokenTransferDoc, identityId, network))
                    .filter((r): r is ActivityRow => r !== null)
            }))),
            deadline,
        ]) as PromiseSettledResult<ActivityRow[]>[]
        const rows: ActivityRow[] = []
        let failed = 0
        for (const r of results) {
            if (r.status === 'fulfilled') rows.push(...r.value)
            else failed++
        }
        return { rows, error: failed > 0 ? 'token history partially unavailable' : null }
    } catch (e: any) {
        return {
            rows: [],
            error: (e && typeof e.message === 'string' && e.message) || 'token history unavailable',
        }
    }
}

/** Query the indexer-backed identity activity (the DAPI team's
 * get_identity_activity — proxy-only, there is NO wasm equivalent) and map
 * the value-movers to rows. The same deadline race as the withdrawal query:
 * a hung fetch degrades to the honest error line, never a fake empty. */
export async function queryActivityRows(
    port: ActivityQueryPort,
    network: 'mainnet' | 'testnet',
    deadlineMs: number = WITHDRAWAL_QUERY_DEADLINE_MS,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
    try {
        const rowsPromise = port.fetchActivities()
        const deadline = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('query timed out')), deadlineMs))
        const activities = await Promise.race([rowsPromise, deadline]) as PlatformActivityRow[]
        const rows = (Array.isArray(activities) ? activities : [])
            .map((row) => activityToRow(row, network))
            .filter((r): r is ActivityRow => r !== null)
        return { rows, error: null }
    } catch (e: any) {
        return {
            rows: [],
            error: (e && typeof e.message === 'string' && e.message) || 'activity history unavailable',
        }
    }
}

/** Merge + sort (newest first). The withdrawals win over the swaps when the
 * timestamps are identical (on-chain beats local cache); the key comparison
 * keeps the comparator a total order (no stable-sort ambiguity). */
const KIND_RANK: Record<ActivityKind, number> = { withdrawal: 0, transfer: 1, swap: 2 }
export function mergeActivity(a: ActivityRow[], b: ActivityRow[]): ActivityRow[] {
    return [...a, ...b].sort((x, y) =>
        (y.when - x.when)
        || (KIND_RANK[x.kind] - KIND_RANK[y.kind])
        || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)
    )
}

/* F59 — the deadline race lives HERE so it is testable without the DOM:
 * the wasm transport can leave a query pending forever (F30 gotcha — the
 * response arrives, the future never resolves) — the withdrawal query is
 * raced against a deadline and the caller degrades to an honest error
 * line, never a fake empty state. */
export const WITHDRAWAL_QUERY_DEADLINE_MS = 30_000

/** The narrow query surface the component wires to compat.get_documents. */
export interface WithdrawalQueryPort {
    getDocuments: (
        contractId: string,
        type: string,
        where: unknown[],
        orderBy: unknown[],
        limit: number,
    ) => Promise<any[]>;
}

/** Query the system contract's withdrawal docs by the WITHDRAWING identity
 * ($ownerId — the F48 correction) over identityRecent($ownerId,$updatedAt,
 * status) and map them to history rows. A deadline timeout or any query
 * failure returns the real message (or the honest generic) as `error` with
 * rows [] — the caller renders it verbatim. */
export async function queryWithdrawalRows(
    port: WithdrawalQueryPort,
    identityId: string,
    network: 'mainnet' | 'testnet',
    deadlineMs: number = WITHDRAWAL_QUERY_DEADLINE_MS,
): Promise<{ rows: ActivityRow[]; error: string | null }> {
    try {
        const docsPromise = port.getDocuments(
            SYSTEM_WITHDRAWAL_CONTRACT_ID,
            'withdrawal',
            [['$ownerId', '==', identityId]],
            [['$ownerId', 'asc'], ['$updatedAt', 'desc']],
            25,
        )
        const deadline = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('query timed out')), deadlineMs))
        const docs = await Promise.race([docsPromise, deadline]) as any[]
        const rows = (Array.isArray(docs) ? docs : [])
            .map((doc) => withdrawalToRow(doc, network))
            .filter((r): r is ActivityRow => r !== null)
        return { rows, error: null }
    } catch (e: any) {
        return {
            rows: [],
            error: (e && typeof e.message === 'string' && e.message) || 'withdrawal history unavailable',
        }
    }
}
