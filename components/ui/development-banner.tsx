'use client'

import packageJson from '@/package.json'

export function DevelopmentBanner() {
  return (
    <div className="bg-yappr-500 text-white px-4 py-2 text-sm">
      <div className="max-w-7xl mx-auto">
        <p className="text-center">
          <span className="font-medium">Yappr is in an early development phase.</span>
          {' '}
          <span className="opacity-90">This dapp is on version {packageJson.version}.</span>
          {' '}
          <span className="opacity-90">No need to report issues yet.</span>
        </p>
      </div>
    </div>
  )
}