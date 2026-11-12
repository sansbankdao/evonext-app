// test/e2e/shield-stage3b-verify.live.mts

/* LIVE E2E Stage 3b — DEFINITIVE execution proof for the shield:
 * walk the full encrypted-note tree and trial-decrypt with MY ivk. Finding
 * my note (recipient + 1e9 credits + memo) is cryptographic proof that the
 * shield transition executed. Saves note index/cmx/rho/rseed for the
 * transfer witness (stage 4). */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'
import { mnemonicToSeedSync } from '@scure/bip39'
import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveDkOvk,
    diversifierAtIndex, deriveAddressBytes, ivkFromFvk,
} from '@/lib/shielded/keys'
import { tryDecryptNoteWireWithMemo, type ShieldedEncryptedNoteWire } from '@/lib/shielded/note'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const STATE_PATH = join(process.cwd(), 'scratch-shield-state.json')
const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

describe('LIVE testnet shield — tree/trial-decrypt verification', () => {
    it('finds my shielded note in the on-chain tree', async () => {
        const st = JSON.parse(readFileSync(STATE_PATH, 'utf8'))

        const seed = mnemonicToSeedSync(MNEMONIC)
        const sk = spendingKeyFromSeed(seed, 1, 0)
        const fvk = fullViewingKeyFromSpendingKey(sk)
        const { dk } = deriveDkOvk(fvk)
        const d = diversifierAtIndex(dk, 0)
        const ivk = ivkFromFvk(fvk)
        const myRecipient = hexOf(deriveAddressBytes(ivk, d))

        const ctx = await wasm.WasmTrustedContext.prefetchTestnet()
        const sdk = wasm.WasmSdkBuilder.testnet().withTrustedContext(ctx).build()

        const all: ShieldedEncryptedNoteWire[] = []
        for (let start = 0n; ; start += 2048n) {
            const chunk = await sdk.getShieldedEncryptedNotes(start, 2048)
            for (const n of chunk as any[]) {
                all.push({ cmx: n.cmx, nullifier: n.nullifier, encryptedNote: n.encryptedNote })
            }
            console.log(`fetched chunk @${start}: ${chunk.length} (total ${all.length})`)
            if (chunk.length < 2048) break
        }

        let found = -1
        let plain: ReturnType<typeof tryDecryptNoteWireWithMemo> = null
        for (let i = 0; i < all.length; i++) {
            const p = tryDecryptNoteWireWithMemo(ivk, all[i])
            if (p && hexOf(p.address) === myRecipient) { found = i; plain = p; break }
        }

        expect(found).toBeGreaterThanOrEqual(0)
        const memoText = new TextDecoder().decode(plain!.memo.slice(4)).replace(/\0+$/g, '')
        console.log('=== MY NOTE FOUND ===')
        console.log('tree index:', found, 'of', all.length)
        console.log('cmx:', hexOf(all[found].cmx))
        console.log('nullifier:', hexOf(all[found].nullifier))
        console.log('value:', plain!.note.v.toString(), 'credits')
        console.log('memo:', JSON.stringify(memoText))
        expect(plain!.note.v).toBe(BigInt(st.shieldCredits))
        expect(memoText).toBe('evonext e2e shield')

        Object.assign(st, {
            stage: 'execution-proved', treeNoteCount: all.length,
            myNote: {
                index: found, cmx: hexOf(all[found].cmx), nullifier: hexOf(all[found].nullifier),
                d: hexOf(plain!.note.d), v: plain!.note.v.toString(), rho: hexOf(plain!.note.rho),
                rseed: hexOf(plain!.note.rseed), memo: memoText,
            },
        })
        writeFileSync(STATE_PATH, JSON.stringify(st, null, 2))
        console.log('STATE SAVED — execution cryptographically proved')
    }, 600000)
})
