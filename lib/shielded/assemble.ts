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

import type { PcztFrame, PcztAction } from './pczt-wire'
import { serializePcztFrame } from './pczt-wire'
import type { OutputOnlyBuild, TransferBuild, RandFn } from './prove'
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

/* Map the frame's action halves onto rs-dpp's SerializedAction layout: the
 * spend half supplies nullifier / rk / spendAuthSig; the output half supplies
 * cmx / cvNet / epk / enc / out (encryptedNote = epk(32) || enc_ciphertext
 * (104) || out_ciphertext(80) = 216 bytes — serialize_authorized_bundle,
 * rc.8 packages/rs-dpp/src/shielded/builder/mod.rs:134). Untyped: the WASM
 * class constructors take loose option objects. */
function mapActionsToWasm(wasm: any, actions: PcztAction[]): unknown[] {
    return actions.map((action) => {
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
}

/* Re-validate a proved frame against the local build: the prover must not
 * have changed anything outside the zkproof (postPcztFrame enforces this for
 * its own responses; enforce it again here for frames from any other source). */
function assertProvedFrameMatchesBuild(
    localFrame: PcztFrame,
    provedFrame: PcztFrame,
): void {
    if (!provedFrame.zkproof || provedFrame.zkproof.length === 0) {
        throw new Error('assemble: proved frame has no zkproof')
    }
    const localBytes = serializePcztFrame(localFrame)
    const provedMinusProof = serializePcztFrame({ ...provedFrame, zkproof: null })
    if (localBytes.length !== provedMinusProof.length) {
        throw new Error('assemble: proved frame does not match the local build (length)')
    }
    for (let i = 0; i < localBytes.length; i++) {
        if (localBytes[i] !== provedMinusProof[i]) {
            throw new Error(`assemble: proved frame does not match the local build (byte ${i})`)
        }
    }
}

/* Assemble + sign. Async because the wasm classes are loaded lazily. */
export async function assembleShieldFromAssetLock(
    options: AssembleShieldFromAssetLockOptions,
): Promise<AssembledTransition> {
    const { assetLockProof, assetLockPrivateKey, build, provedFrame, surplusOutput, platformVersion } = options
    const rand = options.rand ?? defaultRand

    /* 1. The proved frame must be the local build's frame plus a zkproof —
     * nothing else may differ. */
    assertProvedFrameMatchesBuild(build.frame, provedFrame)

    /* Shield-from-asset-lock bundles are output-only: the signed value sum
     * must be negative (value entering the pool); the transition carries the
     * positive magnitude (build_bound_bundle's checked_neg guard). */
    if (!provedFrame.valueSumIsNegative) {
        throw new Error('assemble: bundle value_balance is not negative')
    }
    const valueBalance = BigInt(provedFrame.valueSumMagnitude)

    /* 2. Map frame actions onto SerializedAction options. */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)

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

export interface AssembleShieldedTransferOptions {
    /* The local transfer build whose frame was sent to the prover. */
    build: TransferBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    /* Deterministic randomness override for the binding signature (tests). */
    rand?: RandFn
}

/* Assembly of a protocol-v14 ShieldedTransferTransition (v0) from a proved
 * PCZT frame. Unlike the shield flows there is NO asset-lock proof and NO
 * outer signature: ShieldedTransferTransitionV0 carries exactly
 * {actions, value_balance, anchor, proof, binding_signature} (rs-dpp
 * shielded_transfer_transition/v0/mod.rs) — authorization lives entirely
 * inside the bundle (spendAuthSig per spend + the binding signature).
 * value_balance = the fee LEAVING the pool (positive; the frame's value sum
 * must be non-negative). */
export async function assembleShieldedTransfer(
    options: AssembleShieldedTransferOptions,
): Promise<AssembledTransition> {
    const { build, provedFrame } = options
    const rand = options.rand ?? defaultRand

    /* 1. The proved frame must be the local build's frame plus a zkproof. */
    assertProvedFrameMatchesBuild(build.frame, provedFrame)

    /* Transfer bundles spend INTO a fee: the signed value sum must be
     * positive (inputs exceed outputs by the fee). */
    if (provedFrame.valueSumIsNegative || provedFrame.valueSumMagnitude === 0n) {
        throw new Error('assemble: transfer bundle value_balance must be positive (it is the fee)')
    }
    const valueBalance = BigInt(provedFrame.valueSumMagnitude)

    /* 2. Map frame actions onto SerializedAction options. */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)

    /* 3. Binding signature over the sighash with the summed trapdoor bsk. */
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    /* 4. Build the wasm transition. No signature step exists for this type —
     * the state transition is broadcast exactly as constructed. */
    const transition = new wasm.ShieldedTransferTransition({
        actions,
        valueBalance,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
    })
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.toBytes()

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
    }
}

export interface AssembleShieldedWithdrawalOptions {
    /* The local spend build whose frame was sent to the prover (built with
     * buildTransferPczt + extraSighashData =
     * shieldedWithdrawalExtraSighashData(...)). */
    build: TransferBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    /* Core fee rate (u32). Consensus: non-zero Fibonacci, >= 1
     * (MIN_CORE_FEE_PER_BYTE); pinned into the sighash. */
    coreFeePerByte: number
    /* Pooling strategy (u8). Consensus: must be 0 (Pooling::Never — pooling
     * is not yet supported). */
    pooling: number
    /* Canonical Core output script receiving the funds (P2PKH 25 bytes or
     * P2SH 23 bytes — consensus rejects anything else). */
    outputScript: Uint8Array
    /* Deterministic randomness override for the binding signature (tests). */
    rand?: RandFn
}

/* Assembly of a protocol-v14 ShieldedWithdrawalTransition (v0) from a proved
 * PCZT frame (rs-dpp shielded_withdrawal_transition/v0/mod.rs). Like the
 * transfer there is NO outer signature — the transition is exactly {actions,
 * unshielding_amount, anchor, proof, binding_signature, core_fee_per_byte,
 * pooling, output_script}; authorization is the in-bundle binding signature,
 * which also authorizes the Core-facing fields via the sighash extra_data.
 * unshielding_amount = the frame's value balance = withdrawal_amount + fee
 * (the total credits leaving the pool). */
export async function assembleShieldedWithdrawal(
    options: AssembleShieldedWithdrawalOptions,
): Promise<AssembledTransition> {
    const { build, provedFrame } = options
    const rand = options.rand ?? defaultRand

    /* 1. The proved frame must be the local build's frame plus a zkproof. */
    assertProvedFrameMatchesBuild(build.frame, provedFrame)

    /* 2. The bundle spends INTO the withdrawal + fee: the signed value sum
     * must be positive (unshielding_amount > 0 per consensus). */
    if (provedFrame.valueSumIsNegative || provedFrame.valueSumMagnitude === 0n) {
        throw new Error('assemble: withdrawal bundle value_balance must be positive (unshielding_amount)')
    }
    const unshieldingAmount = BigInt(provedFrame.valueSumMagnitude)

    /* 3. Map frame actions onto SerializedAction options. */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)

    /* 4. Binding signature over the sighash with the summed trapdoor bsk. */
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    /* 5. Build the wasm transition. No signature step exists for this type —
     * the state transition is broadcast exactly as constructed. */
    const transition = new wasm.ShieldedWithdrawalTransition({
        actions,
        unshieldingAmount,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
        coreFeePerByte: options.coreFeePerByte,
        pooling: options.pooling,
        outputScript: options.outputScript,
    })
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.toBytes()

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
    }
}

export interface AssembleShieldFromIdentityOptions {
    /* The shielded identity id (32 bytes) whose balance funds the shield. */
    identityId: Uint8Array
    /* The net shield amount in credits (the identity is debited amount +
     * the metered fee). */
    amount: bigint
    /* The identity's CURRENT nonce (chain-read via getIdentityNonce). The
     * transition carries CURRENT + 1 (live-verified 2026-11-14: the bare
     * current value is rejected — 'invalid identity nonce ... we are
     * setting N, error is nonce already present at tip'); the increment is
     * applied HERE so callers pass exactly what getIdentityNonce returns. */
    nonce: bigint
    /* The local output-only build whose frame was sent to the prover (built
     * with buildOutputOnlyPczt + extraSighashData =
     * shieldFromIdentityExtraSighashData(identityId)). */
    build: OutputOnlyBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    /* The identity's TRANSFER key (purpose .../n=3) PrivateKeyWASM instance —
     * ShieldFromIdentity is identity-signed with a TRANSFER key
     * (rs-dpp builder/shield_from_identity.rs doc comment). */
    transferPrivateKey: unknown
    /* The transfer key's identity key id (e.g. 3) for signaturePublicKeyId. */
    transferKeyId: number
    platformVersion?: unknown
    rand?: RandFn
}

/* Assembly of a protocol-v14 ShieldFromIdentityTransition (v0, umbrella
 * type 21) from a proved output-only PCZT frame. Runtime-verified F51a:
 * constructor takes {identityId, amount, actions, anchor, proof,
 * bindingSignature, nonce, userFeeIncrease}; the class exposes writable
 * signature/signaturePublicKeyId for the identity signature; the wire =
 * 0x15 || 0x00. The identity signature signs SHA256d(getSignableBytes())
 * with the TRANSFER key (signByPrivateKey). */
export async function assembleShieldFromIdentity(
    options: AssembleShieldFromIdentityOptions,
): Promise<AssembledTransition & { signaturePublicKeyId: number }> {
    const { identityId, amount, nonce, build, provedFrame, transferPrivateKey, transferKeyId, platformVersion } = options
    const rand = options.rand ?? defaultRand

    /* 1. The proved frame must be the local build's frame plus a zkproof. */
    assertProvedFrameMatchesBuild(build.frame, provedFrame)

    /* 2. Output-only: value enters the pool (negative sum). */
    if (!provedFrame.valueSumIsNegative) {
        throw new Error('assemble: shield-from-identity bundle value_balance is not negative')
    }
    const valueBalance = BigInt(provedFrame.valueSumMagnitude)

    /* 3. Map frame actions + binding signature. */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    /* 4. Build the transition, then identity-sign it with the TRANSFER key. */
    const transition = new wasm.ShieldFromIdentityTransition({
        identityId,
        amount,
        actions,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
        nonce: nonce + 1n,
        userFeeIncrease: 0,
        ...(platformVersion !== undefined ? { platformVersion } : {}),
    })
    transition.signature = new Uint8Array(0)
    transition.signaturePublicKeyId = transferKeyId
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.signByPrivateKey(transferPrivateKey, transferKeyId, undefined)

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
        signaturePublicKeyId: transferKeyId,
    }
}

export interface AssembleUnshieldOptions {
    /* The destination transparent platform address (21 raw bytes type||hash,
     * a bech32m string, or a wasm PlatformAddress instance). */
    outputAddress: Uint8Array | string | unknown
    /* The local spend build whose frame was sent to the prover (built with
     * buildTransferPczt + extraSighashData =
     * unshieldExtraSighashData(outputAddress21, required)). */
    build: TransferBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    platformVersion?: unknown
    rand?: RandFn
}

/* Assembly of a protocol-v14 UnshieldTransition (v0, umbrella type 17) from
 * a proved spend PCZT frame: {outputAddress, actions, unshieldingAmount,
 * anchor, proof, bindingSignature} — binding-sig-only, NO outer signature
 * (F51a). unshieldingAmount = required = frame value balance = the NET to
 * the output address + the consensus fee. */
export async function assembleUnshield(
    options: AssembleUnshieldOptions,
): Promise<AssembledTransition> {
    const { build, provedFrame, outputAddress, platformVersion } = options
    const rand = options.rand ?? defaultRand

    assertProvedFrameMatchesBuild(build.frame, provedFrame)
    if (provedFrame.valueSumIsNegative || provedFrame.valueSumMagnitude === 0n) {
        throw new Error('assemble: unshield bundle value_balance must be positive (unshielding_amount)')
    }
    const unshieldingAmount = BigInt(provedFrame.valueSumMagnitude)

    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    const transition = new wasm.UnshieldTransition({
        outputAddress,
        actions,
        unshieldingAmount,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
        ...(platformVersion !== undefined ? { platformVersion } : {}),
    })
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.toBytes()

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
    }
}

export interface AssembleIdentityTopUpFromShieldedPoolOptions {
    /* The identity id (32 bytes) to top up. */
    identityId: Uint8Array
    /* GROSS credits leaving the pool = the bundle's value balance = net +
     * fee (rs-dpp v0/mod.rs struct doc: 'top_up_amount — Gross credits
     * leaving the pool (the bundle's value balance). The identity is
     * credited top_up_amount - fee'). The net is derived by consensus. */
    topUpAmount: bigint
    /* The local spend build (built with buildTransferPczt + extraSighashData
     * = identityTopUpFromShieldedExtraSighashData(identityId, required)). */
    build: TransferBuild
    /* The proved frame returned by postPcztFrame (zkproof !== null). */
    provedFrame: PcztFrame
    platformVersion?: unknown
    rand?: RandFn
}

/* Assembly of a protocol-v14 IdentityTopUpFromShieldedPoolTransition (v0,
 * umbrella type 22): {identityId, actions, topUpAmount, anchor, proof,
 * bindingSignature} — binding-sig-only, NO outer signature (F51a: 'there is
 * no platform signature'). topUpAmount = the NET credited to the identity;
 * the frame's value balance = net + the consensus fee. */
export async function assembleIdentityTopUpFromShieldedPool(
    options: AssembleIdentityTopUpFromShieldedPoolOptions,
): Promise<AssembledTransition> {
    const { identityId, topUpAmount, build, provedFrame, platformVersion } = options
    const rand = options.rand ?? defaultRand

    assertProvedFrameMatchesBuild(build.frame, provedFrame)
    if (provedFrame.valueSumIsNegative || provedFrame.valueSumMagnitude === 0n) {
        throw new Error('assemble: top-up bundle value_balance must be positive (gross)')
    }
    const valueBalance = BigInt(provedFrame.valueSumMagnitude)
    /* Live-hit 2026-11-14: consensus requires top_up_amount == the bundle's
     * value balance EXACTLY (gross == -value_sum); passing the net produced
     * 'bundle verification failed: proof, spend auth signatures, or
     * binding signature invalid'. */
    if (topUpAmount !== valueBalance) {
        throw new Error(`assemble: topUpAmount (${topUpAmount}) must equal the bundle's gross value balance (${valueBalance})`)
    }

    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const actions = mapActionsToWasm(wasm, provedFrame.actions)
    const bindingSignature = signBinding(build.bsk, build.sighash, rand(80)).sig

    const transition = new wasm.IdentityTopUpFromShieldedPoolTransition({
        identityId,
        actions,
        topUpAmount,
        anchor: provedFrame.anchor,
        proof: provedFrame.zkproof,
        bindingSignature,
        ...(platformVersion !== undefined ? { platformVersion } : {}),
    })
    const stateTransition = transition.toStateTransition()
    const wireBytes: Uint8Array = stateTransition.toBytes()

    return {
        stateTransition: wasm.StateTransition.fromBytes(wireBytes),
        wireBytes,
        bindingSignature,
    }
}
