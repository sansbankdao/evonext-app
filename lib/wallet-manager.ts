/* Import modules. */
import { DashPlatformSDK } from 'dash-platform-sdk'
import { GasFeesPaidByWASM, PrivateKeyWASM } from 'pshenmic-dpp'

import { wasmSdkService } from './services'
import {
    IdentitySigner,
    WasmSdkBuilder,
    WasmTrustedContext,
    derive_key_from_seed_with_path,
    get_identities_token_balances_with_proof_info,
} from './dash-wasm/compat'
import { getIdentities } from './identity-manager'
import { getIdentityIdx, getMnemonic } from './secure-storage'
import {
    IKeyTypes,
    ITxError,
    ITxSuccess,
    ITokenPaymentInfo,
} from './types'

/* Get Private Keys. */
export const getPrivateKeys = (
    _currentNetwork: string,
    _identityIdx: number,
) => {
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
export const getPublicKeys = (
    _currentNetwork: string,
    _identityIdx: number,
) => {
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

export const getAuthKey = async (
    _currentNetwork: string,
    _identityIdx: number,
) => {
    /* Set network. */
    const network = (_currentNetwork === 'mainnet') ? 'mainnet' : 'testnet'

    /* Request private keys. */
    const generatedkeys = getPrivateKeys(network, _identityIdx)
console.log('GENERATED KEYS', generatedkeys)

// FIXME -- ONLY SEARCH IF (STANDARD) KEYS DO NOT WORK
    const response = await getIdentities(network)
    const registeredKeys = response![0].publicKeys
console.log('REGISTERED KEYS', registeredKeys)
// FIXME WE WANT TO SUPPORT ALTERNATIVE KEY CONFIGURATIONS

/*

PURPOSES
0 => AUTHENTICATION
1 => ENCRYPTION
2 => DECRYPTION
3 => TRANSFER

TYPES
0 =>
1 =>
2 => ???

SECURITY LEVELS
0 => MASTER
1 => CRITICAL
2 => HIGH
3 => MEDIUM



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

    /* Return transfer (private) key (WIF). */
    return generatedkeys.authCritical.private_key_wif
    // return generatedkeys.transferKey.private_key_hex
}

export const getTransferKey = async (
    _currentNetwork: string,
    _identityIdx: number,
) => {
    /* Set network. */
    const network = (_currentNetwork === 'mainnet') ? 'mainnet' : 'testnet'

    /* Request private keys. */
    const generatedkeys = getPrivateKeys(network, _identityIdx)
console.log('GENERATED KEYS', generatedkeys)

// FIXME -- ONLY SEARCH IF (STANDARD) KEYS DO NOT WORK
    const response = await getIdentities(network)
    const registeredKeys = response![0].publicKeys
console.log('REGISTERED KEYS', registeredKeys)
// FIXME WE WANT TO SUPPORT ALTERNATIVE KEY CONFIGURATIONS

/*

PURPOSES
0 => AUTHENTICATION
1 => ENCRYPTION
2 => DECRYPTION
3 => TRANSFER

TYPES
0 =>
1 =>
2 => ???

SECURITY LEVELS
0 => MASTER
1 => CRITICAL
2 => HIGH
3 => MEDIUM



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

    /* Return transfer (private) key (WIF). */
    return generatedkeys.transferKey.private_key_wif
    // return generatedkeys.transferKey.private_key_hex
}

export const getTokenBalance = async (
    identityIds: [string],
    _tokenId: string,
): Promise<bigint> => {
    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Request TOKEN balance. */
    const response = await get_identities_token_balances_with_proof_info(
        sdk, identityIds, _tokenId)
console.log('getTokenBalance (response)', response)

    /* Validate response. */
    if (typeof response !== 'undefined' && response !== null && response.data.length > 0) {
        /* Set TOKEN balance. */
        const balance = BigInt(response.data[0].balance)
console.log('getTokenBalance (balance)', balance)

        /* Return TOKEN balance. */
        return balance
    }

    /* Return default. */
    return BigInt(0)
}

export const sendCredit = async (
    _network: string,
    _identityId: string,
    _identityIdx: number,
    _receiver: string,
    _credits: bigint,
): Promise<ITxSuccess | ITxError> => {
    /* Initialize locals. */
    let error
    let response
    let sdk
    let txid

    /* Set receiver. */
    // TODO ADD FINAL RECEIVER VALIDATION
    const receiver = _receiver

    /* Set credits. */
    // TODO ADD FINAL CREDITS VALIDATION
    const credits = BigInt(_credits)

    /* Request transfer (WIF) key. */
    const transferWif = await getTransferKey(_network, _identityIdx)
console.log('GET TRANSFER KEY', transferWif)
    /* Handle network. */
    if (_network === 'mainnet') {
        /* Initialize SDK. */
        // 4.1.1 API: the trusted context discovers live masternode addresses
        // at runtime (the old build's hard-coded address list was removed).
        const context = await WasmTrustedContext.prefetchMainnet()
        sdk = await WasmSdkBuilder.mainnet().withTrustedContext(context).build()
    } else {
        /* Initialize SDK. */
        const context = await WasmTrustedContext.prefetchTestnet()
        sdk = await WasmSdkBuilder.testnet().withTrustedContext(context).build()
    }
console.log('IDENTITY ID', _identityId)
    /* 4.1.1 API: the transfer needs the sender's current identity nonce. The
     * TS interface for the method expects { amount, senderId, recipientId,
     * nonce } while the API docs describe an { identity, signer } shape — the
     * call passes a superset so either binding contract is satisfied. */
    const nonce = await sdk.getIdentityNonce(_identityId)
    const identity = await sdk.getIdentity(_identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${_identityId}`)
    }

    const signer = new IdentitySigner()
    signer.addKeyFromWif(transferWif)

    /* Transfer credits. */
    const txResult = await (sdk as any).identityCreditTransfer({
        amount: credits,
        senderId: _identityId,
        recipientId: _receiver,
        nonce,
        identity,
        signer,
    })
console.log('WALLET MANGAER (tx result)', txResult)

    /* Return transaction (result) ID. */
    return { txid: (txResult as any)?.txid || 'UNKNOWN TXID' }
}

export const withdrawToCore = async (
    _network: string,
    _identityId: string,
    _identityIdx: number,
    _credits: bigint,
    _toCoreAddress: string,
    _coreFeePerByte: number = 1,
): Promise<ITxSuccess | ITxError> => {
    /* Initialize locals. */
    let sdk

    /* Validate destination address (Base58, Core L1 P2PKH/P2SH). */
    if (typeof _toCoreAddress !== 'string' || _toCoreAddress.length < 26) {
        throw new Error('Please enter a valid Dash (L1) address.')
    }

    /* Set credits. */
    // TODO ADD FINAL CREDITS VALIDATION
    const credits = BigInt(_credits)

    /* Request transfer (WIF) key. */
    const transferWif = await getTransferKey(_network, _identityIdx)
console.log('WITHDRAW (transfer WIF)', transferWif)

    /* Handle network. */
    if (_network === 'mainnet') {
        /* Initialize SDK. */
        // 4.1.1 API: the trusted context discovers live masternode
        // addresses at runtime (the old hard-coded list was removed).
        const context = await WasmTrustedContext.prefetchMainnet()
        sdk = await WasmSdkBuilder.mainnet().withTrustedContext(context).build()
    } else {
        /* Initialize SDK. */
        const context = await WasmTrustedContext.prefetchTestnet()
        sdk = await WasmSdkBuilder.testnet().withTrustedContext(context).build()
    }
console.log('WITHDRAW (identity ID)', _identityId)

    /* Request identity. */
    const identity = await sdk.getIdentity(_identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${_identityId}`)
    }

    /* Request signer. */
    const signer = new IdentitySigner()
    signer.addKeyFromWif(transferWif)

    /* Withdraw credits to Core (L1). */
    // NOTE: coreFeePerByte MUST be an integer in wasm SDK 4.1.1 (a float
    // throws "value is not an integer, found float 1.2"). The returned value
    // is the REMAINING identity balance (verified live on testnet).
    const remaining = await (sdk as any).identityCreditWithdrawal({
        identity,
        amount: credits,
        toAddress: _toCoreAddress,
        coreFeePerByte: Math.trunc(_coreFeePerByte),
        signer,
    })
console.log('WITHDRAW (remaining balance)', remaining)

    /* Return result. */
    return {
        txid: 'WITHDRAWAL PENDING',
        remainingBalance: remaining,
    } as any
}

export const sendToken = async (
    _network: string,
    _identityId: string,
    _identityIdx: number,
    _tokenId: string,
    _receiver: string,
    _atomicUnits: bigint,
): Promise<ITxSuccess | ITxError> => {
    /* Initialize locals. */
    let sdk

    /* Handle network. */
    if (_network === 'mainnet') {
        /* Initialize Dash Platform SDK. */
        sdk = new DashPlatformSDK({ network: 'mainnet' })
    } else {
        /* Initialize Dash Platform SDK. */
        sdk = new DashPlatformSDK({ network: 'testnet' })
    }

    /* Set transfer amount. */
    // const amount = BigInt(_satoshis)
console.log('TOKEN ID', _tokenId)
console.log('IDENTITY ID', _identityId)
    /* Initialize token base transition. */
    const tokenBaseTransition = await sdk.tokens
        .createBaseTransition(_tokenId, _identityId)

    /* Initialize state transition. */
    const stateTransition = sdk.tokens
        .createStateTransition(
            tokenBaseTransition,
            _identityId,
            'transfer',
            {
                identityId: _receiver,
                amount: _atomicUnits,
            },
        )

    /* Request transfer (WIF) key. */
    const authWif = await getAuthKey(_network, _identityIdx)
console.log('authWif', authWif)

    /* Request transfer (WIF) key. */
    const transferWif = await getTransferKey(_network, _identityIdx)
console.log('transferWif', transferWif)
    /* Set private (transfer) key. */
    const privKey = PrivateKeyWASM.fromWIF(transferWif)
    // const privKey = PrivateKeyWASM.fromHex(transferWif, 'testnet')
console.log('privKey', privKey)
    /* Set identity. */
    const identity = await sdk.identities.getIdentityByIdentifier(_identityId)

    /* Set public keys. */
    // NOTE: the 4.2 dev-build d.ts declares getPublicKeys(), but at runtime
    // the method does not exist — the keys live on the .publicKeys property.
    const identityPublicKeys = (identity as any).publicKeys
// console.log('PUBLIC KEYS', identityPublicKeys)

    /* Set public key ID. */
    const publicKeyId = 3 // 03 => Transfer (Critical)

    /* Set public key. */
    const pubKey = identityPublicKeys[publicKeyId]
// console.log('PUB KEY', pubKey)
    // stateTransition.signByPrivateKey(PrivateKeyWASM.fromHex(privateKey, 'testnet'), 'ECDSA_SECP256K1')
    // stateTransition.signByPrivateKey(PrivateKeyWASM.fromWIF(transferWif), publicKeyId, 'ECDSA_HASH160')
    // stateTransition.signByPrivateKey(PrivateKeyWASM.fromHex(transferWif, 'testnet'), undefined, 'ECDSA_HASH160')

    /* Assign public key ID. */
// NOTE IS THIS STILL NECESSARY??
    // stateTransition.signaturePublicKeyId = publicKeyId

    /* Sign state transition. */
    stateTransition.sign(privKey, pubKey)

    /* Broadcast state transition. */
    await sdk.stateTransitions.broadcast(stateTransition)

    // FIXME FIND A WAY TO REQUEST TXID
    return { txid: 'UNKNOWN TXID' }
}

export const createDocument = async (
    _network: string,
    _identityIdx: number,
    _identityId: string,
    _dataContract: string,
    _tokenPaymentInfo: ITokenPaymentInfo,
    _receiver: string,
    _atomicUnits: bigint,
): Promise<ITxSuccess | ITxError> => {
    /* Initialize locals. */
    let sdk

    /* Handle network. */
    if (_network === 'mainnet') {
        /* Initialize Dash Platform SDK. */
        sdk = new DashPlatformSDK({ network: 'mainnet' })
    } else {
        /* Initialize Dash Platform SDK. */
        sdk = new DashPlatformSDK({ network: 'testnet' })
    }

    /* Set data contract. */
    // TODO ADD FINAL DATA CONTRACT VALIDATION
    const dataContract = _dataContract

    /* Set document type. */
    // TODO ADD FINAL DOCUMENT TYPE VALIDATION
    const documentType = ''

    /* Set (document) data. */
    const data = {}

    /* Create document. */
    const document = sdk.documents
        .create(dataContract, documentType, data, _identityId)

    /* Set identity contract nonce. */
// FIXME IS THIS STILL NECESSARY??
    const identityContractNonce = BigInt(1)

    const tokenPaymentInfo = {
        tokenContractId: '...',
        tokenContractPosition: 0,
        maximumTokenCost: BigInt(10),
        gasFeesPaidBy: GasFeesPaidByWASM.ContractOwner,
    }

    /* Create state transition. */
    const stateTransition = sdk.documents.createStateTransition(
        document,
        'create',
        {
            identityContractNonce,
            tokenPaymentInfo: _tokenPaymentInfo,
        },
    )

    /* Request transfer (WIF) key. */
    const transferWif = await getTransferKey(_network, _identityIdx)

    /* Set private (transfer) key. */
    const privKey = PrivateKeyWASM.fromWIF(transferWif)

    /* Set identity. */
    const identity = await sdk.identities.getIdentityByIdentifier(_identityId)

    /* Set public keys. */
    // NOTE: the 4.2 dev-build d.ts declares getPublicKeys(), but at runtime
    // the method does not exist — the keys live on the .publicKeys property.
    const identityPublicKeys = (identity as any).publicKeys
// console.log('PUBLIC KEYS', identityPublicKeys)

    /* Set public key ID. */
    const publicKeyId = 3 // 03 => Transfer (Critical)

    /* Set public key. */
    const pubKey = identityPublicKeys[publicKeyId]

    /* Sign state transition. */
    stateTransition.sign(privKey, pubKey)

    /* Broadcast state transition. */
    await sdk.stateTransitions.broadcast(stateTransition)

    // FIXME FIND A WAY TO REQUEST TXID
    return { txid: 'UNKNOWN TXID' }
}
