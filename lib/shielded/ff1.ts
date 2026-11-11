// lib/shielded/ff1.ts
// FF1-AES256 format-preserving encryption (NIST SP 800-38G), ported 1:1 from the
// fpe-0.6.1 crate (cargo registry) src/ff1.rs as used by the Dash orchard fork
// (checkout orchard-94d8ef6bfc19d6d0/38ac9c1) keys.rs DiversifierKey::get:
//
//   diversifier_j = FF1::<Aes256>::new(dk, radix=2).encrypt(&[], BinaryNumeralString(j))
//
// Only the radix-2 encrypt path with an empty tweak is needed (11-byte binary
// diversifiers), but the algorithm below is the full generic FF1 encrypt.

import { ecb } from '@noble/ciphers/aes.js';

/** AES-256 ECB encrypt of a single 16-byte block (@noble/ciphers). */
function aes256Block(key: Uint8Array, block: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('aes256Block: key must be 32 bytes');
  if (block.length !== 16) throw new Error('aes256Block: block must be 16 bytes');
  return ecb(key).encrypt(block) as Uint8Array;
}

/** Numeral string: array of base-`radix` digits (fpe NumeralString). */
export type NumeralString = number[];

/** Big-endian conversion of a numeral string to a bigint. */
function numToBigint(x: NumeralString, radix: number): bigint {
  let v = 0n;
  const r = BigInt(radix);
  for (const d of x) v = v * r + BigInt(d);
  return v;
}

/** Convert a bigint to a numeral string of exactly `len` base-`radix` digits. */
function bigintToNum(v: bigint, radix: number, len: number): NumeralString {
  const r = BigInt(radix);
  const out = new Array<number>(len);
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v % r);
    v /= r;
  }
  return out;
}

/**
 * FF1 encrypt (fpe-0.6.1 ff1.rs `encrypt`), for b = ceil(ceil(v * log2(radix)) / 8),
 * d = 4 * ceil(b / 4) + 4, 10 rounds.
 */
export function ff1Encrypt(key: Uint8Array, radix: number, tweak: Uint8Array, input: NumeralString): NumeralString {
  const n = input.length;
  if (n < 2) throw new Error('ff1Encrypt: numeral string too short');
  const u = Math.floor(n / 2);
  const v = n - u;
  const b = Math.ceil(Math.ceil(v * Math.log2(radix)) / 8);
  const d = 4 * Math.ceil(b / 4) + 4;

  let A = input.slice(0, u);
  let B = input.slice(u);

  const P = new Uint8Array(16);
  P[0] = 0x01;
  P[1] = 0x02;
  P[2] = 0x01;
  P[3] = (radix >> 16) & 0xff;
  P[4] = (radix >> 8) & 0xff;
  P[5] = radix & 0xff;
  P[6] = 10;
  P[7] = u & 0xff;
  const nBytes = new Uint8Array(4);
  new DataView(nBytes.buffer).setUint32(0, n, false);
  P.set(nBytes, 8);
  const tBytes = new Uint8Array(4);
  new DataView(tBytes.buffer).setUint32(0, tweak.length, false);
  P.set(tBytes, 12);

  // fpe-0.6.1: Q = T || [0]^((-t-b-1) mod 16) || [i] || [NUM_radix(B)]^b, so that
  // len(P || Q) is always a multiple of 16 (Prf::output asserts offset == 0).
  const padLen = ((-(tweak.length) - b - 1) % 16 + 16) % 16;
  const qPrefix = new Uint8Array(tweak.length + padLen);
  qPrefix.set(tweak, 0);

  for (let i = 0; i < 10; i++) {
    const numB = numToBigint(B, radix);
    const bBytes = new Uint8Array(b);
    let tmp = numB;
    for (let j = b - 1; j >= 0; j--) {
      bBytes[j] = Number(tmp & 0xffn);
      tmp >>= 8n;
    }
    const q = new Uint8Array(qPrefix.length + 1 + b);
    q.set(qPrefix, 0);
    q[qPrefix.length] = i;
    q.set(bBytes, qPrefix.length + 1);

    // R = PRF(P || Q) = CBC-MAC with zero IV (P || Q is a multiple of 16).
    const pq = new Uint8Array(16 + q.length);
    pq.set(P, 0);
    pq.set(q, 16);
    let r = new Uint8Array(16);
    for (let off = 0; off < pq.length; off += 16) {
      const block = new Uint8Array(16);
      for (let j = 0; j < 16; j++) block[j] = r[j] ^ pq[off + j];
      r = aes256Block(key, block) as Uint8Array<ArrayBuffer>;
    }

    // S = R || AES(R ^ [1]_128) || AES(R ^ [2]_128) ... truncated to d bytes
    // (fpe-0.6.1 generate_s: the counter j is XORed as a 16-byte BE integer).
    const s = new Uint8Array(d);
    s.set(r.subarray(0, Math.min(16, d)), 0);
    let off = 16;
    let counter = 1;
    while (off < d) {
      const block = new Uint8Array(r);
      const counterBytes = new Uint8Array(16);
      new DataView(counterBytes.buffer).setUint32(12, counter, false);
      for (let j = 0; j < 16; j++) block[j] ^= counterBytes[j];
      const enc = aes256Block(key, block);
      const take = Math.min(16, d - off);
      s.set(enc.subarray(0, take), off);
      off += take;
      counter += 1;
    }

    const y = numToBigint(Array.from(s), 256);
    const m = i % 2 === 0 ? u : v;
    const c = (numToBigint(A, radix) + y) % BigInt(radix) ** BigInt(m);
    const C = bigintToNum(c, radix, m);
    A = B;
    B = C;
  }

  return A.concat(B);
}

/**
 * Orchard diversifier for index j (keys.rs DiversifierKey::get):
 * FF1-AES256 with radix 2, empty tweak, over the 88-bit little-endian-bit-string
 * of j (11 bytes LE), yielding an 11-byte diversifier.
 */
export function diversifyIndexToBytes(dk: Uint8Array, j: number): Uint8Array {
  // BinaryNumeralString::from_bytes_le(j.as_bytes()) — LSB-first bits of the 11 LE bytes.
  const jBytes = new Uint8Array(11);
  let v = BigInt(j);
  for (let i = 0; i < 8; i++) {
    jBytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  const bits: number[] = [];
  for (let i = 0; i < 88; i++) bits.push((jBytes[i >> 3] >> (i & 7)) & 1);
  const enc = ff1Encrypt(dk, 2, new Uint8Array(0), bits);
  const out = new Uint8Array(11);
  for (let i = 0; i < 88; i++) {
    if (enc[i]) out[i >> 3] |= 1 << (i & 7);
  }
  return out;
}
