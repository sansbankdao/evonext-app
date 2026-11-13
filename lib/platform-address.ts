// lib/platform-address.ts
//
// DIP-17 Platform payment addresses ("dash1k…" / "tdash1k…") — the
// Transparent (L2) address pool — and the REAL Platform-address balance
// the wallet's Transparent row displays.
//
// Owner directive (2026-11-14): the Transparent row shows the PLATFORM
// ADDRESS balance, NEVER the identity balance (the identity balance lives
// under the dashboard card) and NEVER a Core (L1) balance — Core DASH is
// only an on-ramp that gets swapped to Platform credits.
//
// Parity: 1:1 with evonext-mobile (src/helpers/receiveAddresses.ts +
// src/screens/debug/bech32m.ts, verified against rs-dpp
// address_funds/platform_address.rs + rust-dashcore key-wallet/dip9.rs):
//   - derivation path  m/9'/coin'/17'/0'/0'/idx
//     (coin 5 mainnet / 1 testnet; account + key_class hardened at 0,
//     leaf index NON-hardened — account_type.rs)
//   - address payload  0xb0 (P2PKH_TYPE) || hash160(compressed pubkey)
//     encoded as bech32m with HRP "dash" (mainnet) / "tdash" (testnet)
//   - balance query    WasmSdk.getAddressesInfos(addresses) ->
//     Map<string, PlatformAddressInfo | undefined>; balance is CREDITS
//     (1 DASH = 1e11 credits, rs-dpp util/units.rs)

// NOTE: dashcore-lib ships TypeScript definitions that do not match its
// runtime API (the same reason lib/core-chain.ts accesses it untyped).
import * as dashcore from '@dashevo/dashcore-lib'
import { sha256 } from '@noble/hashes/sha2.js'
import { ripemd160 } from '@noble/hashes/legacy.js'
import { hexToBytes } from '@noble/hashes/utils.js'
import { bech32m } from '@scure/base'

import { getMnemonic } from './secure-storage'

/* The shipped typings do not match the runtime API (verified), so the
 * library is accessed untyped — identical to lib/core-chain.ts. */
const d: any = dashcore

type Network = 'mainnet' | 'testnet'

/** SLIP-44 Dash coin type: 5 mainnet / 1 testnet (dip9.rs). */
export const platformCoinTypeFor = (network: Network): number =>
    network === 'mainnet' ? 5 : 1

/** dashcore-lib network slug. */
const toCoreNetwork = (network: Network): string =>
    network === 'mainnet' ? 'livenet' : 'testnet'

/** hash160 = RIPEMD160(SHA256(bytes)) over the COMPRESSED public key. */
const hash160Of = (compressedPubKeyHex: string): Uint8Array =>
    ripemd160(sha256(hexToBytes(compressedPubKeyHex)))

/** Encode a 20-byte hash160 as a bech32m Platform address
 *  (0xb0 P2PKH_TYPE prefix; rs-dpp platform_address.rs). */
export function encodePlatformAddress(hash160: Uint8Array, network: Network): string {
    if (hash160.length !== 20) {
        throw new Error(`platform address hash must be 20 bytes, got ${hash160.length}`)
    }
    const payload = new Uint8Array(21)
    payload[0] = 0xb0
    payload.set(hash160, 1)
    return bech32m.encode(network === 'mainnet' ? 'dash' : 'tdash', bech32m.toWords(payload))
}

/**
 * Derive the wallet's DIP-17 Platform payment receive address at
 * `index` from the session mnemonic (LOCAL crypto — no network I/O).
 */
export function derivePlatformReceiveAddress(network: Network, index = 0): string {
    const mnemonic = getMnemonic()
    if (!mnemonic) {
        throw new Error('Mnemonic not found')
    }

    const root = d.HDPrivateKey.fromSeed(
        (new d.Mnemonic(mnemonic)).toSeed(),
        toCoreNetwork(network),
    )

    /* m/9'/coin'/17'/0'/0'/idx — the final leaf index is NON-hardened. */
    const derived = root.derive(
        `m/9'/${platformCoinTypeFor(network)}'/17'/0'/0'/${index}`)

    const privateKey = new d.PrivateKey(derived.privateKey, toCoreNetwork(network))
    return encodePlatformAddress(hash160Of(privateKey.publicKey.toString()), network)
}

/**
 * Sum the credits held across the wallet's DIP-17 receive pool
 * (indexes 0..poolSize-1) — the REAL Transparent balance.
 */
export async function fetchPlatformAddressBalance(
    sdk: any,
    network: Network,
    poolSize = 20,
): Promise<bigint> {
    const addresses: string[] = []
    for (let i = 0; i < poolSize; i++) {
        addresses.push(derivePlatformReceiveAddress(network, i))
    }
    const infos = await sdk.getAddressesInfos(addresses)
    let total = 0n
    for (const info of infos.values()) {
        if (info) total += info.balance
    }
    return total
}
