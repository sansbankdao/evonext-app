'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

interface Token {
    id: string;
}

interface WalletAssistantProps {
    isFullScreen: boolean;
}

export function WalletAssistant({ isFullScreen }: WalletAssistantProps) {
    const { user } =  useAuth()
    const [displayLog, setDisplayLog] = useState(null)

    const search = async () => {
        console.log('START SEARCH')
    }

    const Identity = {
        setAsset: (tokenid: string) => {},
        destroy: () => {},
    }

    return (
        <main className="relative p-3 flex flex-col gap-4">
            <h1 className="text-slate-800 text-4xl font-bold tracking-wider">
                Platform Assistant
            </h1>

            <p className="text-xl xl:text-2xl text-zinc-300 text-pretty">
                A collection of useful tools for everyday use.
            </p>

            <ul>
                <li>Search for Platform users</li>
                <li>Purchase gift cards instantly</li>
            </ul>

            <textarea
                // v-model="query"
                placeholder="What can I help you with today?"
                className="w-full max-w-2xl px-5 py-3 text-xl text-slate-900 bg-sky-50 border rounded-xl shadow"
            />

            <button onClick={search} className="w-full sm:w-fit px-5 py-2 text-2xl font-bold tracking-wider text-sky-800 bg-sky-200 border-2 border-sky-400 rounded-xl shadow hover:bg-sky-900 hover:text-sky-200">
                Make Request
            </button>

            <button onClick={Identity.destroy} className="absolute top-5 right-5 w-fit px-5 py-3 text-2xl font-bold tracking-wider text-red-800 bg-red-200 border-2 border-red-400 rounded-xl shadow hover:bg-red-900 hover:text-red-200">
                SIGN-OUT OF EVONEXT
            </button>
        </main>
    )
}
