// lib/network.ts
//
// Shared network/contract-id resolution, extracted from the identical local
// helpers previously duplicated in `lib/services/profile-service.ts` and
// `lib/services/post-service.ts` (no logic change; see AGENTS.md).

import {
    EVONEXT_CONTRACT_ID_MAINNET,
    EVONEXT_CONTRACT_ID_TESTNET,
} from '@/lib/constants'

/**
 * Get Contract ID
 *
 * @param _network
 * @returns
 */
export const getContractId = (_network: string) => {
    /* Initialize locals. */
    let contractId

    /* Handle network. */
    if (_network === 'mainnet') {
        contractId = EVONEXT_CONTRACT_ID_MAINNET
    } else {
        contractId = EVONEXT_CONTRACT_ID_TESTNET
    }

    return contractId
}

/**
 * Get Network
 *
 * Returns the currently active network:
 *   - mainnet
 *   - testnet
 *   - localhost (NOT YET SUPPORTED)
 * @returns
 */
export const getNetwork = () => {
    // Guard for SSR / static-export prerender where `window` is undefined.
    // Client-side behavior is unchanged; server-side falls back to 'testnet'.
    /* Set host. */
    const host = typeof window !== 'undefined' ? window.location.host : ''

    /* Initialize locals. */
    let network

    /* Handle host. */
// FIXME Handle mainnet for localhost and IPFS.
    switch(host) {
    case 'evonext.app':
        network = 'mainnet'
        break
    default:
        network = 'testnet'
        break
    }

    /* Return network. */
    return network
}
