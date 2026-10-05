'use client'

import { useMemo } from 'react'
import { generateAvatarDataUri, DEFAULT_AVATAR_STYLE } from '@/lib/avatar-dicebear'

interface AvatarCanvasProps {
    seed: string;
    style?: string;
    size?: number;
    className?: string;
}

/**
 * Avatar rendered with DiceBear (local SVG generation, data URI).
 * Deterministic per (style, seed) pair — same as the Yappr repo.
 */
export function AvatarCanvas({ seed, style = DEFAULT_AVATAR_STYLE, size = 200, className = '' }: AvatarCanvasProps) {
    const dataUri = useMemo(() => {
        if (!seed) {
            return ''
        }

        return generateAvatarDataUri(style, seed)
    }, [style, seed])

    if (!dataUri) {
        return (
            <div
                className={`bg-gray-200 dark:bg-gray-700 rounded-full ${className}`}
                style={{ width: size, height: size }}
            />
        )
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- local data URI, next/image would double-encode it
        <img
            src={dataUri}
            alt={`Avatar for ${seed}`}
            width={size}
            height={size}
            className={`rounded-full ${className}`}
        />
    )
}
