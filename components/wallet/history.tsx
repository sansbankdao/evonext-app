'use client'

/**
 * components/wallet/history.tsx — F59: the REAL History tab.
 *
 * The previous version of this file was unfinished scaffolding: a
 * hardcoded DEFAULT_TX, stub renderers that returned empty strings, a
 * type bug calling displayOutputs(tx.vin), and a Link to
 * explorer.dash.org/tx/ with an EMPTY txid (the F53d-class bogus-link
 * defect). It never fetched anything.
 *
 * Rebuilt on the real, honest sources (lib/wallet-history.ts):
 *   - Withdrawals to Core: the system contract's withdrawal documents by
 *     $ownerId (the F48-verified query shape), via the wasm SDK.
 *   - Swaps: the wallet's own DashSwap records (localStorage, F47/F58).
 * Per-source failure = an honest error line, never a fake empty state.
 * The wasm request can leave a query pending forever (F30 gotcha) — the
 * query is raced against a 30s deadline and the tab degrades to
 * withdrawals-only with the honest note.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
// @ts-ignore
import numeral from 'numeral'
import {
    ArrowUpCircleIcon, ArrowDownCircleIcon, ArrowPathIcon, ClockIcon, CheckCircleIcon,
    ExclamationTriangleIcon, InboxIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import {
    ActivityRow, ActivityTone, ActivityKind, PLATFORM_ACTIVITY_TYPES,
    readSwapHistory, swapToRow, mergeActivity, queryWithdrawalRows, queryActivityRows,
    queryTokenRows, shieldedToRow, TOKEN_HISTORY_CONTRACT_ID,
} from '@/lib/wallet-history'
import { EVONEXT_CONTRACT_ID_TESTNET, EVONEXT_CONTRACT_ID_MAINNET } from '@/lib/constants'
import { getMnemonic } from '@/lib/secure-storage'
import { shieldedEngine } from '@/lib/shielded/engine-client'

const MAX_ROWS = 50

interface WalletHistoryProps {
    isFullScreen: boolean
}

const TONE_STYLES: Record<ActivityTone, string> = {
    ok: 'text-emerald-600',
    pending: 'text-sky-600',
    warn: 'text-amber-600',
    neutral: 'text-gray-500',
}

/* Withdrawals point up (leaving the identity); transfers read their own
 * direction; swaps are circular; shielded rows carry the shield mark (the
 * private pool — F61's fifth source). */
const KIND_ICON = (kind: ActivityKind, direction?: 'out' | 'in') =>
    kind === 'withdrawal' ? ArrowUpCircleIcon
        : kind === 'transfer' ? (direction === 'in' ? ArrowDownCircleIcon : ArrowUpCircleIcon)
        : kind === 'shielded' ? ShieldCheckIcon
        : ArrowPathIcon

const whenLabel = (ms: number): string => {
    if (!ms) return ''
    const diff = Date.now() - ms
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(ms).toLocaleDateString()
}

export function WalletHistory({ isFullScreen }: WalletHistoryProps) {
    const { user } = useAuth()
    const { network } = useNetwork()
    const [withErr, setWithErr] = useState<string | null>(null)
    const [activityErr, setActivityErr] = useState<string | null>(null)
    const [tokenErr, setTokenErr] = useState<string | null>(null)
    const [shieldedErr, setShieldedErr] = useState<string | null>(null)
    /* F61 — EVERY remote source lives in its own state; `rows` is a
     * derived merge (the 'Load more' handler extends ONE source and the
     * merge re-derives — no stale-state re-merge tricks). The per-source
     * honest error lines are unchanged. */
    const [withRows, setWithRows] = useState<ActivityRow[]>([])
    const [tokenRows, setTokenRows] = useState<ActivityRow[]>([])
    const [shieldedRows, setShieldedRows] = useState<ActivityRow[]>([])
    const [loaded, setLoaded] = useState(false)
    /* F61 — the activity source's PAGE state: the accumulated rows + the
     * proxy's keyset cursor. Non-null cursor ⇒ the 'Load more' affordance
     * renders (the indexer caps the first page at 50 — the queue item:
     * the cursor was previously unwired, silently truncating history). */
    const [activityRows, setActivityRows] = useState<ActivityRow[]>([])
    const [activityCursor, setActivityCursor] = useState<string | null>(null)
    const [activityLoading, setActivityLoading] = useState(false)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])

    useEffect(() => {
        let cancelled = false
        const identityId = user?.identityId
        if (!identityId) return

        /* Swaps are a synchronous local read — they live in the derived
         * merge below (the out-leg decimals are per-direction: SANS 8,
         * DUSD 6, F58). */
        const net = network === 'mainnet' ? 'mainnet' : 'testnet'

        const run = async () => {
            let error: string | null = null
            let activityError: string | null = null
            try {
                const { wasmSdkService, getWasmSdk } = await import('@/lib/services/wasm-sdk-service') as any
                /* initialize() no-ops when the config matches (the shielded-page
                 * F37 pattern) — re-init only when the network flipped. */
                if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== net) {
                    await wasmSdkService.initialize({
                        network: net,
                        contractId: net === 'mainnet' ? EVONEXT_CONTRACT_ID_MAINNET : EVONEXT_CONTRACT_ID_TESTNET,
                    })
                }
                const sdk = await getWasmSdk()
                const compat = await import('@/lib/dash-wasm/compat') as any
                /* The deadline race lives in lib/wallet-history.ts now (it is
                 * testable without the DOM) — behavior identical: the F30
                 * pending-forever wasm future degrades to the honest error. */
                const result = await queryWithdrawalRows({
                    getDocuments: (contractId, type, where, orderBy, limit) =>
                        compat.get_documents(sdk, contractId, type, where, orderBy, limit),
                }, identityId, net)
                if (!cancelled && mounted.current) { setWithRows(result.rows); setLoaded(true) }
                error = result.error
            } catch (e: any) {
                error = (e && typeof e.message === 'string' && e.message) || 'withdrawal history unavailable'
                if (!cancelled && mounted.current) setLoaded(true)
            }
            /* F57c — the indexer-backed credit history (the DAPI team's
             * get_identity_activity, contract per the MOBILE team's
             * HANDOFF-platform-indexer.md; the SAME value-mover mapping).
             * Independent source, own honest error — never a fake empty.
             * The proxy call is 12s-bounded by proxyCall; the lib race adds
             * the same deadline guard as the withdrawal query. F61 — the
             * fetched page lands in the activityRows/cursor STATE so the
             * 'Load more' affordance can extend it. */
            try {
                const { proxyCall } = await import('@/lib/dapi-proxy')
                const result = await queryActivityRows({
                    fetchActivities: async (cursor) => {
                        const proxyResult = await proxyCall('get_identity_activity', {
                            identityId,
                            types: PLATFORM_ACTIVITY_TYPES,
                            limit: 50,
                            ...(cursor ? { cursor } : {}),
                        }, net)
                        if (!proxyResult || !Array.isArray(proxyResult.activities)) {
                            throw new Error('activity result shape unexpected')
                        }
                        return { activities: proxyResult.activities, nextCursor: proxyResult.nextCursor }
                    },
                }, net)
                if (!cancelled && mounted.current) {
                    setActivityRows(result.rows)
                    setActivityCursor(result.nextCursor)
                }
                activityError = result.error
            } catch (e: any) {
                activityError = (e && typeof e.message === 'string' && e.message) || 'activity history unavailable'
            }
            /* F57c.1 — token transfers via the token-history system contract
             * (the DAPI team's Phase A: one contract, transfer docs keyed by
             * tokenId; $createdAt in MILLISECONDS; outgoing = $ownerId,
             * incoming = toIdentityId). Independent source, own honest error. */
            let tokenError: string | null = null
            try {
                const { proxyCall } = await import('@/lib/dapi-proxy')
                const result = await queryTokenRows({
                    fetchTokenDocs: async (tokenId, field) => {
                        const proxyResult = await proxyCall('get_documents', {
                            dataContractId: TOKEN_HISTORY_CONTRACT_ID,
                            documentType: 'transfer',
                            whereClause: [['tokenId', '==', tokenId], [field, '==', identityId]],
                            orderBy: [['$createdAt', 'desc']],
                            limit: 25,
                        }, net)
                        return Array.isArray(proxyResult) ? proxyResult : []
                    },
                }, identityId, net)
                if (!cancelled && mounted.current) setTokenRows(result.rows)
                tokenError = result.error
            } catch (e: any) {
                tokenError = (e && typeof e.message === 'string' && e.message) || 'token history unavailable'
            }
            /* F61 — the FIFTH source: the engine's shielded history (the
             * local note scan — sent/received/self). Needs the material +
             * the engine; a WIF-only session has NO shielded history by
             * definition (the ZIP-32 tree is seed-derived) — skip quietly,
             * never an error line. The start() is idempotent per
             * (network, mnemonic) and single-flights with the dashboard's
             * own start. */
            let shieldedError: string | null = null
            try {
                const mnemonic = getMnemonic()
                if (mnemonic) {
                    await shieldedEngine.start({ network: net, mnemonic })
                    const entries = await shieldedEngine.history()
                    const mapped = (Array.isArray(entries) ? entries : [])
                        .map((e) => shieldedToRow(e as any))
                        .filter((r): r is ActivityRow => r !== null)
                    if (!cancelled && mounted.current) setShieldedRows(mapped)
                }
            } catch (e: any) {
                shieldedError = (e && typeof e.message === 'string' && e.message) || 'shielded history unavailable'
            }
            if (!cancelled && mounted.current) {
                setWithErr(error)
                setActivityErr(activityError)
                setTokenErr(tokenError)
                setShieldedErr(shieldedError)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [user?.identityId, network])

    /* The DERIVED merge (F61): every source is state; the swaps are a
     * synchronous local read. The total order + per-source semantics are
     * unchanged from the F59 design. */
    const rows = useMemo(() => {
        if (!loaded) return null
        const net = network === 'mainnet' ? 'mainnet' : 'testnet'
        const swaps = readSwapHistory(net)
            .map((s) => swapToRow(
                s,
                s.direction.includes('DUSD') ? 6 : 8,
                s.direction.includes('DUSD') ? 'DUSD' : 'SANS'
            ))
            .filter((r): r is ActivityRow => r !== null)
        return mergeActivity(mergeActivity(mergeActivity(mergeActivity(withRows, activityRows), tokenRows), shieldedRows), swaps).slice(0, MAX_ROWS)
    }, [loaded, network, withRows, activityRows, tokenRows, shieldedRows])

    /* F61 — 'Load more': fetch the NEXT activity page with the stored
     * keyset cursor and re-merge. The other sources' states persist (no
     * refetch); the merge is the same total order. */
    const loadMoreActivity = async () => {
        const identityId = user?.identityId
        if (!identityId || !activityCursor || activityLoading) return
        setActivityLoading(true)
        try {
            const { proxyCall } = await import('@/lib/dapi-proxy')
            const net = network === 'mainnet' ? 'mainnet' : 'testnet'
            const result = await queryActivityRows({
                fetchActivities: async (cursor) => {
                    const proxyResult = await proxyCall('get_identity_activity', {
                        identityId,
                        types: PLATFORM_ACTIVITY_TYPES,
                        limit: 50,
                        ...(cursor ? { cursor } : {}),
                    }, net)
                    if (!proxyResult || !Array.isArray(proxyResult.activities)) {
                        throw new Error('activity result shape unexpected')
                    }
                    return { activities: proxyResult.activities, nextCursor: proxyResult.nextCursor }
                },
            }, net, undefined, activityCursor)
            if (!mounted.current) return
            if (result.error) {
                setActivityErr(result.error)
                return
            }
            /* Accumulate (the same key order the indexer pages in — id
             * DESC — so plain concatenation preserves per-source order and
             * the derived merge re-sorts globally). */
            setActivityRows([...activityRows, ...result.rows])
            setActivityCursor(result.nextCursor)
            setActivityErr(null)
        } catch (e: any) {
            setActivityErr((e && typeof e.message === 'string' && e.message) || 'activity history unavailable')
        } finally {
            setActivityLoading(false)
        }
    }

    const content = useMemo(() => {
        if (rows === null) {
            return (
                <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            )
        }
        if (rows.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <InboxIcon className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-500">No activity yet</p>
                    <p className="text-2xs text-gray-400">
                        Withdrawals to Core, DASH swaps and shielded activity will appear here
                    </p>
                </div>
            )
        }
        return (
            <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {rows.map((row) => {
                    const Icon = KIND_ICON(row.kind, row.direction)
                    const IconSolid = row.tone === 'ok' ? CheckCircleIcon : row.tone === 'warn' ? ExclamationTriangleIcon : ClockIcon
                    return (
                        <div key={row.key} className="px-4 py-3 flex items-center gap-3">
                            <span className={`shrink-0 rounded-full border p-1.5 ${TONE_STYLES[row.tone]} ${row.tone === 'ok' ? 'border-emerald-300' : row.tone === 'warn' ? 'border-amber-300' : 'border-sky-300'}`}>
                                <Icon className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-800 truncate">
                                    {row.amountLabel} {row.assetLabel}
                                    <span className="ml-1 font-normal text-gray-500">{row.directionLabel}</span>
                                </p>
                                <p className="text-2xs text-gray-500">
                                    {row.outLabel ? `${row.outLabel} · ` : ''}{whenLabel(row.when)}
                                    {row.statusLabel && ` · ${row.statusLabel}`}
                                </p>
                            </div>
                            {row.href ? (
                                <a
                                    href={row.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 text-2xs text-sky-600 hover:text-sky-800 underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {row.hrefLabel ?? 'view'}
                                </a>
                            ) : (
                                <span className={`shrink-0 ${TONE_STYLES[row.tone]}`}>
                                    <IconSolid className="w-3.5 h-3.5" />
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }, [rows])

    return (
        <main className={`flex flex-col gap-4 text-slate-200 ${isFullScreen ? '' : 'pb-32'}`}>
            <h2 className="text-xl font-medium">
                Recent Activity
            </h2>

            {withErr && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                        Could not load withdrawal history: {withErr}. Showing local swap records only.
                    </p>
                </div>
            )}

            {activityErr && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                        Could not load credit history: {activityErr}.
                    </p>
                </div>
            )}

            {tokenErr && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                        Could not load token history: {tokenErr}.
                    </p>
                </div>
            )}

            {shieldedErr && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                        Could not load shielded history: {shieldedErr}.
                    </p>
                </div>
            )}

            {content}

            {/* F61 — the activity source's cursor pagination (the queue
                item): the indexer caps each page at 50 rows; the cursor was
                previously unwired, silently truncating the visible history. */}
            {rows !== null && rows.length > 0 && activityCursor && (
                <button
                    onClick={() => { void loadMoreActivity() }}
                    disabled={activityLoading}
                    className="self-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-sky-700 hover:border-sky-300 disabled:opacity-60 transition-colors"
                >
                    {activityLoading ? 'Loading more…' : 'Load more activity'}
                </button>
            )}
        </main>
    )
}
