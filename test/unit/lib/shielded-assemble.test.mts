/* test/unit/lib/shielded-assemble.test.mts
 * KAT for lib/shielded/assemble.ts against the REAL vendored wasm-sdk
 * (initSync, same pattern as compat-derive.test.mts). Fully offline: the
 * "proved" frame is the local build with a fabricated zkproof trailer — the
 * wasm transition constructor does NOT verify proofs, so the assembly, the
 * wire layout, the ECDSA signature and the binding signature can all be
 * checked without the prover service.
 *
 * Asserts the COMPLETE signed wire bytes field-by-field with a big-endian
 * bincode-varint walker (framing runtime-verified in F29d: 0x12 || 0x01 ||
 * AssetLockProof::Chain=0x01 || height || OutPoint{0x20||txid||vout} ||
 * actions || valueBalance || anchor || proof || binding_sig || surplus ||
 * ecdsa_sig).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

import * as wasm from '@/lib/dash-wasm/wasm_sdk.js'
import { buildOutputOnlyPczt, type RandFn } from '@/lib/shielded/prove'
import { assembleShieldFromAssetLock } from '@/lib/shielded/assemble'
import { getBindingG, reddsaVerify } from '@/lib/shielded/reddsa'

const TXID = 'ab'.repeat(32)
/* Real KAT address (shielded-encrypt fixture) — encryptNotePlaintext
 * requires a valid pk_d, so a placeholder recipient cannot be used. */
const RECIPIENT = Uint8Array.from(Buffer.from(
    '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425', 'hex'))
const HEIGHT = 1572000
const PRIV_HEX = '01'.repeat(32)
const FAKE_PROOF = new Uint8Array(7264).fill(0xcd)

/* Deterministic rand for reproducible builds/signatures (SHA-256 counter
 * stream — same construction as shielded-prove.test.mts). */
function makeDeterministicRand(seed: number): RandFn {
    const state = new Uint8Array(8)
    return (n: number): Uint8Array => {
        const out = new Uint8Array(n)
        let off = 0
        while (out.length - off > 0) {
            state[0] = seed & 0xff
            state[1] = (seed >> 8) & 0xff
            const block = sha256(state)
            out.set(block.subarray(0, Math.min(32, out.length - off)), off)
            off += 32
            for (let i = 4; i < 8; i++) {
                state[i] = (state[i] + 1) & 0xff
                if (state[i] !== 0) break
            }
        }
        return out
    }
}

/* Big-endian bincode-varint reader (standard().with_big_endian()). */
function readVarint(b: Uint8Array, off: number): { value: bigint; next: number } {
    const x = b[off]
    if (x <= 250) return { value: BigInt(x), next: off + 1 }
    if (x === 251) return { value: BigInt((b[off + 1] << 8) | b[off + 2]), next: off + 3 }
    if (x === 252) {
        return { value: BigInt(((b[off + 1] << 24) | (b[off + 2] << 16) | (b[off + 3] << 8) | b[off + 4]) >>> 0), next: off + 5 }
    }
    if (x === 253) {
        const dv = new DataView(b.buffer, b.byteOffset + off + 1, 8)
        return { value: dv.getBigUint64(0, false), next: off + 9 }
    }
    throw new Error('u128 varint unsupported in test decoder')
}

function makeOptions(rand: RandFn) {
    const assetLockProof = wasm.AssetLockProof.createChainAssetLockProof(HEIGHT, new wasm.OutPoint(TXID, 0))
    const assetLockPrivateKey = wasm.PrivateKey.fromHex(PRIV_HEX, 'testnet')
    const build = buildOutputOnlyPczt({
        outputs: [{
            recipient: RECIPIENT,
            value: 1_000_000n,
            memo: new Uint8Array(36).fill(0x07),
            senderOvk: null,
        }],
        dummyOutputs: 0,
        extraSighashData: new Uint8Array(33).fill(0x86),
        rand,
    })
    return { assetLockProof, assetLockPrivateKey, build, rand }
}

describe('assembleShieldFromAssetLock (real vendored wasm)', () => {
    it('assembles a signed transition whose wire decodes field-by-field to the build', async () => {
        const { assetLockProof, assetLockPrivateKey, build } = makeOptions(makeDeterministicRand(21))
        const provedFrame = { ...build.frame, zkproof: FAKE_PROOF }

        const assembled = await assembleShieldFromAssetLock({
            assetLockProof, assetLockPrivateKey, build, provedFrame,
            rand: makeDeterministicRand(99),
        })

        /* The wire round-trips through the SDK. */
        const reParsed = (wasm.StateTransition.fromBytes(assembled.wireBytes) as any)
        expect(Buffer.from(reParsed.toBytes()).toString('hex'))
            .toBe(Buffer.from(assembled.wireBytes).toString('hex'))
        expect(Buffer.from((assembled.stateTransition as any).toBytes()).toString('hex'))
            .toBe(Buffer.from(assembled.wireBytes).toString('hex'))

        /* Full field-by-field decode. */
        const b = assembled.wireBytes
        let off = 0
        expect(b[off++]).toBe(0x12) // StateTransition::ShieldFromAssetLock
        expect(b[off++]).toBe(0x01) // V1
        let r = readVarint(b, off); off = r.next
        expect(r.value).toBe(1n) // AssetLockProof::Chain
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(BigInt(HEIGHT))
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(32n) // txid length
        expect(Buffer.from(b.subarray(off, off + 32)).toString('hex')).toBe(TXID)
        off += 32
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(0n) // vout
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(2n) // actions: 1 real + 1 MIN_ACTIONS filler
        for (const action of provedFrame.actions) {
            expect(Buffer.from(b.subarray(off, off + 32)).toString('hex'))
                .toBe(Buffer.from(action.spend.nullifier).toString('hex')); off += 32
            expect(Buffer.from(b.subarray(off, off + 32)).toString('hex'))
                .toBe(Buffer.from(action.spend.rk).toString('hex')); off += 32
            expect(Buffer.from(b.subarray(off, off + 32)).toString('hex'))
                .toBe(Buffer.from(action.output.cmx).toString('hex')); off += 32
            r = readVarint(b, off); off = r.next
            expect(r.value).toBe(216n) // epk(32) || enc(104) || out(80)
            const enc = new Uint8Array(216)
            enc.set(action.output.ephemeralKey, 0)
            enc.set(action.output.encCiphertext, 32)
            enc.set(action.output.outCiphertext, 136)
            expect(Buffer.from(b.subarray(off, off + 216)).toString('hex'))
                .toBe(Buffer.from(enc).toString('hex')); off += 216
            expect(Buffer.from(b.subarray(off, off + 32)).toString('hex'))
                .toBe(Buffer.from(action.cvNet).toString('hex')); off += 32
            expect(Buffer.from(b.subarray(off, off + 64)).toString('hex'))
                .toBe(Buffer.from(action.spend.spendAuthSig).toString('hex')); off += 64
        }
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(1_000_000n) // valueBalance = positive magnitude
        expect(Buffer.from(b.subarray(off, off + 32)).toString('hex'))
            .toBe(Buffer.from(provedFrame.anchor).toString('hex')); off += 32
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(BigInt(FAKE_PROOF.length))
        expect(Buffer.from(b.subarray(off, off + FAKE_PROOF.length)).toString('hex'))
            .toBe(Buffer.from(FAKE_PROOF).toString('hex')); off += FAKE_PROOF.length
        expect(Buffer.from(b.subarray(off, off + 64)).toString('hex'))
            .toBe(Buffer.from(assembled.bindingSignature).toString('hex')); off += 64
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(0n) // surplus_output: None
        r = readVarint(b, off); off = r.next
        expect(r.value).toBe(65n) // ECDSA signature length
        const ecdsaSig = b.subarray(off, off + 65); off += 65
        expect(off).toBe(b.length) // nothing trailing

        /* ECDSA signature: [v=27+4+recid | r | s], low-S, over
         * SHA256d(getSignableBytes()) — runtime-verified layout. */
        expect(ecdsaSig[0]).toBeGreaterThanOrEqual(31)
        expect(ecdsaSig[0]).toBeLessThanOrEqual(34)
        const unsigned = new wasm.ShieldFromAssetLockTransition({
            assetLockProof: wasm.AssetLockProof.createChainAssetLockProof(HEIGHT, new wasm.OutPoint(TXID, 0)),
            actions: provedFrame.actions.map((a) => new wasm.SerializedOrchardAction({
                nullifier: a.spend.nullifier, rk: a.spend.rk, cmx: a.output.cmx,
                encryptedNote: (() => { const e = new Uint8Array(216); e.set(a.output.ephemeralKey, 0); e.set(a.output.encCiphertext, 32); e.set(a.output.outCiphertext, 136); return e })(),
                cvNet: a.cvNet, spendAuthSig: a.spend.spendAuthSig,
            })),
            valueBalance: 1_000_000n, anchor: provedFrame.anchor, proof: FAKE_PROOF,
            bindingSignature: assembled.bindingSignature, signature: new Uint8Array(0),
        }).toStateTransition()
        const signable = unsigned.getSignableBytes()
        const digest = sha256(sha256(signable))
        const pub = secp256k1.getPublicKey(Uint8Array.from(Buffer.from(PRIV_HEX, 'hex')), true)
        /* noble 2.x verify defaults prehash:true (hashes the input again) —
         * pass prehash:false since `digest` is already the 32-byte hash. */
        expect(secp256k1.verify(ecdsaSig.subarray(1, 65), digest, pub, { prehash: false })).toBe(true)
        /* ...and the recovery id recovers the same key. */
        const rec = secp256k1.Signature.fromBytes(ecdsaSig.subarray(1, 65), 'compact')
            .addRecoveryBit(ecdsaSig[0] - 31)
            .recoverPublicKey(digest)
        expect(Buffer.from(rec.toBytes(true)).toString('hex')).toBe(Buffer.from(pub).toString('hex'))

        /* Binding signature verifies over the sighash against the binding
         * VERIFICATION key bvk = BindingG * bsk (binding.rs semantics). */
        const bvk = getBindingG().mul(build.bsk).toBytes()
        expect(reddsaVerify({
            vkBytes: bvk, msg: build.sighash,
            sig: assembled.bindingSignature, base: getBindingG(),
        })).toBe(true)
    })

    it('rejects a frame without a zkproof', async () => {
        const { assetLockProof, assetLockPrivateKey, build } = makeOptions(makeDeterministicRand(22))
        await expect(assembleShieldFromAssetLock({
            assetLockProof, assetLockPrivateKey, build, provedFrame: build.frame,
        })).rejects.toThrow('no zkproof')
    })

    it('rejects a proved frame that differs from the local build', async () => {
        const { assetLockProof, assetLockPrivateKey, build } = makeOptions(makeDeterministicRand(23))
        const tampered = {
            ...build.frame,
            anchor: new Uint8Array(32), // differs from build.frame.anchor
            zkproof: FAKE_PROOF,
        }
        await expect(assembleShieldFromAssetLock({
            assetLockProof, assetLockPrivateKey, build, provedFrame: tampered,
        })).rejects.toThrow('does not match the local build')
    })

    it('rejects a bundle whose value sum is not negative', async () => {
        const { assetLockProof, assetLockPrivateKey, build } = makeOptions(makeDeterministicRand(24))
        /* Fabricate a self-consistent positive-sum pair (passes the equality
         * check, trips the build_bound_bundle parity guard). */
        const fakeFrame = { ...build.frame, valueSumIsNegative: false }
        const fakeBuild = { ...build, frame: fakeFrame }
        await expect(assembleShieldFromAssetLock({
            assetLockProof, assetLockPrivateKey, build: fakeBuild,
            provedFrame: { ...fakeFrame, zkproof: FAKE_PROOF },
        })).rejects.toThrow('not negative')
    })
})
