'use client'

import Link from 'next/link'
import packageJson from '@/package.json'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { BellIcon, BoltIcon, UserIcon } from '@heroicons/react/24/outline'

export function Header() {
    const { user } =  useAuth()
    const { network } =  useNetwork()

    return (
        <div className="absolute top-0 z-40 w-screen h-14 sm:h-16 lg:h-[72px] text-white px-4 py-2 text-sm overflow-hidden shadow-[0_2px_16px_rgba(199,2,132,0.35)]">
            {/* Layered background: brand gradient + light blooms + a fine
                diagonal weave + a top sheen — replaces the flat fuchsia. */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(100deg,#6e0c4a_0%,#a10369_18%,#c70284_38%,#e90ea5_58%,#f838bd_82%,#fc7dd3_100%)]"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(120%_200%_at_0%_0%,rgba(255,255,255,0.18),transparent_42%)]"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(90%_170%_at_100%_130%,rgba(88,28,135,0.5),transparent_58%)]"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(60%_120%_at_72%_-20%,rgba(255,209,238,0.25),transparent_55%)]"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.05)_0px,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_7px)]"
            />
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-white/25"
            />
            <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-px bg-black/15"
            />
            <div className="relative z-10 pr-7 top-2.5 w-full max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="-mt-2 sm:-mt-2 lg:-mt-1 flex md:flex-col text-sm font-mono tracking-wider items-center">
                    <span className={`px-2 text-4xl sm:text-5xl font-bold inline tracking-wider ${network !== 'mainnet' ? '' : 'pt-3'}`}>
                        ΞvoNext

                        {network !== 'mainnet' && <>
                            <span className="w-fit flex ml-40 sm:ml-52 lg:ml-52 -mt-7 sm:-mt-9 lg:-mt-9">
                                <h3 className="-rotate-90 tracking-tighter text-xs sm:text-sm uppercase text-yellow-100 font-bold animate-pulse">
                                    Testnet
                                </h3>

                                <h3 className="hidden sm:inline-flex -ml-8 rotate-90 tracking-tighter text-xs sm:text-sm uppercase text-yellow-100 font-bold animate-pulse">
                                    Testnet
                                </h3>
                            </span>
                        </>}
                    </span>
                </Link>

                <div className="-mt-0 sm:mt-1 -mr-7 sm:-mr-6 lg:mr-0 lg:mt-2 flex items-center gap-2">
                    {user && <Link
                        href="/notifications"
                        className="flex items-center px-2 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        title="Notifications"
                    >
                        <BellIcon className="h-6" />
                    </Link>}

                    {user && <Link
                        href="/profile"
                        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        title="Clear cache and reload"
                    >
                        <UserIcon className="h-6" />

                        <span className="font-mono text-2xl">
                            Profile
                        </span>
                    </Link>}

                    {!user && <Link
                        href="/connect"
                        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        title="Clear cache and reload"
                    >
                        <BoltIcon className="h-6" />

                        <span className="font-mono text-2xl">
                            Connect
                        </span>
                    </Link>}
                </div>
            </div>
        </div>
    )
}
