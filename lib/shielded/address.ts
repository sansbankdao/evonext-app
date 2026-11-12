// lib/shielded/address.ts
// Dash Orchard shielded payment-address encoding — 1:1 port of rs-dpp
// address_funds (pinned fork rc.8):
//   - orchard_address.rs: raw = diversifier(11) || pk_d(32) = 43 bytes;
//     bech32m payload = type byte 0x10 (ORCHARD_TYPE) ++ raw = 44 bytes;
//     decode validates length, type byte, HRP class AND that pk_d is a
//     valid Pallas point (PaymentAddress::from_raw_address_bytes).
//   - platform_address.rs:255-257: HRP 'dash' (mainnet) / 'tdash'
//     (testnet/devnet/regtest).
//   - bech32 = "0.11" (rs-dpp Cargo.toml:18) — BIP-350 bech32m; rust
//     `bech32::decode` is variant-generic, so decode tries bech32m first
//     and falls back to bech32 (BIP-350 decoders SHOULD accept both).
//
// The string form is Dash-specific: no F4Jumble, no Unified Address
// wrapper (orchard_address.rs doc comment). Mainnet addresses start with
// `dash1z…`, testnet with `tdash1z…` ('z' is the bech32 character for the
// 0x10 type byte).
//
// KATs (test/unit/lib/shielded-address.test.mts) are generated on
// evorunner from the pinned crates themselves (orchard-kat
// src/bin/addrkat.rs): SpendingKey::from_bytes([42u8;32]) ->
// FVK::address_at(0, External) -> to_bech32m_string — the exact
// constructor the fork's own tests use.

import { bech32, bech32m } from '@scure/base'
import { PallasPoint } from './pasta'

export type ShieldedNetwork = 'mainnet' | 'testnet'

/** Size of the Orchard diversifier (orchard_address.rs:9). */
export const ORCHARD_DIVERSIFIER_SIZE = 11
/** Size of pk_d (orchard_address.rs:12). */
export const ORCHARD_PKD_SIZE = 32
/** Total raw payment-address size (orchard_address.rs:15). */
export const ORCHARD_ADDRESS_SIZE = ORCHARD_DIVERSIFIER_SIZE + ORCHARD_PKD_SIZE
/** Type byte for Orchard addresses in bech32m (orchard_address.rs:36). */
export const ORCHARD_TYPE = 0x10

/** DIP-0018 HRPs (platform_address.rs:255-257). */
export function hrpForNetwork(network: ShieldedNetwork): string {
    return network === 'mainnet' ? 'dash' : 'tdash'
}

/** Inverse of classify_platform_hrp (platform_address.rs:263-272). */
export function classifyHrp(hrpLower: string): ShieldedNetwork {
    if (hrpLower === 'dash') return 'mainnet'
    if (hrpLower === 'tdash') return 'testnet'
    throw new Error(
        `not a platform address: HRP '${hrpLower}' is neither 'dash' nor 'tdash'`,
    )
}

function assertValidPkD(pkd: Uint8Array): void {
    // orchard_address.rs from_raw_bytes: PaymentAddress::from_raw_address_bytes
    // returns None when pk_d is not a valid Pallas curve point.
    PallasPoint.fromBytes(pkd)
}

/**
 * Encode a raw 43-byte Orchard payment address (diversifier || pk_d) as a
 * bech32m string for the network. Mirrors OrchardAddress::to_bech32m_string
 * (orchard_address.rs:76-86).
 */
export function encodeOrchardAddress(raw: Uint8Array, network: ShieldedNetwork): string {
    if (raw.length !== ORCHARD_ADDRESS_SIZE) {
        throw new Error(
            `encodeOrchardAddress: expected ${ORCHARD_ADDRESS_SIZE} raw bytes, got ${raw.length}`,
        )
    }
    // Mirrors the OrchardAddress constructor's invariant (orchard_address.rs
    // from_raw_bytes: 'Returns an error if pk_d is not a valid Pallas curve
    // point') — an OrchardAddress can never hold an invalid pk_d.
    assertValidPkD(raw.slice(ORCHARD_DIVERSIFIER_SIZE))
    const payload = new Uint8Array(1 + ORCHARD_ADDRESS_SIZE)
    payload[0] = ORCHARD_TYPE
    payload.set(raw, 1)
    return bech32m.encode(hrpForNetwork(network), bech32m.toWords(payload))
}

export interface DecodedOrchardAddress {
    network: ShieldedNetwork
    /** 11-byte diversifier */
    d: Uint8Array
    /** 32-byte diversified transmission key */
    pkd: Uint8Array
    /** convenience: the full 43 raw bytes (d || pkd) */
    raw: Uint8Array
}

/**
 * Decode a bech32m Orchard address string. Mirrors
 * OrchardAddress::from_bech32m_string (orchard_address.rs:98-128):
 * HRP must be 'dash' (mainnet) or 'tdash' (testnet, lowercased before
 * classify), payload must be exactly 44 bytes starting with type 0x10, and
 * pk_d must be a valid Pallas curve point.
 */
export function decodeOrchardAddress(s: string): DecodedOrchardAddress {
    let decoded: { prefix: string; words: number[] }
    try {
        decoded = bech32m.decode(s as `${string}1${string}`)
    } catch {
        // The rust crate's bech32::decode accepts either checksum variant;
        // mirror that permissiveness before applying structural checks.
        try {
            decoded = bech32.decode(s as `${string}1${string}`)
        } catch {
            throw new Error(`invalid bech32(m) address`)
        }
    }
    const network = classifyHrp(decoded.prefix.toLowerCase())
    const payload = bech32m.fromWords(decoded.words)
    if (payload.length !== 1 + ORCHARD_ADDRESS_SIZE) {
        throw new Error(
            `invalid Orchard address length: expected ${1 + ORCHARD_ADDRESS_SIZE} bytes, got ${payload.length}`,
        )
    }
    if (payload[0] !== ORCHARD_TYPE) {
        throw new Error(
            `invalid Orchard address type byte: expected 0x${ORCHARD_TYPE.toString(16).padStart(2, '0')}, got 0x${payload[0].toString(16).padStart(2, '0')}`,
        )
    }
    const raw = new Uint8Array(payload.slice(1))
    const d = new Uint8Array(raw.slice(0, ORCHARD_DIVERSIFIER_SIZE))
    const pkd = new Uint8Array(raw.slice(ORCHARD_DIVERSIFIER_SIZE))
    assertValidPkD(pkd)
    return { network, d, pkd, raw }
}
