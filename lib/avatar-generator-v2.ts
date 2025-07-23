// Enhanced Avatar generator for Yappr with 32 customizable properties
// Generates a unique avatar string based on various features with slider controls

export interface AvatarFeaturesV2 {
  // Face Shape & Structure (5 properties)
  faceShape: number        // 0-10: round to square
  jawline: number          // 0-10: soft to strong
  cheekbones: number       // 0-10: low to high
  chinShape: number        // 0-10: rounded to pointed
  foreheadSize: number     // 0-10: small to large

  // Skin & Complexion (3 properties)
  skinTone: number         // 0-20: various skin tones
  skinGlow: number         // 0-10: matte to glowing
  freckles: number         // 0-10: none to many

  // Eyes (5 properties)
  eyeShape: number         // 0-15: various shapes
  eyeSize: number          // 0-10: small to large
  eyeColor: number         // 0-15: various colors
  eyeLashes: number        // 0-10: short to long
  eyebrows: number         // 0-15: various styles

  // Nose (4 properties)
  noseShape: number        // 0-15: various shapes
  noseSize: number         // 0-10: small to large
  noseWidth: number        // 0-10: narrow to wide
  nostrilShape: number     // 0-10: small to flared

  // Mouth & Lips (3 properties)
  mouthShape: number       // 0-15: various shapes
  lipFullness: number      // 0-10: thin to full
  lipColor: number         // 0-10: light to dark

  // Hair (6 properties)
  hairStyle: number        // 0-20: various styles
  hairLength: number       // 0-10: bald to very long
  hairColor: number        // 0-20: various colors
  hairTexture: number      // 0-10: straight to curly
  hairVolume: number       // 0-10: thin to thick
  hairHighlights: number   // 0-10: none to many

  // Facial Hair (2 properties)
  facialHairStyle: number  // 0-15: none to full beard
  facialHairColor: number  // 0-10: matches hair color variations

  // Accessories (4 properties)
  glasses: number          // 0-15: none to various styles
  earrings: number         // 0-10: none to various styles
  necklace: number         // 0-10: none to various styles
  headwear: number         // 0-15: none to various hats
}

export const AVATAR_PROPERTIES: {
  [K in keyof AvatarFeaturesV2]: {
    label: string
    min: number
    max: number
    step: number
    category: string
  }
} = {
  // Face Shape & Structure
  faceShape: { label: 'Face Shape', min: 0, max: 10, step: 1, category: 'Face Structure' },
  jawline: { label: 'Jawline', min: 0, max: 10, step: 1, category: 'Face Structure' },
  cheekbones: { label: 'Cheekbones', min: 0, max: 10, step: 1, category: 'Face Structure' },
  chinShape: { label: 'Chin Shape', min: 0, max: 10, step: 1, category: 'Face Structure' },
  foreheadSize: { label: 'Forehead Size', min: 0, max: 10, step: 1, category: 'Face Structure' },

  // Skin & Complexion
  skinTone: { label: 'Skin Tone', min: 0, max: 20, step: 1, category: 'Skin' },
  skinGlow: { label: 'Skin Glow', min: 0, max: 10, step: 1, category: 'Skin' },
  freckles: { label: 'Freckles', min: 0, max: 10, step: 1, category: 'Skin' },

  // Eyes
  eyeShape: { label: 'Eye Shape', min: 0, max: 15, step: 1, category: 'Eyes' },
  eyeSize: { label: 'Eye Size', min: 0, max: 10, step: 1, category: 'Eyes' },
  eyeColor: { label: 'Eye Color', min: 0, max: 15, step: 1, category: 'Eyes' },
  eyeLashes: { label: 'Eyelashes', min: 0, max: 10, step: 1, category: 'Eyes' },
  eyebrows: { label: 'Eyebrows', min: 0, max: 15, step: 1, category: 'Eyes' },

  // Nose
  noseShape: { label: 'Nose Shape', min: 0, max: 15, step: 1, category: 'Nose' },
  noseSize: { label: 'Nose Size', min: 0, max: 10, step: 1, category: 'Nose' },
  noseWidth: { label: 'Nose Width', min: 0, max: 10, step: 1, category: 'Nose' },
  nostrilShape: { label: 'Nostril Shape', min: 0, max: 10, step: 1, category: 'Nose' },

  // Mouth & Lips
  mouthShape: { label: 'Mouth Shape', min: 0, max: 15, step: 1, category: 'Mouth' },
  lipFullness: { label: 'Lip Fullness', min: 0, max: 10, step: 1, category: 'Mouth' },
  lipColor: { label: 'Lip Color', min: 0, max: 10, step: 1, category: 'Mouth' },

  // Hair
  hairStyle: { label: 'Hair Style', min: 0, max: 20, step: 1, category: 'Hair' },
  hairLength: { label: 'Hair Length', min: 0, max: 10, step: 1, category: 'Hair' },
  hairColor: { label: 'Hair Color', min: 0, max: 20, step: 1, category: 'Hair' },
  hairTexture: { label: 'Hair Texture', min: 0, max: 10, step: 1, category: 'Hair' },
  hairVolume: { label: 'Hair Volume', min: 0, max: 10, step: 1, category: 'Hair' },
  hairHighlights: { label: 'Hair Highlights', min: 0, max: 10, step: 1, category: 'Hair' },

  // Facial Hair
  facialHairStyle: { label: 'Facial Hair Style', min: 0, max: 15, step: 1, category: 'Facial Hair' },
  facialHairColor: { label: 'Facial Hair Color', min: 0, max: 10, step: 1, category: 'Facial Hair' },

  // Accessories
  glasses: { label: 'Glasses', min: 0, max: 15, step: 1, category: 'Accessories' },
  earrings: { label: 'Earrings', min: 0, max: 10, step: 1, category: 'Accessories' },
  necklace: { label: 'Necklace', min: 0, max: 10, step: 1, category: 'Accessories' },
  headwear: { label: 'Headwear', min: 0, max: 15, step: 1, category: 'Accessories' },
}

export function generateAvatarV2(seed: string): AvatarFeaturesV2 {
  // Use seed to generate deterministic features
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Generate random but deterministic values for each property
  const features: AvatarFeaturesV2 = {} as AvatarFeaturesV2
  let currentHash = Math.abs(hash)
  
  for (const [key, config] of Object.entries(AVATAR_PROPERTIES)) {
    currentHash = (currentHash * 1103515245 + 12345) & 0x7fffffff
    const value = currentHash % (config.max - config.min + 1) + config.min
    features[key as keyof AvatarFeaturesV2] = value
  }
  
  return features
}

export function encodeAvatarFeaturesV2(features: AvatarFeaturesV2): string {
  // Pack all 32 features into a compact string
  const values: number[] = []
  
  for (const key of Object.keys(AVATAR_PROPERTIES) as (keyof AvatarFeaturesV2)[]) {
    values.push(features[key])
  }
  
  // Convert to base64 for compact representation
  const buffer = new Uint8Array(values)
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)))
  
  // Add version prefix
  return `v2:${base64}`
}

export function decodeAvatarFeaturesV2(avatarString: string): AvatarFeaturesV2 {
  // Remove version prefix
  const base64 = avatarString.replace(/^v\d+:/, '')
  
  // Decode from base64
  const binary = atob(base64)
  const values = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    values[i] = binary.charCodeAt(i)
  }
  
  // Reconstruct features object
  const features: Partial<AvatarFeaturesV2> = {}
  const keys = Object.keys(AVATAR_PROPERTIES) as (keyof AvatarFeaturesV2)[]
  
  for (let i = 0; i < keys.length && i < values.length; i++) {
    features[keys[i]] = values[i]
  }
  
  return features as AvatarFeaturesV2
}

// Generate SVG representation of the avatar
export function generateAvatarSVG(features: AvatarFeaturesV2): string {
  // This would generate an actual SVG based on the features
  // For now, we'll return a placeholder that shows the features as a unique pattern
  const colors = [
    '#FFB6C1', '#FFA07A', '#FFD700', '#98FB98', '#87CEEB',
    '#DDA0DD', '#F0E68C', '#FF69B4', '#00CED1', '#FF6347'
  ]
  
  const mainColor = colors[features.skinTone % colors.length]
  const hairColor = colors[features.hairColor % colors.length]
  
  return `
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${mainColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${mainColor};stop-opacity:0.8" />
        </linearGradient>
      </defs>
      
      <!-- Face -->
      <ellipse cx="100" cy="100" rx="${70 + features.faceShape}" ry="${80 + features.jawline}" fill="url(#skinGradient)" />
      
      <!-- Hair -->
      <path d="M 50 50 Q 100 ${30 - features.hairLength} 150 50" fill="${hairColor}" opacity="0.8" />
      
      <!-- Eyes -->
      <circle cx="75" cy="90" r="${5 + features.eyeSize}" fill="#333" />
      <circle cx="125" cy="90" r="${5 + features.eyeSize}" fill="#333" />
      
      <!-- Nose -->
      <path d="M 100 100 L ${95 - features.noseWidth} 110 L ${105 + features.noseWidth} 110 Z" fill="${mainColor}" opacity="0.8" />
      
      <!-- Mouth -->
      <path d="M 80 130 Q 100 ${140 + features.lipFullness} 120 130" stroke="#d66" fill="none" stroke-width="2" />
      
      <!-- Unique identifier pattern -->
      <rect x="10" y="180" width="180" height="10" fill="${mainColor}" opacity="0.3" />
      <rect x="${10 + features.faceShape * 5}" y="180" width="20" height="10" fill="${hairColor}" />
    </svg>
  `
}

// Get a data URL for the avatar
export function getAvatarDataURL(features: AvatarFeaturesV2): string {
  const svg = generateAvatarSVG(features)
  const encoded = btoa(svg)
  return `data:image/svg+xml;base64,${encoded}`
}