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
import { CheckCircle2, XCircle, Loader2, RefreshCw, X, Edit2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react'
import { getIdentities } from '@/lib/identity-manager'
import {
    getFundingInfo,
    registerIdentityAndUsername,
} from '@/lib/registrar-manager'
import { getFundingUtxos, MINIMUM_DEPOSIT_SATOSHIS } from '@/lib/core-chain'
import { storeIdentityIdx } from '@/lib/secure-storage'
import { getPrivateKeys, getPublicKeys } from '@/lib/wallet-manager'
import { dpns_is_contested_username } from '@/lib/dash-wasm/compat'

/* Initialize constants. */
const MAX_USERNAME_LENGTH = 63 // Maximum length - 63 characters
// NOTE: users now fund their OWN asset lock. The locked amount (and the
// matching credit output) is set in lib/core-chain.ts.
const PAYMENT_DETECTION_INTERVAL = 5000
const PAYMENT_DETECTION_CYCLES = 180 // 15 minutes

interface RegistrarModalProps {
    isOpen: boolean
    onClose: () => void
    customIdentityId?: string
}

// FIXME WE MUST ALLOW FOR A USER-DEFINED INDEX
const IDENTITY_INDEX = 0

export function RegistrarModal({
    isOpen,
    onClose,
    customIdentityId: initialIdentityId,
}: RegistrarModalProps) {
    const router = useRouter()

    const { login, user } = useAuth()
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

    /* Self-custodial funding state. */
    const [fundingAddress, setFundingAddress] = useState<string | undefined>()
    const [progressMessage, setProgressMessage] = useState<string | null>(null)

    /* Hold the polling interval so the effect cleanup can stop it. */
    const paymentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const paymentAttemptsRef = useRef(0)

    /* Debug SDK state */
    useEffect(() => {
        console.log('RegistrarModal: SDK ready state:', isSdkReady, 'SDK error:', sdkError)
    }, [
        isSdkReady,
        sdkError,
    ])

    /* Stop the deposit polling when the modal closes. */
    useEffect(() => {
        if (!isOpen) {
            if (paymentIntervalRef.current) {
                clearInterval(paymentIntervalRef.current)
                paymentIntervalRef.current = null
            }
        }
    }, [
        isOpen,
    ])

    /* Set current Identity ID. */
    const currentIdentityId = customIdentityId || initialIdentityId || user?.identityId || ''

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
                /* Check availability. */
                const available = await dpnsService.isUsernameAvailable(username)

                /* Set availability. */
                setIsAvailable(available)
            } catch (error) {
                console.error('Failed to check username availability:', error)
                toast.error('Failed to check username availability')
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

    const handlePayment = () => {
        /* Open the user's wallet with a BIP-21 style Dash URI pointing at
         * THEIR OWN funding address (self-custodial). */
        if (fundingAddress) {
            window.location.href = `dash:${fundingAddress}`
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setIsSubmitting(true)

        /* Set network. */
        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
console.log('REGISTRAR (currentNetwork)', currentNetwork)

        /* Request funding info (address derived from the user's OWN mnemonic). */
        const funding = await getFundingInfo(currentNetwork, IDENTITY_INDEX)
            .catch((err: any) => console.error(err))

        /* Validate funding info. */
        if (typeof funding === 'undefined' || funding === null) {
            setIsSubmitting(false)
            toast.error('Failed to generate your funding address')
            return
        }

        /* Show the funding address + QR. */
        setFundingAddress(funding.address)
console.log('REGISTRAR (funding address)', funding.address)
console.log('REGISTRAR (required deposit)', funding.requiredDash, 'DASH')

        /* Initialize payment monitoring handler. */
        paymentAttemptsRef.current = 0

        /* Manage (deposit) detection. */
        paymentIntervalRef.current = setInterval(async () => {
console.log('WAITING (up to 15 minutes) FOR DEPOSIT...')

            /* Request funding UTXOs. */
            const utxos = await getFundingUtxos(currentNetwork, funding.address)
                .catch((err: any) => console.error(err))

            /* Validate (deposit) response. */
            if (typeof utxos !== 'undefined' && utxos !== null && utxos.length > 0) {
                const funded = utxos.reduce(
                    (sum: number, utxo: any) => sum + utxo.satoshis, 0)

                /* Require the FULL deposit before proceeding. */
                if (funded < MINIMUM_DEPOSIT_SATOSHIS) {
console.log('PARTIAL DEPOSIT', funded, 'of', MINIMUM_DEPOSIT_SATOSHIS)
                    return
                }

                /* Stop the timer/interval. */
                if (paymentIntervalRef.current) {
                    clearInterval(paymentIntervalRef.current)
                    paymentIntervalRef.current = null
                }

                /* Run the full self-custodial registration. */
                try {
                    const regResult = await registerIdentityAndUsername(
                        currentNetwork, IDENTITY_INDEX, username,
                        (message: string) => setProgressMessage(message))
console.log('REGISTRATION RESULT', regResult)

                    /* Set submission flag. */
                    setIsSubmitting(false)

                    /* Validate registration response. */
                    if (typeof regResult === 'undefined' || regResult === null) {
                        alert(`Oops! Something went wrong, but NO worries. Please contact support (AKA Shomari) for assistance.`)
                    } else {
                        alert(`Congratulations!\n\nYou're all set.\nEnjoy your NEW Identity!`)

                        /* Request public keys. */
                        const publicKeys = getPublicKeys(currentNetwork, IDENTITY_INDEX)

                        /* Request ALL (registered) Identities. */
                        const regIdentities = await getIdentities(currentNetwork)
console.log('CONNECT (regIdentities)', regIdentities)

                        const identityId = regIdentities![0].id
console.log('CONNECT (identityId)', identityId)

                        const identityIdx = regIdentities![0].idx || 0
console.log('CONNECT (identityIdx)', identityIdx)

                        const regPubKeys = regIdentities![0].publicKeys
console.log('CONNECT (regPubKeys)', regPubKeys)

                        /* Validate Identity ID and public keys. */
                        if (identityId && regPubKeys) {
// STORE THE IDENTITY INDEX
storeIdentityIdx(identityIdx)

                            const signingPublicKey = regPubKeys.find((_pubkey: any) => {
                                return _pubkey.purpose === 0 && (_pubkey.securityLevel === 1 || _pubkey.securityLevel === 2)
                            })
console.log('CONNECT (signingPublicKey)', signingPublicKey)

                            const signingPrivateKey = publicKeys.find(_pubkey => {
                                return _pubkey.id === signingPublicKey!.id
                            })
console.log('CONNECT (signingPrivateKey)', signingPrivateKey)

                            /* Set seed private key (WIF). */
                            const seedPrivateKey = signingPrivateKey!.privateKeyWif
console.log('CONNECT (seedPrivateKey WIF)', seedPrivateKey)

                            await login(identityId, seedPrivateKey)
                            // Navigation handled by auth context
                        } else {
                            alert(`Oops! Auto-login failed. Please login manually to continue.`)
                        }
                    }
                } catch (err) {
console.error('REGISTRATION FAILED', err)
                    setIsSubmitting(false)
                    setProgressMessage(null)
                    toast.error(`Registration failed: ${err instanceof Error ? err.message : 'unknown error'}`)
                }
            }

            // NOTE: WAIT UP TO 15 MINUTES FOR DEPOSIT
            if (++paymentAttemptsRef.current === PAYMENT_DETECTION_CYCLES) {
                /* Stop the timer/interval. */
                if (paymentIntervalRef.current) {
                    clearInterval(paymentIntervalRef.current)
                    paymentIntervalRef.current = null
                }
console.log('TIMER STOPPED (after 15 minutes)')

                /* Set submission flag. */
                setIsSubmitting(false)

                toast.error(`Your deposit window has EXPIRED! Please try again...`)
            }
        }, PAYMENT_DETECTION_INTERVAL)
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

    const handleCheckExistingRegistrar = async () => {
        if (!currentIdentityId) return

        if (!isSdkReady) {
            toast.error('Service is initializing. Please try again in a moment.')
            return
        }

        setIsCheckingExisting(true)

        try {
            // Clear any cached DPNS data first
            dpnsService.clearCache(undefined, currentIdentityId)

            // Try to resolve the username
            // const existingRegistrar = await dpnsService.resolveRegistrar(currentIdentityId)
            const existingRegistrar = false

            if (existingRegistrar) {
                toast.success(`Found username: ${existingRegistrar}!`)

                // Update the auth context with the username if it's the current user
                if (currentIdentityId === user?.identityId) {
                    // updateDPNSRegistrar(existingRegistrar)
                }

                onClose()

                // Redirect to home or profile creation
                const { ProfileService } = await import('@/lib/services/profile-service')
                const ps = new ProfileService(network!)
                const profile = await ps.getProfile(currentIdentityId, existingRegistrar)

                if (profile) {
                    router.push('/')
                } else {
                    router.push('/profile/create')
                }
            } else {
                toast.error('No username found. Please register one above.')
            }
        } catch (error) {
            console.error('Failed to check for existing username:', error)
            toast.error('Failed to check for existing username')
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
                        toast.error('Invalid identity ID format')
                        return
                    }
                } catch (error) {
                    toast.error('Invalid identity ID')
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
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full relative h-full overflow-y-auto">
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-8 h-8" />
                            </button>

                            <h1 className="text-3xl font-bold text-center mb-2">
                                EvoNext Registrar
                            </h1>

                            <p className="px-8 text-gray-600 dark:text-gray-400 text-center mb-6 text-pretty">
                                Choose a NEW &amp; Unique Username for your Dash Platform Identity
                            </p>

                            {/* BEGIN FUNDING INFORMATION HERE */}
                            {fundingAddress &&
                                <section className="w-full mb-5 flex flex-col items-center justify-center shadow">
                                    <QRCodeSVG
                                        value={fundingAddress || ''}
                                        size={360}
                                        onClick={() => handlePayment()}
                                        className="cursor-pointer"
                                    />

                                    <div className="mt-5 px-3 py-5 flex flex-col gap-5 rounded-lg border border-evonext-700 bg-evonext-50">
                                        <h2 className="font-medium text-2xl text-evonext-800 text-center">
                                            Fund YOUR Identity — You&apos;re in Control
                                        </h2>

                                        <h3 className="font-medium text-xl text-evonext-800 text-center">
                                            Send at least
                                            <button
                                                className="px-1 text-2xl font-bold text-evonext-600"
                                                onClick={() => handlePayment()}
                                            >
                                                {Math.ceil(MINIMUM_DEPOSIT_SATOSHIS) / 1e8} DASH
                                            </button>
                                            to YOUR OWN funding address shown below -OR- click the QRCode shown above
                                        </h3>

                                        <button onClick={() => handlePayment()} className="font-bold text-md text-evonext-600 text-center tracking-tighter break-all">
                                            {fundingAddress ? fundingAddress : 'loading...'}
                                        </button>

                                        <p className="font-base text-sm text-evonext-800">
                                            <span className="block font-medium text-md tracking-wider">PLEASE NOTE:</span>
                                            This address is derived from YOUR wallet — you control the keys.
                                            The funds become the asset lock for YOUR new Identity. Registration completes automatically after your deposit is confirmed.
                                        </p>
                                    </div>
                                </section>
                            }
                            {/* END FUNDING INFORMATION HERE */}

                            {/* BEGIN PROGRESS MESSAGE */}
                            {progressMessage &&
                                <div className="mb-5 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                                    <p className="text-md font-medium text-blue-800 flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {progressMessage}
                                    </p>
                                </div>
                            }
                            {/* END PROGRESS MESSAGE */}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        DashPay Username
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

                                    <div className="pl-1 pt-1 tracking-wider">
                                        {getStatusMessage()}
                                    </div>

                                    <div className="pl-1 mt-4 space-y-2 text-xs text-gray-500">
                                        <h3 className="font-bold">
                                            Username Requirements:
                                        </h3>

                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>At least 3 characters long</li>
                                            <li>Letters, numbers, and hyphens only</li>
                                            <li>Cannot start or end with a hyphen</li>
                                            <li>No consecutive hyphens</li>
                                        </ul>
                                    </div>

                                    <div className="pl-1 mt-4 space-y-2 text-xs text-gray-500">
                                        <h3 className="font-bold">
                                            IMPORTANT NOTE:
                                        </h3>

                                        <p>
                                            ANY username that is under 20 characters in length -OR- ONLY contains the numbers 0 and 1, will require approval by the Master Node Operators that guard against abuses of the network.
                                        </p>

                                        <p>
                                            This voting period takes <span className="font-bold text-rose-600">TWO (2) WEEKS</span> to complete, and is completely out of the control of the EvoNext Registrar.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full text-xl"
                                    disabled={!username || !isAvailable || !!validationError || isChecking || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Waiting for Deposit...
                                        </>
                                    ) : (
                                        'Continue Registration'
                                    )}
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
