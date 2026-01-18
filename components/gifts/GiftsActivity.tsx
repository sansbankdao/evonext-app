// components/gifts/GiftsActivity.tsx

'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { PresentationChartLineIcon } from '@heroicons/react/24/outline'

export function GiftsActivity() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <PresentationChartLineIcon className="h-5 w-5 text-evonext-500" />
          Recent Activity
        </h3>
        <a href="#" className="text-sm text-evonext-600 dark:text-evonext-400 hover:underline">View All</a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="flex items-center gap-4 p-3 bg-white dark:bg-black rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={`https://i.pravatar.cc/150?u=${item}`}
                alt="Avatar"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                User_{Math.floor(Math.random() * 1000)}
              </p>
              <p className="text-xs text-gray-500 truncate">
                Claimed a <span className="font-semibold text-evonext-500">0.5 DASH</span> gift
              </p>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              {Math.floor(Math.random() * 59)}m
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
