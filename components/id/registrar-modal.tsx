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
import QRCode from 'qrcode'
import {
    derive_key_from_seed_with_path,
    get_identity_by_public_key_hash,
    get_identity_by_non_unique_public_key_hash,
    validate_mnemonic,
} from '@/lib/dash-wasm/wasm_sdk'

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

    const { user } = useAuth()
    const { network } = useNetwork()
    const { isReady: isSdkReady, error: sdkError } = useSdk()

    const [email, setEmail] = useState('')
    const [username, setRegistrar] = useState('')
    const [isChecking, setIsChecking] = useState(false)
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCheckingExisting, setIsCheckingExisting] = useState(false)
    const [isEditingIdentity, setIsEditingIdentity] = useState(false)
    const [isShowingPayment, setIsShowingPayment] = useState(false)
    const [customIdentityId, setCustomIdentityId] = useState(initialIdentityId || '')

    const [paymentAddress, setPaymentAddress] = useState(null)

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

        // if (username.length > 20) {
        //     setValidationError('Username must be 20 characters or less')
        //     setIsAvailable(false)

        //     return
        // }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setValidationError('Username can only contain letters, numbers, and underscores')
            setIsAvailable(false)

            return
        }

        if (username.startsWith('_') || username.endsWith('_')) {
            setValidationError('Username cannot start or end with underscore')
            setIsAvailable(false)

            return
        }

        if (username.includes('__')) {
            setValidationError('Username cannot contain consecutive underscores')
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
        alert('lets make that payment')
        const dashUri = `dash:${paymentAddress}?amount=1000000`
        window.location.href = dashUri
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

// setIsShowingPayment(true)
setIsSubmitting(true)

const { getMnemonic } = await import('@/lib/secure-storage')
const mnemonic = getMnemonic()
console.log('MNEMONIC', mnemonic)
const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
console.log('CURRENT NETWORK', currentNetwork)
const identityIndex = 0

const masterKeyPath = `m/9'/${currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${identityIndex}'/0'`
const masterKey = derive_key_from_seed_with_path(mnemonic!, undefined, masterKeyPath, currentNetwork)
console.log('Master key object:', masterKey)
console.log('Master key (public_key):', masterKey.public_key)

// Additional authentication key (critical security)
const authCriticalPath = `m/9'/${currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${identityIndex}'/1'`
const authCritical = derive_key_from_seed_with_path(mnemonic!, undefined, authCriticalPath, currentNetwork)

// Additional authentication key (high security)
const authHighPath = `m/9'/${currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${identityIndex}'/2'`
const authHigh = derive_key_from_seed_with_path(mnemonic!, undefined, authHighPath, currentNetwork)

// Transfer key (critical security)
const transferKeyPath = `m/9'/${currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${identityIndex}'/3'`
const transferKey = derive_key_from_seed_with_path(mnemonic!, undefined, transferKeyPath, currentNetwork)

// Transfer key (critical security)
const encryptionKeyPath = `m/9'/${currentNetwork === 'mainnet' ? 5 : 1}'/5'/0'/0'/${identityIndex}'/4'`
const encryptionKey = derive_key_from_seed_with_path(mnemonic!, undefined, encryptionKeyPath, currentNetwork)

const body = JSON.stringify({
    masterKey: masterKey.public_key,
    authCriticalKey: authCritical.public_key,
    authHighKey: authHigh.public_key,
    transferKey: transferKey.public_key,
    encryptionKey: encryptionKey.public_key,
    username,
    emailAddr: email,
})
console.log('ORDER (body)', body)

        const addressResponse = await fetch('https://evonext.app/v1/registrar/address', {
            method: 'POST',
            body,
        }).catch(err => console.error(err))
        const json = await addressResponse!.json()
console.log('PAYMENT ADDRESS', json)

        const paymentAddress = json?.registrar?.dashAddr
        setPaymentAddress(paymentAddress)

        const orderResponse = await fetch('https://evonext.app/v1/registrar/order', {
            method: 'POST',
            body,
        }).catch(err => console.error(err))
        const orderConfirm = await orderResponse!.json()
console.log('ORDER CONFIRM', orderConfirm)

const paymentWin = document.getElementById('payment-win')
const canvas = document.getElementById('qrcode')
const dataUrl = await QRCode.toDataURL(paymentAddress)
    .catch((err: any) => console.error(err))
console.log('DATA URL', dataUrl)
// canvas!.innerHTML = dataUrl

const imgEl = document.createElement('img')
imgEl.src = dataUrl
imgEl.width = 600
imgEl.height = 600

canvas!.appendChild(imgEl)
paymentWin!.style.display = 'flex'
    }

    const getStatusIcon = () => {
        if (isChecking) {
            return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        }

        if (validationError) {
            return <XCircle className="w-5 h-5 text-red-500" />
        }

        if (isAvailable === true) {
            return <CheckCircle2 className="w-5 h-5 text-green-500" />
        }

        if (isAvailable === false) {
            return <XCircle className="w-5 h-5 text-red-500" />
        }

        return null
    }

    const getStatusMessage = () => {
        if (validationError) {
            return <p className="text-sm text-red-600 mt-1">{validationError}</p>
        }

        if (isChecking) {
            return <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
        }

        if (isAvailable === true) {
            return <p className="text-sm text-green-600 mt-1">Username is available!</p>
        }

        if (isAvailable === false) {
            return <p className="text-sm text-red-600 mt-1">Username is already taken</p>
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 flex items-center justify-center z-50 px-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full relative h-full overflow-y-auto">
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h1 className="text-3xl font-bold text-center mb-2">
                                EvoNext Registrar
                            </h1>

                            <p className="px-8 text-gray-600 dark:text-gray-400 text-center mb-6 text-pretty">
                                Choose a NEW &amp; Unique Username for your Dash Platform Identity
                            </p>

{/* DISPLAY PAYMENT INFORMATION HERE */}
<section id="payment-win" style={{ display: 'none' }} className="w-full mb-5 flex flex-col items-center justify-center border border-evonext-700 shadow">
    <div id="qrcode" onClick={() => handlePayment()} />

    <div className="px-3 py-5 flex flex-col gap-5 rounded-t-lg border-t-2 border-evonext-700 bg-evonext-50">
        <h2 className="font-medium text-2xl text-evonext-800 text-center">
            One Final Step to Complete Your Username Registration
        </h2>

        <h3 className="font-medium text-xl text-evonext-800 text-center">
            Send <button className="text-2xl font-bold text-evonext-600">0.1 DASH</button> to the payment address shown below -OR- click the QRCode shown above
        </h3>

        <button onClick={() => handlePayment()} className="font-bold text-md text-evonext-600 text-center tracking-tighter">
            {paymentAddress}
        </button>

        <p className="font-base text-sm text-evonext-800">
            <span className="block font-medium text-md tracking-wider">PLEASE NOTE:</span>
            You <span className="font-bold">DO NOT</span> have to keep this window open.
            You will receive an email as soon as your NEW Username registration is complete.
        </p>
    </div>
</section>

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
                                            onChange={(e) => setRegistrar(e.target.value)}
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
                                            Registrar Requirements:
                                        </h3>

                                        <ul className="list-disc list-inside space-y-1 ml-2">
                                            <li>At least 3 characters long</li>
                                            <li>Letters, numbers, and underscores only</li>
                                            <li>Cannot start or end with underscore</li>
                                            <li>No consecutive underscores</li>
                                        </ul>
                                    </div>

                                    <div className="pl-1 mt-4 space-y-2 text-xs text-gray-500">
                                        <h3 className="font-bold">
                                            IMPORTANT NOTE:
                                        </h3>

                                        <p>
                                            Any username that is under 20 characters in length -OR- ONLY contains the numbers 0 and 1, will required approval by the Master Node Operators that guard against abuses of the network.
                                        </p>

                                        <p>
                                            This voting period takes <span className="font-bold">TWO (2) WEEKS</span> to complete, and is completely out of the control of EvoNext.
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
