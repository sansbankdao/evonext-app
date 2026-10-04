import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import { derive_key_from_seed_with_path } from '@/lib/dash-wasm/compat'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

describe('derive_key_from_seed_with_path (compat wrapper)', () => {
    it('returns the old snake_case shape', () => {
        const k = derive_key_from_seed_with_path(
            MNEMONIC, undefined, `m/9'/1'/5'/0'/0'/0'/0'`, 'testnet')
        expect(k.public_key).toBeTypeOf('string')
        expect(k.public_key).toMatch(/^0[23]/)
        expect(k.private_key_wif).toBeTypeOf('string')
        expect(k.private_key_hex).toBeTypeOf('string')
        expect(k.path).toBe(`m/9'/1'/5'/0'/0'/0'/0'`)
        expect(k.network).toBe('testnet')
    })
})
