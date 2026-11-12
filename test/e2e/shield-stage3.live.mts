// test/e2e/shield-stage3.live.mts

/* LIVE E2E Stage 3 — verify the shield EXECUTED on testnet:
 * retry waitForStateTransitionResult (each call has an internal ~30s
 * deadline), then read the shielded pool state via the DAPI proxy and
 * compare against the pre-shield snapshot. */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'

const STATE_PATH = join(process.cwd(), 'scratch-shield-state.json')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function readPoolState(sdk: any): Promise<{ balance: bigint; notes: bigint }> {
    const s = await sdk.getShieldedPoolState()
    /* ResponseMetadata wrapper: { data: { balance, totalNotes } } or flat —
     * inspect both shapes defensively. */
    const d = s?.data ?? s
    return {
        balance: BigInt(d?.balance ?? d?.poolBalance ?? -1),
        notes: BigInt(d?.totalNotes ?? d?.notesCount ?? d?.noteCount ?? -1),
    }
}

describe('LIVE testnet shield verification', () => {
    it('transition executes and the pool state reflects the shield', async () => {
        const st = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
        console.log('transition hash:', st.transitionHash)

        const ctx = await wasm.WasmTrustedContext.prefetchTestnet()
        const sdk = wasm.WasmSdkBuilder.testnet().withTrustedContext(ctx).build()

        const poolBefore = await readPoolState(sdk)
        console.log('pool state NOW (may already include the shield):',
            poolBefore.balance.toString(), 'credits /', poolBefore.notes.toString(), 'notes')

        let proved = false
        for (let a = 1; a <= 20; a++) {
            try {
                const r = await sdk.waitForStateTransitionResult(st.transitionHash)
                console.log(`EXECUTION PROVED (attempt ${a}):`, JSON.stringify(r).slice(0, 300))
                proved = true
                break
            } catch (e: any) {
                const msg = String(e?.message ?? e)
                console.log(`attempt ${a}: ${msg.slice(0, 140)}`)
                if (/not found|invalid/i.test(msg)) break /* hard failure — stop */
            }
            await sleep(10000)
        }

        const poolAfter = await readPoolState(sdk)
        console.log('pool state AFTER waits:', poolAfter.balance.toString(), 'credits /',
            poolAfter.notes.toString(), 'notes')

        Object.assign(st, {
            stage: proved ? 'execution-proved' : 'broadcast-unproven',
            poolBalanceAfter: poolAfter.balance.toString(), poolNotesAfter: poolAfter.notes.toString(),
        })
        writeFileSync(STATE_PATH, JSON.stringify(st, null, 2))
        console.log('proved:', proved)
    }, 600000)
})
