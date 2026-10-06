'use client'

import { useMemo } from 'react'

interface MarkdownContentProps {
    content: string
    className?: string
}

interface ParsedToken {
    type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'mention' | 'hashtag' | 'cashtag'
    content: string
    href?: string
    fullMatch?: string
}

/**
 * Lightweight markdown renderer for social media posts.
 *
 * Supports: **bold**, *italic*, `code`, clickable URLs (opened in a NEW
 * window/tab via target="_blank"; the click is stopped from propagating
 * so it does not also trigger a parent card's navigation), and styles
 * @mentions / #hashtags / $cashtags in the accent color (not linked —
 * EvoNext has no hashtag/username routes yet).
 *
 * Ported from yap.pr's components/ui/markdown-content.tsx. Text is
 * rendered through React's escaping — no dangerouslySetInnerHTML, so
 * post content can never inject HTML.
 */
export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
    const tokens = useMemo(() => parseContent(content), [content])

    return (
        <span className={className}>
            {tokens.map((token, index) => renderToken(token, index))}
        </span>
    )
}

function parseContent(text: string): ParsedToken[] {
    const tokens: ParsedToken[] = []

    // Combined patterns for all token types. Order matters: more specific
    // patterns first.
    const patterns = [
        // Bold: **text**
        { regex: /\*\*([^*]+)\*\*/g, type: 'bold' as const },
        // Italic: *text* (but not **)
        { regex: /(?<!\*)\*([^*]+)\*(?!\*)/g, type: 'italic' as const },
        // Code: `text`
        { regex: /`([^`]+)`/g, type: 'code' as const },
        // URLs: http(s)://...
        { regex: /(https?:\/\/[^\s<>\[\]]+)/g, type: 'link' as const },
        // Mentions: @username
        { regex: /@([a-zA-Z0-9_-]+)/g, type: 'mention' as const },
        // Hashtags: #tag
        { regex: /#([a-zA-Z0-9_]+)/g, type: 'hashtag' as const },
        // Cashtags: $tag
        { regex: /\$([a-zA-Z0-9_]+)/g, type: 'cashtag' as const },
    ]

    interface Match {
        type: ParsedToken['type']
        start: number
        end: number
        fullMatch: string
        content: string
    }

    const allMatches: Match[] = []

    for (const { regex, type } of patterns) {
        let match
        const re = new RegExp(regex.source, regex.flags)
        while ((match = re.exec(text)) !== null) {
            allMatches.push({
                type,
                start: match.index,
                end: match.index + match[0].length,
                fullMatch: match[0],
                content: match[1] || match[0],
            })
        }
    }

    // Sort matches by start position
    allMatches.sort((a, b) => a.start - b.start)

    // Remove overlapping matches (keep the first one)
    const filteredMatches: Match[] = []
    let lastEnd = 0
    for (const match of allMatches) {
        if (match.start >= lastEnd) {
            filteredMatches.push(match)
            lastEnd = match.end
        }
    }

    // Build tokens
    let currentIndex = 0
    for (const match of filteredMatches) {
        // Add text before this match
        if (match.start > currentIndex) {
            const textContent = text.slice(currentIndex, match.start)
            if (textContent) {
                tokens.push({ type: 'text', content: textContent })
            }
        }

        if (match.type === 'link') {
            tokens.push({
                type: 'link',
                content: match.content,
                href: match.content,
            })
        } else {
            tokens.push({
                type: match.type,
                content: match.content,
                fullMatch: match.fullMatch,
            })
        }

        currentIndex = match.end
    }

    // Add remaining text
    if (currentIndex < text.length) {
        tokens.push({ type: 'text', content: text.slice(currentIndex) })
    }

    return tokens
}

function renderToken(token: ParsedToken, key: number): React.ReactNode {
    switch (token.type) {
        case 'bold':
            return (
                <strong key={key} className="font-semibold">
                    {token.content}
                </strong>
            )
        case 'italic':
            return (
                <em key={key} className="italic">
                    {token.content}
                </em>
            )
        case 'code':
            return (
                <code
                    key={key}
                    className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-pink-600 dark:text-pink-400"
                >
                    {token.content}
                </code>
            )
        case 'link':
            return (
                <a
                    key={key}
                    href={token.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-evonext-500 hover:underline break-all"
                    // Stop the click from bubbling to the card — a link click
                    // must open the URL, not the post details page.
                    onClick={(e) => e.stopPropagation()}
                >
                    {token.content}
                </a>
            )
        case 'mention':
        case 'hashtag':
        case 'cashtag':
            // Styled but not linked — EvoNext has no hashtag/username
            // routes yet.
            return (
                <span key={key} className="text-evonext-500">
                    {token.type === 'mention' ? `@${token.content}` : token.fullMatch}
                </span>
            )
        default:
            return <span key={key}>{token.content}</span>
    }
}
