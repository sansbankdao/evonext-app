// lib/session-keys.ts
//
// Shared sign-in credential resolution, extracted from the identical inline
// logic previously duplicated in `app/connect/page.tsx` (handleMnemonic) and
// the registration success path in `components/id/registrar-modal.tsx`
// (no logic change; see AGENTS.md).

import { getIdentities } from './identity-manager'
import { getPublicKeys } from './wallet-manager'

export interface SessionCredentials {
    identityId: string
    identityIdx: number
    wif: string
}

/**
 * Get Session Credentials
 *
 * Looks up the registered identity for the current wallet (the first
 * identity index returned by the chain lookups) and resolves the signing
 * key (purpose AUTHENTICATION, securityLevel CRITICAL or HIGH) plus its
 * private key WIF — the credentials the auth context's login() requires.
 *
 * Returns null when no identity (or no usable signing key) exists, which
 * callers handle as the "no identity found" path.
 */
export const getSessionCredentials = async (
    _network: 'mainnet' | 'testnet',
): Promise<SessionCredentials | null> => {
    /* Request ALL (registered) Identities. */
    const regIdentities = await getIdentities(_network)

    /* Validate identities. */
    if (typeof regIdentities === 'undefined' || regIdentities === null || regIdentities.length === 0) {
        return null
    }

    /* Set identity ID + index + registered public keys. */
    const identityId = regIdentities[0].id
    const identityIdx = regIdentities[0].idx || 0
    const regPubKeys = regIdentities[0].publicKeys

    /* Validate Identity ID and public keys. */
    if (typeof identityId === 'undefined' || typeof regPubKeys === 'undefined') {
        return null
    }

    /* Request public keys (derived). */
    const publicKeys = getPublicKeys(_network, identityIdx)

    /* Set signing public key (AUTHENTICATION + CRITICAL | HIGH). */
    const signingPublicKey = regPubKeys.find((_pubkey: any) => {
        return _pubkey.purpose === 0 && (_pubkey.securityLevel === 1 || _pubkey.securityLevel === 2)
    })
    if (typeof signingPublicKey === 'undefined' || signingPublicKey === null) {
        return null
    }

    /* Set signing private key (matching the signing public key ID). */
    const signingPrivateKey = publicKeys.find(_pubkey => {
        return _pubkey.id === signingPublicKey.id
    })
    if (typeof signingPrivateKey === 'undefined' || signingPrivateKey === null) {
        return null
    }

    /* Set seed private key (WIF). */
    return {
        identityId,
        identityIdx,
        wif: signingPrivateKey.privateKeyWif,
    }
}
