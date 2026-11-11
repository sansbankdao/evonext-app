// test/unit/lib/shielded-poseidon-nullifier.test.mts
// KATs for lib/shielded/poseidon.ts (against halo2_poseidon-0.1.0's OWN
// test_vectors.rs fp permute vectors) and lib/shielded/note.ts
// deriveNullifier (against vectors generated on the pinned dashpay/orchard
// fork — /tmp/nf-kat, orchard@dashified-0.14.1).
import { describe, it, expect } from 'vitest';
import { poseidonPermute, poseidonHash2, POSEIDON_CAPACITY_CL2 } from '@/lib/shielded/poseidon';
import { deriveNullifier, derivePsi, deriveRcm, noteCommitment, noteCommitmentPoint } from '@/lib/shielded/note';
import { bytes32LEToBigint, bigintToBytes32LE } from '@/lib/shielded/pasta';
import {
  deriveDkOvk,
  diversifierAtIndex,
  diversifyHash,
  fullViewingKeyFromSpendingKey,
  ivkFromFvk,
  kaDerivePublic,
} from '@/lib/shielded/keys';
import permuteVectors from '../../fixtures/poseidon-permute-vectors.json';

describe('poseidon P128Pow5T3 permute KATs (halo2_poseidon test_vectors.rs fp)', () => {
  for (const [i, vec] of permuteVectors.fp_permute.entries()) {
    it(`vector ${i}: permute(initial_state) == final_state`, () => {
      const init = vec.initial_state.map((h) => BigInt(h)) as [bigint, bigint, bigint];
      const fin = vec.final_state.map((h) => BigInt(h));
      const out = poseidonPermute(init);
      expect(out).toEqual(fin);
    });
  }

  it('hash([6, 42]) == permute([6, 42, 2<<64])[0] (crate self-consistency property)', () => {
    const direct = poseidonPermute([6n, 42n, POSEIDON_CAPACITY_CL2]);
    expect(poseidonHash2(6n, 42n)).toBe(direct[0]);
  });
});

describe('deriveNullifier KATs (pinned dashpay/orchard fork)', () => {
  const SK = new Uint8Array(32).fill(0x0d);

  // [tag, dIndex, value, rhoByte, rseedByte, expectedNk, expectedCmx, expectedNf]
  const cases: Array<[string, number, bigint, number, number, string, string, string]> = [
    [
      'nf_1', 0, 97_000n, 0x01, 0x02,
      '77d4890b79e8b40117374fa787f6e7f783c7858a3bd132949400590b1cb6dd02',
      '49965ac092d36ceba27ebb9cd5c571192f87876985bb28f3337d48a917114d23',
      'bfb3a8f34bf0949818192b09160b0e49e719026f17f846ba3b2309ba36da2404',
    ],
    [
      'nf_2', 0, 12_345_678n, 0x11, 0x22,
      '77d4890b79e8b40117374fa787f6e7f783c7858a3bd132949400590b1cb6dd02',
      'a3975364a94b78fe66ec5fe429adce99c14b2d7a44759170aaa6128582111217',
      'c4c11919ecc6179f079d0f98818a1bada90cfba8ca42407312fd0367790c263b',
    ],
    [
      'nf_3', 7, 5n, 0x01, 0x02,
      '77d4890b79e8b40117374fa787f6e7f783c7858a3bd132949400590b1cb6dd02',
      'd66233a1b22830cf21cf9172b772b0e11b3cc55b4acea003356bc2383e4f2b02',
      'b04ff2f75a546501eb9c47938ca2973095ad8f159926af6261c45253ae63a72b',
    ],
  ];

  for (const [tag, dIndex, value, rhoByte, rseedByte, expectedNk, expectedCmx, expectedNf] of cases) {
    it(`${tag}: nk + cmx + nf all match the fork`, () => {
      const fvk = fullViewingKeyFromSpendingKey(SK);
      expect(Buffer.from(bigintToBytes32LE(fvk.nk)).toString('hex')).toBe(expectedNk);

      const { dk } = deriveDkOvk(fvk);
      const ivk = ivkFromFvk(fvk);
      const d = diversifierAtIndex(dk, dIndex);
      const gD = diversifyHash(d);
      const pkD = kaDerivePublic(gD, ivk);

      const rho = new Uint8Array(32).fill(rhoByte);
      const rseed = new Uint8Array(32).fill(rseedByte);
      const psi = derivePsi(rseed, rho);
      const rcm = deriveRcm(rseed, rho);

      const cmx = noteCommitment(gD, pkD, value, rho, psi, rcm);
      expect(cmx).not.toBeNull();
      expect(Buffer.from(bigintToBytes32LE(cmx!)).toString('hex')).toBe(expectedCmx);

      const cmPoint = noteCommitmentPoint(gD, pkD, value, rho, psi, rcm);
      const nf = deriveNullifier(bigintToBytes32LE(fvk.nk), rho, psi, cmPoint);
      expect(Buffer.from(nf).toString('hex')).toBe(expectedNf);
    });
  }

  it('reject non-canonical nk/rho instead of hashing garbage', () => {
    const fvk = fullViewingKeyFromSpendingKey(SK);
    const { dk } = deriveDkOvk(fvk);
    const ivk = ivkFromFvk(fvk);
    const d = diversifierAtIndex(dk, 0);
    const cmPoint = noteCommitmentPoint(
      diversifyHash(d),
      kaDerivePublic(diversifyHash(d), ivk),
      1n,
      new Uint8Array(32).fill(0x01),
      derivePsi(new Uint8Array(32).fill(0x02), new Uint8Array(32).fill(0x01)),
      deriveRcm(new Uint8Array(32).fill(0x02), new Uint8Array(32).fill(0x01)),
    );
    expect(() =>
      deriveNullifier(new Uint8Array(32).fill(0xff), new Uint8Array(32), 0n, cmPoint),
    ).toThrow(/canonical/);
    expect(() =>
      deriveNullifier(bigintToBytes32LE(fvk.nk), new Uint8Array(32).fill(0xff), 0n, cmPoint),
    ).toThrow(/canonical/);
    expect(() => deriveNullifier(new Uint8Array(31), new Uint8Array(32), 0n, cmPoint)).toThrow(/32 bytes/);
  });

  it('bytes32LEToBigint round-trips the vector encodings', () => {
    const nkBytes = new Uint8Array(Buffer.from('77d4890b79e8b40117374fa787f6e7f783c7858a3bd132949400590b1cb6dd02', 'hex'));
    expect(Buffer.from(bigintToBytes32LE(bytes32LEToBigint(nkBytes))).toString('hex')).toBe(
      '77d4890b79e8b40117374fa787f6e7f783c7858a3bd132949400590b1cb6dd02',
    );
  });
});
