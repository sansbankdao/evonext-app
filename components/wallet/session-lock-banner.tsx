'use client'

// components/wallet/session-lock-banner.tsx
//
// F57b Option B — the SESSION-LOCK banner. After a reload the in-memory
// key material is GONE (the plaintext hole is closed — nothing rests in
// localStorage); the session vault re-materializes it with ONE passkey
// ceremony. The banner renders ONLY when locked:
//   'locked-vault'   → an Unlock button (one ceremony → everything back).
//   'locked-novault' → this device could not enroll (no PRF support or a
//                      declined ceremony) → the honest reconnect guidance.
// It NEVER renders while unlocked or logged out.

import { useCallback, useEffect, useState } from 'react'
import { LockClosedIcon, ShieldCheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import {
    getSessionLockState,
    unlockSession,
    enrollSessionKeysAfterLogin,
    type SessionLockState,
} from '@/lib/session-unlock'
import { showErrorToast } from '@/lib/toast-error'

export function SessionLockBanner() {
    const { user } = useAuth()
    const [state, setState] = useState<SessionLockState | null>(null)
    const [busy, setBusy] = useState(false)

    const check = useCallback(async () => {
        try {
            setState(await getSessionLockState(user?.identityId))
        } catch {
            setState(null)
        }
    }, [user?.identityId])

    useEffect(() => {
        void check()
    }, [check])

    const handleUnlock = async () => {
        if (!user?.identityId || busy) return
        setBusy(true)
        try {
            await unlockSession(user.identityId)
            toast.success('Session unlocked — your keys are back.')
            await check()
        } catch (e: any) {
            showErrorToast(e?.message || 'Unlock failed — reconnect with your recovery phrase or key instead.')
        } finally {
            setBusy(false)
        }
    }

    /* F57b Option B — the enroll is USER-INITIATED (a WebAuthn ceremony
     * must never run silently inside login(): in authenticator-less
     * browsers the create hangs — the live-hit that moved the enroll out
     * of login() into this explicit button). */
    const handleEnroll = async () => {
        if (!user?.identityId || busy) return
        setBusy(true)
        try {
            const ok = await enrollSessionKeysAfterLogin(user.identityId, user.dpnsUsername)
            if (ok) {
                toast.success('Biometric unlock enabled — your keys re-lock on every reload.')
                await check()
            } else {
                showErrorToast('This device could not enroll the session vault — your keys stay in this browser session only.')
            }
        } catch (e: any) {
            showErrorToast(e?.message || 'Enrollment failed — your keys stay in this browser session only.')
        } finally {
            setBusy(false)
        }
    }

    if (!state || state === 'nologin' || state === 'unlocked') return null

    if (state === 'unlocked-novault') {
        return (
            <div className="mb-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-4 flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sky-900 dark:text-sky-200">
                        Enable biometric unlock?
                    </p>
                    <p className="text-xs text-sky-800 dark:text-sky-300 mt-0.5">
                        Your keys currently live in this browser session only. Enroll them in the passkey vault and they re-lock on every reload — one biometric prompt brings them back.
                    </p>
                </div>
                <button
                    onClick={handleEnroll}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                >
                    {busy
                        ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Working…</>
                        : <><ShieldCheckIcon className="h-4 w-4" /> Enable</>}
                </button>
            </div>
        )
    }

    return (
        <div className="mb-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center gap-3">
            <LockClosedIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            {state === 'locked-vault' ? (
                <>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Session locked — your keys are safe.
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            Unlock with your device&apos;s biometrics to enable sends and the seed-derived balances.
                        </p>
                    </div>
                    <button
                        onClick={handleUnlock}
                        disabled={busy}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                    >
                        {busy
                            ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Unlocking…</>
                            : <><LockClosedIcon className="h-4 w-4" /> Unlock</>}
                    </button>
                </>
            ) : (
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        Keys not in this session — reconnect to enable sends.
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        This device could not enroll the session vault (no passkey/PRF support or the ceremony was declined). Your balances still load; reconnect with your recovery phrase or key to sign.
                    </p>
                </div>
            )}
        </div>
    )
}
