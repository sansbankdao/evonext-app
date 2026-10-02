// test/unit/lib/utils.test.ts

import { describe, it, expect } from 'vitest'
import { cn, formatTime, formatNumber, getInitials } from '@/lib/utils'

describe('lib/utils', () => {
    describe('cn', () => {
        it('merges class names and resolves Tailwind conflicts (last wins)', () => {
            expect(cn('px-2', 'px-4')).toBe('px-4')
        })

        it('ignores falsy inputs', () => {
            expect(cn('text-sm', false, null, undefined, '', 'font-bold')).toBe('text-sm font-bold')
        })

        it('accepts conditional object syntax via clsx', () => {
            expect(cn('base', { active: true, hidden: false })).toBe('base active')
        })
    })

    describe('formatTime', () => {
        it('returns empty string for falsy input', () => {
            expect(formatTime('')).toBe('')
        })

        it('formats seconds ago (singular and plural)', () => {
            const now = Date.now()

            expect(formatTime(new Date(now - 1000))).toBe('1 second ago')
            expect(formatTime(new Date(now - 30000))).toBe('30 seconds ago')
        })

        it('formats minutes ago (singular and plural)', () => {
            const now = Date.now()

            expect(formatTime(new Date(now - 60000))).toBe('1 minute ago')
            expect(formatTime(new Date(now - 5 * 60000))).toBe('5 minutes ago')
        })

        it('formats hours ago (singular and plural)', () => {
            const now = Date.now()

            expect(formatTime(new Date(now - 3600000))).toBe('1 hour ago')
            expect(formatTime(new Date(now - 3 * 3600000))).toBe('3 hours ago')
        })

        it('formats days ago (singular and plural)', () => {
            const now = Date.now()

            expect(formatTime(new Date(now - 86400000))).toBe('1 day ago')
            expect(formatTime(new Date(now - 3 * 86400000))).toBe('3 days ago')
        })

        it('falls back to a localized date beyond one week', () => {
            const now = Date.now()
            const old = new Date(now - 8 * 86400000)

            // Source: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric',
            // year: same-year ? undefined : 'numeric' }). Same year -> no year.
            expect(formatTime(old)).toBe(old.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: undefined,
            }))
        })

        it('accepts a string date and parses it', () => {
            const now = Date.now()
            const iso = new Date(now - 30000).toISOString()

            expect(formatTime(iso)).toBe('30 seconds ago')
        })
    })

    describe('formatNumber', () => {
        it('returns the raw number below 1000', () => {
            expect(formatNumber(0)).toBe('0')
            expect(formatNumber(999)).toBe('999')
        })

        it('formats thousands with a K suffix (1 decimal)', () => {
            expect(formatNumber(1000)).toBe('1.0K')
            expect(formatNumber(1500)).toBe('1.5K')
            expect(formatNumber(999999)).toBe('1000.0K')
        })

        it('formats millions with an M suffix (1 decimal)', () => {
            expect(formatNumber(1000000)).toBe('1.0M')
            expect(formatNumber(2500000)).toBe('2.5M')
        })
    })

    describe('getInitials', () => {
        it('takes the first letter of each word, uppercased', () => {
            expect(getInitials('jane doe')).toBe('JD')
        })

        it('caps the result at two characters', () => {
            expect(getInitials('one two three four')).toBe('OT')
        })

        it('handles a single word', () => {
            expect(getInitials('satoshi')).toBe('S')
        })
    })
})
