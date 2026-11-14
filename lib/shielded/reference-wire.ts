/*
 * lib/shielded/reference-wire.ts — consensus-exact (rs-dpp bincode) wire builders
 * for the address-funds state transitions the vendored wasm glue encodes DIVERGENTLY
 * (proven 2026-11-15: the glue's IdentityTopUpFromAddressesTransition / ShieldTransition
 * wires are the correct bytes SHIFTED RIGHT BY 4 BITS from the inputs' nonce onward, so
 * every broadcast through wasm StateTransition::to_bytes fails drive deserialization).
 *
 * Ground truth for the encoding (real bincode 2.0.1, standard config + big-endian):
 *   - varint (SINGLE_BYTE_MAX=250): <=250 1 byte; 0xFB u16-BE; 0xFC u32-BE; 0xFD u64-BE.
 *   - enum: u32-varint variant tag, then the payload fields in declaration order.
 *   - Vec/Map: u64-varint length, then the elements.
 *   - Option: u32-varint variant (0 = None), then the payload when Some.
 *   - Vec<u8> payload (BinaryData): u64-varint length then the raw bytes.
 *
 * Struct field orders (rs-dpp v5.0.0-rc.8 = rc.5, sources identical):
 *   IdentityTopUpFromAddressesTransitionV0:
 *     {inputs: BTreeMap<PlatformAddress,(AddressNonce u32, Credits u64)>,
 *      output: Option<(PlatformAddress, Credits)>,
 *      identity_id: [u8;32], fee_strategy: Vec<AddressFundsFeeStrategyStep>,
 *      user_fee_increase: u8, input_witnesses: Vec<AddressWitness>}
 *   ShieldTransitionV0:
 *     {inputs: BTreeMap<PlatformAddress,(AddressNonce u32, Credits u64)>,
 *      actions: Vec<SerializedOrchardAction>, amount: Credits (u64, positive),
 *      anchor: [u8;32], proof: Vec<u8>, binding_signature: [u8;64],
 *      fee_strategy: Vec<Step>, user_fee_increase: u8, input_witnesses: Vec<AddressWitness>}
 *   SerializedOrchardAction: {nullifier[32], rk[32], cmx[32],
 *      encrypted_note: Vec<u8> (216), cv_net[32], spend_auth_sig[64]}
 *   AddressWitness::P2pkh(Vec<u8>) — the witness sig = LENGTH-PREFIXED (BinaryData).
 *   Witness-only authorization (NO identity-signature field on either struct).
 *
 * Address-nonce rule (rs-drive-abci validate_address_balances_and_nonces, rc.5):
 *   the transition's input nonce must be EXACTLY state_nonce + 1.
 */

/* bincode standard+BE varint for u64/u32/u16 (values are value-based, not width-based). */
export function varintU64(v: bigint): number[] {
    if (v < 0n) throw new Error('varintU64: negative')
    if (v <= 250n) return [Number(v)]
    if (v <= 0xffffn) return [0xfb, Number(v >> 8n) & 0xff, Number(v) & 0xff]
    if (v <= 0xffffffffn) {
        const b = new Uint8Array(4)
        new DataView(b.buffer).setUint32(0, Number(v))
        return [0xfc, ...b]
    }
    const b = new Uint8Array(8)
    new DataView(b.buffer).setBigUint64(0, v)
    return [0xfd, ...b]
}

/* SerializedOrchardAction bincode encoding. */
export interface OrchardActionHalves {
    nullifier: Uint8Array
    rk: Uint8Array
    cmx: Uint8Array
    encryptedNote: Uint8Array /* 216 bytes: epk(32) || enc(104) || out(80) */
    cvNet: Uint8Array
    spendAuthSig: Uint8Array
}

export function encodeOrchardAction(a: OrchardActionHalves): number[] {
    if (a.nullifier.length !== 32 || a.rk.length !== 32 || a.cmx.length !== 32) {
        throw new Error('encodeOrchardAction: nf/rk/cmx must be 32 bytes')
    }
    if (a.encryptedNote.length !== 216) throw new Error('encodeOrchardAction: encryptedNote must be 216 bytes')
    if (a.cvNet.length !== 32) throw new Error('encodeOrchardAction: cvNet must be 32 bytes')
    if (a.spendAuthSig.length !== 64) throw new Error('encodeOrchardAction: spendAuthSig must be 64 bytes')
    return [
        ...a.nullifier,
        ...a.rk,
        ...a.cmx,
        ...varintU64(BigInt(a.encryptedNote.length)),
        ...a.encryptedNote,
        ...a.cvNet,
        ...a.spendAuthSig,
    ]
}

/* The map entry for one spending address: [00 P2pkh][hash20][nonce varint][credits varint]. */
export function encodeInputEntry(addressBytes21: Uint8Array, nonce: number, credits: bigint): number[] {
    if (addressBytes21.length !== 21 || addressBytes21[0] !== 0) {
        throw new Error('encodeInputEntry: addressBytes must be the 21-byte P2pkh form (tag 0 || hash160)')
    }
    return [...addressBytes21, ...varintU64(BigInt(nonce)), ...varintU64(credits)]
}

/* feeStrategy: Vec<Step> — [{type:'deductFromInput'|'reduceOutput', index}] → bincode. */
export interface FeeStepWire {
    type: 'deductFromInput' | 'reduceOutput'
    index: number
}

export function encodeFeeStrategy(steps: FeeStepWire[]): number[] {
    const out: number[] = [...varintU64(BigInt(steps.length))]
    for (const s of steps) {
        if (s.index < 0 || s.index > 0xffff) throw new Error('encodeFeeStrategy: index must fit u16')
        out.push(s.type === 'deductFromInput' ? 0x00 : 0x01)
        out.push(...varintU64(BigInt(s.index)))
    }
    return out
}

/* input_witnesses: Vec<AddressWitness> — [len][00 P2pkh][len-varint][65-byte sig] each. */
export function encodeWitnessBlock(sig65s: Uint8Array[]): number[] {
    const out: number[] = [...varintU64(BigInt(sig65s.length))]
    for (const sig of sig65s) {
        if (sig.length !== 65) throw new Error('encodeWitnessBlock: witness sig must be 65 bytes')
        out.push(0x00, ...varintU64(BigInt(sig.length)), ...sig)
    }
    return out
}

const concat = (parts: number[][]): Uint8Array => {
    const total = parts.reduce((a, p) => a + p.length, 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const p of parts) { out.set(new Uint8Array(p), off); off += p.length }
    return out
}

/* Umbrella tags (the StateTransition declaration index = the ST type number). */
export const ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES = 0x0b
export const ST_TAG_SHIELD = 0x0f
export const ST_VERSION_V0 = 0x00

export interface IdentityTopUpFromAddressesWireParts {
    addressBytes21: Uint8Array
    addressNonce: number /* the CURRENT state nonce; the wire carries current+1 */
    inputCredits: bigint /* gross input; must be >= identity top-up + fee */
    identityIdBytes32: Uint8Array
    output?: { addressBytes21: Uint8Array; credits: bigint }
    feeSteps?: FeeStepWire[]
    userFeeIncrease?: number
}

export interface ReferenceWire {
    /* The signable bytes (the umbrella tag + version + the fields, the witnesses excluded). */
    signable: Uint8Array
    /* Append the witness signatures and get the complete broadcast-ready wire. */
    finalize: (witnessSig65s: Uint8Array[]) => Uint8Array
}

export function identityTopUpFromAddressesSignable(p: IdentityTopUpFromAddressesWireParts): ReferenceWire {
    const feeSteps = p.feeSteps ?? [{ type: 'deductFromInput' as const, index: 0 }]
    const fields: number[][] = [
        [0x01, ...encodeInputEntry(p.addressBytes21, p.addressNonce + 1, p.inputCredits)], // the map length + the entry
        p.output ? [0x01, ...p.output.addressBytes21, ...varintU64(p.output.credits)] : [0x00],
        [...p.identityIdBytes32],
        encodeFeeStrategy(feeSteps),
        [p.userFeeIncrease ?? 0],
    ]
    const signable = concat([[ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES, ST_VERSION_V0], ...fields])
    return {
        signable,
        finalize: (sig65s) => concat([[ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES, ST_VERSION_V0], ...fields, encodeWitnessBlock(sig65s)]),
    }
}

export interface ShieldWireParts {
    addressBytes21: Uint8Array
    addressNonce: number
    inputCredits: bigint /* gross input; must be >= shield amount + the pool's minimum fee */
    actions: OrchardActionHalves[]
    amount: bigint /* the shield amount = the pool's gain (the value_sum magnitude) */
    anchor: Uint8Array /* 32 bytes */
    proof: Uint8Array
    bindingSignature: Uint8Array /* 64 bytes */
    feeSteps?: FeeStepWire[]
    userFeeIncrease?: number
}

export function shieldSignable(p: ShieldWireParts): ReferenceWire {
    const feeSteps = p.feeSteps ?? [{ type: 'deductFromInput' as const, index: 0 }]
    if (p.anchor.length !== 32) throw new Error('shieldSignable: anchor must be 32 bytes')
    if (p.bindingSignature.length !== 64) throw new Error('shieldSignable: bindingSignature must be 64 bytes')
    const fields: number[][] = [
        [0x01, ...encodeInputEntry(p.addressBytes21, p.addressNonce + 1, p.inputCredits)], // the map length + the entry
        [...varintU64(BigInt(p.actions.length)), ...p.actions.flatMap(encodeOrchardAction)],
        [...varintU64(p.amount)],
        [...p.anchor],
        [...varintU64(BigInt(p.proof.length)), ...p.proof],
        [...p.bindingSignature],
        encodeFeeStrategy(feeSteps),
        [p.userFeeIncrease ?? 0],
    ]
    const signable = concat([[ST_TAG_SHIELD, ST_VERSION_V0], ...fields])
    return {
        signable,
        finalize: (sig65s) => concat([[ST_TAG_SHIELD, ST_VERSION_V0], ...fields, encodeWitnessBlock(sig65s)]),
    }
}

/* The ECDSA address-witness signature over sha256d(signable): noble recovered
 * format [recid(0..3), r(32), s(32)] → the Dash wire [31+recid, r, s] low-S
 * (rs-dashcore test: rec[0] == 31 + id, compressed keys). */
export async function signAddressWitnessSig(
    privBytes: Uint8Array,
    signable: Uint8Array,
): Promise<Uint8Array> {
    const { secp256k1 } = await import('@noble/curves/secp256k1.js')
    const { sha256 } = await import('@noble/hashes/sha2.js')
    const digest = sha256(sha256(signable))
    const rec = secp256k1.sign(digest, privBytes, { prehash: false, format: 'recovered' })
    const recid = rec[0]
    const out = new Uint8Array(65)
    out[0] = 31 + recid
    out.set(rec.slice(1, 33), 1)
    out.set(rec.slice(33, 65), 33)
    return out
}
