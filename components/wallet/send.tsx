'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

interface Token {
    id: string;
}

interface WalletSendProps {
    isFullScreen: boolean;
}

export function WalletSend({ isFullScreen }: WalletSendProps) {
    const { user } =  useAuth()
    const [displayLog, setDisplayLog] = useState(null)

    return (
        <main className="">
            <h1 className="">
            WalletSend
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Maiores fugit odit debitis ipsam in laborum quia minima quae. Alias est illum facilis nemo quisquam quidem soluta, consequuntur optio at ipsum.
            </h1>
        </main>
    )
}
