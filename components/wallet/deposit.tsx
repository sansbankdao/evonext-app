'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'
import { QRCodeSVG } from 'qrcode.react'

interface Token {
    id: string;
}

interface WalletDepositProps {
    isFullScreen: boolean;
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

// /**
//  * Start Scanner
//  *
//  * NOTE: This DOES NOT work on any of the Android devices tested.
//  *       However, it DOES work well on all iOS devices tested.
//  */
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


export function WalletDeposit({ isFullScreen }: WalletDepositProps) {
    const { user } =  useAuth()
    // const [identity, setIdentity] = useState('')

    // useEffect(() => {
    //     setIdentity('NewMoneyHoney69.dash')
    // }, [])

    const Identity = {
        setAsset: (tokenid: string) => {},
        abbr: user?.dpnsUsername || '...`',
        address: user?.identityId || '...',
    }

    const dataUrl = ''

    const clipboardHandler = () => {
        console.log('HANDLE CLIPBOARD')
    }

    return (
        <main className="{props.isFullScreen === true ? 'grid lg:grid-cols-2 gap-8' : ''}">
            <Link href={Identity.address}>
                <section className="w-full px-3 py-2 my-5 bg-sky-100 border-2 border-sky-300 rounded-lg shadow">
                    <h2 className="text-lg sm:text-xl text-sky-500 font-medium text-center uppercase">
                        Your Deposit Address
                    </h2>

                    <h3
                        className="w-full flex justify-center text-2xl text-sky-700 font-medium truncate tracking-tighter"
                    >
                        {Identity.abbr}
                    </h3>

                    <h3
                        className="w-full flex justify-center text-lg text-sky-700 font-medium truncate tracking-tighter"
                    >
                        {Identity.address}
                    </h3>

                    <div className="my-3 flex justify-center">
                        <QRCodeSVG
                            value={user?.identityId || ''}
                            size={340}
                        />
                    </div>

                    <p className="px-0 sm:px-5 max-w-sm mx-auto text-sm text-sky-900 text-center">
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
                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0">
                            <span className="block truncate font-semobold">Dash</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sky-600">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li>

                        <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0">
                            <div className="flex items-center">
                                <Image
                                    src="/icons/usdt.svg"
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

                        {/* <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0">
                            <span className="block truncate">Bitcoin</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li> */}

                        {/* <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900" id="option-0">
                            <span className="block truncate">Bitcoin Cash</span>

                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-white">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </li> */}

                    </ul>
                </div>

                <input
                    className="w-full my-3 px-3 py-1 text-xl sm:text-2xl bg-cyan-200 border-2 border-cyan-400 rounded-md shadow"
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
