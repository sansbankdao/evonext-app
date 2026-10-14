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
    CONTESTED_ASSET_LOCK_SATOSHIS,
    minimumDepositSatoshis,
    broadcastTransaction,
    createAssetLockTransaction,
    deriveFundingKey,
    findUnusedAssetLock,
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
    _username?: string,
) => {
    /* Derive the funding key from the user's own mnemonic. */
    const funding = deriveFundingKey(_network, _identityIdx)

    /* Contested usernames require a LARGER asset lock (masternode voting). */
    const lockedSatoshis = (_username && dpns_is_contested_username(_username))
        ? CONTESTED_ASSET_LOCK_SATOSHIS
        : ASSET_LOCK_SATOSHIS
    const requiredSatoshis = minimumDepositSatoshis(lockedSatoshis)

    /* Return funding info. */
    return {
        address: funding.address,
        path: funding.path,
        lockedSatoshis,
        requiredSatoshis,
        lockedDash: lockedSatoshis / 1e8,
        requiredDash: requiredSatoshis / 1e8,
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

    /* Contested usernames require a LARGER asset lock (masternode voting). */
    const isContested = dpns_is_contested_username(_username)
    const lockedSatoshis = isContested
        ? CONTESTED_ASSET_LOCK_SATOSHIS
        : ASSET_LOCK_SATOSHIS
    const minimumDeposit = minimumDepositSatoshis(lockedSatoshis)

    /* Resume support: the asset-lock txid is persisted right after
     * broadcast. If confirmation timed out (testnet stalls of 80+ minutes
     * are measured), a retry RESUMES the pending lock instead of
     * broadcasting a SECOND lock (which would burn funds twice). */
    const pendingKey = `evonext_pending_lock_${funding.address}`
    const pendingTxid = typeof window !== 'undefined'
        ? window.localStorage.getItem(pendingKey)
        : null

    let txid: string
    if (pendingTxid) {
        progress('Resuming your pending asset lock...')
        txid = pendingTxid
console.log('REGISTRAR (resuming pending lock)', txid)
    } else {
        /* Auto-resume an UNUSED lock: a previous attempt may have broadcast
         * the lock but died before identity creation. Its credit output is
         * UNSPENDABLE on L1, so the locked funds are provably still there —
         * resume it instead of building a SECOND lock (double burn). */
        const unusedLockTxid = await findUnusedAssetLock(
            _currentNetwork, funding.address)

        if (unusedLockTxid) {
            progress('Resuming your pending asset lock...')
            txid = unusedLockTxid
console.log('REGISTRAR (resuming unused lock)', txid)

            /* Persist for consistency (cleared after confirmation). */
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(pendingKey, txid)
            }
        } else {
            /* Collect funding UTXOs. */
            progress('Checking your deposit...')
            const utxos = await getFundingUtxos(_currentNetwork, funding.address)

            /* Validate funding. */
            const funded = utxos.reduce(
                (sum: number, utxo: any) => sum + utxo.satoshis, 0)
            if (utxos.length === 0 || funded < minimumDeposit) {
                throw new Error(
                    `Insufficient deposit at ${funding.address}: ${funded} sats available, ${minimumDeposit} required`)
            }

            /* Build + sign the asset-lock transaction (client-side). */
            progress('Building your asset lock transaction...')
            const assetLock = createAssetLockTransaction(
                _currentNetwork, funding.privateKeyWif, utxos, lockedSatoshis)

            /* Broadcast (minimal L1 support). */
            progress('Broadcasting to the Dash network...')
            txid = await broadcastTransaction(
                _currentNetwork, assetLock.hex)
console.log('REGISTRAR (asset lock broadcast)', txid)

            /* Persist for resume (cleared after confirmation). */
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(pendingKey, txid)
            }
        }
    }

    /* Wait for confirmation. */
    progress(`Waiting for confirmation (tx ${txid.slice(0, 16)}…)`)
    const { blockheight } = await waitForConfirmation(
        _currentNetwork, txid, undefined, undefined,
        (attempt, maxAttempts) => progress(
            `Waiting for confirmation… (${attempt}/${maxAttempts}) tx ${txid.slice(0, 16)}…`))
console.log('REGISTRAR (confirmed in block)', blockheight)

    /* Clear the pending lock (confirmed). */
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(pendingKey)
    }

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Untyped: the WASM class constructors take loose option objects. */
    const wasm: any = await import('./dash-wasm/wasm_sdk')

    /* Build the outpoint + derive the identity ID (it commits to the
     * lock's outpoint only — independent of the proof height).
     * NOTE: the outpoint references the OP_RETURN output at index 0 —
     * referencing the credit output (index 1) is REJECTED by the platform. */
    const outPoint = new wasm.OutPoint(txid, 0)
    const creationIdentity = String(
        wasm.AssetLockProof.createChainAssetLockProof(blockheight, outPoint)
            .createIdentityId())
console.log('REGISTRAR (identity from proof)', creationIdentity)

    /* Platform validates a chain proof against ITS OWN core-chain-locked
     * height, which LAGS the insight tip while testnet chainlocks stall
     * (using the insight tip caused 'Asset lock proof core chain height'
     * rejections). Read Platform's height from proof metadata; while it
     * is behind the lock's block, the lock is not chainlocked — wait. */
    progress('Checking the core chain lock...')
    let platformStatus = await getPlatformStatus(sdk, creationIdentity)

    /* A previous attempt may have ALREADY created the identity (e.g. it
     * failed later at the DPNS step) — never re-create it. */
    if (platformStatus.identityExists) {
        throw new Error(
            'Your identity already exists on-chain — close this and log in with your passkey/phrase; you can claim your username after logging in')
    }

    while (platformStatus.coreChainLockedHeight < blockheight) {
        progress('Waiting for the lock to be chainlocked...')
console.log('WAIT (chainlock)', platformStatus.coreChainLockedHeight, 'of', blockheight)
        await new Promise(resolve => setTimeout(resolve, 15000))
        platformStatus = await getPlatformStatus(sdk, creationIdentity)
    }

    /* Build the chain asset-lock proof at PLATFORM's chainlocked height. */
    const assetLockProof = wasm.AssetLockProof.createChainAssetLockProof(
        platformStatus.coreChainLockedHeight, outPoint)

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
        const pubBytes = hexToBytes(key.derived.public_key)
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
    try {
        await sdk.identityCreate({
            identity,
            assetLockProof,
            assetLockPrivateKey,
            signer,
        })
    } catch (error: any) {
console.error('REGISTRAR (identity create failed)', error)
        throw new Error(
            `identity create failed: ${error?.message || String(error)}`)
    }
console.log('REGISTRAR (identity created)', creationIdentity)

    /* Set (actual) key to AUTH (CRITICAL) key. */
    const actualPrivateKey = privateKeys.authCritical.private_key_wif

    /* Set master/primary public key. */
    const masterPublicKey = privateKeys.masterKey.public_key
console.log('REGISTRAR (master public key)', masterPublicKey)

    /* Request username registration. */
    progress('Registering your username...')
    let usernameResult: any
    try {
        usernameResult = await dpns_register_name(
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
    } catch (error: any) {
console.error('REGISTRAR (username registration failed)', error)
        throw new Error(
            `username registration failed: ${error?.message || String(error)} — NOTE: your identity WAS created on-chain; refresh and log in, then register the username from your profile`)
    }
console.log('REGISTRAR (username result)', usernameResult)

    /* Return (registration) result. */
    return {
        identityId: creationIdentity,
        txid,
        username: _username,
        isContested,
    }
}

/* --- helpers --- */

/**
 * Get Platform Status
 *
 * Reads Platform's own core-chain-locked height from a proof-info
 * query's response metadata (the queried identity need NOT exist —
 * metadata is always returned) + whether that identity already exists.
 * Platform validates chain asset-lock proofs against THIS height, not
 * the core tip.
 */
const getPlatformStatus = async (
    _sdk: any,
    _identityId: string,
): Promise<{ coreChainLockedHeight: number; identityExists: boolean }> => {
    const response: any = await _sdk.getIdentityWithProofInfo(_identityId)
    return {
        coreChainLockedHeight: response.metadata.coreChainLockedHeight,
        identityExists: typeof response.data !== 'undefined' && response.data !== null,
    }
}

const hexToBytes = (hex: string): Uint8Array => {
    return new Uint8Array(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
}
