'use client'

import {
    MagnifyingGlassIcon,
    RssIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline'

export function Footer() {

    return (
        <footer className="absolute bottom-0 z-30 w-full h-[45px] grid grid-cols-3 lg:hidden gap-0.5 justify-between bg-slate-900 border border-t-stone-700 overflow-hidden">
            <a href="/feed" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                <RssIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                    timeline
                </span>
            </a>

            <a href="/explore" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                <MagnifyingGlassIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                    explore
                </span>
            </a>

            <a href="/remix" className="group w-full flex flex-col justify-center items-center bg-stone-700 hover:bg-stone-200">
                <SparklesIcon className="mt-0.5 h-5 text-fuchsia-100 font-bold text-lg tracking-wider uppercase group-hover:text-fuchsia-900" />
                <span className="uppercase text-xs font-medium text-fuchsia-300 tracking-wider group-hover:text-fuchsia-900">
                    remix
                </span>
            </a>
        </footer>
    )
}
