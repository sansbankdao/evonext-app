/* Import modules. */
// SELF-CUSTODIAL REGISTRATION.
//
// This module no longer talks to the evonext.app/v1/registrar endpoints.
// The OLD process (pre-generated asset locks sold to users through the
// registrar server) has been REPLACED: users now fund and manage their OWN
// asset locks. The app accepts coins on the L1 strictly for asset lock and
// identity creation (see lib/core-chain.ts for the minimal L1 module).
//
// Verified end-to-end on testnet (AGENTS.md F24).
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import {
    dpns_is_contested_username,
    dpns_register_name,
} from '@/lib/dash-wasm/compat'
import { getPrivateKeys } from './wallet-manager'
 // @ts-ignore
import { hash160 } from '@nexajs/crypto'
 // @ts-ignore
import { binToHex, hexToBin } from '@nexajs/utils'
import {
    ASSET_LOCK_SATOSHIS,
    MINIMUM_DEPOSIT_SATOSHIS,
    broadcastTransaction,
    createAssetLockTransaction,
    deriveFundingKey,
    getFundingUtxos,
    waitForConfirmation,
} from './core-chain'

/**
 * Get Funding Info
 *
 * Returns the funding details the UI needs to accept the user's deposit:
 * the derived address, the required deposit, and the locked amount.
 */
export const getFundingInfo = async (
    _network: string,
    _identityIdx: number,
) => {
    /* Derive the funding key from the user's own mnemonic. */
    const funding = deriveFundingKey(_network, _identityIdx)

    /* Return funding info. */
    return {
        address: funding.address,
        path: funding.path,
        lockedSatoshis: ASSET_LOCK_SATOSHIS,
        requiredSatoshis: MINIMUM_DEPOSIT_SATOSHIS,
        lockedDash: ASSET_LOCK_SATOSHIS / 1e8,
        requiredDash: MINIMUM_DEPOSIT_SATOSHIS / 1e8,
    }
}

/**
 * Register Identity + Username
 *
 * Runs the FULL self-custodial flow against the user's own funded L1
 * address:
 *   1. collect the funding UTXOs,
 *   2. build + sign the asset-lock transaction locally,
 *   3. broadcast it (minimal L1 usage),
 *   4. wait for confirmation,
 *   5. build the ChainAssetLockProof (outpoint MUST reference the OP_RETURN
 *      output at index 0 — verified on testnet),
 *   6. create the identity via the WASM SDK,
 *   7. register the DPNS username.
 *
 * Returns { identityId, txid, username } on success.
 */
export const registerIdentityAndUsername = async (
    _currentNetwork: string,
    _identityIdx: number,
    _username: string,
    _onProgress?: (message: string) => void,
) => {
    /* Report progress (optional callback). */
    const progress = _onProgress ?? ((_message: string) => {})

    /* Derive the funding key (same path the UI displayed). */
    const funding = deriveFundingKey(_currentNetwork, _identityIdx)

    /* Collect funding UTXOs. */
    progress('Checking your deposit...')
    const utxos = await getFundingUtxos(_currentNetwork, funding.address)

    /* Validate funding. */
    const funded = utxos.reduce(
        (sum: number, utxo: any) => sum + utxo.satoshis, 0)
    if (utxos.length === 0 || funded < MINIMUM_DEPOSIT_SATOSHIS) {
        throw new Error(
            `Insufficient deposit at ${funding.address}: ${funded} sats available, ${MINIMUM_DEPOSIT_SATOSHIS} required`)
    }

    /* Build + sign the asset-lock transaction (client-side). */
    progress('Building your asset lock transaction...')
    const assetLock = createAssetLockTransaction(
        _currentNetwork, funding.privateKeyWif, utxos)

    /* Broadcast (minimal L1 support). */
    progress('Broadcasting to the Dash network...')
    const txid = await broadcastTransaction(
        _currentNetwork, assetLock.hex)
console.log('REGISTRAR (asset lock broadcast)', txid)

    /* Wait for confirmation. */
    progress('Waiting for confirmation...')
    const { bestHeight } = await waitForConfirmation(
        _currentNetwork, txid)
console.log('REGISTRAR (confirmed at best height)', bestHeight)

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Build the chain asset-lock proof.
     * NOTE: the outpoint references the OP_RETURN output at index 0 —
     * referencing the credit output (index 1) is REJECTED by the platform. */
    /* Untyped: the WASM class constructors take loose option objects. */
    const wasm: any = await import('./dash-wasm/wasm_sdk')
    const outPoint = new wasm.OutPoint(txid, 0)
    const assetLockProof = wasm.AssetLockProof.createChainAssetLockProof(
        bestHeight, outPoint)

    /* Derive the identity ID from the proof. */
    const creationIdentity = String(assetLockProof.createIdentityId())
console.log('REGISTRAR (identity from proof)', creationIdentity)

    /* Request private keys (each derive includes its public key hex). */
    const privateKeys = getPrivateKeys(_currentNetwork, _identityIdx)

    /* Build the Identity with its public keys.
     * Data field: ECDSA_HASH160 keys carry the 20-byte hash160 of the
     * compressed pubkey; ECDSA_SECP256K1 keys carry the 33-byte pubkey. */
    const identity = new wasm.Identity(creationIdentity)
    const keyDefs = [
        { id: 0, keyType: 'ECDSA_HASH160', purpose: 'AUTHENTICATION', securityLevel: 'MASTER', derived: privateKeys.masterKey },
        { id: 1, keyType: 'ECDSA_HASH160', purpose: 'AUTHENTICATION', securityLevel: 'CRITICAL', derived: privateKeys.authCritical },
        { id: 2, keyType: 'ECDSA_HASH160', purpose: 'AUTHENTICATION', securityLevel: 'HIGH', derived: privateKeys.authHigh },
        { id: 3, keyType: 'ECDSA_HASH160', purpose: 'TRANSFER', securityLevel: 'CRITICAL', derived: privateKeys.transferKey },
        { id: 4, keyType: 'ECDSA_SECP256K1', purpose: 'ENCRYPTION', securityLevel: 'MEDIUM', derived: privateKeys.encryptionKey },
    ]
    for (const key of keyDefs) {
        // hash160 of the compressed pubkey (bytes), per the platform spec.
        const pubBytes = hexToBytes(key.derived.publicKey)
        const data = key.keyType === 'ECDSA_HASH160'
            ? hash160(pubBytes)
            : pubBytes
        identity.addPublicKey(new wasm.IdentityPublicKey({
            keyId: key.id,
            purpose: key.purpose,
            securityLevel: key.securityLevel,
            keyType: key.keyType,
            data,
        }))
    }
console.log('REGISTRAR (identity keys added)', identity.publicKeys.length)

    /* Build the signer with ALL identity private keys. */
    const signer = new wasm.IdentitySigner()
    signer.addKeyFromWif(privateKeys.masterKey.private_key_wif)
    signer.addKeyFromWif(privateKeys.authCritical.private_key_wif)
    signer.addKeyFromWif(privateKeys.authHigh.private_key_wif)
    signer.addKeyFromWif(privateKeys.transferKey.private_key_wif)
    signer.addKeyFromWif(privateKeys.encryptionKey.private_key_wif)

    /* The asset-lock private key = the funding key that controls the
     * credit output. */
    const assetLockPrivateKey = wasm.PrivateKey.fromWIF(funding.privateKeyWif)

    /* Create the identity (broadcasts + waits for confirmation). */
    progress('Creating your identity...')
    await sdk.identityCreate({
        identity,
        assetLockProof,
        assetLockPrivateKey,
        signer,
    })
console.log('REGISTRAR (identity created)', creationIdentity)

    /* Set (actual) key to AUTH (CRITICAL) key. */
    const actualPrivateKey = privateKeys.authCritical.private_key_wif

    /* Set master/primary public key. */
    const masterPublicKey = privateKeys.masterKey.public_key
console.log('REGISTRAR (master public key)', masterPublicKey)

    /* Request username registration. */
    progress('Registering your username...')
    const usernameResult = await dpns_register_name(
        sdk,
        _username,
        creationIdentity,   // Use the identity ID from authentication
        1,                  // Key ID 1 => AUTH (CRITICAL)
        actualPrivateKey,   // Use the actual private key
        // Callback for preorder success
        (preorderInfo: any) => {
// console.log('PRE-ORDER SUCCESSFUL', preorderInfo)

            // Show preorder info in a temporary notification
            const preorderMsg = `Preorder Document ID: ${preorderInfo.get('documentId')}`;
// console.log('PRE-ORDER MESSAGE', preorderMsg)
        }
    )
console.log('REGISTRAR (username result)', usernameResult)

    /* Return (registration) result. */
    return {
        identityId: creationIdentity,
        txid,
        username: _username,
        isContested: dpns_is_contested_username(_username),
    }
}

/* --- helpers --- */

const hexToBytes = (hex: string): Uint8Array => {
    return new Uint8Array(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
}
