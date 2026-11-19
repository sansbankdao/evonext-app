// test/unit/lib/session-lock-timer.test.mts
//
// F61 — the IDLE RE-LOCK regression tests (the fire path is not
// browser-verifiable in 15 minutes — fake timers pin the contract):
//   1. arming runs lockSession(identityId) after the idle window,
//   2. USER ACTIVITY pushes the deadline (no fire before it elapses),
//   3. disarming never fires,
//   4. re-arming for the SAME identity keeps the running deadline,
//   5. a LOGGED-OUT session (no id) never fires.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/session-unlock', () => ({
    lockSession: vi.fn(async () => {}),
}))

import { armIdleRelock, disarmIdleRelock, IDLE_RELOCK_MS } from '@/lib/session-lock-timer'
import { lockSession } from '@/lib/session-unlock'

const ID = 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa'

beforeEach(() => {
    vi.useFakeTimers()
    disarmIdleRelock()
    vi.clearAllMocks()
})

afterEach(() => {
    disarmIdleRelock()
    vi.useRealTimers()
})

describe('session-lock-timer: the idle re-lock (F61)', () => {
    it('fires lockSession(identityId) after the idle window', () => {
        armIdleRelock(ID)
        expect(lockSession).not.toHaveBeenCalled()
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 1000)
        expect(lockSession).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1500)
        expect(lockSession).toHaveBeenCalledTimes(1)
        expect(lockSession).toHaveBeenCalledWith(ID)
    })

    it('user activity pushes the deadline (pointerdown resets it)', () => {
        armIdleRelock(ID)
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 30_000)
        window.dispatchEvent(new Event('pointerdown'))
        /* 10 minutes after the ORIGINAL deadline would have passed — no
         * fire, because the activity pushed the deadline forward. */
        vi.advanceTimersByTime(10 * 60_000)
        expect(lockSession).not.toHaveBeenCalled()
        /* The pushed deadline elapses. */
        vi.advanceTimersByTime(5 * 60_000 + 2000)
        expect(lockSession).toHaveBeenCalledTimes(1)
    })

    it('keydown and wheel count as activity too', () => {
        armIdleRelock(ID)
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 30_000)
        window.dispatchEvent(new Event('keydown'))
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 30_000)
        window.dispatchEvent(new Event('wheel'))
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 30_000)
        expect(lockSession).not.toHaveBeenCalled()
        vi.advanceTimersByTime(31_000)
        expect(lockSession).toHaveBeenCalledTimes(1)
    })

    it('disarm never fires', () => {
        armIdleRelock(ID)
        disarmIdleRelock()
        vi.advanceTimersByTime(IDLE_RELOCK_MS * 10)
        expect(lockSession).not.toHaveBeenCalled()
    })

    it('re-arming for the SAME identity keeps the running deadline', () => {
        armIdleRelock(ID)
        vi.advanceTimersByTime(IDLE_RELOCK_MS - 5000)
        armIdleRelock(ID)
        /* If the re-arm had RESTARTED the deadline, this would not fire. */
        vi.advanceTimersByTime(5500)
        expect(lockSession).toHaveBeenCalledTimes(1)
    })

    it('a custom idle window is honored', () => {
        armIdleRelock(ID, 5000)
        vi.advanceTimersByTime(5100)
        expect(lockSession).toHaveBeenCalledTimes(1)
    })
})
