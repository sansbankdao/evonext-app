'use client'

import Link from 'next/link'
import packageJson from '@/package.json'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

export function Header() {
    const { user } =  useAuth()
    const { network } =  useNetwork()

    return (
        <div className="absolute top-0 z-50 w-screen h-14 sm:h-16 lg:h-[72px] bg-evonext-500 text-white px-4 py-2 text-sm">
            <div className="pr-7 top-2.5 w-full max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="-mt-2 sm:-mt-2 lg:-mt-1 flex md:flex-col text-sm font-mono tracking-wider items-center">
                    <span className={`px-2 text-4xl sm:text-5xl font-bold inline tracking-wider ${network !== 'mainnet' ? '' : 'pt-3'}`}>
                        EvoNext

                        {network !== 'mainnet' && <>
                            <span className="w-fit flex ml-40 sm:ml-52 lg:ml-52 -mt-7 sm:-mt-9 lg:-mt-9">
                                <h3 className="-rotate-90 tracking-tighter text-xs sm:text-sm uppercase text-sky-300 font-bold animate-pulse">
                                    Testnet
                                </h3>

                                <h3 className="hidden sm:inline-flex -ml-8 rotate-90 tracking-tighter text-xs sm:text-sm uppercase text-sky-300 font-bold animate-pulse">
                                    Testnet
                                </h3>
                            </span>
                        </>}
                    </span>
                </Link>

                {user && <>
                    <Link
                        href="/profile"
                        className="-mt-0 sm:mt-1 lg:mt-2 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        title="Clear cache and reload"
                    >
                        <UserIcon className="h-6" />

                        <span className="font-mono text-2xl">
                            Profile
                        </span>
                    </Link>
                </>}

                {!user && <>
                    <Link
                        href="/connect"
                        className="-mt-0 sm:mt-1 lg:mt-2 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        title="Clear cache and reload"
                    >
                        <BoltIcon className="h-6" />

                        <span className="font-mono text-2xl">
                            Connect
                        </span>
                    </Link>
                </>}
            </div>
        </div>
    )
}
