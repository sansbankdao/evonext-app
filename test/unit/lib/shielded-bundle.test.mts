// test/unit/lib/shielded-bundle.test.mts
// KAT for lib/shielded/bundle.ts against the fork's OWN golden vector
// (bundle/commitments.rs txid_digest_golden_vectors, DashMemo arm) plus
// byte-layout checks for the rs-dpp v0 extra_data builders.
import { describe, it, expect } from 'vitest';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  computePlatformSighash,
  FLAGS_ENABLED,
  hashBundleTxidData,
  shieldedWithdrawalExtraSighashData,
  unshieldExtraSighashData,
  creditPoolOutputOnlyExtraSighashDataV0,
  platformAddressToBytes,
  shieldFundingDigestV0,
  shieldExtraSighashData,
  shieldFromIdentityExtraSighashData,
  shieldFromAssetLockExtraSighashData,
  sortPlatformAddresses,
  PLATFORM_ADDRESS_P2PKH_TYPE,
  PLATFORM_ADDRESS_P2SH_TYPE,
  SHIELD_BUNDLE_TAG,
} from '@/lib/shielded/bundle';
import {
  diversifierAtIndex,
  deriveDkOvk,
  fullViewingKeyFromSpendingKey,
  ivkFromFvk,
  kaAgreePoint,
  kaDerivePublic,
  diversifyHash,
  kdfOrchard,
} from '@/lib/shielded/keys';
import { deriveEsk, derivePsi, deriveRcm, noteCommitment } from '@/lib/shielded/note';
import { getSpendAuthG } from '@/lib/shielded/keys';
import { verificationKeyFromScalar } from '@/lib/shielded/reddsa';
import { bigintToBytes32LE, bytes32LEToBigint } from '@/lib/shielded/pasta';

/** Reproduces deterministic_bundle::<DashMemo>([0xa5; 36]) from
 *  bundle/commitments.rs: identical keys, note, ciphertexts, and parts. */
function deterministicDashBundleAction() {
  const fvk = fullViewingKeyFromSpendingKey(new Uint8Array(32).fill(0x0d)); // SpendingKey [0x0d;32]
  const ivk = ivkFromFvk(fvk);
  const { dk } = deriveDkOvk(fvk);
  const d = diversifierAtIndex(dk, 0); // address_at(0u32, Scope::External)
  const gD = diversifyHash(d);
  const pkD = kaDerivePublic(gD, ivk);

  const rho = new Uint8Array(32).fill(0x01);
  const rseed = new Uint8Array(32).fill(0x02);
  const value = 97_000n;

  // Deterministic encryption: esk derives from rseed (ZIP-212).
  const esk = deriveEsk(rseed, rho);
  const epk = kaAgreePoint(esk, gD);
  const epkBytes = epk.toBytes();
  const shared = kaAgreePoint(esk, pkD);
  const key = kdfOrchard(shared, epkBytes);
  const pt = new Uint8Array(88);
  pt[0] = 0x02;
  pt.set(d, 1);
  let v = value;
  for (let i = 0; i < 8; i++) {
    pt[12 + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  pt.set(rseed, 20);
  pt.fill(0xa5, 52); // DashMemo [0xa5; 36]
  const encCiphertext = chacha20poly1305(key, new Uint8Array(12)).encrypt(pt);

  const psi = derivePsi(rseed, rho);
  const rcm = deriveRcm(rseed, rho);
  const cmx = noteCommitment(gD, pkD, value, rho, psi, rcm);
  if (cmx === null) throw new Error('test: null commitment');

  // rk = VerificationKey from redpallas SigningKey [0x21;32]
  const rk = verificationKeyFromScalar(bytes32LEToBigint(new Uint8Array(32).fill(0x21)), getSpendAuthG()).toBytes();

  return {
    nullifier: rho, // Nullifier::from_bytes([0x01;32]) — stored verbatim
    cmx: bigintToBytes32LE(cmx),
    ephemeralKey: epkBytes,
    encCiphertext,
    cvNet: new Uint8Array(32), // ValueCommitment::from_bytes(&[0u8;32]) = identity = 32 zeros
    rk,
    outCiphertext: new Uint8Array(80).fill(0x03),
  };
}

describe('bundle digest (ZIP-244) KAT', () => {
  it('matches the fork golden vector for a Dash-memo single-action bundle', () => {
    const action = deterministicDashBundleAction();
    const digest = hashBundleTxidData([action], FLAGS_ENABLED, 0n, new Uint8Array(32));
    expect(Buffer.from(digest).toString('hex')).toBe(
      '4129796966e923cb34134db4e743c5e8aeb10b8fe43f5964f4ed4dfbb21b7f7e',
    );
  });

  it('two identical actions produce a different (well-defined) digest', () => {
    const action = deterministicDashBundleAction();
    const digest = hashBundleTxidData([action, action], FLAGS_ENABLED, 0n, new Uint8Array(32));
    expect(Buffer.from(digest).toString('hex')).not.toBe(
      '4129796966e923cb34134db4e743c5e8aeb10b8fe43f5964f4ed4dfbb21b7f7e',
    );
    expect(digest.length).toBe(32);
  });

  it('value_balance is folded as SIGNED i64 LE (−1 = 0xff…ff)', () => {
    const action = deterministicDashBundleAction();
    const a = hashBundleTxidData([action], FLAGS_ENABLED, -1n, new Uint8Array(32));
    const b = hashBundleTxidData([action], FLAGS_ENABLED, 0n, new Uint8Array(32));
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });
});

describe('platform sighash + v0 extra_data layouts', () => {
  it('sighash = SHA-256("DashPlatformSighash" || commitment || extra)', () => {
    const commitment = new Uint8Array(32).fill(0x11);
    const empty = computePlatformSighash(commitment, new Uint8Array(0));
    // Independently recompute with noble sha256 over the concatenation.
    const { sha256 } = require('@noble/hashes/sha2.js') as typeof import('@noble/hashes/sha2.js');
    const domain = new TextEncoder().encode('DashPlatformSighash');
    expect(Buffer.from(empty).toString('hex')).toBe(
      Buffer.from(sha256(new Uint8Array([...domain, ...commitment]))).toString('hex'),
    );
    const extra = new Uint8Array([0xde, 0xad]);
    expect(Buffer.from(computePlatformSighash(commitment, extra)).toString('hex')).toBe(
      Buffer.from(sha256(new Uint8Array([...domain, ...commitment, 0xde, 0xad]))).toString('hex'),
    );
  });

  it('unshield extra_data = output_address || amount u64 LE', () => {
    const addr = new Uint8Array([1, 2, 3, 4, 5]);
    const data = unshieldExtraSighashData(addr, 0x0807060504030201n);
    expect(Buffer.from(data).toString('hex')).toBe('0102030405' + '0102030405060708');
  });

  it('withdrawal extra_data = script || amount u64 LE || fee u32 LE || pooling u8', () => {
    const script = new Uint8Array(25).fill(0x76); // canonical P2PKH length
    const data = shieldedWithdrawalExtraSighashData(script, 0x0807060504030201n, 0xa1b2c3d4 >>> 0, 0);
    const hex = Buffer.from(data).toString('hex');
    expect(hex).toBe('76'.repeat(25) + '0102030405060708' + 'd4c3b2a1' + '00');
    expect(data.length).toBe(25 + 8 + 4 + 1);
  });

  it('v14 credit-pool output-only binding: tag || owner + platform-address encodings', () => {
    const ab = new Uint8Array(20).fill(0xab);
    const cd = new Uint8Array(20).fill(0xcd);
    // platform_address.rs:83-96 pinning tests (bincode standard = variant || hash160).
    expect(Buffer.from(platformAddressToBytes({ type: PLATFORM_ADDRESS_P2PKH_TYPE, hash160: ab })).toString('hex'))
      .toBe('00abababababababababababababababababababab');
    expect(Buffer.from(platformAddressToBytes({ type: PLATFORM_ADDRESS_P2SH_TYPE, hash160: cd })).toString('hex'))
      .toBe('01cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd');
    // shield_funding_digest_v0 (SHA-256 over the 21-byte encodings in map-key order) —
    // expected values computed with node:crypto sha256 over the exact layout.
    const one = [{ type: PLATFORM_ADDRESS_P2PKH_TYPE, hash160: ab } as const];
    expect(Buffer.from(shieldFundingDigestV0(one)).toString('hex'))
      .toBe('e9b5ee0735ba1c91c51226d50a8b0c34fb7f370557e740ccce82d1dc79a8e134');
    expect(Buffer.from(shieldExtraSighashData(one)).toString('hex'))
      .toBe('84e9b5ee0735ba1c91c51226d50a8b0c34fb7f370557e740ccce82d1dc79a8e134');
    // Map-key order = derived Ord (variant, then hash): P2pkh sorts before P2sh even
    // when supplied in the reverse order.
    const two = sortPlatformAddresses([
      { type: PLATFORM_ADDRESS_P2SH_TYPE, hash160: cd },
      { type: PLATFORM_ADDRESS_P2PKH_TYPE, hash160: ab },
    ]);
    expect(two[0].type).toBe(PLATFORM_ADDRESS_P2PKH_TYPE);
    expect(Buffer.from(shieldFundingDigestV0(two)).toString('hex'))
      .toBe('985b0577748100d0d6eede978f9ad306fae226f8e39ad12ed9b68795b13c89b6');
    // Identity / asset-lock variants: tag || 32-byte owner verbatim (sighash.rs:834-884).
    const id32 = new Uint8Array(32).fill(0x11);
    expect(Buffer.from(shieldFromIdentityExtraSighashData(id32)).toString('hex'))
      .toBe('851111111111111111111111111111111111111111111111111111111111111111');
    expect(Buffer.from(shieldFromAssetLockExtraSighashData(id32)).toString('hex'))
      .toBe('861111111111111111111111111111111111111111111111111111111111111111');
    expect(() => creditPoolOutputOnlyExtraSighashDataV0(SHIELD_BUNDLE_TAG, new Uint8Array(31)))
      .toThrow(/32 bytes/);
    expect(() => platformAddressToBytes({ type: PLATFORM_ADDRESS_P2PKH_TYPE, hash160: new Uint8Array(19) }))
      .toThrow(/20 bytes/);
  });

  it('reject malformed widths instead of silently hashing wrong bytes', () => {
    const action = deterministicDashBundleAction();
    expect(() =>
      hashBundleTxidData([{ ...action, cmx: new Uint8Array(31) }], FLAGS_ENABLED, 0n, new Uint8Array(32)),
    ).toThrow(/cmx must be 32 bytes/);
    expect(() => hashBundleTxidData([action], FLAGS_ENABLED, 0n, new Uint8Array(31))).toThrow(/anchor/);
    expect(() => hashBundleTxidData([], FLAGS_ENABLED, 0n, new Uint8Array(32))).toThrow(/at least one action/);
    expect(() => hashBundleTxidData([action], FLAGS_ENABLED, 2n ** 64n, new Uint8Array(32))).toThrow(/i64/);
    expect(() => computePlatformSighash(new Uint8Array(31), new Uint8Array(0))).toThrow(/32 bytes/);
    expect(() => shieldedWithdrawalExtraSighashData(new Uint8Array(0), 1n, 1.5, 0)).toThrow(/u32 integer/);
  });
});
