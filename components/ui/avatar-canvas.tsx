'use client'

import { useEffect, useRef } from 'react'
import { AvatarFeaturesV2 } from '@/lib/avatar-generator-v2'

interface AvatarCanvasProps {
    features: AvatarFeaturesV2;
    size?: number;
    className?: string;
}

export function AvatarCanvas({ features, size = 200, className = '' }: AvatarCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current

        if (!canvas) return

        const ctx = canvas.getContext('2d')

        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, size, size)

        // Scale for high DPI displays
        const dpiScale = window.devicePixelRatio || 1
        canvas.width = size * dpiScale
        canvas.height = size * dpiScale
        ctx.scale(dpiScale, dpiScale)

        // White background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, size, size)

        // Scale factor to show full face
        const scale = 0.5 // Reduced scale to show full face

        // Define color palettes
        const skinTones = [
            '#FDBCB4', '#F5DEB3', '#FFE4C4', '#FFCBA4', '#E5B887',
            '#D2B48C', '#C19A6B', '#A0522D', '#8B4513', '#704214',
            '#5C4033', '#3D2314', '#261A0D', '#F5E6D3', '#E8BEAC',
            '#D4A76A', '#BA8B57', '#A47148', '#8B6239', '#6F4E37',
        ]

        const hairColors = [
            '#090806', '#2C1608', '#4E2519', '#68391E', '#8D5524',
            '#B57C3E', '#E0C09F', '#F5DEB3', '#FFE4B5', '#FFDEAD',
            '#D2691E', '#A52A2A', '#8B0000', '#FF6347', '#FF4500',
            '#FF8C00', '#FFD700', '#B8860B', '#DAA520', '#808080',
        ]

        const eyeColors = [
            '#4B3C20', '#5C4033', '#8B4513', '#228B22', '#008080',
            '#4682B4', '#000080', '#4B0082', '#8B008B', '#696969',
            '#2F4F4F', '#556B2F', '#8B7355', '#A0522D', '#D2691E',
            '#FFD700',
        ]

        // Get colors based on features
        const skinColor = skinTones[features.skinTone % skinTones.length]
        const hairColor = hairColors[features.hairColor % hairColors.length]
        const eyeColor = eyeColors[features.eyeColor % eyeColors.length]

        // Draw face shape
        const centerX = size / 2
        const centerY = size / 2
        const faceWidth = (80 + features.faceShape * 4) * scale
        const faceHeight = (100 + features.jawline * 3) * scale

        // Face with glow effect
        if (features.skinGlow > 0) {
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, faceWidth)
            gradient.addColorStop(0, skinColor)
            gradient.addColorStop(1, adjustBrightness(skinColor, -20))
            ctx.fillStyle = gradient
        } else {
            ctx.fillStyle = skinColor
        }

        ctx.beginPath()
        ctx.ellipse(centerX, centerY, faceWidth, faceHeight, 0, 0, Math.PI * 2)
        ctx.fill()

        // Draw cheekbones
        if (features.cheekbones > 5) {
            ctx.fillStyle = adjustBrightness(skinColor, -10)
            ctx.globalAlpha = 0.2
            ctx.beginPath()
            ctx.ellipse(centerX - 30 * scale, centerY, (15 + features.cheekbones) * scale, (10 + features.cheekbones / 2) * scale, -0.3, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.ellipse(centerX + 30 * scale, centerY, (15 + features.cheekbones) * scale, (10 + features.cheekbones / 2) * scale, 0.3, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 1
        }

        // Draw freckles
        if (features.freckles > 0) {
            ctx.fillStyle = adjustBrightness(skinColor, -30)

            const freckleCount = features.freckles * 5

            for (let i = 0; i < freckleCount; i++) {
                const x = centerX - 40 * scale + Math.random() * 80 * scale
                const y = centerY - 20 * scale + Math.random() * 40 * scale
                ctx.globalAlpha = 0.3
                ctx.beginPath()
                ctx.arc(x, y, 1 * scale, 0, Math.PI * 2)
                ctx.fill()
            }

            ctx.globalAlpha = 1
        }

        // Draw hair
        if (features.hairLength > 0) {
            ctx.fillStyle = hairColor

            // Hair style variations
            const hairY = centerY - faceHeight + 20 * scale

            if (features.hairStyle < 5) {
                // Short hair
                ctx.beginPath()
                ctx.ellipse(centerX, hairY, faceWidth + 10 * scale, (40 + features.hairVolume * 2) * scale, 0, Math.PI, 0)
                ctx.fill()
            } else if (features.hairStyle < 10) {
                // Medium hair
                ctx.beginPath()
                ctx.ellipse(centerX, hairY, faceWidth + 15 * scale, (50 + features.hairVolume * 3) * scale, 0, Math.PI, 0)
                ctx.fill()
                // Side hair
                ctx.beginPath()
                ctx.rect(centerX - faceWidth - 10 * scale, hairY, 20 * scale, (60 + features.hairLength * 5) * scale)
                ctx.fill()
                ctx.beginPath()
                ctx.rect(centerX + faceWidth - 10 * scale, hairY, 20 * scale, (60 + features.hairLength * 5) * scale)
                ctx.fill()
            } else {
                // Long hair
                ctx.beginPath()
                ctx.ellipse(centerX, hairY, faceWidth + 20 * scale, (60 + features.hairVolume * 4) * scale, 0, Math.PI, 0)
                ctx.fill()
                // Flowing hair
                ctx.beginPath()
                ctx.moveTo(centerX - faceWidth - 15 * scale, hairY)
                ctx.quadraticCurveTo(centerX - faceWidth - 25 * scale, centerY + faceHeight, centerX - faceWidth, centerY + faceHeight + 30 * scale)
                ctx.lineTo(centerX + faceWidth, centerY + faceHeight + 30 * scale)
                ctx.quadraticCurveTo(centerX + faceWidth + 25 * scale, centerY + faceHeight, centerX + faceWidth + 15 * scale, hairY)
                ctx.fill()
            }

            // Hair highlights
            if (features.hairHighlights > 0) {
                ctx.fillStyle = adjustBrightness(hairColor, 40)
                ctx.globalAlpha = features.hairHighlights / 20
                ctx.beginPath()
                ctx.ellipse(centerX - 20 * scale, hairY + 10 * scale, 15 * scale, 30 * scale, -0.2, 0, Math.PI * 2)
                ctx.fill()
                ctx.beginPath()
                ctx.ellipse(centerX + 20 * scale, hairY + 10 * scale, 15 * scale, 30 * scale, 0.2, 0, Math.PI * 2)
                ctx.fill()
                ctx.globalAlpha = 1
            }
        }

        // Draw eyes
        const eyeY = centerY - 20 * scale
        const eyeSpacing = 25 * scale
        const eyeWidth = (15 + features.eyeSize) * scale
        const eyeHeight = (10 + features.eyeSize / 2) * scale

        // Eyebrows
        ctx.strokeStyle = adjustBrightness(hairColor, -20)
        ctx.lineWidth = (2 + features.eyebrows / 5) * scale
        ctx.beginPath()
        ctx.moveTo(centerX - eyeSpacing - eyeWidth, eyeY - 15 * scale)
        ctx.quadraticCurveTo(centerX - eyeSpacing, eyeY - (20 + features.eyebrows / 2) * scale, centerX - eyeSpacing + eyeWidth, eyeY - 15 * scale)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(centerX + eyeSpacing - eyeWidth, eyeY - 15 * scale)
        ctx.quadraticCurveTo(centerX + eyeSpacing, eyeY - (20 + features.eyebrows / 2) * scale, centerX + eyeSpacing + eyeWidth, eyeY - 15 * scale)
        ctx.stroke()

        // Eye whites
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.ellipse(centerX - eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(centerX + eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2)
        ctx.fill()

        // Iris
        ctx.fillStyle = eyeColor
        ctx.beginPath()
        ctx.arc(centerX - eyeSpacing, eyeY, eyeHeight * 0.7, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(centerX + eyeSpacing, eyeY, eyeHeight * 0.7, 0, Math.PI * 2)
        ctx.fill()

        // Pupils
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        ctx.arc(centerX - eyeSpacing, eyeY, eyeHeight * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(centerX + eyeSpacing, eyeY, eyeHeight * 0.3, 0, Math.PI * 2)
        ctx.fill()

        // Eyelashes
        if (features.eyeLashes > 0) {
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 1 * scale

            const lashCount = 3 + features.eyeLashes / 2

            for (let i = 0; i < lashCount; i++) {
                const angle = (i / lashCount) * Math.PI / 2 - Math.PI / 4
                ctx.beginPath()
                ctx.moveTo(centerX - eyeSpacing + Math.cos(angle) * eyeWidth, eyeY + Math.sin(angle) * eyeHeight)
                ctx.lineTo(centerX - eyeSpacing + Math.cos(angle) * (eyeWidth + 3 * scale), eyeY + Math.sin(angle) * (eyeHeight + 3 * scale))
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(centerX + eyeSpacing + Math.cos(Math.PI - angle) * eyeWidth, eyeY + Math.sin(Math.PI - angle) * eyeHeight)
                ctx.lineTo(centerX + eyeSpacing + Math.cos(Math.PI - angle) * (eyeWidth + 3 * scale), eyeY + Math.sin(Math.PI - angle) * (eyeHeight + 3 * scale))
                ctx.stroke()
            }
        }

        // Draw nose
        const noseY = centerY + 5 * scale
        const noseWidth = (15 + features.noseWidth) * scale
        const noseHeight = (20 + features.noseSize) * scale

        ctx.strokeStyle = adjustBrightness(skinColor, -20)
        ctx.lineWidth = 2 * scale
        ctx.beginPath()

        // Nose bridge
        ctx.moveTo(centerX, noseY - noseHeight / 2)
        ctx.lineTo(centerX - noseWidth / 3, noseY + noseHeight / 2)
        ctx.stroke()

        // Nostrils
        ctx.fillStyle = adjustBrightness(skinColor, -30)
        const nostrilSize = (3 + features.nostrilShape / 2) * scale
        ctx.beginPath()
        ctx.ellipse(centerX - noseWidth / 2, noseY + noseHeight / 2, nostrilSize, nostrilSize / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(centerX + noseWidth / 2, noseY + noseHeight / 2, nostrilSize, nostrilSize / 2, 0, 0, Math.PI * 2)
        ctx.fill()

        // Draw mouth
        const mouthY = centerY + 35 * scale
        const mouthWidth = (30 + features.mouthShape * 2) * scale
        const lipFullness = (5 + features.lipFullness) * scale

        // Lips
        const lipColor = interpolateColor(skinColor, '#E91E63', features.lipColor / 10)
        ctx.fillStyle = lipColor

        // Upper lip
        ctx.beginPath()
        ctx.moveTo(centerX - mouthWidth / 2, mouthY)
        ctx.quadraticCurveTo(centerX, mouthY - lipFullness, centerX + mouthWidth / 2, mouthY)
        ctx.quadraticCurveTo(centerX, mouthY + lipFullness / 2, centerX - mouthWidth / 2, mouthY)
        ctx.fill()

        // Lower lip
        ctx.beginPath()
        ctx.moveTo(centerX - mouthWidth / 2, mouthY)
        ctx.quadraticCurveTo(centerX, mouthY + lipFullness * 1.5, centerX + mouthWidth / 2, mouthY)
        ctx.closePath()
        ctx.fill()

        // Facial hair
        if (features.facialHairStyle > 0) {
            const facialHairColor = interpolateColor(hairColor, '#000000', features.facialHairColor / 10)
            ctx.fillStyle = facialHairColor
            ctx.globalAlpha = 0.7

            if (features.facialHairStyle < 5) {
                // Mustache
                ctx.beginPath()
                ctx.ellipse(centerX - 15 * scale, mouthY - 8 * scale, 15 * scale, 5 * scale, -0.2, 0, Math.PI * 2)
                ctx.fill()
                ctx.beginPath()
                ctx.ellipse(centerX + 15 * scale, mouthY - 8 * scale, 15 * scale, 5 * scale, 0.2, 0, Math.PI * 2)
                ctx.fill()
            }

            if (features.facialHairStyle > 5) {
                // Beard
                ctx.beginPath()
                ctx.moveTo(centerX - faceWidth + 20 * scale, mouthY)
                ctx.quadraticCurveTo(centerX, mouthY + 40 * scale, centerX + faceWidth - 20 * scale, mouthY)
                ctx.lineTo(centerX + faceWidth - 20 * scale, centerY + faceHeight - 20 * scale)
                ctx.quadraticCurveTo(centerX, centerY + faceHeight, centerX - faceWidth + 20 * scale, centerY + faceHeight - 20 * scale)
                ctx.closePath()
                ctx.fill()
            }

            ctx.globalAlpha = 1
        }

        // Accessories
        // Glasses
        if (features.glasses > 0) {
            ctx.strokeStyle = '#333333'
            ctx.lineWidth = 3 * scale
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'

            const glassesStyle = features.glasses % 5

            if (glassesStyle < 3) {
                // Regular glasses
                ctx.beginPath()
                ctx.rect(centerX - eyeSpacing - eyeWidth - 5 * scale, eyeY - eyeHeight - 5 * scale, eyeWidth * 2 + 10 * scale, eyeHeight * 2 + 10 * scale)
                ctx.fill()
                ctx.stroke()
                ctx.beginPath()
                ctx.rect(centerX + eyeSpacing - eyeWidth - 5 * scale, eyeY - eyeHeight - 5 * scale, eyeWidth * 2 + 10 * scale, eyeHeight * 2 + 10 * scale)
                ctx.fill()
                ctx.stroke()
                // Bridge
                ctx.beginPath()
                ctx.moveTo(centerX - eyeSpacing + eyeWidth + 5 * scale, eyeY)
                ctx.lineTo(centerX + eyeSpacing - eyeWidth - 5 * scale, eyeY)
                ctx.stroke()
            } else {
                // Sunglasses
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
                ctx.beginPath()
                ctx.ellipse(centerX - eyeSpacing, eyeY, eyeWidth + 8 * scale, eyeHeight + 8 * scale, 0, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
                ctx.beginPath()
                ctx.ellipse(centerX + eyeSpacing, eyeY, eyeWidth + 8 * scale, eyeHeight + 8 * scale, 0, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
            }
        }

        // Earrings
        if (features.earrings > 0) {
            ctx.fillStyle = '#FFD700'
            ctx.beginPath()
            ctx.arc(centerX - faceWidth, centerY, (3 + features.earrings / 2) * scale, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(centerX + faceWidth, centerY, (3 + features.earrings / 2) * scale, 0, Math.PI * 2)
            ctx.fill()
        }
    }, [features, size])

    // Helper functions
    function adjustBrightness(color: string, amount: number): string {
        // Ensure color starts with #
        const cleanColor = color.startsWith('#') ? color : `#${color}`
        const num = parseInt(cleanColor.slice(1), 16)
        const amt = Math.round(2.55 * amount)
        const R = (num >> 16) + amt
        const G = (num >> 8 & 0x00FF) + amt
        const B = (num & 0x0000FF) + amt

        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
                .toString(16)
                .slice(1)
    }

    function interpolateColor(color1: string, color2: string, factor: number): string {
        // Ensure colors start with #
        const cleanColor1 = color1.startsWith('#') ? color1 : `#${color1}`
        const cleanColor2 = color2.startsWith('#') ? color2 : `#${color2}`

        const c1 = parseInt(cleanColor1.slice(1), 16)
        const c2 = parseInt(cleanColor2.slice(1), 16)

        const r1 = (c1 >> 16) & 0xff
        const g1 = (c1 >> 8) & 0xff
        const b1 = c1 & 0xff

        const r2 = (c2 >> 16) & 0xff
        const g2 = (c2 >> 8) & 0xff
        const b2 = c2 & 0xff

        const r = Math.round(r1 + (r2 - r1) * factor)
        const g = Math.round(g1 + (g2 - g1) * factor)
        const b = Math.round(b1 + (b2 - b1) * factor)

        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    }

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className={className}
            style={{ width: size, height: size }}
        />
    )
}
