// test/unit/lib/shielded-reddsa.test.mts
// KATs for lib/shielded/reddsa.ts against vectors generated on the remote
// host with the fork's pinned reddsa 0.5.2 crate (tests/kat_gen.rs, Rust
// round-trip + negative control + randomize consistency all asserted there).
import { describe, it, expect } from 'vitest';
import {
  getBindingG,
  randomizeScalar,
  randomizeVerificationKey,
  reddsaSign,
  reddsaVerify,
  spendAuthSign,
  verificationKeyFromScalar,
} from '@/lib/shielded/reddsa';
import { getSpendAuthG } from '@/lib/shielded/keys';
import { bytes32LEToBigint, PallasPoint } from '@/lib/shielded/pasta';

describe('RedDSA (RedPallas) KATs', () => {
  it('basepoints match the fork byte-for-byte', () => {
    expect(Buffer.from(getSpendAuthG().toBytes()).toString('hex')).toBe(
      '63c975b884721a8d0ca1707be30c7f0c5f445f3e7c188d3b06d6f128b32355b7',
    );
    expect(Buffer.from(getBindingG().toBytes()).toString('hex')).toBe(
      '915a3c8868c6c30e2f8090ee45d76e4048208dea5b23664fbb09a40f5544f407',
    );
  });

  it('spendauth_1: tiny sk, empty message', () => {
    const sk = 7n;
    const random80 = new Uint8Array(80);
    random80[0] = 0xaa;
    random80[79] = 0x55;
    const vkExpected = '5a00365400336a7f800460a1d06b2863efa5ac9f0005f35f8e0fe2b89b51fbbb';
    const vk = verificationKeyFromScalar(sk, getSpendAuthG()).toBytes();
    expect(Buffer.from(vk).toString('hex')).toBe(vkExpected);
    const sig = reddsaSign({ sk, vkBytes: vk, msg: new Uint8Array(0), random80, base: getSpendAuthG() });
    expect(Buffer.from(sig).toString('hex')).toBe(
      '0b7dc5193cc5e969898d910791415d3b61f42e15d13e11a6c7bbe812b7d4ac31' +
        '5653ee4079add9aa2255a64679353e8fdc0fa4059572602827b5259622366817',
    );
    expect(reddsaVerify({ vkBytes: vk, msg: new Uint8Array(0), sig, base: getSpendAuthG() })).toBe(true);
  });

  it('spendauth_2: large sk, real message', () => {
    const skBytes = new Uint8Array(32);
    skBytes[0] = 0x99;
    skBytes[31] = 0x2f;
    const sk = bytes32LEToBigint(skBytes);
    const random80 = new Uint8Array(80);
    for (let i = 0; i < 80; i++) random80[i] = (i * 37 + 11) & 0xff;
    const msg = new TextEncoder().encode('DashPlatformSighash test vector');
    const vk = verificationKeyFromScalar(sk, getSpendAuthG()).toBytes();
    expect(Buffer.from(vk).toString('hex')).toBe(
      'a9d586ed4837dd958a49f1948ea5e5eb0b53ada9e871981f8e1b61b05d8160af',
    );
    const sig = reddsaSign({ sk, vkBytes: vk, msg, random80, base: getSpendAuthG() });
    expect(Buffer.from(sig).toString('hex')).toBe(
      'd1bb2cb030526111c4708aa8c54063dd1ab534880a411a3782b2e7688f08501f' +
        'e6bef5a281a144b150b79b51dec085dfeaa2b8b7de5964768056e093555dd02d',
    );
    expect(reddsaVerify({ vkBytes: vk, msg, sig, base: getSpendAuthG() })).toBe(true);
    // negative control: flipped last byte must fail
    const bad = Uint8Array.from(sig);
    bad[63] ^= 1;
    expect(reddsaVerify({ vkBytes: vk, msg, sig: bad, base: getSpendAuthG() })).toBe(false);
  });

  it('binding_1: Binding basepoint with the same tiny sk', () => {
    const sk = 7n;
    const random80 = new Uint8Array(80);
    random80[40] = 0x01;
    const msg = new TextEncoder().encode('bundle sighash bytes go here');
    const vk = verificationKeyFromScalar(sk, getBindingG()).toBytes();
    expect(Buffer.from(vk).toString('hex')).toBe(
      '2c274f7f6b5cbdbc30e46185ce2216d07aaf2e656a249c1618601f2b39357f1b',
    );
    const sig = reddsaSign({ sk, vkBytes: vk, msg, random80, base: getBindingG() });
    expect(Buffer.from(sig).toString('hex')).toBe(
      'fd3c36ac4f7f5c1a8e44a0c746cdfba1e8b30b9203c44f95e97044ffe3b0b18f' +
        '17f4b9db04cd809362308f8b59cbd88cc594f6ba86d8499149f274286a12b62d',
    );
    expect(reddsaVerify({ vkBytes: vk, msg, sig, base: getBindingG() })).toBe(true);
  });

  it('randomize_1: rk = vk + [alpha]G = [sk + alpha]G; randomized key signs', () => {
    const sk = 7n;
    const alpha = 0x2an;
    const random80 = new Uint8Array(80);
    random80[0] = 0xaa;
    random80[79] = 0x55;
    const msg = new TextEncoder().encode('DashPlatformSighash test vector');
    // scalar randomization
    expect(randomizeScalar(sk, alpha)).toBe(0x31n);
    // vk path
    const vk = verificationKeyFromScalar(sk, getSpendAuthG());
    const rvk = randomizeVerificationKey(vk, alpha, getSpendAuthG()).toBytes();
    expect(Buffer.from(rvk).toString('hex')).toBe(
      'c81fa21fe22662a51bfe5e33e91a7ae0ff6837f8702afebbfb3399a5405160a6',
    );
    // sk path must land on the same rk
    expect(Buffer.from(verificationKeyFromScalar(0x31n, getSpendAuthG()).toBytes()).toString('hex')).toBe(
      Buffer.from(rvk).toString('hex'),
    );
    // spendAuthSign convenience = signer.rs: rsk = ask.randomize(alpha); sig over sighash
    const { rk, sig } = spendAuthSign(sk, alpha, msg, random80);
    expect(Buffer.from(rk).toString('hex')).toBe(Buffer.from(rvk).toString('hex'));
    expect(Buffer.from(sig).toString('hex')).toBe(
      'b97fa27b91f620a56c881024a2a46edb1af4b3b543b834e7d23117b2e4036d9b' +
        '1193356797f68d1d782c65519f471eaf0efe7659d2d2c4127a4c123277d3bf33',
    );
    expect(reddsaVerify({ vkBytes: rk, msg, sig, base: getSpendAuthG() })).toBe(true);
  });

  it('malformed encodings fail closed (no throws)', () => {
    const base = getSpendAuthG();
    expect(
      reddsaVerify({ vkBytes: new Uint8Array(31), msg: new Uint8Array(0), sig: new Uint8Array(64), base }),
    ).toBe(false);
    // all-0xff vk / R are non-canonical field elements → false, not throw
    expect(
      reddsaVerify({ vkBytes: new Uint8Array(32).fill(0xff), msg: new Uint8Array(0), sig: new Uint8Array(64), base }),
    ).toBe(false);
    const sig = new Uint8Array(64);
    sig.set(new Uint8Array(32).fill(0xff), 0);
    expect(
      reddsaVerify({ vkBytes: new Uint8Array(32), msg: new Uint8Array(0), sig, base }),
    ).toBe(false);
    // s >= scalar order → false
    const sig2 = new Uint8Array(64);
    sig2.set(new Uint8Array(32).fill(0xff), 32);
    expect(
      reddsaVerify({ vkBytes: PallasPoint.IDENTITY.toBytes(), msg: new Uint8Array(0), sig: sig2, base }),
    ).toBe(false);
  });
});
