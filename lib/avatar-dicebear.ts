/* lib/avatar-dicebear.ts
 *
 * DiceBear-based avatar generation, matching the Yappr repo's approach
 * (yappr/lib/services/avatar-generator.ts + unified-profile-service.ts).
 * Avatars are generated LOCALLY as SVG data URIs — no network calls —
 * deterministically from a (style, seed) pair.
 */

import { createAvatar, Style } from '@dicebear/core'
import * as collection from '@dicebear/collection'

/* Cache for generated avatar data URIs.
 * Key: `${style}:${seed}`, Value: data URI string */
const avatarCache = new Map<string, string>()
const MAX_CACHE_SIZE = 500 // Limit cache to prevent memory bloat

/* Map of style names to their DiceBear collection modules.
 * Using Style<object> as the generic type since each style has different options */
const styleMap: Record<string, Style<any>> = {
    'adventurer': collection.adventurer,
    'adventurer-neutral': collection.adventurerNeutral,
    'avataaars': collection.avataaars,
    'avataaars-neutral': collection.avataaarsNeutral,
    'big-ears': collection.bigEars,
    'big-ears-neutral': collection.bigEarsNeutral,
    'big-smile': collection.bigSmile,
    'bottts': collection.bottts,
    'bottts-neutral': collection.botttsNeutral,
    'croodles': collection.croodles,
    'croodles-neutral': collection.croodlesNeutral,
    'fun-emoji': collection.funEmoji,
    'icons': collection.icons,
    'identicon': collection.identicon,
    'initials': collection.initials,
    'lorelei': collection.lorelei,
    'lorelei-neutral': collection.loreleiNeutral,
    'micah': collection.micah,
    'miniavs': collection.miniavs,
    'notionists': collection.notionists,
    'notionists-neutral': collection.notionistsNeutral,
    'open-peeps': collection.openPeeps,
    'personas': collection.personas,
    'pixel-art': collection.pixelArt,
    'pixel-art-neutral': collection.pixelArtNeutral,
    'rings': collection.rings,
    'shapes': collection.shapes,
    'thumbs': collection.thumbs,
}

/* Available DiceBear styles (same list as the Yappr repo). */
export const DICEBEAR_STYLES = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
    'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
    'croodles', 'croodles-neutral', 'fun-emoji', 'icons', 'identicon',
    'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
    'notionists', 'notionists-neutral', 'open-peeps', 'personas',
    'pixel-art', 'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
] as const

export type DiceBearStyle = typeof DICEBEAR_STYLES[number]

/* Default avatar style (same as the Yappr repo). */
export const DEFAULT_AVATAR_STYLE: DiceBearStyle = 'thumbs'

/* Human-readable labels for DiceBear styles. */
export const DICEBEAR_STYLE_LABELS: Record<DiceBearStyle, string> = {
    'adventurer': 'Adventurer',
    'adventurer-neutral': 'Adventurer Neutral',
    'avataaars': 'Avataaars',
    'avataaars-neutral': 'Avataaars Neutral',
    'big-ears': 'Big Ears',
    'big-ears-neutral': 'Big Ears Neutral',
    'big-smile': 'Big Smile',
    'bottts': 'Bottts',
    'bottts-neutral': 'Bottts Neutral',
    'croodles': 'Croodles',
    'croodles-neutral': 'Croodles Neutral',
    'fun-emoji': 'Fun Emoji',
    'icons': 'Icons',
    'identicon': 'Identicon',
    'initials': 'Initials',
    'lorelei': 'Lorelei',
    'lorelei-neutral': 'Lorelei Neutral',
    'micah': 'Micah',
    'miniavs': 'Miniavs',
    'notionists': 'Notionists',
    'notionists-neutral': 'Notionists Neutral',
    'open-peeps': 'Open Peeps',
    'personas': 'Personas',
    'pixel-art': 'Pixel Art',
    'pixel-art-neutral': 'Pixel Art Neutral',
    'rings': 'Rings',
    'shapes': 'Shapes',
    'thumbs': 'Thumbs',
}

/* A generated avatar configuration. */
export interface AvatarConfig {
    style: DiceBearStyle
    seed: string
}

/**
 * Generate an avatar SVG string locally using DiceBear.
 *
 * @param style - The DiceBear style name
 * @param seed - The seed string for deterministic generation
 * @returns SVG string
 */
export function generateAvatarSvg(style: string, seed: string): string {
    const styleModule = styleMap[style] || styleMap[DEFAULT_AVATAR_STYLE]
    const avatar = createAvatar(styleModule, { seed })
    return avatar.toString()
}

/**
 * Generate an avatar as a data URI for use in img src.
 * Results are cached to avoid regenerating the same avatars.
 *
 * @param style - The DiceBear style name
 * @param seed - The seed string for deterministic generation
 * @returns Data URI string (data:image/svg+xml;base64,...)
 */
export function generateAvatarDataUri(style: string, seed: string): string {
    const cacheKey = `${style}:${seed}`

    /* Check cache first. */
    const cached = avatarCache.get(cacheKey)

    if (cached) {
        return cached
    }

    /* Generate new avatar. */
    const svg = generateAvatarSvg(style, seed)

    /* Encode to base64 for data URI. */
    const base64 = typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(svg)))
        : Buffer.from(svg).toString('base64')
    const dataUri = `data:image/svg+xml;base64,${base64}`

    /* Evict oldest entry if cache is full (simple FIFO eviction). */
    if (avatarCache.size >= MAX_CACHE_SIZE) {
        const firstKey = avatarCache.keys().next().value

        if (firstKey !== undefined) {
            avatarCache.delete(firstKey)
        }
    }

    avatarCache.set(cacheKey, dataUri)

    return dataUri
}

/**
 * Generate an avatar data URI from an AvatarConfig.
 */
export function getAvatarDataURL(config: AvatarConfig): string {
    if (!config.seed) {
        console.warn('avatar-dicebear: getAvatarDataURL called with empty seed')
        return ''
    }

    return generateAvatarDataUri(config.style, config.seed)
}

/**
 * Get the default avatar data URI for a user (their identity id as the seed).
 */
export function getDefaultAvatarDataURL(userId: string): string {
    if (!userId) {
        console.warn('avatar-dicebear: getDefaultAvatarDataURL called with empty userId')
        return ''
    }

    return getAvatarDataURL({ style: DEFAULT_AVATAR_STYLE, seed: userId })
}

/**
 * Encode avatar config to a JSON string for storage
 * (same encoding as the Yappr repo's on-chain avatar field).
 */
export function encodeAvatarData(seed: string, style: DiceBearStyle): string {
    return JSON.stringify({ seed, style })
}

/**
 * Parse a stored avatar string into an AvatarConfig. Handles:
 * - JSON strings like `{"seed":"...","style":"thumbs"}` (Yappr encoding)
 * - legacy `v2:` feature strings (no longer supported -> null)
 * - plain strings (treated as the seed with the default style)
 */
export function parseAvatarConfig(avatarString: string | undefined | null): AvatarConfig | null {
    if (!avatarString) {
        return null
    }

    /* Legacy custom canvas avatars (v2 feature encoding) are retired. */
    if (avatarString.startsWith('v2:')) {
        return null
    }

    /* Direct URI form is not supported for locally generated avatars. */
    if (avatarString.startsWith('http://') || avatarString.startsWith('https://') || avatarString.startsWith('data:')) {
        return null
    }

    try {
        const parsed = JSON.parse(avatarString)

        if (parsed && typeof parsed.seed === 'string' && typeof parsed.style === 'string') {
            const style = (DICEBEAR_STYLES as readonly string[]).includes(parsed.style)
                ? parsed.style as DiceBearStyle
                : DEFAULT_AVATAR_STYLE

            return { style, seed: parsed.seed }
        }
    } catch {
        /* Not JSON — treat as seed only. */
    }

    return { style: DEFAULT_AVATAR_STYLE, seed: avatarString }
}

/**
 * Generate a random seed string (same as the Yappr repo).
 */
export function generateRandomSeed(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
