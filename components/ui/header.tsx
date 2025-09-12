'use client'

import Link from 'next/link'
import packageJson from '@/package.json'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

export function Header() {
    const { user } =  useAuth()

    return (
        <div className="absolute top-0 z-50 w-screen h-14 sm:h-16 lg:h-[72px] bg-evonext-500 text-white px-4 py-2 text-sm">
            <div className="pr-7 absolute top-2.5 w-full max-w-7xl mx-auto flex items-center justify-between">
                <p className="text-center flex md:flex-col text-sm font-mono tracking-wider items-center">
                    <Link href="/" className="px-2 text-4xl sm:text-5xl font-bold inline tracking-wider">
                        EvoNext
                    </Link>

                    <span className="hidden lg:inline-flex lg:-mt-2 text-xs">
                        <span>early preview release</span>
                        <span className="px-1">—</span>
                        <span className="opacity-90">
                            latest v{packageJson.version}
                        </span>
                        <span className="px-1">—</span>
                        <span className="block opacity-90">
                            <Link href="https://github.com/sansbankdao/evonext-app/issues" target="_blank" className="px-1 text-purple-100 font-bold hover:underline">
                                report issues here
                            </Link>
                        </span>
                    </span>
                </p>

                {user && <>
                    <Link
                        href="/profile"
                        className="-mt-1 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
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
                        className="-mt-1 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
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
