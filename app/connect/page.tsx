'use client'

import { ChangeEvent, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [identityId, setIdentityId] = useState('')
    const [privateKey, setPrivateKey] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [hasIdentityPrivateKey, setHasIdentityPrivateKey] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [seedWords, setSeedWords] = useState(Array(12).fill(''))
    const { login } = useAuth()
    const router = useRouter()

    const onMnemonicPaste = (e: ChangeEvent<HTMLInputElement>, idx: number) => {
        const newWords = [...seedWords]
        newWords[idx] = e.target.value
        setSeedWords(newWords)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            await login(identityId, privateKey)
            // Navigation handled by auth context
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to login')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleExtWords = () => {
        const twelve = Array(12).fill('')
        const twentyFour = Array(24).fill('')

        setSeedWords(twentyFour)
    }

    const togglePrivateKey = () => {
        setHasIdentityPrivateKey(true)
    }

    return (
        <div className="pt-24 pb-8 min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gradient mb-2">
                        EvoNext
                    </h1>

                    <p className="text-gray-600 dark:text-gray-400">
                        Get connected with your Dash Platform Identity
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {seedWords.map((word, idx) => (
                                <input
                                    key="text"
                                    placeholder={`Word #${idx + 1}`}
                                    value={seedWords[idx]}
                                    onChange={(e) => onMnemonicPaste(e, idx)}
                                    className={`px-3 py-1 text-slate-800 font-medium border-4 border-sky-200 rounded ${idx >= 24 ? 'hidden' : ''}`}
                                />
                            ))}
                        </div>
                    </div>

                    {!identityId &&
                        <button onClick={toggleExtWords} className="px-5 py-2 bg-sky-700 font-medium text-sky-100 rounded-xl shadow">
                            switch to 24 word seed phrase
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
                            disabled={isLoading || !identityId || !privateKey}
                            className="w-full shadow-evonext-lg text-3xl tracking-wider"
                            size="lg"
                        >
                            {isLoading ? (
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
    )
}
