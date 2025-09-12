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

    return (
        <main className="">
            <h1 className="">
                Assistant
            </h1>
        </main>
    )
}
