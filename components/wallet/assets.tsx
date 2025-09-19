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

interface Currency {
    USD: any;
}

interface Token {
    id: string;
    token_id_hex: string;
    iconUrl: string;
    duffs?: bigint;
    amount?: bigint;
    decimal_places: number;
    fiat: Currency;
}

interface WalletAssetProps {
    isFullScreen: boolean;
}

/* Initialize constants. */
const DUSD = 'DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd' // DUSD
const SANS = 'AxAYWyXV6mrm8Sq7vc7wEM18wtL8a8rgj64SM3SDmzsB' // SANS
const tDUSD = '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz' // tDUSD
const tSANS = 'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw' // tSANS

const DASH_USD_VALUE = 24 // FIXME PULL FROM MARKET APIA
const DUSD_USD_VALUE = 1.00
const SANS_USD_VALUE = 0.01

const DASH_DECIMALS = 11
const DUSD_DECIMALS = 6
const SANS_DECIMALS = 8

export function WalletAssets({ isFullScreen }: WalletAssetProps) {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [activeTab, setActiveTab] = useState('assets')
    const [token, setToken] = useState<Token>()
    const [assets, setAssets] = useState<Token[]>()
    const [collections, setCollections] = useState<Token[]>()

    const [displayDusdBalance, setDisplayDusdBalance] = useState(BigInt(0))
    const [displayDusdBalanceUsd, setDisplayDusdBalanceUsd] = useState(BigInt(0))
    const [displaySansBalance, setDisplaySansBalance] = useState(BigInt(0))
    const [displaySansBalanceUsd, setDisplaySansBalanceUsd] = useState(BigInt(0))

    const displayIcon = (_token: Token) => {
        /* Handle token icon URL. */
        if (_token.iconUrl) {
            return _token.iconUrl
        } else {
            return '/icon.svg'
        }
    }

    const displayTokenName = (_tokenid: string) => {
        /* Handle token ID. */
        switch(_tokenid) {
        case '0':
            return 'Dash Credit'
        case DUSD:
        case tDUSD:
            return 'Dash USD'
        case SANS:
        case tSANS:
            return 'Sansnote'
        default:
            return 'Unknown token'
        }
    }

    const displayDecimalAmount = (_token: Token) => {
        // console.log('_token', _token)

        /* Initialize locals. */
        let decimalValue
        let bigIntValue

        /* Handle UI (value) formatting. */
        if (_token.id === '0') {
            decimalValue = _token.duffs! * BigInt(1e4)
        } else {
            decimalValue = _token.amount! * BigInt(1e4)
        }

        /* Handle UI (value) formatting. */
        if (_token.decimal_places > 0) {
            bigIntValue = decimalValue / BigInt(10**_token.decimal_places)
        } else {
            bigIntValue = decimalValue
        }

        /* Return formatted value. */
        return numeral(parseFloat(bigIntValue.toString()) / 1e4).format('0,0[.]00[0000]')
    }

    const displayDecimalAmountUsd = (_token: Token) => {
        // console.log('_token', _token)
        let amount

        /* Set amount. */
        amount = _token.fiat?.USD || 0.00

        /* Handle amount. */
        if (amount >= 10.0) {
            /* Return formatted value. */
            return numeral(amount).format('$0,0.00')
        } else {
            /* Return formatted value. */
            return numeral(amount).format('$0,0.00[0000]')
        }
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

            /* Initialize SDK. */
            const sdk = await getWasmSdk()

            /* Validate user. */
            if (typeof user !== 'undefined' && user !== null) {
                /* Set Identity ID. */
                const identityId = user.identityId

                /* Set Identity ID array. */
                const identityIds = [identityId]

                /* Initialize locals. */
                let dusdBalance
                let dusdContractId
                let sansBalance
                let sansContractId
                let response

                /* Handle network. */
                if (network === 'mainnet') {
                    dusdContractId = DUSD
                    sansContractId = SANS
                } else {
                    dusdContractId = tDUSD
                    sansContractId = tSANS
                }

                /* Request DUSD balance. */
                response = await get_identities_token_balances_with_proof_info(
                    sdk, identityIds, dusdContractId)
// console.log('DUSD BALANCE (response)', response)

                /* Validate response. */
                if (typeof response !== 'undefined' && response !== null && response.data.length > 0) {
                    /* Set DUSD balance. */
                    dusdBalance = BigInt(response.data[0].balance)
console.log('DUSD BALANCE', dusdBalance)

                    /* Save DUSD balance. */
                    setDisplayDusdBalance(dusdBalance)
                }

                /* Request SANS balance. */
                response = await get_identities_token_balances_with_proof_info(
                    sdk, identityIds, sansContractId)
// console.log('SANS BALANCE (response)', response)

                /* Validate response. */
                if (typeof response !== 'undefined' && response !== null && response.data.length > 0) {
                    /* Set SANS balance. */
                    sansBalance = BigInt(response.data[0].balance)
console.log('SANS BALANCE', sansBalance)

                    /* Save SANS balance. */
                    setDisplaySansBalance(sansBalance)
                }

                /* Build AVAILABLE (Platform) assets collection. */
                const assets: Token[] = [
                    {
                        id: '0',
                        token_id_hex: dusdContractId,
                        iconUrl: '/icons/dash.svg',
                        duffs: BigInt(user.balance),
                        decimal_places: DASH_DECIMALS,
                        fiat: {
                            USD: DASH_USD_VALUE * (user.balance / (10 ** DASH_DECIMALS)),
                        },
                    },
                    {
                        id: dusdContractId,
                        token_id_hex: dusdContractId,
                        iconUrl: '/icons/dusd.svg',
                        amount: dusdBalance,
                        decimal_places: DUSD_DECIMALS,
                        fiat: {
                            USD: DUSD_USD_VALUE * (parseFloat(dusdBalance!.toString()) / (10 ** DUSD_DECIMALS)),
                        },
                    },
                    {
                        id: sansContractId,
                        token_id_hex: sansContractId,
                        iconUrl: '/icons/sans.svg',
                        amount: sansBalance,
                        decimal_places: SANS_DECIMALS,
                        fiat: {
                            USD: SANS_USD_VALUE * (parseFloat(sansBalance!.toString()) / (10 ** SANS_DECIMALS)),
                        },
                    },
                ]

                /* Save/update assets. */
                setAssets(assets)
            }
        }

        /* Fetch (async) data. */
        fetchData()
    }, [
        network,
        user,
    ])

    return (
        <main className="flex flex-col gap-5">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 text-center" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('assets')}
                        className="w-1/2 text-sky-600 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium {activeTab === 'assets' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700'}" aria-current="page"
                    >
                        <span className="text-lg">
                            Assets
                        </span>

                        <span className="bg-sky-100 text-sky-600 ml-1 sm:ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium">
                            {assets?.length}
                        </span>
                    </button>

                    <button
                        onClick={() =>
                        setActiveTab('collections')}
                        className="w-1/2 text-gray-500 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium {activeTab === 'collections' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700'}"
                    >
                        <span className="text-lg">
                            Collections
                        </span>

                        <span className="bg-gray-100 text-gray-900 ml-1 sm:ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium">
                            {collections?.length || 0}
                        </span>
                    </button>
                </nav>
            </div>

            {activeTab === 'assets' && <div className="px-1.5 flex flex-col gap-5">
                {assets && assets.map((token) => (
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
            </div>}

            {activeTab !== 'assets' && <div className="flex flex-col gap-5">
                {collections && collections.map((token) => (
                    <div
                        key={token.id}
                        onClick={() => Identity.setAsset(token.id)}
                        className="flex flex-row justify-between items-end pl-1 pr-3 pt-2 pb-1 sm:py-3 bg-gradient-to-b from-sky-100 to-sky-50 border border-sky-300 rounded-lg shadow hover:bg-sky-200 cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-start">
                            <Image
                                src={displayIcon(token)}
                                className="-mt-0.5 mr-1 h-12 w-auto p-2 opacity-80"
                                alt="Display icon"
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
            </div>}
        </main>
    )
}
