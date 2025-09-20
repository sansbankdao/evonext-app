'use client'

import { ChangeEvent, useState, ClipboardEvent } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { Button } from '@/components/ui/button'
import { RegistrarModal } from '@/components/id/registrar-modal'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { getIdentities } from '@/lib/identity-manager'
import {
    checkPendingStatus,
    registerIdentityAndUsername,
} from '@/lib/registrar-manager'
import { getPrivateKeys, getPublicKeys } from '@/lib/wallet-manager'
import { validate_mnemonic } from '@/lib/dash-wasm/wasm_sdk'

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const { network } = useNetwork()
    const [identityId, setIdentityId] = useState('')
    const [privateKey, setPrivateKey] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isResuming, setIsResuming] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [hasIdentityPrivateKey, setHasIdentityPrivateKey] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mnemonic, setMnemonic] = useState(Array(12).fill(''))

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

    const handleMnemonic = async (_mnemonic: any) => {
        /* Set the mnemonic (store). */
        setMnemonic(_mnemonic)

        /* Join an array of seed words. */
        const mnemonic = _mnemonic.join(' ')

        /* Set current network. */
        const currentNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'

        /* Validate mnemonic. */
        const isValid = validate_mnemonic(mnemonic)

        /* Validate mnemonic. */
        if (!isValid) {
            return toast.error(`Oops! Those seed words are INVALID!`)
        }

        /* Initialize secure storage. */
        const { getIdentityIdx, storeMnemonic } = await import('@/lib/secure-storage')

        /* Save mnemonic (to secure storage). */
        storeMnemonic(mnemonic)

        /* Request Identity index. */
        const identityIdx = getIdentityIdx()

        /* Request private keys. */
        const privateKeys = getPrivateKeys(currentNetwork, identityIdx)

        /* Request public keys. */
        const publicKeys = getPublicKeys(currentNetwork, identityIdx)

        /* Request ALL (registered) Identities. */
        const regIdentities = await getIdentities(currentNetwork)
console.log('CONNECT (regIdentities)', regIdentities)

        const identityId = regIdentities![0].id
console.log('CONNECT (identityId)', identityId)

        const regPubKeys = regIdentities![0].publicKeys
console.log('CONNECT (regPubKeys)', regPubKeys)

        /* Validate Identity ID and public keys. */
        if (identityId && regPubKeys) {
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

            try {
                await login(identityId, seedPrivateKey)
                // Navigation handled by auth context
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to login')
            } finally {
                setIsLoading(false)
                setIsResuming(false)
            }
        } else {
// BEGIN NO IDENTITY FOUND
            const publicKey = privateKeys.masterKey.public_key
console.log('CONNECT (publicKey)', publicKey)

            /* Check (pending) status. */
            const status = await checkPendingStatus(currentNetwork, identityIdx)
                .catch(err => console.error(err))
console.log('CONNECT (checkPendingStatus)', status)

            /* Validate (pending) status. */
            if (typeof status !== 'undefined' && status !== null) {
                /* Request user permission to resume registration. */
                if (confirm(`Hey, welcome back!\n\nYou have a pending Identity + Username registration. Are you ready complete it now? It'll ONLY take a few seconds..\n\n!! IMPORTANT NOTICE !!\nAfter you click to resume, DO NOT interrupt the process until it's 100% completed.\n\nOkay, let's GO!`)) {
                    setIsLoading(false)
                    setIsResuming(true)

                    /* Set username. */
                    const username = status.username
console.log('CONNECT (username)', username)

                    /* Set proof. */
                    const proof = status.proof
console.log('CONNECT (proof)', typeof proof, proof)

                    /* Set WIF. */
                    const wif = status.wif
console.log('CONNECT (wif)', typeof wif, wif)

                    /* Register Identity + Username. */
                    const regResult = await registerIdentityAndUsername(
                        currentNetwork, identityIdx, username, proof, wif)
                        .catch(err => console.error(err))
console.log('REGISTRATION RESULT', regResult)

                    setIsResuming(false)


                    /* Redirect user to Profile page and STOP execution. */
                    return router.push('/')
                } else {
                    /* User has rejected the request to RESUME registration. */
                    //NOTE: WE DO NOT WANT TO CONTINUE THRU THE STANDARD PROCESS
                    //      UNTIL REGISTRATION IS 100% COMPLETED
                    return
                }
            }
// END NO IDENTITY FOUND

            /* Present user with NEW Identity + Username registration. */
            if (confirm(`OH NO!\n\nWe COULD NOT find an Identity for you on the Dash Platform. Would you like to create a NEW Identity and register a NEW Username now?\n\nIt should ONLY take about 2 minutes..\nDon't MISS OUT, let's GO!`)) {
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
            /* Split seed words. */
            const splitWords = clipboard.split(' ')

            /* Fill the array with the pasted words. */
            const emptyValuesNeeded = ((splitWords.length > 12) ? 24 : 12) - splitWords.length
            const emptyValues = Array(emptyValuesNeeded).fill('')
            const pastedWords = [ ...splitWords, ...emptyValues ]

            /* Handle mnemonic. */
            await handleMnemonic(pastedWords)

            /* Set loading flag. */
            setIsLoading(false)
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
                await login(identityId, privateKey)
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

    return (<>
            <div className="pt-20 lg:pt-28 pb-48 lg:pb-8 bg-white dark:bg-black flex flex-col items-center px-4 h-screen overflow-y-scroll">
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
                        {!identityId &&
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

                        {!identityId &&
                            <button onClick={toggleExtWords} className="px-5 py-2 bg-sky-700 font-medium text-sky-100 rounded-xl shadow">
                                {(mnemonic.length === 12) && <>switch to 24 word seed phrase</>}
                                {(mnemonic.length === 24) && <>switch to 12 word seed phrase</>}
                            </button>
                        }

                        {!identityId &&
                            <button onClick={togglePrivateKey} className="px-5 py-2 bg-sky-700 font-medium text-sky-100 rounded-xl shadow">
                                switch to using an Identity private key
                                <span className="block italic">(HIGH or CRITICAL)</span>
                            </button>
                        }

                        {hasIdentityPrivateKey && <>
                            <div>
                                <label htmlFor="identityId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Identity ID
                                </label>

                                <input
                                    id="identityId"
                                    type="text"
                                    value={identityId}
                                    onChange={(e) => setIdentityId(e.target.value)}
                                    placeholder="e.g., 5DbLwAxGBzUzo81VewMUwn4b5P4bpv9FNFybi25XB5Bk"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-evonext-500 focus:border-transparent transition-colors"
                                    required
                                />
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
                                disabled={isResuming || isLoading || (!identityId && !privateKey && !hasMnemonic())}
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
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 space-y-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                Requirements:
                            </h3>

                            <ul className="list-disc list-inside space-y-1">
                                <li>A Dash Platform identity</li>
                                <li>At least one high security key</li>
                                <li>Private key in WIF format</li>
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
