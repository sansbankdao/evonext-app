/* lib/shielded/assemble.ts
 * Assembly of a protocol-v14 ShieldFromAssetLockTransition (v1) from a proved
 * PCZT frame, ready for sdk.broadcastStateTransition. This module does NOT
 * serialize the transition itself — the vendored wasm-sdk owns the bincode
 * wire format (runtime-verified F29d: 0x12 ST tag || 0x01 V1 || standard+
 * big-endian bincode fields). It only:
 *   1. re-validates the proved frame against the local build (the prover must
 *      not have changed anything outside the zkproof),
 *   2. maps the frame's action halves onto rs-dpp's SerializedAction layout
 *      (runtime-verified: encryptedNote = epk(32) || enc_ciphertext(104) ||
 *      out_ciphertext(80) = 216 bytes — serialize_authorized_bundle,
 *      rc.8 packages/rs-dpp/src/shielded/builder/mod.rs:134),
 *   3. computes the binding signature (RedDSA, BindingG) over the sighash,
 *   4. builds the wasm transition, signs it with the ASSET LOCK private key
 *      (signByPrivateKey — runtime-verified: SHA256d(getSignableBytes()),
 *      65-byte [v=27+4+recid | r | s] low-S recoverable sig, returns the
 *      signed wire bytes), and re-parses them for broadcast.
 *
 * value_balance semantics (rs-dpp build_bound_bundle, rc.8 .../builder/
 * shield_from_asset_lock.rs:152): the BUNDLE carries the signed Orchard
 * value_sum (negative = value entering the pool); the TRANSITION carries
 * value_balance = -value_sum as a positive u64 magnitude. We therefore pass
 * the frame's valueSumMagnitude and REQUIRE valueSumIsNegative.
 */

import type { PcztFrame } from './pczt-wire'
import { serializePcztFrame } from './pczt-wire'
import type { OutputOnlyBuild, RandFn } from './prove'
import { defaultRand, signBinding } from './prove'

export interface AssembleShieldFromAssetLockOptions {
    /* wasm-sdk AssetLockProof instance — e.g.
     * wasm.AssetLockProof.createChainAssetLockProof(platformChainLockedHeight,
     * new wasm.OutPoint(txid, 0)). The same proof must have been used for the
     * build's shieldFromAssetLockExtraSighashData (0x86 || createIdentityId). */
    assetLockProof: unknown
    /* wasm-sdk PrivateKey instance for the asset lock (fromWIF). */
    assetLockPrivateKey: unknown
    /* The local output-only build whose frame was sent to the prover. */
    build: OutputOnlyBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    /* Optional surplus destination: 21-byte platform-address bytes or a
     * bech32m string (PlatformAddressLike). Omitted = surplus folds into the
     * fee pools (up to the implicit fee cap). */
    surplusOutput?: Uint8Array | string
    /* Optional protocol-version selector (PlatformVersionLike). */
    platformVersion?: unknown
    /* Deterministic randomness override for the binding signature (tests). */
    rand?: RandFn
}

export interface AssembledTransition {
    /* Signed transition ready for sdk.broadcastStateTransition. */
    stateTransition: unknown
    /* The signed wire bytes (also accepted by StateTransition.fromBytes). */
    wireBytes: Uint8Array
    /* The 64-byte binding signature embedded in the transition. */
    bindingSignature: Uint8Array
}

/* rs-dpp SerializedAction.encrypted_note layout (216 bytes). */
const ENCRYPTED_NOTE_SIZE = 216

/* Assemble + sign. Async because the wasm classes are loaded lazily. */
export async function assembleShieldFromAssetLock(
    options: AssembleShieldFromAssetLockOptions,
): Promise<AssembledTransition> {
    const { assetLockProof, assetLockPrivateKey, build, provedFrame, surplusOutput, platformVersion } = options
    const rand = options.rand ?? defaultRand

    /* 1. The proved frame must be the local build's frame plus a zkproof —
     * nothing else may differ (postPcztFrame enforces this for its own
     * responses; enforce it again here for frames from any other source). */
    if (!provedFrame.zkproof || provedFrame.zkproof.length === 0) {
        throw new Error('assemble: proved frame has no zkproof')
    }
    const localBytes = serializePcztFrame(build.frame)
    const provedMinusProof = serializePcztFrame({ ...provedFrame, zkproof: null })
    if (localBytes.length !== provedMinusProof.length) {
        throw new Error('assemble: proved frame does not match the local build (length)')
    }
    for (let i = 0; i < localBytes.length; i++) {
        if (localBytes[i] !== provedMinusProof[i]) {
            throw new Error(`assemble: proved frame does not match the local build (byte ${i})`)
        }
    }

    /* Shield-from-asset-lock bundles are output-only: the signed value sum
     * must be negative (value entering the pool); the transition carries the
     * positive magnitude (build_bound_bundle's checked_neg guard). */
    if (!provedFrame.valueSumIsNegative) {
        throw new Error('assemble: bundle value_balance is not negative')
    }
    const valueBalance = BigInt(provedFrame.valueSumMagnitude)

    /* 2. Map frame actions onto SerializedAction options. The spend half
     * supplies nullifier / rk / spendAuthSig; the output half supplies cmx /
     * cvNet / epk / enc / out. */
    /* Untyped: the WASM class constructors take loose option objects. */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = provedFrame.actions.map((action) => {
        const encryptedNote = new Uint8Array(ENCRYPTED_NOTE_SIZE)
        encryptedNote.set(action.output.ephemeralKey, 0)
        encryptedNote.set(action.output.encCiphertext, 32)
        encryptedNote.set(action.output.outCiphertext, 32 + action.output.encCiphertext.length)
        return new wasm.SerializedOrchardAction({
            nullifier: action.spend.nullifier,
            rk: action.spend.rk,
            cmx: action.output.cmx,
            encryptedNote,
            cvNet: action.cvNet,
            spendAuthSig: action.spend.spendAuthSig,
        })
    })

    /* 3. Binding signature over the sighash with the summed trapdoor bsk. */
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    /* 4. Build the wasm transition (empty signature placeholder), then sign
     * with the asset-lock private key. signByPrivateKey returns the signed
     * wire bytes; re-parse them for broadcast. keyId/keyType are ignored for
     * this transition type (runtime-verified). */
    const transition = new wasm.ShieldFromAssetLockTransition({
        assetLockProof,
        actions,
        valueBalance,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
        signature: new Uint8Array(0),
        ...(surplusOutput !== undefined ? { surplusOutput } : {}),
        ...(platformVersion !== undefined ? { platformVersion } : {}),
    })
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.signByPrivateKey(assetLockPrivateKey, null, undefined)

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
    }
}
