// test/unit/lib/pczt-wire.test.mts
// KAT for lib/shielded/pczt-wire.ts against the wasm-prover repo's committed
// fixture (docs/fixtures/pczt-request-v1-2actions.bin, sha256
// c7057a643efa873032bd384ae5c0ba909711319fa5a057848c581b2eca1d3cce).
// The expected values below were decoded flag-by-flag from the fixture bytes
// with /tmp/decode-pczt.py (HANDOFF-WEB-TEAM.md §5: "feed it to your parser
// and confirm you reproduce these values").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import {
  parsePcztFrame,
  serializePcztFrame,
  PcztWireError,
  PCZT_ERR,
  HEADER_LEN,
  SPEND_SECTION_LEN,
  OUTPUT_SECTION_LEN,
  ACTION_WIRE_LEN,
  TREE_DEPTH,
} from '@/lib/shielded/pczt-wire';

const fixture = new Uint8Array(
  readFileSync(join(__dirname, '../../fixtures/pczt-request-v1-2actions.bin')),
);

describe('pczt wire format v1', () => {
  it('section geometry constants match pczt_wire.rs compile-time asserts', () => {
    expect(HEADER_LEN).toBe(45);
    expect(SPEND_SECTION_LEN).toBe(1410);
    expect(OUTPUT_SECTION_LEN).toBe(370);
    expect(ACTION_WIRE_LEN).toBe(1845);
    expect(TREE_DEPTH).toBe(32);
  });

  it('parses the fixture header', () => {
    const f = parsePcztFrame(fixture);
    expect(f.actions.length).toBe(2);
    expect(f.flags).toBe(0x03);
    expect(f.valueSumMagnitude).toBe(40000n);
    expect(f.valueSumIsNegative).toBe(false);
    expect(bytesToHex(f.anchor)).toBe('14713a11b394731ba6240e5f30fed2f670a8750af874996d56594582ae22650a');
    expect(f.zkproof).toBeNull();
  });

  it('parses fixture action 0 (real spend) field-by-field', () => {
    const a = parsePcztFrame(fixture).actions[0];
    expect(bytesToHex(a.cvNet)).toBe('16ea846b4329ef9323f69923eae1316b3547c5f68fcc9f4172c17f9d315928bc');
    expect(bytesToHex(a.rcv!)).toBe('110595da043f490cfadf28c153d5ac6acd250643eaa530d24d5ead2fb9f17d06');
    expect(bytesToHex(a.spend.nullifier)).toBe('0878461eb36a95915fb94ef26359a3e7c9083c6c09f882280f63ffecfefbe509');
    expect(bytesToHex(a.spend.rk)).toBe('e5dcce31f3aa39f486e1eaefa03375ece0bb863013992deb6319224225c3b10b');
    expect(a.spend.spendAuthSig).not.toBeNull();
    expect(a.spend.spendAuthSig!.length).toBe(64);
    expect(bytesToHex(a.spend.spendAuthSig!.slice(0, 16))).toBe('d8091217d6fb74764267f545beb5de00');
    expect(bytesToHex(a.spend.recipient!)).toBe('2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425');
    expect(a.spend.value).toBe(50000n);
    expect(bytesToHex(a.spend.rho!)).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(bytesToHex(a.spend.rseed!)).toBe('0101010101010101010101010101010101010101010101010101010101010101');
    const fvk = a.spend.fvk!;
    expect(fvk.length).toBe(96);
    expect(bytesToHex(fvk.slice(0, 32))).toBe('c605c0eb00d6bb40b6d058a7308f85883a9b589feb7c4d07265951d415fb1e34');
    expect(bytesToHex(fvk.slice(32, 64))).toBe('18c5cd0dcf61488eec0ce2981deaa3343f36606137da78739171664d4dde5e37');
    expect(bytesToHex(fvk.slice(64, 96))).toBe('a6feea9b9b33dfa7468c597ea4edcf93f2fd2ec1498c9547ff1f4b637234f21b');
    expect(a.spend.witness).not.toBeNull();
    expect(a.spend.witness!.position).toBe(0);
    expect(a.spend.witness!.path.length).toBe(32);
    for (const node of a.spend.witness!.path) expect(node.length).toBe(32);
    expect(bytesToHex(a.spend.alpha!)).toBe('90e23d6f5dab45c0b7286d8478205668ce98d9aa9fb9a3c5b62683ca76ea1c23');
    expect(bytesToHex(a.output.cmx)).toBe('b4ae29b174338596d456d5a2ae9621303a53b1d5436cc0bfff07c8dcc556ad27');
    expect(bytesToHex(a.output.ephemeralKey)).toBe('db115e2d1e327f5ed5fbbbd36e7420f1a2ea3988e82d630b16cadca8f6c6611b');
    expect(a.output.encCiphertext.length).toBe(104);
    expect(a.output.outCiphertext.length).toBe(80);
    expect(bytesToHex(a.output.recipient!)).toBe('2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425');
    expect(a.output.value).toBe(10000n);
    expect(bytesToHex(a.output.rseed!)).toBe('3001000000000000bf86eee8497157f5e2f1585f732e8e0b092493ba61b533b0');
    expect(a.output.ock).toBeNull(); // legitimate: build_for_pczt leaves ock unset
  });

  it('parses fixture action 1 (padded dummy) field-by-field', () => {
    const a = parsePcztFrame(fixture).actions[1];
    expect(bytesToHex(a.cvNet)).toBe('ad46a07579edd434d09c6d21b15203f47f4a4b0c8ba29242643c2cd097d35907');
    expect(bytesToHex(a.rcv!)).toBe('d173e9a4c1ea6aacc758952764c7a4fa4ddfeff6c42fea4b824218fd176ecd34');
    expect(bytesToHex(a.spend.nullifier)).toBe('2ed01013adbd0bc1da1144d06f067d4539adb693822adbc00221bcaa93855702');
    expect(bytesToHex(a.spend.rk)).toBe('d3d757f000f89905fcbedd94f0db3d0c14fd8daec3afa59d616c3c99314b7833');
    expect(a.spend.spendAuthSig).not.toBeNull();
    expect(bytesToHex(a.spend.spendAuthSig!.slice(0, 16))).toBe('9650975a9d4073b249d620374b864319');
    expect(bytesToHex(a.spend.recipient!)).toBe('57482aab592ada301340ba9f5a11da58d8cc38623e11903b3c5361ef213e2ff2e56fea0eef5e5c7f0a3c89');
    expect(a.spend.value).toBe(0n);
    expect(bytesToHex(a.spend.rho!)).toBe('48adc8e12f8e2c9489771263d35c4143adc55d075546698cdfb8c1ac09c2583e');
    expect(bytesToHex(a.spend.rseed!)).toBe('1300000000000000a6f17fa6db9a1aa27d5564a2174221d9488b3427f64b4a6c');
    const fvk = a.spend.fvk!;
    expect(bytesToHex(fvk.slice(0, 32))).toBe('072a9404fe0576064d157eb521e6e2dc03120667ba0cf6371aeb4d8c26563b3c');
    expect(bytesToHex(fvk.slice(32, 64))).toBe('355c96e0dba08c3cdca23e3a55e9904c4f1bbcf7abfd50881340ebe9d0469a3d');
    expect(bytesToHex(fvk.slice(64, 96))).toBe('d01dbe89dc4dc29c02fdc20253e5674838755fe47877d5f09676ec03bd732a1f');
    expect(a.spend.witness!.position).toBe(2654435757);
    expect(bytesToHex(a.spend.alpha!)).toBe('27dfdcd270a12488c18712eece7706e87e8940b5b57494ce71679b7161563617');
    expect(bytesToHex(a.output.cmx)).toBe('75c07fb1debf0e3fea124eb3cc0fd5fdf6a0a5245111193b3eb8c04ac8d03239');
    expect(bytesToHex(a.output.ephemeralKey)).toBe('8afd8b84ec80f7ec90a63b7f578bde96f302f74dcbd470d33bd57adef5189417');
    expect(bytesToHex(a.output.recipient!)).toBe('eac934a427442fe87f708a875d5a5b1815acaea0e2063fcfa9053225471bc5ccb9f4f48c73b48326c26aae');
    expect(a.output.value).toBe(0n);
    expect(bytesToHex(a.output.rseed!)).toBe('390100000000000054ff2f9ae1063910130f666d258ceab6a694e13d906a5b13');
    expect(a.output.ock).toBeNull();
  });

  it('round-trips the fixture byte-exact', () => {
    const parsed = parsePcztFrame(fixture);
    const reserialized = serializePcztFrame(parsed);
    expect(bytesToHex(reserialized)).toBe(bytesToHex(fixture));
    expect(reserialized.length).toBe(3673);
  });

  it('round-trips a response-shaped frame (zkproof present)', () => {
    const parsed = parsePcztFrame(fixture);
    parsed.zkproof = new Uint8Array(7264); // fixture response proof size
    parsed.zkproof[0] = 0xab;
    parsed.zkproof[7263] = 0xcd;
    const reserialized = serializePcztFrame(parsed);
    // The 3673-byte request already includes the 2-byte trailer (zkproof flag
    // 0x00 + bsk flag); adding the proof adds 4 (u32 length) + 7264 = 7268.
    // HANDOFF-WEB-TEAM.md §8: response size 10,941 B.
    expect(reserialized.length).toBe(3673 + 4 + 7264);
    const reparsed = parsePcztFrame(reserialized);
    expect(reparsed.zkproof).not.toBeNull();
    expect(reparsed.zkproof!.length).toBe(7264);
    expect(reparsed.zkproof![0]).toBe(0xab);
    expect(reparsed.zkproof![7263]).toBe(0xcd);
    // second round trip still byte-exact
    expect(bytesToHex(serializePcztFrame(reparsed))).toBe(bytesToHex(reserialized));
  });

  it('rejects a bad version byte with ERR_VERSION (2)', () => {
    const bad = fixture.slice();
    bad[0] = 2;
    try {
      parsePcztFrame(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.VERSION);
    }
  });

  it('rejects a truncated frame with ERR_TRUNCATED (3)', () => {
    try {
      parsePcztFrame(fixture.slice(0, 100));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.TRUNCATED);
    }
  });

  it('rejects a flag byte > 1 with ERR_BAD_FLAG_BYTE (4)', () => {
    const bad = fixture.slice();
    bad[12] = 7; // value_sum.is_negative — the first 0/1-constrained byte
    try {
      parsePcztFrame(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.BAD_FLAG_BYTE);
    }
  });

  it('rejects a forbidden field with ERR_FIELD_UNSUPPORTED (5)', () => {
    // action 0's spend.dummy_sk flag: cv_net(32)+rcv(1+32) after the 45-byte header
    // then nullifier(32)+rk(32)+sig(1+64)+recipient(1+43)+value(1+8)+rho(1+32)
    // +rseed(1+32)+fvk(1+96)+witness(1+4+1024)+alpha(1+32) = dummy_sk flag offset
    const dummySkFlagOffset = 45 + 32 + 33 + 32 + 32 + 65 + 44 + 9 + 33 + 33 + 97 + 1029 + 33;
    const bad = fixture.slice();
    bad[dummySkFlagOffset] = 1;
    try {
      parsePcztFrame(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.FIELD_UNSUPPORTED);
      expect((e as PcztWireError).message).toContain('spend.dummy_sk');
    }
  });

  it('rejects a forbidden bsk flag with ERR_FIELD_UNSUPPORTED (5)', () => {
    const bad = fixture.slice();
    bad[bad.length - 1] = 1; // bsk flag is the last byte
    try {
      parsePcztFrame(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.FIELD_UNSUPPORTED);
    }
  });

  it('rejects trailing bytes with ERR_EXCESS_BYTES (6)', () => {
    const bad = new Uint8Array(fixture.length + 1);
    bad.set(fixture);
    try {
      parsePcztFrame(bad);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.EXCESS_BYTES);
    }
  });

  it('rejects action_count 0 with ERR_NO_ACTIONS (27)', () => {
    // header with count 0, then the trailer
    const buf = new Uint8Array(45 + 2);
    buf[0] = 1;
    // count bytes already 0
    buf[3] = 0x03;
    try {
      parsePcztFrame(buf);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PcztWireError);
      expect((e as PcztWireError).code).toBe(PCZT_ERR.NO_ACTIONS);
    }
  });

  it('rejects a wrong-length field on serialize', () => {
    const parsed = parsePcztFrame(fixture);
    parsed.actions[0].spend.rho = hexToBytes('00');
    expect(() => serializePcztFrame(parsed)).toThrowError(PcztWireError);
  });

  it('rejects an empty action list on serialize with ERR_NO_ACTIONS (27)', () => {
    const parsed = parsePcztFrame(fixture);
    parsed.actions = [];
    try {
      serializePcztFrame(parsed);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as PcztWireError).code).toBe(PCZT_ERR.NO_ACTIONS);
    }
  });
});
