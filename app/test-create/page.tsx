'use client'

import React, { useState } from 'react'
import {
    likeService,
    postService,
    profileService,
    wasmSdkService,
} from '@/lib/services'
import { EVONEXT_CONTRACT_ID_TESTNET } from '@/lib/constants'

export default function TestCreatePage() {
    const [status, setStatus] = useState<string>('Ready')
    const [error, setError] = useState<string | null>(null)
    const [privateKey, setPrivateKey] = useState<string>('')
    const [identityId, setIdentityId] = useState<string>('')
    const [postContent, setPostContent] = useState<string>('Hello from WASM SDK!')
    const [profileName, setProfileName] = useState<string>('Test User')
    const [profileBio, setProfileBio] = useState<string>('Testing the WASM SDK')

    const testCreatePost = async () => {
        try {
            setStatus('Creating post...')
            setError(null)

            // Store private key in session for state transitions
            sessionStorage.setItem('evonext_pk', privateKey)

            const post = await postService.createPost(
                identityId,
                postContent,
                undefined, // remix
                {
                    language: 'en',
                    isSensitive: false
                }
            )

            setStatus('Post created successfully!')
            console.log('Created post:', post)
        } catch (err) {
            console.error('Error creating post:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const testLikePost = async () => {
        try {
            setStatus('Liking post...')
            setError(null)

            // Store private key in session for state transitions
            sessionStorage.setItem('evonext_pk', privateKey)

            const post = await likeService.likePost(
                'DtLm5smKwE9B7ekpVPcXJ18UsdSopcfbVUu3qBYFj3Yf',
                identityId,
            )

            setStatus('Post liked successfully!')
            console.log('Liked post:', post)
        } catch (err) {
            console.error('Error creating post:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const testCreateProfile = async () => {
        try {
            setStatus('Creating profile...')
            setError(null)

            // Store private key in session for state transitions
            sessionStorage.setItem('evonext_pk', privateKey)

            // const profile = await profileService.createProfile(
            //     identityId,
            //     profileName,
            //     profileBio
            // )
            const profile = await profileService.updateProfile(
                identityId,
                {
                    displayName: profileName,
                    bio: profileBio,
                },
            )

            setStatus('Profile created successfully!')
            console.log('Created profile:', profile)
        } catch (err) {
            console.error('Error creating profile:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    const initializeSdk = async () => {
        try {
            setStatus('Initializing WASM SDK...')

            await wasmSdkService.initialize({
                network: 'testnet',
                contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || EVONEXT_CONTRACT_ID_TESTNET || '',
            })

            setStatus('SDK initialized')
        } catch (err) {
            console.error('Error initializing SDK:', err)
            setError(err instanceof Error ? err.message : 'Unknown error')
            setStatus('Error occurred')
        }
    }

    return (
        <div className="py-20 container mx-auto p-8 h-screen overflow-y-scroll">
            <h1 className="text-3xl font-bold mb-6">Test Document Creation</h1>

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

            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium mb-2">Identity ID:</label>

                    <input
                        type="text"
                        value={identityId}
                        onChange={(e) => setIdentityId(e.target.value)}
                        placeholder={process.env.NEXT_PUBLIC_IDENTITY_ID}
                        className="w-full p-2 border rounded"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Private Key (WIF):</label>
                    <input
                        type="password"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder="Enter private key..."
                        className="w-full p-2 border rounded"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded">
                    <h3 className="font-semibold mb-4">Test Post Creation</h3>

                    <div className="space-y-4">
                        <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="Post content..."
                            className="w-full p-2 border rounded"
                            rows={3}
                        />

                        <button
                            onClick={testCreatePost}
                            disabled={!privateKey || !identityId}
                            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
                        >
                            Create Post
                        </button>

                        <button
                            onClick={testLikePost}
                            disabled={!privateKey || !identityId}
                            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
                        >
                            Like Post
                        </button>
                    </div>
                </div>

                <div className="bg-green-50 p-4 rounded">
                    <h3 className="font-semibold mb-4">Test Profile Creation</h3>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="Display name..."
                            className="w-full p-2 border rounded"
                        />

                        <textarea
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            placeholder="Bio..."
                            className="w-full p-2 border rounded"
                            rows={2}
                        />

                        <button
                            onClick={testCreateProfile}
                            disabled={!privateKey || !identityId}
                            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
                        >
                            Create Profile
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <button
                    onClick={initializeSdk}
                    className="bg-purple-500 text-white px-4 py-2 rounded"
                >
                    Initialize SDK
                </button>
            </div>

            <div className="mt-6 text-sm text-gray-600">
                <p>Note: Use the test identity ID and private key from .env file</p>
                <p>Identity ID: {process.env.NEXT_PUBLIC_IDENTITY_ID}</p>
            </div>
        </div>
    )
}
