// lib/shielded/note.ts
// Orchard note cryptography + the trial-decryption pipeline, ported 1:1 from the
// Dash orchard fork (checkout orchard-94d8ef6bfc19d6d0/38ac9c1) note.rs / spec.rs /
// note/commitment.rs and zcash_note_encryption 0.4.1 (dashpay fork rev 9f7e93d)
// src/lib.rs (try_note_decryption, check_note_validity, try_compact_note_decryption).

import { chacha20, chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { FP_MOD, FR_MOD, PallasPoint, bigintToBytes32LE, bytes32LEToBigint, fp } from './pasta';
import { hashToPallas } from './swu';
import { prfNf } from './poseidon';
import { PrfExpand, prfExpand } from './hash';
import { kaAgreePoint, diversifyHash, kdfOrchard, toScalar, toBase, NOTE_COMMITMENT_PERSONALIZATION } from './keys';
import { sinsemillaCommitToPoint } from './sinsemilla';

/** COMPACT_NOTE_SIZE (note_encryption.rs): plaintext = [0x02] || d(11) || v(8) || rseed(32). */
export const COMPACT_NOTE_SIZE = 52;

/** DashMemo sizes (memo.rs): 36-byte memo -> 88-byte plaintext -> 104-byte enc_ciphertext. */
export const DASH_MEMO_SIZE = 36;
export const NOTE_PLAINTEXT_SIZE = COMPACT_NOTE_SIZE + DASH_MEMO_SIZE; // 88
export const ENC_CIPHERTEXT_SIZE = NOTE_PLAINTEXT_SIZE + 16; // 104 (16 = AEAD tag)

/** Full encrypted_note wire length (rs-sdk decrypt.rs): epk(32) || enc(104) || out(80) = 216. */
export const FULL_ENCRYPTED_NOTE_LEN = 32 + ENC_CIPHERTEXT_SIZE + 80;

/** AEAD tag size. */
export const AEAD_TAG_SIZE = 16;

/** A decrypted Orchard note (orchard_parse_note_plaintext_without_memo). */
export interface OrchardNote {
  /** d — 11-byte diversifier. */
  d: Uint8Array;
  /** v — note value in credits (u64 LE; NOTE_CREDIT_VAL=10^18, one credit = one u64 unit... see value()). */
  v: bigint;
  /** rho — 32 bytes from the caller (the served nullifier field / note reference). */
  rho: Uint8Array;
  /** rseed — 32-byte random seed (post-ZIP-212). */
  rseed: Uint8Array;
}

/**
 * psi = to_base(PRF^expand(rseed, [0x02] || rho)) (note.rs Rseed::psi).
 * psi is a pallas BASE field element.
 */
export function derivePsi(rseed: Uint8Array, rho: Uint8Array): bigint {
  return toBase(prfExpand(PrfExpand.PSI, rseed, rho));
}

/** esk = to_scalar(PRF^expand(rseed, [0x04] || rho)) (note.rs Rseed::derive_esk). */
export function deriveEsk(rseed: Uint8Array, rho: Uint8Array): bigint {
  return toScalar(prfExpand(PrfExpand.ORCHARD_ESK, rseed, rho));
}

/** rcm = to_scalar(PRF^expand(rseed, [0x03] || rho)) (note.rs Rseed::rcm). */
export function deriveRcm(rseed: Uint8Array, rho: Uint8Array): bigint {
  return toScalar(prfExpand(PrfExpand.ORCHARD_RCM, rseed, rho));
}

/**
 * NoteCommitment::derive(g_d, pk_d, v, rho, psi, rcm) (note/commitment.rs:53-73):
 * SinsemillaCommit over the "z.cash:Orchard-NoteCommit" domain with message
 *   g_d (256 bits) || pk_d (256) || v (64) || rho (255) || psi (255), each LSB-first.
 * IMPORTANT: g_d/pk_d enter as their full 256-bit COMPRESSED POINT ENCODINGS
 * (BitArray<Lsb0> over the [u8; 32] arguments, NO .take(255)) — i.e. including the
 * y-parity bit — NOT as 255-bit field elements (an earlier revision used extractP, which
 * dropped the parity bit and changed every commitment). Returns the
 * ExtractedNoteCommitment (x-coordinate, null for the identity).
 */
export function noteCommitment(
  gD: PallasPoint,
  pkD: PallasPoint,
  v: bigint,
  rho: Uint8Array,
  psi: bigint,
  rcm: bigint,
): bigint | null {
  const bits: number[] = [];
  const pushScalarBits = (x: bigint, len: number) => {
    for (let i = 0; i < len; i++) bits.push(Number((x >> BigInt(i)) & 1n));
  };
  const pushBytesBits = (bytes: Uint8Array, len: number) => {
    // LE-integer interpretation, then LSB-first bits (matches Rust to_iter_bits over to_le_bits).
    let x = 0n;
    for (let i = bytes.length - 1; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
    pushScalarBits(x, len);
  };
  pushBytesBits(gD.toBytes(), 256);
  pushBytesBits(pkD.toBytes(), 256);
  pushScalarBits(v, 64);
  pushBytesBits(rho, 255);
  pushScalarBits(psi, 255);
  return noteCommitmentPointFromBits(bits, rcm).extractP();
}

/** The un-extracted note commitment POINT (NoteCommitment::0) — needed by
 *  deriveNullifier, which adds the Poseidon nullifier tag to it. */
export function noteCommitmentPoint(
  gD: PallasPoint,
  pkD: PallasPoint,
  v: bigint,
  rho: Uint8Array,
  psi: bigint,
  rcm: bigint,
): PallasPoint {
  const bits: number[] = [];
  const pushScalarBits = (x: bigint, len: number) => {
    for (let i = 0; i < len; i++) bits.push(Number((x >> BigInt(i)) & 1n));
  };
  const pushBytesBits = (bytes: Uint8Array, len: number) => {
    let x = 0n;
    for (let i = bytes.length - 1; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
    pushScalarBits(x, len);
  };
  pushBytesBits(gD.toBytes(), 256);
  pushBytesBits(pkD.toBytes(), 256);
  pushScalarBits(v, 64);
  pushBytesBits(rho, 255);
  pushScalarBits(psi, 255);
  return noteCommitmentPointFromBits(bits, rcm);
}

function noteCommitmentPointFromBits(bits: number[], rcm: bigint): PallasPoint {
  return sinsemillaCommitToPoint(NOTE_COMMITMENT_PERSONALIZATION, bits, rcm);
}

/** Nullifier::derive (note/nullifier.rs) — DeriveNullifier from the Zcash
 *  protocol spec § 4.16:
 *    nf = extract_p( [mod_r_p(prf_nf(nk, rho) + psi)] · K^orchard + cm_point )
 *  where K^orchard = hash_to_curve("z.cash:Orchard")("K"), prf_nf is Poseidon,
 *  and mod_r_p reduces the Fp sum into the Fq scalar field.
 *  Returns the 32-byte nullifier encoding (all-zero when the point is the
 *  identity, matching Rust's extract_p(identity) = 0). */
let cachedOrchardK: PallasPoint | null = null;
export function getOrchardK(): PallasPoint {
  if (cachedOrchardK === null) {
    const k = hashToPallas('pallas', 'z.cash:Orchard', new TextEncoder().encode('K'));
    if (k === null) throw new Error('getOrchardK: hash_to_curve returned null');
    cachedOrchardK = k;
  }
  return cachedOrchardK;
}
export function deriveNullifier(
  nk: Uint8Array,
  rho: Uint8Array,
  psi: bigint,
  cmPoint: PallasPoint,
): Uint8Array {
  if (nk.length !== 32) throw new Error('deriveNullifier: nk must be 32 bytes');
  if (rho.length !== 32) throw new Error('deriveNullifier: rho must be 32 bytes');
  const nkFp = bytes32LEToBigint(nk);
  const rhoFp = bytes32LEToBigint(rho);
  if (nkFp >= FP_MOD) throw new Error('deriveNullifier: nk is not a canonical Fp element');
  if (rhoFp >= FP_MOD) throw new Error('deriveNullifier: rho is not a canonical Fp element');
  const sum = fp.add(prfNf(nkFp, rhoFp), psi);
  const scalar = sum % FR_MOD; // mod_r_p: Fp -> Fq via the integer repr
  const point = getOrchardK().mul(scalar).add(cmPoint);
  return bigintToBytes32LE(point.extractP() ?? 0n);
}

/**
 * Parse the 52-byte compact plaintext (note_encryption.rs
 * orchard_parse_note_plaintext_without_memo). Returns null if the version byte
 * or field encodings are invalid. `rho` is supplied by the caller.
 */
export function parseCompactPlaintext(plaintext: Uint8Array, rho: Uint8Array): OrchardNote | null {
  if (plaintext.length !== COMPACT_NOTE_SIZE) return null;
  if (plaintext[0] !== 0x02) return null; // ZIP-212 note plaintext version
  const d = plaintext.slice(1, 12);
  const vBytes = plaintext.slice(12, 20);
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(vBytes[i]);
  const rseed = plaintext.slice(20, 52);
  if (rho.length !== 32) return null;
  return { d, v, rho, rseed };
}

/**
 * Full trial decryption of a shielded action (zcash_note_encryption
 * try_note_decryption + check_note_validity):
 *   1. shared_secret = [ivk]epk
 *   2. key = KDF(shared_secret || epk)
 *   3. AEAD-Open the 104-byte ciphertext (ChaCha20-Poly1305, nonce 0) -> 88-byte plaintext
 *   4. Parse the first 52 bytes of plaintext (memo = the remaining 36 bytes, any value
 *      accepted — DashMemo::memo_from_bytes is bytes.try_into().ok(), no canonical check)
 *   5. Recompute the note commitment; MUST equal the broadcast cmx
 *   6. epk check: ka_derive_public(g_d, esk) MUST equal the broadcast epk (ZIP-212)
 * Returns the note + memo on success, null on failure (the vast majority — other people's notes).
 */
export function tryNoteDecryption(
  ivk: bigint,
  epkBytes: Uint8Array,
  ciphertext: Uint8Array,
  cmxBytes: Uint8Array,
  rho: Uint8Array,
): (OrchardNote & { memo: Uint8Array }) | null {
  try {
    if (epkBytes.length !== 32 || ciphertext.length !== ENC_CIPHERTEXT_SIZE || cmxBytes.length !== 32 || rho.length !== 32) {
      return null;
    }
    const epk = PallasPoint.fromBytes(epkBytes);
    if (epk.isIdentity()) return null; // prepare_epk rejects the identity
    const sharedSecret = kaAgreePoint(ivk, epk);
    const key = kdfOrchard(sharedSecret, epkBytes);
    const plaintext = chacha20poly1305(key, new Uint8Array(12)).decrypt(ciphertext);
    if (plaintext.length !== NOTE_PLAINTEXT_SIZE) return null;
    const note = parseCompactPlaintext(plaintext.slice(0, 52), rho);
    if (!note) return null;
    if (!checkNoteValidity(note, ivk, epkBytes, cmxBytes)) return null;
    return { ...note, memo: plaintext.slice(COMPACT_NOTE_SIZE, NOTE_PLAINTEXT_SIZE) };
  } catch {
    // AEAD tag mismatch / point parse failures — expected for foreign notes.
    return null;
  }
}

/**
 * Compact (ZIP 307) trial decryption (zcash_note_encryption try_compact_note_decryption):
 * same shared secret + KDF, raw ChaCha20 over EXACTLY the 52-byte compact ciphertext
 * (nonce 0, keystream STARTING AT BLOCK COUNTER 1 — zcash_note_encryption
 * try_compact_note_decryption_inner does keystream.seek(64) to skip the Poly1305
 * keying output; the Dash fork's CompactNoteCiphertextBytes = NoteBytesData<52>, the
 * 53rd keystream-check byte of upstream Zcash was dropped), parses the 52-byte
 * plaintext. NO commitment validity check (the rs-sdk sync path uses this directly
 * and matches the local tree cmx against the wire cmx instead).
 */
export function tryCompactNoteDecryption(
  ivk: bigint,
  epkBytes: Uint8Array,
  ciphertext: Uint8Array,
  rho: Uint8Array,
): OrchardNote | null {
  try {
    if (epkBytes.length !== 32 || ciphertext.length !== COMPACT_NOTE_SIZE || rho.length !== 32) {
      return null;
    }
    const epk = PallasPoint.fromBytes(epkBytes);
    if (epk.isIdentity()) return null;
    const sharedSecret = kaAgreePoint(ivk, epk);
    const key = kdfOrchard(sharedSecret, epkBytes);
    // Block counter 1: skip the Poly1305 one-time-key block (zcash_note_encryption
    // keystream.seek(64)); noble's 5th chacha20 arg is the initial block counter.
    const plaintext = chacha20(key, new Uint8Array(12), ciphertext, undefined, 1);
    return parseCompactPlaintext(plaintext, rho);
  } catch {
    return null;
  }
}

/** The served ShieldedEncryptedNote shape (dash-wasm ShieldedEncryptedNote / rs-sdk
 *  drive_proof_verifier::types::ShieldedEncryptedNote). `encryptedNote` on the wire is
 *  epk(32) || enc_ciphertext(104) || out_ciphertext(80) = 216 bytes (rs-sdk decrypt.rs). */
export interface ShieldedEncryptedNoteWire {
  cmx: Uint8Array;
  nullifier: Uint8Array;
  encryptedNote: Uint8Array;
}

/**
 * rs-sdk try_decrypt_note: compact trial decryption of a served note under the ivk.
 * Returns the note + its 43-byte raw address (diversifier || pk_d) on success.
 */
export function tryDecryptNoteWire(
  ivk: bigint,
  wire: ShieldedEncryptedNoteWire,
): { note: OrchardNote; address: Uint8Array } | null {
  const data = wire.encryptedNote;
  if (data.length < 32 + COMPACT_NOTE_SIZE) return null;
  const epkBytes = data.slice(0, 32);
  const encCompact = data.slice(32, 32 + COMPACT_NOTE_SIZE);
  const note = tryCompactNoteDecryption(ivk, epkBytes, encCompact, wire.nullifier);
  if (!note) return null;
  const gD = diversifyHash(note.d);
  const address = new Uint8Array(43);
  address.set(note.d, 0);
  address.set(kaAgreePoint(ivk, gD).toBytes(), 11);
  return { note, address };
}

/**
 * rs-sdk try_decrypt_note_with_memo: FULL AEAD trial decryption (needs the 216-byte
 * wire; returns null for shorter/compact-only payloads). Returns note + address + the
 * raw 36-byte Dash memo.
 */
export function tryDecryptNoteWireWithMemo(
  ivk: bigint,
  wire: ShieldedEncryptedNoteWire,
): { note: OrchardNote; address: Uint8Array; memo: Uint8Array } | null {
  const data = wire.encryptedNote;
  if (data.length < FULL_ENCRYPTED_NOTE_LEN) return null;
  const epkBytes = data.slice(0, 32);
  const enc = data.slice(32, 32 + ENC_CIPHERTEXT_SIZE);
  const decrypted = tryNoteDecryption(ivk, epkBytes, enc, wire.cmx, wire.nullifier);
  if (!decrypted) return null;
  const { memo, ...note } = decrypted;
  const gD = diversifyHash(note.d);
  const address = new Uint8Array(43);
  address.set(note.d, 0);
  address.set(kaAgreePoint(ivk, gD).toBytes(), 11);
  return { note, address, memo };
}

/**
 * check_note_validity (zcash_note_encryption lib.rs):
 *   ExtractedNoteCommitment::from(cmstar(note)) == cmstar_bytes
 *   AND ka_derive_public(note, derived_esk) == ephemeral_key  (post-ZIP-212)
 * where cmstar(note) recomputes NoteCommitment::derive(g_d, pk_d, v, rho, psi, rcm)
 * with pk_d = ka_derive_public(g_d, ivk) for the caller's ivk.
 */
export function checkNoteValidity(
  note: OrchardNote,
  ivk: bigint,
  epkBytes: Uint8Array,
  cmxBytes: Uint8Array,
): boolean {
  const gD = diversifyHash(note.d);
  const pkD = kaAgreePoint(ivk, gD); // ka_derive_public(g_d, ivk)
  const psi = derivePsi(note.rseed, note.rho);
  const rcm = deriveRcm(note.rseed, note.rho);
  const cmstar = noteCommitment(gD, pkD, note.v, note.rho, psi, rcm);
  if (cmstar === null) return false;
  // Compare as canonical encodings (cmxBytes from the wire is 32-byte LE Fp).
  const cmstarBytes = bigintToBytes32LE(cmstar);
  for (let i = 0; i < 32; i++) if (cmstarBytes[i] !== cmxBytes[i]) return false;
  // ZIP-212 ephemeral key check: ka_derive_public(g_d, esk) == epk.
  const esk = deriveEsk(note.rseed, note.rho);
  const derivedEpkBytes = kaAgreePoint(esk, gD).toBytes();
  for (let i = 0; i < 32; i++) if (derivedEpkBytes[i] !== epkBytes[i]) return false;
  return true;
}
