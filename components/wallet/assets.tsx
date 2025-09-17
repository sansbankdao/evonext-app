'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

// @ts-ignore
import numeral from 'numeral'

import { getWasmSdk } from '../../lib/services/wasm-sdk-service'

interface Token {
    id: string;
    token_id_hex: string;
    iconUrl: string;
}

interface WalletAssetProps {
    isFullScreen: boolean;
}

/* Initialize constants. */
const DUSD = 'DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd' // DUSD
const SANS = 'AxAYWyXV6mrm8Sq7vc7wEM18wtL8a8rgj64SM3SDmzsB' // SANS
const tDUSD = '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz' // tDUSD
const tSANS = 'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw' // tSANS
const DASH_USD_VALUE = 25.0

const DEFAULT_TOKEN = {
    id: '0',
    token_id_hex: '',
    iconUrl: '',
}

export function WalletAssets({ isFullScreen }: WalletAssetProps) {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [activeTab, setActiveTab] = useState('assets')
    const [token, setToken] = useState<Token>(DEFAULT_TOKEN)
    const [assets, setAssets] = useState<Token[]>([DEFAULT_TOKEN])
    const [collections, setCollections] = useState<Token[]>([DEFAULT_TOKEN])

    const [displayDusdBalance, setDisplayDusdBalance] = useState(0)
    const [displayDusdBalanceUsd, setDisplayDusdBalanceUsd] = useState(0)
    const [displaySansBalance, setDisplaySansBalance] = useState(0)
    const [displaySansBalanceUsd, setDisplaySansBalanceUsd] = useState(0)

    const displayIcon = (_token: Token) => {
        /* Initialize locals. */
        let parentid
        let tokenid
console.log('ICON (_token)', _token)
        return '/icons/sans.svg'

        // /* Validate token. */
        // if (!_token) {
        //     return null
        // }

        // /* Validate token ID. */
        // if (_token.token_id_hex) {
        //     /* Set parent id. */
        //     parentid = _token.token_id_hex.slice(0, 64)

        //     /* Set token id. */
        //     tokenid = _token.token_id_hex
        // }

        // /* Handle icon URL. */
        // if (!_token.iconUrl || _token.iconUrl === '') {
        //     /* Validate Studio Time + Collection. */
        //     if (parentid === '9732745682001b06e332b6a4a0dd0fffc4837c707567f8cbfe0f6a9b12080000') {
        //         return `https://nexa.garden/token/${tokenid}/public` // Nexa Garden
        //     }

        //     /* Validate NiftyArt. */
        //     if (parentid === 'cacf3d958161a925c28a970d3c40deec1a3fe06796fe1b4a7b68f377cdb90000') {
        //         return `https://niftyart.cash/nftyc/${tokenid}/cardf.jpeg` // NiftyArt
        //         // return `https://niftyart.cash/nftyc/${tokenid}/public.jpeg` // NiftyArt
        //     }

        //     /* Return null. */
        //     return null
        // }

        // /* Return icon URL. */
        // return _token.iconUrl || null
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

    useEffect(() => {
        async function fetchData() {
            const {
                // get_identity_balance_with_proof_info,
                get_identities_token_balances_with_proof_info,
                // get_identities_token_infos_with_proof_info,
            } = await import('../../lib/dash-wasm/wasm_sdk')

            const sdk = await getWasmSdk()
console.log('USER', user)
            if (typeof user !== 'undefined' && user !== null) {
                const identityId = user.identityId

                // const identityIds = [identityId]
                const identityIds = ['34vkjdeUTP2z798SiXqoB6EAuobh51kXYURqVa9xkujf'] // NewMoneyHoney69

                let dusdContractId
                let sansContractId

                if (network === 'mainnet') {
                    dusdContractId = DUSD
                    sansContractId = SANS
                } else {
                    dusdContractId = tDUSD
                    sansContractId = tSANS
                }

                const dusdBalance = await get_identities_token_balances_with_proof_info(
                    sdk, identityIds, dusdContractId)
console.log('DUSD BALANCE', dusdBalance)
                setDisplayDusdBalance(dusdBalance)

                const sansBalance = await get_identities_token_balances_with_proof_info(
                    sdk, identityIds, sansContractId)
console.log('SANS BALANCE', sansBalance)
                setDisplaySansBalance(sansBalance)

                // ADD ASSETS
                const assets = [
                    {
                        id: dusdContractId,
                        token_id_hex: dusdContractId,
                        iconUrl: '/icons/dusd.svg',
                    },
                    {
                        id: sansContractId,
                        token_id_hex: sansContractId,
                        iconUrl: '/icons/sans.svg',
                    },
                ]

                setAssets(assets)
            }
        }

        /* Fetch (async) data. */
        fetchData()
    }, [user])

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
                        className="flex flex-row justify-between items-end pl-1 pr-3 pt-2 pb-1 sm:py-3 bg-gradient-to-b from-sky-100 to-sky-50 border border-sky-300 rounded-lg shadow hover:bg-sky-200 cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-start">
                            <Image
                                src={displayIcon(token)}
                                className="-mt-0.5 mr-1 h-12 w-auto p-2 opacity-80"
                                alt="Asset icon"
                                width={0}
                                height={0}
                            />

                            <div className="flex flex-col">
                                <h3 className="text-base text-sky-800 font-medium uppercase truncate">
                                    {displayTokenName(token.id)}
                                </h3>

                                <span className="sm:hidden text-lg font-medium text-sky-600">
                                    {displayDecimalAmount(token)}
                                </span>
                                <span className="hidden sm:flex text-xl font-medium text-sky-600">
                                    {displayDecimalAmount(token)}
                                </span>
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-sky-700">
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
                        className="flex flex-row justify-between items-end pl-1 pr-3 pt-2 pb-1 sm:py-3 bg-gradient-to-b from-sky-100 to-sky-50 border border-sky-300 rounded-lg shadow hover:bg-sky-200 cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-start">
                            <img src={displayIcon(token)} className="-mt-0.5 mr-1 h-12 w-auto p-2 opacity-80" />

                            <div className="flex flex-col">
                                <h3 className="text-base text-sky-800 font-medium uppercase truncate">
                                    {displayTokenName(token.id)}
                                </h3>

                                <span className="sm:hidden text-lg font-medium text-sky-600">
                                    {displayDecimalAmount(token)}
                                </span>
                                <span className="hidden sm:flex text-xl font-medium text-sky-600">
                                    {displayDecimalAmount(token)}
                                </span>
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-sky-700">
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
