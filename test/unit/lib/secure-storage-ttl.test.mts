// F57f — the mid-session TTL eviction regression (the owner live-hit):
// a WIF stored in the session must NOT be silently evicted by a timer
// while the tab lives. The boundaries = the unload/pagehide wipe + the
// vault; the deliberate 'Lock now' (B4) = the visible re-lock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { storePrivateKey, getPrivateKey, clearAllPrivateKeys } from '../../../lib/secure-storage'

const ID = 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa'

describe('the secure storage: no mid-session TTL eviction (F57f)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        clearAllPrivateKeys()
    })
    afterEach(() => {
        vi.useRealTimers()
        clearAllPrivateKeys()
    })

    it('the WIF survives far beyond the old 1-hour default (the owner live-hit)', () => {
        storePrivateKey(ID, 'L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        /* The old default = 3600000ms. Walk past it by hours. */
        vi.advanceTimersByTime(5 * 3600000)
        expect(getPrivateKey(ID)).toBe('L1aW4Ub8XkzTestWifMaterialNotReal0000000')
    })

    it('an EXPLICIT ttlMs argument is accepted for API compat and ignored', () => {
        storePrivateKey(ID, 'L1aW4Ub8XkzTestWifMaterialNotReal0000000', 3600000)
        vi.advanceTimersByTime(3 * 3600000)
        expect(getPrivateKey(ID)).not.toBeNull()
    })

    it('the explicit clear still works (the manual lock path)', () => {
        storePrivateKey(ID, 'L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        vi.advanceTimersByTime(3600000)
        expect(getPrivateKey(ID)).not.toBeNull()
        clearAllPrivateKeys()
        expect(getPrivateKey(ID)).toBeNull()
    })
})
