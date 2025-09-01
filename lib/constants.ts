/**
 * Application constants
 */

// Contract IDs
export const YAPPR_CONTRACT_ID = 'AyWK6nDVfb8d1ZmkM5MmZZrThbUyWyso1aMeGuuVSfxf' // Testnet
export const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec' // Testnet

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
