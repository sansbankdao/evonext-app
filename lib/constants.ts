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
export const EVONEXT_CONTRACT_ID = 'ABkiTVge8zwnbZf8hXaP1QYBEF2vYXKHUGwCk58pwwj7'

/* YAPPR Contract IDs */
export const YAPPR_CONTRACT_ID_MAINNET = '' // Mainnet
export const YAPPR_CONTRACT_ID = 'AyWK6nDVfb8d1ZmkM5MmZZrThbUyWyso1aMeGuuVSfxf'

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
