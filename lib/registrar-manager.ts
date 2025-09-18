/* Import modules. */
import { getPrivateKeys, getPublicKeys } from './wallet-manager'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import {
    dpns_convert_to_homograph_safe,
    dpns_is_contested_username,
    dpns_register_name,
} from '@/lib/dash-wasm/wasm_sdk'

/**
 * Check Pending Status
 *
 * Will attempt to resume the registration process.
 */
export const checkPendingStatus = async (_masterKey: string) => {
    /* Initialize locals. */
    let username
    let proof
    let wif

    /* Set (request) headers. */
    const headers = {
        'Authorization': `Bearer ${_masterKey}`
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
        status.results.length > 0
    ) {
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
        const username = dpns_convert_to_homograph_safe(_username)

        /* Request username registration. */
        const usernameResult = await dpns_register_name(
            sdk,
            username,
            creationIdentity,       // Use the identity ID from authentication
            keyId,            // Use the determined key ID
            actualPrivateKey, // Use the actual private key (without :keyId suffix)
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
