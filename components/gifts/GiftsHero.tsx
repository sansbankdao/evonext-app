// components/gifts/GiftsHero.tsx

import { motion } from 'framer-motion'
import Image from 'next/image'
import { GiftIcon } from '@heroicons/react/24/outline'

export function GiftsHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black group">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=2070&auto=format&fit=crop"
            alt="Background"
            fill
            className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 ease-in-out"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
        </div>

        <div className="relative z-10 p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-evonext-500/20 border border-evonext-500/50 text-evonext-300 text-xs font-bold uppercase tracking-wider mb-4">
              <GiftIcon className="h-3 w-3" />
              Live on Dash Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">
              Share <span className="text-transparent bg-clip-text bg-gradient-to-r from-evonext-400 to-purple-400">Value</span>.
            </h1>
            <p className="text-lg text-gray-300 max-w-lg leading-relaxed">
              Send instant, permissionless crypto gifts to anyone.
              No wallet required to receive—just a link.
            </p>
          </div>

          {/* Floating Stat Card */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-4 rounded-2xl flex flex-col items-center justify-center w-32 h-32 shadow-xl transform translate-y-4">
            <span className="text-3xl font-bold text-white mb-1">1.2M</span>
            <span className="text-xs text-gray-300 uppercase tracking-wide">Gifts Sent</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
