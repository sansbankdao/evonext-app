'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

interface Token {
    id: string;
}

interface WalletDepositProps {
    isFullScreen: boolean;
}

export function WalletDeposit({ isFullScreen }: WalletDepositProps) {
    const { user } =  useAuth()
    const [displayLog, setDisplayLog] = useState(null)

    const Identity = {
        setAsset: (tokenid: string) => {},
        abbr: 'Asset Abbr',
        address: 'Asset Address',
    }

    const dataUrl = ''

    const clipboardHandler = () => {
        console.log('HANDLE CLIPBOARD')
    }

    return (
        <main className="{props.isFullScreen === true ? 'grid lg:grid-cols-2 gap-8' : ''}">
            <Link href={Identity.address}>
                <section className="w-full px-3 py-2 my-5 bg-amber-500 border-2 border-amber-700 rounded-lg shadow">
                    <h2 className="text-lg sm:text-xl text-amber-700 font-medium text-center uppercase">
                        Your Deposit Address
                    </h2>

                    <h3
                        className="flex justify-center text-lg text-amber-900 font-medium truncate"
                    >
                        {Identity.abbr}
                    </h3>

                    <div className="flex justify-center">
                        <Image
                            src={dataUrl}
                            className="my-5 w-full h-auto border-2 border-amber-900 rounded-lg shadow-md"
                            alt=""
                            width={32}
                            height={32}
                        />
                    </div>

                    <p className="px-0 sm:px-5 text-sm text-amber-900 text-center">
                        Scan the QR code shown above or click the image to open your preferred wallet.
                    </p>
                </section>
            </Link>

            <section>
                <label className="block text-lg font-medium leading-6 text-gray-900">
                    Choose a deposit currency:
                </label>

                <div className="relative mt-2">
                    <input
                        id="combobox"
                        type="text"
                        className="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 text-2xl sm:leading-6"
                        role="combobox"
                        aria-controls="options"
                        aria-expanded="false"
                        value="Dash"
                    />

                    <button type="button" className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clip-rule="evenodd" />
                        </svg>
                    </button>

                    <ul v-if="isShowingCurrencyOptions" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm" id="options" role="listbox">
                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0" role="option">
                            <span className="block truncate font-semobold">Dash</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sky-600">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li>

                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0" role="option">
                            <div className="flex items-center">
                                <Image
                                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                                    alt=""
                                    className="h-6 w-6 flex-shrink-0 rounded-full"
                                    width={32}
                                    height={32}
                                />
                                {/* <!-- Selected: "font-semibold" --> */}
                                <span className="ml-3 truncate">Tether - USDT</span>
                            </div>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li>

                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0" role="option">
                            <span className="block truncate">Bitcoin</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li>

                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0" role="option">
                            <span className="block truncate">Bitcoin Cash</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li>

                    </ul>
                </div>

                <input
                    className="w-full my-3 px-3 py-1 text-xl sm:text-2xl bg-yellow-200 border-2 border-yellow-400 rounded-md shadow"
                    type="number"
                    v-model="depositAmount"
                    placeholder="Enter a (USD) amount"
                />

                <div className="mb-5 flex flex-row gap-3">
                    <button
                        onClick={clipboardHandler}
                        className="w-full block px-3 py-1 text-2xl font-medium bg-blue-200 border-2 border-blue-400 rounded-md shadow hover:bg-blue-300"
                    >
                        Copy
                    </button>

                    <button
                        className="w-full block px-3 py-1 text-2xl font-medium bg-blue-200 border-2 border-blue-400 rounded-md shadow hover:bg-blue-300"
                    >
                        Share
                    </button>
                </div>
            </section>
        </main>
    )
}
