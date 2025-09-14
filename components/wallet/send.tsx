'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

import moment from 'moment'

interface Token {
    id: string;
}

interface WalletSendProps {
    isFullScreen: boolean;
}

export function WalletSend({ isFullScreen }: WalletSendProps) {
    const { user } =  useAuth()
    const [addressFirstUse, setAddressFirstUse] = useState('')
    const [txid, setTxid] = useState(null)
    const [errorMsgs, setErrorMsgs] = useState({})
    const [isShowingVideoPreview, setIsShowingVideoPreview] = useState('hidden')

    const consolidate = () => {
        console.log('BEGIN CONSOLIDATION')
    }

    const consolidation = {
        coins: '',
        tokens: '',
    }

    const openScanner = () => {
        console.log('OPEN SCANNER')
    }

    const Identity = {
        setAsset: (tokenid: string) => {},
        abbr: 'Asset Abbr',
        address: 'Asset Address',
        asset: {
            ticker: 'USD'
        }
    }

    const addressBalance = {
        confirmed: 0,
        unconfirmed: 0,
    }

    const firstTx = {
        blocktime: 1234567890,
    }

    const send = async () => {
        console.log('SEND ASSETS')
    }


    // const amount = ref(null)
    // const receiver = ref(null)
    // const currency = ref(null)
    // const satoshis = ref(null)
    // const txidem = ref(null)
    // const errorMsgs = ref(null)

    // const addressBalance = ref(null)
    // const addressFirstUse = ref(null)
    // const firstTx = ref(null)
    // const consolidation = ref(null)

    // const video = ref(null)
    // const scanner = ref(null)
    // const cameraError = ref(null)

    // const isShowingVideoPreview = ref('hidden')

    // const getAddressBalance = async (_address) => {
    //     return 123
    // }

    // const getAddressFirstUse = async (_address) => {
    //     return 'just a while ago'
    // }

    // const getTransaction = async (_txid) => {
    //     return 'kewl stuff happened'
    // }

    // watch(() => amount.value, (_amount) => {
    //     /* Clear errors. */
    //     clearErrors()

    //     console.log('ADJUST SATOSHIS', Identity.asset.decimal_places)

    //     /* Convert to satoshis. */
    //     satoshis.value = parseInt(_amount * 10**Identity.asset.decimal_places)
    // })

    // const openScanner = () => {
    //     /* Clear errors. */
    //     clearErrors()

    //     /* Start scanner. */
    //     startScanner()
    // }

    // const setReceiver = (_result) => {
    //     /* Set (local) receiver. */
    //     receiver.value = _result

    //     /* Hide video preview. */
    //     isShowingVideoPreview.value = 'hidden'

    //     /* Validate scanner. */
    //     if (scanner.value) {
    //         /* Cleanup scanner. */
    //         scanner.value.destroy()
    //         scanner.value = null
    //     }
    // }

    /**
     * Start Scanner
     *
     * NOTE: This DOES NOT work on any of the Android devices tested.
     *       However, it DOES work well on all iOS devices tested.
     */
    // const startScanner = async () => {
    //     if (scanner.value) {
    //         scanner.value.destroy()
    //         scanner.value = null

    //         isShowingVideoPreview.value = 'hidden'

    //         return
    //     }

    //     try {
    //         navigator.getUserMedia =
    //             navigator.getUserMedia ||
    //             navigator.webkitGetUserMedia ||
    //             navigator.mozGetUserMedia ||
    //             navigator.msGetUserMedia

    //         if (!navigator.mediaDevices.getUserMedia && !navigator.getUserMedia) {
    //             cameraError.value = true
    //         } else {
    //             /* Initialize video element. */
    //             video.value = document.getElementById('video-display')

    //             /* Enable video display. */
    //             isShowingVideoPreview.value = 'flex w-full mt-5 bg-gray-100 border-4 border-gray-300 p-2 rounded-xl z-10'

    //             /* Start scanner. */
    //             scanner.value = new QrScanner(video.value, (_data) => {
    //                 // console.log('SCANNER DATA', _data)

    //                 // FIXME: Build a new link parser
    //                 const result = _data
    //                 // const result = parseLink(_data)

    //                 /* Validate (scanner) result. */
    //                 if (result) {
    //                     setReceiver(result)
    //                 }
    //             })

    //             /* Start scanner. */
    //             await scanner.value.start()
    //         }
    //     } catch (err) {
    //         console.error(err) // eslint-disable-line no-console

    //         cameraError.value = true

    //         /* Bugsnag alert. */
    //         throw new Error(err)
    //     }
    // }

    // const send = async () => {
    //     /* Initialize locals. */
    //     let error
    //     let response

    //     if (!receiver.value) {
    //         return alert('Enter a destination address.')
    //     }

    //     if (!satoshis.value) {
    //         return alert('Enter an amount to send.')
    //     }

    //     if (confirm(`Are you sure you want to send ${numeral(amount.value).format('0,0.00')} ${Identity.asset?.ticker} to ${receiver.value}?`)) {
    //         console.log(`Starting transfer of ${amount.value} ${Identity.asset?.ticker} to ${receiver.value}...`)

    //         response = await Identity
    //             .transfer(receiver.value, BigInt(satoshis.value))
    //             .catch(err => {
    //                 console.error(err)
    //                 error = err
    //             })
    //         console.log('RESPONSE', response)

    //         /* Validate error. */
    //         if (error) {
    //             console.error('DISPLAY ERROR MESSAGE', error.message)
    //             /* Set error. */
    //             errorMsgs.value = error?.message || JSON.stringify(error)
    //             return
    //         }

    //         /* Validate transaction idem. */
    //         if (response?.txidem) {
    //             /* Reset user inputs. */
    //             amount.value = null
    //             receiver.value = null

    //             /* Set transaction idem. */
    //             txidem.value = response.txidem
    //         } else if (response?.error) {
    //             /* Set error. */
    //             errorMsgs.value = response?.error?.message || JSON.stringify(response?.error)
    //         }
    //     }
    // }

    // const consolidate = async () => {
    //     if (confirm(`Are you sure you want to consolidate ${consolidation.value.coins} coin inputs to ${Identity.address}?`)) {
    //         /* Start wallet consolidation. */
    //         const response = await Identity.consolidate()
    //         // console.log('RESPONSE', response)

    //         /* Validate transaction idem. */
    //         if (response?.result) {
    //             /* Reset user inputs. */
    //             amount.value = null
    //             receiver.value = null

    //             /* Set transaction idem. */
    //             txidem.value = response.result
    //         } else if (response?.error) {
    //             /* Set error. */
    //             errorMsgs.value = response?.error?.message || JSON.stringify(response?.error)
    //         }
    //     }
    // }

    // const updateAddressDetails = async () => {
    //     console.log('RECEIVER', receiver.value)

    //     /* Clear errors. */
    //     clearErrors()

    //     addressBalance.value = await getAddressBalance(receiver.value)
    //         .catch(err => console.error(err))
    //     // console.log('ADDRESS BALANCE', addressBalance.value)

    //     addressFirstUse.value = await getAddressFirstUse(receiver.value)
    //         .catch(err => console.error(err))
    //     // console.log('ADDRESS FIRST USE', addressFirstUse.value)

    //     firstTx.value = await getTransaction(addressFirstUse.value.tx_hash)
    //         .catch(err => console.error(err))
    //     // console.log('FIRST TX', firstTx.value)
    // }

    // const clearErrors = () => {
    //     errorMsgs.value = null
    // }

    return (
        <main className="grid grid-cols-1 lg:grid-cols-7 gap-8 lg:divide-x-2 divide-solid divide-sky-200">
            <div className="col-span-4">
                <section className="mt-5 flex flex-row gap-1">
                    <input
                        className="w-full px-3 py-1 text-xl sm:text-2xl bg-cyan-100 border-2 border-cyan-300 rounded-md shadow"
                        type="text"
                        // v-model="receiver"
                        // v-on:keyup="updateAddressDetails"
                        placeholder="Enter a Username or Address"
                    />

                    <div onClick={openScanner}>
                        <svg className="cursor-pointer w-12 h-12 hover:text-red-500 hover:cursor-pointer" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"></path>
                        </svg>
                    </div>
                </section>

                <div className="px-3">
                    <span className="sm:hidden text-xs italic">
                        Send to: BTC, ETH, BSC, TRX, MATIC and more..
                    </span>
                    <span className="hidden text-xs italic">
                        Send to: Bitcoin, Ethereum, Binance, Tron, Polygon and more..
                    </span>
                </div>

                <video
                    className={`my-5 ${isShowingVideoPreview}`}
                    id="video-display"
                />

                <section className="my-5 flex flex-col">
                    <input
                        className="w-full px-3 py-1 text-xl sm:text-2xl bg-cyan-100 border-2 border-cyan-300 rounded-md shadow"
                        type="number"
                        v-model="amount"
                        placeholder={`Enter a (${Identity.asset?.ticker}) amount`}
                    />

                    {/* <!-- <h4 v-if="satoshis > 0" className="mt-1 ml-3 text-sm text-gray-500 font-medium">
                        = {{numeral(satoshis / 100).format('0,0')}} {{Identity.asset?.ticker}}
                    </h4> --> */}
                </section>

                <button
                    onClick={send}
                    className="w-fit cursor-pointer my-5 block px-5 py-2 text-2xl font-medium bg-blue-200 border-2 border-blue-400 rounded-md shadow hover:bg-blue-300"
                >
                    Send {Identity.asset?.ticker}
                </button>

                <section v-if="txid" className="my-10">
                    <div>
                        <h3 className="text-sm text-gray-500 font-medium">Transaction sent successfully!</h3>

                        <Link href={'https://explorer.nexa.org/tx/' + txid} target="_blank" className="text-blue-500 font-medium hover:underline">
                            Click here to OPEN transaction details
                        </Link>
                    </div>
                </section>

                <section v-if="errorMsgs" className="my-10">
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>

                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Transaction FAILED!
                                </h3>

                                <div className="mt-2 text-sm text-red-700">
                                    {/* <!-- <ul role="list" className="list-disc space-y-1 pl-5">
                                        <li>Your password must be at least 8 characters</li>
                                        <li>Your password must include at least one pro wrestling finishing move</li>
                                    </ul> --> */}
                                    <pre>{JSON.stringify(errorMsgs, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    </div>

                </section>

                <div className="flex flex-col gap-6 text-slate-200">
                    <section v-if="addressBalance">
                        <h2 className="text-xl font-medium tracking-widest">
                            Address Balance
                        </h2>

                        <h3>
                            Confirmed: {addressBalance?.confirmed}
                        </h3>

                        <h3>
                            Unconfirmed: {addressBalance?.unconfirmed}
                        </h3>
                    </section>

                    {/* <!-- <section v-if="addressFirstUse">
                        <h2 className="text-xl font-medium tracking-widest">
                            Address First Use
                        </h2>

                        <pre>{addressFirstUse}</pre>
                    </section> --> */}

                    <section v-if="firstTx?.blocktime">
                        <h2 className="text-xl font-medium tracking-widest">
                            First Transaction
                        </h2>

                        <h3>
                            Block Time: {firstTx.blocktime}
                            <span className="block text-rose-500 font-bold">
                                {moment.unix(firstTx.blocktime).format('llll')}
                                <span className="italic text-rose-400">{moment.unix(firstTx.blocktime).fromNow()}</span>
                            </span>
                        </h3>

                        {/* <!-- <pre>{firstTx}</pre> --> */}
                    </section>
                </div>
            </div>

            <section className="pl-0 lg:pl-5 col-span-3 flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-medium">
                        Manage Assets
                    </h1>

                    <section>
                        <button
                            onClick={consolidate}
                            className="w-fit cursor-pointer my-5 block px-5 py-2 text-2xl font-medium bg-blue-200 border-2 border-blue-400 rounded-md shadow hover:bg-blue-300"
                        >
                            Consolidate Coins
                        </button>

                        <div className="-mt-3 pl-3">
                            <span className="block text-sm"># of coin inputs: {consolidation ? consolidation.coins : 'n/a'}</span>
                            <span className="block text-sm"># of token inputs: {consolidation ? consolidation.tokens : 'n/a'}</span>
                        </div>
                    </section>

                </div>

                <div>
                    <h1 className="text-2xl font-medium">
                        Advanced Options
                    </h1>

                    TBD...
                </div>
            </section>
        </main>
    )
}
