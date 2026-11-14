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

import { getWasmSdk, wasmSdkService } from '../../lib/services/wasm-sdk-service'
import { fetchPlatformAddressBalance } from '../../lib/platform-address'
import { getMnemonic } from '../../lib/secure-storage'
import { EVONEXT_CONTRACT_ID_TESTNET, EVONEXT_CONTRACT_ID_MAINNET } from '../../lib/constants'
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

    useEffect(() => {
        if (typeof user !== 'undefined' && user !== null) {
            let cancelled = false
            const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
                Promise.race([
                    p,
                    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
                ])
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
                        const off = shieldedEngine.onScanStatus(({ balance }) => {
                            if (!cancelled) setShieldedCredits(BigInt(balance))
                        })
                        return () => { off() }
                    }
                } catch (err: any) {
                    console.error('dashboard shielded balance failed:', err?.message)
                }
            })()

            ;(async () => {
                try {
                    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                    /* The main-thread SDK must be live (the F37 guard). */
                    if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== sdkNetwork) {
                        await wasmSdkService.initialize({
                            network: sdkNetwork,
                            contractId: sdkNetwork === 'mainnet'
                                ? EVONEXT_CONTRACT_ID_MAINNET
                                : EVONEXT_CONTRACT_ID_TESTNET,
                        })
                    }
                    for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
                        try {
                            const sdk = await getWasmSdk()
                            const credits = await withTimeout(
                                fetchPlatformAddressBalance(sdk, sdkNetwork),
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

            return () => { cancelled = true }
        }
    }, [network, user])
    const [tokensBalanceUsd, setTokensBalanceUsd] = useState(0)
    const [tokens, setTokens] = useState({})

    const [activeTab, setActiveTab] = useState('assets')
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isShowingAssets, setIsShowingAssets] = useState(true)

    /* The Shielded ASSET-LIST row opens the full-screen shielded wallet. */
    const [showShielded, setShowShielded] = useState(false)

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
                            src={Identity.asset?.iconUrl}
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

                        <h2 className="text-3xl text-gray-600 font-medium">
                            {numeral(totalDash).format('0,0.0000[0000]')}
                        </h2>

                        <h3 className="text-xl text-gray-500 font-medium">
                            {numeral(totalDash * dashPrice).format('$0,0.00[00]')}
                        </h3>
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
