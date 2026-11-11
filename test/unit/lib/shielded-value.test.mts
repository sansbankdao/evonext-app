// test/unit/lib/shielded-value.test.mts
// lib/shielded/value.ts — value commitment KATs generated on evorunner with
// the Dash orchard fork (tag dashified-0.14.1, commit 38ac9c1), probe
// ~/orchard-kat/src/bin/cvkat.rs (2026-11-11). ValueCommitment::derive
// (value.rs:358) replicated 1:1 in the probe (the fork's pub(crate) ValueSum
// is unreachable from a bin target; the whole body is hash_to_curve +
// V*value + R*rcv).

import { describe, it, expect } from 'vitest';
import { bytesToHex } from '@noble/hashes/utils.js';
import { FR_MOD } from '../../../lib/shielded/pasta';
import { getValueCommitV, valueCommitment, sumRcvIntoBsk } from '../../../lib/shielded/value';
import { getBindingG } from '../../../lib/shielded/reddsa';

describe('lib/shielded/value.ts (fork KATs)', () => {
    it('V generator = hash_to_curve("z.cash:Orchard-cv")("v")', () => {
        expect(bytesToHex(getValueCommitV().toBytes())).toBe(
            '6743f93a6ebda72a8c7c5a2b7fa304fe32b29b4f706aa8f7420f3d8e7a59702f');
    });

    it('R generator (= reddsa binding G) matches the fork', () => {
        expect(bytesToHex(getBindingG().toBytes())).toBe(
            '915a3c8868c6c30e2f8090ee45d76e4048208dea5b23664fbb09a40f5544f407');
    });

    it('cv(v=0, rcv=1) = R', () => {
        expect(bytesToHex(valueCommitment(0n, 1n).toBytes())).toBe(
            '915a3c8868c6c30e2f8090ee45d76e4048208dea5b23664fbb09a40f5544f407');
    });

    it('cv(v=1, rcv=2)', () => {
        expect(bytesToHex(valueCommitment(1n, 2n).toBytes())).toBe(
            '684fae56d2f2ac91517bc791f7bb932c4f03e27bba7d9b97757ab90b69ed662d');
    });

    it('cv(v=123456789, rcv=3735928559)', () => {
        expect(bytesToHex(valueCommitment(123456789n, 3735928559n).toBytes())).toBe(
            '56dec8d9aa939648213fb1a34c57d76386f5bcf7f9200410b74df48c720c08b4');
    });

    it('cv(v=-5000, rcv=42) — negative value (two’s-complement scalar)', () => {
        expect(bytesToHex(valueCommitment(-5000n, 42n).toBytes())).toBe(
            'e3bbed7fdcb476fd9b1d4b5547a770730cfe601abece72e50c93572edc08b638');
    });

    it('sumRcvIntoBsk: sums mod r', () => {
        expect(sumRcvIntoBsk([1n, 2n, 3n])).toBe(6n);
        expect(sumRcvIntoBsk([FR_MOD - 1n, 2n])).toBe(1n);
        expect(sumRcvIntoBsk([])).toBe(0n);
    });
});
