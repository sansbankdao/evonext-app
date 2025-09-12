'use client'

import { useState } from 'react'
import {
    ArrowLeftIcon,
    DocumentDuplicateIcon,
    CheckIcon,
    CodeBracketIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import dataContract from '@/contracts/evonext-contract.json'
import toast from 'react-hot-toast'

import { WalletAssets } from '@/components/wallet/assets'
import { WalletAssistant } from '@/components/wallet/assistant'
import { WalletDeposit } from '@/components/wallet/deposit'
import { WalletHistory } from '@/components/wallet/history'
import { WalletSend } from '@/components/wallet/send'

export default function WalletPage() {
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

    return (
        <main className="pt-16 py-10 w-full grid grid-cols-1 gap-8 h-screen">
            <div className="lg:mt-2 w-full overflow-y-scroll">
                <button
                    onClick={() => setActiveTab('assets')}
                    className="cursor-pointer group w-full px-5 py-3 bg-gradient-to-b from-sky-100 to-sky-50 border-t border-x border-sky-400 rounded-x-lg shadow-md hover:bg-sky-100"
                >
                    <div className="flex flex-row w-full justify-between items-center mb-1 {[ isShowingAssets ? 'visible' : 'hidden' ]}">
                        <h3 className="text-lg tracking-tight uppercase text-sky-600 font-medium text-center opacity-40 group-hover:opacity-100 group-hover:scale-105 duration-300 ease-in-out">
                            My Identity Dashboard
                        </h3>

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
                            Spendable ${Identity.asset?.ticker}
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

                                <h2 v-if="tokens" className="text-base text-gray-600 font-medium">
                                    {tokensBalanceUsd} <small className="text-sky-400">x{Object.keys(tokens).length}</small>
                                </h2>
                                <h2 v-else className="text-base text-gray-600 font-medium">
                                    none
                                </h2>
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
                    <nav className="isolate grid grid-cols-4 divide-x divide-gray-200 rounded-x-lg rounded-b-lg shadow" aria-label="Tabs">
                        <div onClick={() => setActiveTab('deposit')} className={`cursor-pointer bg-gray-700 rounded-bl-lg group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-sm font-medium hover:bg-stone-400 hover:text-gray-600 focus:z-10`} aria-current="page">
                            <svg className="w-4 h-auto text-slate-100" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"></path>
                            </svg>

                            <span className={`text-xs sm:text-sm  ${[ activeTab === 'deposit' ? 'text-slate-100' : 'text-slate-400' ]}`}>
                                Deposit
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'deposit' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('send')} className="cursor-pointer bg-gray-700 text-gray-400 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-center text-sm font-medium hover:bg-gray-50 hover:text-gray-600 focus:z-10">
                            <svg className="w-4 h-auto text-slate-100" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"></path>
                            </svg>

                            <span className="text-xs sm:text-sm text-slate-100">
                                Send
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'send' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('history')} className="cursor-pointer bg-gray-700 text-gray-400 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-center text-sm font-medium hover:bg-gray-50 hover:text-gray-600 focus:z-10">
                            <svg className="w-5 h-auto text-slate-100" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path>
                            </svg>

                            <span className="text-xs sm:text-sm text-slate-100">
                                History
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'history' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>

                        <div onClick={() => setActiveTab('assistant')} className="cursor-pointer bg-gray-700 text-gray-400 group relative min-w-0 flex flex-row justify-center items-center gap-1 overflow-hidden py-2 px-2 text-center text-sm font-medium hover:bg-gray-50 hover:text-gray-600 focus:z-10">
                            <svg className="w-5 h-auto text-slate-100" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"></path>
                            </svg>

                            <span className="text-xs sm:text-sm text-slate-100">
                                Assistant
                            </span>

                            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${[ activeTab === 'assistant' ? 'bg-sky-500' : 'bg-transparent' ]}`}></span>
                        </div>
                    </nav>
                </div>

                <div className="my-5">
                    {activeTab === 'assets' && <WalletAssets
                        isFullScreen={isFullScreen}
                    />}

                    {activeTab === 'send' && <WalletSend
                        isFullScreen={isFullScreen}
                    />}

                    {activeTab === 'deposit' && <WalletDeposit
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
