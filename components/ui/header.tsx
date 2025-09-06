'use client'

import packageJson from '@/package.json'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export function Header() {
    return (
        <div className="absolute top-0 z-50 w-full bg-evonext-500 text-white px-4 py-2 text-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <p className="text-center flex md:flex-col text-sm font-mono tracking-wider items-center">
                    <a href="/" className="px-2 text-5xl font-bold inline tracking-wider">
                        EvoNext
                    </a>

                    <span className="hidden lg:inline-flex lg:-mt-2 text-xs">
                        <span>early preview release</span>
                        <span className="px-1">—</span>
                        <span className="opacity-90">
                            latest v{packageJson.version}
                        </span>
                        <span className="px-1">—</span>
                        <span className="block opacity-90">
                            <a href="https://github.com/sansbankdao/evonext-world/issues" target="_blank" className="px-1 text-purple-100 font-bold hover:underline">
                                report issues here
                            </a>
                        </span>
                    </span>
                </p>



                <a
                    href="/connect"
                    className="ml-4 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                    title="Clear cache and reload"
                >
                    {/* <ArrowPathIcon className="h-4 w-4" /> */}

                    <span className="font-mono">
                        Connect
                    </span>
                </a>
            </div>
        </div>
    )
}
