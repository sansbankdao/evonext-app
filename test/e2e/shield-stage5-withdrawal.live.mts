// test/e2e/shield-stage5-withdrawal.live.mts

/* LIVE E2E Stage 5 — testnet SHIELDED WITHDRAWAL (pool -> Core L1):
 * spend the stage-4 recipient note (500M credits, tree index 6691) ->
 * withdraw 200M credits to my own BIP44 funding address on L1, change back
 * to the default shielded address -> live prover -> assemble -> broadcast ->
 * wait -> verify pool delta == required (amount + withdrawal fee), tree
 * grows by 2 (change + dummy), the change note decrypts, the queued
 * withdrawal document exists in the system withdrawals contract, and the L1
 * asset-unlock UTXO lands at the funding address.
 *
 * RESUMABLE: if the spend nullifier is already spent on-chain (a prior run
 * broadcast but a later verification step failed), the build/prove/broadcast
 * block is skipped and the remaining effects are verified against live
 * state. Requires scratch-shield-state.json at stage 'transferred' OR
 * 'unshielded'. Real network + real funds — run ONLY via
 *   pnpm vitest run --config test/e2e/vitest.live.config.mjs shield-stage5 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomFillSync } from 'node:crypto'

/* Real wasm (initSync) — overrides the global setup mock, same pattern as
 * shield-stage2/3b/4. */
vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'
import * as d from '@dashevo/dashcore-lib'
import { mnemonicToSeedSync } from '@scure/bip39'
import { buildTransferPczt, postPcztFrame, PROVER_BASE_URL } from '@/lib/shielded/prove'
import { serializePcztFrame } from '@/lib/shielded/pczt-wire'
import { computeShieldedWithdrawalFee } from '@/lib/shielded/fees'
import { shieldedWithdrawalExtraSighashData } from '@/lib/shielded/bundle'
import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveAskAndAk, deriveDkOvk,
    diversifierAtIndex, deriveAddressBytes, ivkFromFvk, diversifyHash,
} from '@/lib/shielded/keys'
import { derivePsi, deriveRcm, noteCommitmentPoint, deriveNullifier, tryDecryptNoteWireWithMemo, type ShieldedEncryptedNoteWire } from '@/lib/shielded/note'
import { PallasPoint, bigintToBytes32LE } from '@/lib/shielded/pasta'
import { OrchardTree, leafFromBytes, leafToBytes } from '@/lib/shielded/tree'
import { assembleShieldedWithdrawal } from '@/lib/shielded/assemble'
import { get_documents } from '@/lib/dash-wasm/compat'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const STATE_PATH = join(process.cwd(), 'scratch-shield-state.json')

/* System withdrawals contract (AGENTS key references; F25 live-verified for
 * identity withdrawals). Doc type 'withdrawal'; status 2 = signed,
 * 3 = complete. The transformer sets the document's owner to the contract
 * owner (all-zeros identifier), NOT the withdrawing identity. */
const WITHDRAWALS_CONTRACT_ID = '4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6'
const WITHDRAWALS_CONTRACT_OWNER = '11111111111111111111111111111111'

/* Withdrawal shape: 200M credits to L1; consensus-pinned fee
 * computeShieldedWithdrawalFee(2) = 226,480,000; required (the transition's
 * unshielding_amount = amount + fee) = 426,480,000; change = 73,520,000.
 * core_fee_per_byte = 1 (MIN_CORE_FEE_PER_BYTE; 1 is Fibonacci —
 * consensus rule), pooling = 0 (Pooling::Never). The L1 payout is the
 * document amount in duffs minus the asset-unlock Core tx fee
 * (ASSET_UNLOCK_TX_SIZE, 190 duffs at coreFeePerByte 1) = 199,810 sats. */
const WITHDRAW_AMOUNT = 200_000_000n
const CORE_FEE_PER_BYTE = 1
const POOLING_NEVER = 0
const ASSET_UNLOCK_TX_SIZE = 190
const NET_L1_SATOSHIS = Number(WITHDRAW_AMOUNT / 1000n) - ASSET_UNLOCK_TX_SIZE * CORE_FEE_PER_BYTE

const TESTNET_INSIGHT = 'https://insight.testnet.networks.dash.org/insight-api'

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/* test/setup.ts stubs window.crypto with getRandomValues: (a) => a (zeroed
 * arrays) — pass REAL randomness explicitly to build + assemble. */
const realRand = (n: number) => { const b = new Uint8Array(n); randomFillSync(b); return b }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const fetchAllNotes = async (sdk: any): Promise<ShieldedEncryptedNoteWire[]> => {
    const all: ShieldedEncryptedNoteWire[] = []
    for (let start = 0n; ; start += 2048n) {
        const chunk = await sdk.getShieldedEncryptedNotes(start, 2048)
        for (const n of chunk as any[]) {
            all.push({ cmx: n.cmx, nullifier: n.nullifier, encryptedNote: n.encryptedNote })
        }
        if (chunk.length < 2048) break
    }
    return all
}

describe('LIVE testnet shielded withdrawal', () => {
    it('builds, proves, broadcasts and verifies the withdrawal (resumable)', async () => {
        const st = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
        expect(['transferred', 'unshielded']).toContain(st.stage)
        const spendIndex: number = st.transfer.recipientNoteIndex
        console.log('spending stage-4 recipient note at tree index', spendIndex)

        /* 1. Keys (ZIP-32 coin_type 1 = testnet, account 0). */
        const seed = mnemonicToSeedSync(MNEMONIC)
        const sk = spendingKeyFromSeed(seed, 1, 0)
        const fvk = fullViewingKeyFromSpendingKey(sk)
        const { ask } = deriveAskAndAk(sk)
        const { dk, ovk } = deriveDkOvk(fvk)
        const ivk = ivkFromFvk(fvk)
        const d0 = diversifierAtIndex(dk, 0)
        const myAddress0 = deriveAddressBytes(ivk, d0)

        /* 2. L1 destination: my own BIP44 funding address m/44'/5'/0'/0/0
         * (the lib/core-chain.ts deriveFundingKey path) as a canonical P2PKH
         * CoreScript (25 bytes — consensus pins P2PKH/P2SH only). */
        const root = d.HDPrivateKey.fromSeed((new d.Mnemonic(MNEMONIC)).toSeed(), 'testnet')
        /* dashcore-lib's .d.ts marks derive()'s `hardened` param required and
         * narrows PrivateKey's ctor to string + buildPublicKeyHashOut to
         * Address|PublicKey without toBuffer(); the RUNTIME accepts exactly
         * the calls below (this derivation produced the funding address +
         * 25-byte P2PKH script that matched the on-chain withdrawal document
         * byte-for-byte). Casts only — runtime semantics unchanged. */
        const derived: any = (root as any).derive(`m/44'/5'/0'/0/0`)
        const fundingPriv = new d.PrivateKey(derived.privateKey, 'testnet')
        const fundingAddress = fundingPriv.toAddress('testnet').toString()
        const outputScript = new Uint8Array((d.Script as any).buildPublicKeyHashOut(fundingAddress).toBuffer())
        expect(outputScript.length).toBe(25)
        expect(outputScript[0]).toBe(0x76) /* OP_DUP */
        expect(outputScript[1]).toBe(0xa9) /* OP_HASH160 */
        console.log('L1 destination (P2PKH):', fundingAddress, '| script', hexOf(outputScript))

        /* 3. SDK + live pool state + full note set (needed for secret
         * recovery in both modes and for the tree in fresh mode). */
        const ctx = await wasm.WasmTrustedContext.prefetchTestnet()
        const sdk = wasm.WasmSdkBuilder.testnet().withTrustedContext(ctx).build()
        const poolBefore = await sdk.getShieldedPoolState()
        console.log('pool balance at start:', poolBefore!.toString(), 'credits')
        const all = await fetchAllNotes(sdk)
        console.log('notes on chain:', all.length, '(stage-4 tree had', st.transfer.treeNoteCountAfter, ')')
        expect(all.length).toBeGreaterThanOrEqual(st.transfer.treeNoteCountAfter)

        /* 4. Recover the spend note's secrets by trial decryption (index
         * 6691 is my stage-4 recipient output at diversifier 1). Append-only
         * tree: later transitions never move earlier leaves. */
        const dec = tryDecryptNoteWireWithMemo(ivk, all[spendIndex])
        expect(dec).not.toBeNull()
        const note = dec!.note
        expect(note.v).toBe(500_000_000n)
        const notePsi = derivePsi(note.rseed, note.rho)
        const noteRcm = deriveRcm(note.rseed, note.rho)
        const noteCmxPoint = noteCommitmentPoint(
            diversifyHash(dec!.address.slice(0, 11)),
            PallasPoint.fromBytes(dec!.address.slice(11, 43)),
            note.v, note.rho, notePsi, noteRcm,
        )
        expect(hexOf(bigintToBytes32LE(noteCmxPoint.extractP()!))).toBe(hexOf(all[spendIndex].cmx))
        const spendNullifierBytes = deriveNullifier(bigintToBytes32LE(fvk.nk), note.rho, notePsi, noteCmxPoint)
        console.log('note recovered — value', note.v.toString(), '| spend nullifier', hexOf(spendNullifierBytes))

        /* Withdrawal economics (needed in both modes for verification). */
        const fee = computeShieldedWithdrawalFee(2)
        const required = WITHDRAW_AMOUNT + fee
        const change = note.v - required
        expect(change).toBeGreaterThan(0n)
        console.log('withdrawal fee (consensus-pinned):', fee.toString(), '| required (unshielding_amount):', required.toString(), '| change:', change.toString())

        /* 5. Fresh run vs resume: if the spend nullifier is already spent,
         * a prior run executed the withdrawal — skip build/prove/assemble/
         * broadcast and verify the on-chain effects instead (re-broadcasting
         * would burn a second fee and double-pay the L1 unlock). */
        const nfBefore = await sdk.getShieldedNullifiers([spendNullifierBytes])
        const alreadySpent = nfBefore[0].isSpent
        let executedNow = false
        let transitionHash: string | null = null
        let changeNoteIndex = -1
        let allAfterLen = -1
        /* Fresh runs snapshot the funding address's UTXO set BEFORE
         * broadcasting so step 11 can deterministically require the payout
         * to be a NEW txid (the payout necessarily lands after broadcast). */
        const preBroadcastTxids = new Set<string>()

        if (alreadySpent) {
            console.log('nullifier ALREADY spent — withdrawal executed by a prior run; verifying on-chain effects (no re-broadcast)')
            /* The change note sits at or after the stage-4 tree size;
             * scan forward for the note decrypting to my d0 address with
             * the exact change value (other transitions may have appended
             * since, so a fixed index is not reliable). */
            for (let i = st.transfer.treeNoteCountAfter; i < all.length; i++) {
                const hit = tryDecryptNoteWireWithMemo(ivk, all[i])
                if (hit !== null && hit.note.v === change && hexOf(hit.address) === hexOf(myAddress0)) {
                    changeNoteIndex = i
                    break
                }
            }
            expect(changeNoteIndex).toBeGreaterThanOrEqual(0)
            console.log('change note found at tree index', changeNoteIndex, '| value', change.toString())
        } else {
            /* Fresh path: witness against the live anchor, build, prove,
             * assemble, broadcast. */
            const anchor = await sdk.getMostRecentShieldedAnchor()
            expect(anchor).toBeDefined()
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

            const pathBig = tree.authPath(spendIndex)
            const witness = { position: spendIndex, path: pathBig.map(leafToBytes) }
            const folded = OrchardTree.rootFromPath(leafFromBytes(all[spendIndex].cmx)!, spendIndex, pathBig)
            expect(hexOf(leafToBytes(folded))).toBe(localRootHex)
            expect(nfBefore[0].isSpent).toBe(false)
            console.log('witness ok; nullifier unspent')

            /* 6. Build the withdrawal spend bundle. extra_sighash_data binds
             * the Core-facing fields (output_script || required || core_fee
             * || pooling) — rs-dpp shielded_withdrawal.rs. */
            const extraSighashData = shieldedWithdrawalExtraSighashData(outputScript, required, CORE_FEE_PER_BYTE, POOLING_NEVER)
            const build = buildTransferPczt({
                spends: [{
                    recipient: dec!.address, value: note.v, rho: note.rho, rseed: note.rseed,
                    fvk, ask, witness,
                }],
                outputs: [
                    /* Only the change output (rs-dpp: the wallet's change memo
                     * is [0u8; 36]); a filler dummy pads to the 2-action min. */
                    { recipient: myAddress0, value: change, memo: new Uint8Array(36), senderOvk: ovk },
                ],
                anchor: anchor!,
                extraSighashData,
                rand: realRand,
            })
            expect(build.frame.actions.length).toBe(2)
            expect(build.valueBalance).toBe(required)
            expect(build.frame.valueSumIsNegative).toBe(false)
            console.log('build: sighash', hexOf(build.sighash), 'valueBalance (required)', build.valueBalance.toString())

            /* 7. Live prover. */
            const frameBytes = serializePcztFrame(build.frame)
            console.log('PCZT frame:', frameBytes.length, 'bytes -> POST', PROVER_BASE_URL + '/prove/pczt')
            const t0 = Date.now()
            const proved = await postPcztFrame(frameBytes)
            console.log(`proved in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
            expect(proved.frame.zkproof).not.toBeNull()

            /* 8. Assemble + broadcast. */
            const result = await assembleShieldedWithdrawal({
                build, provedFrame: proved.frame,
                coreFeePerByte: CORE_FEE_PER_BYTE, pooling: POOLING_NEVER, outputScript,
                rand: realRand,
            })
            console.log('assembled withdrawal transition, wire', result.wireBytes.length, 'bytes')
            transitionHash = (result.stateTransition as any).hash(true)
            console.log('transition hash (skip-sig):', transitionHash)
            const preRes = await fetch(`${TESTNET_INSIGHT}/addr/${fundingAddress}/utxo`).then((r) => r.json()).catch(() => [])
            for (const u of (Array.isArray(preRes) ? preRes : [])) preBroadcastTxids.add(u.txid)
            console.log('funding address UTXOs before broadcast:', preBroadcastTxids.size)
            console.log('broadcasting…')
            await sdk.broadcastStateTransition(result.stateTransition as any)
            console.log('BROADCAST OK')
            const stResult = await sdk.waitForStateTransitionResult(transitionHash!)
            console.log('EXECUTION PROVED:', JSON.stringify(stResult).slice(0, 400))
            executedNow = true
        }

        /* 9. Verify shielded-side effects: nullifier revealed; pool loses
         * EXACTLY required (fresh run only); tree grew by exactly 2 (fresh
         * run only); the change note trial-decrypts with the exact value. */
        const nfAfter = await sdk.getShieldedNullifiers([spendNullifierBytes])
        console.log('nullifier spent status after execution:', nfAfter[0].isSpent)
        expect(nfAfter[0].isSpent).toBe(true)

        const allAfter = await fetchAllNotes(sdk)
        if (executedNow) {
            const poolAfter = await sdk.getShieldedPoolState()
            console.log('pool balance after :', poolAfter!.toString(), 'credits (delta', (poolBefore! - poolAfter!).toString() + ')')
            expect(poolBefore! - poolAfter!).toBe(required)
            expect(allAfter.length).toBe(all.length + 2)
            const out0 = tryDecryptNoteWireWithMemo(ivk, allAfter[all.length])
            const out1 = tryDecryptNoteWireWithMemo(ivk, allAfter[all.length + 1])
            expect(out0).not.toBeNull()
            console.log('change note: value', out0!.note.v.toString(), '| address matches d0:', hexOf(out0!.address) === hexOf(myAddress0))
            expect(out0!.note.v).toBe(change)
            expect(out1).toBeNull() /* the padded dummy output is not mine */
            changeNoteIndex = all.length
        }
        allAfterLen = allAfter.length

        /* 10. The withdrawal document must exist in the system withdrawals
         * contract. The transformer sets the doc owner to the CONTRACT
         * owner (zero identifier), so query by $ownerId ordered by
         * $updatedAt desc and match OUR document by its output script.
         * Poll to ride out the DAPI indexer's lag after execution. */
        const scriptHex = hexOf(outputScript)
        let myDoc: any = null
        for (let attempt = 0; attempt < 12 && myDoc === null; attempt++) {
            if (attempt > 0) await sleep(5000)
            const docs = await get_documents(sdk, WITHDRAWALS_CONTRACT_ID, 'withdrawal',
                [['$ownerId', '==', WITHDRAWALS_CONTRACT_OWNER]],
                [['$ownerId', 'asc'], ['$updatedAt', 'desc']], 100)
            const docList = (docs ?? []) as any[]
            if (attempt === 0) console.log('withdrawal documents under contract owner:', docList.length)
            for (const raw of docList) {
                const j = typeof raw.toJSON === 'function' ? raw.toJSON() : raw
                const scriptBytes = j.outputScript ?? j.output_script
                if (scriptBytes && Buffer.from(scriptBytes, 'base64').toString('hex') === scriptHex) {
                    myDoc = j
                    break
                }
            }
            if (myDoc === null) console.log(`  …withdrawal doc not indexed yet (${(attempt + 1) * 5}s)`)
        }
        expect(myDoc).not.toBeNull()
        console.log('withdrawal document:', JSON.stringify(myDoc))
        expect(myDoc.amount ?? myDoc.unshielding_amount).toBe(Number(WITHDRAW_AMOUNT))
        expect(myDoc.coreFeePerByte ?? myDoc.core_fee_per_byte).toBe(CORE_FEE_PER_BYTE)
        expect(myDoc.pooling).toBe(POOLING_NEVER)
        expect([2, 3]).toContain(myDoc.status)

        /* 11. The L1 asset-unlock UTXO must land at the funding address.
         * Insight returns UTXOs newest-first with no ordering guarantee —
         * match deterministically by scriptPubKey + the exact net satoshis
         * (amount/1000 duffs minus the 190-duff unlock-tx fee), and in a
         * fresh run additionally require a txid we did not see before
         * broadcasting. Insight lags a block or two: poll. */
        let payout: any = null
        for (let i = 0; i < 24 && !payout; i++) {
            const res = await fetch(`${TESTNET_INSIGHT}/addr/${fundingAddress}/utxo`).then((r) => r.json()).catch(() => [])
            const utxos: any[] = Array.isArray(res) ? res : []
            payout = utxos.find((u: any) =>
                u.scriptPubKey === scriptHex &&
                u.satoshis === NET_L1_SATOSHIS &&
                (executedNow ? !preBroadcastTxids.has(u.txid) : true)) ?? null
            if (!payout) {
                console.log(`  …waiting for L1 payout (${(i + 1) * 20}s, ${utxos.length} UTXOs seen)`)
                await sleep(20_000)
            }
        }
        expect(payout).not.toBeNull()
        console.log('L1 PAYOUT LANDED:', JSON.stringify(payout))

        /* 12. Persist the stage + a full audit trail. In resume mode the
         * transition hash is not recoverable (proving randomness is not
         * stored) — record executedByThisRun: false instead. */
        Object.assign(st, {
            stage: 'unshielded',
            withdrawal: {
                transitionHash,
                executedByThisRun: executedNow,
                fee: fee.toString(),
                required: required.toString(),
                amount: WITHDRAW_AMOUNT.toString(),
                change: change.toString(),
                coreFeePerByte: CORE_FEE_PER_BYTE,
                pooling: POOLING_NEVER,
                spendNullifier: hexOf(spendNullifierBytes),
                spentNoteIndex: spendIndex,
                changeNoteIndex,
                noteCountAfter: allAfterLen,
                l1Address: fundingAddress,
                l1PayoutSatoshis: payout.satoshis,
                l1PayoutTxid: payout.txid,
                withdrawalDoc: myDoc,
                withdrawnAt: new Date().toISOString(),
            },
        })
        writeFileSync(STATE_PATH, JSON.stringify(st, null, 2))
        console.log('STATE SAVED — stage 5 (UNSHIELD/WITHDRAWAL) COMPLETE')
    }, 900_000)
})
