// test/e2e/shield-stage4-transfer.live.mts

/* LIVE E2E Stage 4 — testnet SHIELDED TRANSFER (pool -> pool):
 * rebuild the note-commitment tree -> witness for my stage-2 note -> build
 * transfer PCZT (1 real spend + recipient/change outputs) -> live prover ->
 * assemble -> broadcast -> wait for execution -> verify pool delta == fee,
 * tree grew by 2, both new notes trial-decrypt. Requires
 * scratch-shield-state.json at stage 'execution-proved' (stage 3b done).
 * Real network + real funds — run ONLY via
 *   pnpm vitest run --config test/e2e/vitest.live.config.mjs shield-stage4 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomFillSync } from 'node:crypto'

/* Real wasm (initSync) — overrides the global setup mock, same pattern as
 * shield-stage2. */
vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'
import { mnemonicToSeedSync } from '@scure/bip39'
import { buildTransferPczt, postPcztFrame, PROVER_BASE_URL } from '@/lib/shielded/prove'
import { serializePcztFrame } from '@/lib/shielded/pczt-wire'
import { computeMinimumShieldedFee } from '@/lib/shielded/fees'
import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveAskAndAk, deriveDkOvk,
    diversifierAtIndex, deriveAddressBytes, ivkFromFvk, diversifyHash,
} from '@/lib/shielded/keys'
import { derivePsi, deriveRcm, noteCommitmentPoint, deriveNullifier, tryDecryptNoteWireWithMemo, type ShieldedEncryptedNoteWire } from '@/lib/shielded/note'
import { PallasPoint, bigintToBytes32LE } from '@/lib/shielded/pasta'
import { OrchardTree, leafFromBytes, leafToBytes } from '@/lib/shielded/tree'
import { assembleShieldedTransfer } from '@/lib/shielded/assemble'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const STATE_PATH = join(process.cwd(), 'scratch-shield-state.json')

/* Transfer shape: 500M credits to MYSELF at a FRESH self-address
 * (diversifier index 1), change back to the default address (index 0). The
 * fee is consensus-pinned: computeMinimumShieldedFee(2) — value_balance must
 * equal it EXACTLY (rs-dpp shielded_transfer.rs). */
const TRANSFER_AMOUNT = 500_000_000n

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)))

/* test/setup.ts mocks window.crypto with getRandomValues: (a) => a (zeroed
 * arrays) — pass REAL randomness explicitly to build + assemble. */
const realRand = (n: number) => { const b = new Uint8Array(n); randomFillSync(b); return b }

describe('LIVE testnet shielded transfer', () => {
    it('builds, proves, assembles, broadcasts and verifies the transfer', async () => {
        const st = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
        expect(st.stage).toBe('execution-proved')
        const myNote = st.myNote
        console.log('spending note at tree index', myNote.index, 'value', myNote.v)

        /* 1. Keys (ZIP-32 coin_type 1 = testnet, account 0). */
        const seed = mnemonicToSeedSync(MNEMONIC)
        const sk = spendingKeyFromSeed(seed, 1, 0)
        const fvk = fullViewingKeyFromSpendingKey(sk)
        const { ask } = deriveAskAndAk(sk)
        const { dk, ovk } = deriveDkOvk(fvk)
        const ivk = ivkFromFvk(fvk)
        const d0 = diversifierAtIndex(dk, 0)
        const d1 = diversifierAtIndex(dk, 1)
        const myAddress0 = deriveAddressBytes(ivk, d0)
        const myAddress1 = deriveAddressBytes(ivk, d1)

        /* 2. Sanity: recompute the spent note's cmx + its REAL spend
         * nullifier from the saved secrets. NOTE on wire semantics: the
         * encrypted-notes row's `nullifier` field is the ACTION's spend-side
         * nullifier = the output note's RHO (Rho::from_nf_old) — NOT the
         * note's own spend nullifier (stage 3b recorded it under both names;
         * they are identical for that row). The true spend nullifier is
         * Note::nullifier(nk, rho, psi, cm) recomputed here. */
        const noteRho = fromHex(myNote.rho)
        const noteRseed = fromHex(myNote.rseed)
        const noteValue = BigInt(myNote.v)
        const notePsi = derivePsi(noteRseed, noteRho)
        const noteRcm = deriveRcm(noteRseed, noteRho)
        const cmPoint = noteCommitmentPoint(
            diversifyHash(myAddress0.slice(0, 11)),
            PallasPoint.fromBytes(myAddress0.slice(11, 43)),
            noteValue, noteRho, notePsi, noteRcm,
        )
        const recomputedCmx = hexOf(bigintToBytes32LE(cmPoint.extractP()!))
        expect(recomputedCmx).toBe(myNote.cmx)
        expect(myNote.nullifier).toBe(myNote.rho) /* row nullifier == rho (from_nf_old) */
        const spendNullifierBytes = deriveNullifier(bigintToBytes32LE(fvk.nk), noteRho, notePsi, cmPoint)
        const recomputedNf = hexOf(spendNullifierBytes)
        expect(recomputedNf).not.toBe(myNote.rho)
        console.log('note secrets check out — cmx exact; spend nullifier:', recomputedNf)

        /* 3. SDK + live pool state. */
        const ctx = await wasm.WasmTrustedContext.prefetchTestnet()
        const sdk = wasm.WasmSdkBuilder.testnet().withTrustedContext(ctx).build()
        const poolBefore = await sdk.getShieldedPoolState()
        console.log('pool balance before:', poolBefore!.toString(), 'credits')

        /* 4. Fetch the live anchor + the full tree; rebuild the local tree and
         * REQUIRE the root to match the anchor (else the witness is garbage). */
        const anchor = await sdk.getMostRecentShieldedAnchor()
        expect(anchor).toBeDefined()
        const all: ShieldedEncryptedNoteWire[] = []
        for (let start = 0n; ; start += 2048n) {
            const chunk = await sdk.getShieldedEncryptedNotes(start, 2048)
            for (const n of chunk as any[]) {
                all.push({ cmx: n.cmx, nullifier: n.nullifier, encryptedNote: n.encryptedNote })
            }
            if (chunk.length < 2048) break
        }
        console.log('tree notes fetched:', all.length, '(stage 3b saw', st.treeNoteCount + ')')
        expect(all.length).toBeGreaterThanOrEqual(st.treeNoteCount)
        const tree = new OrchardTree()
        for (const n of all) {
            const leaf = leafFromBytes(n.cmx)
            if (leaf === null) throw new Error('non-canonical cmx in chain data')
            tree.append(leaf)
        }
        const localRootHex = hexOf(leafToBytes(tree.root()))
        console.log('local tree root :', localRootHex)
        console.log('live anchor     :', hexOf(anchor!))
        expect(localRootHex).toBe(hexOf(anchor!))

        /* 5. Witness for my note. */
        const pathBig = tree.authPath(myNote.index)
        const witness = { position: myNote.index, path: pathBig.map(leafToBytes) }
        /* Fold check: MerklePath::root parity with the tree root. */
        const folded = OrchardTree.rootFromPath(leafFromBytes(fromHex(myNote.cmx))!, myNote.index, pathBig)
        expect(hexOf(leafToBytes(folded))).toBe(localRootHex)
        console.log('witness ok — position', witness.position, ', 32-node path folds to the anchor')

        /* 5b. The spend nullifier must not already be revealed on-chain. */
        const nfStatus = await sdk.getShieldedNullifiers([spendNullifierBytes])
        expect(nfStatus.length).toBe(1)
        console.log('nullifier spent status before broadcast:', nfStatus[0].isSpent)
        expect(nfStatus[0].isSpent).toBe(false)

        /* 6. Build the transfer PCZT. */
        const fee = computeMinimumShieldedFee(2)
        const change = noteValue - TRANSFER_AMOUNT - fee
        expect(change).toBeGreaterThan(0n)
        console.log('fee (consensus-pinned):', fee.toString(), '| transfer:', TRANSFER_AMOUNT.toString(), '| change:', change.toString())
        const memo = new Uint8Array(36)
        memo.set([1, 0, 0, 0], 0)
        memo.set(new TextEncoder().encode('evonext e2e transfer'), 4)
        const build = buildTransferPczt({
            spends: [{
                recipient: myAddress0, value: noteValue, rho: noteRho, rseed: noteRseed,
                fvk, ask, witness,
            }],
            outputs: [
                { recipient: myAddress1, value: TRANSFER_AMOUNT, memo, senderOvk: ovk },
                { recipient: myAddress0, value: change, memo: new Uint8Array(36), senderOvk: ovk },
            ],
            anchor: anchor!,
            rand: realRand,
        })
        expect(build.frame.actions.length).toBe(2)
        expect(build.valueBalance).toBe(fee)
        expect(build.frame.valueSumIsNegative).toBe(false)
        console.log('build: sighash', hexOf(build.sighash), 'valueBalance (fee)', build.valueBalance.toString())

        /* 7. Live prover (first spend-circuit job on this worker — cold build
         * of the proving key can take a while). */
        const frameBytes = serializePcztFrame(build.frame)
        console.log('PCZT frame:', frameBytes.length, 'bytes -> POST', PROVER_BASE_URL + '/prove/pczt')
        const t0 = Date.now()
        const proved = await postPcztFrame(frameBytes)
        console.log(`proved in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        expect(proved.frame.zkproof).not.toBeNull()
        console.log('proved frame:', proved.bytes.length, 'bytes, proof', proved.frame.zkproof!.length, 'bytes')

        /* 8. Assemble + broadcast. */
        const result = await assembleShieldedTransfer({ build, provedFrame: proved.frame, rand: realRand })
        console.log('assembled transfer transition, wire', result.wireBytes.length, 'bytes')
        const transitionHash = (result.stateTransition as any).hash(true)
        console.log('transition hash (skip-sig):', transitionHash)
        console.log('broadcasting…')
        await sdk.broadcastStateTransition(result.stateTransition as any)
        console.log('BROADCAST OK')
        const stResult = await sdk.waitForStateTransitionResult(transitionHash)
        console.log('EXECUTION PROVED:', JSON.stringify(stResult).slice(0, 400))

        /* 9. Verify on-chain effects: nullifier revealed, pool loses
         * EXACTLY the fee, the tree grows by exactly 2, both new notes
         * trial-decrypt to me. */
        const nfStatusAfter = await sdk.getShieldedNullifiers([spendNullifierBytes])
        console.log('nullifier spent status after execution :', nfStatusAfter[0].isSpent)
        expect(nfStatusAfter[0].isSpent).toBe(true)
        const poolAfter = await sdk.getShieldedPoolState()
        console.log('pool balance after :', poolAfter!.toString(), 'credits (delta', (poolBefore! - poolAfter!).toString() + ')')
        expect(poolBefore! - poolAfter!).toBe(fee)

        const allAfter: ShieldedEncryptedNoteWire[] = []
        for (let start = 0n; ; start += 2048n) {
            const chunk = await sdk.getShieldedEncryptedNotes(start, 2048)
            for (const n of chunk as any[]) {
                allAfter.push({ cmx: n.cmx, nullifier: n.nullifier, encryptedNote: n.encryptedNote })
            }
            if (chunk.length < 2048) break
        }
        expect(allAfter.length).toBe(all.length + 2)
        const out0 = tryDecryptNoteWireWithMemo(ivk, allAfter[all.length])
        const out1 = tryDecryptNoteWireWithMemo(ivk, allAfter[all.length + 1])
        expect(out0).not.toBeNull()
        expect(out1).not.toBeNull()
        console.log('recipient note: value', out0!.note.v.toString(), '| address matches d1:', hexOf(out0!.address) === hexOf(myAddress1))
        console.log('change note   : value', out1!.note.v.toString(), '| address matches d0:', hexOf(out1!.address) === hexOf(myAddress0))
        expect(out0!.note.v).toBe(TRANSFER_AMOUNT)
        expect(out1!.note.v).toBe(change)
        expect(hexOf(out0!.address)).toBe(hexOf(myAddress1))
        expect(hexOf(out1!.address)).toBe(hexOf(myAddress0))

        Object.assign(st, {
            stage: 'transferred',
            transfer: {
                transitionHash, fee: fee.toString(), amount: TRANSFER_AMOUNT.toString(),
                change: change.toString(), spentNullifier: recomputedNf,
                recipientNoteIndex: all.length, changeNoteIndex: all.length + 1,
                recipientCmx: hexOf(allAfter[all.length].cmx), changeCmx: hexOf(allAfter[all.length + 1].cmx),
                treeNoteCountAfter: allAfter.length,
                transferredAt: new Date().toISOString(),
            },
        })
        writeFileSync(STATE_PATH, JSON.stringify(st, null, 2))
        console.log('STATE SAVED — stage 4 (TRANSFER) COMPLETE')
    }, 900000)
})
