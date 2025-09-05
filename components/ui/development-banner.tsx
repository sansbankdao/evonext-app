'use client'

import packageJson from '@/package.json'
import { cacheManager } from '@/lib/cache-manager'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export function DevelopmentBanner() {
    const handleClearCache = () => {
        // Clear application cache
        cacheManager.clearAll()

        // Clear browser storage
        if (typeof window !== 'undefined') {
            // Clear localStorage (except auth data)
            const keysToKeep = ['dash_identity_id', 'dash_public_address']
            const savedData: Record<string, string> = {}

            // Save auth data
            keysToKeep.forEach(key => {
                const value = localStorage.getItem(key)

                if (value) {
                    savedData[key] = value
                }
            })

            // Clear all localStorage
            localStorage.clear()

            // Restore auth data
            Object.entries(savedData).forEach(([key, value]) => {
                localStorage.setItem(key, value)
            })

            // Clear sessionStorage
            sessionStorage.clear()

            // Reload the page
            window.location.reload()
        }
    }

    return (
        <div className="w-full bg-yappr-500 text-white px-4 py-2 text-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <p className="text-center flex-1 text-xs font-mono tracking-wider">
                    <span className="inline font-medium">
                        EvoNext is in an early development phase
                    </span>

                    <span className="hidden sm:inline-flex">
                        <span className="px-1">—</span>
                        <span className="opacity-90">
                            latest version is {packageJson.version}
                        </span>
                        <span className="px-1">—</span>
                        <span className="opacity-90">
                            NO need to
                            <a href="https://github.com/sansbankdao/yappr-world/issues" target="_blank" className="px-1 text-sky-200 font-bold hover:underline">
                                report issues
                            </a>yet
                        </span>
                    </span>
                </p>

                <button
                    onClick={handleClearCache}
                    className="ml-4 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                    title="Clear cache and reload"
                >
                    <ArrowPathIcon className="h-4 w-4" />

                    <span className="font-mono">
                        Clear Cache
                    </span>
                </button>

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
