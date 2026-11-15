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
import { buildAvailableAssets } from '../../lib/wallet-assets'
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
import { wasmSdkService, getWasmSdk } from '@/lib/services/wasm-sdk-service'
import { shieldedEngine, persistedShieldedBalance } from '@/lib/shielded/engine-client'
import { readCachedDashPrice, writeCachedDashPrice } from '@/lib/wallet-assets'
import { fetchPlatformAddressBalance } from '@/lib/platform-address'

interface WalletAssetProps {
    isFullScreen: boolean;
    /* The Shielded row opens the full-screen shielded wallet (the wallet
     * page owns the show/hide state). */
    onOpenShielded?: () => void;
    /* F56c — the SELECTED asset (lifted to the wallet page so the Total
     * card's icon reflects it) + the click handler. The selected row is
     * HIGHLIGHTED (the owner directive: "so i know it has been selected"). */
    selectedAsset?: IToken | null;
    onSelectAsset?: (asset: IToken) => void;
}

export function WalletAssets({ isFullScreen, onOpenShielded, selectedAsset, onSelectAsset }: WalletAssetProps) {
    const { user } = useAuth()
    const { network } = useNetwork()

    const [activeTab, setActiveTab] = useState('assets')
    const [asset, setAsset] = useState<IToken>()
    const [assets, setAssets] = useState<IToken[]>([DEFAULT_ASSET])
    const [collections, setCollections] = useState<IToken[]>()

    const [displayDusdBalance, setDisplayDusdBalance] = useState<bigint | null>(null)
    const [displayDusdBalanceUsd, setDisplayDusdBalanceUsd] = useState(BigInt(0))
    const [displaySansBalance, setDisplaySansBalance] = useState<bigint | null>(null)
    const [displaySansBalanceUsd, setDisplaySansBalanceUsd] = useState(BigInt(0))

    /* The Shielded row's balance — the note scan runs in the SHIELDED
     * ENGINE WEB WORKER (lib/shielded/engine-worker.ts), so the main thread
     * never blocks on the per-note curve math (the F43 wallet hang). The
     * row first shows the PERSISTED balance instantly, then the scan
     * refines it. Skipped without a session phrase. */
    const [shieldedCredits, setShieldedCredits] = useState<bigint | null>(null)

    /* The Transparent row's balance — the REAL DIP-17 Platform-address
     * pool (L2), NEVER the identity balance (owner directive: the identity
     * balance lives under the dashboard card; no Core (L1) balance is ever
     * displayed). Bounded + retried like the shielded scan (the wasm
     * request-timeout can leave a query pending FOREVER — F30). */
    const [platformCredits, setPlatformCredits] = useState<bigint | null>(null)
    /* F56e — the price state (the token balances = the existing display
     * states above, now bigint|null so null = not-yet-read). */
    const [dashPrice, setDashPrice] = useState<number>(0)

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
                    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
                    /* The main-thread SDK service must be live for the
                     * token + platform-address queries — NOTHING else
                     * initializes it on this page since the shielded scan
                     * moved into the worker (F44). initialize() no-ops on
                     * a matching config; re-inits on a network mismatch
                     * (F37 gotcha). */
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
                                `platform-address balance (attempt ${attempt + 1})`)
                            if (!cancelled) setPlatformCredits(credits)
                            return
                        } catch (err: any) {
                            if (cancelled) return
                            console.error(`platform-address scan attempt ${attempt + 1} failed:`, err?.message)
                            await sleep(5000)
                        }
                    }
                } catch (err: any) {
                    /* The row simply shows zero — never block the list. */
                    console.error('platform-address balance failed:', err?.message)
                }
            })()
            return () => { cancelled = true }
        }
    }, [network, user])

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

        /* Handle UI (value) formatting. The Transparent ('0') row carries
         * its balance in `amount` (credits) like every other row — the
         * former duffs/identity-balance branch is gone (owner directive:
         * Transparent = the Platform-address pool balance). */
        decimalValue = BigInt(_token.amount ?? 0) * BigInt(1e4)

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
            /* Lift to the wallet page (the Total card's icon + the
             * highlight); the page also stores it for the Send panel. */
            setAsset(asset)
            storeAsset(asset)
            onSelectAsset?.(asset)
        }
    }

    /* F56e — EACH BALANCE LOADS INDEPENDENTLY. The old fetchData ran a
     * SERIAL chain (the DUSD read → the SANS read → an UNGUARDED ticker
     * fetch → the ONE build at the end): any slow step left every row at
     * zero, and on a slow connection the ticker fetch hung the build
     * FOREVER. Now each read is its own fire-and-forget task that sets its
     * own state, and the rows REBUILD incrementally as each lands. The
     * DASH/USD price comes from the shared cache first (instant) and
     * refreshes non-fatally with an 8s timeout. */
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const {
                get_identities_token_balances_with_proof_info,
            } = await import('../../lib/dash-wasm/compat')

            /* The SDK init + the token reads (the wasm is needed for these
             * two; the Transparent/Shielded rows load in their OWN effects). */
            const sdk = await getWasmSdk()

            if (typeof user !== 'undefined' && user !== null) {
                const identityIds = [user.identityId]
                const dusdContractId = network === 'mainnet' ? DUSD_CONTRACT_ID_MAINNET : DUSD_CONTRACT_ID_TESTNET
                const sansContractId = network === 'mainnet' ? SANS_CONTRACT_ID_MAINNET : SANS_CONTRACT_ID_TESTNET

                /* DUSD task. */
                void (async () => {
                    try {
                        const response = await get_identities_token_balances_with_proof_info(
                            sdk, identityIds, dusdContractId)
                        if (!cancelled && response !== undefined && response !== null && response.data.length > 0) {
                            setDisplayDusdBalance(BigInt(response.data[0].balance))
                        }
                    } catch (err: any) {
                        console.error('DUSD balance read failed:', err?.message)
                    }
                })()

                /* SANS task (independent). */
                void (async () => {
                    try {
                        const response = await get_identities_token_balances_with_proof_info(
                            sdk, identityIds, sansContractId)
                        if (!cancelled && response !== undefined && response !== null && response.data.length > 0) {
                            setDisplaySansBalance(BigInt(response.data[0].balance))
                        }
                    } catch (err: any) {
                        console.error('SANS balance read failed:', err?.message)
                    }
                })()
            }
        })()

        /* The price task: the CACHE first (instant), then a NON-FATAL
         * refresh with an 8s timeout — never blocks anything. */
        setDashPrice(readCachedDashPrice() ?? 0)
        void (async () => {
            try {
                const ctrl = new AbortController()
                const timer = setTimeout(() => ctrl.abort(), 8000)
                const response = await fetch('https://dashswap.xyz/v1/ticker/DASH', { signal: ctrl.signal })
                clearTimeout(timer)
                const ticker = await response.json()
                const price = Number(ticker?.quote?.USD?.price ?? 0)
                if (!cancelled && price > 0) {
                    setDashPrice(price)
                    writeCachedDashPrice(price)
                }
            } catch { /* keep the cached price — never fatal */ }
        })()
    }, [network, user])

    /* The rows REBUILD incrementally as each independent balance lands. */
    useEffect(() => {
        const dusdBalance = displayDusdBalance
        const sansBalance = displaySansBalance
        const dashUsdValue = dashPrice || 0

        const assets = buildAvailableAssets({
            network,
            dashUsdValue,
            platformCredits,
            shieldedCredits,
            dusdBalance: dusdBalance === null ? undefined : dusdBalance,
            sansBalance: sansBalance === null ? undefined : sansBalance,
        })

        setAssets(assets)
    }, [
        network,
        platformCredits,
        shieldedCredits,
        displayDusdBalance,
        displaySansBalance,
        dashPrice,
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
                        className={`flex flex-row justify-between items-center pl-2.5 pr-3 py-2.5 sm:py-3 bg-gradient-to-br rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-pointer ${selectedAsset?.id === token.id
                            ? 'from-sky-100 via-sky-200/80 to-sky-300 border-2 border-sky-500 ring-2 ring-sky-300/60'
                            : 'from-white via-sky-50/80 to-sky-100 border border-sky-200 hover:border-sky-400'}`}
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

                                {token.loading ? <>
                                    <span className="sm:hidden inline-block h-5 w-20 rounded bg-sky-200/80 animate-pulse" />
                                    <span className="hidden sm:inline-block h-5 w-24 rounded bg-sky-200/80 animate-pulse" />
                                </> : <>
                                    <span className="sm:hidden text-lg font-medium text-sky-600">
                                        {displayDecimalAmount(token)}
                                    </span>
                                    <span className="hidden sm:flex text-xl font-medium text-sky-600">
                                        {displayDecimalAmount(token)}
                                    </span>
                                </>}
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-sky-700">
                            {token.loading ? (
                                <span className="mt-2 inline-block h-6 w-24 rounded bg-sky-200/80 animate-pulse" />
                            ) : (<>
                                <sup className="text-xs">
                                    USD
                                </sup>

                                <span className="-mt-3 sm:hidden text-2xl">
                                    {displayDecimalAmountUsd(token)}
                                </span>
                                <span className="-mt-3 hidden sm:flex text-3xl">
                                    {displayDecimalAmountUsd(token)}
                                </span>
                            </>)}
                        </h3>
                    </div>
                ))}
            </div>}

            {activeTab !== 'assets' && <div className="flex flex-col gap-5">
                {collections && collections.map((token) => (
                    <div
                        key={token.id}
                        onClick={() => handleActiveAsset(token.id)}
                        className={`flex flex-row justify-between items-center pl-2.5 pr-3 py-2.5 sm:py-3 bg-gradient-to-br rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-pointer ${selectedAsset?.id === token.id
                            ? 'from-sky-100 via-sky-200/80 to-sky-300 border-2 border-sky-500 ring-2 ring-sky-300/60'
                            : 'from-white via-sky-50/80 to-sky-100 border border-sky-200 hover:border-sky-400'}`}
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

                                {token.loading ? <>
                                    <span className="sm:hidden inline-block h-5 w-20 rounded bg-sky-200/80 animate-pulse" />
                                    <span className="hidden sm:inline-block h-5 w-24 rounded bg-sky-200/80 animate-pulse" />
                                </> : <>
                                    <span className="sm:hidden text-lg font-medium text-sky-600">
                                        {displayDecimalAmount(token)}
                                    </span>
                                    <span className="hidden sm:flex text-xl font-medium text-sky-600">
                                        {displayDecimalAmount(token)}
                                    </span>
                                </>}
                            </div>
                        </div>

                        <h3 className="w-1/2 flex flex-col items-end font-medium text-sky-700">
                            {token.loading ? (
                                <span className="mt-2 inline-block h-6 w-24 rounded bg-sky-200/80 animate-pulse" />
                            ) : (<>
                                <sup className="text-xs">
                                    USD
                                </sup>

                                <span className="-mt-3 sm:hidden text-2xl">
                                    {displayDecimalAmountUsd(token)}
                                </span>
                                <span className="-mt-3 hidden sm:flex text-3xl">
                                    {displayDecimalAmountUsd(token)}
                                </span>
                            </>)}
                        </h3>
                    </div>
                ))}
            </div>}
        </main>
    )
}
