/* Import modules. */
// @ts-ignore
import numeral from 'numeral'

import { DashPlatformSDK } from 'dash-platform-sdk'
import { GasFeesPaidByWASM, PrivateKeyWASM } from 'pshenmic-dpp'
import { wasmSdkService } from '@/lib/services'

import { getMnemonic } from './secure-storage'
import { derive_key_from_seed_with_path } from './dash-wasm/wasm_sdk'

/* Set constants. */
const DASH_USD_VALUE = 24 // FIXME PULL FROM MARKET API

/* Get Private Keys. */
export const getPrivateKeys = (_currentNetwork: string, _identityIdx: number) => {
    /* Request mnemonic. */
    const mnemonic = getMnemonic()

    /* Master Authentication */
    const masterKeyPath = `m/9'/${_currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${_identityIdx}'/0'`
    const masterKey = derive_key_from_seed_with_path(
        mnemonic!, undefined, masterKeyPath, _currentNetwork)
    // console.log('Master key object:', masterKey)
    // console.log('Master key (public_key):', masterKey.public_key)

    /* Critical Authentication */
    const authCriticalPath = `m/9'/${_currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${_identityIdx}'/1'`
    const authCritical = derive_key_from_seed_with_path(
        mnemonic!, undefined, authCriticalPath, _currentNetwork)

    /* High Authentication */
    const authHighPath = `m/9'/${_currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${_identityIdx}'/2'`
    const authHigh = derive_key_from_seed_with_path(
        mnemonic!, undefined, authHighPath, _currentNetwork)

    /* Transfer Key */
    const transferKeyPath = `m/9'/${_currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${_identityIdx}'/3'`
    const transferKey = derive_key_from_seed_with_path(
        mnemonic!, undefined, transferKeyPath, _currentNetwork)

    /* Authentication Key */
    const encryptionKeyPath = `m/9'/${_currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${_identityIdx}'/4'`
    const encryptionKey = derive_key_from_seed_with_path(
        mnemonic!, undefined, encryptionKeyPath, _currentNetwork)

    /* Return ALL keys. */
    return {
        masterKey,
        authCritical,
        authHigh,
        transferKey,
        encryptionKey,
    }
}

/* Get Public Keys. */
export const getPublicKeys = (_currentNetwork: string, _identityIdx: number) => {
    /* Request private keys. */
    const keys = getPrivateKeys(_currentNetwork, _identityIdx)

    /* EvoNext (default) key setup. */
    const publicKeys = [
        {
            id: 0,
            keyType: 'ECDSA_HASH160',
            purpose: 'AUTHENTICATION',
            securityLevel: 'MASTER',
            privateKeyHex: keys.masterKey.private_key_hex,
            privateKeyWif: keys.masterKey.private_key_wif,
            readOnly: false
        },
        {
            id: 1,
            keyType: 'ECDSA_HASH160',
            purpose: 'AUTHENTICATION',
            securityLevel: 'CRITICAL',
            privateKeyHex: keys.authCritical.private_key_hex,
            privateKeyWif: keys.authCritical.private_key_wif,
            readOnly: false
        },
        {
            id: 2,
            keyType: 'ECDSA_HASH160',
            purpose: 'AUTHENTICATION',
            securityLevel: 'HIGH',
            privateKeyHex: keys.authHigh.private_key_hex,
            privateKeyWif: keys.authHigh.private_key_wif,
            readOnly: false
        },
        {
            id: 3,
            keyType: 'ECDSA_HASH160',
            purpose: 'TRANSFER',
            securityLevel: 'CRITICAL',
            privateKeyHex: keys.transferKey.private_key_hex,
            privateKeyWif: keys.transferKey.private_key_wif,
            readOnly: false
        },
        {
            id: 4,
            keyType: 'ECDSA_SECP256K1',
            purpose: 'ENCRYPTION',
            securityLevel: 'MEDIUM',
            privateKeyHex: keys.encryptionKey.private_key_hex,
            privateKeyWif: keys.encryptionKey.private_key_wif,
            readOnly: false
        },
    ]

    /* Return ALL public keys. */
    return publicKeys
}

export const getTransferKey = (_currentNetwork: string, _identityIdx: number) => {
    /* Request private keys. */
    const keys = getPrivateKeys(_currentNetwork, _identityIdx)

// FIXME WE WANT TO SUPPORT ALTERNATIVE KEY CONFIGURATIONS

/*

// WHAT IS THE CONFIG FOR TRANSFER KEYS??

const signingPublicKey = regPubKeys.find((_pubkey: any) => {
    return _pubkey.purpose === 0 && (_pubkey.securityLevel === 1 || _pubkey.securityLevel === 2)
})
console.log('SIGNING (public) KEY', signingPublicKey)

const signingPrivateKey = publicKeys.find(_pubkey => {
    return _pubkey.id === signingPublicKey.id
})
console.log('SIGNING (private) KEY', signingPrivateKey)

const seedPrivateKey = signingPrivateKey!.privateKeyWif

*/

    /* Return transfer (private) key. */
    return keys.transferKey
}

export const sendCredit = async (_receiver: string, _duffs: number) => {
    /* Initialize locals. */
    let error
    let response

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    const receiver = _receiver

    const duffs = _duffs

    const usdValue = _duffs / (10 ** 11) *

    if (confirm(`Are you sure you want to send ${numeral(amount.value).format('0,0.00')} ${Identity.asset?.ticker} to ${receiver.value}?`)) {
        console.log(`Starting transfer of ${amount.value} ${Identity.asset?.ticker} to ${receiver.value}...`)

        response = await Identity
            .transfer(receiver.value, BigInt(satoshis.value))
            .catch(err => {
                console.error(err)
                error = err
            })
        console.log('RESPONSE', response)

        /* Validate error. */
        if (error) {
            console.error('DISPLAY ERROR MESSAGE', error.message)
            /* Set error. */
            errorMsgs.value = error?.message || JSON.stringify(error)
            return
        }

        /* Validate transaction idem. */
        if (response?.txidem) {
            /* Reset user inputs. */
            amount.value = null
            receiver.value = null

            /* Set transaction idem. */
            txidem.value = response.txidem
        } else if (response?.error) {
            /* Set error. */
            // errorMsgs.value = response?.error?.message || JSON.stringify(response?.error)
        }
    }
}

export const sendToken = async () => {

}

export const createDocument = async () => {
    const dataContract = ''

    const documentType = ''

    const data = ''

    const identity = ''

    const document = sdk.documents
        .create(dataContract, documentType, data, identity)

    const identityContractNonce = BigInt(1)

    const tokenPaymentInfo = {
        tokenContractId: '...',
        tokenContractPosition: 0,
        maximumTokenCost: BigInt(10),
        gasFeesPaidBy: GasFeesPaidByWASM.ContractOwner,
    }

    const stateTransition = sdk.documents.createStateTransition(
        document, 'create', { identityContractNonce, tokenPaymentInfo }
    )
}
