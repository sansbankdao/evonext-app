/* Token-id FACT tests — the F53 regression guards.
 *
 * The wallet's DUSD/SANS constants hold PLATFORM v5 TOKEN ids (NOT data
 * contract ids). Every regression this session (the vanished DUSD row,
 * the sendToken crash) traced back to mixing those two id spaces:
 *  - the tDUSD token id 3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz
 *    resolves (getTokenContractInfo, verified live 2026-11-14) to
 *    contract GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23, position 0;
 *  - the mainnet DUSD token id DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd
 *    resolves to contract 8CkcAPokwFdxEu2tUu2VdLTjgK3eeR1wUGJcxhjsWaDz.
 * These KATs pin the derivation DIRECTION and the id identities so any
 * future "helpful" derivation/rename breaks a test instead of the UI. */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import { WasmSdk } from '@/lib/dash-wasm/compat'
import { TokenContractInfo } from '@/lib/dash-wasm/wasm_sdk'
import {
    DUSD_CONTRACT_ID_MAINNET,
    DUSD_CONTRACT_ID_TESTNET,
    SANS_CONTRACT_ID_TESTNET,
    DUSD_DECIMALS,
} from '@/lib/constants'

describe('token-id facts (F53 regression guards)', () => {
    it('derives the tDUSD token id from its contract (the explorer-verified pair)', () => {
        /* testnet: contract GWghYQoD… position 0 → token 3oTHkj8nqn82QkZR…
         * (testnet.platform-explorer.com/token/3oTHkj8nqn82QkZRHkmU…). */
        expect(WasmSdk.calculateTokenIdFromContract(
            'GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23', 0))
            .toBe('3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz')
    })

    it('derives the mainnet DUSD token id from its contract', () => {
        /* mainnet: contract 8CkcAPok… position 0 → token DYqxCsuDgYsEAJ2A…
         * (platform-explorer.com/token/DYqxCsuDgYsEAJ2ADnimkw…). */
        expect(WasmSdk.calculateTokenIdFromContract(
            '8CkcAPokwFdxEu2tUu2VdLTjgK3eeR1wUGJcxhjsWaDz', 0))
            .toBe('DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd')
    })

    it('the DUSD constants ARE token ids (they resolve to their contracts)', () => {
        /* The inverse direction: TokenContractInfo carries the (contract,
         * position) pair for a token id. The constants must remain the
         * TOKEN ids — renaming them to contract ids broke the UI once. */
        const info = TokenContractInfo.fromJSON({
            $formatVersion: '0',
            contractId: 'GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23',
            tokenContractPosition: 0,
        })
        expect(info.contractId.toString())
            .toBe('GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23')
        expect(info.tokenContractPosition).toBe(0)
    })

    it('the DUSD token id is a 32-byte Identifier (base58)', () => {
        /* A balance/transfer call with a NON-32-byte id throws
         * 'Identifier must be 32 bytes long'. */
        const { default: bs58 } = require('bs58')
        expect(bs58.decode(DUSD_CONTRACT_ID_TESTNET).length).toBe(32)
        expect(bs58.decode(DUSD_CONTRACT_ID_MAINNET).length).toBe(32)
        expect(bs58.decode(SANS_CONTRACT_ID_TESTNET).length).toBe(32)
    })

    it('DUSD uses 6 decimals (explorer-verified; a change must be conscious)', () => {
        expect(DUSD_DECIMALS).toBe(6)
    })
})
