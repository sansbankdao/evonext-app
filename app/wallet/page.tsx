'use client'

import { useEffect, useState } from 'react'
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowUpTrayIcon,
    BarsArrowDownIcon,
    ChevronRightIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'
// @ts-ignore
import numeral from 'numeral'

import { wasmSdkService, getWasmSdk } from '../../lib/services/wasm-sdk-service'

import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'

import { WalletAssets } from '@/components/wallet/assets'
import { WalletDeposit } from '@/components/wallet/deposit'
import { WalletSwap } from '@/components/wallet/swap'
import { WalletHistory } from '@/components/wallet/history'
import { WalletSend } from '@/components/wallet/send'
import { WalletShielded } from '@/components/wallet/shielded'
import { getMnemonic } from '@/lib/secure-storage'
import { makeShieldedSync } from '@/lib/shielded/wallet'

export default function WalletPage() {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [displayBalance, setDisplayBalance] = useState(0)
    const [displayBalanceUsd, setDisplayBalanceUsd] = useState(0)
    const [tokensBalanceUsd, setTokensBalanceUsd] = useState(0)
    const [tokens, setTokens] = useState({})

    const [activeTab, setActiveTab] = useState('assets')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isShowingAssets, setIsShowingAssets] = useState(true)

    /* Shielded dashboard line item (mobile-parity balance model):
     * the shielded-pool balance from the local note scan. */
    const [showShielded, setShowShielded] = useState(false)
    const [shieldedCredits, setShieldedCredits] = useState<bigint | null>(null)
    const [shieldedUsd, setShieldedUsd] = useState<string>('')
    const [dashUsdPrice, setDashUsdPrice] = useState(0)

    const [Identity, setIdentity] = useState({
        asset: {
            iconUrl: '/icons/dash.svg',
            ticker: 'Dash Credits',
        }
    })
    // const contractString = JSON.stringify(dataContract, null, 2)

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
            const {
                // get_identity_balance_with_proof_info,
                get_identities_token_balances_with_proof_info,
                // get_identities_token_infos_with_proof_info,
            } = await import('../../lib/dash-wasm/compat')

            /* Initiallize SDK. */
            const sdk = await getWasmSdk()

// FIXME FOR DEV PURPOSES ONLY
            const ENDPOINT = 'https://dashswap.xyz/v1/ticker/DASH'
            const response = await fetch(ENDPOINT)
            const ticker = await response.json()
            const dashUsdValue = ticker.quote.USD.price

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

    /* DASH/USD price for the Shielded line item (same feed as above, cached
     * 10 min so a page view never hammers the API). */
    useEffect(() => {
        let cancelled = false
        const KEY = 'evonext_dash_usd'
        const TTL_MS = 10 * 60 * 1000
        try {
            const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null')
            if (cached && typeof cached.price === 'number' && Date.now() - cached.at < TTL_MS) {
                setDashUsdPrice(cached.price)
            }
        } catch { /* ignore malformed cache */ }
        fetch('https://dashswap.xyz/v1/ticker/DASH')
            .then((r) => r.json())
            .then((t) => {
                const p = Number(t?.quote?.USD?.price)
                if (!cancelled && Number.isFinite(p) && p > 0) {
                    setDashUsdPrice(p)
                    try { localStorage.setItem(KEY, JSON.stringify({ price: p, at: Date.now() })) } catch { /* ignore */ }
                }
            })
            .catch(() => { /* keep cached value / 0 */ })
        return () => { cancelled = true }
    }, [])

    /* Shielded balance for the dashboard line item: a local note scan
     * (persisted — incremental after the first pass). Skipped silently when
     * no recovery phrase is in the session. The wasm request-timeout can
     * leave a query pending FOREVER (F30) and the proxy has a 12s fetch cap,
     * so every pass is bounded + retried — syncPass is resumable. */
    useEffect(() => {
        let cancelled = false
        const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
            Promise.race([
                p,
                new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
            ])
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

        ;(async () => {
            try {
                const mnemonic = getMnemonic()
                if (!mnemonic) return
                const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                /* initialize() no-ops on a matching config; re-init when the
                 * live service was built for the WRONG network (F37). */
                if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== sdkNetwork) {
                    await wasmSdkService.initialize({
                        network: sdkNetwork,
                        contractId: sdkNetwork === 'mainnet'
                            ? EVONEXT_CONTRACT_ID_MAINNET
                            : EVONEXT_CONTRACT_ID_TESTNET,
                    })
                }
                const sdk = await getWasmSdk()
                const sync = makeShieldedSync(sdk, sdkNetwork, mnemonic)
                for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
                    try {
                        const ok = await withTimeout(sync.syncPass(), 120000, `shielded scan (attempt ${attempt + 1})`)
                        if (!ok) throw new Error('scan interrupted')
                        await withTimeout(sync.refreshSpent(), 60000, 'spend-status refresh')
                        if (cancelled) return
                        setShieldedCredits(sync.balance())
                        return
                    } catch (err: any) {
                        if (cancelled) return
                        console.error(`shielded dashboard scan attempt ${attempt + 1} failed:`, err?.message)
                        await sleep(8000) /* the pass is resumable — retry */
                    }
                }
            } catch (err: any) {
                /* The line item simply stays empty — never block the wallet. */
                console.error('shielded dashboard scan failed:', err?.message)
            }
        })()
        return () => { cancelled = true }
    }, [network])

    return (
        <main className="pt-14 py-10 w-full grid grid-cols-1 gap-8 h-screen">
            <div className="sm:mt-2 lg:mt-4 w-full overflow-y-scroll">
                {showShielded && <WalletShielded isFullScreen onBack={() => setShowShielded(false)} />}
                <div
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
                        </section>

                        <Image
                            src={Identity.asset?.iconUrl}
                            className="-mt-3 -mr-2 p-2 h-16 w-auto opacity-40 group-hover:opacity-100 group-hover:h-11 duration-300 ease-in-out"
                            alt=""
                            width={0}
                            height={0}
                        />
                    </div>

                    <div className="flex flex-col items-end">
                        <h3 className="text-xs tracking-widest text-sky-700 font-medium uppercase">
                            Spendable {Identity.asset?.ticker}
                        </h3>

                        <h2 className="text-3xl text-gray-600 font-medium">
                            {displayBalance}
                        </h2>

                        <h3 className="text-xl text-gray-500 font-medium">
                            {displayBalanceUsd}
                        </h3>
                    </div>

                    <section className="{[ isShowingAssets ? 'visible' : 'hidden' ]}">
                        <div className="my-2 border-t border-sky-500" />

                        {/* Asset line items (mobile-parity balance model):
                         * Shielded (pool) + Transparent (identity credits). */}
                        <div className="flex flex-col gap-1 mb-3">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowShielded(true) }}
                                className="flex flex-row items-center justify-between px-3 py-2.5 bg-white/70 border border-sky-200 rounded-lg shadow-sm hover:bg-white transition-colors"
                            >
                                <span className="flex flex-row items-center gap-2">
                                    <ShieldCheckIcon className="w-6 h-6 text-sky-600" />
                                    <span className="flex flex-col items-start">
                                        <span className="text-sm font-semibold text-sky-800">Shielded</span>
                                        <span className="text-2xs text-sky-600">Orchard pool · DASH</span>
                                    </span>
                                </span>
                                <span className="flex flex-row items-center gap-2">
                                    <span className="flex flex-col items-end">
                                        <span className="text-sm font-semibold text-sky-700 tabular-nums">
                                            {shieldedCredits !== null
                                                ? `${numeral(Number(shieldedCredits) / 1e11).format('0,0.0000[0000]')} DASH`
                                                : '—'}
                                        </span>
                                        <span className="text-2xs text-gray-500">
                                            {shieldedCredits !== null && dashUsdPrice > 0
                                                ? numeral((Number(shieldedCredits) / 1e11) * dashUsdPrice).format('$0,0.00[00]')
                                                : ''}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="w-4 h-4 text-sky-400" />
                                </span>
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab('send') }}
                                className="flex flex-row items-center justify-between px-3 py-2.5 bg-white/70 border border-sky-200 rounded-lg shadow-sm hover:bg-white transition-colors"
                            >
                                <span className="flex flex-row items-center gap-2">
                                    <Image
                                        src="/icons/dash.svg"
                                        className="h-6 w-auto p-0.5"
                                        alt=""
                                        width={0}
                                        height={0}
                                    />
                                    <span className="flex flex-col items-start">
                                        <span className="text-sm font-semibold text-sky-800">Transparent</span>
                                        <span className="text-2xs text-sky-600">Identity credits · DASH</span>
                                    </span>
                                </span>
                                <span className="flex flex-row items-center gap-2">
                                    <span className="flex flex-col items-end">
                                        <span className="text-sm font-semibold text-sky-700 tabular-nums">
                                            {user?.balance !== undefined && user?.balance !== null
                                                ? `${numeral(Number(user.balance) / 1e11).format('0,0.0000[0000]')} DASH`
                                                : '—'}
                                        </span>
                                        <span className="text-2xs text-gray-500">
                                            {user?.balance && dashUsdPrice > 0
                                                ? numeral((Number(user.balance) / 1e11) * dashUsdPrice).format('$0,0.00[00]')
                                                : ''}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="w-4 h-4 text-sky-400" />
                                </span>
                            </button>
                        </div>

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
                </div>

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
    )
}
