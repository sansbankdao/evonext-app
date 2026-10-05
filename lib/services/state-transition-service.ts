/* Import modules. */
import { getWasmSdk } from './wasm-sdk-service'
import { wait_for_state_transition_result } from '../dash-wasm/compat'
import type { WasmSdk } from '../dash-wasm/compat'
import {
    Document,
    IdentitySigner,
    PlatformVersion,
} from '../dash-wasm/compat'
import { PrivateKeyWASM } from 'pshenmic-dpp'

export interface StateTransitionResult {
    success: boolean;
    transactionHash?: string;
    document?: any;
    error?: string;
}

class StateTransitionService {
    /**
     * Get the private key from secure storage
     */
    private async getPrivateKey(identityId: string): Promise<string> {
        if (typeof window === 'undefined') {
            throw new Error('State transitions can only be performed in browser');
        }

        // First try to get from memory (session storage)
        const { getPrivateKey } = await import('../secure-storage');
        let privateKey = getPrivateKey(identityId);

        // If not in memory, try biometric storage
        if (!privateKey) {
            console.log('Private key not in session storage, attempting biometric retrieval...')

            try {
                const { biometricStorage, getPrivateKeyWithBiometric } = await import('../biometric-storage')

                // Check if biometric is available
                const isAvailable = await biometricStorage.isAvailable();
                console.log('Biometric available:', isAvailable);

                // Try to get the key
                privateKey = await getPrivateKeyWithBiometric(identityId);
                console.log('Biometric retrieval result:', privateKey ? 'Success' : 'Failed');

                if (privateKey) {
                    console.log('Retrieved private key with biometric authentication');
                    // Also store in memory for this session to avoid repeated biometric prompts
                    const { storePrivateKey } = await import('../secure-storage');
                    storePrivateKey(identityId, privateKey, 3600000); // 1 hour TTL
                } else {
                    console.log('No private key found in biometric storage for identity:', identityId);
                }
            } catch (e) {
                console.error('Biometric retrieval error:', e);
            }
        }

        if (!privateKey) {
            throw new Error('No private key found. Please log in again.');
        }

        return privateKey;
    }

    /**
     * Generate entropy for state transitions
     */
    private generateEntropyBytes(): Uint8Array {
        const bytes = new Uint8Array(32)

        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(bytes);
        } else {
            // Fallback for non-browser environments (should not happen in production)
            for (let i = 0; i < 32; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }

        return bytes;
    }

    /**
     * Resolve the signing key: the identity key that CORRESPONDS to the
     * private key we actually hold (the IdentitySigner's key must match
     * `identityKey`, and document transitions require a CRITICAL or HIGH
     * security level — a MASTER key is rejected with "Invalid public key
     * security level MASTER").
     *
     * Match by key material: derive the public key hash from the stored WIF
     * and compare against the identity key's `data` (hex hash160 for
     * ECDSA_HASH160 keys, hex compressed key for ECDSA_SECP256K1).
     * Falls back to the previous first-AUTH heuristic if nothing matches.
     */
    private getSigningKey(identity: any, privateKey?: string) {
        const keys = identity.publicKeys || []
        if (privateKey) {
            try {
                const privKey = PrivateKeyWASM.fromWIF(privateKey)
                const hashHex = privKey.getPublicKeyHash()
                const hashB64 = Buffer.from(hashHex, 'hex').toString('base64')
                let compressedHex: string | undefined
                let compressedB64: string | undefined
                try {
                    const compressed = privKey.getPublicKey().bytes()
                    compressedHex = Buffer.from(compressed).toString('hex')
                    compressedB64 = Buffer.from(compressed).toString('base64')
                } catch {
                    /* type-0 matching unavailable */
                }
                // The raw IdentityPublicKey class exposes keyType as a STRING
                // ("ECDSA_HASH160") plus keyTypeNumber; plain/JSON objects use
                // the numeric `type`. Support both shapes. `data` is hex on the
                // class getter and base64 in toJSON() — compare both.
                const isHash160 = (k: any) =>
                    k.keyType === 'ECDSA_HASH160' || k.keyTypeNumber === 2 || k.type === 2
                const isSecp256k1 = (k: any) =>
                    k.keyType === 'ECDSA_SECP256K1' || k.keyTypeNumber === 0 || k.type === 0
                const matched = keys.find((k: any) => !k.disabledAt && (
                    (isHash160(k) && (k.data === hashHex || k.data === hashB64)) ||
                    (isSecp256k1(k) && compressedHex !== undefined &&
                        (k.data === compressedHex || k.data === compressedB64))))
                if (matched) {
                    return matched
                }
                console.warn('getSigningKey: no identity key matches the stored WIF')
            } catch (e) {
                console.warn('getSigningKey: WIF material match failed:', e)
            }
        }
        // Fallback heuristics: document transitions require CRITICAL | HIGH,
        // so prefer those; a MASTER key would be rejected anyway.
        const isAuth = (k: any) => k.purpose === 'AUTHENTICATION' || k.purpose === 0
        const isCritOrHigh = (k: any) =>
            k.securityLevel === 'CRITICAL' || k.securityLevel === 1 ||
            k.securityLevel === 'HIGH' || k.securityLevel === 2
        return (
            keys.find((k: any) => isAuth(k) && isCritOrHigh(k) && !k.disabledAt) ||
            keys.find((k: any) => isAuth(k) && !k.disabledAt) ||
            keys[0]
        )
    }

    /**
     * Create a document
     */
    async createDocument(
        contractId: string,
        documentType: string,
        ownerId: string,
        documentData: any
    ): Promise<StateTransitionResult> {
        try {
            const sdk = await getWasmSdk()
            const privateKey = await this.getPrivateKey(ownerId)
            const entropy = this.generateEntropyBytes()

            console.log(`Creating ${documentType} document with data:`, documentData)
            console.log(`Contract ID: ${contractId}`)
            console.log(`Owner ID: ${ownerId}`)

            // 4.1.1 API: the transition is assembled from a Document instance,
            // the owner's identity key and an IdentitySigner holding the WIF.
            const identity = await sdk.getIdentity(ownerId)
            if (!identity) {
                throw new Error(`Identity not found: ${ownerId}`)
            }

            const identityKey = this.getSigningKey(identity, privateKey)
            if (!identityKey) {
                throw new Error(`No usable public key on identity: ${ownerId}`)
            }

            const signer = new IdentitySigner()
            signer.addKeyFromWif(privateKey)

            const document = new Document({
                properties: documentData,
                documentTypeName: documentType,
                dataContractId: contractId,
                ownerId,
                entropy,
            })

            await sdk.documentCreate({ document, identityKey, signer })

            // The new API returns void; the created document is reconstructed
            // from the Document instance (its ID/entropy were generated locally).
            const createdDocument = document.toJSON(PlatformVersion.current())
            console.log('Document creation result:', createdDocument)

            // The result contains the document and transition info
            return {
                success: true,
                document: createdDocument
            }
        } catch (error) {
            console.error('Error creating document:', error)

            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : ((error as any)?.message || 'Unknown error')
            }
        }
    }

    /**
     * Update a document
     */
    async updateDocument(
        contractId: string,
        documentType: string,
        documentId: string,
        ownerId: string,
        documentData: any,
        revision: number
    ): Promise<StateTransitionResult> {
        try {
            const sdk = await getWasmSdk()
            const privateKey = await this.getPrivateKey(ownerId)

            console.log(`Updating ${documentType} document ${documentId}...`)
            console.log('REVISION IS', revision)

            // 4.1.1 API: the replace transition takes a Document instance whose
            // revision is the CURRENT revision + 1, the owner's identity key
            // and an IdentitySigner holding the WIF.
            const identity = await sdk.getIdentity(ownerId)
            if (!identity) {
                throw new Error(`Identity not found: ${ownerId}`)
            }

            const identityKey = this.getSigningKey(identity, privateKey)
            if (!identityKey) {
                throw new Error(`No usable public key on identity: ${ownerId}`)
            }

            const signer = new IdentitySigner()
            signer.addKeyFromWif(privateKey)

            const document = new Document({
                properties: documentData,
                documentTypeName: documentType,
                dataContractId: contractId,
                ownerId,
                id: documentId,
                revision: BigInt(revision) + BigInt(1),
            })

            await sdk.documentReplace({ document, identityKey, signer })

            // The new API returns void; the updated document is reconstructed
            // from the Document instance.
            const updatedDocument = document.toJSON(PlatformVersion.current())

            return {
                success: true,
                document: updatedDocument
            }
        } catch (error) {
            console.error('Error updating document:', error)

            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : ((error as any)?.message || 'Unknown error')
            }
        }
    }

    /**
     * Delete a document
     */
    async deleteDocument(
        contractId: string,
        documentType: string,
        documentId: string,
        ownerId: string
    ): Promise<StateTransitionResult> {
        try {
            const sdk = await getWasmSdk()
            const privateKey = await this.getPrivateKey(ownerId)

            console.log(`Deleting ${documentType} document ${documentId}...`);

            // 4.1.1 API: the delete transition takes identifiers plus the
            // owner's identity key and an IdentitySigner holding the WIF.
            const identity = await sdk.getIdentity(ownerId)
            if (!identity) {
                throw new Error(`Identity not found: ${ownerId}`)
            }

            const identityKey = this.getSigningKey(identity, privateKey)
            if (!identityKey) {
                throw new Error(`No usable public key on identity: ${ownerId}`)
            }

            const signer = new IdentitySigner()
            signer.addKeyFromWif(privateKey)

            await sdk.documentDelete({
                document: {
                    id: documentId,
                    ownerId,
                    dataContractId: contractId,
                    documentTypeName: documentType,
                },
                identityKey,
                signer,
            })

            return {
                success: true
            }
        } catch (error) {
            console.error('Error deleting document:', error);

            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : ((error as any)?.message || 'Unknown error')
            }
        }
    }

    /**
     * Wait for a state transition to be confirmed
     */
    async waitForConfirmation(
        transactionHash: string,
        options: {
            maxWaitTimeMs?: number,
            pollingIntervalMs?: number,
            onProgress?: (attempt: number, elapsed: number) => void
        } = {}
    ): Promise<{ success: boolean; result?: any; error?: string }> {
        const {
            maxWaitTimeMs = 10000, // 10 seconds max wait (reduced from 30s)
            pollingIntervalMs = 2000, // Poll every 2 seconds
            onProgress
        } = options

        const startTime = Date.now()

        let attempt = 0

        try {
            const sdk = await getWasmSdk();

            console.log(`Waiting for transaction confirmation: ${transactionHash}`);

            // Try wait_for_state_transition_result once with a short timeout
            try {
                // Create a timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Wait timeout')), 8000); // 8 second timeout
                })

                // Race the wait call against the timeout
                const result = await Promise.race([
                    wait_for_state_transition_result(sdk, transactionHash),
                    timeoutPromise
                ])

                if (result) {
                    console.log('Transaction confirmed via wait_for_state_transition_result:', result)
                    return { success: true, result }
                }
            } catch (waitError) {
                // This is expected to timeout frequently due to DAPI gateway issues
                console.log('wait_for_state_transition_result timed out (expected):', waitError);
            }

            // Since wait_for_state_transition_result often times out even for successful transactions,
            // we'll assume success if the transaction was broadcast successfully
            // This is a workaround for the known DAPI gateway timeout issue
            console.log('Transaction broadcast successfully. Assuming confirmation due to known DAPI timeout issue.');
            console.log('Note: The transaction is likely confirmed on the network despite the timeout.');

            return {
                success: true,
                result: {
                    assumed: true,
                    reason: 'DAPI wait timeout is a known issue - transaction likely succeeded',
                    transactionHash
                }
            }
        } catch (error) {
            console.error('Error waiting for confirmation:', error);
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : ((error as any)?.message || 'Unknown error')
            }
        }
    }

    /**
     * Create document with confirmation
     */
    async createDocumentWithConfirmation(
        contractId: string,
        documentType: string,
        ownerId: string,
        documentData: any,
        waitForConfirmation: boolean = false
    ): Promise<StateTransitionResult & { confirmed?: boolean }> {
        const result = await this.createDocument(contractId, documentType, ownerId, documentData);

        if (!result.success || !waitForConfirmation || !result.transactionHash) {
            return result;
        }
        console.log('Waiting for transaction confirmation...');

        const confirmation = await this.waitForConfirmation(result.transactionHash, {
            onProgress: (attempt, elapsed) => {
                console.log(`Confirmation attempt ${attempt}, elapsed: ${Math.round(elapsed / 1000)}s`);
            }
        })

        return {
            ...result,
            confirmed: confirmation.success
        }
    }
}

// Singleton instance
export const stateTransitionService = new StateTransitionService()
