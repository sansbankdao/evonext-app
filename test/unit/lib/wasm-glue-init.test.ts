/**
 * F56d regression — LAYER 1: the wasm-glue init mechanism.
 *
 * The production failure ("Cannot read properties of undefined (reading
 * 'wasmsdk_deriveKeyFromSeedWithPath')") happens when the glue's key
 * derivation is used BEFORE the glue's init() loads the wasm module — the
 * glue's internal `wasm` reference is undefined. This file pins the exact
 * failure signature AND the recovery (the module load → the derive works).
 *
 * NOTE: test/setup.ts mocks this module globally with EMPTY stubs; the
 * file-level override restores the REAL glue (the compat-derive pattern).
 * The initSync happens in the SECOND test so the first observes the raw
 * pre-init state.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    return await importOriginal<any>()
})

import { WasmSdk, PrivateKey, initSync } from '@/lib/dash-wasm/wasm_sdk.js'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

describe('the wasm-glue init mechanism', () => {
    it('throws the EXACT production error when the module is not loaded', () => {
        let caught = ''
        try {
            WasmSdk.deriveKeyFromSeedWithPath({
                mnemonic: MNEMONIC,
                path: `m/9'/1'/5'/0'/0'/0'/0'`,
                network: 'testnet',
            })
        } catch (e: any) {
            caught = String(e?.message ?? e)
        }
        expect(caught).toContain('Cannot read properties of undefined')
        expect(caught).toContain('wasmsdk_deriveKeyFromSeedWithPath')
    })

    it('derives successfully once the module IS loaded', () => {
        initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
        const info: any = WasmSdk.deriveKeyFromSeedWithPath({
            mnemonic: MNEMONIC,
            path: `m/9'/1'/5'/0'/0'/0'/0'`,
            network: 'testnet',
        })
        expect(String(info.public_key ?? info.publicKey ?? '')).toMatch(/^0[23]/)
    })

    /* F56g — the PRIVATE-KEY LOGIN crash: PrivateKey.fromWIF ran before the
     * module load on the connect page ("reading '__wbindgen_malloc'"). The
     * module IS loaded by the earlier test in this file, so pin the working
     * side here; the PRE-init failure signature is identical to the derive
     * one above (the same undefined `wasm` reference) and is exercised by
     * the order guard in private-key-login.test.ts. */
    it('decodes a WIF once the module IS loaded (the private-key login path)', () => {
        /* A throwaway key generated on the spot (no secret material) — the
         * WIF round-trip pins the fromWIF decode the login uses. */
        const wif = PrivateKey.fromHex('11'.repeat(32), 'testnet').toWIF()
        const pk = PrivateKey.fromWIF(wif)
        expect(pk.getPublicKeyHash()).toMatch(/^[0-9a-f]{40}$/)
        expect(pk.toWIF()).toBe(wif)
    })
})
