'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'
// @ts-ignore
import numeral from 'numeral'

interface Token {
    id: string;
}

interface WalletSwapProps {
    isFullScreen: boolean;
}

interface Transaction {
    txid: string;
    time: number;
    fee: number;
    size: number;
    vin: Input[];
    vout: Output[];
}

interface Input {
    address: string;
    outpoint: string;
    satoshis: number;
}

interface Output {
    address: string;
    outpoint: string;
    hex: string;
    satoshis: number;
}

const DEFAULT_TX = {
    txid: '',
    time: 123,
    fee: 1,
    size: 123,
    vin: [
        {
            address: '',
            outpoint: '',
            satoshis: 123,
        }
    ],
    vout: [
        {
            address: '',
            outpoint: '',
            hex: '',
            satoshis: 123,
        }
    ]
}

export function WalletSwap({ isFullScreen }: WalletSwapProps) {
    const { user } =  useAuth()
    const [isShowingSans, setIsShowingSans] = useState(false)
    const [isShowingDash, setIsShowingDash] = useState(false)

    const displayInputs = (_inputs: Input[]): Input[] => {
        return [{
            address: '',
            outpoint: '',
            satoshis: 123,
        }]
    }

    const displayOutputs = (_inputs: Output[]): Output[] => {
        return [{
            address: '',
            outpoint: '',
            hex: '',
            satoshis: 123,
        }]
    }

    const displayTime = (_time: number) => {
        return ''
    }

    const displayTimeAgo = (_time: number) => {
        return ''
    }

    return (
        <main className="flex flex-col gap-4">
            <section className="grid grid-cols-2 gap-3">
                <h2 className="col-span-2 text-2xl font-medium">
                    I Want to Receive ↴
                </h2>

                <div onClick={() => { /* TBD */ }} className="cursor-not-allowed px-2 flex-1 h-24 sm:h-32 flex justify-center items-center border border-sky-700 rounded-lg shadow bg-gradient-to-b from-sky-500 to-sky-300">
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl sm:text-3xl text-sky-900 font-medium whitespace-nowrap">
                            Dash Credits
                        </h2>

                        <h3 className="text-sm sm:text-base text-sky-700 font-medium">
                            DASH
                        </h3>
                    </div>
                </div>

                <div onClick={() => { setIsShowingDash(false); setIsShowingSans(true) }} className="cursor-pointer px-2 flex-1 h-24 sm:h-32 flex justify-center items-center border border-lime-500 rounded-lg shadow bg-gradient-to-b from-lime-400 to-lime-200">
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl sm:text-3xl text-lime-900 font-medium whitespace-nowrap">
                            Dash USD
                        </h2>

                        <h3 className="text-sm sm:text-base text-lime-700 font-medium">
                            DUSD
                        </h3>
                    </div>
                </div>

                <div className="col-span-2 w-full flex flex-row gap-3">
                    <div onClick={() => { /* TBD */ }} className="cursor-not-allowed px-2 flex-1 h-20 sm:h-24 flex justify-center items-center border border-rose-900 rounded-lg shadow bg-gradient-to-b from-rose-700 to-rose-500">
                        <div className="flex flex-col items-center">
                            <h2 className="text-sm sm:text-lg text-rose-100 font-medium whitespace-nowrap">
                                TBA Popular Token
                            </h2>

                            <h3 className="text-xs sm:text-sm text-rose-50 font-medium">
                                POP
                            </h3>
                        </div>
                    </div>

                    <div onClick={() => { /* TBD */ }} className="cursor-not-allowed flex-1 h-20 sm:h-24 flex justify-center items-center border border-violet-400 rounded-lg shadow bg-gradient-to-b from-violet-300 to-violet-100">
                        <div className="flex flex-col items-center">
                            <h2 className="text-sm sm:text-lg text-violet-900 font-medium whitespace-nowrap">
                                TBA Meme Coin
                            </h2>

                            <h3 className="text-xs sm:text-sm text-violet-700 font-medium">
                                MEME
                            </h3>
                        </div>
                    </div>

                    <div onClick={() => { setIsShowingSans(false); setIsShowingDash(true) }} className="cursor-pointer flex-1 h-20 sm:h-24 flex justify-center items-center border border-cyan-500 rounded-lg shadow bg-gradient-to-b from-cyan-400 to-cyan-200">
                        <div className="flex flex-col items-center">
                            <h2 className="text-sm sm:text-lg text-cyan-900 font-medium whitespace-nowrap">
                                Sansnote
                            </h2>

                            <h3 className="text-xs sm:text-sm text-cyan-700 font-medium">
                                SANS
                            </h3>
                        </div>
                    </div>
                </div>
            </section>

            {(!isShowingSans && !isShowingDash) &&
                <div className="mx-10 my-3 border-t border-gray-300" />
            }

            {(!isShowingSans && !isShowingDash) &&
                <section className="-mt-3 flex flex-col gap-3">
                    <p className="px-3 text-xs sm:text-sm text-gray-500">
                        Don&apos;t see your asset listed above?
                        Not a problem.
                        Search from <span className="text-indigo-500 font-medium">more than 400+</span> assets below.
                    </p>

                    <input
                        type="text"
                        placeholder="Search all supported assets"
                        v-model="search"
                        disabled
                        className="px-3 py-1 w-full h-16 sm:h-20 border-b-4 border-sky-200 bg-gray-800 text-xl sm:text-2xl text-gray-300 rounded shadow focus:outline-none"
                    />
                </section>
            }

            <section v-if="isShowingSans || isShowingDash" className="grid grid-cols-2 gap-y-2">
                <div className="col-span-2 pb-3 flex justify-center">
                    <span className="text-sm text-sky-700 font-medium tracking-widest">
                        1.00 SANS = 0.0001337 DASH
                    </span>
                </div>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Slippage

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm text-blue-500 cursor-pointer hover:scale-105 duration-200 ease-in-out">
                    Auto (1%)

                    <svg className="w-3 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"></path>
                    </svg>
                </h4>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Price impact

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm cursor-default">
                    &lt; 0.1%
                </h4>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Receiving address

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm text-blue-500 cursor-pointer hover:scale-105 duration-200 ease-in-out">
                    0x255824...9788997d

                    <svg className="w-3 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"></path>
                    </svg>
                </h4>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Min. quantity

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm cursor-default">
                    3.92159754
                </h4>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Transaction fee

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm cursor-default">
                    { isShowingSans ? '0.01% - 1.0%' : '' }
                    { isShowingDash ? '2.9%' : '' }
                </h4>

                <h4 className="w-fit pr-3 py-1 flex items-center gap-1 text-xs sm:text-sm cursor-help">
                    Blockchain fees

                    <svg className="w-4 h-auto" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"></path>
                    </svg>
                </h4>
                <h4 className="w-fit pl-3 py-1 flex place-self-end items-center justify-end gap-1 text-xs sm:text-sm cursor-default">
                    $1.30
                </h4>
            </section>
        </main>
    )
}
