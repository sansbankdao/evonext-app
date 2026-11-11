// test/unit/lib/shielded-encrypt.test.mts
// lib/shielded/encrypt.ts KATs generated on evorunner with the REAL
// OrchardNoteEncryption API against the Dash orchard fork (tag
// dashified-0.14.1, commit 38ac9c1) + zcash_note_encryption fork (rev
// 9f7e93d) + the fork's built-in DashMemo — probe
// ~/orchard-kat/src/bin/enckat.rs (2026-11-11). Deterministic inputs:
// sk=[42u8;32], d = diversifier 0 (External), rho=[7u8;32], rseed=[9u8;32],
// value=1_000_000, memo=[3u8;36], cv_net = cv(-1_000_000, rcv=5).

import { describe, it, expect } from 'vitest';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  fullViewingKeyFromSpendingKey,
  deriveDkOvk,
  diversifierAtIndex,
  ivkFromFvk,
  deriveAddressBytes,
} from '../../../lib/shielded/keys';
import { deriveEsk, tryNoteDecryption } from '../../../lib/shielded/note';
import { valueCommitment } from '../../../lib/shielded/value';
import { bigintToBytes32LE } from '../../../lib/shielded/pasta';
import { encryptNotePlaintext, encryptOutgoingPlaintext } from '../../../lib/shielded/encrypt';

const ADDR43 = '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425';
const OVK32 = 'da6f1b974c3a64bb3fbda4636d069efbcf27d4214b841a290c21f5711893ceaf';
const ESK32 = '77ffe82ee1bd8d69fdefbe3d1b3cae34f081807d807208f16021ce2b4c1cea18';
const CV32 = '2486ec9f5fe982fb107d4545ba10740fe08b5d958c0ed82dfa5dcec4c6293293';
const CMX32 = 'f2f95b96bdd59957a1094e7602933797a7f36abc9592a46d388eca6f70158839';
const EPK32 = '176cdaedd2f7dec32dadc73fa5a8e87516b64c18d19b35d968921a324604a889';
const ENC104 = 'e318ef62f5bd594aed2c34afbe8e87d882487bf4110a29788ea4271acafac7702d096b074cb931812557b59b4f97102a4bcee25d50209057ec70cf104ac897fe95ab525c872d030abb1ae744c15ee05aeffd13e74d7c9aa71822649a2fe7e891740fb445bb1d6b81';
const OUT80 = 'b2771fae6a0fea1fbe1f2ca50ccc95f199a2882f782bb6f7728e5ff0bf9ac7fd338048d68a7a8d82a15bab166b6215645c8846c6edc16b61c4d9d618edab8783585b6be62297f6007981c47c15f63cea';

const sk = new Uint8Array(32).fill(42);
const rho = new Uint8Array(32).fill(7);
const rseed = new Uint8Array(32).fill(9);
const memo = new Uint8Array(36).fill(3);

const fvk = fullViewingKeyFromSpendingKey(sk);
const { dk, ovk } = deriveDkOvk(fvk);
const d = diversifierAtIndex(dk, 0);
const ivk = ivkFromFvk(fvk);
const esk = deriveEsk(rseed, rho);
const cvNet = valueCommitment(-1_000_000n, 5n);

describe('lib/shielded/encrypt.ts (real OrchardNoteEncryption KATs)', () => {
    it('key/address chain pins (ovk, esk, addr)', () => {
        expect(bytesToHex(ovk)).toBe(OVK32);
        expect(bytesToHex(bigintToBytes32LE(esk))).toBe(ESK32);
        expect(bytesToHex(deriveAddressBytes(ivk, d))).toBe(ADDR43);
    });

    it('cv_net pins (output-only v_net = -1_000_000, rcv = 5)', () => {
        expect(bytesToHex(cvNet.toBytes())).toBe(CV32);
    });

    it('encrypt_note_plaintext: epk + 104-byte enc_ciphertext', () => {
        const { epkBytes, encCiphertext } = encryptNotePlaintext(hexToBytes(ADDR43), 1_000_000n, rseed, memo, esk);
        expect(bytesToHex(epkBytes)).toBe(EPK32);
        expect(bytesToHex(encCiphertext)).toBe(ENC104);
    });

    it('encrypt_outgoing_plaintext: 80-byte out_ciphertext', () => {
        const out = encryptOutgoingPlaintext(
            hexToBytes(OVK32),
            hexToBytes(CV32),
            hexToBytes(CMX32),
            hexToBytes(EPK32),
            hexToBytes(ADDR43).slice(11, 43),
            bigintToBytes32LE(esk),
        );
        expect(out.length).toBe(80);
        expect(bytesToHex(out)).toBe(OUT80);
    });

    it('round-trip: the recipient decrypts our ciphertext to the original note + memo', () => {
        const { epkBytes, encCiphertext } = encryptNotePlaintext(hexToBytes(ADDR43), 1_000_000n, rseed, memo, esk);
        const note = tryNoteDecryption(ivk, epkBytes, encCiphertext, hexToBytes(CMX32), rho);
        expect(note).not.toBeNull();
        expect(bytesToHex(note!.d)).toBe(bytesToHex(d));
        expect(note!.v).toBe(1_000_000n);
        expect(bytesToHex(note!.rseed)).toBe(bytesToHex(rseed));
        expect(bytesToHex(note!.rho)).toBe(bytesToHex(rho));
        expect(bytesToHex(note!.memo)).toBe(bytesToHex(memo));
    });

    it('rejects: identity pk_d / zero esk / bad sizes', () => {
        const identityAddr = new Uint8Array(43); // d = 0^11, pk_d = compressed identity (0^32)
        expect(() => encryptNotePlaintext(identityAddr, 1n, rseed, memo, esk)).toThrow();
        expect(() => encryptNotePlaintext(hexToBytes(ADDR43), 1n, rseed, memo, 0n)).toThrow();
        expect(() => encryptNotePlaintext(hexToBytes(ADDR43).slice(0, 42), 1n, rseed, memo, esk)).toThrow();
        expect(() => encryptNotePlaintext(hexToBytes(ADDR43), 1n << 64n, rseed, memo, esk)).toThrow();
        expect(() => encryptOutgoingPlaintext(hexToBytes(OVK32).slice(0, 31), hexToBytes(CV32), hexToBytes(CMX32), hexToBytes(EPK32), hexToBytes(ADDR43).slice(11, 43), bigintToBytes32LE(esk))).toThrow();
    });
});
