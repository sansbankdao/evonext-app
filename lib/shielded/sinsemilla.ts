// lib/shielded/sinsemilla.ts
// Sinsemilla hash + commitment, ported 1:1 from sinsemilla-0.1.0 (cargo registry)
// src/lib.rs as used by the Dash orchard fork (checkout orchard-94d8ef6bfc19d6d0/38ac9c1)
// spec.rs / note/commitment.rs / keys.rs:
//
//   - Q(domain)  = hash_to_curve("pallas", format!("{}-M", domain)... wait — NO.
//     sinsemilla HashDomain::new(domain) = Q = hash_to_curve("z.cash:SinsemillaQ")(domain)
//     with the DOMAIN STRING as the message, i.e.
//        Q = hashToPallas("pallas", "z.cash:SinsemillaQ", domain_bytes)
//   - S(j)       = hashToPallas("pallas", "z.cash:SinsemillaS", I2LEBSP_10(j) as 2 bytes LE)
//   - R(domain)  = hashToPallas("pallas", format!("{}-r", domain), b"")
//
//   hash_to_point(msg_bits): acc = Q; for each K=10 bit chunk (LSB-first, zero-padded
//     to a multiple of K): acc = (acc + S[chunk]) + acc
//   hash(domain, msg_bits)  = extract_p_bottom(hash_to_point)   (x-coord; 0 if identity)
//   commit(domain, msg_bits, r) = hash_to_point + [r]R          (CommitDomain::commit)
//   short_commit              = extract_p_bottom(commit)

import { PallasPoint } from './pasta';
import { hashToPallas } from './swu';

/** Number of bits per Sinsemilla chunk (sinsemilla-0.1.0 `const K`). */
const K = 10;

/** Maximum number of chunks (sinsemilla-0.1.0 `const C`). */
const C = 253;

/** Personalizations (orchard fork constants.rs / sinsemilla lib.rs). */
const Q_PERSONALIZATION = 'z.cash:SinsemillaQ';
const S_PERSONALIZATION = 'z.cash:SinsemillaS';

const encoder = new TextEncoder();

/** Lazily computed Sinsemilla S table (1024 generators), matching sinsemilla_s.rs. */
let sTable: PallasPoint[] | null = null;

export function getSinsemillaS(j: number): PallasPoint {
  if (j < 0 || j >= 1 << K) throw new Error('getSinsemillaS: index out of range');
  if (!sTable) {
    sTable = new Array(1 << K);
    for (let i = 0; i < 1 << K; i++) {
      // sinsemilla lib.rs:315 `hasher(&j.to_le_bytes())` — j is a u32, so the message
      // is FOUR LE bytes (an earlier 2-byte version hashed the wrong message).
      const msg = Uint8Array.from([i & 0xff, (i >> 8) & 0xff, (i >> 16) & 0xff, (i >> 24) & 0xff]);
      sTable[i] = hashToPallas('pallas', S_PERSONALIZATION, msg);
    }
  }
  return sTable[j];
}

/** Precompute the S table up-front (call during a "preparing..." UI phase). */
export function precomputeSinsemillaS(): void {
  getSinsemillaS(0);
}

/** Lazily computed Sinsemilla Q generators, keyed by domain string. */
const qCache = new Map<string, PallasPoint>();

export function getSinsemillaQ(domain: string): PallasPoint {
  let q = qCache.get(domain);
  if (!q) {
    q = hashToPallas('pallas', Q_PERSONALIZATION, encoder.encode(domain));
    qCache.set(domain, q);
  }
  return q;
}

/** Lazily computed Sinsemilla R (commitment blinding) generators, keyed by domain string. */
const rCache = new Map<string, PallasPoint>();

export function getSinsemillaR(domain: string): PallasPoint {
  let r = rCache.get(domain);
  if (!r) {
    r = hashToPallas('pallas', `${domain}-r`, new Uint8Array(0));
    rCache.set(domain, r);
  }
  return r;
}

/**
 * The Sinsemilla iteration: acc = Q(domain); for each 10-bit chunk of the
 * zero-padded LSB-first bit string: acc = (acc + S[chunk]) + acc.
 * Matches sinsemilla HashDomain::hash_to_point_inner. `bits` is an array of 0/1.
 */
export function sinsemillaHashToPoint(domain: string, bits: number[]): PallasPoint {
  const numChunks = Math.ceil(bits.length / K);
  if (numChunks > C) throw new Error('sinsemillaHashToPoint: message too long');
  let acc = getSinsemillaQ(domain);
  for (let c = 0; c < numChunks; c++) {
    let chunk = 0;
    for (let i = 0; i < K; i++) {
      const bit = c * K + i < bits.length ? bits[c * K + i] : 0;
      if (bit) chunk |= 1 << i; // LSB-first (lebs2ip_k)
    }
    acc = acc.add(getSinsemillaS(chunk)).add(acc);
  }
  return acc;
}

/** SinsemillaHash = x-coordinate (extract_p_bottom: 0 for the identity). */
export function sinsemillaHash(domain: string, bits: number[]): bigint {
  return sinsemillaHashToPoint(domain, bits).extractPBottom();
}

/**
 * SinsemillaCommitToPoint = hash_to_point(msg) + [r]R(domain)
 * (sinsemilla CommitDomain::commit — NO message-length padding, NU5 semantics).
 */
export function sinsemillaCommitToPoint(domain: string, bits: number[], r: bigint): PallasPoint {
  // CommitDomain::new (sinsemilla lib.rs:205-213): the hash domain's message is
  // `${domain}-M` and R is derived from `${domain}-r`. An earlier revision omitted the
  // '-M' suffix, which changed every commitment Q generator (caught by the upstream
  // commit_ivk test vectors).
  return sinsemillaHashToPoint(`${domain}-M`, bits).add(getSinsemillaR(domain).mul(r));
}

/** SinsemillaShortCommit = x-coordinate of SinsemillaCommitToPoint (extract_p_bottom). */
export function sinsemillaShortCommit(domain: string, bits: number[], r: bigint): bigint {
  return sinsemillaCommitToPoint(domain, bits, r).extractPBottom();
}
