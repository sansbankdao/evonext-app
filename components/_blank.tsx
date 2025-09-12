'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

export function Blank() {
    const { user } =  useAuth()
    const [displayLog, setDisplayLog] = useState(null)

    return (
        <main className="">
        <h1 className="">
            Blank
        </h1>
    </main>
    )
}
