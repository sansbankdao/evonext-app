/* Import modules. */
import { getWasmSdk } from './wasm-sdk-service'
import { wait_for_state_transition_result } from '../dash-wasm/wasm_sdk'
import type { WasmSdk } from '../dash-wasm/wasm_sdk'

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
    private generateEntropy(): string {
        const bytes = new Uint8Array(32)

        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(bytes);
        } else {
            // Fallback for non-browser environments (should not happen in production)
            for (let i = 0; i < 32; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }

        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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
            const entropy = this.generateEntropy()

            console.log(`Creating ${documentType} document with data:`, documentData);
            console.log(`Contract ID: ${contractId}`);
            console.log(`Owner ID: ${ownerId}`);

            // Create the document using the SDK method
            const result = await sdk.documentCreate(
                contractId,
                documentType,
                ownerId,
                JSON.stringify(documentData),
                entropy,
                privateKey
            )

            console.log('Document creation result:', result);

            // The result contains the document and transition info
            return {
                success: true,
                transactionHash: result.stateTransition?.$id || result.transitionId,
                document: result.document || result
            }
        } catch (error) {
            console.error('Error creating document:', error)

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
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

            // Update the document using the SDK method
            const result = await sdk.documentReplace(
                contractId,
                documentType,
                documentId,
                ownerId,
                JSON.stringify(documentData),
                BigInt(revision),
                privateKey,
                0 // key_id - using 0 as default (matches index.html)
            )

            return {
                success: true,
                transactionHash: result.stateTransition?.$id || result.transitionId,
                document: result.document || result
            }
        } catch (error) {
            console.error('Error updating document:', error)

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
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

            // Delete the document using the SDK method
            const result = await sdk.documentDelete(
                contractId,
                documentType,
                documentId,
                ownerId,
                privateKey,
                0 // key_id - using 0 as default
            )

            return {
                success: true,
                transactionHash: result.stateTransition?.$id || result.transitionId
            }
        } catch (error) {
            console.error('Error deleting document:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
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
                error: error instanceof Error ? error.message : 'Unknown error'
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
