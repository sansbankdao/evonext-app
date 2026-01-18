// components/gifts/ClaimGiftFlow.tsx

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { QrCodeIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import toast from 'react-hot-toast'

export function ClaimGiftFlow() {
  const [claimCode, setClaimCode] = useState('')
  const [isClaimed, setIsClaimed] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if(claimCode.length < 5) {
      toast.error('Invalid gift code format')
      return
    }

    toast.loading('Verifying on Dash Platform...', { duration: 1500 })

    setTimeout(() => {
      setIsClaimed(true)
      toast.success('Funds added to wallet!')
    }, 1500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl mx-auto mb-16"
    >
      <div className="bg-white dark:bg-black rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="h-48 relative">
          <Image
            src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop"
            alt="Claim Header"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
              <QrCodeIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="p-8">
          {!isClaimed ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-6">Claim Gift</h2>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Enter Gift Code</label>
                <input
                  type="text"
                  required
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 font-mono text-xl focus:ring-2 focus:ring-evonext-500 outline-none transition-all uppercase tracking-widest text-center"
                  placeholder="EVO-XXXX-XXXX"
                />
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  Ensure you are connected to the Dash Platform network.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <QrCodeIcon className="h-5 w-5" />
                Verify & Redeem
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <SparklesIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">0.55 DASH</h2>
              <p className="text-green-600 dark:text-green-400 mb-6 font-bold uppercase tracking-wide">Success!</p>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-8 text-left space-y-3">
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                  <span className="text-sm text-gray-500">Sender Note</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">&quot;Thanks for helping!&quot;</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                  <span className="text-sm text-gray-500">TxID</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-200">8f3a...29c1</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-sm text-gray-500">Network Fee</span>
                  <span className="text-sm text-gray-900 dark:text-gray-200">0.001 DASH</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
