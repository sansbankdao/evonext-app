'use client'

import React, { useState, useEffect } from 'react'
import { wasmSdkService, identityService, postService } from '@/lib/services'

export default function TestWasmPage() {
    const [status, setStatus] = useState<string>('Not initialized')
    const [identity, setIdentity] = useState<any>(null)
    const [posts, setPosts] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        testWasmSdk()
    }, [])

    const testWasmSdk = async () => {
        try {
            setStatus('Initializing WASM SDK...')

            // Initialize SDK
            await wasmSdkService.initialize({
                network: 'testnet',
                contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || ''
            })

            setStatus('WASM SDK initialized successfully!')

            // Test identity fetch
            const testIdentityId = process.env.NEXT_PUBLIC_IDENTITY_ID || ''

            if (testIdentityId) {
                setStatus('Fetching identity...')
                const identityData = await identityService.getIdentity(testIdentityId)
                setIdentity(identityData)
                setStatus('Identity fetched successfully!')
            }

            // Test post query
            setStatus('Querying posts...')

            try {
                const postResult = await postService.getTimeline({ limit: 5 })
                setPosts(postResult.documents)
                setStatus(`Found ${postResult.documents.length} posts`)
            } catch (queryError) {
                console.warn('Post query failed (expected):', queryError)
                setStatus('SDK initialized, but queries not yet fully implemented')
            }
        } catch (err) {
            console.error('Error:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">WASM SDK Test Page</h1>

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

            {identity && (
                <div className="bg-blue-100 p-4 rounded mb-4">
                    <h2 className="font-semibold mb-2">Identity:</h2>
                    <pre className="text-sm">{JSON.stringify(identity, null, 2)}</pre>
                </div>
            )}

            {posts.length > 0 && (
                <div className="bg-green-100 p-4 rounded">
                    <h2 className="font-semibold mb-2">Posts:</h2>

                    {posts.map((post, index) => (
                        <div key={index} className="mb-2 p-2 bg-white rounded">
                            <p className="text-sm"><strong>Author:</strong> {post.author.username}</p>
                            <p className="text-sm"><strong>Content:</strong> {post.content}</p>
                            <p className="text-xs text-gray-500">
                                {new Date(post.createdAt).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
