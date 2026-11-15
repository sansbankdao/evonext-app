/* lib/wallet-assets.ts
 * The Available-assets row builder, extracted from components/wallet/
 * assets.tsx verbatim (F53b) so the ROW CONTRACT has unit tests: the
 * Transparent ('0') and Shielded ('shielded') rows are ALWAYS present
 * (even at zero — F45), and the DUSD/SANS rows appear only when a real
 * token balance was read. The DUSD/SANS ids are PLATFORM v5 TOKEN ids
 * (verified live 2026-11-14: the tDUSD token id 3oTHkj8nqn82QkZRHkmU…
 * resolves via getTokenContractInfo to contract GWghYQoD…, position 0,
 * 6 decimals; mainnet DUSD DYqxCsuD… → contract 8CkcAPok…). */

import {
    DUSD_CONTRACT_ID_MAINNET,
    DUSD_CONTRACT_ID_TESTNET,
    DUSD_DECIMALS,
    DUSD_USD_VALUE,
    SANS_CONTRACT_ID_MAINNET,
    SANS_CONTRACT_ID_TESTNET,
    SANS_DECIMALS,
    SANS_USD_VALUE,
    DASH_DECIMALS,
} from './constants'
import type { IToken } from './types'

export interface AvailableAssetInput {
    network: string | null
    /* The DASH/USD spot price (the dashswap ticker). */
    dashUsdValue: number
    /* The DIP-17 Platform-address pool balance (the Transparent row). */
    platformCredits: bigint | null
    /* The Orchard pool balance (the Shielded row; null before a scan). */
    shieldedCredits: bigint | null
    /* Raw token balances (atomic units) — undefined/null = no row. */
    dusdBalance?: bigint | null
    sansBalance?: bigint | null
}

export function buildAvailableAssets(input: AvailableAssetInput): IToken[] {
    const { network, dashUsdValue, platformCredits, shieldedCredits, dusdBalance, sansBalance } = input

    /* network is null before the provider resolves — the testnet pair is
     * the default (assets.tsx's original ternary behaved identically). */
    const dusdContractId = network === 'mainnet' ? DUSD_CONTRACT_ID_MAINNET : DUSD_CONTRACT_ID_TESTNET
    const sansContractId = network === 'mainnet' ? SANS_CONTRACT_ID_MAINNET : SANS_CONTRACT_ID_TESTNET

    /* Build AVAILABLE (Platform) assets collection — the mobile-parity
     * balance model: Transparent (identity credits) + Shielded (the
     * Orchard pool), then tokens.
     * F56e: null balance = STILL LOADING → the row carries loading=true
     * and the UI shows a skeleton; 0n = a REAL zero. */
    /* The '0' row shows the DIP-17 Platform-address pool balance (the
     * REAL Transparent figure — NOT the identity balance, which lives
     * under the dashboard card). */
    const assets: IToken[] = [{
        id: '0',
        name: 'Transparent',
        ticker: 'DASH',
        token_id_hex: dusdContractId,
        iconUrl: '/icons/dash.svg',
        amount: platformCredits ?? 0n,
        loading: platformCredits === null,
        decimal_places: DASH_DECIMALS,
        fiat: {
            USD: dashUsdValue * (Number(platformCredits ?? 0n) / (10 ** DASH_DECIMALS)),
        },
    }]

    /* Shielded row — ALWAYS present (even at ZERO, before the worker scan
     * lands), right after Transparent. */
    assets.push({
        id: 'shielded',
        name: 'Shielded',
        ticker: 'DASH',
        token_id_hex: dusdContractId,
        iconUrl: '/icons/dash.svg',
        amount: shieldedCredits ?? 0n,
        loading: shieldedCredits === null,
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

    return assets
}

/* ---------------------------------------------------------------------------
 * F56e — the shared DASH/USD price cache (the F37b pattern): the ticker
 * fetch on a SLOW connection hung the Send panel FOREVER (no timeout, no
 * catch — the DUSD branch used a constant and worked, the DASH branch hung).
 * The price now reads from the cache first and refreshes non-fatally. */
const DASH_PRICE_CACHE_KEY = 'evonext_dash_usd'
const DASH_PRICE_TTL_MS = 10 * 60 * 1000

export function readCachedDashPrice(): number | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(DASH_PRICE_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { price: number; at: number }
        if (typeof parsed.price !== 'number' || Date.now() - parsed.at > DASH_PRICE_TTL_MS) return null
        return parsed.price
    } catch {
        return null
    }
}

export function writeCachedDashPrice(price: number): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(DASH_PRICE_CACHE_KEY, JSON.stringify({ price, at: Date.now() }))
    } catch { /* private mode */ }
}
