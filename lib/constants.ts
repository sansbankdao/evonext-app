/**
 * Application Constants
 *
 * A single source for ALL applications constants.
 */

/* DPNS Contract ID */
export const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec' // Mainnet + Testnet

/* DUSD Contract IDs */
// NOTE: Platform official stablecoin
export const DUSD_CONTRACT_ID_MAINNET = 'DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd' // DUSD on Mainnet
export const DUSD_CONTRACT_ID_TESTNET = '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz' // tDUSD on Testnet

/* SANS Contract IDs */
// NOTE: Platform official staking token
export const SANS_CONTRACT_ID_MAINNET = 'AxAYWyXV6mrm8Sq7vc7wEM18wtL8a8rgj64SM3SDmzsB' // SANS on Mainnet
export const SANS_CONTRACT_ID_TESTNET = 'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw' // tSANS on Testnet

/* EVONEXT Contract IDs */
export const EVONEXT_CONTRACT_ID_MAINNET = '' // Mainnet
export const EVONEXT_CONTRACT_ID = 'CWU7CuvxJU5ahy5izmhkfGv2V5u1xg77mSCYcvD87GgX' // MINIMAL

/* YAPPR Contract IDs */
export const YAPPR_CONTRACT_ID_MAINNET = '' // Mainnet
export const YAPPR_CONTRACT_ID = 'AyWK6nDVfb8d1ZmkM5MmZZrThbUyWyso1aMeGuuVSfxf'

// Network configuration
export const DEFAULT_NETWORK = 'testnet'

// Document types
export const DOCUMENT_TYPES = {
    APP: 'app',
    AVATAR: 'avatar',
    BLOCK: 'block',
    BOOKMARK: 'bookmark',
    DIRECT_MESSAGE: 'directMessage',
    FOLLOW: 'follow',
    LIKE: 'like',
    LIST: 'list',
    LIST_MEMBER: 'listMember',
    MUTE: 'mute',
    NOTIFICATION: 'notification',
    POST: 'post',
    PROFILE: 'profile',
    REPOST: 'repost',
    SOCIAL: 'social',
} as const

// DPNS
export const DPNS_DOCUMENT_TYPE = 'domain'
