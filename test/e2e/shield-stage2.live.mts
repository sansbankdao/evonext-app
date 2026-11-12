// test/e2e/shield-stage2.live.mts

/* LIVE E2E Stage 2 — testnet SHIELD from asset lock:
 * derive recipient -> build output-only PCZT -> live prover -> assemble ->
 * broadcast -> wait for execution proof. Requires scratch-shield-state.json
 * at repo root with stage 'chainlocked' (asset lock already confirmed +
 * chainlocked). Real network + real funds — run ONLY via
 *   pnpm vitest run --config test/e2e/vitest.live.config.mts shield-stage2 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomFillSync } from 'node:crypto'

/* Real wasm (initSync) — overrides the global setup mock, same pattern as
 * shielded-assemble.test.mts. */
vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'
import { mnemonicToSeedSync } from '@scure/bip39'
import bs58 from 'bs58'
import { buildOutputOnlyPczt, postPcztFrame, PROVER_BASE_URL } from '@/lib/shielded/prove'
import { serializePcztFrame } from '@/lib/shielded/pczt-wire'
import { shieldFromAssetLockExtraSighashData } from '@/lib/shielded/bundle'
import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveDkOvk,
    diversifierAtIndex, deriveAddressBytes, ivkFromFvk,
} from '@/lib/shielded/keys'
import { assembleShieldFromAssetLock } from '@/lib/shielded/assemble'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const STATE_PATH = join(process.cwd(), 'scratch-shield-state.json')

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/* test/setup.ts mocks window.crypto with getRandomValues: (a) => a (zeroed
 * arrays) — pass REAL randomness explicitly to build + assemble. */
const realRand = (n: number) => { const b = new Uint8Array(n); randomFillSync(b); return b }

describe('LIVE testnet shield-from-asset-lock', () => {
    it('builds, proves, assembles and broadcasts the shield transition', async () => {
        const st = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
        expect(st.stage).toBe('chainlocked')
        console.log('lock:', st.lockTxid, 'block', st.lockBlockHeight,
            'platform chainlocked height', st.platformChainLockedHeight)

        /* 1. My shielded recipient (self-shield, ZIP-32 coin_type 1 = testnet). */
        const seed = mnemonicToSeedSync(MNEMONIC)
        const sk = spendingKeyFromSeed(seed, 1, 0)
        const fvk = fullViewingKeyFromSpendingKey(sk)
        const { dk, ovk } = deriveDkOvk(fvk)
        const d = diversifierAtIndex(dk, 0)
        const ivk = ivkFromFvk(fvk)
        const recipient = deriveAddressBytes(ivk, d)
        console.log('recipient d || pk_d:', hexOf(recipient))

        /* 2. KIND_TEXT memo (rs-dpp memo.rs: u32 LE kind=1 || zero-padded payload). */
        const memo = new Uint8Array(36)
        memo.set([1, 0, 0, 0], 0)
        memo.set(new TextEncoder().encode('evonext e2e shield'), 4)

        /* 3. Build the output-only PCZT bound to the asset lock (tag 0x86). */
        const assetLockIdentifier = bs58.decode(st.lockProofIdentifier)
        expect(assetLockIdentifier.length).toBe(32)
        const extraSighashData = shieldFromAssetLockExtraSighashData(assetLockIdentifier)
        const build = buildOutputOnlyPczt({
            outputs: [{ recipient, value: BigInt(st.shieldCredits), memo, senderOvk: ovk }],
            extraSighashData,
            rand: realRand,
        })
        expect(build.frame.actions.length).toBe(2) /* MIN_ACTIONS auto-pad */
        expect(build.valueBalance).toBe(-BigInt(st.shieldCredits))
        console.log('build: sighash', hexOf(build.sighash), 'valueBalance', build.valueBalance.toString())

        /* 4. Live prover. */
        const frameBytes = serializePcztFrame(build.frame)
        console.log('PCZT frame:', frameBytes.length, 'bytes -> POST', PROVER_BASE_URL + '/prove/pczt')
        const t0 = Date.now()
        const proved = await postPcztFrame(frameBytes)
        console.log(`proved in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        expect(proved.frame.zkproof).not.toBeNull()
        console.log('proved frame:', proved.bytes.length, 'bytes, proof', proved.frame.zkproof!.length,
            'bytes, actions', proved.frame.actions.length, 'valueSum',
            (proved.frame.valueSumIsNegative ? '-' : '') + proved.frame.valueSumMagnitude.toString())

        /* 5. Assemble + sign with the asset-lock key. */
        const ctx = await wasm.WasmTrustedContext.prefetchTestnet()
        const sdk = wasm.WasmSdkBuilder.testnet().withTrustedContext(ctx).build()
        const outPoint = new wasm.OutPoint(st.lockTxid, 0)
        const assetLockProof = wasm.AssetLockProof.createChainAssetLockProof(st.platformChainLockedHeight, outPoint)
        const assetLockPrivateKey = wasm.PrivateKey.fromWIF(st.fundingWif)
        const result = await assembleShieldFromAssetLock({
            assetLockProof, assetLockPrivateKey, build, provedFrame: proved.frame,
            rand: realRand,
        })
        console.log('assembled v1 transition, wire', result.wireBytes.length, 'bytes')
        const transitionHash = (result.stateTransition as any).hash(true)
        console.log('transition hash (skip-sig):', transitionHash)

        /* 6. Broadcast + wait for the execution proof. */
        console.log('broadcasting…')
        await sdk.broadcastStateTransition(result.stateTransition as any)
        console.log('BROADCAST OK')
        const stResult = await sdk.waitForStateTransitionResult(transitionHash)
        console.log('EXECUTION PROVED:', JSON.stringify(stResult).slice(0, 400))

        Object.assign(st, {
            stage: 'shielded', recipientHex: hexOf(recipient), transitionHash,
            shieldedAt: new Date().toISOString(),
        })
        writeFileSync(STATE_PATH, JSON.stringify(st, null, 2))
        console.log('STATE SAVED — stage 2 COMPLETE')
    }, 600000)
})
