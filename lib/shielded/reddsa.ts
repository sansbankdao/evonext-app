// lib/shielded/reddsa.ts
// RedDSA (RedPallas) signatures — 1:1 port of reddsa 0.5.2 (the fork's
// pinned crate) signing_key.rs / verification_key.rs / hash.rs for the two
// Orchard SigTypes (SpendAuth, Binding). Used for the spend authorization
// signatures and the bundle binding signature in the PCZT flow.
//
// sign(sk, msg):
//   nonce = H*(random80 || vk || msg)
//   R     = [nonce]B ;  r_bytes = encode(R)
//   c     = H*(r_bytes || vk || msg)
//   s     = nonce + c·sk                    (signing_key.rs:111-147)
// verify(vk, msg, sig):
//   c     = H*(r_bytes || vk || msg)
//   check [s]B − [c]vk − R is the identity  (verification_key.rs:147-207;
//                                            `is_small_order` == identity on
//                                            Pallas, which has cofactor 1)
// H* = Blake2b-512, personalization "Zcash_RedPallasH", output mapped with
// pallas::Scalar::from_uniform_bytes (hash.rs:19-50; orchard.rs:66-90).
// SpendAuth basepoint = hash_to_curve("z.cash:Orchard")(b"G")
// Binding   basepoint = hash_to_curve("z.cash:Orchard-cv")(b"r")
//                                            (orchard.rs:73-85 + tests.rs)
import {
  PallasPoint,
  FR_MOD,
  bigintToBytes32LE,
  bytes32LEToBigint,
  frFromUniformBytes64,
} from './pasta';
import { blake2b512Personal } from './hash';
import { hashToPallas } from './swu';
import { getSpendAuthG } from './keys';

export const REDDSA_HSTAR_PERSONALIZATION = 'Zcash_RedPallasH';

/** H*: Blake2b-512("Zcash_RedPallasH") over the concatenated inputs, wide-
 *  reduced into the scalar field (hash.rs:19-50). */
export function hStar(...inputs: Uint8Array[]): bigint {
  return frFromUniformBytes64(blake2b512Personal(REDDSA_HSTAR_PERSONALIZATION, ...inputs));
}

/** G^Orchard-cv-r = hash_to_curve("z.cash:Orchard-cv")(b"r") — the BindingSig
 *  basepoint (reddsa orchard.rs:82-85; distinct from Sinsemilla's R table:
 *  different DST/message). Lazily computed once. */
let bindingG: PallasPoint | null = null;
export function getBindingG(): PallasPoint {
  if (!bindingG) {
    bindingG = hashToPallas('pallas', 'z.cash:Orchard-cv', new TextEncoder().encode('r'));
  }
  return bindingG;
}

/** vk = [sk]B (verification_key.rs:138-145). */
export function verificationKeyFromScalar(sk: bigint, base: PallasPoint): PallasPoint {
  return base.mul(sk);
}

/** sk' = sk + alpha (reddsa Randomizer application, signing_key.rs:94-98). */
export function randomizeScalar(sk: bigint, alpha: bigint): bigint {
  return (sk + alpha) % FR_MOD;
}

/** vk' = vk + [alpha]B (verification_key.rs:127-136). */
export function randomizeVerificationKey(vk: PallasPoint, alpha: bigint, base: PallasPoint): PallasPoint {
  return vk.add(base.mul(alpha));
}

/** Deterministic-injected-randomness RedDSA sign (signing_key.rs:111-147).
 *  `random80` stands in for the RNG's 80 random bytes; callers in production
 *  MUST pass 80 bytes from a CSPRNG. Returns the 64-byte signature
 *  (r_bytes || LE scalar). */
export function reddsaSign(params: {
  sk: bigint;
  vkBytes: Uint8Array;
  msg: Uint8Array;
  random80: Uint8Array;
  base: PallasPoint;
}): Uint8Array {
  const { sk, vkBytes, msg, random80, base } = params;
  if (random80.length !== 80) throw new Error('reddsaSign: random80 must be 80 bytes');
  const nonce = hStar(random80, vkBytes, msg);
  const r = base.mul(nonce);
  const rBytes = r.toBytes();
  const c = hStar(rBytes, vkBytes, msg);
  const s = (nonce + ((c * sk) % FR_MOD)) % FR_MOD;
  const sig = new Uint8Array(64);
  sig.set(rBytes, 0);
  sig.set(bigintToBytes32LE(s), 32);
  return sig;
}

/** RedDSA verify (verification_key.rs:147-207). Accepts the compressed vk
 *  bytes (and optionally the already-decoded point to avoid re-decoding).
 *  Returns false on any malformed encoding — never throws. */
export function reddsaVerify(params: {
  vkBytes: Uint8Array;
  msg: Uint8Array;
  sig: Uint8Array;
  base: PallasPoint;
  vkPoint?: PallasPoint;
}): boolean {
  const { vkBytes, msg, sig, base } = params;
  if (sig.length !== 64 || vkBytes.length !== 32) return false;
  let r: PallasPoint;
  let vk: PallasPoint;
  try {
    r = PallasPoint.fromBytes(sig.subarray(0, 32));
    vk = params.vkPoint ?? PallasPoint.fromBytes(vkBytes);
  } catch {
    return false; // Error::InvalidSignature / MalformedVerificationKey
  }
  const s = bytes32LEToBigint(sig.subarray(32, 64));
  if (s >= FR_MOD) return false; // scalar from_repr rejected
  const c = hStar(sig.subarray(0, 32), vkBytes, msg);
  // check = [s]B − [c]vk − R  ==  identity
  const check = base.mul(s).add(vk.mul(c).negate()).add(r.negate());
  return check.isIdentity();
}

/** Convenience: sign with the SpendAuth basepoint (G^Orchard). */
export function spendAuthSign(sk: bigint, alpha: bigint, msg: Uint8Array, random80: Uint8Array): { rk: Uint8Array; sig: Uint8Array } {
  const base = getSpendAuthG();
  const rsk = randomizeScalar(sk, alpha);
  const rkPoint = base.mul(rsk);
  const rk = rkPoint.toBytes();
  const sig = reddsaSign({ sk: rsk, vkBytes: rk, msg, random80, base });
  return { rk, sig };
}
