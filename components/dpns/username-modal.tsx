'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { useSdk } from '@/contexts/sdk-context'
import { dpnsService } from '@/lib/services/dpns-service'
import toast from 'react-hot-toast'
import { showErrorToast } from '../../lib/toast-error'
import { CheckCircle2, XCircle, Loader2, RefreshCw, X, Edit2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'

import { dpns_is_contested_username } from '@/lib/dash-wasm/compat'
import {
    broadcastTransaction,
    createAssetLockTransaction,
    deriveFundingKey,
    getFundingUtxos,
    waitForConfirmation,
} from '@/lib/core-chain'

/* Initialize constants. */
const MAX_USERNAME_LENGTH = 63 // Maximum length - 63 characters
const NON_CONTESTED_REG_FEE = 1000000 // 0.1 DASH
const CONTESTED_REG_FEE = 3000000 // 0.3 DASH

interface UsernameModalProps {
    isOpen: boolean
    onClose: () => void
    customIdentityId?: string
}

export function UsernameModal({
    isOpen,
    onClose,
    customIdentityId: initialIdentityId,
}: UsernameModalProps) {
    const router = useRouter()

    const { user, updateDPNSUsername } = useAuth()
    const { network } = useNetwork()
    const { isReady: isSdkReady, error: sdkError } = useSdk()

    const [username, setUsername] = useState('')
    const [isChecking, setIsChecking] = useState(false)
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCheckingExisting, setIsCheckingExisting] = useState(false)
    const [isEditingIdentity, setIsEditingIdentity] = useState(false)
    const [customIdentityId, setCustomIdentityId] = useState(initialIdentityId || '')

    /* Top-up state: live identity balance + auto top-up when too low. */
    const [identityCredits, setIdentityCredits] = useState<number | null>(null)
    const [needsTopUp, setNeedsTopUp] = useState(false)
    const [topUpProgress, setTopUpProgress] = useState<string | null>(null)
    const [depositedSatoshis, setDepositedSatoshis] = useState(0)
    const topUpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const isToppingUpRef = useRef(false)

    const IDENTITY_INDEX = 0
    const TOP_UP_SATOSHIS = 10_000_000  /* 0.1 DASH */
    const TOP_UP_REQUIRED = TOP_UP_SATOSHIS * 2 + 5_000

    // Debug SDK state
    useEffect(() => {
        console.log('UsernameModal: SDK ready state:', isSdkReady, 'SDK error:', sdkError)
    }, [
        isSdkReady,
        sdkError,
    ])

    const currentIdentityId = customIdentityId || initialIdentityId || user?.identityId || ''

    /* Poll the identity balance live (every 4s) while the modal is open. */
    useEffect(() => {
        if (!currentIdentityId || !isOpen) return

        let cancelled = false

        const poll = async () => {
            try {
                const sdk = await (await import('@/lib/services/wasm-sdk-service')).wasmSdkService.getSdk()
                const identity: any = await sdk.getIdentity(currentIdentityId)
                if (!cancelled && identity) {
                    setIdentityCredits(Number(identity.balance))
                }
            } catch (error) {
console.warn('BALANCE (poll error)', error)
            }
        }

        poll()
        const interval = setInterval(poll, 4000)

        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [
        currentIdentityId,
        isOpen,
    ])

    /* Auto-process the top-up: poll the funding address for the required
     * deposit, then build the lock + top up + (user re-submits username). */
    useEffect(() => {
        if (!needsTopUp || !isOpen) return

        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'

        topUpIntervalRef.current = setInterval(async () => {
            if (isToppingUpRef.current) return

            const funding = deriveFundingKey(currentNetwork, IDENTITY_INDEX)
            const utxos = await getFundingUtxos(currentNetwork, funding.address)
                .catch((err: any) => console.error(err))
            if (typeof utxos === 'undefined' || utxos === null) return

            const available = utxos.reduce(
                (sum: number, utxo: any) => sum + utxo.satoshis, 0)

            /* Keep the top-up progress bar live. */
            setDepositedSatoshis(available)

            if (available < TOP_UP_REQUIRED) {
console.log('TOP-UP (waiting for deposit)', available, 'of', TOP_UP_REQUIRED)
                return
            }

            /* Funds are here — process the top-up. */
            isToppingUpRef.current = true
            if (topUpIntervalRef.current) {
                clearInterval(topUpIntervalRef.current)
                topUpIntervalRef.current = null
            }

            try {
                await processTopUp()
            } catch (error) {
console.error('TOP-UP FAILED', error)
                setTopUpProgress(null)
                showErrorToast(`Top-up failed: ${error instanceof Error ? error.message : 'unknown error'} — send the deposit again to retry`)
                isToppingUpRef.current = false
                setNeedsTopUp(true)
            }
        }, 4000)

        return () => {
            if (topUpIntervalRef.current) {
                clearInterval(topUpIntervalRef.current)
                topUpIntervalRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        needsTopUp,
        isOpen,
        network,
    ])

    /* Build a fresh asset lock from the funding wallet's spendable change and
     * top up the identity. The identity id is the modal's currentIdentityId. */
    const processTopUp = async () => {
        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'

        const { getMnemonic } = await import('@/lib/secure-storage')
        const mnemonic = getMnemonic()
        if (!mnemonic) throw new Error('session expired — your keys are needed to build the top-up')

        setTopUpProgress('Building the top-up lock...')

        const funding = deriveFundingKey(currentNetwork, IDENTITY_INDEX)
        const utxos = await getFundingUtxos(currentNetwork, funding.address)
        const lockTx = await createAssetLockTransaction(
            currentNetwork, funding.privateKeyWif, utxos, TOP_UP_SATOSHIS)
        const topUpTxid = await broadcastTransaction(
            currentNetwork, lockTx.toString())
console.log('TOP-UP (lock broadcast)', topUpTxid)

        /* Wait for the top-up lock to confirm + chainlock. */
        setTopUpProgress('Waiting for the top-up to confirm...')
        const { blockheight } = await waitForConfirmation(
            currentNetwork, topUpTxid, undefined, undefined,
            (a, m) => setTopUpProgress(`Waiting for confirmation (${a}/${m})...`))

        const sdk = await (await import('@/lib/services/wasm-sdk-service')).wasmSdkService.getSdk()
        let platformStatus: any
        do {
            setTopUpProgress('Waiting for the top-up to be chainlocked...')
            await new Promise(r => setTimeout(r, 15000))
            const resp: any = await sdk.getIdentityWithProofInfo(currentIdentityId)
            platformStatus = { h: resp.metadata.coreChainLockedHeight }
        } while (platformStatus.h < blockheight)

        /* Top up the identity (authorized by the asset-lock private key —
           IdentityTopUpOptions has no signer field). */
        setTopUpProgress('Adding credits to your identity...')
        const wasm: any = await import('@/lib/dash-wasm/wasm_sdk')
        const outPoint = new wasm.OutPoint(topUpTxid, 0)
        const proof = wasm.AssetLockProof.createChainAssetLockProof(
            platformStatus.h, outPoint)
        const { PrivateKey } = await import('@/lib/dash-wasm/compat')
        const assetLockPrivateKey = PrivateKey.fromWIF(funding.privateKeyWif)
        const identity = await sdk.getIdentity(currentIdentityId)
        if (!identity) throw new Error('identity not found')
        const newBalance = await sdk.identityTopUp({
            identity, assetLockProof: proof, assetLockPrivateKey,
        })
console.log('TOP-UP (new balance)', newBalance)
        setIdentityCredits(Number(newBalance))
        setNeedsTopUp(false)
        setTopUpProgress(null)
        toast.success('Balance topped up! Click Register Username again.')
    }

    // Check username availability with debounce
    useEffect(() => {
        if (!username) {
            setIsAvailable(null)
            setValidationError(null)

            return
        }

        // Do basic validation first (without WASM)
        if (username.length < 3) {
            setValidationError('Username must be at least 3 characters long')
            setIsAvailable(false)

            return
        }

        if (username.length > MAX_USERNAME_LENGTH) {
            setValidationError('Username must be 63 characters or less')
            setIsAvailable(false)

            return
        }

        if (!/^[a-zA-Z0-9-]+$/.test(username)) {
            setValidationError('Username can only contain letters, numbers, and hyphens')
            setIsAvailable(false)

            return
        }

        if (username.startsWith('-') || username.endsWith('-')) {
            setValidationError('Username cannot start or end with hyphen')
            setIsAvailable(false)

            return
        }

        if (username.includes('--')) {
            setValidationError('Username cannot contain consecutive hyphens')
            setIsAvailable(false)

            return
        }

        setValidationError(null)

        // Debounce availability check
        const timeoutId = setTimeout(async () => {
            if (!isSdkReady) {
                setValidationError(sdkError ? `Service error: ${sdkError}` : 'Service is initializing...')
                setIsAvailable(false)

                return
            }

            setIsChecking(true)

            try {
                const available = await dpnsService.isUsernameAvailable(username)

                setIsAvailable(available)
            } catch (error) {
                console.error('Failed to check username availability:', error)
                showErrorToast('Failed to check username availability')
            } finally {
                setIsChecking(false)
            }
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [
        username,
        isSdkReady,
        sdkError,
    ])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!username || !isAvailable || validationError || !currentIdentityId) {
            return
        }

        if (!isSdkReady) {
            showErrorToast('Service is initializing. Please try again in a moment.')
            return
        }

        setIsSubmitting(true)

        try {
            // Get the private key from session storage
            const { getPrivateKey } = await import('@/lib/secure-storage')
            const privateKey = getPrivateKey(currentIdentityId)

            if (!privateKey) {
                throw new Error('Authentication required. Please log in again.')
            }

            // Get the identity to find a suitable key
            const { identityService } = await import('@/lib/services/identity-service')

            const identity = await identityService.getIdentity(currentIdentityId)
console.log('USERNAME MODAL (identity)', identity)

            if (!identity) {
                throw new Error('Identity not found')
            }

            // Find a suitable key (CRITICAL or HIGH security level)
            // Security levels: MASTER=0, CRITICAL=1, HIGH=2, MEDIUM=3
            console.log('Identity publicKeys:', JSON.stringify(identity.publicKeys, null, 2))

            const suitableKey = identity.publicKeys.find((key: any) => {
                // Check if key has the expected structure
                const keySecurityLevel = key.securityLevel
                const keyDisabledAt = key.disabledAt

                console.log(`Key ${key.id}: securityLevel=${keySecurityLevel}, disabledAt=${keyDisabledAt}`)

                // Only accept CRITICAL (1) or HIGH (2) security levels
                return !keyDisabledAt && (keySecurityLevel === 1 || keySecurityLevel === 2)
            })

            if (!suitableKey) {
                // Log available keys for debugging
                console.log('Available keys:', identity.publicKeys.map((k: any) => ({
                    id: k.id,
                    securityLevel: k.securityLevel,
                    disabledAt: k.disabledAt,
                    type: k.type,
                    purpose: k.purpose
                })))

                throw new Error('No suitable keys found. DPNS requires CRITICAL (security level 1) or HIGH (security level 2) key.')
            }

            const keySecurityLevel = suitableKey.security_level ?? suitableKey.securityLevel
            console.log(`Using key ${suitableKey.id} with security level ${keySecurityLevel === 1 ? 'CRITICAL' : 'HIGH'} (${keySecurityLevel})`)

            // Register the username
            await dpnsService.registerUsername(
                username, currentIdentityId, suitableKey.id, privateKey)

            toast.success('DPNS username registered successfully!')

            // Update user in auth context if it's the current user
            if (currentIdentityId === user?.identityId) {
                updateDPNSUsername(username)
            }

            onClose()

            // Redirect to profile creation
            router.push('/profile/create')
        } catch (error: any) {
            console.error('Failed to register username:', error)
            const errorMessage = error.message || 'Failed to register username'

            /* Insufficient balance: enter TOP-UP MODE — show the funding
               address/QR + live balance, and auto-process a top-up the
               moment a large-enough deposit lands. */
            if (/insufficient identity balance/i.test(errorMessage)) {
                setNeedsTopUp(true)
                toast('Your identity balance is too low for this username — send a small top-up to the address below; it completes automatically.', { icon: '\u2139\uFE0F' })
            // Provide more specific error messages
            } else if (errorMessage.includes('already taken')) {
                showErrorToast('This username is already taken. Please choose another.')
            } else if (errorMessage.includes('Invalid username')) {
                showErrorToast('Invalid username format. Please check the requirements.')
            } else if (errorMessage.includes('SDK')) {
                showErrorToast('Service initialization failed. Please try again.')
            } else {
                showErrorToast(errorMessage)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusIcon = () => {
        if (isChecking) {
            return <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        }

        if (validationError) {
            return <XCircle className="w-8 h-8 text-red-500" />
        }

        if (isAvailable === true) {
            return <CheckCircle2 className="w-8 h-8 text-green-500" />
        }

        if (isAvailable === false) {
            return <XCircle className="w-8 h-8 text-red-500" />
        }

        return null
    }

    const getStatusMessage = () => {
            if (validationError) {
                return <p className="text-sm text-red-600 mt-1">
                    {validationError}
                </p>
            }

            if (isChecking) {
                return <p className="text-sm text-gray-500 mt-1">
                    Checking availability...
                </p>
            }

            if (isAvailable === true) {
                /* Validate (contested) username. */
                if (dpns_is_contested_username(username)) {
                    return <p className="text-sm text-amber-600 mt-1">
                        Username is available, <span className="font-bold uppercase">but contested!</span>

                        <small className="mt-1 block text-xs text-rose-600">
                            It&apos;s <span className="font-bold uppercase">HIGHLY</span> recommended to choose an uncontested username for your <span className="font-bold uppercase">1st Identity registration.</span>
                        </small>
                    </p>
                } else {
                    return <p className="text-sm text-green-600 mt-1">
                        Username is <span className="font-bold uppercase">available!</span>
                    </p>
                }
            }

            if (isAvailable === false) {
                return <p className="text-sm text-red-600 mt-1">
                    Username is already taken
                </p>
            }

            return null
        }

    const handleCheckExistingUsername = async () => {
        if (!currentIdentityId) return

        if (!isSdkReady) {
            showErrorToast('Service is initializing. Please try again in a moment.')
            return
        }

        setIsCheckingExisting(true)

        try {
            // Clear any cached DPNS data first
            dpnsService.clearCache(undefined, currentIdentityId)

            // Try to resolve the username
            const existingUsername = await dpnsService.resolveUsername(currentIdentityId)

            if (existingUsername) {
                toast.success(`Found username: ${existingUsername}!`)

                // Update the auth context with the username if it's the current user
                if (currentIdentityId === user?.identityId) {
                    updateDPNSUsername(existingUsername)
                }

                onClose()

                // Redirect to home or profile creation
                const { ProfileService } = await import('@/lib/services/profile-service')
                const ps = new ProfileService(network!)
                const profile = await ps.getProfile(currentIdentityId, existingUsername)

                if (profile) {
                    router.push('/')
                } else {
                    router.push('/profile/create')
                }
            } else {
                showErrorToast('No username found. Please register one above.')
            }
        } catch (error) {
            console.error('Failed to check for existing username:', error)
            showErrorToast('Failed to check for existing username')
        } finally {
            setIsCheckingExisting(false)
        }
    }

    const handleIdentityChange = () => {
        if (isEditingIdentity) {
            // Save the custom identity
            if (customIdentityId && customIdentityId !== user?.identityId) {
                // Validate it's a valid base58 string
                try {
                    // Basic validation - check length and characters
                    if (!/^[1-9A-HJ-NP-Za-km-z]{42,44}$/.test(customIdentityId)) {
                        showErrorToast('Invalid identity ID format')
                        return
                    }
                } catch (error) {
                    showErrorToast('Invalid identity ID')
                    return
                }
            }

            setIsEditingIdentity(false)
        } else {
            setCustomIdentityId(currentIdentityId)
            setIsEditingIdentity(true)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 flex items-center justify-center z-40 px-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full relative">
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-8 h-8" />
                            </button>

                            <h1 className="text-3xl font-bold text-center mb-2">
                                Choose Your Username
                            </h1>

                            <p className="px-10 text-gray-600 dark:text-gray-400 text-center mb-6">
                                Add a unique username to your Dash Platform Identity
                            </p>

                            {/* Identity ID Display */}
                            {/* DO WE NEED THIS OPTION AVAILABLE?? */}
                            <div className="hidden mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Identity ID</label>

                                <div className="flex items-center gap-2 mt-1">
                                    {isEditingIdentity ? (
                                        <Input
                                            type="text"
                                            value={customIdentityId}
                                            onChange={(e) => setCustomIdentityId(e.target.value)}
                                            placeholder="Enter identity ID"
                                            className="flex-1 font-mono text-sm"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="flex-1 font-mono text-sm break-all">
                                            {currentIdentityId}
                                        </span>
                                    )}

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleIdentityChange}
                                        className="shrink-0"
                                    >
                                        {isEditingIdentity ? (
                                            'Save'
                                        ) : (
                                            <Edit2 className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        DPNS Username
                                    </label>

                                    <div className="relative">
                                        <Input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="JohnDoe1999"
                                            className="pr-10"
                                            autoComplete="off"
                                            maxLength={63}
                                        />

                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {getStatusIcon()}
                                        </div>
                                    </div>

                                    {getStatusMessage()}

                                    <div className="mt-4 space-y-2 text-xs text-gray-500">
                                        <p>Username Requirements:</p>

                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>At least 3 characters long</li>
                                            <li>Letters, numbers, and hyphens only</li>
                                            <li>Cannot start or end with a hyphen</li>
                                            <li>No consecutive hyphens</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* LIVE identity balance (polled every 4s) */}
                                {identityCredits !== null &&
                                    <div className={`px-3 py-2 rounded-lg border text-center ${needsTopUp ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'}`}>
                                        <span className="text-sm font-medium text-gray-700">
                                            Identity balance:{" "}
                                        </span>
                                        <span className={`text-lg font-bold ${needsTopUp ? 'text-amber-600' : 'text-green-700'}`}>
                                            {(identityCredits / 1e3 / 1e8).toFixed(8)} DASH
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            {identityCredits.toLocaleString()} credits
                                        </span>
                                    </div>
                                }

                                {/* TOP-UP funding panel (address + QR + progress) */}
                                {needsTopUp &&
                                    <div className="px-3 py-4 flex flex-col gap-4 rounded-lg border border-amber-400 bg-amber-50">
                                        <h3 className="font-medium text-lg text-amber-800 text-center">
                                            Top up your identity to register this username
                                        </h3>

                                        <div className="flex justify-center">
                                            <QRCodeSVG
                                                value={deriveFundingKey(
                                                    (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet',
                                                    IDENTITY_INDEX).address}
                                                size={160}
                                            />
                                        </div>

                                        <p className="text-center text-sm text-amber-800">
                                            Send at least{" "}
                                            <span className="font-bold">
                                                {(TOP_UP_REQUIRED / 1e8).toFixed(5)} DASH
                                            </span>{" "}
                                            to YOUR OWN funding address:
                                        </p>

                                        <p className="font-mono text-xs text-amber-900 text-center break-all bg-white/70 rounded p-2">
                                            {deriveFundingKey(
                                                (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet',
                                                IDENTITY_INDEX).address}
                                        </p>

                                        {/* LIVE top-up progress bar */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs font-medium text-amber-800">
                                                <span className="flex items-center gap-1">
                                                    {depositedSatoshis < TOP_UP_REQUIRED &&
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    }
                                                    Top-up received
                                                </span>
                                                <span>
                                                    {(depositedSatoshis / 1e8).toFixed(8)} / {(TOP_UP_REQUIRED / 1e8).toFixed(5)} DASH
                                                </span>
                                            </div>

                                            <div className="h-2 w-full rounded bg-amber-100">
                                                <div
                                                    className="h-2 rounded bg-amber-500 transition-all"
                                                    style={{ width: `${Math.min(100, TOP_UP_REQUIRED > 0 ? (depositedSatoshis / TOP_UP_REQUIRED) * 100 : 0)}%` }}
                                                />
                                            </div>

                                            {depositedSatoshis >= TOP_UP_REQUIRED &&
                                                <p className="text-xs font-bold text-green-700 text-center">
                                                    Top-up detected — processing automatically…
                                                </p>
                                            }
                                        </div>

                                        {topUpProgress &&
                                            <p className="text-xs text-amber-800 text-center flex items-center justify-center gap-2">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {topUpProgress}
                                            </p>
                                        }
                                    </div>
                                }

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={!username || !isAvailable || !!validationError || isChecking || isSubmitting || !currentIdentityId}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Registering Username...
                                        </>
                                    ) : (
                                        'Register Username'
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
                                    Already registered your username elsewhere?
                                </p>

                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleCheckExistingUsername}
                                    disabled={isCheckingExisting || !currentIdentityId}
                                >
                                    {isCheckingExisting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Checking for existing username...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            I just registered my username
                                        </>
                                    )}
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        // Mark that user chose to skip DPNS registration
                                        sessionStorage.setItem('evonext_skip_dpns', 'true')
                                        onClose()
                                        router.push('/profile/create')
                                    }}
                                    className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
