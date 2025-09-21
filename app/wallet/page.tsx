'use client'

import { useEffect, useState } from 'react'
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowUpTrayIcon,
    BarsArrowDownIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'
// @ts-ignore
import numeral from 'numeral'

import { getWasmSdk } from '../../lib/services/wasm-sdk-service'

import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'

import { WalletAssets } from '@/components/wallet/assets'
import { WalletAssistant } from '@/components/wallet/assistant'
import { WalletDeposit } from '@/components/wallet/deposit'
import { WalletSwap } from '@/components/wallet/swap'
import { WalletHistory } from '@/components/wallet/history'
import { WalletSend } from '@/components/wallet/send'

/* Initialize constants. */
const DASH_USD_VALUE = 24 // FIXME PULL FROM MARKET APIA

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
    //         toast.error('Failed to copy contract')
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
            } = await import('../../lib/dash-wasm/wasm_sdk')

            /* Initiallize SDK. */
            const sdk = await getWasmSdk()

console.log('USER', user)
            /* Validate user. */
            if (typeof user !== 'undefined' && user !== null) {
                const identityId = user.identityId

                const balance = numeral(user?.balance / 10 ** 11).format('0,0.0000[0000]')

                setDisplayBalance(balance)

                const balanceUsd = numeral((user?.balance / 10 ** 11) * DASH_USD_VALUE).format('$0,0.00[00]')

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
        <main className="pt-14 py-10 w-full grid grid-cols-1 gap-8 h-screen">
            <div className="sm:mt-2 lg:mt-4 w-full overflow-y-scroll">
                <button
                    onClick={() => setActiveTab('assets')}
                    className="cursor-pointer group w-full px-5 py-3 bg-gradient-to-b from-sky-100 to-sky-50 border-t border-x border-sky-400 rounded-x-lg shadow-md hover:bg-sky-100"
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

                <div className="block">
                    <nav className="isolate grid grid-cols-5 divide-x divide-gray-200 rounded-x-lg rounded-b-lg shadow" aria-label="Tabs">
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

                        <div onClick={() => setActiveTab('history')} className={`cursor-pointer bg-gray-700 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <BarsArrowDownIcon className="w-5 h-auto text-slate-100" />

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'history' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                History
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'history' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('assistant')} className={`cursor-pointer bg-gray-700 rounded-br-lg group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <SparklesIcon className="w-5 h-auto text-slate-100" />

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'assistant' ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100' ]}`}>
                                Assistant
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'assistant' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
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

                    {activeTab === 'assistant' && <WalletAssistant
                        isFullScreen={isFullScreen}
                    />}
                </div>
            </div>
        </main>
    )
}
