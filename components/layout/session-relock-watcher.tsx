'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getSessionLockInfo } from '@/lib/session-unlock'
import { armIdleRelock, disarmIdleRelock } from '@/lib/session-lock-timer'

/* F61b — the IDLE RE-LOCK is APP-WIDE, not wallet-page-scoped.
 *
 * F61 armed the 15-minute idle timer from the session-lock banner, and
 * the banner is mounted ONLY on /wallet — so on /posts, /profile or any
 * other page the unlocked keys stayed hot in memory INDEFINITELY (until
 * the tab closed), which silently defeated the re-lock. This watcher is
 * mounted once in Providers (inside AuthProvider) and owns the timer for
 * the whole app: while the session has key material it arms the
 * activity-based timer (any pointer/key/wheel/touch pushes the deadline;
 * IDLE_RELOCK_MS of quiet runs lockSession — which dispatches
 * `evonext:session-locked`, the same event every balance surface already
 * listens to). Locked, unlocked-again and logout transitions all flow
 * through the material check, so no page needs to know the timer exists.
 *
 * The banner keeps its visible "Lock now" control and lock-state UI but
 * no longer touches the timer (its old on-unmount disarm would have
 * killed the app-wide timer on every navigation away from /wallet). */
export function SessionRelockWatcher() {
    const { user } = useAuth()
    const identityId = user?.identityId ?? null

    useEffect(() => {
        let cancelled = false
        const reevaluate = async () => {
            if (!identityId) {
                disarmIdleRelock()
                return
            }
            try {
                const info = await getSessionLockInfo(identityId)
                if (cancelled) return
                if (info?.material) armIdleRelock(identityId)
                else disarmIdleRelock()
            } catch {
                if (!cancelled) disarmIdleRelock()
            }
        }
        void reevaluate()

        const onUnlocked = () => { void reevaluate() }
        const onLocked = () => { disarmIdleRelock() }
        window.addEventListener('evonext:session-unlocked', onUnlocked)
        window.addEventListener('evonext:session-locked', onLocked)
        return () => {
            cancelled = true
            window.removeEventListener('evonext:session-unlocked', onUnlocked)
            window.removeEventListener('evonext:session-locked', onLocked)
            disarmIdleRelock()
        }
    }, [identityId])

    return null
}
