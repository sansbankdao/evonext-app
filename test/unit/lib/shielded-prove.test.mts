// test/unit/lib/shielded-prove.test.mts
// lib/shielded/prove.ts — output-only PCZT construction. Deterministic-rand
// structural + consistency tests: every cross-module chain invoked here is
// independently KAT'd against the Dash fork elsewhere (keys/address, esk,
// note commitment + nullifier, value commitment, enc/out ciphertexts, RedDSA
// sign/verify, ZIP-244 bundle digest, empty-tree roots).

import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { buildOutputOnlyPczt, signBinding, emptyTreeAnchor, FLAGS_OUTPUT_ONLY, type RandFn } from '../../../lib/shielded/prove';
import { serializePcztFrame, parsePcztFrame } from '../../../lib/shielded/pczt-wire';
import { hashBundleTxidData, computePlatformSighash, shieldFromIdentityExtraSighashData, type BundleActionEffects } from '../../../lib/shielded/bundle';
import { fullViewingKeyFromSpendingKey, deriveDkOvk, diversifierAtIndex, ivkFromFvk, deriveAddressBytes, getSpendAuthG } from '../../../lib/shielded/keys';
import { tryNoteDecryption } from '../../../lib/shielded/note';
import { sumRcvIntoBsk } from '../../../lib/shielded/value';
import { reddsaVerify, getBindingG } from '../../../lib/shielded/reddsa';
import { emptyRoots } from '../../../lib/shielded/tree';

function makeDeterministicRand(seed: number): RandFn {
  let counter = 0;
  return (n) => {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const c = new Uint8Array(5);
      c[0] = seed;
      c[1] = counter & 0xff;
      c[2] = (counter >> 8) & 0xff;
      c[3] = (counter >> 16) & 0xff;
      c[4] = (counter >> 24) & 0xff;
      const block = sha256(c);
      out.set(block.subarray(0, Math.min(32, n - filled)), filled);
      filled += 32;
      counter++;
    }
    return out;
  };
}

const sk = new Uint8Array(32).fill(42);
const fvk = fullViewingKeyFromSpendingKey(sk);
const { dk, ovk } = deriveDkOvk(fvk);
const d = diversifierAtIndex(dk, 0);
const ivk = ivkFromFvk(fvk);
const selfAddr = deriveAddressBytes(ivk, d);
const memo = new Uint8Array(36).fill(3);
const identityId = new Uint8Array(32).fill(0x11);
const extra = shieldFromIdentityExtraSighashData(identityId);

function effectsOf(frame: ReturnType<typeof parsePcztFrame>): BundleActionEffects[] {
  return frame.actions.map((a) => ({
    nullifier: a.spend.nullifier,
    cmx: a.output.cmx,
    ephemeralKey: a.output.ephemeralKey,
    encCiphertext: a.output.encCiphertext,
    cvNet: a.cvNet,
    rk: a.spend.rk,
    outCiphertext: a.output.outCiphertext,
  }));
}

describe('lib/shielded/prove.ts (output-only PCZT)', () => {
  it('emptyTreeAnchor = EMPTY_ROOTS[32] of the incremental note commitment tree', () => {
    expect(Buffer.from(emptyTreeAnchor()).toString('hex'))
      .toBe(Buffer.from(new Uint8Array(emptyRoots(32)[32].toString(16).padStart(64, '0').match(/../g)!.map((h, i, arr) => parseInt(arr[arr.length - 1 - i], 16)))).toString('hex'));
    expect(FLAGS_OUTPUT_ONLY).toBe(0x02);
  });

  it('structure: 1 real + 1 filler -> 2 fully-populated actions, negative value sum', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 1,
      extraSighashData: extra,
      rand: makeDeterministicRand(7),
    });
    const f = build.frame;
    expect(f).toBeDefined();
    expect(f.actions.length).toBe(2);
    expect(f.flags).toBe(FLAGS_OUTPUT_ONLY);
    expect(f.valueSumMagnitude).toBe(1_000_000n);
    expect(f.valueSumIsNegative).toBe(true);
    expect(Buffer.from(f.anchor).toString('hex')).toBe(Buffer.from(emptyTreeAnchor()).toString('hex'));
    for (const a of f.actions) {
      expect(a.spend.spendAuthSig?.length).toBe(64);
      expect(a.spend.fvk?.length).toBe(96);
      expect(a.spend.witness?.path.length).toBe(32);
      expect(a.spend.alpha?.length).toBe(32);
      expect(a.spend.rho?.length).toBe(32);
      expect(a.spend.rseed?.length).toBe(32);
      expect(a.spend.recipient?.length).toBe(43);
      expect(a.spend.value).toBe(0n);
      expect(a.rcv?.length).toBe(32);
      expect(a.output.ock).toBeNull();
      expect(a.output.encCiphertext.length).toBe(104);
      expect(a.output.outCiphertext.length).toBe(80);
    }
    expect(f.actions[0].output.value).toBe(1_000_000n);
    expect(f.actions[1].output.value).toBe(0n);
    expect(f.zkproof).toBeNull();
    expect(build.valueBalance).toBe(-1_000_000n);
  });

  it('the serialized frame round-trips and commits to the same sighash', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 1,
      extraSighashData: extra,
      rand: makeDeterministicRand(7),
    });
    const parsed = parsePcztFrame(serializePcztFrame(build.frame));
    expect(Buffer.from(serializePcztFrame(parsed)).toString('hex'))
      .toBe(Buffer.from(serializePcztFrame(build.frame)).toString('hex'));
    const commitment = hashBundleTxidData(
      effectsOf(parsed),
      parsed.flags,
      parsed.valueSumIsNegative ? -parsed.valueSumMagnitude : parsed.valueSumMagnitude,
      parsed.anchor,
    );
    expect(Buffer.from(computePlatformSighash(commitment, extra)).toString('hex'))
      .toBe(Buffer.from(build.sighash).toString('hex'));
  });

  it('every spend-auth signature verifies against its action rk over the sighash', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 1,
      extraSighashData: extra,
      rand: makeDeterministicRand(7),
    });
    for (const a of build.frame.actions) {
      expect(reddsaVerify({
        vkBytes: a.spend.rk,
        msg: build.sighash,
        sig: a.spend.spendAuthSig!,
        base: getSpendAuthG(),
      })).toBe(true);
    }
  });

  it('bsk = sum of the frame rcv values', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 1,
      extraSighashData: extra,
      rand: makeDeterministicRand(7),
    });
    expect(sumRcvIntoBsk(build.frame.actions.map((a) => a.rcv!).map((r) => {
      const le = Buffer.from(r).toString('hex').match(/../g)!;
      return BigInt('0x' + le.reverse().join(''));
    }))).toBe(build.bsk);
  });

  it('the recipient trial-decrypts the real output to the original note + memo', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 1,
      extraSighashData: extra,
      rand: makeDeterministicRand(7),
    });
    const real = build.frame.actions[0];
    const note = tryNoteDecryption(ivk, real.output.ephemeralKey, real.output.encCiphertext, real.output.cmx, real.spend.nullifier);
    expect(note).not.toBeNull();
    expect(note!.v).toBe(1_000_000n);
    expect(Buffer.from(note!.d).toString('hex')).toBe(Buffer.from(d).toString('hex'));
    expect(Buffer.from(note!.memo).toString('hex')).toBe(Buffer.from(memo).toString('hex'));
    expect(Buffer.from(note!.rseed).toString('hex')).toBe(Buffer.from(real.output.rseed!).toString('hex'));
  });

  it('signBinding verifies on the Orchard binding base', () => {
    const build = buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1_000_000n, memo, senderOvk: ovk }],
      dummyOutputs: 0,
      extraSighashData: extra,
      rand: makeDeterministicRand(9),
    });
    const { bvk, sig } = signBinding(build.bsk, build.sighash, makeDeterministicRand(10)(80));
    expect(sig.length).toBe(64);
    expect(reddsaVerify({ vkBytes: bvk, msg: build.sighash, sig, base: getBindingG() })).toBe(true);
  });

  it('rejects empty outputs / malformed extra data', () => {
    expect(() => buildOutputOnlyPczt({ outputs: [], extraSighashData: extra, rand: makeDeterministicRand(1) }))
      .toThrow(/at least one output/);
    expect(() => buildOutputOnlyPczt({
      outputs: [{ recipient: selfAddr, value: 1n, memo, senderOvk: ovk }],
      extraSighashData: new Uint8Array(32),
      rand: makeDeterministicRand(1),
    })).toThrow(/33-byte/);
  });
});
