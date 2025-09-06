'use client'

import React, { useState, useEffect } from 'react'
import { wasmSdkService } from '@/lib/services'
import { get_documents } from '@/lib/dash-wasm/wasm_sdk'
import { EVONEXT_CONTRACT_ID } from '@/lib/constants'

const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

export default function TestDpnsDebugPage() {
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        initializeSdk()
    }, [])

    const initializeSdk = async () => {
        try {
            await wasmSdkService.initialize({
                network: 'testnet',
                contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || EVONEXT_CONTRACT_ID || ''
            })
        } catch (err) {
            console.error('Error initializing SDK:', err)
        }
    }

    const testQuery = async (whereClause?: string, description?: string) => {
        try {
            setLoading(true)
            setError(null)
            setResult(null)

            const sdk = await wasmSdkService.getSdk()

            console.log(`Testing query: ${description}`)
            console.log('Where clause:', whereClause)

            const response = await get_documents(
                sdk,
                DPNS_CONTRACT_ID,
                'domain',
                whereClause || null,
                JSON.stringify([['$createdAt', 'desc']]),
                5,
                null,
                null
            )

            setResult(response)
            console.log('Response:', response)
        } catch (err: any) {
            console.error('Query error:', err)
            setError(err.message || err.toString())
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">DPNS Debug Page</h1>

            <div className="space-y-4">
                <button
                    onClick={() => testQuery(undefined, 'No where clause - get all domains')}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    disabled={loading}
                >
                    Test: Get All Domains (no where)
                </button>

                <button
                    onClick={() => testQuery(
                        JSON.stringify([['normalizedLabel', '==', 'test']]),
                        'Query by normalizedLabel'
                    )}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                    disabled={loading}
                >
                    Test: Query by normalizedLabel
                </button>

                <button
                    onClick={() => testQuery(
                        JSON.stringify([
                            ['normalizedParentDomainName', '==', 'dash'],
                            ['normalizedLabel', '==', 'test']
                        ]),
                        'Query by parentNameAndLabel index'
                    )}
                    className="bg-purple-500 text-white px-4 py-2 rounded"
                    disabled={loading}
                >
                    Test: Query by parentNameAndLabel
                </button>

                <button
                    onClick={() => testQuery(
                        JSON.stringify([['$ownerId', '==', process.env.NEXT_PUBLIC_IDENTITY_ID]]),
                        'Query by $ownerId'
                    )}
                    className="bg-yellow-500 text-white px-4 py-2 rounded"
                    disabled={loading}
                >
                    Test: Query by $ownerId
                </button>
            </div>

            {loading && <p className="mt-4">Loading...</p>}

            {error && (
                <div className="mt-4 p-4 bg-red-100 rounded">
                    <h3 className="font-bold text-red-700">Error:</h3>
                    <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
                </div>
            )}

            {result && (
                <div className="mt-4 p-4 bg-green-100 rounded">
                    <h3 className="font-bold text-green-700">Result:</h3>
                    <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}

            <div className="mt-6 text-sm text-gray-600">
                <p>DPNS Contract ID: {DPNS_CONTRACT_ID}</p>
                <p>Identity ID: {process.env.NEXT_PUBLIC_IDENTITY_ID}</p>
            </div>
        </div>
    )
}
