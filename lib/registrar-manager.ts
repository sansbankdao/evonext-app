/* Import modules. */
import { getPrivateKeys, getPublicKeys } from './wallet-manager'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import {
    dpns_convert_to_homograph_safe,
    dpns_is_contested_username,
    dpns_register_name,
    get_identity_by_public_key_hash,
    get_identity_by_non_unique_public_key_hash,
} from '@/lib/dash-wasm/wasm_sdk'
 // @ts-ignore
import { hash160 } from '@nexajs/crypto'
 // @ts-ignore
import { binToHex, hexToBin } from '@nexajs/utils'

/**
 * Get Registered Keys
 *
 * Will search ALL keys and signature schemes for an Identity's
 * registered public keys.
 */
export const getRegisteredKeys = async (_network: string) => {
    /* Initialize locals. */
    let identityId
    let regPubKeys

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_network)

    const publicKey = privateKeys.masterKey.public_key
console.log('REGISTRATION SEARCH (publicKey)', publicKey)

    const publicKeyHash = binToHex(hash160(hexToBin(publicKey)))
console.log('REGISTRATION SEARCH (publicKeyHash)', publicKeyHash)

    /* Request (HASH160) Identity. */
    const identityOfHash160 = await get_identity_by_non_unique_public_key_hash(
        sdk,
        publicKeyHash,
        undefined
    ).catch(err => console.error(err))
console.log('REGISTRATION SEARCH (from HASH160)', identityOfHash160)

    /* Request (SECP256k1) Identity. */
    const identityOfSecp256k1 = await get_identity_by_public_key_hash(
        sdk,
        publicKeyHash
    ).catch(err => console.error(err))
console.log('REGISTRATION SEARCH (from SECP256K1)', identityOfSecp256k1?.toJSON())

    /* Handle ECDSA_HASH160 signature scheme. */
    if (identityOfHash160 && identityOfHash160.length > 0 && typeof identityOfHash160 === 'object') {
        /* Set Identity ID. */
        identityId = identityOfHash160[0].id

        /* Set registered public keys. */
        regPubKeys = identityOfHash160[0].publicKeys
    }

    /* Handle ECDSA_SECP256k1 signature scheme. */
    if (identityOfSecp256k1 && identityOfSecp256k1.toJSON()) {
        /* Set Identity ID. */
        identityId = identityOfSecp256k1.toJSON().id

        /* Set registered public keys. */
        regPubKeys = identityOfSecp256k1.toJSON().publicKeys
    }

console.log('REGISTRATION SEARCH (identityId)', identityId)
console.log('REGISTRATION SEARCH (regPubKeys)', regPubKeys)

    /* Validate Identity. */
    if (typeof identityId === 'undefined' || identityId === null) {
        return null
    }

    /* Validate registered keys. */
    if (typeof regPubKeys === 'undefined' || regPubKeys === null) {
        return null
    }

    /* Return (registered) Identity + public keys. */
    return {
        identityId,
        regPubKeys,
    }
}

export const getPaymentAddress = async (
    _network: string,
    _username: string,
    _email: string,
) => {
    /* Initialize locals. */
    let json
    let response

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_network)

    /* Prepare order package. */
    const body = JSON.stringify({
        masterKey: privateKeys.masterKey.public_key,
        authCriticalKey: privateKeys.authCritical.public_key,
        authHighKey: privateKeys.authHigh.public_key,
        transferKey: privateKeys.transferKey.public_key,
        encryptionKey: privateKeys.encryptionKey.public_key,
        username: _username,
        emailAddr: _email,
        isMainnet: _network === 'mainnet' ? true : false,
        isPremium: dpns_is_contested_username(_username) ? true : false,
    })
console.log('ORDER (body)', body)

    /* Request a payment address. */
    response = await fetch('https://evonext.app/v1/registrar/address', {
        method: 'POST',
        body,
    }).catch(err => console.error(err))

    /* Validate response. */
    if (typeof response === 'undefined' || response === null) {
        return null
    }

    /* Decode JSON. */
    json = await response!.json()
// console.log('PAYMENT ADDRESS (json)', json)

    /* Validate registrar. */
    if (typeof json.registrar === 'undefined' || json.registrar === null) {
        return null
    }

    /* Set payment address. */
    const paymentAddress = json.registrar.dashAddr
// console.log('PAYMENT ADDRESS (paymentAddress)', paymentAddress)

    /* Submit a new order. */
    response = await fetch('https://evonext.app/v1/registrar/order', {
        method: 'POST',
        body,
    }).catch(err => console.error(err))

    /* Validate order submission. */
    if (typeof response !== 'undefined' && response !== null) {
        /* Handle order response. */
        // NOTE: This is NOT strictly required, but consider offering
        //       user feedback, if an error is recognized.
        json = await response.json()
            .catch(err => console.error(err))
// console.log('ORDER CONFIRM (json)', json)
    }

    /* Return payment address. */
    return paymentAddress
}

/**
 * Check Pending Status
 *
 * Will attempt to resume the registration process.
 */
export const checkPendingStatus = async (_network: string) => {
    /* Initialize locals. */
    let username
    let proof
    let orderStatus
    let wif

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_network)

    /* Set master/primary public key. */
    const masterPublicKey = privateKeys.masterKey.public_key
console.log('MASTER/PRIMARY PUBLIC KEY', masterPublicKey)

    /* Set (request) headers. */
    const headers = {
        'Authorization': `Bearer ${masterPublicKey}`
    }

    /* Make status request. */
    const statusResponse = await fetch('https://evonext.app/v1/registrar/status', {
        method: 'GET',
        headers,
    }).catch(err => console.error(err))

    /* Handle status response. */
    const status = await statusResponse!.json()
console.log('ORDER STATUS CHECK', status)

    /* Validate (pending) status. */
    if (
        typeof status !== 'undefined' &&
        status !== null &&
        status.results &&
        status.results.length > 0 &&
        status.results[0].proof !== null &&
        status.results[0].wif !== null
    ) {
        /* Set status. */
        orderStatus = status.results[0].status
console.log('ORDER STATUS', orderStatus)

        /* Validate order status (is NOT complete). */
        if (orderStatus === 3) {
            return null
        }

        /* Set username. */
        username = status.results[0].username
console.log('USERNAME', username)

        /* Set proof. */
        proof = status.results[0].proof
console.log('PROOF', typeof proof, proof)

        /* Set WIF. */
        wif = status.results[0].wif
console.log('WIF', typeof wif, wif)

        /* Return registration credentials. */
        return {
            username,
            proof,
            wif,
        }
    } else {
        return null
    }
}

/* Register Identity + Username */
export const registerIdentityAndUsername = async (
    _currentNetwork: string,
    _username: string,
    _proof: string,
    _wif: string,
) => {
    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Request public keys. */
    const publicKeys = getPublicKeys(_currentNetwork)

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_currentNetwork)

    // setIsModalOpen(true)
    const result = await sdk.identityCreate(
        _proof,
        _wif,
        JSON.stringify(publicKeys)
    ).catch(err => console.error(err))
console.log('WASM REGISTRATION RESULT', result)

    /* Validate result. */
    if (typeof result !== 'undefined' && result !== null) {
        /* Set creation status. */
        const creationStatus = result.status

        /* Set creation identity. */
        const creationIdentity = result.identityId

        /* Set key ID. */
// FIXME REMOVE MAGIC NUMBER
        const keyId = 1 // AUTHENTICATION (CRITICAL)

        /* Set (actual) key to AUTH (CRITICAL) key. */
        const actualPrivateKey = privateKeys.authCritical.private_key_wif

        /* Set (safe) username. */
        // NOTE DO NOT USE homograph username here
        // TODO Apply any relevant safety checks
        const username = _username

        /* Request username registration. */
        const usernameResult = await dpns_register_name(
            sdk,
            _username,
            creationIdentity,   // Use the identity ID from authentication
            keyId,              // Use the determined key ID
            actualPrivateKey,   // Use the actual private key (without :keyId suffix)
            // Callback for preorder success
            (preorderInfo: any) => {
console.log('PRE-ORDER SUCCESSFUL', preorderInfo)

                // Show preorder info in a temporary notification
                const preorderMsg = `Preorder Document ID: ${preorderInfo.get('documentId')}`;
console.log('PRE-ORDER MESSAGE', preorderMsg)
            }
        )
console.log('USERNAME (REG) RESULT', usernameResult)

        /* Set master/primary public key. */
        const masterPublicKey = privateKeys.masterKey.public_key
console.log('MASTER/PRIMARY PUBLIC KEY', masterPublicKey)

        /* Set (request) headers. */
        const headers = {
            'Authorization': `Bearer ${masterPublicKey}`
        }

        /* Set action. */
        const action = 'completeReg'

        /* Set primary ID. */
        const platformid = creationIdentity

        /* Set master key. */
        const masterKey = masterPublicKey

        /* Set mainnet flag. */
        const isMainnet = _currentNetwork === 'mainnet' ? true : false

        /* Set premium flag. */
        const isPremium = dpns_is_contested_username(username) ? true : false

        /* Prepare submission body. */
        const body = JSON.stringify({
            action,
            platformid,
            masterKey,
            isMainnet,
            isPremium,
        })

        /* Make completion request. */
        const completionResponse = await fetch('https://evonext.app/v1/registrar/proof', {
            method: 'POST',
            headers,
            body,
        }).catch(err => console.error(err))
        const completion = await completionResponse!.json()
console.log('REGISTRATION COMPLETION', completion)

        /* Return (completion) result. */
        return completion
    }
}
