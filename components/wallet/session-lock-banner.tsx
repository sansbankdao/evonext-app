'use client'

// components/wallet/session-lock-banner.tsx
//
// F57b/F57e — the SESSION-LOCK banner, the tiered persistence ladder:
//   LOCKED (the memory empty after a reload):
//     - a PRF vault exists  → the Unlock button (one passkey ceremony)
//     - a password vault exists → the unlock-password field (one prompt)
//     - neither → the honest reconnect guidance
//   UNLOCKED (the memory hot):
//     - no PRF vault + the platform authenticator available → the PRF
//       enroll OFFER (USER-INITIATED — a WebAuthn ceremony must never run
//       silently inside login(): the live-hit that moved it here)
//     - no password vault → the "Set an unlock password" offer (the
//       UNIVERSAL tier — the owner's directive: secrets persist across
//       sessions on EVERY desktop, safely)
//     - the password vault stale (the keys changed since the last save)
//       → the re-save nudge
//   UNLOCKED (always, F61): a slim lock bar — 'Lock now' + the idle
//     re-lock note (the keys auto-lock after 15 idle minutes; the timer
//     lives in lib/session-lock-timer.ts, armed while this banner
//     renders with hot material).
// It NEVER renders while logged out.

import { useCallback, useEffect, useState } from 'react'
import { LockClosedIcon, LockOpenIcon, ShieldCheckIcon, ArrowPathIcon, KeyIcon } from '@heroicons/react/24/outline'
import { useNetwork } from '@/contexts/network-context'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import {
    getSessionLockInfo,
    lockSession,
    unlockSession,
    unlockSessionWithPassword,
    enrollSessionKeysAfterLogin,
    setSessionUnlockPassword,
    upgradeSessionWithMnemonic,
    type SessionLockInfo,
} from '@/lib/session-unlock'
import { armIdleRelock, disarmIdleRelock, IDLE_RELOCK_MS } from '@/lib/session-lock-timer'
import { showErrorToast } from '@/lib/toast-error'

export function SessionLockBanner() {
    const { user } = useAuth()
    const { network } = useNetwork()
    const [info, setInfo] = useState<SessionLockInfo | null>(null)
    const [busy, setBusy] = useState(false)
    const [password, setPassword] = useState('')
    const [settingPassword, setSettingPassword] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    /* F57j.3 — the WIF-only seed upgrade: the pasted recovery phrase. */
    const [phraseInput, setPhraseInput] = useState('')
    /* The PRF enroll offer renders ONLY where a platform authenticator
     * exists (the F27c gate — on Linux/Brave isUVPAA = false, so the
     * offer is hidden instead of failing on every click). */
    const [uvpaa, setUvpaa] = useState<boolean | null>(null)

    const check = useCallback(async () => {
        try {
            setInfo(await getSessionLockInfo(user?.identityId))
        } catch {
            setInfo(null)
        }
    }, [user?.identityId])

    /* F61 — revalidate on ANY material change, not just the ones this
     * banner itself performs: the idle re-lock fires from the timer
     * module (which dispatches 'evonext:session-locked') and the unlock
     * paths dispatch 'evonext:session-unlocked' — the banner must reflect
     * reality without waiting for its next action. */
    useEffect(() => {
        const revalidate = () => { void check() }
        window.addEventListener('evonext:session-locked', revalidate)
        window.addEventListener('evonext:session-unlocked', revalidate)
        return () => {
            window.removeEventListener('evonext:session-locked', revalidate)
            window.removeEventListener('evonext:session-unlocked', revalidate)
        }
    }, [check])

    /* F61 — the IDLE RE-LOCK: while the material is hot, arm the
     * activity-based timer (any pointer/key/wheel/touch pushes the
     * deadline; IDLE_RELOCK_MS of quiet runs lockSession). Locked or
     * logged out → disarm. Unmounting the banner disarms too (the timer
     * lives with the lock-state UI). */
    useEffect(() => {
        if (user?.identityId && info?.material) armIdleRelock(user.identityId)
        else disarmIdleRelock()
        return () => { disarmIdleRelock() }
    }, [user?.identityId, info?.material])

    /* F61 — the explicit lock (the visible re-lock control). Wipes the
     * in-memory material (lockSession) — the banner then renders the
     * locked ladder (the revalidate listener above re-checks). */
    const handleLockNow = async () => {
        if (!user?.identityId || busy) return
        setBusy(true)
        try {
            await lockSession(user.identityId)
            toast.success('Session locked — unlock above to sign again.')
            await check()
        } catch (e: any) {
            showErrorToast(e?.message || 'Could not lock the session.')
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        void check()
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(setUvpaa)
                .catch(() => setUvpaa(false))
        } else {
            setUvpaa(false)
        }
    }, [check])

    const handleUnlockPrf = async () => {
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

    const handleUnlockPassword = async () => {
        if (!user?.identityId || busy || !password) return
        setBusy(true)
        try {
            await unlockSessionWithPassword(user.identityId, password)
            toast.success('Session unlocked — your keys are back.')
            setPassword('')
            await check()
        } catch (e: any) {
            showErrorToast(e?.message || 'Wrong unlock password.')
        } finally {
            setBusy(false)
        }
    }

    /* F57b — the enroll is USER-INITIATED (a WebAuthn ceremony must never
     * run silently inside login(): in authenticator-less browsers the
     * create hangs — the live-hit that moved the enroll here). */
    const handleEnrollPrf = async () => {
        if (!user?.identityId || busy) return
        setBusy(true)
        try {
            const ok = await enrollSessionKeysAfterLogin(user.identityId, user.dpnsUsername)
            if (ok) {
                toast.success('Biometric unlock enabled — your keys re-lock on every reload.')
                await check()
            } else {
                showErrorToast('This device could not enroll the session vault — set an unlock password instead.')
            }
        } catch (e: any) {
            showErrorToast(e?.message || 'Enrollment failed — set an unlock password instead.')
        } finally {
            setBusy(false)
        }
    }

    /* F57j.3 — the in-place seed upgrade for a WIF-only session: the
     * memory holds the WIF, NO mnemonic, so neither unlock tier can ever
     * produce the seed-derived features. The user pastes the phrase; it
     * is validated against this identity and stored in the session
     * memory (never logged). */
    const handleAddPhrase = async () => {
        if (!user?.identityId || busy || !phraseInput.trim()) return
        setBusy(true)
        try {
            await upgradeSessionWithMnemonic(phraseInput, network === 'mainnet' ? 'mainnet' : 'testnet', user.identityId)
            toast.success('Recovery phrase added — the seed features are back.')
            setPhraseInput('')
            await check()
        } catch (e: any) {
            showErrorToast(e?.message || 'Could not verify that phrase.')
        } finally {
            setBusy(false)
        }
    }

    const handleSetPassword = async () => {
        if (!user?.identityId || busy) return
        if (newPassword !== confirmPassword) {
            showErrorToast('The two passwords do not match.')
            return
        }
        setBusy(true)
        try {
            const ok = await setSessionUnlockPassword(user.identityId, newPassword)
            if (ok) {
                toast.success('Unlock password set — your keys persist across reloads on this device.')
                setNewPassword('')
                setConfirmPassword('')
                setSettingPassword(false)
                await check()
            }
        } catch (e: any) {
            showErrorToast(e?.message || 'Could not set the unlock password.')
        } finally {
            setBusy(false)
        }
    }

    if (!user?.identityId || !info) return null

    /* LOCKED — the material is gone; re-materialize via a tier. */
    if (!info.material) {
        if (!info.prfVault && !info.pwVault) {
            return (
                <div className="mb-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center gap-3">
                    <LockClosedIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Keys not in this session — reconnect to enable sends.
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            No unlock vault is set up on this device yet. Your balances still load; reconnect with your recovery phrase or key to sign — then set an unlock password here so future reloads unlock with one password.
                        </p>
                    </div>
                </div>
            )
        }
        return (
            <div className="mb-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
                <div className="flex items-center gap-3">
                    <LockClosedIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Session locked — your keys are safe.
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            Unlock to enable sends and the seed-derived balances.
                        </p>
                    </div>
                </div>
                <div className="mt-3 space-y-2">
                    {info.prfVault && (
                        <button
                            onClick={handleUnlockPrf}
                            disabled={busy}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                        >
                            {busy
                                ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Unlocking…</>
                                : <><ShieldCheckIcon className="h-4 w-4" /> Unlock with biometrics</>}
                        </button>
                    )}
                    {info.pwVault && (
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleUnlockPassword() }}
                                placeholder="Device unlock password"
                                autoComplete="current-password"
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-amber-300 dark:border-amber-800 rounded-lg text-sm"
                            />
                            <button
                                onClick={handleUnlockPassword}
                                disabled={busy || !password}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                            >
                                {busy ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Unlocking…</> : <><KeyIcon className="h-4 w-4" /> Unlock</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    /* UNLOCKED — the slim lock bar ('Lock now' + the idle re-lock note,
     * F61 — renders whenever the material is hot, even with no offers
     * pending: the banner used to return null when fully enrolled and
     * unlocked, which left NO visible re-lock control), the WIF-only seed
     * upgrade + the enroll/stale offers. F57j.3: material WITHOUT a
     * mnemonic = a private-key session — the receive tiles said 'unlock
     * above' while there was nothing above to unlock. */
    const needsSeed = info.material && !info.hasMnemonic
    const prfOffer = !info.prfVault && uvpaa === true
    const pwOffer = !info.pwVault || info.pwStale

    return (<>
        <div className="mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 flex items-center gap-3">
            <LockOpenIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    Session unlocked
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Your keys live in this tab&apos;s memory only — auto-locks after {Math.round(IDLE_RELOCK_MS / 60000)} minutes idle.
                </p>
            </div>
            <button
                onClick={handleLockNow}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 disabled:opacity-60 text-emerald-800 dark:text-emerald-300 text-sm font-semibold"
            >
                {busy ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Locking…</> : <><LockClosedIcon className="h-4 w-4" /> Lock now</>}
            </button>
        </div>
        {needsSeed && (
            <div className="mb-4 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
                <div className="flex items-center gap-3">
                    <KeyIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Private-key session — add your recovery phrase for the seed features
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                            The Transparent and Shielded receive addresses (and the shielded balance and sends) derive from your recovery phrase. Your keys live ONLY in this tab&apos;s memory — a reload discards them, and the current unlock chain holds just the private key. Paste the phrase ONCE below (validated against this identity, never leaves the device), then save it to the unlock vault in the card below — after that, one password brings everything back on every reload and we never ask again.
                        </p>
                    </div>
                </div>
                <div className="mt-3 space-y-2">
                    <textarea
                        value={phraseInput}
                        onChange={(e) => setPhraseInput(e.target.value)}
                        rows={2}
                        placeholder="your 12 or 24 recovery words"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-amber-300 dark:border-amber-800 rounded-lg text-sm"
                    />
                    <button
                        onClick={handleAddPhrase}
                        disabled={busy || !phraseInput.trim()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                    >
                        {busy ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Verifying…</> : <><KeyIcon className="h-4 w-4" /> Add recovery phrase</>}
                    </button>
                </div>
            </div>
        )}
        {(prfOffer || pwOffer) && (
        <div className="mb-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-4">
            <div className="flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sky-900 dark:text-sky-200">
                        {info.pwStale ? 'Your key set changed — update the unlock vault' : 'Keep your keys across reloads — safely'}
                    </p>
                    <p className="text-xs text-sky-800 dark:text-sky-300 mt-0.5">
                        Set a device unlock password (works everywhere — the keys are stored as ciphertext only), and/or enroll biometric unlock if this device has a passkey authenticator.
                    </p>
                </div>
            </div>
            <div className="mt-3 space-y-3">
                {pwOffer && (settingPassword ? (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New unlock password (10+ characters)"
                                autoComplete="new-password"
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-sky-300 dark:border-sky-800 rounded-lg text-sm"
                            />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat it"
                                autoComplete="new-password"
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-sky-300 dark:border-sky-800 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSetPassword}
                                disabled={busy || newPassword.length < 10 || newPassword !== confirmPassword}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm"
                            >
                                {busy ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Saving…</> : <><KeyIcon className="h-4 w-4" /> Save to this device</>}
                            </button>
                            <button
                                onClick={() => { setSettingPassword(false); setNewPassword(''); setConfirmPassword('') }}
                                className="px-3 py-2 rounded-lg text-sm text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950"
                            >
                                Cancel
                            </button>
                        </div>
                        <p className="text-xs text-sky-700 dark:text-sky-400">
                            The password is never stored — it protects the ciphertext on this device. Make it strong; it can be changed anytime from here.
                        </p>
                    </div>
                ) : (
                    <button
                        onClick={() => setSettingPassword(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold shadow-sm"
                    >
                        <KeyIcon className="h-4 w-4" /> {info.pwVault ? 'Update the unlock password vault' : 'Set an unlock password'}
                    </button>
                ))}
                {prfOffer && (
                    <button
                        onClick={handleEnrollPrf}
                        disabled={busy}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-950 disabled:opacity-60 text-sky-700 dark:text-sky-300 text-sm font-semibold"
                    >
                        {busy ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Working…</> : <><ShieldCheckIcon className="h-4 w-4" /> Enroll biometric unlock (passkey)</>}
                    </button>
                )}
            </div>
        </div>
        )}
        </>
    )
}
