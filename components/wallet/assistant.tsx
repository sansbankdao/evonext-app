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
        <main className="p-3">
            <h1 className="text-slate-800 text-7xl font-bold">
                Dash ID Assistant
            </h1>

            <p className="text-xl xl:text-2xl text-zinc-300 text-pretty">
                A collection of useful tools for everyday use.
            </p>

            {/* <input
                v-model="query"
                id="platform-id"
                type="text"
                placeholder="Search for a Dash ID"
                className="px-5 py-3 text-3xl text-slate-900 bg-sky-50 border rounded-xl shadow"
            /> */}

            <button onClick={search} id="btn-find-id" className="w-full sm:w-fit flex text-2xl font-bold tracking-wider bg-amber-200">
                Find
            </button>

            <button onClick={Identity.destroy} id="btn-find-id" className="w-full sm:w-fit flex text-2xl font-bold tracking-wider bg-amber-200">
                LOGOUT
            </button>
        </main>
    )
}
