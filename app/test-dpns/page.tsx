'use client'

import React, { useState, useEffect } from 'react'
import { wasmSdkService, dpnsService } from '@/lib/services'
import { EVONEXT_CONTRACT_ID_ALT } from '@/lib/constants'

export default function TestDpnsPage() {
    const [status, setStatus] = useState<string>('Not initialized')
    const [error, setError] = useState<string | null>(null)

    // Test inputs
    const [testIdentityId, setTestIdentityId] = useState<string>('')
    const [testUsername, setTestUsername] = useState<string>('')
    const [searchPrefix, setSearchPrefix] = useState<string>('')

    // Results
    const [resolvedUsername, setResolvedUsername] = useState<string | null>(null)
    const [resolvedIdentity, setResolvedIdentity] = useState<string | null>(null)
    const [searchResults, setSearchResults] = useState<string[]>([])
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)

    useEffect(() => {
        initializeSdk()
    }, [])

    const initializeSdk = async () => {
        try {
            setStatus('Initializing WASM SDK...')
            await wasmSdkService.initialize({
                network: 'testnet',
                contractId: EVONEXT_CONTRACT_ID_ALT
            })
            setStatus('SDK initialized - DPNS ready!')
            setError(null)
        } catch (err) {
            console.error('Error initializing SDK:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Initialization failed')
        }
    }

    const testResolveUsername = async () => {
        try {
            setStatus('Resolving username from identity...')
            setError(null)
            const username = await dpnsService.resolveUsername(testIdentityId)
            setResolvedUsername(username)
            setStatus(username ? `Found username: ${username}` : 'No username found for this identity')
        } catch (err) {
            console.error('Error resolving username:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const testResolveIdentity = async () => {
        try {
            setStatus('Resolving identity from username...')
            setError(null)
            const identity = await dpnsService.resolveIdentity(testUsername)
            setResolvedIdentity(identity)
            setStatus(identity ? `Found identity: ${identity}` : 'No identity found for this username')
        } catch (err) {
            console.error('Error resolving identity:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const testSearchUsernames = async () => {
        try {
            setStatus('Searching usernames...')
            setError(null)
            const results = await dpnsService.searchUsernames(searchPrefix, 10)
            setSearchResults(results)
            setStatus(`Found ${results.length} usernames`)
        } catch (err) {
            console.error('Error searching usernames:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const testUsernameAvailability = async () => {
        try {
            setStatus('Checking username availability...')
            setError(null)
            const available = await dpnsService.isUsernameAvailable(testUsername)
            setIsAvailable(available)
            setStatus(available ? 'Username is available!' : 'Username is taken')
        } catch (err) {
            console.error('Error checking availability:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">
                DPNS Resolution Test
            </h1>

            <div className="bg-gray-100 p-4 rounded mb-4">
                <h2 className="font-semibold mb-2">Status:</h2>
                <p className={error ? 'text-red-600' : 'text-green-600'}>{status}</p>
            </div>

            {error && (
                <div className="bg-red-100 p-4 rounded mb-4">
                    <h2 className="font-semibold mb-2">Error:</h2>
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-6">
                {/* Resolve Username from Identity */}
                <div className="bg-blue-50 p-4 rounded">
                    <h3 className="font-semibold mb-4">Identity → Username</h3>

                    <input
                        type="text"
                        value={testIdentityId}
                        onChange={(e) => setTestIdentityId(e.target.value)}
                        placeholder="Enter identity ID..."
                        className="w-full p-2 border rounded mb-3"
                    />

                    <button
                        onClick={testResolveUsername}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                        Resolve Username
                    </button>

                    {resolvedUsername && (
                        <div className="mt-3 p-2 bg-white rounded">
                            <strong>Username:</strong> {resolvedUsername}
                        </div>
                    )}
                </div>

                {/* Resolve Identity from Username */}
                <div className="bg-green-50 p-4 rounded">
                    <h3 className="font-semibold mb-4">Username → Identity</h3>

                    <input
                        type="text"
                        value={testUsername}
                        onChange={(e) => setTestUsername(e.target.value)}
                        placeholder="Enter username (e.g. alice.dash)..."
                        className="w-full p-2 border rounded mb-3"
                    />

                    <div className="space-x-2">
                        <button
                            onClick={testResolveIdentity}
                            className="bg-green-500 text-white px-4 py-2 rounded"
                        >
                            Resolve Identity
                        </button>

                        <button
                            onClick={testUsernameAvailability}
                            className="bg-purple-500 text-white px-4 py-2 rounded"
                        >
                            Check Availability
                        </button>
                    </div>

                    {resolvedIdentity && (
                        <div className="mt-3 p-2 bg-white rounded">
                            <strong>Identity:</strong> {resolvedIdentity}
                        </div>
                    )}

                    {isAvailable !== null && (
                        <div className="mt-3 p-2 bg-white rounded">
                            <strong>Available:</strong> {isAvailable ? 'Yes' : 'No'}
                        </div>
                    )}
                </div>

                {/* Search Usernames */}
                <div className="bg-yellow-50 p-4 rounded col-span-2">
                    <h3 className="font-semibold mb-4">Search Usernames</h3>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={searchPrefix}
                            onChange={(e) => setSearchPrefix(e.target.value)}
                            placeholder="Enter prefix to search..."
                            className="flex-1 p-2 border rounded"
                        />

                        <button
                            onClick={testSearchUsernames}
                            className="bg-yellow-500 text-white px-4 py-2 rounded"
                        >
                            Search
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-3 p-2 bg-white rounded">
                            <strong>Results:</strong>

                            <ul className="list-disc list-inside mt-2">
                                {searchResults.map((name, idx) => (
                                    <li key={idx}>{name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 text-sm text-gray-600">
                <p>Note: DPNS resolution now works through document queries!</p>
                <p>Contract ID: {DPNS_CONTRACT_ID}</p>
                <p>Test Identity: {process.env.NEXT_PUBLIC_IDENTITY_ID}</p>
            </div>
        </div>
    )
}

// Export the constant so TypeScript doesn't complain
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
