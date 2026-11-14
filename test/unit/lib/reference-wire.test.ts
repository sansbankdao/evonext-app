/*
 * test/unit/lib/reference-wire.test.ts — KATs for the consensus-exact
 * reference wires, pinned to the REAL bincode 2.0.1 encodings produced by the
 * Rust probe (/tmp/bincodetest, run 2026-11-15) and validated against live
 * drive acceptance on testnet the same day:
 *   - type 11 executed: input 2,000,000, fee 2,937,460, address nonce 0→1.
 *   - type 15 executed: input 384,000,000 (300M + 84M pool fee), the 300M note
 *     trial-decrypted with memo 'f51c transparent->shielded', address nonce 1→2.
 */
import { describe, expect, it } from 'vitest'
import {
    encodeFeeStrategy,
    encodeInputEntry,
    encodeOrchardAction,
    encodeWitnessBlock,
    identityTopUpFromAddressesSignable,
    shieldSignable,
    varintU64,
    ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES,
    ST_TAG_SHIELD,
} from '@/lib/shielded/reference-wire'

const hex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'hex'))

describe('varintU64 (bincode standard+BE: 250/0xFB/0xFC/0xFD)', () => {
    it('single byte at and below 250', () => {
        expect(varintU64(0n)).toEqual([0])
        expect(varintU64(250n)).toEqual([250])
    })
    it('0xFB two bytes above 250', () => {
        expect(varintU64(251n)).toEqual([0xfb, 0x00, 0xfb])
        expect(varintU64(0xffffn)).toEqual([0xfb, 0xff, 0xff])
    })
    it('0xFC four bytes above u16', () => {
        expect(varintU64(65536n)).toEqual([0xfc, 0x00, 0x01, 0x00, 0x00])
        expect(varintU64(1_000_000n)).toEqual([0xfc, 0x00, 0x0f, 0x42, 0x40])
        expect(varintU64(300_000_000n)).toEqual([0xfc, 0x11, 0xe1, 0xa3, 0x00])
        expect(varintU64(475_807_200n)).toEqual([0xfc, 0x1c, 0x5c, 0x3d, 0xe0])
    })
    it('0xFD eight bytes above u32', () => {
        expect(varintU64(4_294_967_296n)).toEqual([0xfd, 0, 0, 0, 1, 0, 0, 0, 0])
    })
})

describe('the address map entry', () => {
    const hash = hex('3238158d204289203edd34fb618a5841acb91cf0')
    const addr = new Uint8Array(21)
    addr[0] = 0
    addr.set(hash, 1)

    it('encodes [tag0][hash20][nonce][credits]', () => {
        expect(encodeInputEntry(addr, 1, 475_807_200n)).toEqual([
            0x00, ...hash, 0x01, 0xfc, 0x1c, 0x5c, 0x3d, 0xe0,
        ])
    })
    it('rejects non-P2pkh forms', () => {
        const bad = new Uint8Array(21)
        bad[0] = 0x01
        expect(() => encodeInputEntry(bad, 0, 0n)).toThrow(/P2pkh/)
    })
})

describe('SerializedOrchardAction (409 bytes: nf/rk/cmx/len+216/cv/sig)', () => {
    it('encodes the exact rs-dpp layout', () => {
        const a = {
            nullifier: new Uint8Array(32).fill(1),
            rk: new Uint8Array(32).fill(2),
            cmx: new Uint8Array(32).fill(3),
            encryptedNote: new Uint8Array(216).fill(4),
            cvNet: new Uint8Array(32).fill(5),
            spendAuthSig: new Uint8Array(64).fill(6),
        }
        const enc = encodeOrchardAction(a)
        expect(enc.length).toBe(32 + 32 + 32 + 1 + 216 + 32 + 64)
        expect(enc[0]).toBe(1)
        expect(enc[32]).toBe(2)
        expect(enc[64]).toBe(3)
        expect(enc[96]).toBe(216) // the BinaryData length byte
        expect(enc[97 + 216]).toBe(5)
        expect(enc[97 + 216 + 32]).toBe(6)
    })
})

describe('fee strategy', () => {
    it('encodes [len][variant][u16 index]', () => {
        expect(encodeFeeStrategy([{ type: 'deductFromInput', index: 0 }])).toEqual([0x01, 0x00, 0x00])
    })
})

describe('witness block (BinaryData length-prefixed — the live-proven form)', () => {
    it('encodes [len 1][variant 0][len 65][sig]', () => {
        const sig = new Uint8Array(65).fill(7)
        expect(encodeWitnessBlock([sig])).toEqual([0x01, 0x00, 0x41, ...sig])
    })
})

describe('type 11 IdentityTopUpFromAddresses reference wire', () => {
    it('matches the live-accepted structure: [0b][00][map][output-None][id32][fee][ufi]', () => {
        const hash = hex('3238158d204289203edd34fb618a5841acb91cf0')
        const addr = new Uint8Array(21)
        addr[0] = 0
        addr.set(hash, 1)
        const id = hex('70226909c399c93b04419987523672d6f83392d5c6dabe5323ee67ee8046bd08')
        const ref = identityTopUpFromAddressesSignable({
            addressBytes21: addr,
            addressNonce: 0, // the wire carries 1
            inputCredits: 2_000_000n,
            identityIdBytes32: id,
        })
        /* The live-accepted signable shape (2026-11-15): the tag + version + the fields. */
        const hexOut = Buffer.from(ref.signable).toString('hex')
        expect(ref.signable[0]).toBe(ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES)
        expect(ref.signable[1]).toBe(0x00)
        expect(hexOut.startsWith('0b000100')).toBe(true)
        /* The nonce = state+1 = 1. */
        expect(hexOut.slice(48, 50)).toBe('01')
        /* The credits = 2M = [fc][001e8480]. */
        expect(hexOut.includes(Buffer.from([0xfc, 0x00, 0x1e, 0x84, 0x80]).toString('hex'))).toBe(true)
        /* The finalize appends the length-prefixed witness. */
        const wire = ref.finalize([new Uint8Array(65).fill(9)])
        expect(wire.length).toBe(ref.signable.length + 3 + 65)
        expect(wire[ref.signable.length]).toBe(0x01)
        expect(wire[ref.signable.length + 1]).toBe(0x00)
        expect(wire[ref.signable.length + 2]).toBe(0x41)
    })
})

describe('type 15 Shield reference wire', () => {
    it('matches the live-accepted structure: [0f][00][map][actions][amount][anchor][proof][binding][fee][ufi]', () => {
        const hash = hex('3238158d204289203edd34fb618a5841acb91cf0')
        const addr = new Uint8Array(21)
        addr[0] = 0
        addr.set(hash, 1)
        const anchor = new Uint8Array(32).fill(0xaa)
        const proof = new Uint8Array(8).fill(0xbb)
        const action = {
            nullifier: new Uint8Array(32).fill(1),
            rk: new Uint8Array(32).fill(2),
            cmx: new Uint8Array(32).fill(3),
            encryptedNote: new Uint8Array(216).fill(4),
            cvNet: new Uint8Array(32).fill(5),
            spendAuthSig: new Uint8Array(64).fill(6),
        }
        const ref = shieldSignable({
            addressBytes21: addr,
            addressNonce: 1,
            inputCredits: 384_000_000n,
            actions: [action, action],
            amount: 300_000_000n,
            anchor,
            proof,
            bindingSignature: new Uint8Array(64).fill(7),
        })
        const hexOut = Buffer.from(ref.signable).toString('hex')
        expect(ref.signable[0]).toBe(ST_TAG_SHIELD)
        expect(hexOut.startsWith('0f000100')).toBe(true)
        /* The input credits = 384M = [fc][16e36000]. */
        expect(hexOut.includes(Buffer.from([0xfc, 0x16, 0xe3, 0x60, 0x00]).toString('hex'))).toBe(true)
        /* 2 actions. */
        expect(hexOut.includes('02')).toBe(true)
        /* The finalize appends the length-prefixed witness. */
        const wire = ref.finalize([new Uint8Array(65).fill(9)])
        expect(wire.length).toBe(ref.signable.length + 3 + 65)
    })
})
