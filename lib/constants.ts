/**
 * Application Constants
 *
 * A single source for ALL applications constants.
 */

/* DPNS Contract ID */
export const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec' // Mainnet + Testnet

/* DUSD Contract IDs */
// NOTE: Platform official stablecoin
export const DUSD_CONTRACT_ID_MAINNET = '' // Mainnet
export const DUSD_CONTRACT_ID_TESTNET = '' // Testnet

/* SANS Contract IDs */
// NOTE: Platform official staking token
export const SANS_CONTRACT_ID_MAINNET = '' // Mainnet
export const SANS_CONTRACT_ID_TESTNET = '' // Testnet

/* YAPPR Contract IDs */
export const YAPPR_CONTRACT_ID_MAINNET = '' // Mainnet
// export const YAPPR_CONTRACT_ID_TESTNET = '' // Testnet
export const YAPPR_CONTRACT_ID_ALT = 'AyWK6nDVfb8d1ZmkM5MmZZrThbUyWyso1aMeGuuVSfxf' // Testnet (owned by therealslimshady)

// Network configuration
export const DEFAULT_NETWORK = 'testnet'

// Document types
export const DOCUMENT_TYPES = {
    PROFILE: 'profile',
    AVATAR: 'avatar',
    POST: 'post',
    LIKE: 'like',
    REPOST: 'repost',
    FOLLOW: 'follow',
    BOOKMARK: 'bookmark',
    LIST: 'list',
    LIST_MEMBER: 'listMember',
    BLOCK: 'block',
    MUTE: 'mute',
    DIRECT_MESSAGE: 'directMessage',
    NOTIFICATION: 'notification'
} as const

// DPNS
export const DPNS_DOCUMENT_TYPE = 'domain'
