'use client'

import Link from 'next/link'
import {
    GiftIcon,
    MagnifyingGlassIcon,
    RssIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/auth-context'

export function Footer() {
    const { user, logout } = useAuth()

    if (user) {
        return (
            <footer className="absolute bottom-0 z-30 w-full h-[45px] grid grid-cols-3 lg:hidden gap-0.5 justify-between bg-slate-950 border border-t-stone-700 overflow-hidden">
                <Link href="/posts" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <RssIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        posts
                    </span>
                </Link>

                <Link href="/explore" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <MagnifyingGlassIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        explore
                    </span>
                </Link>

                <Link href="/remix" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <SparklesIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        remix
                    </span>
                </Link>
            </footer>
        )
    } else {
        return (
            <footer className="absolute bottom-0 z-30 w-full h-[45px] grid grid-cols-2 lg:hidden gap-0.5 justify-between bg-slate-950 border border-t-stone-700 overflow-hidden">
                <Link href="/explore" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <MagnifyingGlassIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        explore
                    </span>
                </Link>

                <Link href="/claim" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <GiftIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        claim
                    </span>
                </Link>
            </footer>
        )
    }
}
