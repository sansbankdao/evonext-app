// lib/shielded/encrypt.ts
// Sender-side note encryption + outgoing ciphertext, ported 1:1 from the
// Dash orchard fork (38ac9c1) and the zcash_note_encryption fork (rev
// 9f7e93d, the exact pair rs-dpp builds with):
//   zcash_note_encryption lib.rs:481-494  encrypt_note_plaintext
//   zcash_note_encryption lib.rs:496-...  encrypt_outgoing_plaintext
//   orchard note_encryption.rs:33-48      prf_ock_orchard (Domain::derive_ock)
//   orchard note.rs:115-130               esk (PrfExpand::ORCHARD_ESK, non-zero)
//   orchard memo.rs (DashMemo)            MEMO_SIZE=36, plaintext 88, enc 104
// KAT'd against the REAL OrchardNoteEncryption API on evorunner
// (~/orchard-kat/src/bin/enckat.rs, 2026-11-11) — see
// test/unit/lib/shielded-encrypt.test.mts.

import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { blake2b256Personal } from './hash';
import { PallasPoint, bigintToBytes32LE } from './pasta';
import { diversifyHash, kaAgreePoint, kdfOrchard } from './keys';
import { COMPACT_NOTE_SIZE, DASH_MEMO_SIZE, ENC_CIPHERTEXT_SIZE, NOTE_PLAINTEXT_SIZE } from './note';

/** Domain::derive_ock personalization (note_encryption.rs:33 prf_ock_orchard). */
export const OCK_PERSONALIZATION = 'Zcash_Orchardock';

/** outgoing plaintext = pk_d(32) || esk(32) (zcash_note_encryption outgoing_plaintext_bytes). */
export const OUT_PLAINTEXT_SIZE = 64;

/** outgoing ciphertext = plaintext + 16-byte AEAD tag (OUT_CIPHERTEXT_SIZE). */
export const OUT_CIPHERTEXT_SIZE = OUT_PLAINTEXT_SIZE + 16;

function expectLen(b: Uint8Array, n: number, what: string): void {
  if (b.length !== n) throw new Error(`${what}: expected ${n} bytes, got ${b.length}`);
}

/**
 * prf_ock_orchard(ovk, cv, cmx, epk) (note_encryption.rs:33-48):
 * BLAKE2b-256 personalized "Zcash_Orchardock" over
 *   ovk(32) || cv.to_bytes()(32) || cmx_bytes(32) || epk_bytes(32).
 */
export function prfOckOrchard(
  ovk: Uint8Array,
  cvBytes: Uint8Array,
  cmxBytes: Uint8Array,
  epkBytes: Uint8Array,
): Uint8Array {
  expectLen(ovk, 32, 'ovk');
  expectLen(cvBytes, 32, 'cv');
  expectLen(cmxBytes, 32, 'cmx');
  expectLen(epkBytes, 32, 'epk');
  return blake2b256Personal(OCK_PERSONALIZATION, ovk, cvBytes, cmxBytes, epkBytes);
}

/**
 * encrypt_outgoing_plaintext (zcash_note_encryption lib.rs:496, ovk=Some branch):
 *   ock = prf_ock_orchard(ovk, cv, cmx, epk)
 *   plaintext = pk_d(32) || esk_repr(32)
 *   ChaCha20-Poly1305(key=ock, 12-byte zero nonce, empty AAD) -> 80 bytes.
 * When the sender has no OVK (unrecoverable output), the caller MUST pass a
 * fresh RANDOM 32-byte `ovk` — the Rust API substitutes a random ock AND
 * random plaintext there, so encrypting real fields under a random key keeps
 * the wire ciphertext equally unrecoverable.
 */
export function encryptOutgoingPlaintext(
  ovk: Uint8Array,
  cvBytes: Uint8Array,
  cmxBytes: Uint8Array,
  epkBytes: Uint8Array,
  pkDBytes: Uint8Array,
  eskBytes: Uint8Array,
): Uint8Array {
  expectLen(pkDBytes, 32, 'pk_d');
  expectLen(eskBytes, 32, 'esk');
  const ock = prfOckOrchard(ovk, cvBytes, cmxBytes, epkBytes);
  const plaintext = new Uint8Array(OUT_PLAINTEXT_SIZE);
  plaintext.set(pkDBytes, 0);
  plaintext.set(eskBytes, 32);
  return chacha20poly1305(ock, new Uint8Array(12)).encrypt(plaintext);
}

/**
 * encrypt_note_plaintext (zcash_note_encryption lib.rs:481):
 *   shared_secret = ka_agree_enc(esk, pk_d) = [esk]pk_d
 *   epk = [esk]g_d (ka_derive_public)
 *   key = kdf_orchard(shared_secret, epk_bytes)
 *   ChaCha20-Poly1305(key, 12-byte zero nonce, empty AAD) over
 *     [0x02] || d(11) || v(8 LE) || rseed(32) || memo(36)   -> 104 bytes
 * Returns the epk bytes alongside the ciphertext (both go on the wire and the
 * epk feeds the outgoing ciphertext).
 * `esk` MUST be the note's derived esk (note.ts deriveEsk(rseed, rho)) — the
 * fork guarantees it is non-zero (NonZeroPallasScalar); we throw on 0 here.
 */
export function encryptNotePlaintext(
  recipient: Uint8Array,
  value: bigint,
  rseed: Uint8Array,
  memo: Uint8Array,
  esk: bigint,
): { epkBytes: Uint8Array; encCiphertext: Uint8Array } {
  expectLen(recipient, 43, 'recipient');
  expectLen(rseed, 32, 'rseed');
  expectLen(memo, DASH_MEMO_SIZE, 'memo');
  if (value < 0n || value >= 1n << 64n) throw new Error(`value out of u64 range: ${value}`);
  if (esk === 0n) throw new Error('esk must be non-zero');
  const d = recipient.slice(0, 11);
  const pkD = PallasPoint.fromBytes(recipient.slice(11, 43));
  if (pkD.isIdentity()) throw new Error('pk_d is the identity');
  const gD = diversifyHash(d);
  const epk = gD.mul(esk);
  const epkBytes = epk.toBytes();
  const sharedSecret = kaAgreePoint(esk, pkD);
  const key = kdfOrchard(sharedSecret, epkBytes);
  const plaintext = new Uint8Array(NOTE_PLAINTEXT_SIZE);
  plaintext[0] = 0x02; // ZIP-212 note plaintext version
  plaintext.set(d, 1);
  plaintext.set(bigintToBytes32LE(value).slice(0, 8), 12);
  plaintext.set(rseed, 20);
  plaintext.set(memo, COMPACT_NOTE_SIZE);
  const encCiphertext = chacha20poly1305(key, new Uint8Array(12)).encrypt(plaintext);
  if (encCiphertext.length !== ENC_CIPHERTEXT_SIZE) {
    throw new Error(`enc ciphertext: expected ${ENC_CIPHERTEXT_SIZE} bytes, got ${encCiphertext.length}`);
  }
  return { epkBytes, encCiphertext };
}
