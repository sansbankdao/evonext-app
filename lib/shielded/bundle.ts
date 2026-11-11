// lib/shielded/bundle.ts
// Orchard bundle digest (ZIP-244) + Dash Platform sighash — 1:1 port of the
// fork's bundle/commitments.rs (hash_bundle_txid_data) and rs-dpp's
// shielded/sighash.rs (compute_platform_sighash + extra_data builders).
//
//   bundle_commitment = Blake2b-256("ZTxIdOrchardHash")(
//       Blake2b-256("ZTxIdOrcActCHash")((nf || cmx || epk || enc[..52])*),
//       Blake2b-256("ZTxIdOrcActMHash")(enc[52..88]*),
//       Blake2b-256("ZTxIdOrcActNHash")((cv_net || rk || enc[88..104] || out_ct)*),
//       flags(u8), value_balance(i64 LE), anchor(32))
//   sighash = SHA-256("DashPlatformSighash" || bundle_commitment || extra_data)
//
// extra_data is EMPTY for shield and shielded_transfer; the layouts below are
// the consensus-frozen v0s (rs-dpp shielded_extra_sighash_data version 0):
//   unshield:            output_address || unshielding_amount(u64 LE)
//   shielded_withdrawal: output_script || unshielding_amount(u64 LE)
//                        || core_fee_per_byte(u32 LE) || pooling(u8)
// (identity_create_from_shielded has a longer layout — added when that flow
// is ported.)
import { sha256 } from '@noble/hashes/sha2.js';
import { blake2b256Personal } from './hash';
import { COMPACT_NOTE_SIZE, DASH_MEMO_SIZE, ENC_CIPHERTEXT_SIZE, AEAD_TAG_SIZE } from './note';

export const ZCASH_ORCHARD_HASH_PERSONALIZATION = 'ZTxIdOrchardHash';
export const ZCASH_ORCHARD_ACTIONS_COMPACT_HASH_PERSONALIZATION = 'ZTxIdOrcActCHash';
export const ZCASH_ORCHARD_ACTIONS_MEMOS_HASH_PERSONALIZATION = 'ZTxIdOrcActMHash';
export const ZCASH_ORCHARD_ACTIONS_NONCOMPACT_HASH_PERSONALIZATION = 'ZTxIdOrcActNHash';
export const SIGHASH_DOMAIN = 'DashPlatformSighash';

/** FLAG_SPENDS_ENABLED | FLAG_OUTPUTS_ENABLED (bundle.rs:73-75). */
export const FLAGS_ENABLED = 0x03;

/** The effects of one Orchard action as the digest consumes them
 *  (serialized field encodings, all fixed widths). */
export interface BundleActionEffects {
  /** 32-byte nullifier encoding. */
  nullifier: Uint8Array;
  /** 32-byte extracted note commitment (cmx) encoding. */
  cmx: Uint8Array;
  /** 32-byte ephemeral public key encoding. */
  ephemeralKey: Uint8Array;
  /** 104-byte note plaintext ciphertext (Dash 36-byte memo layout). */
  encCiphertext: Uint8Array;
  /** 32-byte net value commitment (cv_net) encoding. */
  cvNet: Uint8Array;
  /** 32-byte randomized verification key (rk) encoding. */
  rk: Uint8Array;
  /** 80-byte outgoing ciphertext. */
  outCiphertext: Uint8Array;
}

function u64le(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  let x = BigInt.asUintN(64, v);
  for (let i = 0; i < 8; i++) {
    b[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return b;
}

/** hash_bundle_txid_data (bundle/commitments.rs:35-85). `valueBalance` is the
 *  bundle's SIGNED net value (i64; negative = value leaving the pool), folded
 *  as two's-complement LE exactly like Rust's i64::to_le_bytes. */
export function hashBundleTxidData(
  actions: BundleActionEffects[],
  flags: number,
  valueBalance: bigint,
  anchor: Uint8Array,
): Uint8Array {
  if (anchor.length !== 32) throw new Error('hashBundleTxidData: anchor must be 32 bytes');
  if (actions.length === 0) throw new Error('hashBundleTxidData: bundle must carry at least one action');
  if (BigInt.asIntN(64, valueBalance) !== valueBalance) {
    throw new Error('hashBundleTxidData: valueBalance overflows i64');
  }
  const chParts: Uint8Array[] = [];
  const mhParts: Uint8Array[] = [];
  const nhParts: Uint8Array[] = [];
  for (const a of actions) {
    for (const [name, field, len] of [
      ['nullifier', a.nullifier, 32],
      ['cmx', a.cmx, 32],
      ['ephemeralKey', a.ephemeralKey, 32],
      ['cvNet', a.cvNet, 32],
      ['rk', a.rk, 32],
      ['outCiphertext', a.outCiphertext, 80],
    ] as const) {
      if (field.length !== len) {
        throw new Error(`hashBundleTxidData: ${name} must be ${len} bytes, got ${field.length}`);
      }
    }
    if (a.encCiphertext.length !== ENC_CIPHERTEXT_SIZE) {
      throw new Error(
        `hashBundleTxidData: encCiphertext must be ${ENC_CIPHERTEXT_SIZE} bytes (Dash ${DASH_MEMO_SIZE}-byte memo layout), got ${a.encCiphertext.length}`,
      );
    }
    const aeadTagStart = ENC_CIPHERTEXT_SIZE - AEAD_TAG_SIZE; // 88
    chParts.push(a.nullifier, a.cmx, a.ephemeralKey, a.encCiphertext.subarray(0, COMPACT_NOTE_SIZE));
    mhParts.push(a.encCiphertext.subarray(COMPACT_NOTE_SIZE, aeadTagStart));
    nhParts.push(
      a.cvNet,
      a.rk,
      a.encCiphertext.subarray(aeadTagStart),
      a.outCiphertext,
    );
  }
  return blake2b256Personal(
    ZCASH_ORCHARD_HASH_PERSONALIZATION,
    blake2b256Personal(ZCASH_ORCHARD_ACTIONS_COMPACT_HASH_PERSONALIZATION, ...chParts),
    blake2b256Personal(ZCASH_ORCHARD_ACTIONS_MEMOS_HASH_PERSONALIZATION, ...mhParts),
    blake2b256Personal(ZCASH_ORCHARD_ACTIONS_NONCOMPACT_HASH_PERSONALIZATION, ...nhParts),
    new Uint8Array([flags & 0xff]),
    u64le(valueBalance),
    anchor,
  );
}

/** compute_platform_sighash (rs-dpp shielded/sighash.rs:35-42):
 *  SHA-256("DashPlatformSighash" || bundle_commitment || extra_data). */
export function computePlatformSighash(bundleCommitment: Uint8Array, extraData: Uint8Array): Uint8Array {
  if (bundleCommitment.length !== 32) {
    throw new Error('computePlatformSighash: bundleCommitment must be 32 bytes');
  }
  const domain = new TextEncoder().encode(SIGHASH_DOMAIN);
  const data = new Uint8Array(domain.length + bundleCommitment.length + extraData.length);
  data.set(domain, 0);
  data.set(bundleCommitment, domain.length);
  data.set(extraData, domain.length + bundleCommitment.length);
  return sha256(data);
}

/** unshield_extra_sighash_data_v0 (rs-dpp shielded/sighash.rs:137-143):
 *  output_address || unshielding_amount(u64 LE). */
export function unshieldExtraSighashData(outputAddress: Uint8Array, unshieldingAmount: bigint): Uint8Array {
  const data = new Uint8Array(outputAddress.length + 8);
  data.set(outputAddress, 0);
  data.set(u64le(unshieldingAmount), outputAddress.length);
  return data;
}

/** shielded_withdrawal_extra_sighash_data_v0 (rs-dpp shielded/sighash.rs:99-109):
 *  output_script || unshielding_amount(u64 LE) || core_fee_per_byte(u32 LE) || pooling(u8). */
export function shieldedWithdrawalExtraSighashData(
  outputScript: Uint8Array,
  unshieldingAmount: bigint,
  coreFeePerByte: number,
  pooling: number,
): Uint8Array {
  if (!Number.isInteger(coreFeePerByte) || coreFeePerByte < 0 || coreFeePerByte > 0xffffffff) {
    throw new Error('shieldedWithdrawalExtraSighashData: coreFeePerByte must be a u32 integer');
  }
  if (!Number.isInteger(pooling) || pooling < 0 || pooling > 0xff) {
    throw new Error('shieldedWithdrawalExtraSighashData: pooling must be a u8 integer');
  }
  const data = new Uint8Array(outputScript.length + 8 + 4 + 1);
  data.set(outputScript, 0);
  data.set(u64le(unshieldingAmount), outputScript.length);
  const fee = new Uint8Array(4);
  let f = coreFeePerByte;
  for (let i = 0; i < 4; i++) {
    fee[i] = f & 0xff;
    f >>= 8;
  }
  data.set(fee, outputScript.length + 8);
  data[outputScript.length + 12] = pooling;
  return data;
}
