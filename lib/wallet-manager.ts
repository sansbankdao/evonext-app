/* Import modules. */
import { DashPlatformSDK } from 'dash-platform-sdk'
import { GasFeesPaidByWASM, PrivateKeyWASM } from 'pshenmic-dpp'

import { wasmSdkService } from './services'
import {
    IdentitySigner,
    WasmSdk,
    WasmSdkBuilder,
    WasmTrustedContext,
    derive_key_from_seed_with_path,
    get_identities_token_balances_with_proof_info,
} from './dash-wasm/compat'
import { getWasmSdk } from './services/wasm-sdk-service'
import { getIdentities } from './identity-manager'
import { getIdentityIdx, getMnemonic, getPrivateKey } from './secure-storage'
import {
    IKeyTypes,
    ITxError,
    ITxSuccess,
    ITokenPaymentInfo,
} from './types'
import { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } from './constants'
import { SYSTEM_WITHDRAWAL_CONTRACT_ID } from './wallet-history'
import { getIdentityNonce, getTokenContractInfo } from './trustless-reads'

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

// FIXME -- ONLY SEARCH IF (STANDARD) KEYS DO NOT WORK
    const response = await getIdentities(network)
    const registeredKeys = response![0].publicKeys
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

const signingPrivateKey = publicKeys.find(_pubkey => {
    return _pubkey.id === signingPublicKey.id
})

const seedPrivateKey = signingPrivateKey!.privateKeyWif

*/

    /* Return transfer (private) key (WIF). */
    return generatedkeys.authCritical.private_key_wif
    // return generatedkeys.transferKey.private_key_hex
}


/* F56d — WASM READINESS GUARD. The glue's key derivation reads the loaded
 * wasm module directly; when the main thread's module load failed/never ran
 * the send paths crashed with "Cannot read properties of undefined (reading
 * 'wasmsdk_deriveKeyFromSeedWithPath')". Every send/withdraw entry now makes
 * sure the service (and therefore the glue) is initialized first — the
 * service's initialize is idempotent, single-flight, and (since F56d) retries
 * a flaky wasm load internally. */
const ensureWasmReady = async (_network: string) => {
    const network = (_network === 'mainnet') ? 'mainnet' : 'testnet'
    if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== network) {
        await wasmSdkService.initialize({
            network,
            contractId: network === 'mainnet'
                ? EVONEXT_CONTRACT_ID_MAINNET
                : EVONEXT_CONTRACT_ID_TESTNET,
        })
    }
}

export const getTransferKey = async (
    _currentNetwork: string,
    _identityIdx: number,
    _identityId?: string,
) => {
    /* Set network. */
    const network = (_currentNetwork === 'mainnet') ? 'mainnet' : 'testnet'

    /* F57b — the PRIVATE-KEY (WIF-ONLY) SESSION: no recovery phrase → the
     * WIF submitted at connect IS the signing key, but ONLY if it is this
     * identity's TRANSFER key (purpose 3 — credit transfers, token
     * transfers and withdrawals all sign with purpose 3; live-verified
     * with the mnemonic path's derived transfer key since F25/F53).
     * Material-match it against the identity's registered keys (the F26g
     * pattern — the class getter's .data is HEX, the JSON shape may be
     * base64) and either hand it back or fail with an HONEST error naming
     * the fix. */
    if (!getMnemonic()) {
        if (!_identityId) {
            throw new Error('This session has no recovery phrase. Reconnect with the TRANSFER key (WIF) of your identity to send credits or tokens.')
        }
        /* F57b — the multi-key store first: an explicitly ADDED TRANSFER
         * key (Settings → Keys) wins. */
        const { getSessionTransferWif } = await import('./session-keys-store')
        const storedTransferWif = await getSessionTransferWif(network, _identityId)
        if (storedTransferWif) return storedTransferWif
        const submittedWif = getPrivateKey(_identityId)
        if (!submittedWif) {
            throw new Error('The submitted private key has expired from this session — reconnect with the TRANSFER key (WIF) of your identity.')
        }
        const sdk = await getWasmSdk()
        const identity = await sdk.getIdentity(_identityId)
        if (!identity) {
            throw new Error(`Identity not found: ${_identityId}`)
        }
        const submittedPubHash = PrivateKeyWASM.fromWIF(submittedWif).getPublicKeyHash()
        /* Normalize the keys to a list (the F53 regression: a positional
         * read crashes on wrapper objects — iterate VALUES + flat). */
        const rawKeys = (identity as any).publicKeys
        const keysList: any[] = Array.isArray(rawKeys)
            ? rawKeys
            : (rawKeys && typeof rawKeys === 'object')
                ? Object.values(rawKeys).flat()
                : []
        for (const k of keysList) {
            if (!k || typeof k !== 'object' || k.data === undefined || k.data === null) continue
            const purpose = k.purpose
            const isTransfer = purpose === 3 || String(purpose).toUpperCase() === 'TRANSFER'
            if (!isTransfer) continue
            const dataHex = typeof k.data === 'string' ? k.data : Buffer.from(k.data).toString('hex')
            if (dataHex.toLowerCase() === String(submittedPubHash).toLowerCase()) {
                return submittedWif
            }
        }
        throw new Error('No TRANSFER key in this session. Add it under Settings → Keys (or reconnect with the TRANSFER key WIF) — credit and token transfers are signed by purpose 3 (TRANSFER), not by the authentication keys.')
    }

    /* Request private keys. */
    const generatedkeys = getPrivateKeys(network, _identityIdx)

// FIXME -- ONLY SEARCH IF (STANDARD) KEYS DO NOT WORK
    const response = await getIdentities(network)
    const registeredKeys = response![0].publicKeys
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

const signingPrivateKey = publicKeys.find(_pubkey => {
    return _pubkey.id === signingPublicKey.id
})

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

    /* Validate response. */
    if (typeof response !== 'undefined' && response !== null && response.data.length > 0) {
        /* Set TOKEN balance. */
        const balance = BigInt(response.data[0].balance)

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

    /* WASM readiness (F56d) + the transfer (WIF) key — the session-aware
     * F57b resolution (a WIF-only session signs with its submitted
     * TRANSFER-key WIF). */
    await ensureWasmReady(_network)
    const transferWif = await getTransferKey(_network, _identityIdx, _identityId)
    /* Handle network. */
    /* F56f — the SERVICE's singleton SDK (the cached trusted context + the
     * 8s settings): the per-call WasmTrustedContext.prefetch re-fetched the
     * DAPI discovery on EVERY send — a flaky prefetch failed the whole send
     * (the owner's 'spinner forever', live-observed) and doubled the
     * discovery load. getWasmSdk() reuses the service's init. */
    sdk = await getWasmSdk()
    /* 4.1.1 API: the transfer needs the sender's current identity nonce. The
     * TS interface for the method expects { amount, senderId, recipientId,
     * nonce } while the API docs describe an { identity, signer } shape — the
     * call passes a superset so either binding contract is satisfied. */
    /* F57 Phase 2: the nonce read comes from the plain-API ladder (proxy →
     * pshenmic → wasm last resort) instead of the wasm RPC stack directly. */
    const nonce = await getIdentityNonce(_network === 'mainnet' ? 'mainnet' : 'testnet', _identityId)
    const identity = await sdk.getIdentity(_identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${_identityId}`)
    }

    const signer = new IdentitySigner()
    signer.addKeyFromWif(transferWif)

    /* Transfer credits. The result carries the POST-transfer balances
     * (IdentityCreditTransferResult) — the UI's confirmation shows them;
     * the op exposes NO transition-hash surface, so the old
     * 'UNKNOWN TXID' + nexa-explorer link is gone (F53d). */
    const txResult = await (sdk as any).identityCreditTransfer({
        amount: credits,
        senderId: _identityId,
        recipientId: _receiver,
        nonce,
        identity,
        signer,
    })

    return {
        txid: 'UNKNOWN TXID' as any,
        recipientBalance: txResult?.recipientBalance !== undefined ? BigInt(txResult.recipientBalance) : undefined,
        senderBalance: txResult?.senderBalance !== undefined ? BigInt(txResult.senderBalance) : undefined,
    } as any
}

/* F57h — the withdrawal-doc reader. GOTCHA (live-probed 2026-11-18): the
 * withdrawal contract's indexes are identityRecent($ownerId,$updatedAt,
 * status) + identityStatus($ownerId,status,$createdAt) and a SINGLE
 * $ownerId where clause silently returns 0 rows — the compound index
 * prefix (adding status) returns the rows. So the docs are fetched per
 * status leg. */
const fetchPendingWithdrawalDocs = async (sdk: any, identityId: string): Promise<any[]> => {
    const docs: any[] = []
    for (const status of [1, 2]) {
        try {
            const rows = await (sdk as any).getDocuments({
                dataContractId: SYSTEM_WITHDRAWAL_CONTRACT_ID,
                documentTypeName: 'withdrawal',
                where: [['$ownerId', '==', identityId], ['status', '==', status]],
                limit: 10,
            })
            if (Array.isArray(rows)) docs.push(...rows)
        } catch { /* a failed leg is skipped — the guard stays best-effort */ }
    }
    return docs
}

export const withdrawToCore = async (
    _network: string,
    _identityId: string,
    _identityIdx: number,
    _credits: bigint,
    _toCoreAddress: string,
    _coreFeePerByte: number = 1,
    /* F57h — injectable for the resilience tests (defaults keep the
     * production behavior 1:1). */
    _poll?: { attempts?: number; intervalMs?: number },
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

    /* WASM readiness (F56d) + the transfer (WIF) key — the session-aware
     * F57b resolution. */
    await ensureWasmReady(_network)
    const transferWif = await getTransferKey(_network, _identityIdx, _identityId)

    /* F56f — the service's singleton SDK (see sendCredit). */
    sdk = await getWasmSdk()

    /* Request identity. */
    const identity = await sdk.getIdentity(_identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${_identityId}`)
    }

    /* Request signer. */
    const signer = new IdentitySigner()
    signer.addKeyFromWif(transferWif)

    /* F57h — IN-FLIGHT GUARD (the F48 idempotency rule): a withdrawal that
     * is signed but not yet complete (status 1/2) would DOUBLE-PAY if a
     * second one were submitted. Refuse while one is fresh. */
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000
    const inFlight = await fetchPendingWithdrawalDocs(sdk, _identityId)
    const nowMs = Date.now()
    const freshInFlight = inFlight.find((doc) => {
        const updated = Number((doc as any)?.$updatedAt ?? (doc as any)?.updatedAt ?? 0)
        return updated > 0 && (nowMs - updated) < TWO_HOURS_MS
    })
    if (freshInFlight) {
        const mins = Math.max(1, Math.round((nowMs - Number(freshInFlight.$updatedAt)) / 60000))
        throw new Error(`You already have a withdrawal in flight (submitted ${mins} min ago). Wait for it to complete — check your History. Submitting another one now could pay out TWICE.`)
    }

    /* Withdraw credits to Core (L1). */
    // NOTE: coreFeePerByte MUST be an integer in wasm SDK 4.1.1 (a float
    // throws "value is not an integer, found float 1.2"). The returned value
    // is the REMAINING identity balance (verified live on testnet).
    let remaining: any
    try {
        remaining = await (sdk as any).identityCreditWithdrawal({
            identity,
            amount: credits,
            toAddress: _toCoreAddress,
            coreFeePerByte: Math.trunc(_coreFeePerByte),
            signer,
        })
    } catch (err: any) {
        const msg = String(err?.message ?? err)

        /* F57h — "Object already exists: tx already exists in cache" is the
         * TENDERDASH mempool cache rejecting a byte-identical RESUBMISSION:
         * the earlier attempt IS in the queue (this exact incident was
         * live-reproduced 2026-11-18 after the 8s deadline killed the wait).
         * Translated to the honest meaning instead of the cryptic error. */
        if (/already exists in cache/i.test(msg)) {
            throw new Error('This withdrawal is ALREADY in the network queue — it will process with an upcoming block. Do NOT submit again until it shows in your History (a repeat submission could pay out twice).')
        }

        /* F57h — a deadline-expired does NOT mean the broadcast failed: the
         * high-level op broadcasts first, then WAITS for the transition to
         * be included in a block — the wait is what blew the 8s transport
         * deadline (the "request timed out after ~8s" error). Verify on
         * chain for ~2 min; if the withdrawal doc commits, report success.
         * If it does NOT commit in the window, return an UNCONFIRMED result
         * (not an error): the tx may still be in the mempool. */
        if (/timed out|deadline/i.test(msg)) {
            const pollAttempts = _poll?.attempts ?? 12
            const pollIntervalMs = _poll?.intervalMs ?? 10000
            for (let attempt = 0; attempt < pollAttempts; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
                try {
                    const docs = await fetchPendingWithdrawalDocs(sdk, _identityId)
                    const freshDoc = docs.find((doc) => {
                        const created = Number((doc as any)?.$createdAt ?? (doc as any)?.createdAt ?? 0)
                        return created > 0 && (Date.now() - created) < 30 * 60 * 1000
                            && BigInt((doc as any)?.amount ?? 0) === credits
                    })
                    if (freshDoc) {
                        const refreshed = await sdk.getIdentity(_identityId)
                        return {
                            txid: 'WITHDRAWAL PENDING',
                            remainingBalance: refreshed?.balance,
                            unconfirmed: false,
                        } as any
                    }
                } catch { /* keep polling — a slow node must not abort the check */ }
            }
            return {
                txid: 'WITHDRAWAL PENDING',
                remainingBalance: undefined,
                unconfirmed: true,
            } as any
        }

        throw err
    }

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
    /* Rewritten on the WASM SDK (5.0) — the F25-era dash-platform-sdk path
     * crashed with 'Cannot read properties of undefined (reading 3)': the
     * 1.5.3 identity wrapper has NO publicKeys property on 5.0, so the
     * identityPublicKeys[3] read exploded. The high-level sdk.tokenTransfer
     * does the nonce fetch + signing + broadcast internally (the same proven
     * pattern as documentCreate/identityCreditTransfer). */

    /* The asset row's id is the TOKEN ID (e.g. tDUSD 3oTHkj8nqn82QkZRHkmU…
     * on testnet, DUSD DYqxCsuDgYsEAJ2ADnimkw… on mainnet) — NOT a contract
     * id. `getTokenContractInfo` resolves the token's (contract, position)
     * pair that the tokenTransfer op needs (verified live 2026-11-14:
     * tDUSD → contract GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23,
     * position 0, 6 decimals). */
    const sdk = await getWasmSdk()
    const network = _network === 'mainnet' ? 'mainnet' : 'testnet'

    /* F57 Phase 2: the (contract, position) resolution rides the plain-API
     * ladder too; null = the honest not-live gate below (unchanged). */
    const tokenInfo = await getTokenContractInfo(network, _tokenId)
    if (!tokenInfo) {
        throw new Error(
            'This token is not live on ' + network + ' yet — no token contract is deployed ' +
            'for ' + _tokenId.slice(0, 8) + '…. The USD/Sansnote asset rows are placeholders ' +
            'until a real token contract is wired in.')
    }
    const dataContractId = String((tokenInfo as any).contractId)
    const tokenPosition = Number((tokenInfo as any).tokenContractPosition)

    /* Sender identity + the signing key matched by MATERIAL (the F26g
     * pattern): find the TRANSFER key by comparing the derived WIF's
     * public-key hash against the identity's keys, then pass BOTH the key
     * object and an IdentitySigner holding the WIF (the tokenTransfer
     * contract). */
    const identity = await sdk.getIdentity(_identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${_identityId}`)
    }

    const transferWif = await getTransferKey(network, _identityIdx, _identityId)
    const transferPubHash = PrivateKeyWASM.fromWIF(transferWif).getPublicKeyHash()
    let identityKey: any = undefined
    /* Normalize the keys to a list: the wasm class exposes an array, but
     * wrapper shapes may hand back a record — iterate VALUES (the F53
     * regression: a positional `[3]` read crashed on wrapper objects). */
    const rawKeys = (identity as any).publicKeys
    const keysList: any[] = Array.isArray(rawKeys)
        ? rawKeys
        : (rawKeys && typeof rawKeys === 'object')
            ? Object.values(rawKeys).flat()
            : []
    for (const k of keysList) {
        if (!k || typeof k !== 'object' || k.data === undefined || k.data === null) continue
        const dataHex = typeof k.data === 'string' ? k.data : Buffer.from(k.data).toString('hex')
        if (dataHex.toLowerCase() === transferPubHash.toLowerCase()) {
            identityKey = k
        }
    }
    if (!identityKey) {
        throw new Error('The identity has no transfer key matching the derived key material')
    }

    const signer = new IdentitySigner()
    signer.addKeyFromWif(transferWif)

    const result = await (sdk as any).tokenTransfer({
        dataContractId,
        tokenPosition,
        amount: BigInt(_atomicUnits),
        senderId: _identityId,
        recipientId: _receiver,
        identityKey,
        signer,
    })

    /* The result carries the POST-transfer balances (TokenTransferResult)
     * — the UI's confirmation shows them (there is no transition-hash
     * surface on this op). */
    return {
        txid: 'UNKNOWN TXID' as any,
        recipientBalance: result?.recipientBalance !== undefined ? BigInt(result.recipientBalance) : undefined,
        senderBalance: result?.senderBalance !== undefined ? BigInt(result.senderBalance) : undefined,
    } as any
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

    /* Set identity contract nonce. */
// FIXME IS THIS STILL NECESSARY??
    const identityContractNonce = BigInt(1)

    /* Create document. */
    const document = sdk.documents
        .create(dataContract, documentType, data, _identityId,
            identityContractNonce)

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

    /* WASM readiness (F56d) + the transfer (WIF) key — the session-aware
     * F57b resolution. */
    await ensureWasmReady(_network)
    const transferWif = await getTransferKey(_network, _identityIdx, _identityId)

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
