// components/gifts/CreateGiftFlow.tsx

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PaperAirplaneIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import toast from 'react-hot-toast'

export function CreateGiftFlow() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [isCreated, setIsCreated] = useState(false)
  const [giftCode, setGiftCode] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.loading('Generating gift contract...', { duration: 1500 })

    setTimeout(() => {
      const mockCode = `EVO-${Math.random().toString(36).substr(2, 6).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      setGiftCode(mockCode)
      setIsCreated(true)
      toast.success('Gift created successfully!')
    }, 1500)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(giftCode)
      setCopied(true)
      toast.success('Gift code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy code')
    }
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
            src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=2070&auto=format&fit=crop"
            alt="Create Header"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
              <PaperAirplaneIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="p-8">
          {!isCreated ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-6">Create New Gift</h2>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Amount (DASH)</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 pl-12 text-2xl font-bold focus:ring-2 focus:ring-evonext-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">Đ</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Personal Note (Optional)</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 focus:ring-2 focus:ring-evonext-500 outline-none transition-all"
                  placeholder="Enjoy this gift!"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-evonext-600 hover:bg-evonext-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-evonext-500/20"
              >
                <SparklesIcon className="h-5 w-5" />
                Wrap & Generate Code
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Gift Ready!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Share this exclusive code with the recipient.</p>

              <div className="bg-gray-900 rounded-xl p-6 mb-6 relative group text-left border border-gray-800">
                <div className="flex justify-between items-start">
                  <pre className="text-xl text-green-400 font-mono break-all whitespace-pre-wrap">
                    {giftCode}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="ml-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <CheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
