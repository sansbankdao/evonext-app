'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BoltIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/24/outline'
// @ts-ignore
import numeral from 'numeral'

import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { IToken } from '@/lib/types'
import {
    DEFAULT_ASSET,
    DASH_DECIMALS,

    DUSD_CONTRACT_ID_MAINNET,
    DUSD_CONTRACT_ID_TESTNET,
    DUSD_DECIMALS,
    DUSD_USD_VALUE,

    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,

    SANS_CONTRACT_ID_MAINNET,
    SANS_CONTRACT_ID_TESTNET,
    SANS_DECIMALS,
    SANS_USD_VALUE,
} from '@/lib/constants'
import {
    getAsset,
    getIdentityIdx,
    getMnemonic,
    storeAsset,
    storeIdentityIdx,
} from '@/lib/secure-storage'
import { getWasmSdk } from '@/lib/services/wasm-sdk-service'
import { shieldedEngine, persistedShieldedBalance } from '@/lib/shielded/engine-client'

interface WalletAssetProps {
    isFullScreen: boolean;
    /* The Shielded row opens the full-screen shielded wallet (the wallet
     * page owns the show/hide state). */
    onOpenShielded?: () => void;
}

export function WalletAssets({ isFullScreen, onOpenShielded }: WalletAssetProps) {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [activeTab, setActiveTab] = useState('assets')
    const [asset, setAsset] = useState<IToken>()
    const [assets, setAssets] = useState<IToken[]>([DEFAULT_ASSET])
    const [collections, setCollections] = useState<IToken[]>()

    const [displayDusdBalance, setDisplayDusdBalance] = useState(BigInt(0))
    const [displayDusdBalanceUsd, setDisplayDusdBalanceUsd] = useState(BigInt(0))
    const [displaySansBalance, setDisplaySansBalance] = useState(BigInt(0))
    const [displaySansBalanceUsd, setDisplaySansBalanceUsd] = useState(BigInt(0))

    /* The Shielded row's balance — the note scan runs in the SHIELDED
     * ENGINE WEB WORKER (lib/shielded/engine-worker.ts), so the main thread
     * never blocks on the per-note curve math (the F43 wallet hang). The
     * row first shows the PERSISTED balance instantly, then the scan
     * refines it. Skipped without a session phrase. */
    const [shieldedCredits, setShieldedCredits] = useState<bigint | null>(null)

    useEffect(() => {
        if (typeof user !== 'undefined' && user !== null) {
            let cancelled = false
            ;(async () => {
                try {
                    const mnemonic = getMnemonic()
                    if (!mnemonic) return
                    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                    /* Instant seed from the persisted state (last known
                     * balance) — the scan then refreshes it. */
                    const persisted = persistedShieldedBalance(sdkNetwork)
                    if (persisted !== null && !cancelled) setShieldedCredits(persisted)

                    await shieldedEngine.start({ network: sdkNetwork, mnemonic })
                    const snapshot = await shieldedEngine.runScan()
                    if (!cancelled) setShieldedCredits(BigInt(snapshot.balance))
                } catch (err: any) {
                    /* The row simply shows no balance — never block the list. */
                    console.error('shielded asset scan failed:', err?.message)
                }
            })()
            return () => { cancelled = true }
        }
    }, [network, user])

    const displayIcon = (_token: IToken) => {
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
            return 'Transparent'
        case 'shielded':
            return 'Shielded'
        case DUSD_CONTRACT_ID_MAINNET:
        case DUSD_CONTRACT_ID_TESTNET:
            return 'USD'
        case SANS_CONTRACT_ID_MAINNET:
        case SANS_CONTRACT_ID_TESTNET:
            return 'Sansnote'
        default:
            return 'Unknown token'
        }
    }

    const displayDecimalAmount = (_token: IToken) => {
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

    const displayDecimalAmountUsd = (_token: IToken) => {
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

    }

    /* Set active asset (coin OR collectible). */
    const handleActiveAsset = (_tokenid: string) => {
        const asset = assets.find(_asset => {
            return _asset.id === _tokenid
        })
        /* Validate asset. */
        if (typeof asset !== 'undefined' && asset !== null) {
            /* Set (local) asset. */
            setAsset(asset)

            /* Store (in-browser) asset. */
            storeAsset(asset)
        }
    }

    useEffect(() => {
        async function fetchData() {
            const {
                // get_identity_balance_with_proof_info,
                get_identities_token_balances_with_proof_info,
                // get_identities_token_infos_with_proof_info,
            } = await import('../../lib/dash-wasm/compat')

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
                    dusdContractId = DUSD_CONTRACT_ID_MAINNET
                    sansContractId = SANS_CONTRACT_ID_MAINNET
                } else {
                    dusdContractId = DUSD_CONTRACT_ID_TESTNET
                    sansContractId = SANS_CONTRACT_ID_TESTNET
                }

                /* Request DUSD balance. */
                response = await get_identities_token_balances_with_proof_info(
                    sdk, identityIds, dusdContractId)
// console.log('DUSD BALANCE (response)', response)

                /* Validate response. */
                if (typeof response !== 'undefined' && response !== null && response.data.length > 0) {
                    /* Set DUSD balance. */
                    dusdBalance = BigInt(response.data[0].balance)

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

                    /* Save SANS balance. */
                    setDisplaySansBalance(sansBalance)
                }

// FIXME FOR DEV PURPOSES ONLY
                const ENDPOINT = 'https://dashswap.xyz/v1/ticker/DASH'
                response = await fetch(ENDPOINT)
                const ticker = await response.json()
                const dashUsdValue = ticker.quote.USD.price

                /* Build AVAILABLE (Platform) assets collection — the
                 * mobile-parity balance model: Transparent (identity
                 * credits) + Shielded (the Orchard pool), then tokens. */
                const assets: IToken[] = [{
                    id: '0',
                    name: 'Transparent',
                    ticker: 'DASH',
                    token_id_hex: dusdContractId,
                    iconUrl: '/icons/dash.svg',
                    duffs: BigInt(user.balance),
                    decimal_places: DASH_DECIMALS,
                    fiat: {
                        USD: dashUsdValue * (user.balance / (10 ** DASH_DECIMALS)),
                    },
                }]

                /* Shielded row — ALWAYS present (even at ZERO, before the
                 * worker scan lands), right after Transparent. */
                assets.push({
                    id: 'shielded',
                    name: 'Shielded',
                    ticker: 'DASH',
                    token_id_hex: dusdContractId,
                    iconUrl: '/icons/dash.svg',
                    amount: shieldedCredits ?? 0n,
                    decimal_places: DASH_DECIMALS,
                    fiat: {
                        USD: dashUsdValue * (Number(shieldedCredits ?? 0n) / (10 ** DASH_DECIMALS)),
                    },
                })

                /* Validate DUSD balance. */
                if (typeof dusdBalance !== 'undefined' && dusdBalance !== null) {
                    assets.push({
                        id: dusdContractId,
                        name: 'USD',
                        ticker: 'DUSD',
                        token_id_hex: dusdContractId,
                        iconUrl: '/icons/usd.svg',
                        amount: dusdBalance,
                        decimal_places: DUSD_DECIMALS,
                        fiat: {
                            USD: DUSD_USD_VALUE * (parseFloat(dusdBalance!.toString()) / (10 ** DUSD_DECIMALS)),
                        },
                    })
                }

                /* Validate SANS balance. */
                if (typeof sansBalance !== 'undefined' && sansBalance !== null) {
                    assets.push({
                        id: sansContractId,
                        name: 'Sansnote',
                        ticker: 'SANS',
                        token_id_hex: sansContractId,
                        iconUrl: '/icons/sans.svg',
                        amount: sansBalance,
                        decimal_places: SANS_DECIMALS,
                        fiat: {
                            USD: SANS_USD_VALUE * (parseFloat(sansBalance!.toString()) / (10 ** SANS_DECIMALS)),
                        },
                    })
                }

                /* Save/update assets. */
                setAssets(assets)
            }
        }

        /* Fetch (async) data. Re-runs when the shielded scan lands so the
         * Shielded row appears with its balance. */
        fetchData()
    }, [
        network,
        user,
        shieldedCredits,
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

            {activeTab === 'assets' && <div className="flex flex-col gap-5">
                {assets && assets.map((token) => (
                    <div
                        key={token.id}
                        onClick={() => {
                            /* The Shielded row opens the full-screen shielded
                             * wallet; regular assets select. */
                            if (token.id === 'shielded') {
                                onOpenShielded?.()
                                return
                            }
                            handleActiveAsset(token.id)
                        }}
                        className="flex flex-row justify-between items-center pl-2.5 pr-3 py-2.5 sm:py-3 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 border border-sky-200 rounded-2xl shadow-sm hover:border-sky-400 hover:shadow-md hover:-translate-y-px transition-all cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-center gap-2.5">
                            {/* Icon tile: bordered, shaded mark. BOTH the
                                Transparent and Shielded rows carry the DASH
                                logo — the Shielded row adds a small shield
                                badge ('transparent' and 'shielded' are BOTH
                                ticker DASH; mobile parity). */}
                            <div className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center rounded-xl bg-white border border-sky-200 shadow-sm">
                                <Image
                                    src={displayIcon(token)}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                    alt="Asset icon"
                                    width={0}
                                    height={0}
                                />
                                {token.id === 'shielded' && (
                                    <ShieldCheckIcon className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border border-sky-300 p-[2px] text-sky-600 shadow-sm" />
                                )}
                            </div>

                            <div className="flex flex-col">
                                <h3 className="text-base text-sky-900 font-semibold uppercase truncate">
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
                        onClick={() => handleActiveAsset(token.id)}
                        className="flex flex-row justify-between items-center pl-2.5 pr-3 py-2.5 sm:py-3 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 border border-sky-200 rounded-2xl shadow-sm hover:border-sky-400 hover:shadow-md hover:-translate-y-px transition-all cursor-pointer"
                    >
                        <div className="w-1/2 flex flex-row items-center gap-2.5">
                            <div className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center rounded-xl bg-white border border-sky-200 shadow-sm">
                                <Image
                                    src={displayIcon(token)}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                    alt="Display icon"
                                    width={0}
                                    height={0}
                                />
                            </div>

                            <div className="flex flex-col">
                                <h3 className="text-base text-sky-900 font-semibold uppercase truncate">
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
