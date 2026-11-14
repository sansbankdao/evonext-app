/*
 * lib/shielded/reference-flows.ts — end-to-end address-funds flows using the
 * consensus-exact reference wires (reference-wire.ts) and the direct grpc
 * transport (direct-grpc.ts). These bypass the vendored wasm glue's divergent
 * encoder for the two witness-carrying address-funds transition types:
 *   - type 11 IdentityTopUpFromAddresses  (Transparent → Identity)
 *   - type 15 Shield                      (Transparent → Shielded pool)
 *
 * Live-verified on testnet 2026-11-15:
 *   - type 11: input 2,000,000 → executed, fee 2,937,460, address nonce 0→1.
 *   - type 15: input 384,000,000 (shield 300M + pool fee 84M) → executed,
 *     the 300M note trial-decrypted with memo 'f51c transparent->shielded',
 *     address nonce 1→2.
 *
 * Validation rules learned from the live rejections:
 *   - the input nonce must be EXACTLY the address's current state nonce + 1;
 *   - the type-11 input must be >= the top-up + the fee (the full-balance input
 *     was rejected: the validator wants headroom — pass input = amount + margin
 *     or use `output` for the change);
 *   - the type-15 input must be >= shield amount + the pool's minimum fee
 *     (84,000,000 credits for 2 actions at protocol v14).
 */

import { broadcastWireDirect } from '../direct-grpc'
import {
    identityTopUpFromAddressesSignable,
    shieldSignable,
    signAddressWitnessSig,
    ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES,
    ST_TAG_SHIELD,
    type FeeStepWire,
    type OrchardActionHalves,
    type ReferenceWire,
} from './reference-wire'

const sha256d = async (data: Uint8Array): Promise<Uint8Array> => {
    const { sha256 } = await import('@noble/hashes/sha2.js')
    return sha256(sha256(data))
}

/* Broadcast a reference wire: sign the witnesses over sha256d(signable), finalize
 * the wire, send it over the direct grpc. Returns the skip-signature hash
 * (the transition's unique identifier, the F29d convention). */
export async function broadcastReferenceWire(
    ref: ReferenceWire,
    witnessPrivBytes: Uint8Array,
    opts?: { network?: 'mainnet' | 'testnet'; hosts?: string[] },
): Promise<{ transitionHash: string; wire: Uint8Array }> {
    const witnessSig = await signAddressWitnessSig(witnessPrivBytes, ref.signable)
    const wire = ref.finalize([witnessSig])
    await broadcastWireDirect(wire, opts)
    const digest = await sha256d(ref.signable)
    return { transitionHash: Buffer.from(digest).toString('hex'), wire }
}

/* Transparent (DIP-17 address) → Identity top-up, type 11. */
export async function topUpIdentityFromTransparent(options: {
    network: 'mainnet' | 'testnet'
    addressBytes21: Uint8Array
    addressWif: string
    addressNonce: number /* the address's CURRENT state nonce */
    identityIdBytes32: Uint8Array
    amountCredits: bigint /* the net top-up for the identity */
    feeMarginCredits?: bigint /* the default 4M covers the ~2.9M fee with headroom */
    hosts?: string[]
}): Promise<{ transitionHash: string; inputCredits: bigint }> {
    const feeMargin = options.feeMarginCredits ?? 4_000_000n
    const inputCredits = options.amountCredits + feeMargin
    const wasm = await import('../dash-wasm/wasm_sdk')
    const identityIdBytes32 = options.identityIdBytes32
    const ref = identityTopUpFromAddressesSignable({
        addressBytes21: options.addressBytes21,
        addressNonce: options.addressNonce,
        inputCredits,
        identityIdBytes32,
    })
    const priv = wasm.PrivateKey.fromWIF(options.addressWif).toBytes()
    const { transitionHash } = await broadcastReferenceWire(ref, priv, {
        network: options.network,
        hosts: options.hosts,
    })
    return { transitionHash, inputCredits }
}

/* Transparent (DIP-17 address) → Shielded pool, type 15. The build/prove side
 * (the PCZT frame, the zk proof, the binding signature) comes from the existing
 * prover flow (buildOutputOnlyPczt + postPcztFrame) — those artifacts are
 * wire-encoding-independent. Only the wire assembly + the witness sig + the
 * transport happen here. */
export async function shieldFromTransparentDirect(options: {
    network: 'mainnet' | 'testnet'
    addressBytes21: Uint8Array
    addressWif: string
    addressNonce: number
    actions: OrchardActionHalves[]
    shieldAmount: bigint /* the pool's gain = the frame's value-sum magnitude */
    anchor: Uint8Array
    proof: Uint8Array
    bindingSignature: Uint8Array
    poolMinimumFee: bigint /* 84,000,000 for 2 actions at protocol v14 */
    feeSteps?: FeeStepWire[]
    hosts?: string[]
}): Promise<{ transitionHash: string; inputCredits: bigint }> {
    const inputCredits = options.shieldAmount + options.poolMinimumFee
    const ref = shieldSignable({
        addressBytes21: options.addressBytes21,
        addressNonce: options.addressNonce,
        inputCredits,
        actions: options.actions,
        amount: options.shieldAmount,
        anchor: options.anchor,
        proof: options.proof,
        bindingSignature: options.bindingSignature,
        feeSteps: options.feeSteps,
    })
    const wasm = await import('../dash-wasm/wasm_sdk')
    const priv = wasm.PrivateKey.fromWIF(options.addressWif).toBytes()
    const { transitionHash } = await broadcastReferenceWire(ref, priv, {
        network: options.network,
        hosts: options.hosts,
    })
    return { transitionHash, inputCredits }
}
