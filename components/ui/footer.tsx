'use client'

import Link from 'next/link'
import {
    GiftIcon,
    MagnifyingGlassIcon,
    RssIcon,
    SparklesIcon,
    Squares2X2Icon,
    WalletIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/auth-context'

export function Footer() {
    const { user, logout } = useAuth()

    if (user) {
        return (
            <footer className="absolute bottom-0 z-30 w-full h-[45px] grid grid-cols-4 lg:hidden gap-0.5 justify-between bg-slate-950 border border-t-stone-700 overflow-hidden">
                <Link href="/posts" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <RssIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Posts
                    </span>
                </Link>

                {/* <Link href="/remix" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <SparklesIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Remix
                    </span>
                </Link> */}

                <Link href="/explore" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <MagnifyingGlassIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Explore
                    </span>
                </Link>

                <Link href="/apps" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <Squares2X2Icon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Apps
                    </span>
                </Link>

                <Link href="/wallet" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <WalletIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Wallet
                    </span>
                </Link>
            </footer>
        )
    } else {
        return (
            <footer className="absolute bottom-0 z-30 w-full h-[45px] grid grid-cols-3 lg:hidden gap-0.5 justify-between bg-slate-950 border border-t-stone-700 overflow-hidden">
                <Link href="/explore" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <MagnifyingGlassIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Explore
                    </span>
                </Link>

                <Link href="/apps" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <Squares2X2Icon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Apps
                    </span>
                </Link>

                <Link href="/claim" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                    <GiftIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                    <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                        Claim
                    </span>
                </Link>
            </footer>
        )
    }
}
