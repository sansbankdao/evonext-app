// test/unit/lib/shielded-address.test.ts
// KATs for the Dash Orchard bech32m address codec (lib/shielded/address.ts).
//
// The raw43/encdash/enctdash vectors are GENERATED GROUND TRUTH from the
// pinned fork crates themselves (evorunner: orchard-kat/src/bin/addrkat.rs,
// orchard fork dashified-0.14.1 = commit 38ac9c19 + bech32 0.11.1, the
// crate+version rs-dpp pins): SpendingKey::from_bytes([42u8;32]) ->
// FVK::address_at(0, External) -> to_bech32m_string — the exact constructor
// the fork's own orchard_address.rs tests use. Do not edit the vectors.

import { describe, expect, it } from 'vitest'
import { bech32, bech32m } from '@scure/base'
import {
    ORCHARD_TYPE,
    classifyHrp,
    decodeOrchardAddress,
    encodeOrchardAddress,
    hrpForNetwork,
} from '@/lib/shielded/address'

const RAW43 = Uint8Array.from(
    Buffer.from(
        '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425',
        'hex',
    ),
)
const ENC_MAINNET =
    'dash1zqnypw3ll8wr3glx2f6cdxr5asa4kmtghx3kge97sjxe46869j39s98exsnuwcyhqpd9gfg2x9vhj'
const ENC_TESTNET =
    'tdash1zqnypw3ll8wr3glx2f6cdxr5asa4kmtghx3kge97sjxe46869j39s98exsnuwcyhqpd9gfg6mehdt'

describe('shielded address codec (rs-dpp orchard_address parity)', () => {
    it('matches the fork-generated mainnet KAT byte-for-byte', () => {
        expect(encodeOrchardAddress(RAW43, 'mainnet')).toBe(ENC_MAINNET)
    })

    it('matches the fork-generated testnet KAT byte-for-byte', () => {
        expect(encodeOrchardAddress(RAW43, 'testnet')).toBe(ENC_TESTNET)
    })

    it('decodes the mainnet KAT back to the exact raw 43 bytes', () => {
        const decoded = decodeOrchardAddress(ENC_MAINNET)
        expect(decoded.network).toBe('mainnet')
        expect(Buffer.from(decoded.raw).toString('hex')).toBe(
            '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425',
        )
        expect(decoded.d.length).toBe(11)
        expect(decoded.pkd.length).toBe(32)
    })

    it('decodes the testnet KAT and classifies it as testnet', () => {
        const decoded = decodeOrchardAddress(ENC_TESTNET)
        expect(decoded.network).toBe('testnet')
        expect(Buffer.from(decoded.raw).toString('hex')).toBe(
            '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425',
        )
    })

    it('HRPs match platform_address.rs (dash mainnet / tdash non-mainnet)', () => {
        expect(hrpForNetwork('mainnet')).toBe('dash')
        expect(hrpForNetwork('testnet')).toBe('tdash')
        expect(classifyHrp('dash')).toBe('mainnet')
        expect(classifyHrp('tdash')).toBe('testnet')
        expect(() => classifyHrp('bc')).toThrow(/neither 'dash' nor 'tdash'/)
    })

    it("rejects a P2PKH type byte (0xb0) — fork test_orchard_bech32m_wrong_type_byte_fails", () => {
        const payload = new Uint8Array(44)
        payload[0] = 0xb0 // PlatformAddress::P2PKH_TYPE
        const encoded = bech32m.encode('dash', bech32m.toWords(payload))
        expect(encoded.startsWith('dash1k')).toBe(true)
        expect(() => decodeOrchardAddress(encoded)).toThrow(/type byte/)
    })

    it('rejects a 21-byte payload — fork test_orchard_bech32m_wrong_length_fails', () => {
        const payload = new Uint8Array(21)
        payload[0] = ORCHARD_TYPE
        const encoded = bech32m.encode('dash', bech32m.toWords(payload))
        expect(() => decodeOrchardAddress(encoded)).toThrow(/length/)
    })

    it('rejects a pk_d that is not a valid Pallas point', () => {
        const raw = new Uint8Array(43)
        // Valid diversifier bytes, invalid pk_d (non-canonical x >= p).
        raw.fill(0x01, 0, 11)
        raw.fill(0xff, 11)
        expect(() => encodeOrchardAddress(raw, 'mainnet')).toThrow(/Pallas|on curve|non-canonical/)
    })

    it('rejects a corrupted checksum', () => {
        const tampered =
            ENC_MAINNET.slice(0, -3) +
            (ENC_MAINNET.endsWith('vhj') ? 'vhk' : ENC_MAINNET.slice(-3))
        expect(() => decodeOrchardAddress(tampered)).toThrow(/bech32/)
    })

    it('accepts a bech32 (non-m) checksum variant like the rust generic decoder, then applies structural checks', () => {
        // bech32::decode in rust accepts either variant; encode the correct
        // payload with the OLD (BIP-173) checksum and confirm our decoder
        // mirrors that permissiveness.
        const payload = new Uint8Array(44)
        payload[0] = ORCHARD_TYPE
        payload.set(RAW43, 1)
        const asBech32 = bech32.encode('dash', bech32.toWords(payload))
        expect(asBech32).not.toBe(ENC_MAINNET)
        const decoded = decodeOrchardAddress(asBech32)
        expect(decoded.network).toBe('mainnet')
        expect(Buffer.from(decoded.raw).toString('hex')).toBe(
            '2640ba3ff9dc38a3e65275869874ec3b5b6d68b9a36464be848d9ae8fa2ca25814f93427c76097005a5425',
        )
    })
})
