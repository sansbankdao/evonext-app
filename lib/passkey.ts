// lib/passkey.ts

export type PasskeyResult = {
    entropy: Uint8Array
    credentialId: Uint8Array
}

/**
 * Helper to convert ArrayBuffer to Hex String
 */
export function bufferToHex(buffer: Uint8Array | ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * Creates a new Passkey and derives 32-byte Entropy from it.
 */
export async function createPasskey(username: string): Promise<PasskeyResult> {
    if (!window.navigator.credentials) {
        throw new Error('WebAuthn is not supported in this browser.')
    }

    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const publicKeyOptions = {
        rp: {
            name: 'EvoNext',
            id: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        },
        user: {
            id: new Uint8Array(16),
            name: username,
            displayName: username,
        },
        challenge,
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
        },
    } as PublicKeyCredentialCreationOptions

    const options = {
        publicKey: publicKeyOptions
    } as CredentialCreationOptions

    const credential = (await navigator.credentials.create(options)) as PublicKeyCredential

    if (!credential) throw new Error('Passkey creation failed')

    const response = credential.response as AuthenticatorAttestationResponse

    // AuthenticatorAttestationResponse typically uses the method getAuthenticatorData()
    // but some TS environments might type it as a property. We cast to any to be safe.
    const attestationData = (response as any).authenticatorData || response.getAuthenticatorData()

    const dataToHash = new Uint8Array(
        credential.rawId.byteLength + attestationData.byteLength
    )

    dataToHash.set(new Uint8Array(credential.rawId), 0)
    dataToHash.set(new Uint8Array(attestationData), credential.rawId.byteLength)

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash)

    return {
        entropy: new Uint8Array(hashBuffer),
        credentialId: new Uint8Array(credential.rawId)
    }
}

/**
 * Retrieves an existing Passkey and re-derives the 32-byte Entropy.
 */
export async function getPasskey(): Promise<PasskeyResult> {
    if (!window.navigator.credentials) {
        throw new Error('WebAuthn is not supported in this browser.')
    }

    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const publicKeyOptions = {
        challenge,
        rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        userVerification: 'preferred',
    } as PublicKeyCredentialRequestOptions

    const options = {
        publicKey: publicKeyOptions
    } as CredentialRequestOptions

    const credential = (await navigator.credentials.get(options)) as PublicKeyCredential

    if (!credential) throw new Error('Passkey retrieval failed')

    const response = credential.response as AuthenticatorAssertionResponse

    // AuthenticatorAssertionResponse uses the property 'authenticatorData'
    const assertionData = response.authenticatorData

    const dataToHash = new Uint8Array(
        credential.rawId.byteLength + assertionData.byteLength
    )

    dataToHash.set(new Uint8Array(credential.rawId), 0)
    dataToHash.set(new Uint8Array(assertionData), credential.rawId.byteLength)

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash)

    return {
        entropy: new Uint8Array(hashBuffer),
        credentialId: new Uint8Array(credential.rawId)
    }
}
