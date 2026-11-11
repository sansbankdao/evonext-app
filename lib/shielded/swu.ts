// lib/shielded/swu.ts
// Simplified SWU hash-to-curve for the iso-pallas -> pallas isogeny, ported 1:1 from
// pasta_curves-0.5.2 src/hashtocurve.rs (hash_to_field, map_to_curve_simple_swu,
// iso_map) and the Ep constants in src/curves.rs (ISOGENY_CONSTANTS, Z, THETA,
// iso a/b), as used by the Dash orchard fork for:
//   - GroupHash^P ("z.cash:Orchard" / "z.cash:Orchard-gd" / "z.cash:Orchard-cv"
//     / "z.cash:Orchard-NoteCommit" / "z.cash:Orchard-CommitIvk" + "-M"/"-r"/...)
//   - Sinsemilla Q ("z.cash:SinsemillaQ") and S ("z.cash:SinsemillaS") generators.

import { blake2b } from '@noble/hashes/blake2.js';
import { FP_MOD, PallasPoint, fp, fpSqrtRatio } from './pasta';

/** Convert a big-endian byte array to a plain integer. */
function beBytesToBigint(bytes: Uint8Array): bigint {
  let x = 0n;
  for (let i = 0; i < bytes.length; i++) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}

function u64x4LeToBigint(limbs: bigint[]): bigint {
  return limbs.reduce((acc, limb, i) => acc | (limb << BigInt(64 * i)), 0n);
}

/** iso-pallas curve constant a (curves.rs `impl IsoEp { fn a() }`). */
const ISO_EP_A = u64x4LeToBigint([
  0x92bb4b0b657a014bn,
  0xb74134581a27a59fn,
  0x49be2d7258370742n,
  0x18354a2eb0ea8c9cn,
]);

/** iso-pallas curve constant b = 1265 (curves.rs). */
const ISO_EP_B = 1265n;

/** Z = -13 mod q_P (curves.rs `pub const Z`). */
const EP_Z = FP_MOD - 13n;

/** THETA = sqrt(Z / ROOT_OF_UNITY) (curves.rs `pub const THETA`, from_raw limbs). */
const EP_THETA = u64x4LeToBigint([
  0xca330bcc09ac318en,
  0x51f64fc4dc888857n,
  0x4647aef782d5cdc8n,
  0x0f7bdb65814179b4n,
]);

/** 13 isogeny constants iso-pallas -> pallas (curves.rs `Ep::ISOGENY_CONSTANTS`, from_raw limbs). */
const EP_ISOGENY_CONSTANTS: bigint[] = [
  u64x4LeToBigint([0x775f6034aaaaaaabn, 0x4081775473d8375bn, 0xe38e38e38e38e38en, 0x0e38e38e38e38e38n]),
  u64x4LeToBigint([0x8cf863b02814fb76n, 0x0f93b82ee4b99495n, 0x267c7ffa51cf412an, 0x3509afd51872d88en]),
  u64x4LeToBigint([0x0eb64faef37ea4f7n, 0x380af066cfeb6d69n, 0x98c7d7ac3d98fd13n, 0x17329b9ec5253753n]),
  u64x4LeToBigint([0xeebec06955555580n, 0x8102eea8e7b06eb6n, 0xc71c71c71c71c71cn, 0x1c71c71c71c71c71n]),
  u64x4LeToBigint([0xc47f2ab668bcd71fn, 0x9c434ac1c96b6980n, 0x5a607fcce0494a79n, 0x1d572e7ddc099cffn]),
  u64x4LeToBigint([0x2aa3af1eae5b6604n, 0xb4abf9fb9a1fc81cn, 0x1d13bf2a7f22b105n, 0x325669becaecd5d1n]),
  u64x4LeToBigint([0x5ad985b5e38e38e4n, 0x7642b01ad461bad2n, 0x4bda12f684bda12fn, 0x1a12f684bda12f68n]),
  u64x4LeToBigint([0xc67c31d8140a7dbbn, 0x07c9dc17725cca4an, 0x133e3ffd28e7a095n, 0x1a84d7ea8c396c47n]),
  u64x4LeToBigint([0x02e2be87d225b234n, 0x1765e924f7459378n, 0x303216cce1db9ff1n, 0x3fb98ff0d2ddcaddn]),
  u64x4LeToBigint([0x93e53ab371c71c4fn, 0x0ac03e8e134eb3e4n, 0x7b425ed097b425edn, 0x025ed097b425ed09n]),
  u64x4LeToBigint([0x5a28279b1d1b42aen, 0x5941a3a4a97aa1b3n, 0x0790bfb3506defb6n, 0x0c02c5bcca0e6b7fn]),
  u64x4LeToBigint([0x4d90ab820b12320an, 0xd976bbfabbc5661dn, 0x573b3d7f7d681310n, 0x17033d3c60c68173n]),
  u64x4LeToBigint([0x992d30ecfffffde5n, 0x224698fc094cf91bn, 0x0000000000000000n, 0x4000000000000000n]),
];

/**
 * hash_to_field (hashtocurve.rs): XMD-style expansion with BLAKE2b-512 and a
 * 16-byte ZERO personalization. Returns [u0, u1] in Fp.
 *
 *   dst      = domain_prefix || "-" || curve_id || "_XMD:BLAKE2b_SSWU_RO_"
 *   DST'     = dst || I2OSP(len(dst), 1)   (RFC 9380 §5.3.1: length byte LAST)
 *   b_0      = H( 0x00*128 || msg || I2OSP(128, 2) || I2OSP(0, 1) || DST' )
 *   b_1      = H( b_0 || I2OSP(1, 1) || DST' )
 *   b_2      = H( (b_0 ^ b_1) || I2OSP(2, 1) || DST' )
 *   u_i      = OS2IP(b_{i+1}) mod q_P   (big-endian — the Rust reverses b_i then
 *              interprets it as little-endian, which is the same thing)
 */
export function hashToField2(curveId: string, domainPrefix: string, message: Uint8Array): [bigint, bigint] {
  const dst = new TextEncoder().encode(`${domainPrefix}-${curveId}_XMD:BLAKE2b_SSWU_RO_`);
  const dstLenByte = Uint8Array.from([dst.length]);
  const zeroPersonal = new Uint8Array(16);
  const h = () => blake2b.create({ dkLen: 64, personalization: zeroPersonal });

  const b0h = h();
  b0h.update(new Uint8Array(128));
  b0h.update(message);
  b0h.update(Uint8Array.from([0, 128, 0]));
  b0h.update(dst);
  b0h.update(dstLenByte);
  const b0 = b0h.digest();

  const b1h = h();
  b1h.update(b0);
  b1h.update(Uint8Array.from([1]));
  b1h.update(dst);
  b1h.update(dstLenByte);
  const b1 = b1h.digest();

  const xor = new Uint8Array(64);
  for (let i = 0; i < 64; i++) xor[i] = b0[i] ^ b1[i];
  const b2h = h();
  b2h.update(xor);
  b2h.update(Uint8Array.from([2]));
  b2h.update(dst);
  b2h.update(dstLenByte);
  const b2 = b2h.digest();

  return [beBytesToBigint(b1) % FP_MOD, beBytesToBigint(b2) % FP_MOD];
}

/**
 * map_to_curve_simple_swu (hashtocurve.rs) onto the iso-pallas curve, with the
 * WB2019 section 4.2 inversion-avoiding optimization. Returns a Jacobian point
 * on the iso-pallas curve (y^2 = x^3 + ISO_EP_A x + ISO_EP_B).
 */
function mapToCurveSimpleSwu(u: bigint): PallasPoint {
  const a = ISO_EP_A;
  const b = ISO_EP_B;
  const z_u2 = fp.mul(EP_Z, fp.sqr(u)); // Z * u^2
  const ta = fp.add(fp.sqr(z_u2), z_u2); // (Z u^2)^2 + Z u^2
  const num_x1 = fp.mul(b, fp.add(ta, 1n)); // B * (ta + 1)
  const div = ta === 0n ? fp.mul(a, EP_Z) : fp.mul(a, fp.neg(ta)); // A * (ta==0 ? Z : -ta)
  const num2_x1 = fp.sqr(num_x1);
  const div2 = fp.sqr(div);
  const div3 = fp.mul(div2, div);
  const num_gx1 = fp.add(fp.mul(fp.add(num2_x1, fp.mul(a, div2)), num_x1), fp.mul(b, div3));

  const num_x2 = fp.mul(z_u2, num_x1);

  const [gx1Square, y1] = fpSqrtRatio(num_gx1, div3);
  const y2 = fp.mul(fp.mul(EP_THETA, z_u2), fp.mul(u, y1));
  const num_x = gx1Square ? num_x1 : num_x2;
  const yPre = gx1Square ? y1 : y2;

  // sgn0(u) = LSB; if sgn0(u) != sgn0(y), negate y.
  const y = fp.isOdd(u) === fp.isOdd(yPre) ? yPre : fp.neg(yPre);

  return PallasPoint.fromJacobian(fp.mul(num_x, div), fp.mul(y, div3), div);
}

/**
 * Degree-3 isogeny map iso-pallas -> pallas (hashtocurve.rs iso_map), using the
 * WB2019 section 4.3 method. Input/output are Jacobian coordinates.
 */
function isoMap(p: PallasPoint): PallasPoint {
  const { x, y, z } = p;
  const iso = EP_ISOGENY_CONSTANTS;
  const z2 = fp.sqr(z);
  const z3 = fp.mul(z2, z);
  const z4 = fp.sqr(z2);
  const z6 = fp.sqr(z3);

  // num_x = ((k0*x + k1*z2)*x + k2*z4)*x + k3*z6
  const num_x = fp.add(
    fp.mul(fp.add(fp.mul(fp.add(fp.mul(iso[0], x), fp.mul(iso[1], z2)), x), fp.mul(iso[2], z4)), x),
    fp.mul(iso[3], z6),
  );
  // div_x = (z2*x + k4*z4)*x + k5*z6
  const div_x = fp.add(
    fp.mul(fp.add(fp.mul(z2, x), fp.mul(iso[4], z4)), x),
    fp.mul(iso[5], z6),
  );
  // num_y = (((k6*x + k7*z2)*x + k8*z4)*x + k9*z6)*y
  const num_y = fp.mul(
    fp.add(
      fp.mul(fp.add(fp.mul(fp.add(fp.mul(iso[6], x), fp.mul(iso[7], z2)), x), fp.mul(iso[8], z4)), x),
      fp.mul(iso[9], z6),
    ),
    y,
  );
  // div_y = (((x + k10*z2)*x + k11*z4)*x + k12*z6)*z3
  const div_y = fp.mul(
    fp.add(
      fp.mul(fp.add(fp.mul(fp.add(x, fp.mul(iso[10], z2)), x), fp.mul(iso[11], z4)), x),
      fp.mul(iso[12], z6),
    ),
    z3,
  );

  const zo = fp.mul(div_x, div_y);
  const xo = fp.mul(fp.mul(num_x, div_y), zo);
  const yo = fp.mul(fp.mul(num_y, div_x), fp.sqr(zo));

  return PallasPoint.fromJacobian(xo, yo, zo);
}

/**
 * pallas::Point::hash_to_curve(curve_id)(domain_prefix)(message) — the full
 * group hash: u0,u1 = hash_to_field; Q0 = swu(u0); Q1 = swu(u1); R = Q0 + Q1;
 * P = iso_map(R). (curves.rs `impl Group for ... hash_to_curve` lines 876-899.)
 */
export function hashToPallas(curveId: string, domainPrefix: string, message: Uint8Array): PallasPoint {
  const [u0, u1] = hashToField2(curveId, domainPrefix, message);
  const q0 = mapToCurveSimpleSwu(u0);
  const q1 = mapToCurveSimpleSwu(u1);
  return isoMap(q0.add(q1));
}
