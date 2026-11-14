/* lib/shielded/assemble-signing.ts
 * ECDSA address-witness signing for the Shield (15) transition. The
 * witness is a 65-byte recoverable secp256k1 signature in the SAME wire
 * convention the identity-key signature uses (F29d, runtime-verified:
 * [v = 27 + 4 + recid | r | s], low-S, over SHA-256d of the signable
 * bytes). noble 2.4 emits header 27 + 32 + recid (compressed); the re-
 * encode below converts it to 27 + 4 + recid. */
import { sha256 } from '@noble/hashes/sha2.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'

export function signAddressWitness(privateKeyBytes: Uint8Array, signableBytes: Uint8Array): Uint8Array {
    const digest = sha256(sha256(signableBytes))
    /* noble 2.4's recovered format = [recid(0..3), r(32), s(32)] — the
     * recovery byte comes FIRST (live-hit 2026-11-14: reading the LAST byte
     * produced 'unexpected recovery header 4/59' nonsense). */
    const sig65 = secp256k1.sign(digest, privateKeyBytes, { prehash: false, format: 'recovered' })
    const recid = sig65[0]
    if (recid > 3) throw new Error(`witness signature: unexpected recovery id ${recid}`)
    const out = new Uint8Array(65)
    /* Dash wire convention (F29d, runtime-verified): v = 27 + 4 + recid
     * (the +4 = compressed pubkey) | r | s, low-S. */
    out[0] = 27 + 4 + recid
    out.set(sig65.slice(1, 33), 1)
    out.set(sig65.slice(33, 65), 33)
    return out
}
