// Avatar generator for Yappr
// Generates a unique avatar string based on various features

export interface AvatarFeatures {
    // Base style (0-7)
    style: number

    // Hair style (0-15)
    hair: number

    // Hair color (0-15)
    hairColor: number

    // Skin tone (0-7)
    skinTone: number

    // Eye type (0-15)
    eyes: number

    // Eye color (0-7)
    eyeColor: number

    // Mouth type (0-15)
    mouth: number

    // Facial hair (0-7, 0 = none)
    facialHair: number

    // Accessories (0-15, 0 = none)
    accessories: number

    // Clothing (0-15)
    clothing: number

    // Clothing color (0-15)
    clothingColor: number

    // Background color (0-15)
    background: number
}

const FEATURE_BITS = {
    style: 3,        // 8 styles
    hair: 4,         // 16 hair styles
    hairColor: 4,    // 16 hair colors
    skinTone: 3,     // 8 skin tones
    eyes: 4,         // 16 eye types
    eyeColor: 3,     // 8 eye colors
    mouth: 4,        // 16 mouth types
    facialHair: 3,   // 8 facial hair options
    accessories: 4,  // 16 accessories
    clothing: 4,     // 16 clothing types
    clothingColor: 4,// 16 clothing colors
    background: 4    // 16 backgrounds
} as const

// Total bits: 44 bits = 11 hex characters (will pad to 16 chars minimum)

export function generateAvatar(seed: string): string {
    // Use seed to generate deterministic features
    let hash = 0

    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i)

        hash = ((hash << 5) - hash) + char

        hash = hash & hash // Convert to 32-bit integer
    }

    // Extract features from hash
    const features: AvatarFeatures = {
        style: Math.abs(hash) % 8,
        hair: Math.abs(hash >> 3) % 16,
        hairColor: Math.abs(hash >> 7) % 16,
        skinTone: Math.abs(hash >> 11) % 8,
        eyes: Math.abs(hash >> 14) % 16,
        eyeColor: Math.abs(hash >> 18) % 8,
        mouth: Math.abs(hash >> 21) % 16,
        facialHair: Math.abs(hash >> 25) % 8,
        accessories: Math.abs(hash >> 28) % 16,
        clothing: Math.abs(hash >> 32) % 16,
        clothingColor: Math.abs(hash >> 36) % 16,
        background: Math.abs(hash >> 40) % 16
    }

    return encodeAvatarFeatures(features)
}

export function encodeAvatarFeatures(features: AvatarFeatures): string {
    // Pack features into a bit string
    let bits = BigInt(0)
    let bitOffset = 0

    const featureOrder: (keyof AvatarFeatures)[] = [
        'style',
        'hair',
        'hairColor',
        'skinTone',
        'eyes',
        'eyeColor',
        'mouth',
        'facialHair',
        'accessories',
        'clothing',
        'clothingColor',
        'background',
    ]

    for (const feature of featureOrder) {
        const value = BigInt(features[feature])
        const bitCount = FEATURE_BITS[feature]

        bits = bits | (value << BigInt(bitOffset))

        bitOffset += bitCount
    }

    // Convert to hex string
    let hex = bits.toString(16)

    // Pad to ensure minimum length of 16 characters
    hex = hex.padStart(16, '0')

    // Add version prefix (v1)
    return `v1:${hex}`
}

export function decodeAvatarFeatures(avatarString: string): AvatarFeatures {
    // Remove version prefix
    const hex = avatarString.replace(/^v\d+:/, '')

    // Convert hex to BigInt
    const bits = BigInt('0x' + hex)

    // Extract features
    let bitOffset = 0
    const features: Partial<AvatarFeatures> = {}

    const featureOrder: (keyof AvatarFeatures)[] = [
        'style',
        'hair',
        'hairColor',
        'skinTone',
        'eyes',
        'eyeColor',
        'mouth',
        'facialHair',
        'accessories',
        'clothing',
        'clothingColor',
        'background',
    ]

    for (const feature of featureOrder) {
        const bitCount = FEATURE_BITS[feature]
        const mask = (BigInt(1) << BigInt(bitCount)) - BigInt(1)

        features[feature] = Number((bits >> BigInt(bitOffset)) & mask)

        bitOffset += bitCount
    }

    return features as AvatarFeatures
}

// Generate avatar URL for rendering (using dicebear or similar service)
export function getAvatarUrl(avatarString: string): string {
    const features = decodeAvatarFeatures(avatarString)

    // Map features to dicebear parameters
    const params = new URLSearchParams({
        seed: avatarString,
        backgroundColor: getBackgroundColor(features.background),
        skinColor: getSkinColor(features.skinTone),
        hair: getHairStyle(features.hair),
        hairColor: getHairColor(features.hairColor),
        eyes: getEyeStyle(features.eyes),
        mouth: getMouthStyle(features.mouth),
        facialHair: getFacialHairStyle(features.facialHair),
        accessories: getAccessoryStyle(features.accessories),
        clothing: getClothingStyle(features.clothing),
        clothingColor: getClothingColor(features.clothingColor)
    })

    return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`
}

// Helper functions to map feature values to actual styles
function getBackgroundColor(index: number): string {
    const colors = [
        'b6e3f4',
        'c0aede',
        'd1d4f9',
        'ffd5dc',
        'ffdfbf',
        'a8e6cf',
        'dcedc1',
        'ffeaa7',
        'fab1a0',
        'ff7675',
        '74b9ff',
        'a29bfe',
        'fd79a8',
        'fdcb6e',
        '6c5ce7',
        'e17055',
    ]

    return colors[index % colors.length]
}

function getSkinColor(index: number): string {
    const colors = [
        'f8d25c',
        'f0c687',
        'daa15f',
        'bf8f4f',
        'ae5d29',
        '935d37',
        '763900',
        '45260d',
    ]

    return colors[index % colors.length]
}

function getHairStyle(index: number): string {
    const styles = [
        'bigHair',
        'bob',
        'bun',
        'curly',
        'curvy',
        'dreads',
        'frida',
        'fro',
        'froAndBand',
        'miaWallace',
        'longButNotTooLong',
        'shavedSides',
        'straight01',
        'straight02',
        'straightAndStrand',
        'dreads01',
    ]

    return styles[index % styles.length]
}

function getHairColor(index: number): string {
    const colors = [
        'a55728',
        '2c1b18',
        '272421',
        '3d2314',
        '5a3825',
        '7a4e48',
        'b55239',
        'd6b370',
        'e8e1e1',
        'ff7070',
        'ffc0cb',
        '8b4513',
        '4a4e4d',
        '0e0e0e',
        '6a4c93',
        '1e90ff',
    ]

    return colors[index % colors.length]
}

function getEyeStyle(index: number): string {
    const styles = [
        'close',
        'cry',
        'default',
        'dizzy',
        'eyeRoll',
        'happy',
        'hearts',
        'side',
        'squint',
        'surprised',
        'wink',
        'winkWacky',
        'xDizzy',
        'happyRounded',
        'sadConcerned',
        'unibrow',
    ]

    return styles[index % styles.length]
}

function getMouthStyle(index: number): string {
    const styles = [
        'concerned',
        'default',
        'disbelief',
        'eating',
        'grimace',
        'sad',
        'screamOpen',
        'serious',
        'smile',
        'tongue',
        'twinkle',
        'vomit',
        'laughing',
        'worried',
        'smallSmile',
        'frown',
    ]

    return styles[index % styles.length]
}

function getFacialHairStyle(index: number): string {
    const styles = [
        '',
        'beardLight',
        'beardMedium',
        'beardMajestic',
        'moustacheFancy',
        'moustacheMagnum',
        'goatee',
        'soul',
    ]

    return styles[index % styles.length]
}

function getAccessoryStyle(index: number): string {
    const styles = [
        '',
        'kurt',
        'prescription01',
        'prescription02',
        'round',
        'sunglasses',
        'wayfarers',
        'earbuds',
        'winterHat01',
        'winterHat02',
        'winterHat03',
        'winterHat04',
        'cap',
        'frizzle',
        'headdress',
        'hatCowboy',
    ]

    return styles[index % styles.length]
}

function getClothingStyle(index: number): string {
    const styles = [
        'blazerShirt',
        'blazerSweater',
        'collarSweater',
        'graphicShirt',
        'hoodie',
        'overall',
        'shirtCrewNeck',
        'shirtScoopNeck',
        'shirtVNeck',
        'sweater',
        'uniform',
        'dress',
        'denimJacket',
        'leatherJacket',
        'winterCoat',
        'turtleneck',
    ]

    return styles[index % styles.length]
}

function getClothingColor(index: number): string {
    const colors = [
        '3c4f5c',
        '65c9ff',
        '5199e4',
        '25557c',
        '262e33',
        '929598',
        '110e0e',
        'e6e6e6',
        'ff5c5c',
        'ff6b6b',
        '77311d',
        'fc909f',
        'f4d150',
        'f5e050',
        '25557c',
        'e1e1e1',
    ]

    return colors[index % colors.length]
}
