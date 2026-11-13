'use client'

// components/wallet/swap.tsx
//
// The SWAP tab — Uniswap-style swap interface for the DashSwap exchange
// (https://dashswap.xyz, API at /v1 — proxied same-origin through
// /api/dashswap so the browser never holds the API key).
//
// BOOTSTRAP PHASE (sansbank.org/bootstrap): swaps run ONE DIRECTION ONLY
// — DASH -> SANS and DASH -> DUSD (capital raise; two-way opens later).
// The flip button is therefore disabled with a note, and the pair
// selector only offers the two allowed destinations.
//
// Flow (mirrors ../dashswap-api src/endpoints/swap/Create.ts):
//   1. Pick the destination token (SANS | DUSD) — DASH is always the pay
//      side during bootstrap.
//   2. Enter the DASH amount (duffs: 1 DASH = 1e8 duffs).
//   3. Create the swap -> the API allocates a DEX deposit address and
//      quotes an indicative rate (final rate fixes at settlement).
//   4. Fund the deposit address (from this wallet's Deposit tab or any
//      Dash wallet) — QR shown.
//   5. Poll the swap status until it settles; amount_out is shown when
//      known. Swap ids persist locally so the list survives reloads.

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
// @ts-ignore
import numeral from 'numeral'
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react'
import { ArrowsUpDownIcon, ArrowPathIcon, CheckCircleIcon, ClockIcon, ClipboardIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { showErrorToast } from '@/lib/toast-error'
import toast from 'react-hot-toast'
import * as coreChain from '../../lib/core-chain'
import { getIdentityIdx } from '@/lib/secure-storage'

type Network = 'mainnet' | 'testnet'

/** The two bootstrap-phase swap destinations. */
type SwapDestination = 'SANS' | 'DUSD'
type SwapDirection = 'DASH->SANS' | 'DASH->DUSD'

const DUFFS_PER_DASH = 1e8

interface DashswapSwap {
    swapid: string
    direction: string
    platformid: string
    deposit_address: string
    bip44_index?: number
    amount_in?: number | null
    amount_out?: number | null
    rate?: number | null
    expected_out?: number | null
    status: string
    created_at: number
    updated_at?: number
}

/** Terminal/known status vocabulary (per the API's swap lifecycle). */
const isSettled = (status: string) => /settled|complete|completed|done/i.test(status)
const isFailed = (status: string) => /fail|reject|cancel|expire|refund/i.test(status)

/** localStorage swap-id list per network. */
const swapListKey = (network: Network) => `evonext_swaps_${network}`
const loadSwapIds = (network: Network): string[] => {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(swapListKey(network))
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}
const rememberSwapId = (network: Network, swapid: string) => {
    if (typeof window === 'undefined') return
    try {
        const ids = loadSwapIds(network)
        if (!ids.includes(swapid)) {
            const next = [swapid, ...ids].slice(0, 25)
            window.localStorage.setItem(swapListKey(network), JSON.stringify(next))
        }
    } catch { /* private mode */ }
}

/** The token metadata for the destination chips. */
const TOKEN_META: Record<SwapDestination, { name: string; symbol: string; icon: string; tile: string }> = {
    SANS: {
        name: 'Sansnote',
        symbol: 'SANS',
        icon: '/icons/sans.svg',
        tile: 'from-cyan-400 to-cyan-200 border-cyan-500 text-cyan-900',
    },
    DUSD: {
        name: 'USD',
        symbol: 'DUSD',
        icon: '/icons/usd.svg',
        tile: 'from-lime-400 to-lime-200 border-lime-500 text-lime-900',
    },
}

interface WalletSwapProps {
    isFullScreen: boolean;
}

export function WalletSwap({ isFullScreen }: WalletSwapProps) {
    const { user } = useAuth()
    const { network } = useNetwork()
    const sdkNetwork: Network = network === 'mainnet' ? 'mainnet' : 'testnet'

    /* The swap pair (bootstrap: DASH is always the pay side). */
    const [destination, setDestination] = useState<SwapDestination>('DUSD')
    const [amount, setAmount] = useState('')
    const [payable, setPayable] = useState<number | null>(null) /* duffs spendable at the funding wallet */

    /* The created swap being funded/tracked. */
    const [activeSwap, setActiveSwap] = useState<DashswapSwap | null>(null)
    const [creating, setCreating] = useState(false)
    /* Statuses of the locally remembered swaps. */
    const [history, setHistory] = useState<Record<string, DashswapSwap>>({})

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    /** The funding wallet's spendable balance — the pool this swap pays
     *  from (an operational context line for the swap form only; per the
     *  owner directive there is NO Core-balance row in the asset list). */
    const refreshPayable = useCallback(async () => {
        if (typeof user === 'undefined' || user === null) return
        try {
            const identityIdx = Number(localStorage.getItem('identity_idx') || 0)
            const funding = coreChain.deriveFundingKey(sdkNetwork, identityIdx)
            const utxos: any[] = await coreChain.getFundingUtxos(sdkNetwork, funding.address)
            setPayable(utxos.reduce((sum: number, u: any) => sum + u.satoshis, 0))
        } catch {
            setPayable(null)
        }
    }, [sdkNetwork, user])

    /** Fetch one swap's status through the same-origin proxy. */
    const fetchSwap = useCallback(async (swapid: string): Promise<DashswapSwap | null> => {
        try {
            const res = await fetch(`/api/dashswap/swap/${encodeURIComponent(swapid)}`)
            if (!res.ok) return null
            const body = await res.json()
            return body?.swap ?? null
        } catch {
            return null
        }
    }, [])

    const refreshHistory = useCallback(async () => {
        const ids = loadSwapIds(sdkNetwork)
        if (ids.length === 0) {
            setHistory({})
            return
        }
        const entries = await Promise.all(ids.map(async (id) => [id, await fetchSwap(id)] as const))
        const next: Record<string, DashswapSwap> = {}
        for (const [id, swap] of entries) {
            if (swap) next[id] = swap
        }
        setHistory(next)
    }, [sdkNetwork, fetchSwap])

    useEffect(() => {
        void refreshPayable()
        void refreshHistory()
    }, [refreshPayable, refreshHistory])

    /* Poll the ACTIVE swap until it settles (10s cadence, bounded by the
     * component lifetime). */
    useEffect(() => {
        if (!activeSwap) return
        const tick = async () => {
            const swap = await fetchSwap(activeSwap.swapid)
            if (!swap) return
            setActiveSwap(swap)
            setHistory((prev) => ({ ...prev, [swap.swapid]: swap }))
            if (isSettled(swap.status) || isFailed(swap.status)) {
                if (pollRef.current) {
                    clearInterval(pollRef.current)
                    pollRef.current = null
                }
            }
        }
        pollRef.current = setInterval(tick, 10000)
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSwap?.swapid, fetchSwap])

    const amountDuffs = (): number | null => {
        const trimmed = amount.trim()
        if (!/^\d+(\.\d{0,8})?$/.test(trimmed)) return null
        const value = Number(trimmed)
        if (!(value > 0)) return null
        return Math.round(value * DUFFS_PER_DASH)
    }

    const handleSwap = async () => {
        const amountIn = amountDuffs()
        if (amountIn === null) {
            return showErrorToast('Please enter a valid DASH amount to swap.')
        }
        if (typeof user === 'undefined' || user === null || !user.identityId) {
            return showErrorToast('Your session is still loading — try again in a moment.')
        }
        if (payable !== null && amountIn > payable) {
            return showErrorToast(`The amount exceeds the funds available to swap (${numeral((payable ?? 0) / DUFFS_PER_DASH).format('0,0.00[000000]')} DASH).`)
        }

        setCreating(true)
        try {
            const direction: SwapDirection = destination === 'SANS' ? 'DASH->SANS' : 'DASH->DUSD'
            const res = await fetch('/api/dashswap/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    direction,
                    platformid: user.identityId,
                    /* Bootstrap v1: the swap credits land on THIS identity. */
                    dest_platformid: user.identityId,
                    amount_in: amountIn,
                }),
            })
            const body = await res.json()
            if (!res.ok || !body?.swap) {
                return showErrorToast(body?.error || `The swap request failed (HTTP ${res.status}).`)
            }
            const swap: DashswapSwap = body.swap
            setActiveSwap(swap)
            rememberSwapId(sdkNetwork, swap.swapid)
            setHistory((prev) => ({ ...prev, [swap.swapid]: swap }))
            setAmount('')
            toast.success(`Swap ${swap.swapid.slice(0, 12)}… created — send the DASH to the deposit address.`)
        } catch (error: any) {
            showErrorToast(error?.message || 'The swap request failed.')
        } finally {
            setCreating(false)
        }
    }

    const copyDeposit = async () => {
        if (!activeSwap?.deposit_address) return
        try {
            await navigator.clipboard.writeText(activeSwap.deposit_address)
            toast.success('Deposit address copied to clipboard')
        } catch {
            showErrorToast('Failed to copy the address')
        }
    }

    const swapAmountDuffs = activeSwap?.amount_in ?? null
    const swapRate = activeSwap?.rate ?? null
    const expectedOut = activeSwap?.amount_out ?? activeSwap?.expected_out ?? null

    return (
        <main className="flex flex-col gap-4">
            {/* BOOTSTRAP NOTICE */}
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs text-amber-800">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1 -mt-0.5" />
                    Bootstrap phase: swaps run <span className="font-semibold">one way only</span> —
                    you pay DASH and receive SANS or DUSD. Two-way swaps open after
                    the revenue phase.
                </p>
            </section>

            {/* PAIR SELECTOR (the two allowed bootstrap destinations) */}
            <section className="grid grid-cols-2 gap-3">
                {(Object.keys(TOKEN_META) as SwapDestination[]).map((key) => {
                    const meta = TOKEN_META[key]
                    const selected = destination === key
                    return (
                        <button
                            key={key}
                            onClick={() => { setDestination(key); if (activeSwap && !isSettled(activeSwap.status) && !isFailed(activeSwap.status)) return; setActiveSwap(null) }}
                            className={`flex flex-row items-center gap-2 px-3 py-3 border rounded-2xl shadow-sm transition-all cursor-pointer bg-gradient-to-br ${meta.tile} ${selected ? 'ring-2 ring-sky-400 border-sky-400' : 'opacity-70 hover:opacity-100'}`}
                        >
                            <span className="relative h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-white border border-white/60 shadow-sm">
                                <Image src={meta.icon} className="h-6 w-6" alt={meta.name} width={0} height={0} />
                            </span>
                            <span className="flex flex-col items-start min-w-0">
                                <span className="text-sm font-semibold whitespace-nowrap">{meta.name}</span>
                                <span className="text-2xs opacity-80">{key === 'SANS' ? 'DASH → SANS' : 'DASH → DUSD'}</span>
                            </span>
                        </button>
                    )
                })}
            </section>

            {/* SWAP CARD (Uniswap-style two-panel) */}
            <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 shadow-sm p-4 relative">
                {/* FROM */}
                <div className="rounded-xl bg-white border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs text-gray-500 font-medium">You pay</span>
                        <span className="text-2xs text-gray-400">
                            {payable !== null
                                ? <>Balance: {numeral(payable / DUFFS_PER_DASH).format('0,0.00[000000]')} DASH available to swap</>
                                : '—'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            autoComplete="off"
                            className="flex-1 min-w-0 bg-transparent text-2xl font-medium text-gray-800 focus:outline-none"
                        />
                        <span className="flex items-center gap-1.5 rounded-xl bg-sky-100 border border-sky-200 px-3 py-2">
                            <Image src="/icons/dash.svg" className="h-5 w-5" alt="DASH" width={0} height={0} />
                            <span className="text-sm font-semibold text-sky-900">DASH</span>
                        </span>
                    </div>
                </div>

                {/* FLIP (disabled during bootstrap — one-way swaps) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <span
                        title="Bootstrap phase — one-way swaps (DASH → SANS / DASH → DUSD)"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-300 shadow-sm cursor-not-allowed"
                    >
                        <ArrowsUpDownIcon className="h-4 w-4 rotate-90" />
                    </span>
                </div>

                {/* TO */}
                <div className="rounded-xl bg-white border border-gray-200 p-3 mt-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs text-gray-500 font-medium">You receive (estimated)</span>
                        <span className="text-2xs text-gray-400">final rate fixes at settlement</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-2xl font-medium text-gray-400 truncate">
                            {swapRate !== null && amountDuffs() !== null
                                ? numeral((amountDuffs() as number) / DUFFS_PER_DASH * swapRate).format('0,0.00[000000]')
                                : '0.0'}
                        </span>
                        <span className="flex items-center gap-1.5 rounded-xl bg-gray-100 border border-gray-200 px-3 py-2">
                            <Image src={TOKEN_META[destination].icon} className="h-5 w-5" alt={destination} width={0} height={0} />
                            <span className="text-sm font-semibold text-gray-700">{TOKEN_META[destination].symbol}</span>
                        </span>
                    </div>
                </div>
            </section>

            {/* SWAP BUTTON */}
            <button
                onClick={handleSwap}
                disabled={creating || !amountDuffs()}
                className="w-full rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-base font-semibold py-3 shadow transition-colors"
            >
                {creating ? 'Creating swap…' : `Swap DASH for ${TOKEN_META[destination].symbol}`}
            </button>

            {/* ACTIVE SWAP: deposit + tracker */}
            {activeSwap && (
                <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-sky-900 uppercase tracking-wide">Fund your swap</span>
                        <span className="text-2xs font-mono text-gray-400">{activeSwap.swapid.slice(0, 18)}…</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm shrink-0">
                            <QRCodeSVG value={activeSwap.deposit_address} size={128} />
                        </div>
                        <div className="flex-1 w-full space-y-2">
                            <p className="text-xs text-gray-500">
                                Send <span className="font-semibold">
                                    {swapAmountDuffs !== null ? `${numeral(swapAmountDuffs / DUFFS_PER_DASH).format('0,0.00[000000]')} DASH` : 'the agreed DASH amount'}
                                </span>{' '}
                                to the deposit address below (from your Deposit tab or any Dash
                                wallet). The DEX settles {TOKEN_META[destination].symbol} to your
                                identity when the deposit confirms.
                            </p>
                            <button
                                onClick={copyDeposit}
                                title="Click to copy"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-700 break-all text-left hover:border-sky-300 transition-colors"
                            >
                                {activeSwap.deposit_address}
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={copyDeposit}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-sky-300 transition-colors flex items-center gap-1"
                                >
                                    <ClipboardIcon className="h-3.5 w-3.5" /> Copy
                                </button>
                                {(swapRate !== null) && (
                                    <span className="text-2xs text-gray-400">
                                        Rate: 1 DASH ≈ {numeral(swapRate).format('0,0.00[000000]')} {TOKEN_META[destination].symbol}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        {isSettled(activeSwap.status)
                            ? <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                            : isFailed(activeSwap.status)
                                ? <ExclamationTriangleIcon className="w-4 h-4 text-rose-600" />
                                : <ClockIcon className="w-4 h-4 text-sky-600 animate-pulse" />}
                        <span className="text-xs text-gray-600">
                            {isSettled(activeSwap.status)
                                ? <>Settled{expectedOut !== null ? ` — you received ${numeral(expectedOut / 1e8).format('0,0.00[000000]')} ${TOKEN_META[destination].symbol}` : ''}</>
                                : isFailed(activeSwap.status)
                                    ? `Swap ${activeSwap.status} — contact support with id ${activeSwap.swapid.slice(0, 18)}…`
                                    : `Status: ${activeSwap.status} — waiting for your deposit (checking every 10s)`}
                        </span>
                    </div>
                </section>
            )}

            {/* LOCAL SWAP HISTORY */}
            {Object.keys(history).length > 0 && (
                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
                        <ArrowPathIcon className="w-4 h-4 text-sky-600" />
                        <span className="text-sm font-semibold">Your swaps</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {Object.values(history)
                            .sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
                            .map((swap) => {
                                const to = swap.direction.includes('SANS') ? 'SANS' : 'DUSD'
                                return (
                                    <div key={swap.swapid} className="px-4 py-3 flex items-center gap-3">
                                        <span className={`shrink-0 rounded-full border p-1.5 ${isSettled(swap.status) ? 'text-emerald-600 border-emerald-300' : isFailed(swap.status) ? 'text-rose-600 border-rose-300' : 'text-sky-600 border-sky-300'}`}>
                                            {isSettled(swap.status)
                                                ? <CheckCircleIcon className="w-3.5 h-3.5" />
                                                : isFailed(swap.status)
                                                    ? <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                                    : <ClockIcon className="w-3.5 h-3.5" />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold">
                                                DASH → {to}
                                                <span className="ml-2 text-2xs font-mono text-gray-400">{swap.swapid.slice(0, 14)}…</span>
                                            </p>
                                            <p className="text-2xs text-gray-500">
                                                {swap.amount_in != null ? `${numeral(swap.amount_in / DUFFS_PER_DASH).format('0,0.00[000000]')} DASH in` : 'open amount'}
                                                {swap.amount_out != null && ` → ${numeral(swap.amount_out / 1e8).format('0,0.00[000000]')} ${to}`}
                                            </p>
                                        </div>
                                        <span className={`text-2xs uppercase shrink-0 ${isSettled(swap.status) ? 'text-emerald-600' : isFailed(swap.status) ? 'text-rose-600' : 'text-sky-600'}`}>
                                            {swap.status}
                                        </span>
                                    </div>
                                )
                            })}
                    </div>
                </section>
            )}

            <p className="text-2xs text-gray-400 px-1">
                Rates are indicative (quoted from the DashSwap tickers) and fix at
                settlement. Powered by DashSwap — dashswap.xyz.
            </p>
        </main>
    )
}
