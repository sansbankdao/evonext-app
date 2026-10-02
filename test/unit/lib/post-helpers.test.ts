// test/unit/lib/post-helpers.test.ts

import { describe, it, expect } from 'vitest'
import {
    identityIdToBytes,
    createPostDocument,
    extractHashtags,
    extractMentions,
    validatePost,
} from '@/lib/post-helpers'
import type { AuthUser } from '@/contexts/auth-context'

describe('lib/post-helpers', () => {
    describe('identityIdToBytes', () => {
        it('returns a 32-byte array', () => {
            const bytes = identityIdToBytes('abc')

            expect(bytes).toBeInstanceOf(Uint8Array)
            expect(bytes.length).toBe(32)
        })

        it('encodes the identity characters as char codes', () => {
            const bytes = identityIdToBytes('AB')

            expect(bytes[0]).toBe('A'.charCodeAt(0))
            expect(bytes[1]).toBe('B'.charCodeAt(0))
            expect(bytes[2]).toBe(0)
        })

        it('truncates input longer than 32 characters', () => {
            const long = 'x'.repeat(40)
            const bytes = identityIdToBytes(long)

            expect(bytes.length).toBe(32)
            expect(Array.from(bytes).every(b => b === 'x'.charCodeAt(0))).toBe(true)
        })
    })

    describe('createPostDocument', () => {
        const user = { identityId: 'test-identity-123' } as AuthUser

        it('always trims content and sets the author id', () => {
            const post = createPostDocument(user, '  hello world  ')

            expect(post.content).toBe('hello world')
            expect(post.authorId).toEqual(identityIdToBytes('test-identity-123'))
        })

        it('omits optional fields when not provided', () => {
            const post = createPostDocument(user, 'plain')

            expect(post).not.toHaveProperty('mediaUrl')
            expect(post).not.toHaveProperty('replyToPostId')
            expect(post).not.toHaveProperty('quotedPostId')
            expect(post).not.toHaveProperty('firstMentionId')
            expect(post).not.toHaveProperty('primaryHashtag')
            expect(post).not.toHaveProperty('language')
            expect(post).not.toHaveProperty('isSensitive')
        })

        it('passes through mediaUrl, language and isSensitive', () => {
            const post = createPostDocument(user, 'x', undefined, {
                mediaUrl: 'https://example.com/a.png',
                language: 'en',
                isSensitive: true,
            })

            expect(post.mediaUrl).toBe('https://example.com/a.png')
            expect(post.language).toBe('en')
            expect(post.isSensitive).toBe(true)
        })

        it('converts reply/quoted/mention ids to bytes', () => {
            const post = createPostDocument(user, 'x', undefined, {
                replyToPostId: 'parent',
                quotedPostId: 'quoted',
                firstMentionId: 'mention',
            })

            expect(post.replyToPostId).toEqual(identityIdToBytes('parent'))
            expect(post.quotedPostId).toEqual(identityIdToBytes('quoted'))
            expect(post.firstMentionId).toEqual(identityIdToBytes('mention'))
        })

        it('strips a leading # from primaryHashtag', () => {
            const post = createPostDocument(user, 'x', undefined, { primaryHashtag: '#evonext' })

            expect(post.primaryHashtag).toBe('evonext')
        })

        it('respects isSensitive=false (defined value)', () => {
            const post = createPostDocument(user, 'x', undefined, { isSensitive: false })

            expect(post.isSensitive).toBe(false)
        })
    })

    describe('extractHashtags', () => {
        it('extracts hashtags without the # prefix', () => {
            expect(extractHashtags('hi #one and #two')).toEqual(['one', 'two'])
        })

        it('returns an empty array when none are present', () => {
            expect(extractHashtags('no tags here')).toEqual([])
        })

        it('supports underscores and digits', () => {
            expect(extractHashtags('#abc_123')).toEqual(['abc_123'])
        })
    })

    describe('extractMentions', () => {
        it('extracts mentions without the @ prefix', () => {
            expect(extractMentions('hey @alice and @bob')).toEqual(['alice', 'bob'])
        })

        it('returns an empty array when none are present', () => {
            expect(extractMentions('nothing here')).toEqual([])
        })
    })

    describe('validatePost', () => {
        it('rejects empty and whitespace-only content', () => {
            expect(validatePost('')).toEqual({ valid: false, error: 'Post content cannot be empty' })
            expect(validatePost('    ')).toEqual({ valid: false, error: 'Post content cannot be empty' })
        })

        it('rejects content longer than 500 characters', () => {
            const result = validatePost('a'.repeat(501))

            expect(result).toEqual({ valid: false, error: 'Post content cannot exceed 500 characters' })
        })

        it('accepts content at exactly 500 characters', () => {
            expect(validatePost('a'.repeat(500))).toEqual({ valid: true })
        })

        it('accepts ordinary content', () => {
            expect(validatePost('hello')).toEqual({ valid: true })
        })
    })
})
