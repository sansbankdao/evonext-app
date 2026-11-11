// lib/shielded/keys.ts
// Orchard key derivation (ZIP-32 + spending key -> FVK -> IVK), ported 1:1 from the
// Dash orchard fork (cargo git checkout orchard-94d8ef6bfc19d6d0/38ac9c1):
//   zip32.rs  — master/child derivation ("ZcashIP32Orchard", PrfExpand::ORCHARD_ZIP32_CHILD)
//   keys.rs   — SpendingKey::from_zip32_seed, ask/nk/rivk, the SpendAuthorizingKey
//               ỹ=0 negation rule (keys.rs:147-151), FullViewingKey, commit_ivk,
//               derive_dk_ovk, derive_internal, DiversifierKey::get (FF1), Address
//   spec.rs   — to_scalar/to_base (from_uniform_bytes), mod_r_p, diversify_hash
//
// The ExtendedSpendingKey's depth/parent_fvk_tag/child_index bookkeeping is not
// reimplemented (the viewer consumes only the raw spending key bytes); the tag is
// internal to zip32's own tests.

import { FR_MOD, PallasPoint, bigintToBytes32LE, fr, frFromUniformBytes64, fpFromUniformBytes64 } from './pasta';
import { KDF_ORCHARD_PERSONALIZATION, PrfExpand, ZIP32_ORCHARD_PERSONALIZATION, blake2b256Personal, blake2b512Personal, prfExpand } from './hash';
import { hashToPallas } from './swu';
import { sinsemillaShortCommit } from './sinsemilla';
import { diversifyIndexToBytes } from './ff1';

/** ZIP32_PURPOSE (zip32.rs). */
export const ZIP32_PURPOSE = 32;

/** Personalizations (constants.rs). */
export const ORCHARD_PERSONALIZATION = 'z.cash:Orchard';
export const KEY_DIVERSIFICATION_PERSONALIZATION = 'z.cash:Orchard-gd';
export const NOTE_COMMITMENT_PERSONALIZATION = 'z.cash:Orchard-NoteCommit';
export const COMMIT_IVK_PERSONALIZATION = 'z.cash:Orchard-CommitIvk';

/** L_ORCHARD_BASE (constants.rs). */
export const L_ORCHARD_BASE = 255;

/** G^Orchard = hash_to_curve("pallas", "z.cash:Orchard")(b"G") — lazily computed once. */
let spendAuthG: PallasPoint | null = null;
export function getSpendAuthG(): PallasPoint {
  if (!spendAuthG) {
    spendAuthG = hashToPallas('pallas', ORCHARD_PERSONALIZATION, new TextEncoder().encode('G'));
  }
  return spendAuthG;
}

/** to_scalar(x) = pallas::Scalar::from_uniform_bytes(x) (spec.rs:187). */
export function toScalar(x: Uint8Array): bigint {
  return frFromUniformBytes64(x);
}

/** to_base(x) = pallas::Base::from_uniform_bytes(x) (spec.rs:196). */
export function toBase(x: Uint8Array): bigint {
  return fpFromUniformBytes64(x);
}

/** mod_r_p(x) = Scalar::from_repr(Base::to_repr(x)) (spec.rs:215) — valid because q_P < r_P. */
export function modRP(x: bigint): bigint {
  return x % FR_MOD;
}

/** ZIP-32 master derivation: I = BLAKE2b-512("ZcashIP32Orchard", seed), split 32/32. */
export function zip32Master(seed: Uint8Array): { sk: Uint8Array; chainCode: Uint8Array } {
  if (seed.length < 32) throw new Error('zip32Master: seed must be at least 32 bytes');
  const I = blake2b512Personal(ZIP32_ORCHARD_PERSONALIZATION, seed);
  return { sk: I.slice(0, 32), chainCode: I.slice(32, 64) };
}

/** ZIP-32 child derivation (hardened-only in this fork): PRF^expand(c_par, [0x81] || sk_par || i_le). */
export function zip32DeriveChild(
  sk: Uint8Array,
  chainCode: Uint8Array,
  index: number,
): { sk: Uint8Array; chainCode: Uint8Array } {
  const iLe = new Uint8Array(4);
  new DataView(iLe.buffer).setUint32(0, index >>> 0, true);
  const I = prfExpand(PrfExpand.ORCHARD_ZIP32_CHILD, chainCode, sk, iLe);
  return { sk: I.slice(0, 32), chainCode: I.slice(32, 64) };
}

/**
 * SpendingKey::from_zip32_seed(seed, coin_type, account) (keys.rs:138-...):
 * path m/32'/coin_type'/account', all hardened. Rejects coin_type >= 2^31.
 */
export function spendingKeyFromSeed(seed: Uint8Array, coinType: number, account: number): Uint8Array {
  // NOTE: Rust checks `coin_type >= (1 << 31)` on a u32; in JS `1 << 31` is the SIGNED
  // value -2^31, so the bound must be written as 0x80000000.
  if (coinType >= 0x80000000) throw new Error('spendingKeyFromSeed: coin_type must be smaller than 2^31');
  let node = zip32Master(seed);
  for (const i of [ZIP32_PURPOSE, coinType, account]) {
    node = zip32DeriveChild(node.sk, node.chainCode, (i | 0x80000000) >>> 0);
  }
  return node.sk;
}

/**
 * SpendAuthorizingKey derivation including the ỹ=0 negation rule (keys.rs From impl):
 * ask_raw = to_scalar(PRF^expand(sk, [0x06])); ak = [ask_raw]G; if the compressed
 * ak has its sign bit set (y odd), ask = -ask_raw and ak = -ak.
 */
export function deriveAskAndAk(sk: Uint8Array): { ask: bigint; ak: PallasPoint } {
  const askRaw = toScalar(prfExpand(PrfExpand.ORCHARD_ASK, sk));
  let ask = askRaw;
  let ak = getSpendAuthG().mul(askRaw);
  const akBytes = ak.toBytes();
  if ((akBytes[31] >> 7) === 1) {
    ask = fr.neg(askRaw);
    ak = ak.negate();
  }
  return { ask, ak };
}

/** An Orchard full viewing key (keys.rs FullViewingKey). */
export interface FullViewingKeyParts {
  /** ak — spend validating key (pallas point; NEVER the identity by construction). */
  ak: PallasPoint;
  /** nk — nullifier deriving key (pallas base field element). */
  nk: bigint;
  /** rivk — commit_ivk randomness (pallas scalar field element). */
  rivk: bigint;
}

/** FullViewingKey::from(&sk) (keys.rs:322-...): ak/nk/rivk from the spending key. */
export function fullViewingKeyFromSpendingKey(sk: Uint8Array): FullViewingKeyParts {
  const { ak } = deriveAskAndAk(sk);
  const nk = toBase(prfExpand(PrfExpand.ORCHARD_NK, sk));
  const rivk = toScalar(prfExpand(PrfExpand.ORCHARD_RIVK, sk));
  return { ak, nk, rivk };
}

/**
 * commit_ivk(ak, nk, rivk) (keys.rs:494-...):
 * SinsemillaShortCommit(ak_x || nk (each 255 bits LSB-first), rivk)
 * over the "z.cash:Orchard-CommitIvk" domain.
 */
export function commitIvk(ak: PallasPoint, nk: bigint, rivk: bigint): bigint {
  const akRepr = ak.extractP();
  if (akRepr === null) throw new Error('commitIvk: ak is the identity');
  const bits: number[] = [];
  for (const v of [akRepr, nk]) {
    for (let i = 0; i < L_ORCHARD_BASE; i++) bits.push(Number((v >> BigInt(i)) & 1n));
  }
  return sinsemillaShortCommit(COMMIT_IVK_PERSONALIZATION, bits, rivk);
}

/** KeyAgreementPrivateKey::from_fvk = mod_r_p(commit_ivk(...)) (keys.rs:478-...). */
export function ivkFromFvk(fvk: FullViewingKeyParts): bigint {
  return modRP(commitIvk(fvk.ak, fvk.nk, fvk.rivk));
}

/**
 * FullViewingKey::derive_internal (keys.rs:439-...): same ak/nk,
 * rivk_internal = to_scalar(PRF^expand([0x09], rivk_repr || ak_bytes || nk_bytes)).
 */
export function deriveInternalFvk(fvk: FullViewingKeyParts): FullViewingKeyParts {
  const rivkRepr = bigintToBytes32LE(fvk.rivk);
  const akBytes = fvk.ak.toBytes();
  const nkBytes = bigintToBytes32LE(fvk.nk);
  const rivkInternal = toScalar(prfExpand(PrfExpand.ORCHARD_RIVK_INTERNAL, rivkRepr, akBytes, nkBytes));
  return { ak: fvk.ak, nk: fvk.nk, rivk: rivkInternal };
}

/**
 * FullViewingKey::derive_dk_ovk (keys.rs:369-...):
 * PRF^expand([0x10], rivk_repr || ak_bytes || nk_bytes) -> dk (first 32) || ovk (last 32).
 */
export function deriveDkOvk(fvk: FullViewingKeyParts): { dk: Uint8Array; ovk: Uint8Array } {
  const rivkRepr = bigintToBytes32LE(fvk.rivk);
  const akBytes = fvk.ak.toBytes();
  const nkBytes = bigintToBytes32LE(fvk.nk);
  const out = prfExpand(PrfExpand.ORCHARD_DK_OVK, rivkRepr, akBytes, nkBytes);
  return { dk: out.slice(0, 32), ovk: out.slice(32, 64) };
}

/** diversify_hash(d) (spec.rs:222-...): group hash with identity fallback to the empty message. */
export function diversifyHash(d: Uint8Array): PallasPoint {
  const point = hashToPallas('pallas', KEY_DIVERSIFICATION_PERSONALIZATION, d);
  if (point.isIdentity()) {
    return hashToPallas('pallas', KEY_DIVERSIFICATION_PERSONALIZATION, new Uint8Array(0));
  }
  return point;
}

/**
 * FF1-AES256 diversifier for index j (keys.rs DiversifierKey::get, radix 2, empty
 * tweak, 11-byte little-endian bit string of j).
 */
export function diversifierAtIndex(dk: Uint8Array, j: number): Uint8Array {
  return diversifyIndexToBytes(dk, j);
}

/** ka_derive_public(g_d, ivk) = [ivk]g_d (note_encryption.rs impl). */
export function kaDerivePublic(gD: PallasPoint, ivk: bigint): PallasPoint {
  return gD.mul(ivk);
}

/** ka_agree(ivk, pk) = [ivk]P (note_encryption.rs impl; pallas has cofactor 1, so a plain
 *  scalar multiplication; the result can never be the identity for a non-identity pk and
 *  a non-zero ivk, both of which hold by construction). */
export function kaAgreePoint(ivk: bigint, pk: PallasPoint): PallasPoint {
  return pk.mul(ivk);
}

/**
 * The Orchard KDF (keys.rs:913 kdf_orchard_inner):
 * BLAKE2b-256 personalized "Zcash_OrchardKDF" over
 *   shared_secret.to_bytes() || ephemeral_key
 * where shared_secret.to_bytes() is the FULL 32-byte COMPRESSED pallas point
 * (x-coordinate + y-parity MSB) and ephemeral_key is the 32-byte compressed epk
 * (EphemeralKeyBytes as broadcast).
 */
export function kdfOrchard(sharedSecret: PallasPoint, ephemeralKeyBytes: Uint8Array): Uint8Array {
  return blake2b256Personal(KDF_ORCHARD_PERSONALIZATION, sharedSecret.toBytes(), ephemeralKeyBytes);
}

/** An Orchard payment address = diversifier (11) || compressed pk_d (32) = 43 bytes (keys.rs Address). */
export function deriveAddressBytes(ivk: bigint, d: Uint8Array): Uint8Array {
  const gD = diversifyHash(d);
  const pkD = kaDerivePublic(gD, ivk);
  const out = new Uint8Array(43);
  out.set(d, 0);
  out.set(pkD.toBytes(), 11);
  return out;
}

/** Parse a raw 96-byte FVK encoding: ak (32) || nk (32) || rivk (32) (keys.rs FullViewingKey::from_bytes). */
export function fvkFromBytes(bytes: Uint8Array): FullViewingKeyParts {
  if (bytes.length !== 96) throw new Error('fvkFromBytes: expected 96 bytes');
  const ak = PallasPoint.fromBytes(bytes.slice(0, 32));
  if (ak.isIdentity()) throw new Error('fvkFromBytes: ak is the identity');
  const nk = bytes32LEToBigintLocal(bytes.slice(32, 64));
  const rivk = bytes32LEToBigintLocal(bytes.slice(64, 96));
  return { ak, nk, rivk };
}

function bytes32LEToBigintLocal(bytes: Uint8Array): bigint {
  let x = 0n;
  for (let i = 31; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}
