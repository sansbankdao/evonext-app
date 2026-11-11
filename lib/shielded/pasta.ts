// lib/shielded/pasta.ts
// Pallas curve arithmetic over the Fp base field, ported 1:1 from pasta_curves 0.5.2
// (cargo registry, dashpay platform Cargo.lock pins 0.5.2) as used by the Dash orchard
// fork (cargo git checkout orchard-94d8ef6bfc19d6d0/38ac9c1).
//
// Curve: y^2 = x^3 + 5 over Fp (a = 0). Points are held in Jacobian coordinates
// (x = X/Z^2, y = Y/Z^3, identity iff Z = 0). Byte encodings follow
// pasta_curves GroupEncoding: 32-byte LE x-coordinate with the y-parity (LSB of y)
// stored in the MSB of the final byte; the identity encodes as 32 zero bytes.

/** Pallas base field modulus q_P. Source: pasta_curves-0.5.2/src/fields/fp.rs MODULUS. */
export const FP_MOD = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;

/** Pallas scalar field modulus r_P. Source: pasta_curves-0.5.2/src/fields/fq.rs MODULUS. */
export const FR_MOD = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;

const FP_B = 5n;

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

export const fp = {
  add: (a: bigint, b: bigint) => mod(a + b, FP_MOD),
  sub: (a: bigint, b: bigint) => mod(a - b, FP_MOD),
  mul: (a: bigint, b: bigint) => mod(a * b, FP_MOD),
  sqr: (a: bigint) => mod(a * a, FP_MOD),
  neg: (a: bigint) => (a === 0n ? 0n : FP_MOD - a),
  isOdd: (a: bigint) => (a & 1n) === 1n,
  pow(a: bigint, e: bigint): bigint {
    let x = 1n;
    let b = mod(a, FP_MOD);
    while (e > 0n) {
      if (e & 1n) x = mod(x * b, FP_MOD);
      b = mod(b * b, FP_MOD);
      e >>= 1n;
    }
    return x;
  },
  inv(a: bigint): bigint {
    return this.pow(a, FP_MOD - 2n);
  },
  /** Legendre symbol: 1 if square, -1 (as q-1) if non-square, 0 if zero. */
  legendre(a: bigint): bigint {
    return this.pow(a, (FP_MOD - 1n) >> 1n);
  },
};

/** (q_P - 1) = 2^32 * T. Source: fp.rs S = 32. */
const FP_S = 32;
const FP_T = 0x40000000000000000000000000000000224698fc094cf91b992d30edn;

/** 2^32 root of unity (h in the Sarkar sqrt comments). Source: fp.rs ROOT_OF_UNITY,
 *  LE 64-bit limbs [0xbdad6fabd87ea32f, 0xea322bf2b7bb7584, 0x362120830561f81a, 0x2bce74deac30ebda]
 *  (Fp::from_raw arguments are plain little-endian integers, not Montgomery form). */
const FP_ROU_LIMBS_LE = [
  0xbdad6fabd87ea32fn,
  0xea322bf2b7bb7584n,
  0x362120830561f81an,
  0x2bce74deac30ebdan,
];
export const FP_ROOT_OF_UNITY = FP_ROU_LIMBS_LE.reduce(
  (acc, limb, i) => acc | (limb << BigInt(64 * i)),
  0n,
);

/**
 * Tonelli-Shanks square root in Fp. Returns one square root of `a` when it is a
 * quadratic residue, or `null` otherwise. Standard algorithm (valid for any odd
 * prime); pasta_curves uses the optimized Sarkar variant but the results agree
 * up to root selection, which all callers resolve explicitly (SWU sign fixup,
 * point decompression sign bit).
 */
export function fpSqrt(a: bigint): bigint | null {
  const n = mod(a, FP_MOD);
  if (n === 0n) return 0n;
  if (fp.legendre(n) !== 1n) return null;
  let c = fp.pow(FP_ROOT_OF_UNITY, FP_T);
  let x = fp.pow(n, (FP_T + 1n) >> 1n);
  let t = fp.pow(n, FP_T);
  let m = FP_S;
  while (t !== 1n) {
    let i = 1;
    let tmp = fp.sqr(t);
    while (tmp !== 1n) {
      tmp = fp.sqr(tmp);
      i += 1;
      if (i >= m) return null; // defensive; unreachable for a true residue
    }
    const b = fp.pow(c, 1n << BigInt(m - i - 1));
    c = fp.sqr(b);
    x = fp.mul(x, b);
    t = fp.mul(t, c);
    m = i;
  }
  return x;
}

/**
 * pasta_curves `sqrt_ratio(u, v)` semantics (hashtocurve.rs / fp.rs):
 * returns [isSquare(u * v^-1), y] where the returned y is a square root of
 * u * v^-1 when it is square, otherwise a square root of h * u * v^-1 with
 * h = ROOT_OF_UNITY (a fixed non-square).
 */
export function fpSqrtRatio(u: bigint, v: bigint): [boolean, bigint] {
  const x = fp.mul(u, fp.inv(v));
  const y = fpSqrt(x);
  if (y !== null) return [true, y];
  const yh = fpSqrt(fp.mul(FP_ROOT_OF_UNITY, x));
  if (yh === null) {
    // Unreachable: h * x is a residue whenever x is a non-residue.
    throw new Error('fpSqrtRatio: h * x unexpectedly non-residue');
  }
  return [false, yh];
}

/** Field element from 64 LE bytes (ff::FromUniformBytes::from_uniform_bytes = LE int mod p). */
export function fpFromUniformBytes64(bytes: Uint8Array): bigint {
  if (bytes.length !== 64) throw new Error('fpFromUniformBytes64: expected 64 bytes');
  let x = 0n;
  for (let i = 63; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
  return x % FP_MOD;
}

/** Scalar field element from 64 LE bytes (same reduction, mod r_P). */
export function frFromUniformBytes64(bytes: Uint8Array): bigint {
  if (bytes.length !== 64) throw new Error('frFromUniformBytes64: expected 64 bytes');
  let x = 0n;
  for (let i = 63; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
  return x % FR_MOD;
}

export const fr = {
  add: (a: bigint, b: bigint) => mod(a + b, FR_MOD),
  sub: (a: bigint, b: bigint) => mod(a - b, FR_MOD),
  mul: (a: bigint, b: bigint) => mod(a * b, FR_MOD),
  neg: (a: bigint) => (a === 0n ? 0n : FR_MOD - a),
};

/** 32-byte LE encoding of an Fp/Fr element. */
export function bigintToBytes32LE(x: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Decode 32 LE bytes as a plain integer (NOT reduced). */
export function bytes32LEToBigint(bytes: Uint8Array): bigint {
  let x = 0n;
  for (let i = 31; i >= 0; i--) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}

/**
 * A point on the Pallas curve in Jacobian coordinates. `Z === 0n` is the identity.
 * All operations match pasta_curves group semantics (complete with respect to the
 * identity; equal-operand doubling handled explicitly).
 */
export class PallasPoint {
  constructor(
    public readonly x: bigint,
    public readonly y: bigint,
    public readonly z: bigint,
  ) {}

  static readonly IDENTITY = new PallasPoint(0n, 1n, 0n);

  static fromAffine(x: bigint, y: bigint): PallasPoint {
    return new PallasPoint(x, y, 1n);
  }

  static fromJacobian(x: bigint, y: bigint, z: bigint): PallasPoint {
    return new PallasPoint(x, y, z);
  }

  isIdentity(): boolean {
    return this.z === 0n;
  }

  /** Affine x (undefined for the identity). */
  affineX(): bigint {
    if (this.isIdentity()) throw new Error('affineX of identity');
    const z2 = fp.sqr(this.z);
    return fp.mul(this.x, fp.inv(z2));
  }

  /** Affine y (undefined for the identity). */
  affineY(): bigint {
    if (this.isIdentity()) throw new Error('affineY of identity');
    const z3 = fp.mul(fp.sqr(this.z), this.z);
    return fp.mul(this.y, fp.inv(z3));
  }

  /** extract_p: affine x-coordinate, or `null` (⊥) for the identity. */
  extractP(): bigint | null {
    return this.isIdentity() ? null : this.affineX();
  }

  /** extract_p_bottom: affine x-coordinate, or 0 for the identity (sinsemilla hash). */
  extractPBottom(): bigint {
    return this.isIdentity() ? 0n : this.affineX();
  }

  negate(): PallasPoint {
    if (this.isIdentity()) return this;
    return new PallasPoint(this.x, fp.neg(this.y), this.z);
  }

  /** Doubling formula for a = 0 (dbl-2009-l). */
  double(): PallasPoint {
    if (this.isIdentity() || this.y === 0n) return PallasPoint.IDENTITY;
    const { x: X1, y: Y1, z: Z1 } = this;
    const A = fp.sqr(X1); // X1^2
    const B = fp.sqr(Y1); // Y1^2
    const C = fp.sqr(B); // B^2
    const D = fp.mul(2n, fp.sub(fp.sqr(fp.add(X1, B)), fp.add(A, C))); // 2*((X1+B)^2-A-C)
    const E = fp.mul(3n, A); // 3*A (a = 0)
    const F = fp.sqr(E);
    // dbl-2009-l: X3 = F - 2*D (an earlier revision read X3 = D - 2*D = -D, which
    // broke every scalar multiplication downstream).
    const X3 = fp.sub(F, fp.mul(2n, D));
    const Y3 = fp.sub(fp.mul(E, fp.sub(D, X3)), fp.mul(8n, C));
    const Z3 = fp.mul(2n, fp.mul(Y1, Z1));
    return new PallasPoint(X3, Y3, Z3);
  }

  /**
   * General Jacobian addition (add-2007-bl) with explicit handling of the
   * identity, equal points (double), and inverses (identity).
   */
  add(other: PallasPoint): PallasPoint {
    if (this.isIdentity()) return other;
    if (other.isIdentity()) return this;
    const { x: X1, y: Y1, z: Z1 } = this;
    const { x: X2, y: Y2, z: Z2 } = other;
    const Z1Z1 = fp.sqr(Z1);
    const Z2Z2 = fp.sqr(Z2);
    const U1 = fp.mul(X1, Z2Z2);
    const U2 = fp.mul(X2, Z1Z1);
    const S1 = fp.mul(Y1, fp.mul(Z2, Z2Z2));
    const S2 = fp.mul(Y2, fp.mul(Z1, Z1Z1));
    if (U1 === U2) {
      if (S1 === S2) return this.double();
      return PallasPoint.IDENTITY;
    }
    const H = fp.sub(U2, U1);
    const I = fp.sqr(fp.mul(2n, H));
    const J = fp.mul(H, I);
    const r = fp.mul(2n, fp.sub(S2, S1));
    const V = fp.mul(U1, I);
    const X3 = fp.sub(fp.sub(fp.sqr(r), J), fp.mul(2n, V));
    const Y3 = fp.sub(fp.mul(r, fp.sub(V, X3)), fp.mul(2n, fp.mul(S1, J)));
    // Z3 = ((Z1+Z2)^2 - Z1Z1 - Z2Z2) * H
    const Z3 = fp.mul(fp.sub(fp.sqr(fp.add(Z1, Z2)), fp.add(Z1Z1, Z2Z2)), H);
    return new PallasPoint(X3, Y3, Z3);
  }

  /** Scalar multiplication (double-and-add, MSB-first). Scalar is reduced mod r_P. */
  mul(scalar: bigint): PallasPoint {
    const k = mod(scalar, FR_MOD);
    let result = PallasPoint.IDENTITY;
    const base = this;
    for (let i = 254; i >= 0; i--) {
      result = result.double();
      if ((k >> BigInt(i)) & 1n) result = result.add(base);
    }
    return result;
  }

  /** Compressed GroupEncoding: 32-byte LE x with y-parity in the MSB; identity = zeros. */
  toBytes(): Uint8Array {
    if (this.isIdentity()) return new Uint8Array(32);
    const x = this.affineX();
    const y = this.affineY();
    const out = bigintToBytes32LE(x);
    if (fp.isOdd(y)) out[31] |= 0x80;
    return out;
  }

  /**
   * Parse a compressed point. Returns the identity for 32 zero bytes (pasta
   * GroupEncoding behavior); throws on a non-canonical/invalid encoding.
   */
  static fromBytes(bytes: Uint8Array): PallasPoint {
    if (bytes.length !== 32) throw new Error('PallasPoint.fromBytes: expected 32 bytes');
    const sign = (bytes[31] & 0x80) !== 0;
    const xBytes = new Uint8Array(bytes);
    xBytes[31] &= 0x7f;
    const x = bytes32LEToBigint(xBytes);
    if (x === 0n) {
      // Only the identity encodes with x = 0, and only with sign bit 0.
      if (sign) throw new Error('PallasPoint.fromBytes: identity with sign bit set');
      return PallasPoint.IDENTITY;
    }
    if (x >= FP_MOD) throw new Error('PallasPoint.fromBytes: non-canonical x');
    const y2 = fp.add(fp.mul(fp.sqr(x), x), FP_B);
    const y = fpSqrt(y2);
    if (y === null) throw new Error('PallasPoint.fromBytes: not on curve');
    return PallasPoint.fromAffine(x, fp.isOdd(y) === sign ? y : fp.neg(y));
  }

  equals(other: PallasPoint): boolean {
    if (this.isIdentity() || other.isIdentity()) return this.isIdentity() && other.isIdentity();
    // Cross-comparison in Jacobian: X1*Z2^2 == X2*Z1^2 and Y1*Z2^3 == Y2*Z1^3.
    const z1z1 = fp.sqr(this.z);
    const z2z2 = fp.sqr(other.z);
    return (
      fp.mul(this.x, z2z2) === fp.mul(other.x, z1z1) &&
      fp.mul(this.y, fp.mul(other.z, z2z2)) === fp.mul(other.y, fp.mul(this.z, z1z1))
    );
  }
}
