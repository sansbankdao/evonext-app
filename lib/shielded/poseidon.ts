// lib/shielded/poseidon.ts
// Poseidon P128Pow5T3 over the Pallas BASE field — 1:1 port of
// halo2_poseidon-0.1.0 (lib.rs permute/sponge + p128pow5t3.rs spec).
// Used by Orchard for prf_nf (note/nullifier.rs) — the ONLY consumer in this
// module is the nullifier derivation (T=3, RATE=2, ConstantLength<2>).
//
//   permutation: 4 full rounds, 56 partial rounds, 4 full rounds
//     full:    for each word i: w_i = (w_i + rc_i)^5;  then state = MDS · state
//     partial: for each word i: w_i += rc_i;  w_0 = w_0^5;  then state = MDS · state
//   hash(a, b): state = [a, b, 2 << 64] → permute → state[0]
//
// Constants (ROUND_CONSTANTS/MDS/MDS_INV) are generated in
// poseidon-constants.ts from the crate's fp.rs tables (see the file header).
import { fp } from './pasta';
import { ROUND_CONSTANTS, MDS } from './poseidon-constants';

const FULL_ROUNDS = 8;
const PARTIAL_ROUNDS = 56;
const WIDTH = 3;

/** ConstantLength<2> initial capacity element: (2 as u128) << 64, as Fp. */
export const POSEIDON_CAPACITY_CL2 = 2n << 64n;

/** poseidon::permute (lib.rs:106-151) with the P128Pow5T3 spec. */
export function poseidonPermute(state: [bigint, bigint, bigint]): [bigint, bigint, bigint] {
  if (ROUND_CONSTANTS.length !== FULL_ROUNDS + PARTIAL_ROUNDS) {
    throw new Error('poseidonPermute: round constant table is incomplete');
  }
  const s = [...state] as [bigint, bigint, bigint];
  const applyMds = () => {
    const ns: [bigint, bigint, bigint] = [0n, 0n, 0n];
    for (let i = 0; i < WIDTH; i++) {
      for (let j = 0; j < WIDTH; j++) {
        ns[i] = fp.add(ns[i], fp.mul(MDS[i][j], s[j]));
      }
    }
    s[0] = ns[0];
    s[1] = ns[1];
    s[2] = ns[2];
  };
  const rF = FULL_ROUNDS / 2;
  for (let r = 0; rF > r; r++) {
    const rcs = ROUND_CONSTANTS[r];
    for (let i = 0; i < WIDTH; i++) s[i] = fp.mul(fp.sqr(fp.sqr(fp.add(s[i], rcs[i]))), fp.add(s[i], rcs[i]));
    applyMds();
  }
  for (let r = rF; rF + PARTIAL_ROUNDS > r; r++) {
    const rcs = ROUND_CONSTANTS[r];
    for (let i = 0; i < WIDTH; i++) s[i] = fp.add(s[i], rcs[i]);
    s[0] = fp.mul(fp.sqr(fp.sqr(s[0])), s[0]); // x^5 on the first word only
    applyMds();
  }
  for (let r = rF + PARTIAL_ROUNDS; rF + PARTIAL_ROUNDS + rF > r; r++) {
    const rcs = ROUND_CONSTANTS[r];
    for (let i = 0; i < WIDTH; i++) s[i] = fp.mul(fp.sqr(fp.sqr(fp.add(s[i], rcs[i]))), fp.add(s[i], rcs[i]));
    applyMds();
  }
  return s;
}

/** poseidon::Hash<_, P128Pow5T3, ConstantLength<2>, 3, 2>::hash([a, b])
 *  (lib.rs:457-465): absorb both words, finish_absorbing → permute, squeeze
 *  the first state element. ConstantLength padding adds nothing because the
 *  input length already equals the rate. */
export function poseidonHash2(a: bigint, b: bigint): bigint {
  return poseidonPermute([a, b, POSEIDON_CAPACITY_CL2])[0];
}

/** spec.rs:243-246 prf_nf(nk, rho) — the Orchard nullifier PRF. */
export function prfNf(nk: bigint, rho: bigint): bigint {
  return poseidonHash2(nk, rho);
}
