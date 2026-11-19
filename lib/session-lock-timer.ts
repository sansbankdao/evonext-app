// lib/session-lock-timer.ts
//
// F61 — the IDLE RE-LOCK (the B4 backlog, owner-approved): a wallet's key
// material must not sit in an unattended tab's memory forever. The timer
// is USER-ACTIVITY-based (pointer/keys/wheel/touch): any interaction
// pushes the deadline; the deadline expiring runs lockSession(identityId)
// — the SAME explicit lock the banner's 'Lock now' runs — which wipes the
// in-memory material and dispatches 'evonext:session-locked' (the open
// balance surfaces re-derive to their honest locked states, the mirror
// of the F57k unlock re-run).
//
// ARMED FROM THE SESSION-LOCK BANNER (the wallet page — the handoff's
// wiring; the banner owns the lock-state UI). The idle window is 15
// minutes: long enough to never interrupt an active send (the send's own
// closure holds its key material and completes), short enough that a
// forgotten tab re-locks.
//
// mousemove is deliberately NOT an activity event — it fires on every
// pixel and would churn the timer; pointerdown/keydown/wheel/touchstart
// cover real interaction. A 10s throttle caps the reset work anyway.

import { lockSession } from './session-unlock'

export const IDLE_RELOCK_MS = 15 * 60 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const RESET_THROTTLE_MS = 10_000

let timer: ReturnType<typeof setTimeout> | null = null
let armedFor: string | null = null
let idleMs = IDLE_RELOCK_MS
let lastReset = 0
let listening = false

function fire() {
    const id = armedFor
    disarmIdleRelock()
    if (id) void lockSession(id)
}

function resetDeadline() {
    const now = Date.now()
    if (now - lastReset < RESET_THROTTLE_MS) return
    lastReset = now
    if (timer) clearTimeout(timer)
    timer = setTimeout(fire, idleMs)
}

function onActivity() {
    if (timer) resetDeadline()
}

/** Arm (or re-arm) the idle re-lock for a session identity. Idempotent:
 * arming for the SAME identity keeps the running deadline; a different
 * identity restarts it. */
export function armIdleRelock(forIdentityId: string, ms: number = IDLE_RELOCK_MS): void {
    if (typeof window === 'undefined') return
    if (armedFor === forIdentityId && timer) {
        idleMs = ms
        return
    }
    armedFor = forIdentityId
    idleMs = ms
    if (!listening) {
        for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true })
        listening = true
    }
    lastReset = 0
    resetDeadline()
}

/** Disarm entirely (the session locked, logged out, or the banner went
 * away). Never throws from a cleanup path. */
export function disarmIdleRelock(): void {
    if (timer) { clearTimeout(timer); timer = null }
    armedFor = null
    if (listening && typeof window !== 'undefined') {
        for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
        listening = false
    }
}
