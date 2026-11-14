/*
 * lib/moves-service.ts — the internal-move service: transfers between the
 * wallet's three balance lanes (Identity / Transparent DIP-17 / Shielded pool)
 * using the consensus-exact reference wires (reference-wire.ts) over the
 * direct grpc transport (direct-grpc.ts).
 *
 * Live-verified on testnet 2026-11-15:
 *   - Transparent → Identity (type 11): input 2,000,000, fee 2,937,460,
 *     the address's nonce 0→1.
 *   - Transparent → Shielded (type 15): input 384,000,000 = the shield 300M
 *     + the pool's minimum fee 84M; the 300M note trial-decrypted with the
 *     memo intact; the address's nonce 1→2.
 *
 * Validation rules learned from the live rejections:
 *   - the input's nonce = EXACTLY the address's current state nonce + 1;
 *   - the type-11 input must be >= the top-up + the fee (pass the margin or
 *     use `output` for the change — the full-balance/no-headroom input was
 *     rejected by the validator);
 *   - the type-15 input must be >= the shield amount + the pool's minimum fee
 *     (84,000,000 credits for 2 actions at protocol v14).
 */

import { getWasmSdk } from './services/wasm-sdk-service'
import { derivePlatformReceiveKey } from './platform-address'
import { broadcastWireDirect } from './direct-grpc'
import {
    identityTopUpFromAddressesSignable,
    signAddressWitnessSig,
    ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES,
    ST_TAG_SHIELD,
    type OrchardActionHalves,
    type ReferenceWire,
} from './shielded/reference-wire'
import { signBinding, postPcztFrame, buildOutputOnlyPczt } from './shielded/prove'
import { serializePcztFrame } from './shielded/pczt-wire'
import { textMemo } from './shielded/wallet'
import { shieldExtraSighashData } from './shielded/bundle'
import { mnemonicToSeedSync } from '@scure/bip39'
import { deriveShieldedWalletKeys } from './shielded/wallet'
import { diversifierAtIndex, deriveAddressBytes } from './shielded/keys'

const sha256d = async (data: Uint8Array): Promise<Uint8Array> => {
    const { sha256 } = await import('@noble/hashes/sha2.js')
    return sha256(sha256(data))
}

/** The 21-byte P2pkh form (tag 0 || hash160) from a bech32m DIP-17 address. */
export async function platformAddressBytes(bech32m: string): Promise<Uint8Array> {
    const { bech32m: b32 } = await import('@scure/base')
    const payload = b32.fromWords(b32.decode(bech32m as any).words)
    if (payload.length !== 21 || payload[0] !== 0xb0) throw new Error('Unexpected transparent address payload')
    const bytes = new Uint8Array(21)
    bytes[0] = 0
    bytes.set(payload.slice(1), 1)
    return bytes
}

export interface AddressState {
    bech32m: string
    addressBytes21: Uint8Array
    wif: string
    balance: bigint
    nonce: number
}

/** Read the DIP-17 receive address at `addressIndex` plus its chain state. */
export async function readTransparentAddress(
    network: 'mainnet' | 'testnet',
    addressIndex = 0,
): Promise<AddressState> {
    const sdk = await getWasmSdk()
    const { address, wif } = derivePlatformReceiveKey(network, addressIndex)
    const addressBytes21 = await platformAddressBytes(address)
    const info = await sdk.getAddressesInfos([address])
    const keyHex = Buffer.from(addressBytes21).toString('hex')
    const entry = info?.get ? info.get(keyHex) : undefined
    if (entry === undefined) {
        return { bech32m: address, addressBytes21, wif, balance: 0n, nonce: 0 }
    }
    return {
        bech32m: address,
        addressBytes21,
        wif,
        balance: entry.balance === undefined ? 0n : BigInt(entry.balance),
        nonce: entry.nonce === undefined ? 0 : Number(entry.nonce),
    }
}

const broadcast = async (ref: ReferenceWire, wif: string, network: 'mainnet' | 'testnet'): Promise<string> => {
    const wasm = await import('./dash-wasm/wasm_sdk')
    const priv = wasm.PrivateKey.fromWIF(wif).toBytes()
    const witnessSig = await signAddressWitnessSig(priv, ref.signable)
    const wire = ref.finalize([witnessSig])
    await broadcastWireDirect(wire, { network })
    const digest = await sha256d(ref.signable)
    return Buffer.from(digest).toString('hex')
}

/** Transparent → Identity top-up (type 11). The input = the amount + the
 * fee margin (the validator rejects a zero-headroom full-balance input). */
export async function moveTransparentToIdentity(options: {
    network: 'mainnet' | 'testnet'
    identityId: string
    addressIndex?: number
    amountCredits: bigint
    feeMarginCredits?: bigint
    onProgress?: (phase: string) => void
}): Promise<{ transitionHash: string; inputCredits: bigint; addressBalanceAfter: bigint }> {
    const { network, identityId, amountCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (amountCredits <= 0n) throw new Error('Amount must be positive')
    const addressIndex = options.addressIndex ?? 0
    progress('Reading the address state…')
    const addr = await readTransparentAddress(network, addressIndex)
    if (addr.balance < amountCredits) {
        throw new Error(`Transparent balance ${addr.balance} < move amount ${amountCredits}`)
    }
    const feeMargin = options.feeMarginCredits ?? 4_000_000n
    const inputCredits = amountCredits + feeMargin

    const wasm = await import('./dash-wasm/wasm_sdk')
    const idBytes = new Uint8Array(new wasm.Identifier(identityId).toBytes())

    progress('Building the top-up transition…')
    const ref = identityTopUpFromAddressesSignable({
        addressBytes21: addr.addressBytes21,
        addressNonce: addr.nonce,
        inputCredits,
        identityIdBytes32: idBytes,
    })

    progress('Broadcasting…')
    const transitionHash = await broadcast(ref, addr.wif, network)

    progress('Verifying…')
    const after = await readTransparentAddress(network, addressIndex)
    return { transitionHash, inputCredits, addressBalanceAfter: after.balance }
}

/** Transparent → Shielded pool (type 15). Runs the full prover flow
 * (the PCZT build → the zk proof) and assembles the consensus-exact wire. */
export async function moveTransparentToShielded(options: {
    network: 'mainnet' | 'testnet'
    mnemonic: string
    addressIndex?: number
    recipientIndex?: number
    amountCredits: bigint
    memoText?: string
    poolMinimumFee?: bigint /* 84,000,000 for 2 actions at protocol v14 */
    onProgress?: (phase: string) => void
}): Promise<{ transitionHash: string; inputCredits: bigint; addressBalanceAfter: bigint }> {
    const { network, mnemonic, amountCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (amountCredits <= 0n) throw new Error('Amount must be positive')
    const addressIndex = options.addressIndex ?? 0
    const poolMinimumFee = options.poolMinimumFee ?? 84_000_000n

    progress('Reading the address state…')
    const addr = await readTransparentAddress(network, addressIndex)
    if (addr.balance < amountCredits + poolMinimumFee) {
        throw new Error(
            `Transparent balance ${addr.balance} < move amount ${amountCredits} + the pool fee ${poolMinimumFee}`,
        )
    }

    /* The 0x84 digest binds the input addresses in map-key order. */
    const extraSighashData = shieldExtraSighashData([
        { type: 0 as const, hash160: addr.addressBytes21.slice(1) },
    ])

    progress('Deriving the shielded recipient…')
    const seed = mnemonicToSeedSync(mnemonic)
    const keys = deriveShieldedWalletKeys(seed, network)
    const recipientIndex = options.recipientIndex ?? 0
    const recipientBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, recipientIndex))

    progress('Building the shield transaction…')
    const build = buildOutputOnlyPczt({
        outputs: [{
            recipient: recipientBytes,
            value: amountCredits,
            memo: textMemo(options.memoText ?? ''),
            senderOvk: keys.ovk,
        }],
        extraSighashData,
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Signing…')
    const binding = signBinding(build.bsk, build.sighash, new Uint8Array(80)).sig
    const actions: OrchardActionHalves[] = proved.frame.actions.map((a: any) => ({
        nullifier: new Uint8Array(a.spend.nullifier),
        rk: new Uint8Array(a.spend.rk),
        cmx: new Uint8Array(a.output.cmx),
        encryptedNote: (() => {
            const e = new Uint8Array(216)
            e.set(a.output.ephemeralKey, 0)
            e.set(a.output.encCiphertext, 32)
            e.set(a.output.outCiphertext, 136)
            return e
        })(),
        cvNet: new Uint8Array(a.cvNet),
        spendAuthSig: new Uint8Array(a.spend.spendAuthSig),
    }))

    const wasm = await import('./dash-wasm/wasm_sdk')
    const priv = wasm.PrivateKey.fromWIF(addr.wif).toBytes()
    const witnessSig = await signAddressWitnessSig(
        priv,
        /* The signable = [0f][00][map][actions][amount][anchor][proof][binding][fee][ufi]. */
        (await import('./shielded/reference-wire')).shieldSignable({
            addressBytes21: addr.addressBytes21,
            addressNonce: addr.nonce,
            inputCredits: amountCredits + poolMinimumFee,
            actions,
            amount: amountCredits,
            anchor: build.anchor,
            proof: new Uint8Array(proved.frame.zkproof ?? new Uint8Array(0)),
            bindingSignature: binding,
        }).signable,
    )

    progress('Assembling the wire…')
    const ref = (await import('./shielded/reference-wire')).shieldSignable({
        addressBytes21: addr.addressBytes21,
        addressNonce: addr.nonce,
        inputCredits: amountCredits + poolMinimumFee,
        actions,
        amount: amountCredits,
        anchor: build.anchor,
        proof: new Uint8Array(proved.frame.zkproof ?? new Uint8Array(0)),
        bindingSignature: binding,
    })
    const wire = ref.finalize([witnessSig])

    progress('Broadcasting…')
    await broadcastWireDirect(wire, { network })
    const digest = await sha256d(ref.signable)
    const transitionHash = Buffer.from(digest).toString('hex')

    progress('Verifying…')
    const after = await readTransparentAddress(network, addressIndex)
    return { transitionHash, inputCredits: amountCredits + poolMinimumFee, addressBalanceAfter: after.balance }
}

export const MOVES_ST_TAGS = {
    identityTopUp: ST_TAG_IDENTITY_TOP_UP_FROM_ADDRESSES,
    shield: ST_TAG_SHIELD,
}
