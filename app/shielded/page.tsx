// app/shielded/page.tsx

'use client'

/* Shielded Pool viewer — the ONLY place shielded activity is visible today:
 * the platform-explorer indexer has no shielded endpoints (probed
 * 2026-11-12) and was wedged ~11 blocks behind at the time. All data here
 * comes straight from DAPI via the WASM SDK:
 *   - pool balance: sdk.getShieldedPoolState() (credits; 1 DASH = 1e11 credits)
 *   - note count / notes: sdk.getShieldedEncryptedNotes(start, 2048) chunk walk
 *     (start MUST be a multiple of 2048 and a BigInt literal)
 *   - most recent anchor: sdk.getMostRecentShieldedAnchor()
 * Note rows show only PUBLIC fields (tree index, cmx, nullifier); optional
 * "Find my notes" trial-decrypts locally with the session mnemonic's IVK
 * (lib/shielded) and never sends keys anywhere. */

import { useEffect, useRef, useState } from 'react'
import { wasmSdkService, getWasmSdk } from '@/lib/services/wasm-sdk-service'
import { EVONEXT_CONTRACT_ID_TESTNET } from '@/lib/constants'
import { useNetwork } from '@/contexts/network-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { showErrorToast } from '@/lib/toast-error'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { getMnemonic } from '@/lib/secure-storage'
import { mnemonicToSeedSync } from '@scure/bip39'
import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveDkOvk, ivkFromFvk,
} from '@/lib/shielded/keys'
import { tryDecryptNoteWireWithMemo, type ShieldedEncryptedNoteWire } from '@/lib/shielded/note'

const PAGE_SIZE = 100
const CHUNK = 2048

interface NoteRow {
    index: number
    cmx: string
    nullifier: string
    encryptedNote: Uint8Array
    mine?: { valueCredits: bigint; memo: string }
}

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
    Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
    ])
const CREDITS_PER_DASH = 100_000_000_000n /* 1e8 duffs x 1000 credits/duff */
const dashOf = (credits: bigint) => {
    const whole = credits / CREDITS_PER_DASH
    const frac = (credits % CREDITS_PER_DASH).toString().padStart(11, '0').replace(/0+$/, '')
    return frac ? `${whole}.${frac}` : whole.toString()
}

export default function ShieldedPoolPage() {
    const { network } = useNetwork()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState('Initializing…')
    const [poolBalance, setPoolBalance] = useState<bigint | null>(null)
    const [anchor, setAnchor] = useState<string | null>(null)
    const [rows, setRows] = useState<NoteRow[]>([])
    const [page, setPage] = useState(0)
    const [scanning, setScanning] = useState(false)
    const [scanResult, setScanResult] = useState<string | null>(null)
    const cancelledRef = useRef(false)

    const isMainnet = network === 'mainnet'

    useEffect(() => {
        if (isMainnet) return
        cancelledRef.current = false
        const load = async () => {
            try {
                if (!wasmSdkService.isReady()) {
                    setStatus('Initializing WASM SDK…')
                    await wasmSdkService.initialize({
                        network: 'testnet',
                        contractId: EVONEXT_CONTRACT_ID_TESTNET,
                    })
                }
                const sdk = await getWasmSdk()

                setStatus('Reading pool state…')
                console.log('[shielded] pool state query start', Date.now())
                const balance = await withTimeout(sdk.getShieldedPoolState(), 30000, 'pool state query')
                console.log('[shielded] pool state query done', Date.now())
                if (cancelledRef.current) return
                setPoolBalance(BigInt(balance as any))

                console.log('[shielded] anchor query start', Date.now())
                const recentAnchor = await withTimeout(sdk.getMostRecentShieldedAnchor(), 30000, 'anchor query')
                console.log('[shielded] anchor query done', Date.now())
                if (cancelledRef.current) return
                setAnchor(hexOf(recentAnchor as any))

                const all: NoteRow[] = []
                for (let start = 0; ; start += CHUNK) {
                    setStatus(`Fetching encrypted notes… ${all.length}`)
                    const chunk = await withTimeout(
                        sdk.getShieldedEncryptedNotes(BigInt(start), CHUNK),
                        60000,
                        `note chunk @${start} query`,
                    )
                    if (cancelledRef.current) return
                    const items = chunk as any[]
                    for (let i = 0; i < items.length; i++) {
                        all.push({
                            index: start + i,
                            cmx: hexOf(items[i].cmx as Uint8Array),
                            nullifier: hexOf(items[i].nullifier as Uint8Array),
                            encryptedNote: items[i].encryptedNote as Uint8Array,
                        })
                    }
                    if (items.length < CHUNK) break
                }
                setRows(all.reverse()) /* newest first */
                setLoading(false)
            } catch (err) {
                if (cancelledRef.current) return
                console.error('shielded pool load failed:', err)
                showErrorToast((err as any)?.message || 'Failed to load the shielded pool')
                setStatus('Load failed')
                setLoading(false)
            }
        }
        load()
        return () => { cancelledRef.current = true }
    }, [isMainnet])

    const findMyNotes = async () => {
        try {
            setScanning(true)
            setScanResult(null)
            const mnemonic = getMnemonic()
            if (!mnemonic) {
                showErrorToast('No recovery phrase in this session — log in with your mnemonic to detect your own notes.')
                setScanning(false)
                return
            }
            const seed = mnemonicToSeedSync(mnemonic)
            const sk = spendingKeyFromSeed(seed, 1, 0) /* testnet coin_type */
            const fvk = fullViewingKeyFromSpendingKey(sk)
            const { dk } = deriveDkOvk(fvk)
            const ivk = ivkFromFvk(fvk)

            let hits = 0
            let totalValue = 0n
            const updated = rows.map((row) => {
                const wire: ShieldedEncryptedNoteWire = {
                    cmx: Uint8Array.from(row.cmx.match(/.{2}/g)!.map((h) => parseInt(h, 16))),
                    nullifier: Uint8Array.from(row.nullifier.match(/.{2}/g)!.map((h) => parseInt(h, 16))),
                    encryptedNote: row.encryptedNote,
                }
                const plain = tryDecryptNoteWireWithMemo(ivk, wire)
                if (!plain) return { ...row, mine: undefined }
                hits++
                totalValue += plain.note.v
                const memo = new TextDecoder().decode(plain.memo.slice(4)).replace(/\0+$/g, '')
                return { ...row, mine: { valueCredits: plain.note.v, memo } }
            })
            setRows(updated)
            setScanResult(hits > 0
                ? `${hits} note${hits === 1 ? '' : 's'} found — ${dashOf(totalValue)} DASH shielded`
                : 'No notes belong to this key')
        } catch (err) {
            console.error('note scan failed:', err)
            showErrorToast((err as any)?.message || 'Note scan failed')
        } finally {
            setScanning(false)
        }
    }

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <div className="py-20 flex-1 flex justify-center h-screen overflow-y-scroll">
                <main className="w-full max-w-[600px] border-x border-gray-200 dark:border-gray-800 pb-16 lg:pb-0">
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-3">
                <h1 className="text-xl font-bold">Shielded Pool</h1>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                    Live from Dash Platform testnet via DAPI — no explorer indexes this yet
                </p>
            </div>

            {isMainnet ? (
                <div className="p-4">
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5">
                        <p className="font-semibold text-amber-800 dark:text-amber-200">Shielded pool is not live on mainnet yet</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            Mainnet runs Platform 4.2.0-dev.11 (protocol v13); shielded activates with protocol v14.
                            Switch to testnet to view the pool.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                            <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pool balance</p>
                            <p className="text-lg font-bold mt-1">
                                {poolBalance !== null ? `${dashOf(poolBalance)} DASH` : '—'}
                            </p>
                            <p className="text-2xs text-gray-400 mt-1 break-all">
                                {poolBalance !== null ? `${poolBalance.toString()} credits` : ''}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                            <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes in tree</p>
                            <p className="text-lg font-bold mt-1">{rows.length > 0 ? rows.length.toLocaleString() : '—'}</p>
                            <p className="text-2xs text-gray-400 mt-1">{loading ? status : 'commitment tree size'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                            <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Most recent anchor</p>
                            <p className="text-2xs font-mono mt-2 break-all">{anchor ?? '—'}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                            <div>
                                <h2 className="font-semibold">Encrypted notes</h2>
                                <p className="text-2xs text-gray-500 dark:text-gray-400">
                                    Public fields only — contents are encrypted to their recipients
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {user && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={findMyNotes}
                                        disabled={scanning || rows.length === 0}
                                    >
                                        {scanning ? 'Scanning…' : 'Find my notes'}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {scanResult && (
                            <div className="px-4 py-2 text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b border-gray-200 dark:border-gray-800">
                                {scanResult}
                            </div>
                        )}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {pageRows.map((row) => (
                                <div
                                    key={row.index}
                                    className={`px-4 py-3 ${row.mine ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-2xs font-mono text-gray-400">#{row.index}</span>
                                        {row.mine && (
                                            <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-300 dark:border-emerald-700 px-2 py-0.5">
                                                MINE — {dashOf(row.mine.valueCredits)} DASH
                                            </span>
                                        )}
                                        {row.mine?.memo && (
                                            <span className="text-2xs text-gray-500 dark:text-gray-400 italic">
                                                memo: {row.mine.memo}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-2xs font-mono break-all mt-1">
                                        <span className="text-gray-400">cmx </span>{row.cmx}
                                    </p>
                                    <p className="text-2xs font-mono break-all mt-0.5">
                                        <span className="text-gray-400">nf </span>{row.nullifier}
                                    </p>
                                </div>
                            ))}
                            {!loading && pageRows.length === 0 && (
                                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No notes in the tree
                                </div>
                            )}
                            {loading && (
                                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    {status}
                                </div>
                            )}
                        </div>
                        {pageCount > 1 && (
                            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-800">
                                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                                    Newer
                                </Button>
                                <span className="text-2xs text-gray-500">Page {page + 1} / {pageCount}</span>
                                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
                                    Older
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
                </main>
            </div>

            <RightSidebar />
        </div>
    )
}
