'use client'

import { useState, useEffect } from 'react'
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
import {
    checkPendingStatus,
    getPaymentAddress,
    getRegisteredKeys,
    registerIdentityAndUsername,
} from '@/lib/registrar-manager'
import { getPrivateKeys, getPublicKeys } from '@/lib/wallet-manager'

import { dpns_is_contested_username } from '@/lib/dash-wasm/wasm_sdk'

/* Initialize constants. */
const MAX_USERNAME_LENGTH = 63 // Maximum length - 63 characters
const NON_CONTESTED_REG_FEE = 0.1 // BIP-21 requires DASH values (not duff)
const CONTESTED_REG_FEE = 0.3 // BIP-21 requires DASH values (not duff)
const PAYMENT_DETECTION_INTERVAL = 5000
const PAYMENT_DETECTION_CYCLES = 180 // 15 minutes

interface RegistrarModalProps {
    isOpen: boolean
    onClose: () => void
    customIdentityId?: string
}

export function RegistrarModal({
    isOpen,
    onClose,
    customIdentityId: initialIdentityId,
}: RegistrarModalProps) {
    const router = useRouter()

    const { login, user } = useAuth()
    const { network } = useNetwork()
    const { isReady: isSdkReady, error: sdkError } = useSdk()

    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [isChecking, setIsChecking] = useState(false)
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCheckingExisting, setIsCheckingExisting] = useState(false)
    const [isEditingIdentity, setIsEditingIdentity] = useState(false)
    const [isShowingPayment, setIsShowingPayment] = useState(false)
    const [customIdentityId, setCustomIdentityId] = useState(initialIdentityId || '')

    const [paymentAddress, setPaymentAddress] = useState<string | undefined>()

    // Debug SDK state
    useEffect(() => {
        console.log('RegistrarModal: SDK ready state:', isSdkReady, 'SDK error:', sdkError)
    }, [
        isSdkReady,
        sdkError,
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
        /* Handle contested usernames. */
        if (dpns_is_contested_username(username)) {
            const dashUri = `dash:${paymentAddress}?amount=${CONTESTED_REG_FEE}`
            window.location.href = dashUri
        } else {
            const dashUri = `dash:${paymentAddress}?amount=${NON_CONTESTED_REG_FEE}`
            window.location.href = dashUri
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // setIsShowingPayment(true)
        setIsSubmitting(true)

        /* Request mnemonic. */
        const { getMnemonic } = await import('@/lib/secure-storage')
        const mnemonic = getMnemonic()
console.log('REGISTRAR (mnemonic)', mnemonic)

        /* Set network. */
        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
console.log('REGISTRAR (currentNetwork)', currentNetwork)

        /* Request payment address. */
        const paymentAddress = await getPaymentAddress(currentNetwork, username, email)
            .catch(err => console.error(err))

        /* Handle contested username. */
        // NOTE: We add BIP-21 encoding for user convenience.
        if (dpns_is_contested_username(username)) {
            setPaymentAddress(`dash:${paymentAddress}?amount=${CONTESTED_REG_FEE}`)
        } else {
            setPaymentAddress(`dash:${paymentAddress}?amount=${NON_CONTESTED_REG_FEE}`)
        }

        /* Initialize payment monitoring handler. */
        let attemptsCounter = 0
// return
        /* Manage payment detection. */
        const paymentDetectionHandler = setInterval(async () => {
console.log('WAITING (up to 15 minutes) FOR PAYMENT...')

            /* Request pending registration. */
            const response = await checkPendingStatus(currentNetwork)
                .catch(err => console.error(err))

            /* Validate (pending registration) response. */
            if (typeof response !== 'undefined' && response !== null) {
                /* Stop the timer/interval. */
                clearTimeout(paymentDetectionHandler)

                /* Set (asset lock) proof. */
                const proof = response.proof

                /* Set WIF. */
                const wif = response.wif

                /* Register Identity + Username. */
                const regResult = await registerIdentityAndUsername(
                    currentNetwork, username, proof, wif)
                    .catch(err => console.error(err))
console.log('REGISTRATION RESULT', regResult)

                /* Set submission flag. */
                setIsSubmitting(false)

                /* Validate registration response. */
                if (typeof regResult === 'undefined' || regResult === null) {
                    alert(`Oops! Something went wrong, but NO worries. Please contact support (AKA Shomari) for assistance.`)
                } else {
                    alert(`Congratulations!\n\nYou're all set.\nEnjoy your NEW Identity!`)

                    /* Request public keys. */
                    const publicKeys = getPublicKeys(currentNetwork)

                    /* Request ALL (registered) public keys. */
                    const regKeysResponse = await getRegisteredKeys(currentNetwork)
console.log('CONNECT (regKeysResponse)', regKeysResponse)

                    const identityId = regKeysResponse?.identityId
console.log('CONNECT (identityId)', identityId)

                    const regPubKeys = regKeysResponse?.regPubKeys
console.log('CONNECT (regPubKeys)', regPubKeys)

                    /* Validate Identity ID and public keys. */
                    if (identityId && regPubKeys) {
                        const signingPublicKey = regPubKeys.find((_pubkey: any) => {
                            return _pubkey.purpose === 0 && (_pubkey.securityLevel === 1 || _pubkey.securityLevel === 2)
                        })
console.log('CONNECT (signingPublicKey)', signingPublicKey)

                        const signingPrivateKey = publicKeys.find(_pubkey => {
                            return _pubkey.id === signingPublicKey.id
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
            }

            // NOTE: WAIT UP TO 10 MINUTES FOR DEPOSIT
            if (++attemptsCounter === PAYMENT_DETECTION_CYCLES) {
                /* Stop the timer/interval. */
                clearTimeout(paymentDetectionHandler)
console.log('TIMER STOPPED (after 15 minutes)')

                /* Set submission flag. */
                setIsSubmitting(false)

                alert(`Your payment has EXPIRED! Please REFRESH and try again...`)
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
                const { profileService } = await import('@/lib/services/profile-service')
                const ps = new profileService(network!)
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

                            {/* BEGIN PAYMENT INFORMATION HERE */}
                            {paymentAddress &&
                                <section className="w-full mb-5 flex flex-col items-center justify-center shadow">
                                    <QRCodeSVG
                                        value={paymentAddress || ''}
                                        size={360}
                                        onClick={() => handlePayment()}
                                        className="cursor-pointer"
                                    />

                                    <div className="mt-5 px-3 py-5 flex flex-col gap-5 rounded-lg border border-evonext-700 bg-evonext-50">
                                        <h2 className="font-medium text-2xl text-evonext-800 text-center">
                                            Just One FINAL Step to Complete Your NEW Identity + Username Registration
                                        </h2>

                                        <h3 className="font-medium text-xl text-evonext-800 text-center">
                                            Send
                                            <button
                                                className="px-1 text-2xl font-bold text-evonext-600"
                                                onClick={() => handlePayment()}
                                            >
                                                {dpns_is_contested_username(username) && <>{CONTESTED_REG_FEE} DASH</>}
                                                {!dpns_is_contested_username(username) && <>{NON_CONTESTED_REG_FEE} DASH</>}
                                            </button>
                                            to the payment address shown below -OR- click the QRCode shown above
                                        </h3>

                                        <button onClick={() => handlePayment()} className="font-bold text-md text-evonext-600 text-center tracking-tighter">
                                            {paymentAddress ? paymentAddress.slice(5, -11) : 'loading...'}
                                        </button>

                                        <p className="font-base text-sm text-evonext-800">
                                            <span className="block font-medium text-md tracking-wider">PLEASE NOTE:</span>
                                            You <span className="font-bold">DO NOT</span> have to keep this window open.
                                            You will receive an email as soon as your NEW Username registration is complete.
                                        </p>
                                    </div>
                                </section>
                            }
                            {/* END PAYMENT INFORMATION HERE */}

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

                                <div>
                                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Order Confirmation Email <span className="italic">(optional)</span>
                                    </label>

                                    <div className="relative">
                                        <Input
                                            id="email"
                                            type="text"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                            placeholder="john.doe@dash.org"
                                            className="pr-10"
                                            autoComplete="off"
                                            maxLength={100}
                                        />
                                    </div>

                                    <div className="pl-1 mt-4 space-y-2 text-xs text-gray-500">
                                        <h3 className="font-bold">
                                            PLEASE NOTE:
                                        </h3>

                                        <p>
                                            If you are concerned about privacy, you <span className="font-bold">DO NOT</span> need to provide an email address.
                                            We <span className="font-bold">ONLY</span> ask, for your convenience, in case we need to contact you regarding your order.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full text-xl"
                                    // disabled={!username || !isAvailable || !!validationError || isChecking || isSubmitting || !currentIdentityId}
                                    disabled={!username || !isAvailable || !!validationError || isChecking || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Waiting for Payment...
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
