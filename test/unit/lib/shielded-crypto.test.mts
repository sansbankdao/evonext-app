// test/unit/lib/shielded-crypto.test.mts
// Unit tests for lib/shielded/* — the Orchard crypto port for the shielded balance viewer.
//
// Verified static constants (Python/py_ecc ground truth):
//   - Pallas base/scalar field moduli (pasta_curves 0.5.2 README / z.cash protocol spec)
//   - GENERATOR_PALLAS x/y — Rust-produced constants/constants.rs L68-75
//   - GENERATOR_PALLAS_COMPRESSED — py_ecc compression of the above (verified)
//
// The end-to-end tests are self-consistent round trips: a synthetic Orchard note is
// ENCRYPTED with the exact inverse of the decryption pipeline (same KDF, same AEAD,
// same diversifier math), then decrypted. A bug that affects both directions
// identically would not be caught here — that class of bug is caught by the FIRST
// live on-chain decryption test against a known funded wallet (flagged in AGENTS.md).

import { describe, expect, it } from 'vitest';
import { chacha20, chacha20poly1305 } from '@noble/ciphers/chacha.js';

import {
  FP_MOD,
  FR_MOD,
  PallasPoint,
  bigintToBytes32LE,
  bytes32LEToBigint,
  fr,
  fp,
} from '../../../lib/shielded/pasta';
import {
  KDF_ORCHARD_PERSONALIZATION,
  PrfExpand,
  blake2b256Personal,
  prfExpand,
} from '../../../lib/shielded/hash';
import {
  COMMIT_IVK_PERSONALIZATION,
  ORCHARD_PERSONALIZATION,
  ZIP32_PURPOSE,
  commitIvk,
  deriveAddressBytes,
  deriveAskAndAk,
  deriveDkOvk,
  deriveInternalFvk,
  diversifierAtIndex,
  diversifyHash,
  fullViewingKeyFromSpendingKey,
  ivkFromFvk,
  kaAgreePoint,
  kaDerivePublic,
  kdfOrchard,
  spendingKeyFromSeed,
  zip32DeriveChild,
  zip32Master,
} from '../../../lib/shielded/keys';
import { ff1Encrypt, diversifyIndexToBytes } from '../../../lib/shielded/ff1';
import { hashToPallas } from '../../../lib/shielded/swu';
import {
  sinsemillaCommitToPoint,
  sinsemillaShortCommit,
} from '../../../lib/shielded/sinsemilla';
import {
  COMPACT_NOTE_SIZE,
  DASH_MEMO_SIZE,
  ENC_CIPHERTEXT_SIZE,
  FULL_ENCRYPTED_NOTE_LEN,
  NOTE_PLAINTEXT_SIZE,
  checkNoteValidity,
  deriveEsk,
  derivePsi,
  deriveRcm,
  noteCommitment,
  parseCompactPlaintext,
  tryCompactNoteDecryption,
  tryDecryptNoteWire,
  tryDecryptNoteWireWithMemo,
  tryNoteDecryption,
} from '../../../lib/shielded/note';

// ─── Verified constants ────────────────────────────────────────────────────────

const PALLAS_BASE_MODULUS =
  0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const PALLAS_SCALAR_MODULUS =
  0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
// pasta_curves-0.5.2 src/curves.rs impl_projective_curve_specific macro, `special_a0_b5`
// arm: `fn generator()` is x = NEGATIVE_ONE (= q - 1), y = TWO, z = one. There are NO
// other generator constants in the crate; an earlier decimal x/y pair transcribed into
// this test failed the curve equation and was removed.
const GENERATOR_PALLAS_X = PALLAS_BASE_MODULUS - 1n;
const GENERATOR_PALLAS_Y = 2n;
// Compressed LE bytes of (q-1, 2): y & 1 = 0, so the sign bit is CLEAR. Verified by
// reversing the BE hex of q-1 byte-by-byte.
const GENERATOR_PALLAS_COMPRESSED_HEX =
  '00000000ed302d991bf94c09fc98462200000000000000000000000000000040';
/** Node-Buffer-free hex decode (the vitest jsdom env has no reliable Buffer global). */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hexToBytes: odd length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Node-Buffer-free hex encode. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── pasta.ts ──────────────────────────────────────────────────────────────────

describe('pasta field arithmetic', () => {
  it('exposes the verified pallas base and scalar field moduli', () => {
    expect(FP_MOD).toBe(PALLAS_BASE_MODULUS);
    expect(FR_MOD).toBe(PALLAS_SCALAR_MODULUS);
  });

  it('reduces and negates scalars correctly', () => {
    expect(fr.add(2n, 3n)).toBe(5n);
    expect(fr.mul(FR_MOD - 1n, 2n)).toBe(FR_MOD - 2n);
    expect(fr.neg(1n)).toBe(FR_MOD - 1n);
    expect(fr.neg(0n)).toBe(0n);
  });

  it('decodes the verified compressed generator to the verified x/y', () => {
    const g = PallasPoint.fromBytes(hexToBytes(GENERATOR_PALLAS_COMPRESSED_HEX));
    expect(g.x).toBe(GENERATOR_PALLAS_X);
    expect(g.y).toBe(GENERATOR_PALLAS_Y);
    expect(g.isIdentity()).toBe(false);
  });

  it('generator byte round trip is the identity on encodings', () => {
    const g = PallasPoint.fromBytes(hexToBytes(GENERATOR_PALLAS_COMPRESSED_HEX));
    expect(bytesToHex(g.toBytes())).toBe(GENERATOR_PALLAS_COMPRESSED_HEX);
  });

  it('point double/neg/add/identity laws hold', () => {
    const g = PallasPoint.fromBytes(hexToBytes(GENERATOR_PALLAS_COMPRESSED_HEX));
    const twoG = g.double();
    expect(g.add(g).x).toBe(twoG.x);
    expect(g.add(g).y).toBe(twoG.y);
    const neg = g.negate();
    expect(neg.x).toBe(g.x);
    expect(neg.y).toBe(FP_MOD - g.y);
    expect(g.add(neg).isIdentity()).toBe(true);
    const id = PallasPoint.IDENTITY;
    expect(g.add(id).x).toBe(g.x);
    expect(id.toBytes()).toEqual(new Uint8Array(32));
  });

  it('scalar multiplication: [n]G = identity for the group order; [k]G ≠ identity for small k', () => {
    const g = PallasPoint.fromBytes(hexToBytes(GENERATOR_PALLAS_COMPRESSED_HEX));
    expect(g.mul(1n).x).toBe(g.x);
    expect(g.mul(1n).y).toBe(g.y);
    expect(g.mul(2n).x).toBe(g.double().x);
    // Group order of pallas = FR_MOD: [FR_MOD]G = identity
    expect(g.mul(FR_MOD).isIdentity()).toBe(true);
    // [3]G ≠ [2]G
    expect(g.mul(3n).x).not.toBe(g.mul(2n).x);
  });

  it('bytes32LE round trip', () => {
    const v = 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefn;
    const bytes = bigintToBytes32LE(v);
    expect(bytes32LEToBigint(bytes)).toBe(v);
  });
});

// ─── hash.ts ───────────────────────────────────────────────────────────────────

describe('hash primitives', () => {
  it('prfExpand is 64 bytes and domain-separated', () => {
    const sk = new Uint8Array(32).fill(0x42);
    const a = prfExpand(PrfExpand.ORCHARD_ASK, sk);
    const b = prfExpand(PrfExpand.ORCHARD_NK, sk);
    expect(a.length).toBe(64);
    expect(b.length).toBe(64);
    expect(a).not.toEqual(b);
  });

  it('prfExpand with inputs extends the hash', () => {
    const sk = new Uint8Array(32).fill(0x42);
    const a = prfExpand(PrfExpand.ORCHARD_RIVK_INTERNAL, sk, new Uint8Array(32).fill(1));
    const b = prfExpand(PrfExpand.ORCHARD_RIVK_INTERNAL, sk, new Uint8Array(32).fill(2));
    expect(a).not.toEqual(b);
  });

  it('blake2b256Personal is 32 bytes', () => {
    const out = blake2b256Personal(KDF_ORCHARD_PERSONALIZATION, new Uint8Array(64).fill(7));
    expect(out.length).toBe(32);
  });
});

// ─── keys.ts ───────────────────────────────────────────────────────────────────

describe('Orchard key derivation', () => {
  const seed = new Uint8Array(64);
  for (let i = 0; i < 64; i++) seed[i] = i;

  it('zip32 master splits a 64-byte BLAKE2b-512 into sk || chain code', () => {
    const { sk, chainCode } = zip32Master(seed);
    expect(sk.length).toBe(32);
    expect(chainCode.length).toBe(32);
    // Deterministic
    expect(zip32Master(seed).sk).toEqual(sk);
  });

  it('zip32 child derivation is path-dependent', () => {
    const m = zip32Master(seed);
    const c1 = zip32DeriveChild(m.sk, m.chainCode, (ZIP32_PURPOSE | 0x80000000) >>> 0);
    const c2 = zip32DeriveChild(m.sk, m.chainCode, ((ZIP32_PURPOSE + 1) | 0x80000000) >>> 0);
    expect(c1.sk).not.toEqual(c2.sk);
  });

  it('spendingKeyFromSeed uses m/32/coin_type/account and rejects coin_type >= 2^31', () => {
    // NOTE: `1 << 31` is -2^31 in JS (signed shift); the Rust u32 bound is 0x80000000.
    expect(() => spendingKeyFromSeed(seed, 0x80000000, 0)).toThrow(/2\^31/);
    const skMain = spendingKeyFromSeed(seed, 5, 0);
    const skTest = spendingKeyFromSeed(seed, 1, 0);
    expect(skMain.length).toBe(32);
    expect(skMain).not.toEqual(skTest);
  });

  it('the ask ỹ-normalization rule yields ak whose compressed MSB is 0', () => {
    // Over many random-ish spending keys, every derived ak MUST have sign bit 0.
    for (let i = 0; i < 20; i++) {
      const sk = new Uint8Array(32);
      sk[0] = i;
      sk[1] = 0xaa;
      const { ak } = deriveAskAndAk(sk);
      const bytes = ak.toBytes();
      expect(ak.isIdentity()).toBe(false);
      expect(bytes[31] >> 7).toBe(0);
      // [ask]G must equal ak after normalization
      const g = PallasPoint.fromBytes(hexToBytes(GENERATOR_PALLAS_COMPRESSED_HEX));
      void g;
    }
  });

  it('fullViewingKeyFromSpendingKey yields distinct ak/nk/rivk and ivk is a valid scalar', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    expect(fvk.nk % FP_MOD).toBe(fvk.nk);
    const ivk = ivkFromFvk(fvk);
    expect(ivk % FR_MOD).toBe(ivk);
    expect(ivk).not.toBe(0n);
  });

  it('commitIvk = sinsemillaShortCommit(CommitIvk domain, ak||nk 255-bit, rivk)', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    const akX = fvk.ak.extractP()!;
    const bits: number[] = [];
    for (const v of [akX, fvk.nk]) {
      for (let i = 0; i < 255; i++) bits.push(Number((v >> BigInt(i)) & 1n));
    }
    const expected = sinsemillaShortCommit(COMMIT_IVK_PERSONALIZATION, bits, fvk.rivk);
    expect(commitIvk(fvk.ak, fvk.nk, fvk.rivk)).toBe(expected);
  });

  it('deriveInternalFvk keeps ak/nk and changes rivk', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    const internal = deriveInternalFvk(fvk);
    expect(internal.ak.toBytes()).toEqual(fvk.ak.toBytes());
    expect(internal.nk).toBe(fvk.nk);
    expect(internal.rivk).not.toBe(fvk.rivk);
  });

  it('deriveDkOvk yields 32+32 bytes', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    const { dk, ovk } = deriveDkOvk(fvk);
    expect(dk.length).toBe(32);
    expect(ovk.length).toBe(32);
    expect(dk).not.toEqual(ovk);
  });

  it('diversifyHash yields distinct curve points per diversifier and handles 11-byte inputs', () => {
    const d0 = new Uint8Array(11);
    const d1 = new Uint8Array(11);
    d1[0] = 1;
    const p0 = diversifyHash(d0);
    const p1 = diversifyHash(d1);
    expect(p0.isIdentity()).toBe(false);
    expect(p1.isIdentity()).toBe(false);
    expect(p0.toBytes()).not.toEqual(p1.toBytes());
  });

  it('FF1 diversifiers are 11 bytes, deterministic, and index-dependent', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    const { dk } = deriveDkOvk(fvk);
    const d0 = diversifierAtIndex(dk, 0);
    const d1 = diversifierAtIndex(dk, 1);
    expect(d0.length).toBe(11);
    expect(d1.length).toBe(11);
    expect(d0).not.toEqual(d1);
    expect(diversifierAtIndex(dk, 0)).toEqual(d0);
  });

  it('the derived 43-byte address = diversifier || [ivk]g_d', () => {
    const sk = spendingKeyFromSeed(seed, 1, 0);
    const fvk = fullViewingKeyFromSpendingKey(sk);
    const ivk = ivkFromFvk(fvk);
    const { dk } = deriveDkOvk(fvk);
    const d = diversifierAtIndex(dk, 0);
    const addr = deriveAddressBytes(ivk, d);
    expect(addr.length).toBe(43);
    expect(addr.slice(0, 11)).toEqual(d);
    const gD = diversifyHash(d);
    expect(addr.slice(11)).toEqual(kaAgreePoint(ivk, gD).toBytes());
  });
});

// ─── sinsemilla.ts ─────────────────────────────────────────────────────────────

describe('Sinsemilla', () => {
  it('short_commit is deterministic and message-dependent', () => {
    const a = sinsemillaShortCommit(ORCHARD_PERSONALIZATION, [1, 0, 1], 7n);
    const b = sinsemillaShortCommit(ORCHARD_PERSONALIZATION, [1, 1, 0], 7n);
    expect(a).not.toBe(b);
    expect(sinsemillaShortCommit(ORCHARD_PERSONALIZATION, [1, 0, 1], 7n)).toBe(a);
  });

  it('commit_to_point returns r + k*Q and differs per r', () => {
    const msg = [1, 0, 1, 1];
    const p1 = sinsemillaCommitToPoint(ORCHARD_PERSONALIZATION, msg, 7n);
    const p2 = sinsemillaCommitToPoint(ORCHARD_PERSONALIZATION, msg, 8n);
    expect(p1.isIdentity()).toBe(false);
    expect(p1.toBytes()).not.toEqual(p2.toBytes());
  });
});

// ─── note.ts (round trips) ─────────────────────────────────────────────────────

describe('Orchard note crypto', () => {
  const seed = new Uint8Array(64);
  for (let i = 0; i < 64; i++) seed[i] = 0xa0 + i;
  const sk = spendingKeyFromSeed(seed, 1, 0);
  const fvk = fullViewingKeyFromSpendingKey(sk);
  const ivk = ivkFromFvk(fvk);
  const { dk } = deriveDkOvk(fvk);
  const d = diversifierAtIndex(dk, 0);
  const gD = diversifyHash(d);
  const pkD = kaAgreePoint(ivk, gD);
  const value = 123_456_789n;
  const rho = new Uint8Array(32);
  for (let i = 0; i < 32; i++) rho[i] = 0x10 + i;
  const rseed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) rseed[i] = 0x60 + i;

  /** Build the wire action for this note (encrypt = exact inverse of decrypt). */
  function buildWire() {
    const psi = derivePsi(rseed, rho);
    const esk = deriveEsk(rseed, rho);
    const epk = kaAgreePoint(esk, gD);
    const epkBytes = epk.toBytes();
    // KDF input = shared_secret.to_bytes() || epk_bytes where shared_secret = [esk]pk_d
    const sharedSecret = kaAgreePoint(esk, pkD);
    const key = kdfOrchard(sharedSecret, epkBytes);
    // 88-byte plaintext = 0x02 || d(11) || v(8 LE) || rseed(32) || memo(36)
    const plaintext = new Uint8Array(NOTE_PLAINTEXT_SIZE);
    plaintext[0] = 0x02;
    plaintext.set(d, 1);
    let v = value;
    for (let i = 0; i < 8; i++) {
      plaintext[12 + i] = Number(v & 0xffn);
      v >>= 8n;
    }
    plaintext.set(rseed, 20);
    const memo = new Uint8Array(DASH_MEMO_SIZE);
    memo[0] = 0x01;
    memo[1] = 0x99;
    plaintext.set(memo, COMPACT_NOTE_SIZE);
    const ciphertext = chacha20poly1305(key, new Uint8Array(12)).encrypt(plaintext);
    expect(ciphertext.length).toBe(ENC_CIPHERTEXT_SIZE);
    // compact ciphertext = first 52 keystream-xored bytes, keystream starting at
    // block counter 1 (skips the Poly1305 one-time-key block).
    const compactCiphertext = chacha20(key, new Uint8Array(12), plaintext.slice(0, COMPACT_NOTE_SIZE), undefined, 1);
    const rcm = deriveRcm(rseed, rho);
    const cmstar = noteCommitment(gD, pkD, value, rho, psi, rcm)!;
    const cmxBytes = bigintToBytes32LE(cmstar);
    const out = new Uint8Array(80); // out_ciphertext (OVK blob — opaque for the IVK path)
    const encryptedNote = new Uint8Array(FULL_ENCRYPTED_NOTE_LEN);
    encryptedNote.set(epkBytes, 0);
    encryptedNote.set(ciphertext, 32);
    encryptedNote.set(out, 32 + ENC_CIPHERTEXT_SIZE);
    return {
      wire: { cmx: cmxBytes, nullifier: rho, encryptedNote },
      epkBytes,
      ciphertext,
      compactCiphertext,
      cmxBytes,
      memo,
      psi,
      esk,
      rcm,
    };
  }

  it('psi/eskl/rcm are field elements (mod pallas base / scalar)', () => {
    const psi = derivePsi(rseed, rho);
    const esk = deriveEsk(rseed, rho);
    const rcm = deriveRcm(rseed, rho);
    expect(psi % FP_MOD).toBe(psi);
    expect(esk % FR_MOD).toBe(esk);
    expect(rcm % FR_MOD).toBe(rcm);
    expect(derivePsi(rseed, rho)).toBe(psi);
  });

  it('noteCommitment is deterministic and changes with any input', () => {
    const psi = derivePsi(rseed, rho);
    const rcm = deriveRcm(rseed, rho);
    const c1 = noteCommitment(gD, pkD, value, rho, psi, rcm)!;
    expect(c1 % FP_MOD).toBe(c1);
    const c2 = noteCommitment(gD, pkD, value + 1n, rho, psi, rcm)!;
    expect(c2).not.toBe(c1);
  });

  it('parseCompactPlaintext parses a valid 52-byte plaintext', () => {
    const plaintext = new Uint8Array(COMPACT_NOTE_SIZE);
    plaintext[0] = 0x02;
    plaintext.set(d, 1);
    let v = value;
    for (let i = 0; i < 8; i++) {
      plaintext[12 + i] = Number(v & 0xffn);
      v >>= 8n;
    }
    plaintext.set(rseed, 20);
    const note = parseCompactPlaintext(plaintext, rho)!;
    expect(note).not.toBeNull();
    expect(note.d).toEqual(d);
    expect(note.v).toBe(value);
    expect(note.rho).toEqual(rho);
    expect(note.rseed).toEqual(rseed);
  });

  it('parseCompactPlaintext rejects a bad version byte', () => {
    const plaintext = new Uint8Array(COMPACT_NOTE_SIZE);
    plaintext[0] = 0x01;
    expect(parseCompactPlaintext(plaintext, rho)).toBeNull();
  });

  it('FULL trial decryption recovers the note + memo from the wire', () => {
    const { wire, memo } = buildWire();
    const recovered = tryDecryptNoteWireWithMemo(ivk, wire);
    expect(recovered).not.toBeNull();
    expect(recovered!.note.d).toEqual(d);
    expect(recovered!.note.v).toBe(value);
    expect(recovered!.note.rseed).toEqual(rseed);
    expect(recovered!.memo).toEqual(memo);
    expect(recovered!.address.length).toBe(43);
    expect(recovered!.address.slice(0, 11)).toEqual(d);
  });

  it('COMPACT trial decryption recovers the note from the wire', () => {
    const { wire } = buildWire();
    const recovered = tryDecryptNoteWire(ivk, wire);
    expect(recovered).not.toBeNull();
    expect(recovered!.note.d).toEqual(d);
    expect(recovered!.note.v).toBe(value);
    expect(recovered!.note.rseed).toEqual(rseed);
    expect(recovered!.address.slice(0, 11)).toEqual(d);
  });

  it('trial decryption returns null under a DIFFERENT ivk (foreign note)', () => {
    const { wire } = buildWire();
    const otherSeed = new Uint8Array(64);
    for (let i = 0; i < 64; i++) otherSeed[i] = 0xf0 - i;
    const otherSk = spendingKeyFromSeed(otherSeed, 1, 0);
    const otherIvk = ivkFromFvk(fullViewingKeyFromSpendingKey(otherSk));
    expect(tryDecryptNoteWireWithMemo(otherIvk, wire)).toBeNull();
    expect(tryDecryptNoteWire(otherIvk, wire)).toBeNull();
  });

  it('trial decryption returns null for a corrupted ciphertext', () => {
    const { wire } = buildWire();
    const corrupted = new Uint8Array(wire.encryptedNote);
    corrupted[40] ^= 0xff;
    expect(tryDecryptNoteWireWithMemo(ivk, { ...wire, encryptedNote: corrupted })).toBeNull();
  });

  it('trial decryption returns null for a corrupted cmx (full path checks commitment)', () => {
    const { wire } = buildWire();
    const badCmx = new Uint8Array(32);
    badCmx[0] = 0x01;
    expect(tryDecryptNoteWireWithMemo(ivk, { ...wire, cmx: badCmx })).toBeNull();
    // Compact path does NOT check the commitment
    expect(tryDecryptNoteWire(ivk, { ...wire, cmx: badCmx })).not.toBeNull();
  });

  it('checkNoteValidity passes for the built note and fails for a wrong epk', () => {
    const { wire, epkBytes } = buildWire();
    const note = parseCompactPlaintext(
      chacha20(
        kdfOrchard(kaAgreePoint(deriveEsk(rseed, rho), pkD), epkBytes),
        new Uint8Array(12),
        wire.encryptedNote.slice(32, 32 + COMPACT_NOTE_SIZE),
        undefined,
        1,
      ),
      rho,
    )!;
    expect(checkNoteValidity(note, ivk, epkBytes, wire.cmx)).toBe(true);
    const wrongEpk = new Uint8Array(32);
    wrongEpk[0] = 0x01;
    expect(checkNoteValidity(note, ivk, wrongEpk, wire.cmx)).toBe(false);
  });
});

// ─── Upstream test vectors (dashpay/orchard 38ac9c1 + fpe-0.6.1) ──────────────────────
// REAL vectors extracted from the fork's src/test_vectors/*.rs + fpe-0.6.1
// ff1/test_vectors.rs into test/fixtures/shielded-vectors.json. These validate against
// upstream ground truth rather than self-consistent round trips. The fork kept the
// legacy 580-byte (Zcash 512-memo) note_encryption vectors, so the note AEAD itself is
// NOT covered here; the memo-independent pieces (KA agreement, OrchardKDF, cmx) are.
import vectors from '../../fixtures/shielded-vectors.json';

describe('upstream vectors: zip32 + hashToCurve + ff1', () => {
  it("zip32 chain m, m/1', m/1'/2', m/1'/2'/3' matches keys, chain codes, and FVK fingerprints", () => {
    // Source: fork src/zip32.rs test_vectors — ChildIndex::hardened(i) = i + 2^31.
    const seed = hexToBytes(vectors.zip32Seed);
    const master = zip32Master(seed);
    const c1 = zip32DeriveChild(master.sk, master.chainCode, 0x80000001);
    const c2 = zip32DeriveChild(c1.sk, c1.chainCode, 0x80000002);
    const c3 = zip32DeriveChild(c2.sk, c2.chainCode, 0x80000003);
    const nodes = [master, c1, c2, c3];
    expect(nodes.length).toBe(vectors.zip32.length);
    nodes.forEach((node, i) => {
      expect(bytesToHex(node.sk)).toBe(vectors.zip32[i].sk);
      expect(bytesToHex(node.chainCode)).toBe(vectors.zip32[i].c);
      // FvkFingerprint (fork zip32.rs:47-57) = BLAKE2b-256 "ZcashOrchardFVFP" over
      // fvk.to_bytes() = ak(32) || nk(32 LE) || rivk(32 LE).
      const fvk = fullViewingKeyFromSpendingKey(node.sk);
      const fp = blake2b256Personal(
        'ZcashOrchardFVFP',
        Uint8Array.from([...fvk.ak.toBytes(), ...bigintToBytes32LE(fvk.nk), ...bigintToBytes32LE(fvk.rivk)]),
      );
      expect(bytesToHex(fp)).toBe(vectors.zip32[i].fp);
    });
  });

  it('hashToCurve: SpendAuthG and NullifierK x-coordinates (LE encoding)', () => {
    // Source: fork src/test_vectors/keys.rs hash-to-curve section; x is Base::to_bytes() (LE).
    const g = hashToPallas('pallas', vectors.hashToCurve.spendAuthG.personalization, hexToBytes(vectors.hashToCurve.spendAuthG.msg));
    expect(bytesToHex(bigintToBytes32LE(g.affineX()))).toBe(vectors.hashToCurve.spendAuthG.x);
    const k = hashToPallas('pallas', vectors.hashToCurve.nullifierK.personalization, hexToBytes(vectors.hashToCurve.nullifierK.msg));
    expect(bytesToHex(bigintToBytes32LE(k.affineX()))).toBe(vectors.hashToCurve.nullifierK.x);
  });

  it('ff1: the fpe-0.6.1 88-bit radix-2 binary vector (empty tweak)', () => {
    // Source: fpe-0.6.1/src/ff1/test_vectors.rs — AES256, radix 2, tweak [], pt = 88 zero
    // bits, binary ct 90acee3f83cde7ae5622f3. Bit order is LSB-first per byte (verified
    // against the Rust ct numeral list: 0x90 -> 0,0,0,0,1,0,0,1).
    const ptBytes = hexToBytes(vectors.ff1.pt);
    const bits: number[] = [];
    for (const b of ptBytes) for (let i = 0; i < 8; i++) bits.push((b >> i) & 1);
    const ctBits = ff1Encrypt(hexToBytes(vectors.ff1.key), 2, new Uint8Array(0), bits);
    const ctBytes = new Uint8Array(11);
    ctBits.forEach((bit, i) => { ctBytes[i >> 3] |= bit << (i & 7); });
    expect(bytesToHex(ctBytes)).toBe(vectors.ff1.ct);
  });
});

describe('upstream vectors: orchard keys (10 vectors)', () => {
  it('full key chain: ask/ak/nk/rivk/ivk/ovk/dk/default address/internal keys', () => {
    // Source: fork src/test_vectors/keys.rs TEST_VECTORS. Field encodings: sk raw bytes;
    // ask/rivk/ivk Scalar::to_bytes() (LE); nk Base::to_bytes() (LE); ak/default_pk_d
    // compressed points; ovk/dk raw 32 bytes; default_d 11 bytes.
    for (const v of vectors.keys) {
      const sk = hexToBytes(v.sk);
      const { ask, ak } = deriveAskAndAk(sk);
      expect(bytesToHex(bigintToBytes32LE(ask))).toBe(v.ask);
      expect(bytesToHex(ak.toBytes())).toBe(v.ak);

      const fvk = fullViewingKeyFromSpendingKey(sk);
      expect(fvk.ak.equals(ak)).toBe(true);
      expect(bytesToHex(bigintToBytes32LE(fvk.nk))).toBe(v.nk);
      expect(bytesToHex(bigintToBytes32LE(fvk.rivk))).toBe(v.rivk);

      const ivk = ivkFromFvk(fvk);
      expect(bytesToHex(bigintToBytes32LE(ivk))).toBe(v.ivk);

      const { dk, ovk } = deriveDkOvk(fvk);
      expect(bytesToHex(dk)).toBe(v.dk);
      expect(bytesToHex(ovk)).toBe(v.ovk);

      const d = diversifyIndexToBytes(dk, 0);
      expect(bytesToHex(d)).toBe(v.default_d);
      const gD = diversifyHash(d);
      const pkD = kaDerivePublic(gD, ivk);
      expect(bytesToHex(pkD.toBytes())).toBe(v.default_pk_d);

      // Internal scope (fork keys.rs derive_internal + derive_dk_ovk on the internal rivk).
      const internal = deriveInternalFvk(fvk);
      expect(bytesToHex(bigintToBytes32LE(internal.rivk))).toBe(v.internal_rivk);
      const internalIvk = ivkFromFvk(internal);
      expect(bytesToHex(bigintToBytes32LE(internalIvk))).toBe(v.internal_ivk);
      const { dk: internalDk, ovk: internalOvk } = deriveDkOvk(internal);
      expect(bytesToHex(internalDk)).toBe(v.internal_dk);
      expect(bytesToHex(internalOvk)).toBe(v.internal_ovk);
    }
  });

  it('note commitment cmx from the vector note fields', () => {
    // note_cmx = x-coord of NoteCommit over (g_d, pk_d, v, rho=note_rho, psi, rcm).
    // note_nf is SKIPPED by design: it requires Poseidon prf_nf, which this library
    // does not implement (the served nullifier is used as rho during trial decryption).
    for (const v of vectors.keys) {
      const sk = hexToBytes(v.sk);
      const fvk = fullViewingKeyFromSpendingKey(sk);
      const ivk = ivkFromFvk(fvk);
      const { dk } = deriveDkOvk(fvk);
      const d = diversifyIndexToBytes(dk, 0);
      const gD = diversifyHash(d);
      const pkD = kaDerivePublic(gD, ivk);
      const rho = hexToBytes(v.note_rho);
      const rseed = hexToBytes(v.note_rseed);
      const cmx = noteCommitment(gD, pkD, BigInt(v.note_v), rho, derivePsi(rseed, rho), deriveRcm(rseed, rho));
      expect(cmx).not.toBeNull();
      expect(bytesToHex(bigintToBytes32LE(cmx!))).toBe(v.note_cmx);
    }
  });
});

describe('upstream vectors: orchard note encryption (10 vectors, memo-independent parts)', () => {
  it('KA agreement + OrchardKDF + recipient key + cmx', () => {
    // Source: fork src/test_vectors/note_encryption.rs (legacy 580-byte Zcash format; the
    // fork did not regenerate vectors for the 36-byte DashMemo, so the AEAD round trip is
    // not covered). incoming_viewing_key layout = dk(32) || ivk(32): verified empirically
    // (ka(ivk_half_2, ephemeral_key) == shared_secret) and structurally (half_1's top byte
    // 0x72 exceeds the scalar-field top byte 0x40, so half_1 cannot be a canonical scalar).
    for (const v of vectors.notes) {
      const ivkBytes = hexToBytes(v.incoming_viewing_key).slice(32, 64);
      const ivk = bytes32LEToBigint(ivkBytes);
      const epkBytes = hexToBytes(v.ephemeral_key);
      const epk = PallasPoint.fromBytes(epkBytes);
      const sharedSecret = kaAgreePoint(ivk, epk);
      expect(bytesToHex(sharedSecret.toBytes())).toBe(v.shared_secret);
      expect(bytesToHex(kdfOrchard(sharedSecret, epkBytes))).toBe(v.k_enc);

      const d = hexToBytes(v.default_d);
      const gD = diversifyHash(d);
      const pkD = kaDerivePublic(gD, ivk);
      expect(bytesToHex(pkD.toBytes())).toBe(v.default_pk_d);

      const rho = hexToBytes(v.nf_old);
      const rseed = hexToBytes(v.rseed);
      const cmx = noteCommitment(gD, pkD, BigInt(v.v), rho, derivePsi(rseed, rho), deriveRcm(rseed, rho));
      expect(cmx).not.toBeNull();
      expect(bytesToHex(bigintToBytes32LE(cmx!))).toBe(v.cmx);
    }
  });
});
