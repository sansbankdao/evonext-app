/* Import modules. */
import { getPrivateKeys, getPublicKeys } from './wallet-manager'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'
import {
    dpns_is_contested_username,
    dpns_register_name,
    get_identity_by_public_key_hash,
    get_identity_by_non_unique_public_key_hash,
} from '@/lib/dash-wasm/wasm_sdk'
import { IIdentity, IPublicKey } from '@/lib/types'
 // @ts-ignore
import { hash160 } from '@nexajs/crypto'
 // @ts-ignore
import { binToHex, hexToBin } from '@nexajs/utils'

/* Initialize constants. */
const MIN_INDEX_SEARCH = 3

/**
 * Get Key Type
 *
 * FIXME -- ENUMERATE KEY TYPE
 */
const getKeyType = (_type: number | undefined) => {
    return 'FIXME -- ENUMERATE KEY TYPE'
}

const decodeBase64ToHex = (_base64String: string) => {
  try {
    // 1. Decode the Base64 string into a binary string
    const byteString = atob(_base64String);

    // 2. Create an array to hold the byte values
    const bytes = [];
    for (let i = 0; i < byteString.length; i++) {
      // 3. Convert each character to its byte value
      const byte = byteString.charCodeAt(i);

      // 4. Convert the byte to a two-digit hex string and add to the array
      const hex = byte.toString(16).padStart(2, '0');
      bytes.push(hex);
    }

    // 5. Join the array elements to form the final hex string
    return bytes.join('');
  } catch (e) {
    console.error('Failed to decode Base64 string:', e);
    return null;
  }
}

/**
 * Get Identities
 *
 * Will search ALL keys and signature schemes for an Identity's
 * registered public keys.
 */
export const getIdentities = async (
    _network: string
): Promise<IIdentity[] | null> => {
    /* Initialize Identities handler. */
    const identities: IIdentity[] = []

    for (let i = 0; i < MIN_INDEX_SEARCH; i++) {
        /* Request query by Hash160. */
        const hash160Result = await searchByHash160(_network, i)

        /* Validate result. */
        if (typeof hash160Result !== 'undefined' && hash160Result !== null) {
            identities.push({
                id: hash160Result.identityId,
                idx: i,
                publicKeys: hash160Result.regPubKeys.map((_key: IPublicKey) => {
                    return {
                        id: _key.id,
                        type: _key.type,
                        keyType: getKeyType(_key.type),
                        purpose: _key.purpose,
                        securityLevel: _key.securityLevel,
                        contractBounds: _key.contractBounds,
                        data: _key.data,
                        dataBytes: decodeBase64ToHex(_key.data),
                        readOnly: _key.readOnly,
                        disabledAt: _key.disabledAt,
                    }
                }),
            })
        }

        /* Request query by Secp256k1. */
        const secp256k1Result = await searchBySecp256k1(_network, i)

        /* Validate result. */
        if (typeof secp256k1Result !== 'undefined' && secp256k1Result !== null) {
            identities.push({
                id: secp256k1Result.identityId,
                idx: i,
                publicKeys: secp256k1Result.regPubKeys.map((_key: IPublicKey) => {
                    return {
                        id: _key.id,
                        type: _key.type,
                        keyType: getKeyType(_key.type),
                        purpose: _key.purpose,
                        securityLevel: _key.securityLevel,
                        contractBounds: _key.contractBounds,
                        data: _key.data,
                        dataBytes: decodeBase64ToHex(_key.data),
                        readOnly: _key.readOnly,
                        disabledAt: _key.disabledAt,
                    }
                }),
            })
        }
    }

    /* Validate Identities. */
    if (identities.length === 0) {
        return null
    } else {
        return identities
    }
}

/**
 * Search By Hash160
 *
 * Will search the blockchain for ECDSA_HASH160 public keys, matching
 * the primary public key.
 */
export const searchByHash160 = async (_network: string, _identityIdx: number) => {
    /* Initialize locals. */
    let identityId
    let regPubKeys

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_network, _identityIdx)

    /* Set public key. */
    const publicKey = privateKeys.masterKey.public_key

    /* Calculate public key hash. */
    const publicKeyHash = binToHex(hash160(hexToBin(publicKey)))

    /* Request (HASH160) Identity. */
    const result = await get_identity_by_non_unique_public_key_hash(
        sdk,
        publicKeyHash,
        undefined
    ).catch(err => console.error(err))

    /* Handle ECDSA_HASH160 signature scheme. */
    if (result && result.length > 0 && typeof result === 'object') {
        /* Set Identity ID. */
        identityId = result[0].id

        /* Set registered public keys. */
        regPubKeys = result[0].publicKeys
    }

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

/**
 * Search By Secp256k1
 *
 * Will search the blockchain for ECDSA_SECP256k1 public keys, matching
 * the primary public key.
 */
export const searchBySecp256k1 = async (_network: string, _identityIdx: number) => {
    /* Initialize locals. */
    let identityId
    let regPubKeys

    /* Initialize SDK. */
    const sdk = await wasmSdkService.getSdk()

    /* Request private keys. */
    const privateKeys = getPrivateKeys(_network, _identityIdx)

    /* Set public key. */
    const publicKey = privateKeys.masterKey.public_key

    /* Calculate public key hash. */
    const publicKeyHash = binToHex(hash160(hexToBin(publicKey)))

    /* Request (SECP256k1) Identity. */
    const result = await get_identity_by_public_key_hash(
        sdk,
        publicKeyHash
    ).catch(err => console.error(err))

    /* Handle ECDSA_SECP256k1 signature scheme. */
    if (result && result.toJSON()) {
        /* Set Identity ID. */
        identityId = result.toJSON().id

        /* Set registered public keys. */
        regPubKeys = result.toJSON().publicKeys
    }

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
