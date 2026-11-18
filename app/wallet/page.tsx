'use client'

import { useEffect, useState } from 'react'
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowUpTrayIcon,
    BarsArrowDownIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'
// @ts-ignore
import numeral from 'numeral'

import { fetchPlatformAddressBalance } from '../../lib/platform-address'
import { getMnemonic, storeAsset, clearAsset } from '../../lib/secure-storage'
import { DEFAULT_ASSET } from '../../lib/constants'
import type { IToken } from '../../lib/types'
import { shieldedEngine, persistedShieldedBalance } from '../../lib/shielded/engine-client'

import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'

import { Sidebar } from '@/components/layout/sidebar'
import { WalletAssets } from '@/components/wallet/assets'
import { WalletDeposit } from '@/components/wallet/deposit'
import { WalletSwap } from '@/components/wallet/swap'
import { WalletHistory } from '@/components/wallet/history'
import { WalletSend } from '@/components/wallet/send'
import { WalletShielded } from '@/components/wallet/shielded'
import { SessionLockBanner } from '@/components/wallet/session-lock-banner'

export default function WalletPage() {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [displayBalance, setDisplayBalance] = useState(0)
    const [displayBalanceUsd, setDisplayBalanceUsd] = useState(0)
    /* The DASH/USD price for the total's USD figure. */
    const [dashPrice, setDashPrice] = useState(0)

    /* ALL THREE balances (owner directive — the dashboard shows a TOTAL:
     * identity + Platform Transparent + Platform Shielded). Transparent
     * comes from the DIP-17 address pool (bounded effect, the same
     * pattern the Assets row uses); Shielded comes from the shielded
     * engine worker (instant seed from the persisted scan, then live
     * updates as the engine scans). No Core (L1) balance — ever. */
    const [platformCredits, setPlatformCredits] = useState<bigint | null>(null)
    const [shieldedCredits, setShieldedCredits] = useState<bigint | null>(null)

    /* F57k — the UNLOCK RE-RUN: the balance effects below are keyed on
     * [network, user], and NEITHER changes when the session unlocks (the
     * session record is not the key material). After a reload the memory
     * is empty, so the reads legitimately return 0 — and then the owner
     * enters the unlock password, the material comes back… and the rows
     * NEVER re-derived (the owner's report: "TRANSPARENT and SHIELDED
     * balances DON'T ALWAYS UPDATE even AFTER i enter my UNLOCK
     * PASSWORD"). The unlock event (restorePayload / the seed upgrade)
     * bumps this tick, which is in the effects' dep arrays below. */
    const [unlockedTick, setUnlockedTick] = useState(0)
    useEffect(() => {
        const onUnlocked = () => setUnlockedTick((t) => t + 1)
        window.addEventListener('evonext:session-unlocked', onUnlocked)
        return () => window.removeEventListener('evonext:session-unlocked', onUnlocked)
    }, [])

    useEffect(() => {
        if (typeof user !== 'undefined' && user !== null) {
            let cancelled = false
            const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
                Promise.race([
                    p,
                    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
                ])
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

            /* The scan-status subscription is owned by the EFFECT body
             * (not the async IIFE): the IIFE's return value was DISCARDED,
             * which leaked one listener per run — and F57k's unlock
             * re-runs would have stacked them. Subscribing
             * unconditionally is safe: the registry is just callbacks,
             * and without an engine init nothing emits. */
            const offScan = shieldedEngine.onScanStatus(({ balance }) => {
                if (!cancelled) setShieldedCredits(BigInt(balance))
            })

            ;(async () => {
                try {
                    /* Shielded: instant seed + live engine updates. */
                    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                    const seeded = persistedShieldedBalance(sdkNetwork)
                    if (seeded !== null && !cancelled) setShieldedCredits(seeded)
                    const mnemonic = getMnemonic()
                    if (mnemonic) {
                        try {
                            await shieldedEngine.start({ network: sdkNetwork, mnemonic })
                            const snap = await shieldedEngine.snapshot()
                            if (!cancelled) setShieldedCredits(BigInt(snap.balance))
                        } catch { /* the row shows zero until a scan lands */ }
                    } else {
                        /* F57b — a WIF-only session: the Orchard keys are
                         * ZIP-32 SEED-derived and this session has no seed,
                         * so the shielded balance is 0 BY DEFINITION. Set
                         * it explicitly (overriding any stale persisted
                         * seed from another wallet's session) so the row
                         * leaves the loading skeleton — the owner's report:
                         * "even if it's ZERO, the skeleton should go
                         * away". F57k: pre-unlock this branch also runs at
                         * mount for PHRASE sessions (the memory is wiped on
                         * reload) — the zero is momentary there: the
                         * unlock event bumps unlockedTick and this effect
                         * re-runs with the restored phrase. */
                        if (!cancelled) setShieldedCredits(0n)
                    }
                } catch (err: any) {
                    console.error('dashboard shielded balance failed:', err?.message)
                }
            })()

            ;(async () => {
                try {
                    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                    /* F57 Phase 1: the platform-address read is TRUSTLESS
                     * (dapi.sansbank.dev proxy -> the pshenmic JS SDK
                     * direct to the DAPI seed hosts -> the WASM SDK last
                     * resort) — the main-thread WASM SDK is NOT constructed
                     * for this read on the happy path. */
                    for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
                        try {
                            const credits = await withTimeout(
                                fetchPlatformAddressBalance(sdkNetwork),
                                90000,
                                `dashboard platform balance (attempt ${attempt + 1})`)
                            if (!cancelled) setPlatformCredits(credits)
                            return
                        } catch (err: any) {
                            if (cancelled) return
                            console.error(`dashboard platform scan attempt ${attempt + 1} failed:`, err?.message)
                            await sleep(5000)
                        }
                    }
                } catch (err: any) {
                    console.error('dashboard platform balance failed:', err?.message)
                }
            })()

            return () => { cancelled = true; offScan() }
        }
    }, [network, user, unlockedTick])
    const [tokensBalanceUsd, setTokensBalanceUsd] = useState(0)
    const [tokens, setTokens] = useState({})

    const [activeTab, setActiveTab] = useState('assets')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isShowingAssets, setIsShowingAssets] = useState(true)

    /* The Shielded ASSET-LIST row opens the full-screen shielded wallet. */
    const [showShielded, setShowShielded] = useState(false)

    /* F56c — the SELECTED ASSET (lifted so the Total card's icon reflects
     * it). DEFAULT TO DASH ON EVERY RELOAD (the owner directive — the
     * persisted SANS selection previously trapped the Send panel): the
     * stored selection is CLEARED on mount; in-session clicks re-store it
     * for the Send panel's read. */
    const [selectedAsset, setSelectedAsset] = useState<IToken>(DEFAULT_ASSET)
    useEffect(() => {
        try { clearAsset() } catch { /* private mode */ }
        setSelectedAsset(DEFAULT_ASSET)
    }, [])
    const handleSelectAsset = (asset: IToken) => {
        setSelectedAsset(asset)
        try { storeAsset(asset) } catch { /* private mode */ }
    }

    const [Identity, setIdentity] = useState({
        asset: {
            iconUrl: '/icons/dash.svg',
            ticker: 'Transparent',
        }
    })

    // const handleCopy = async () => {
    //     try {
    //         await navigator.clipboard.writeText(contractString)
    //         setCopied(true)
    //         toast.success('Contract copied to clipboard')
    //         setTimeout(() => setCopied(false), 2000)
    //     } catch (error) {
    //         showErrorToast('Failed to copy contract')
    //     }
    // }

    // const documentCount = Object.keys(dataContract.documents).length
    // const totalIndices = Object.values(dataContract.documents).reduce((acc, doc: any) =>
    //     acc + (doc.indices?.length || 0), 0
    // )

    useEffect(() => {
        async function fetchData() {
            /* F57 Phase 1: the dead wasm-SDK initialization is GONE — the
             * compat token-balance readers it was scaffolding for are never
             * called here (the token rows live in WalletAssets), and the
             * main-thread WASM SDK must not be constructed for reads. */

// FIXME FOR DEV PURPOSES ONLY
            const ENDPOINT = 'https://dashswap.xyz/v1/ticker/DASH'
            const response = await fetch(ENDPOINT)
            const ticker = await response.json()
            const dashUsdValue = ticker.quote.USD.price
            setDashPrice(dashUsdValue)

            /* Validate user. */
            if (typeof user !== 'undefined' && user !== null) {
                const identityId = user.identityId

                const balance = numeral(user?.balance / 10 ** 11).format('0,0.0000[0000]')

                setDisplayBalance(balance)

                const balanceUsd = numeral((user?.balance / 10 ** 11) * dashUsdValue).format('$0,0.00[00]')

                setDisplayBalanceUsd(balanceUsd)
            }

            setTokens([
                {
                    id: 'DUSD',
                },
                {
                    id: 'SANS',
                },
            ])
        }

        /* Fetch (async) data. */
        fetchData()
    }, [user])

    /* The three balances in DASH (credits -> DASH at 1e11) + the total. */
    const identityDash = Number(user?.balance ?? 0) / 10 ** 11
    const platformDash = Number(platformCredits ?? 0n) / 10 ** 11
    const shieldedDash = Number(shieldedCredits ?? 0n) / 10 ** 11
    const totalDash = identityDash + platformDash + shieldedDash

    return (
        <div className="min-h-screen flex">
            {/* Desktop shell: the same left menu every core page mounts
                (the wallet page was missing it — 'mobile layout on
                desktop' report). */}
            <Sidebar />

            <main className="pt-14 py-10 flex-1 min-w-0 grid grid-cols-1 gap-8 h-screen">
            <div className="sm:mt-2 lg:mt-4 w-full overflow-y-scroll">
                {/* F57b Option B — the session-lock gate: renders ONLY when
                 * the in-memory keys are gone after a reload (the vault
                 * unlock, or the honest reconnect guidance). */}
                <SessionLockBanner />
                {showShielded && <WalletShielded isFullScreen onBack={() => setShowShielded(false)} />}
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`cursor-pointer group w-full px-5 py-3 bg-gradient-to-b from-sky-100 to-sky-50 border-t border-x border-sky-400 rounded-x-lg shadow-md hover:bg-sky-100 ${showShielded ? 'hidden' : ''}`}
                >
                    <div className="flex flex-row w-full justify-between items-center mb-1 {[ isShowingAssets ? 'visible' : 'hidden' ]}">
                        <section className="flex flex-col gap-0.5 items-start">
                            <h2 className="text-base tracking-tight uppercase text-sky-600 font-medium opacity-40 group-hover:opacity-100 group-hover:scale-105 duration-300 ease-in-out">
                                My Identity Dashboard
                            </h2>

                            {user?.dpnsUsername && <h3 className="text-lg tracking-wide text-sky-700 font-bold opacity-80 group-hover:opacity-100 group-hover:scale-105 duration-300 ease-in-out">
                                {user?.dpnsUsername.slice(0, -5)}
                            </h3>}

                            {user?.identityId && <h3 className="text-xs tracking-tight text-sky-600 font-medium opacity-60 group-hover:opacity-100 group-hover:scale-105 duration-300 ease-in-out">
                                {user?.identityId}
                            </h3>}

                            {/* The IDENTITY balance under the identity id
                                — one simple line (owner directive). The
                                total lives in the big balance block below
                                (restored to its pre-refactor spot). */}
                            {user?.identityId && <h3 className="text-xs tracking-tight text-sky-600 font-medium opacity-70 group-hover:opacity-100 group-hover:scale-105 duration-300 ease-in-out">
                                Identity balance {numeral(identityDash).format('0,0.0000[0000]')} DASH
                            </h3>}
                        </section>

                        <Image
                            src={selectedAsset?.iconUrl ?? '/icons/dash.svg'}
                            className="-mt-3 -mr-2 p-2 h-16 w-auto opacity-40 group-hover:opacity-100 group-hover:h-11 duration-300 ease-in-out"
                            alt=""
                            width={0}
                            height={0}
                        />
                    </div>

                    {/* The big TOTAL balance — the original pre-refactor
                        spot (right-aligned under the icon row), showing
                        identity + Platform Transparent + Shielded. */}
                    <div className="flex flex-col items-end">
                        <h3 className="text-xs tracking-widest text-sky-700 font-medium uppercase">
                            Total balance
                        </h3>

                        {/* F56e: the TOTAL waits for every lane's read — until
                         * then it shows a skeleton (a zero would be a lie:
                         * the Transparent/Shielded reads are still in flight
                         * and each loads INDEPENDENTLY below). */}
                        {platformCredits === null || shieldedCredits === null ? (
                            <div className="flex flex-col items-end gap-1.5 my-1">
                                <div className="h-7 w-44 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                                <span className="text-[11px] text-gray-400 italic">loading the wallet engine…</span>
                            </div>
                        ) : (<>
                            <h2 className="text-3xl text-gray-600 font-medium">
                                {numeral(totalDash).format('0,0.0000[0000]')}
                            </h2>

                            <h3 className="text-xl text-gray-500 font-medium">
                                {numeral(totalDash * dashPrice).format('$0,0.00[00]')}
                            </h3>
                        </>)}
                    </div>

                    <section className="{[ isShowingAssets ? 'visible' : 'hidden' ]}">
                        <div className="my-2 border-t border-sky-500" />

                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <h3 className="text-xs tracking-widest text-sky-700 font-medium uppercase">
                                    Tokens
                                </h3>

                                {tokens && <h2 className="text-base text-gray-600 font-medium">
                                    {/* {tokensBalanceUsd}  */}
                                    <small className="text-sky-400">x{Object.keys(tokens).length}</small>
                                </h2>}
                                {!tokens && <h2 className="text-base text-gray-600 font-medium">
                                    none
                                </h2>}
                            </div>

                            <div>
                                <h3 className="text-xs tracking-widest text-sky-700 font-medium uppercase">
                                    Collectibles
                                </h3>

                                <h2 className="text-base text-gray-600 font-medium">
                                    none
                                </h2>
                            </div>
                        </div>
                    </section>
                </button>

                <div className={`block ${showShielded ? 'hidden' : ''}`}>
                    <nav className="isolate grid grid-cols-4 divide-x divide-gray-200 rounded-x-lg rounded-b-lg shadow" aria-label="Tabs">
                        <div onClick={() => setActiveTab('deposit')} className={`cursor-pointer bg-gray-700 rounded-bl-lg group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <ArrowDownTrayIcon className="w-5 h-auto text-slate-100" />

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'deposit' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                Deposit
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'deposit' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('send')} className={`cursor-pointer bg-gray-700 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <ArrowUpTrayIcon className="w-5 h-auto text-slate-100" />

                             <span className={`text-xs sm:text-sm  ${[ activeTab === 'send' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                Send
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'send' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('swap')} className={`cursor-pointer bg-gray-700 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <ArrowPathIcon className="w-5 h-auto text-slate-100" />

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'swap' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                Swap
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'swap' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('history')} className={`cursor-pointer bg-gray-700 rounded-br-lg group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <BarsArrowDownIcon className="w-5 h-auto text-slate-100" />

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'history' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                History
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'history' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>
                    </nav>
                </div>

                <div className="my-5 px-2">
                    {activeTab === 'assets' && <WalletAssets
                        isFullScreen={isFullScreen}
                        onOpenShielded={() => setShowShielded(true)}
                        selectedAsset={selectedAsset}
                        onSelectAsset={handleSelectAsset}
                    />}

                    {activeTab === 'send' && <WalletSend
                        isFullScreen={isFullScreen}
                    />}

                    {activeTab === 'deposit' && <WalletDeposit
                        isFullScreen={isFullScreen}
                    />}

                    {activeTab === 'swap' && <WalletSwap
                        isFullScreen={isFullScreen}
                    />}

                    {activeTab === 'history' && <WalletHistory
                        isFullScreen={isFullScreen}
                    />}
                </div>
            </div>
            </main>
        </div>
    )
}
