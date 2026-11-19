'use client'

import { ChangeEvent, useState, useEffect, ClipboardEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { Button } from '@/components/ui/button'
import { RegistrarModal } from '@/components/id/registrar-modal'
import { useRouter } from 'next/navigation'
import { showErrorToast } from '@/lib/toast-error'
/* F63b — the PURE-JS BIP39 validation (the F57j.5 precedent): the
 * previous wasm `validate_mnemonic` crashed with the exact
 * "reading '__wbindgen_malloc'" glue-before-load class — the F56g guard
 * gates the SUBMIT button but NOT the paste handler (and the paste
 * path predates the engine finishing its up-to-60s init). isValidPhrase
 * (lib/mnemonic-diagnostics) composes normalizePhrase + the @scure
 * validate — pure JS, the SAME wordlist the diagnostics classify with,
 * and the EXACT chain the regression suite pins. */
import { isValidPhrase } from '@/lib/mnemonic-diagnostics'
import { getNetwork } from '@/lib/network'

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const { network } = useNetwork()
    const [privateKey, setPrivateKey] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isResuming, setIsResuming] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [hasIdentityPrivateKey, setHasIdentityPrivateKey] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mnemonic, setMnemonic] = useState(Array(12).fill(''))
    /* Passkey (WebAuthn PRF) state — passkeyWords non-null shows the
       12-word backup gate for passkey-created identities. */
    const [passkeyWords, setPasskeyWords] = useState<string[] | null>(null)
    const [isPasskeyBusy, setIsPasskeyBusy] = useState(false)
    const [passkeySupported, setPasskeySupported] = useState(true)

    /* F56g — THE WASM ENGINE INIT ON MOUNT. The connect page is the ONE page
     * that never initialized the wasm up front, so EVERY first-glue consumer
     * on it (the private-key fromWIF decode, the mnemonic-flow key
     * derivation) could crash with the "reading '__wbindgen_malloc'" /
     * "reading 'wasmsdk_deriveKeyFromSeedWithPath'" class of errors when the
     * load hadn't finished. Initialize on mount (the single-flight service
     * init, retried internally) and keep the Sign In button honest until
     * ready. F63b: the mnemonic VALIDATION itself is now pure JS (@scure)
     * and EVERY handleMnemonic entry point guards on engineReady — the
     * F56g button gate alone missed the paste handler (the owner's live
     * crash). */
    const [engineReady, setEngineReady] = useState(false)
    const [engineError, setEngineError] = useState<string | null>(null)
    const [engineRetryNonce, setEngineRetryNonce] = useState(0)
    useEffect(() => {
        /* F57 Phase 1 fix: the engine's network comes from the
         * SYNCHRONOUS host switch (lib/network getNetwork) — useNetwork's
         * state starts 'testnet' and only flips to 'mainnet' in the
         * provider's effect, which runs AFTER this page's effect; the
         * first init would otherwise build the TESTNET SDK on production
         * and the login search would miss every mainnet identity (live
         * hit 2026-11-16). */
        const sdkNetwork = getNetwork() as 'mainnet' | 'testnet'
        let cancelled = false
        void (async () => {
            setEngineError(null)
            try {
                const { wasmSdkService } = await import('@/lib/services/wasm-sdk-service')
                const { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } = await import('@/lib/constants')
                /* F57e — bound the WHOLE init: a hung wasm fetch (the F30
                 * gotcha — the future never settles) would otherwise leave
                 * the Sign In button disabled FOREVER with no way out. The
                 * deadline converts the hang into the Retry control. */
                const deadline = new Promise((_, reject) => setTimeout(
                    () => reject(new Error('wallet engine load timed out')), 60_000))
                await Promise.race([wasmSdkService.initialize({
                    network: sdkNetwork,
                    contractId: sdkNetwork === 'mainnet'
                        ? EVONEXT_CONTRACT_ID_MAINNET
                        : EVONEXT_CONTRACT_ID_TESTNET,
                }), deadline])
                if (!cancelled) setEngineReady(true)
            } catch (err: any) {
                console.error('connect-page wasm init failed:', err?.message)
                if (!cancelled) {
                    setEngineError((err && typeof err.message === 'string' && err.message)
                        || 'wallet engine failed to load')
                }
            }
        })()
        return () => { cancelled = true }
    }, [network, engineRetryNonce])

    /* F57e — the RETRY path: reset the service's hung-init flags (a hung
     * fetch pins _isInitializing/initPromise/wasmInitPromise forever; every
     * naive retry would re-await the same hung promise), then re-run the
     * bounded init via the nonce. */
    const handleEngineRetry = () => {
        void (async () => {
            try {
                const { wasmSdkService } = await import('@/lib/services/wasm-sdk-service')
                wasmSdkService.resetInitForRetry()
            } catch { /* the init effect surfaces errors */ }
            setEngineRetryNonce((n) => n + 1)
        })()
    }


    /* Hide the passkey buttons when no platform authenticator exists. */
    useEffect(() => {
        import('@/lib/passkey-vault')
            .then(({ isPasskeyAvailable }) => isPasskeyAvailable())
            .then(setPasskeySupported)
            .catch(() => setPasskeySupported(false))
    }, [])

    const handleClose = () => {
        setIsModalOpen(false)
        // Navigate to profile creation without username
        // router.push('/profile/create')
    }

    const hasMnemonic = () => {
        /* Search for empty seed words. */
        const found = mnemonic.find(_word => {
            return _word === ''
        })

        /* Validate (empty) words. */
        if (typeof found === 'string') {
            return false
        } else {
            // FIXME WE SHOULD DO VERIFICATION HERE TOO
            return true
        }
    }

    const handleMnemonic = async (_mnemonic: any, _skipCreateConfirm = false) => {
        /* Set the mnemonic (store) FIRST — an early paste keeps its words
         * in the fields (the user clicks Sign In once the engine is
         * ready) instead of being silently discarded. */
        setMnemonic(_mnemonic)

        /* F63b — the ENGINE GUARD FOR EVERY ENTRY POINT: the F56g mount
         * init can take up to 60s (the 26.5MB wasm + the trusted-context
         * prefetch); the SUBMIT button waits for it, but the PASTE
         * handler and the passkey confirm/recover paths call this
         * directly. Everything below the validation (the identity search,
         * the registrar) needs the engine — refuse honestly instead of
         * crashing on the unloaded glue. */
        if (!engineReady) {
            showErrorToast('The wallet engine is still loading — try again in a moment.')
            return
        }

        /* Join an array of seed words — NORMALIZED (trim, lowercase, any
         * whitespace collapsed; F57b): the BIP39 seed is derived from the
         * normalized phrase in every wallet, so 'THANK' must not fail the
         * validation nor produce a different seed. */
        const { normalizePhrase } = await import('@/lib/mnemonic-diagnostics')
        const mnemonic = normalizePhrase(_mnemonic.join(' '))
        const normalizedWords = mnemonic.length ? mnemonic.split(' ') : ['']
        setMnemonic(normalizedWords)

        /* Set current network. */
        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'

        /* Validate mnemonic — PURE JS (F63b; see the import note). The
         * chain is pinned by test/unit/lib/mnemonic-diagnostics.test.mts. */
        const isValid = isValidPhrase(mnemonic)

        /* Validate mnemonic. */
        if (!isValid) {
            /* F57b — a DIAGNOSTIC rejection instead of the blanket toast:
             * name the word count, the non-wordlist words, or the
             * checksum-fails case so the user can actually fix it. */
            const { diagnoseRejectedPhrase } = await import('@/lib/mnemonic-diagnostics')
            const diagnosis = await diagnoseRejectedPhrase(mnemonic)
            return showErrorToast(diagnosis)
        }

        /* Initialize secure storage. */
        const { storeIdentityIdx, storeMnemonic } = await import('@/lib/secure-storage')

        /* Save mnemonic (to secure storage). */
        storeMnemonic(mnemonic)

        /* Resolve the registered identity + signing credentials
         * (shared helper — see lib/session-keys.ts). */
        const { getSessionCredentials } = await import('@/lib/session-keys')
        const credentials = await getSessionCredentials(currentNetwork)

// STORE THE IDENTITY INDEX
storeIdentityIdx(credentials?.identityIdx ?? 0)

        /* Validate Identity ID and signing credentials. */
        if (credentials) {
            try {
                await login(credentials.identityId, credentials.wif)
                // Navigation handled by auth context
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to login')
            } finally {
                setIsLoading(false)
                setIsResuming(false)
            }
        } else {
            /* Present user with NEW Identity + Username registration. */
            if (_skipCreateConfirm || confirm(`OH NO!\n\nWe COULD NOT find an Identity for you on the Dash Platform. Would you like to create a NEW Identity and register a NEW Username now?\n\nIt should ONLY take about 2 minutes..\nDon't MISS OUT, let's GO!`)) {
                setIsModalOpen(true)
            }
        }
    } // END -- HANDLE MNEMONIC

    const onInputChange = (e: ChangeEvent<HTMLInputElement>, idx: number) => {
        const newMnemonic = [...mnemonic]
        newMnemonic[idx] = e.target.value
        setMnemonic(newMnemonic)
    }

    const onMnemonicPaste = (e: ClipboardEvent) => {
        setError(null)
        setIsLoading(true)

        /* Set (new) clipboard. */
        const clipboard = e.clipboardData.getData('text/plain')

        /* Wait a tick. */
        setTimeout(async () => {
            try {
                /* Split seed words — on ANY whitespace run and normalized (trim,
             * lowercase): the old split(' ') produced contaminated words for
             * phrases pasted with newlines / double spaces / tabs (typical of
             * password managers and notes apps) and rejected VALID phrases —
             * the live 'seed words are INVALID' reports, 2026-11-16. */
                const { wordsOf } = await import('@/lib/mnemonic-diagnostics')
                const splitWords = wordsOf(clipboard)

                /* Fill the array with the pasted words. */
                const emptyValuesNeeded = ((splitWords.length > 12) ? 24 : 12) - splitWords.length
                const emptyValues = Array(emptyValuesNeeded).fill('')
                const pastedWords = [ ...splitWords, ...emptyValues ]

                /* Handle mnemonic. */
                await handleMnemonic(pastedWords)
            } catch (err: any) {
                /* F63b — the paste path ran UNGUARDED in a detached
                 * setTimeout: any failure surfaced as an "Uncaught (in
                 * promise)" with no UI feedback (the owner's
                 * __wbindgen_malloc report). Surface it honestly. */
                showErrorToast((err && typeof err.message === 'string' && err.message)
                    || 'Could not process the pasted phrase.')
            } finally {
                /* Set loading flag. */
                setIsLoading(false)
            }
        }, 0)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            /* Validate mnemonic. */
            if (hasMnemonic()) {
                await handleMnemonic(mnemonic)
            } else {
                /* Private key path — the identity is ALWAYS discovered from
                 * the key (the desktop/mobile flow: derive the public key
                 * hash160 from the WIF, then look the identity up by public
                 * key hash on the current network). No Identity ID field —
                 * the owner: it has never been required. */
                if (!privateKey.trim()) {
                    throw new Error('Paste your private key (WIF) to sign in.')
                }
                const { discoverIdentityFromWif } = await import('@/lib/private-key-login')
                const discovered = await discoverIdentityFromWif(
                    privateKey,
                    network === 'mainnet' ? 'mainnet' : 'testnet',
                )
                if (!discovered) {
                    throw new Error(
                        'No identity found for this private key on the current network. ' +
                        'Double-check the key and the selected network.'
                    )
                }
                await login(discovered.identityId, privateKey)
                // Navigation handled by auth context
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to login')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleExtWords = () => {
        /* Initialize twelve (12) word mnemonic. */
        const twelve = Array(12).fill('')

        /* Initialize twenty-four (24) word mnemonic. */
        const twentyFour = Array(24).fill('')

        /* Handle mnemonic length. */
        if (mnemonic.length === 12) {
            setMnemonic(twentyFour)
        } else {
            setMnemonic(twelve)
        }
    }

    const togglePrivateKey = () => {
        setHasIdentityPrivateKey(true)
    }

    /* Friendly toasts for passkey failures (user-cancel is silent). */
    const handlePasskeyError = (err: unknown) => {
        const code = (err as { code?: string })?.code

        if (code === 'CANCELLED') {
            return
        }

        if (code === 'PRF_UNSUPPORTED' || code === 'UNSUPPORTED') {
            showErrorToast('This device or browser does not support passkey key derivation — use a recovery phrase instead.')
        } else {
            showErrorToast((err as { message?: string })?.message || 'Passkey operation failed.')
        }
    }

    /* Create a NEW identity whose master entropy comes from the passkey's
       PRF output. The returned 12-word mnemonic is shown at the backup
       gate — it is the SAME secret, exportable. */
    const handlePasskeyCreate = async () => {
        setError(null)
        setIsPasskeyBusy(true)

        try {
            const { createIdentityEntropy } = await import('@/lib/passkey-vault')

            /* user.name/displayName are frozen into the passkey at creation
               (no rename API in WebAuthn) and shown by password managers —
               keep them human-friendly. Index is 0-based internally, but the
               label is 1-based for humans. */
            const result = await createIdentityEntropy(0, 'EvoNext Identity #1', 'EvoNext Identity #1')

            setPasskeyWords(result.mnemonic.split(' '))
        } catch (err) {
            handlePasskeyError(err)
        } finally {
            setIsPasskeyBusy(false)
        }
    }

    /* Backup gate confirmed -> feed the passkey-derived mnemonic into the
       standard flow. No identity can exist yet, so skip the "not found"
       confirm and go straight to the registrar modal. */
    const handlePasskeyBackupConfirmed = async () => {
        if (!passkeyWords) return

        const words = passkeyWords

        setPasskeyWords(null)
        setIsLoading(true)

        try {
            await handleMnemonic(words, true)
        } finally {
            setIsLoading(false)
        }
    }

    /* Recover an EXISTING identity: the synced passkey re-derives the same
       12 words, and the standard flow finds the identity on Platform. */
    const handlePasskeyRecover = async () => {
        setError(null)
        setIsPasskeyBusy(true)
        setIsLoading(true)

        try {
            const { recoverIdentityEntropy } = await import('@/lib/passkey-vault')

            const result = await recoverIdentityEntropy(0)

            await handleMnemonic(result.mnemonic.split(' '))
        } catch (err) {
            handlePasskeyError(err)
        } finally {
            setIsPasskeyBusy(false)
            setIsLoading(false)
        }
    }

    /* 12-word backup gate for passkey-created identities. */
    if (passkeyWords) {
        return (
            <div className="pt-20 md:pt-28 pb-48 md:pb-8 bg-white dark:bg-black flex flex-col items-center px-4 h-screen overflow-y-scroll">
                <div className="max-w-md w-full space-y-6">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gradient mb-2">
                            Backup Your Recovery Phrase
                        </h1>

                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Your passkey and these 12 words unlock the SAME identity.
                            Write them down and keep them safe — they are the ONLY
                            recovery if your passkey is lost or unavailable.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {passkeyWords.map((word, idx) => (
                            <div key={idx} className="px-2 py-2 rounded border border-gray-200 dark:border-gray-800 font-mono text-sm">
                                <span className="text-gray-400 mr-2">{idx + 1}.</span>
                                {word}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <Button className="w-full" onClick={handlePasskeyBackupConfirmed} disabled={isLoading}>
                            {isLoading ? 'Continuing…' : 'I wrote it down — Continue'}
                        </Button>

                        <Button className="w-full" variant="ghost" onClick={() => setPasskeyWords(null)} disabled={isLoading}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (<>
            <div className="pt-20 md:pt-28 pb-48 md:pb-8 bg-white dark:bg-black flex flex-col items-center px-4 h-screen overflow-y-scroll">
                <div className="max-w-md w-full space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gradient mb-2">
                            Connect
                        </h1>

                        <p className="text-gray-600 dark:text-gray-400">
                            Sign-in with your Dash Platform Identity
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        {/* PROMINENT sign-in method selector — the private-key
                         * path was previously buried behind a small toggle
                         * (F55 owner feedback: "I DO NOT SEE ANY CHANGES"). */}
                        <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Sign in with
                                </label>
                                <div className="flex rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setHasIdentityPrivateKey(false)}
                                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${!hasIdentityPrivateKey ? 'bg-sky-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'}`}
                                    >
                                        Recovery Phrase
                                    </button>
                                    <button
                                        type="button"
                                        onClick={togglePrivateKey}
                                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${hasIdentityPrivateKey ? 'bg-sky-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800'}`}
                                    >
                                        Private Key
                                    </button>
                                </div>
                        </div>

                        {!hasIdentityPrivateKey &&
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {mnemonic.map((word, idx) => (
                                        <input
                                            key={idx}
                                            placeholder={`Word #${idx + 1}`}
                                            value={mnemonic[idx]}
                                            onChange={(e) => onInputChange(e, idx)}
                                            onPaste={(e) => onMnemonicPaste(e)}
                                            className={`px-3 py-1 text-slate-800 font-medium border-4 border-sky-200 rounded ${idx >= 24 ? 'hidden' : ''}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        }

                        {!hasIdentityPrivateKey &&
                            <button onClick={toggleExtWords} className="px-5 py-2 bg-sky-700 font-medium text-sky-100 rounded-xl shadow">
                                {(mnemonic.length === 12) && <>switch to 24 word seed phrase</>}
                                {(mnemonic.length === 24) && <>switch to 12 word seed phrase</>}
                            </button>
                        }

                        {hasIdentityPrivateKey && <>
                            <div className="rounded-xl border border-sky-200 bg-sky-50 dark:bg-sky-950/40 p-4">
                                <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                                    No seed phrase? No problem.
                                </p>
                                <p className="text-xs text-sky-700 dark:text-sky-300 mt-1">
                                    Paste your private key (WIF) below — your identity is found
                                    automatically from it. No recovery phrase required.
                                </p>
                            </div>

                            <div>
                                <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Private Key (WIF format)
                                </label>

                                <input
                                    id="privateKey"
                                    type="password"
                                    value={privateKey}
                                    onChange={(e) => setPrivateKey(e.target.value)}
                                    placeholder="e.g., XK6CFyvYUMvY9FVQLeYBZBF..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-evonext-500 focus:border-transparent transition-colors"
                                    required
                                />
                            </div>
                        </>}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg p-3">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <Button
                                type="submit"
                                disabled={isResuming || isLoading || !engineReady || (!privateKey && !hasMnemonic())}
                                className="w-full shadow-evonext-lg text-3xl tracking-wider"
                                size="lg"
                            >
                                {isResuming ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Resuming, please wait...
                                    </span>
                                ) : isLoading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing in...
                                    </span>
                                ) : !engineReady ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Loading wallet engine...
                                    </span>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </div>

                        {/* F57e — the engine init can FAIL (flaky 26.5MB wasm
                         * fetch through the Pages Function) or HANG; without
                         * this control the button stayed on 'Loading wallet
                         * engine…' forever. Honest failure + a real way out. */}
                        {engineError && (
                            <div className="mt-3 text-center">
                                <p className="text-xs text-red-300 mb-2 break-words">
                                    Wallet engine failed to load: {engineError}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleEngineRetry}
                                >
                                    Retry
                                </Button>
                            </div>
                        )}
                    </form>

                    {passkeySupported && (
                        <div className="mt-6 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                <span className="text-xs uppercase tracking-wider text-gray-500">
                                    or
                                </span>
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button type="button" onClick={handlePasskeyCreate} disabled={isPasskeyBusy || isLoading}>
                                    {isPasskeyBusy ? 'Waiting for passkey…' : 'Create with Passkey'}
                                </Button>

                                <Button type="button" variant="outline" onClick={handlePasskeyRecover} disabled={isPasskeyBusy || isLoading}>
                                    Recover with Passkey
                                </Button>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                A passkey is your identity — no seed phrase to type. You&apos;ll still get 12 backup words.
                            </p>
                        </div>
                    )}

                    <div className="mt-8 space-y-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                How sign-in works:
                            </h3>

                            <ul className="list-disc list-inside space-y-1">
                                <li>Sign in with your 12 or 24 word recovery phrase — or use a passkey</li>
                                <li>We find your Dash Platform Identity automatically</li>
                                <li>No Identity yet? A new one is created for you (about 2 minutes)</li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                Security Notice:
                            </h3>

                            <p>
                                Your private key is only used locally to sign transactions.
                                It is never sent to any server.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Username modal */}
            <RegistrarModal isOpen={isModalOpen} onClose={handleClose} />
        </>
    )
}
