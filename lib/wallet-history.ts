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

export type ActivityKind = 'withdrawal' | 'swap'
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

/** Merge + sort (newest first). The withdrawals win over the swaps when the
 * timestamps are identical (on-chain beats local cache); the key comparison
 * keeps the comparator a total order (no stable-sort ambiguity). */
const KIND_RANK: Record<ActivityKind, number> = { withdrawal: 0, swap: 1 }
export function mergeActivity(a: ActivityRow[], b: ActivityRow[]): ActivityRow[] {
    return [...a, ...b].sort((x, y) =>
        (y.when - x.when)
        || (KIND_RANK[x.kind] - KIND_RANK[y.kind])
        || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)
    )
}
