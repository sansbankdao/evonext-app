'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

interface Token {
    id: string;
}

interface WalletHistoryProps {
    isFullScreen: boolean;
}

export function WalletHistory({ isFullScreen }: WalletHistoryProps) {
    const { user } =  useAuth()
    const [displayLog, setDisplayLog] = useState(null)

    return (
        <main className="">
            <h1 className="">
                History
            </h1>
        </main>
    )
}
