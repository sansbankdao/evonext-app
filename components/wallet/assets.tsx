'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

interface Token {
    id: string;
}

interface WalletAssetProps {
    isFullScreen: boolean;
}

interface Identity {
    setAsset: (token: Token) => void;
}

export function WalletAssets({ isFullScreen }: WalletAssetProps) {
    const { user } =  useAuth()
    const [activeTab, setActiveTab] = useState('assets')
    const [token, setToken] = useState<Token>({ id: '0' })
    const [assets, setAssets] = useState<Token[]>([{ id: '0' }])
    const [collections, setCollections] = useState<Token[]>([{ id: '0' }])

    const displayIcon = (_token: Token) => {
        return 'No Img'
    }

    const displayTokenName = (_token: string) => {
        return 'No Name'
    }

    const displayDecimalAmount = (_token: Token) => {
        return '0.0000 DASH'
    }

    const displayDecimalAmountUsd = (_token: Token) => {
        return '$0.00'
    }

    const Identity = {
        setAsset: (tokenid: string) => {}
    }

    return (
        <main className="flex flex-col gap-5">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 text-center" aria-label="Tabs">
                    <button onClick={() => setActiveTab('assets')} className="w-1/2 text-sky-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium {activeTab === 'assets' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700'}" aria-current="page">
                        <span className="text-lg">
                            Assets
                        </span>

                        <span className="bg-sky-100 text-sky-600 ml-1 sm:ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium">
                            {assets?.length}
                        </span>
                    </button>

                    {/* <!-- Current: "", Default: "" --> */}
                    <button onClick={() => setActiveTab('collections')} className="w-1/2 text-gray-500 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium {activeTab === 'collections' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700'}">
                        <span className="text-lg">
                            Collections
                        </span>

                        {/* <!-- Current: "bg-sky-100 text-sky-600", Default: "bg-gray-100 text-gray-900" --> */}
                        <span className="bg-gray-100 text-gray-900 ml-1 sm:ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium">
                            {collections?.length}
                        </span>
                    </button>
                </nav>
            </div>

            <div v-if="activeTab === 'assets'" className="px-1.5 flex flex-col gap-5">
                {assets.map((token) => (
                    <div
                        key={token.id}
                        onClick={() => Identity.setAsset(token.id)}
                        className="flex flex-row justify-between items-end pl-1 pr-3 pt-2 pb-1 sm:py-3 bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-300 rounded-lg shadow hover:bg-amber-200 cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-start">
                            <img src={displayIcon(token)} className="-mt-0.5 mr-1 h-12 w-auto p-2 opacity-80" />

                            <div className="flex flex-col">
                                <h3 className="text-base text-amber-800 font-medium uppercase truncate">
                                    {displayTokenName(token.id)}
                                </h3>

                                <span className="sm:hidden text-lg font-medium text-amber-600">
                                    {displayDecimalAmount(token)}
                                </span>
                                <span className="hidden sm:flex text-xl font-medium text-amber-600">
                                    {displayDecimalAmount(token)}
                                </span>
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-amber-700">
                            <sup className="text-xs">
                                USD
                            </sup>

                            <span className="-mt-3 sm:hidden text-2xl">
                                {displayDecimalAmountUsd(token)}
                            </span>
                            <span className="-mt-3 hidden sm:flex text-3xl">
                                {displayDecimalAmountUsd(token)}
                            </span>
                        </h3>
                    </div>
                ))}
            </div>

            <div v-else className="flex flex-col gap-5">
                {collections.map((token) => (
                    <div
                        key={token.id}
                        onClick={() => Identity.setAsset(token.id)}
                        className="flex flex-row justify-between items-end pl-1 pr-3 pt-2 pb-1 sm:py-3 bg-gradient-to-b from-amber-100 to-amber-50 border border-amber-300 rounded-lg shadow hover:bg-amber-200 cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-start">
                            <img src={displayIcon(token)} className="-mt-0.5 mr-1 h-12 w-auto p-2 opacity-80" />

                            <div className="flex flex-col">
                                <h3 className="text-base text-amber-800 font-medium uppercase truncate">
                                    {displayTokenName(token.id)}
                                </h3>

                                <span className="sm:hidden text-lg font-medium text-amber-600">
                                    {displayDecimalAmount(token)}
                                </span>
                                <span className="hidden sm:flex text-xl font-medium text-amber-600">
                                    {displayDecimalAmount(token)}
                                </span>
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-amber-700">
                            <sup className="text-xs">
                                USD
                            </sup>

                            <span className="-mt-3 sm:hidden text-2xl">
                                {displayDecimalAmountUsd(token)}
                            </span>
                            <span className="-mt-3 hidden sm:flex text-3xl">
                                {displayDecimalAmountUsd(token)}
                            </span>
                        </h3>
                    </div>
                ))}
            </div>
        </main>
    )
}
