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
     * Orchard pool), then tokens. */
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
