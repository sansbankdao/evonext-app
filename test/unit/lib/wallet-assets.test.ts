/* Asset-row CONTRACT tests — the F53a regression guards.
 *
 * The F53a incident: an attempted "fix" of the DUSD balance query (a
 * derived-token-id read) returned empty balances, and the DUSD/SANS rows
 * silently VANISHED from the wallet. These tests pin the row contract of
 * buildAvailableAssets (the pure builder extracted from
 * components/wallet/assets.tsx):
 *  - the Transparent ('0') and Shielded ('shielded') rows are ALWAYS
 *    present, even at zero (the F45 directive);
 *  - the DUSD row appears only with a balance, keyed by the TOKEN id
 *    (3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz on testnet — NOT a
 *    contract id), with 6 decimals;
 *  - the SANS row likewise (8-decimal, Sansnote);
 *  - no phantom rows when balances are missing. */
import { describe, it, expect } from 'vitest'
import { buildAvailableAssets } from '@/lib/wallet-assets'
import {
    DUSD_CONTRACT_ID_TESTNET,
    SANS_CONTRACT_ID_TESTNET,
    DUSD_CONTRACT_ID_MAINNET,
} from '@/lib/constants'

const BASE = {
    network: 'testnet',
    dashUsdValue: 40,
    platformCredits: 17_624_082_724n,
    shieldedCredits: 131_100_000n,
}

describe('buildAvailableAssets (F53a regression guards)', () => {
    it('ALWAYS renders the Transparent and Shielded rows, even at zero', () => {
        const rows = buildAvailableAssets({
            ...BASE,
            platformCredits: null,
            shieldedCredits: null,
            dusdBalance: undefined,
            sansBalance: undefined,
        })
        expect(rows.map((r) => r.id)).toEqual(['0', 'shielded'])
        expect(rows[0].amount).toBe(0n)
        expect(rows[1].amount).toBe(0n)
    })

    it('renders the DUSD row with a balance, keyed by the TOKEN id, 6 decimals', () => {
        const rows = buildAvailableAssets({
            ...BASE,
            dusdBalance: 15_000_000n, /* 15 DUSD at 6 decimals */
            sansBalance: undefined,
        })
        const dusd = rows.find((r) => r.ticker === 'DUSD')
        expect(dusd).toBeDefined()
        expect(dusd!.id).toBe(DUSD_CONTRACT_ID_TESTNET)
        expect(dusd!.decimal_places).toBe(6)
        expect(dusd!.amount).toBe(15_000_000n)
        /* The USD figure: 15 DUSD at the constant's USD value. */
        expect(dusd!.fiat.USD).toBeGreaterThan(0)
    })

    it('renders the SANS row with a balance, keyed by its TOKEN id', () => {
        const rows = buildAvailableAssets({
            ...BASE,
            sansBalance: 1_000_000_000n,
        })
        const sans = rows.find((r) => r.ticker === 'SANS')
        expect(sans).toBeDefined()
        expect(sans!.id).toBe(SANS_CONTRACT_ID_TESTNET)
        expect(sans!.decimal_places).toBe(8)
    })

    it('renders NO phantom DUSD/SANS rows when balances are missing', () => {
        const rows = buildAvailableAssets({
            ...BASE,
            dusdBalance: undefined,
            sansBalance: undefined,
        })
        expect(rows.find((r) => r.ticker === 'DUSD')).toBeUndefined()
        expect(rows.find((r) => r.ticker === 'SANS')).toBeUndefined()
        expect(rows.length).toBe(2)
    })

    it('uses the MAINNET DUSD token id on mainnet', () => {
        const rows = buildAvailableAssets({
            ...BASE,
            network: 'mainnet',
            dusdBalance: 1n,
        })
        const dusd = rows.find((r) => r.ticker === 'DUSD')
        expect(dusd!.id).toBe(DUSD_CONTRACT_ID_MAINNET)
    })

    it('carries real balances into the Transparent/Shielded USD figures', () => {
        const rows = buildAvailableAssets(BASE)
        expect(rows[0].amount).toBe(17_624_082_724n)
        expect(rows[1].amount).toBe(131_100_000n)
        expect(rows[0].fiat.USD).toBeCloseTo(40 * 0.17624082724, 6)
    })
})
