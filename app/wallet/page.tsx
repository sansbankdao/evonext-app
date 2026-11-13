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
import * as coreChain from '../../lib/core-chain'
import * as walletManager from '../../lib/wallet-manager'
// @ts-ignore
import numeral from 'numeral'

import { getWasmSdk } from '../../lib/services/wasm-sdk-service'

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
    /* The DASH/USD price (for recomputing the identity-balance USD after
     * a withdraw without re-fetching). */
    const [dashPrice, setDashPrice] = useState(0)
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

    /* WITHDRAW identity balance back to Core (L1) — the F25-proven
     * wallet-manager.withdrawToCore path (identityCreditWithdrawal +
     * system-contract withdrawal doc; the L1 payout lands at the
     * destination within minutes). */
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [withdrawTo, setWithdrawTo] = useState('')
    const [withdrawing, setWithdrawing] = useState(false)
    /* Live identity balance (credits) — seeded from the session, updated
     * from the withdraw result. */
    const [identityCredits, setIdentityCredits] = useState<bigint | null>(null)

    /* Prefill the withdraw destination with the user's OWN funding address
     * (their mnemonic-derived L1 address). */
    useEffect(() => {
        if (typeof user !== 'undefined' && user !== null && !withdrawTo) {
            try {
                const identityIdx = Number(localStorage.getItem('identity_idx') || 0)
                setWithdrawTo(coreChain.deriveFundingKey(
                    network === 'mainnet' ? 'mainnet' : 'testnet', identityIdx).address)
            } catch { /* no session phrase — leave blank */ }
            setIdentityCredits(BigInt((user as any)?.balance ?? 0))
        }
    }, [user, network, withdrawTo])

    /** Decimal-string DASH -> credits (exact, no float math). */
    const dashToCreditsExact = (input: string): bigint | null => {
        const trimmed = input.trim()
        if (!/^\d+(\.\d{0,11})?$/.test(trimmed)) return null
        const [whole, frac = ''] = trimmed.split('.')
        const fracPadded = frac.padEnd(11, '0').slice(0, 11)
        return BigInt(whole + fracPadded)
    }

    const handleWithdrawToCore = async () => {
        const amount = dashToCreditsExact(withdrawAmount)
        if (!amount || amount <= 0n) {
            return showErrorToast('Please enter a valid amount to withdraw.')
        }
        if (!identityCredits || amount > identityCredits) {
            return showErrorToast('The amount exceeds your identity balance.')
        }
        if (typeof user === 'undefined' || user === null || !user.identityId) {
            return showErrorToast('Your session is still loading — try again in a moment.')
        }
        const destination = withdrawTo.trim()
        if (destination.length < 26) {
            return showErrorToast('Please enter a valid Dash (L1) address.')
        }

        setWithdrawing(true)
        try {
            const identityIdx = Number(localStorage.getItem('identity_idx') || 0)
            const result: any = await walletManager.withdrawToCore(
                network === 'mainnet' ? 'mainnet' : 'testnet',
                user.identityId,
                identityIdx,
                amount,
                destination,
                1,
            )
            if (result?.remainingBalance !== undefined) {
                setIdentityCredits(BigInt(result.remainingBalance))
            }
            setWithdrawAmount('')
            toast.success(
                'Withdrawal submitted — the Core (L1) payout lands at ' +
                `${destination.slice(0, 12)}… within minutes.`)
        } catch (error: any) {
            showErrorToast(error?.message || 'The withdrawal failed — no funds were moved.')
        } finally {
            setWithdrawing(false)
        }
    }
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

                            {/* The IDENTITY balance lives here — under the
                                username + address (owner directive). The
                                Transparent asset row shows the Platform-
                                address pool balance instead. */}
                            <div className="mt-2 pt-2 border-t border-sky-200">
                                <h3 className="text-2xs tracking-widest text-sky-500 font-medium uppercase">
                                    Identity balance
                                </h3>

                                <h2 className="text-xl text-gray-600 font-medium">
                                    {identityCredits !== null
                                        ? numeral(Number(identityCredits) / 10 ** 11).format('0,0.0000[0000]')
                                        : displayBalance}
                                    <small className="text-sky-400"> DASH</small>
                                </h2>

                                <h3 className="text-sm text-gray-500 font-medium">
                                    {identityCredits !== null
                                        ? numeral(Number(identityCredits) / 10 ** 11 * dashPrice).format('$0,0.00[00]')
                                        : displayBalanceUsd}
                                </h3>
                            </div>
                        </section>

                        <Image
                            src={Identity.asset?.iconUrl}
                            className="-mt-3 -mr-2 p-2 h-16 w-auto opacity-40 group-hover:opacity-100 group-hover:h-11 duration-300 ease-in-out"
                            alt=""
                            width={0}
                            height={0}
                        />
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

                {/* WITHDRAW identity balance back to Core (L1). A sibling
                    card (inputs cannot nest inside the dashboard button). */}
                <div className={`block ${showShielded ? 'hidden' : ''}`}>
                    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-sky-900 uppercase tracking-wide">
                                Withdraw to Core
                            </h3>
                            {identityCredits !== null && (
                                <span className="text-2xs text-sky-500">
                                    Available: {numeral(Number(identityCredits) / 10 ** 11).format('0,0.0000[0000]')} DASH
                                </span>
                            )}
                        </div>

                        <p className="text-2xs text-gray-500 mb-3">
                            Moves identity credits back to the Dash Core (L1) network.
                            The consensus fee is deducted automatically; the payout
                            lands at the destination within minutes.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="block text-2xs font-medium text-gray-600 mb-1">
                                    Amount (DASH)
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.001"
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-2xs font-medium text-gray-600 mb-1">
                                    Core (L1) destination address
                                </label>
                                <input
                                    type="text"
                                    value={withdrawTo}
                                    onChange={(e) => setWithdrawTo(e.target.value)}
                                    placeholder="y…"
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 font-mono break-all focus:border-sky-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleWithdrawToCore}
                            disabled={withdrawing || !withdrawAmount || !withdrawTo}
                            className="w-full rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
                        >
                            {withdrawing ? 'Submitting withdrawal…' : 'Withdraw to Core'}
                        </button>
                    </div>
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
