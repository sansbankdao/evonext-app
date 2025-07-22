'use client'

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { formatNumber } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

export function RightSidebar() {
  const { user } = useAuth()

  return (
    <div className="w-[350px] px-4 py-4 space-y-4">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <input
          type="text"
          placeholder="Search"
          className="w-full h-12 pl-12 pr-4 bg-gray-100 dark:bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-yappr-500 focus:bg-transparent dark:focus:bg-transparent"
        />
      </div>

      <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
        <h2 className="text-xl font-bold px-4 py-3">Contract Info</h2>
        <div className="px-4 py-3 space-y-2">
          <div>
            <p className="text-sm text-gray-500">Contract ID</p>
            <p className="text-xs font-mono break-all">{process.env.NEXT_PUBLIC_CONTRACT_ID}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Network</p>
            <p className="text-sm font-semibold capitalize">{process.env.NEXT_PUBLIC_NETWORK || 'testnet'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Document Types</p>
            <p className="text-sm">13 types available</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
        <h2 className="text-xl font-bold px-4 py-3">Getting Started</h2>
        <div className="px-4 py-3 space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Welcome to Yappr! Here&apos;s what you can do:
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li>• Create your profile</li>
            <li>• Share your first post</li>
            <li>• Follow other users</li>
            <li>• Explore trending topics</li>
          </ul>
        </div>
      </div>

      {user && (
        <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl overflow-hidden">
          <h2 className="text-xl font-bold px-4 py-3">Your Keys</h2>
          <div className="px-4 py-3 space-y-2 text-sm">
            {user.publicKeys.map((key) => (
              <div key={key.id} className="py-1">
                <p className="text-xs text-gray-500">Key #{key.id}</p>
                <p className="font-mono text-xs">{key.type}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {key.purpose} • {key.securityLevel}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-2 text-xs text-gray-500 space-x-2">
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
        <a href="#" className="hover:underline">Cookies</a>
        <a href="#" className="hover:underline">About</a>
      </div>
    </div>
  )
}