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
    ArrowUpCircleIcon, ArrowPathIcon, ClockIcon, CheckCircleIcon,
    ExclamationTriangleIcon, InboxIcon,
} from '@heroicons/react/24/outline'
import {
    ActivityRow, ActivityTone, ActivityKind, SYSTEM_WITHDRAWAL_CONTRACT_ID,
    readSwapHistory, withdrawalToRow, swapToRow, mergeActivity,
} from '@/lib/wallet-history'
import { EVONEXT_CONTRACT_ID_TESTNET, EVONEXT_CONTRACT_ID_MAINNET } from '@/lib/constants'

const QUERY_DEADLINE_MS = 30_000
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

const KIND_ICON = (kind: ActivityKind) => (kind === 'withdrawal' ? ArrowUpCircleIcon : ArrowPathIcon)

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
    const [rows, setRows] = useState<ActivityRow[] | null>(null)
    const [withErr, setWithErr] = useState<string | null>(null)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])

    useEffect(() => {
        let cancelled = false
        const identityId = user?.identityId
        if (!identityId) return

        /* Swaps are a synchronous local read — never block on them. The
         * out-leg decimals are per-direction: SANS 8, DUSD 6 (F58). */
        const net = network === 'mainnet' ? 'mainnet' : 'testnet'
        const swapRows = readSwapHistory(net)
            .map((s) => swapToRow(
                s,
                s.direction.includes('DUSD') ? 6 : 8,
                s.direction.includes('DUSD') ? 'DUSD' : 'SANS'
            ))
            .filter((r): r is ActivityRow => r !== null)

        const run = async () => {
            let withdrawalRows: ActivityRow[] = []
            let error: string | null = null
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
                const docsPromise = compat.get_documents(
                    sdk,
                    SYSTEM_WITHDRAWAL_CONTRACT_ID,
                    'withdrawal',
                    [['$ownerId', '==', identityId]],
                    [['$ownerId', 'asc'], ['$updatedAt', 'desc']],
                    25,
                )
                const deadline = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('query timed out')), QUERY_DEADLINE_MS))
                const docs = await Promise.race([docsPromise, deadline]) as any[]
                withdrawalRows = (Array.isArray(docs) ? docs : [])
                    .map((doc) => withdrawalToRow(doc, net))
                    .filter((r): r is ActivityRow => r !== null)
            } catch (e: any) {
                error = (e && typeof e.message === 'string' && e.message) || 'withdrawal history unavailable'
            }
            if (!cancelled && mounted.current) {
                setRows(mergeActivity(withdrawalRows, swapRows).slice(0, MAX_ROWS))
                setWithErr(error)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [user?.identityId, network])

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
                        Withdrawals to Core and DASH swaps will appear here
                    </p>
                </div>
            )
        }
        return (
            <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {rows.map((row) => {
                    const Icon = KIND_ICON(row.kind)
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

            {content}
        </main>
    )
}
