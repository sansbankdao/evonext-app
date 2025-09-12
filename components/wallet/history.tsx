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

interface WalletHistoryProps {
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

export function WalletHistory({ isFullScreen }: WalletHistoryProps) {
    const { user } =  useAuth()
    const [txs, setTxs] = useState<Transaction[]>([DEFAULT_TX])

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
        <main className="flex flex-col gap-4 text-slate-200">
            <h2 className="text-xl font-medium">
                Recent Transactions
            </h2>

            {txs.map((tx) => (
                <Link
                    key="tx.txid"
                    href={`https://nexa.sh/tx/${tx.txid}`}
                    target="_blank"
                    className="px-2 p-1 bg-amber-50 border border-amber-300 rounded-md shadow hover:bg-amber-100"
                >
                    <h3 className="text-xs font-medium truncate">
                        ID {tx.txid}
                    </h3>

                    <h3>
                        {displayTime(tx.time)}
                        <small>({displayTimeAgo(tx.time)})</small>
                    </h3>

                    <h3 className="text-xs text-amber-600">
                        fee: {tx.fee}
                    </h3>

                    <h3 className="text-xs text-amber-600">
                        size: {tx.size}
                    </h3>

                    <section className="my-3 px-2 py-1 flex flex-col gap-3 bg-gray-200 border border-gray-400 rounded">
                        <h2 className="text-xs text-amber-600 uppercase">
                            Inputs
                        </h2>

                        {displayInputs(tx.vin).map((input: Input) => (
                            <div key="input.outpoint" className="flex flex-col text-xs divide-amber-700">
                                <h3 className="text-xs text-amber-800 truncate">
                                    Outpoint:
                                    <span className="font-medium">{input.outpoint}</span>
                                </h3>

                                <Link
                                    href={`https://explorer.nexa.org/address/${input.address}`}
                                    target="_blank"
                                    className="text-xs text-amber-600 truncate hover:text-amber-500"
                                >
                                    Address:
                                    <span className="font-medium">{input.address}</span>
                                </Link>

                                <h3 v-if="input.satoshis" className="text-xs text-amber-800 truncate">
                                    Satoshis:
                                    <span className="font-medium">{numeral(Number(input.satoshis)).format('0,0')}</span>
                                </h3>
                                {/* <!-- {{input}} --> */}
                            </div>
                        ))}

                        {/* <!-- <pre v-for="input of displayInputs(tx.vin)" :key="input.outpoint" className="text-xs">{{input}}</pre> --> */}
                    </section>

                    <section className="my-3 px-2 py-1 flex flex-col gap-3 bg-gray-700 border border-gray-900 rounded">
                        <h2 className="text-xs text-gray-50 uppercase">
                            Outputs
                        </h2>

                        {displayOutputs(tx.vout).map((output: Output) => (
                            <div key={output.outpoint} className="flex flex-col text-xs divide-amber-700">
                                <h3 className="text-xs text-gray-50 truncate">
                                    Outpoint:
                                    <span className="font-medium">{output.outpoint}</span>
                                </h3>

                                <h3 className="text-xs text-gray-50 truncate">
                                    Address:
                                    <span className="font-medium">{output.address}</span>
                                </h3>

                                <h3 className="text-xs text-gray-50 truncate">
                                    Satoshis:
                                    <span className="font-medium">{output.satoshis}</span>
                                </h3>

                                {/* <h3 className="text-xs text-gray-50 truncate">
                                    Script (hash):
                                    <span className="font-medium">{output.script.hash}</span>
                                </h3> */}

                                {/* <h3 className="text-xs text-gray-50 truncate">
                                    Script (args):
                                    <span className="font-medium">{output.script.args}</span>
                                </h3> */}

                                {/* <h3 className="text-xs text-gray-50 truncate">
                                    Group:
                                    <span className="font-medium">{output.group}</span>
                                </h3> */}

                                {/* <h3 className="text-xs text-gray-50 truncate">
                                    Authority:
                                    <span className="font-medium">{output.groupAuthority}</span>
                                </h3> */}

                                {/* <h3 className="text-xs text-gray-50 truncate">
                                    Quantity:
                                    <span className="font-medium">{output.groupQuantity}</span>
                                </h3> */}

                                <h3 className="text-xs text-gray-50 truncate">
                                    Hex:
                                    <span className="font-medium">{output.hex}</span>
                                </h3>
                                {/* <!-- {{input}} --> */}
                            </div>
                        ))}
                        {/* <!-- <pre v-for="output of displayOutputs(tx.vout)" :key="output.outpoint" className="text-xs">{{output}}</pre> --> */}
                    </section>
                </Link>
            ))}
        </main>
    )
}
