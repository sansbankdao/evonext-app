// test/unit/lib/cache-manager.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheManager } from '@/lib/cache-manager'

describe('lib/cache-manager', () => {
    let cache: CacheManager

    beforeEach(() => {
        // Source constructor calls startCleanup() (setInterval). Default ttl 5min.
        cache = new CacheManager(300000)
    })

    afterEach(() => {
        // Stop the interval so the test process can exit cleanly.
        cache.stopCleanup()
        vi.useRealTimers()
    })

    it('stores and retrieves a value', () => {
        cache.set('names', 'k1', { value: 42 })

        expect(cache.get('names', 'k1')).toEqual({ value: 42 })
    })

    it('returns null for a missing key', () => {
        expect(cache.get('names', 'missing')).toBeNull()
    })

    it('reports has() correctly for present and missing keys', () => {
        cache.set('names', 'k1', 'v')

        expect(cache.has('names', 'k1')).toBe(true)
        expect(cache.has('names', 'nope')).toBe(false)
    })

    it('expires entries after their ttl', () => {
        vi.useFakeTimers()

        const shortLived = new CacheManager(1000)

        shortLived.set('c', 'k', 'v')
        expect(shortLived.get('c', 'k')).toBe('v')

        vi.advanceTimersByTime(1500)
        expect(shortLived.get('c', 'k')).toBeNull()

        shortLived.stopCleanup()
    })

    it('honours a per-entry ttl override', () => {
        vi.useFakeTimers()

        const longDefault = new CacheManager(60000)

        longDefault.set('c', 'short', 'v', { ttl: 1000 })
        vi.advanceTimersByTime(2000)

        expect(longDefault.get('c', 'short')).toBeNull()

        longDefault.stopCleanup()
    })

    it('deletes a specific entry', () => {
        cache.set('c', 'k', 'v')

        expect(cache.delete('c', 'k')).toBe(true)
        expect(cache.get('c', 'k')).toBeNull()
        expect(cache.delete('c', 'k')).toBe(false)
    })

    it('clears an entire named cache', () => {
        cache.set('c', 'a', 1)
        cache.set('c', 'b', 2)
        cache.clear('c')

        expect(cache.get('c', 'a')).toBeNull()
        expect(cache.get('c', 'b')).toBeNull()
    })

    it('invalidates entries by tag', () => {
        cache.set('posts', 'p1', 'one', { tags: ['feed'] })
        cache.set('posts', 'p2', 'two', { tags: ['feed'] })
        cache.set('posts', 'p3', 'three', { tags: ['other'] })

        const invalidated = cache.invalidateByTag('feed')

        expect(invalidated).toBe(2)
        expect(cache.get('posts', 'p1')).toBeNull()
        expect(cache.get('posts', 'p2')).toBeNull()
        expect(cache.get('posts', 'p3')).toBe('three')
    })

    it('returns 0 when invalidating an unknown tag', () => {
        expect(cache.invalidateByTag('does-not-exist')).toBe(0)
    })

    it('invalidates multiple tags', () => {
        cache.set('c', 'a', 1, { tags: ['t1'] })
        cache.set('c', 'b', 2, { tags: ['t2'] })

        expect(cache.invalidateByTags(['t1', 't2'])).toBe(2)
    })

    it('reports stats for all caches and a single cache', () => {
        cache.set('one', 'a', 1)
        cache.set('two', 'b', 2)

        const all = cache.getStats()

        expect(all.caches.sort()).toEqual(['one', 'two'])
        expect(all.totalEntries).toBe(2)
        expect(all.cacheDetails).toBeDefined()

        const one = cache.getStats('one')

        expect(one.totalEntries).toBe(1)
        expect(one.cacheDetails).toBeUndefined()
    })

    it('cleanup() removes expired entries and returns the count', () => {
        vi.useFakeTimers()

        const c = new CacheManager(1000)

        c.set('x', 'a', 1)
        c.set('x', 'b', 2)
        vi.advanceTimersByTime(1500)

        expect(c.cleanup()).toBe(2)

        c.stopCleanup()
    })

    it('clearAll() empties every cache', () => {
        cache.set('a', 'k', 1)
        cache.set('b', 'k', 2)
        cache.clearAll()

        expect(cache.getStats().totalEntries).toBe(0)
    })
})
