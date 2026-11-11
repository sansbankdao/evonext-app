// lib/shielded/hash.ts
// BLAKE2b helpers + the ZIP-32/Orchard PRF^expand construction, ported 1:1 from
// zcash_spec 0.2.1 (cargo registry) src/prf_expand.rs as used by the Dash orchard
// fork (cargo git checkout orchard-94d8ef6bfc19d6d0/38ac9c1) src/spec.rs / keys.rs.
//
// PRF^expand(sk, t) := BLAKE2b-512 with personalization "Zcash_ExpandSeed" over
//   sk || t
// where t is the concatenation of the domain separator byte followed by the
// typed inputs, EXCEPT when the two trailing inputs are [0] and "" — those are
// omitted entirely (prf_expand.rs Self-consistent special case, comment lines 15-28).

import { blake2b } from '@noble/hashes/blake2.js';

function assertPersonal(personal: string): Uint8Array {
  const p = new TextEncoder().encode(personal);
  if (p.length !== 16) throw new Error(`personalization must be 16 bytes: ${personal}`);
  return p;
}

/** BLAKE2b-512 with a 16-byte personalization string. */
export function blake2b512Personal(personal: string, ...parts: Uint8Array[]): Uint8Array {
  const h = blake2b.create({ dkLen: 64, personalization: assertPersonal(personal) });
  for (const p of parts) h.update(p);
  return h.digest();
}

/** BLAKE2b-256 with a 16-byte personalization string. */
export function blake2b256Personal(personal: string, ...parts: Uint8Array[]): Uint8Array {
  const h = blake2b.create({ dkLen: 32, personalization: assertPersonal(personal) });
  for (const p of parts) h.update(p);
  return h.digest();
}

/** Personalization for PRF^expand (zcash_spec PRF_EXPAND_PERSONALIZATION). */
export const PRF_EXPAND_PERSONALIZATION = 'Zcash_ExpandSeed';

/** Personalization for ZIP-32 Orchard master key generation (zip32.rs). */
export const ZIP32_ORCHARD_PERSONALIZATION = 'ZcashIP32Orchard';

/** Personalization for the Orchard key agreement KDF (keys.rs kdf_orchard_inner). */
export const KDF_ORCHARD_PERSONALIZATION = 'Zcash_OrchardKDF';

/** Personalization for the outgoing-cipher key (note_encryption.rs prf_ock_orchard). */
export const PRF_OCK_PERSONALIZATION = 'Zcash_Orchardock';

/**
 * Orchard PrfExpand domain separators (spec.rs). The `inputs` given here are the
 * exact typed arguments passed at each call site in keys.rs / note.rs:
 *  - with(t)        -> [domainByte, ...t]
 *  - trailingSkip   -> zcash_spec special case: a trailing pair ([0], '') is dropped.
 */
export const PrfExpand = {
  // zcash_spec-0.2.1 prf_expand.rs renumbered several Orchard domains vs the public Zcash
  // protocol (PSI 0x02->0x09, DK_OVK 0x10->0x82, RIVK_INTERNAL 0x09->0x83; RCM is 0x05 in
  // BOTH). Values below are the FORK's, verified against the fork's key/note test vectors.
  /** 0x09 — rseed psi: PSI.with(rseed, rho_bytes) */
  PSI: 0x09,
  /** 0x05 — note commitment randomness: ORCHARD_RCM.with(rseed, rho_bytes) */
  ORCHARD_RCM: 0x05,
  /** 0x04 — ephemeral secret key: ORCHARD_ESK.with(rseed, rho_bytes) */
  ORCHARD_ESK: 0x04,
  /** 0x06 — spend authorizing key: ORCHARD_ASK.with(sk) */
  ORCHARD_ASK: 0x06,
  /** 0x07 — nullifier deriving key: ORCHARD_NK.with(sk) */
  ORCHARD_NK: 0x07,
  /** 0x08 — commit_ivk randomness: ORCHARD_RIVK.with(sk) */
  ORCHARD_RIVK: 0x08,
  /** 0x83 — internal commit_ivk randomness: ORCHARD_RIVK_INTERNAL.with(rivk_repr, ak_bytes, nk_bytes) */
  ORCHARD_RIVK_INTERNAL: 0x83,
  /** 0x82 — diversifier key + outgoing viewing key: ORCHARD_DK_OVK.with(rivk_repr, ak_bytes, nk_bytes) */
  ORCHARD_DK_OVK: 0x82,
  /** 0x81 — ZIP-32 child key derivation: ORCHARD_ZIP32_CHILD.with(chain_code, sk, i_le) */
  ORCHARD_ZIP32_CHILD: 0x81,
} as const;

/**
 * PRF^expand(sk, [domainByte || ...inputs]) -> 64 bytes.
 * `sk` is the 32-byte PRF key (spending key bytes or chain code, depending on domain).
 */
export function prfExpand(domainByte: number, sk: Uint8Array, ...inputs: Uint8Array[]): Uint8Array {
  return blake2b512Personal(PRF_EXPAND_PERSONALIZATION, sk, Uint8Array.from([domainByte]), ...inputs);
}
