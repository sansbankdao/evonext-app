'use client'

// components/wallet/shielded.tsx
//
// The SHIELDED wallet tab: balance (local trial-decrypt scan via
// lib/shielded/wallet.ts + the proxy-first sync engine), receive (bech32m
// dash1z… address + QR), send (pool → pool transfer through the live
// prover), and shield (identity L1 balance → pool via the self-custodial
// asset-lock path). All keys derive from the session mnemonic locally.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { showErrorToast } from '@/lib/toast-error'
import toast from 'react-hot-toast'
import { Loader2, Copy, RefreshCw, ShieldCheck, Send, Download, ArrowUpRight, ArrowDownLeft, Repeat2, History, ArrowLeft } from 'lucide-react'
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react'

import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { wasmSdkService, getWasmSdk } from '@/lib/services/wasm-sdk-service'
import { EVONEXT_CONTRACT_ID_TESTNET, EVONEXT_CONTRACT_ID_MAINNET } from '@/lib/constants'
import { getMnemonic } from '@/lib/secure-storage'
import {
    deriveShieldedWalletKeys, makeShieldedSync, sendShielded, shieldFromBalance,
    shieldedAddressAt, buildShieldedHistory,
    type ShieldedWalletKeys, type ShieldedHistoryEntry,
} from '@/lib/shielded/wallet'
import type { OwnedShieldedNote } from '@/lib/shielded/sync'

const CREDITS_PER_DASH = 100_000_000_000n /* 1e11 */

/** Decimal-string DASH -> credits (exact, no float math). */
const dashToCredits = (input: string): bigint | null => {
    const trimmed = input.trim()
    if (!/^\d+(\.\d{0,11})?$/.test(trimmed)) return null
    const [whole, frac = ''] = trimmed.split('.')
    const fracPadded = frac.padEnd(11, '0').slice(0, 11)
    return BigInt(whole + fracPadded)
}

/** Credits -> DASH string, TRUNCATED (never rounded), trailing zeros trimmed. */
const creditsToDash = (credits: bigint): string => {
    const whole = credits / CREDITS_PER_DASH
    const frac = (credits % CREDITS_PER_DASH).toString().padStart(11, '0').replace(/0+$/, '')
    return frac ? `${whole}.${frac}` : `${whole}`
}

export function WalletShielded({ isFullScreen, onBack }: {
    isFullScreen?: boolean
    /* When provided, the component renders a back header (the dashboard
     * opens it as a full-screen view instead of a tab). */
    onBack?: () => void
}) {
    const { user } = useAuth()
    const { network } = useNetwork()
    const isMainnet = network === 'mainnet'
    const sdkNetwork = isMainnet ? 'mainnet' : 'testnet'

    const [keys, setKeys] = useState<ShieldedWalletKeys | null>(null)
    const [balanceCredits, setBalanceCredits] = useState<bigint | null>(null)
    const [myNotes, setMyNotes] = useState<OwnedShieldedNote[]>([])
    const [history, setHistory] = useState<ShieldedHistoryEntry[]>([])
    /* Ref mirror of `keys` — applySync must NEVER capture a stale pre-init
     * keys value (the scan runs before the re-render that publishes keys). */
    const keysRef = useRef<ShieldedWalletKeys | null>(null)

    /* One place to project a sync state into the UI (balance + notes + history). */
    const applySync = useCallback((sync: NonNullable<Awaited<ReturnType<typeof loadSync>>>) => {
        setBalanceCredits(sync.balance())
        setMyNotes([...sync.notes])
        setHistory(keysRef.current ? buildShieldedHistory(sync, keysRef.current, sdkNetwork) : [])
    }, [sdkNetwork])
    const [scanStatus, setScanStatus] = useState<string | null>(null)
    const [scanning, setScanning] = useState(false)
    const [needsMnemonic, setNeedsMnemonic] = useState(false)

    /* Receive */
    const [receiveIdx, setReceiveIdx] = useState(0)

    /* Send form */
    const [sendRecipient, setSendRecipient] = useState('')
    const [sendAmount, setSendAmount] = useState('')
    const [sendMemo, setSendMemo] = useState('')
    const [sending, setSending] = useState(false)
    const [sendPhase, setSendPhase] = useState<string | null>(null)

    /* Shield form */
    const [shieldAmount, setShieldAmount] = useState('')
    const [shielding, setShielding] = useState(false)
    const [shieldPhase, setShieldPhase] = useState<string | null>(null)

    const syncRef = useRef<Awaited<ReturnType<typeof loadSync>> | null>(null)

    /* After a broadcast, the chain state (nullifier registry / note tree)
     * only updates with the next block — poll until the balance reflects the
     * transition (or give up after ~2 min; Refresh stays available). */
    const pollUntilSettled = useCallback(async (compare: (credits: bigint) => boolean) => {
        const sync = syncRef.current
        if (!sync) return
        for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 15000))
            try {
                await sync.syncPass()
                await sync.refreshSpent()
            } catch { /* keep polling */ }
            const credits = sync.balance()
            applySync(sync)
            if (compare(credits)) return
        }
    }, [applySync])

    const loadSync = useCallback(async () => {
        const mnemonic = getMnemonic()
        if (!mnemonic) {
            setNeedsMnemonic(true)
            return null
        }
        setNeedsMnemonic(false)

        /* initialize() no-ops on a matching config; re-init when the live
         * service was built for the WRONG network (F37 gotcha). */
        if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== sdkNetwork) {
            await wasmSdkService.initialize({
                network: sdkNetwork,
                contractId: isMainnet ? EVONEXT_CONTRACT_ID_MAINNET : EVONEXT_CONTRACT_ID_TESTNET,
            })
        }
        const sdk = await getWasmSdk()
        const walletKeys = deriveShieldedWalletKeys(
            (await import('@scure/bip39')).mnemonicToSeedSync(mnemonic), sdkNetwork)
        keysRef.current = walletKeys
        setKeys(walletKeys)
        return makeShieldedSync(sdk, sdkNetwork, mnemonic)
    }, [sdkNetwork, isMainnet])

    const runScan = useCallback(async (fresh: boolean) => {
        setScanning(true)
        setScanStatus(fresh ? 'Syncing the note tree…' : 'Refreshing spend status…')
        try {
            const sync = syncRef.current ?? await loadSync()
            if (!sync) return
            syncRef.current = sync

            if (fresh) {
                const ok = await sync.syncPass(({ scanned }) => {
                    setScanStatus(`Scanned ${scanned.toLocaleString()} notes…`)
                })
                if (!ok) throw new Error('The note-tree scan was interrupted — try again')
            }
            await sync.refreshSpent()
            applySync(sync)
        } catch (err: any) {
            showErrorToast(err?.message || 'Shielded balance scan failed')
        } finally {
            setScanStatus(null)
            setScanning(false)
        }
    }, [loadSync, applySync])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const sync = await loadSync()
                if (cancelled || !sync) return
                syncRef.current = sync
                await runScan(true)
            } catch (err: any) {
                if (!cancelled) showErrorToast(err?.message || 'Shielded wallet init failed')
            }
        })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sdkNetwork])

    const receiveAddress = keys ? shieldedAddressAt(keys, receiveIdx, sdkNetwork) : ''

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(receiveAddress)
            toast.success('Shielded address copied to clipboard')
        } catch {
            showErrorToast('Failed to copy the address')
        }
    }

    const handleSend = async () => {
        const amount = dashToCredits(sendAmount)
        if (!amount || amount <= 0n) {
            return showErrorToast('Please enter a valid amount to send.')
        }
        if (!sendRecipient.trim().startsWith(isMainnet ? 'dash1z' : 'tdash1z')) {
            return showErrorToast(`Please enter a valid shielded address (${isMainnet ? 'dash1z…' : 'tdash1z…'}).`)
        }
        const sync = syncRef.current
        if (!keys || !sync) {
            return showErrorToast('The shielded wallet is still initializing — try again in a moment.')
        }

        setSending(true)
        setSendPhase('Preparing…')
        try {
            const sdk = await getWasmSdk()
            const before = sync.balance()
            const result = await sendShielded({
                sdk,
                keys,
                sync,
                network: sdkNetwork,
                recipient: sendRecipient.trim(),
                amountCredits: amount,
                memoText: sendMemo || undefined,
                onProgress: (phase) => setSendPhase(phase),
            })
            toast.success(`Sent ${creditsToDash(amount)} DASH — transition ${result.transitionHash.slice(0, 16)}…`)
            setSendRecipient('')
            setSendAmount('')
            setSendMemo('')

            /* The spent note's nullifier enters the registry with the next
             * block — poll until the balance drops below the pre-send value. */
            setSendPhase('Waiting for the transaction to settle…')
            await pollUntilSettled((credits) => credits < before)
            applySync(sync)
        } catch (err: any) {
            showErrorToast(err?.message || 'Shielded send failed')
        } finally {
            setSending(false)
            setSendPhase(null)
        }
    }

    const handleShield = async () => {
        const amount = dashToCredits(shieldAmount)
        if (!amount || amount <= 0n) {
            return showErrorToast('Please enter a valid amount to shield.')
        }
        if (!keys) {
            return showErrorToast('The shielded wallet is still initializing — try again in a moment.')
        }
        const identityIdx = Number(localStorage.getItem('identity_idx') || 0)

        setShielding(true)
        setShieldPhase('Preparing…')
        try {
            const sdk = await getWasmSdk()
            const result = await shieldFromBalance({
                sdk,
                keys,
                network: sdkNetwork,
                identityIdx,
                shieldCredits: amount,
                onProgress: (phase) => setShieldPhase(phase),
            })
            toast.success(`Shielded ${creditsToDash(result.shieldCredits)} DASH — transition ${result.transitionHash.slice(0, 16)}…`)
            setShieldAmount('')

            /* The new note enters the tree with the next block — poll with
             * full re-syncs until the balance rises above the pre-shield value. */
            const before = syncRef.current?.balance() ?? 0n
            setShieldPhase('Waiting for the note to appear…')
            await pollUntilSettled((credits) => credits > before)
            if (syncRef.current) applySync(syncRef.current)
        } catch (err: any) {
            showErrorToast(err?.message || 'Shielding failed')
        } finally {
            setShielding(false)
            setShieldPhase(null)
        }
    }

    if (needsMnemonic) {
        return (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400" />
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                    The shielded wallet needs this session&apos;s recovery phrase.
                    Log out and log back in with your phrase (or passkey) to use it.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {onBack && (
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to wallet
                    </button>
                    <h1 className="text-lg font-bold">Shielded Wallet</h1>
                </div>
            )}

            {/* BALANCE */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-sky-50 to-white dark:from-sky-950/40 dark:to-transparent">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        <h2 className="font-semibold">Shielded balance</h2>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => runScan(true)} disabled={scanning}>
                        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">Refresh</span>
                    </Button>
                </div>

                <div className="px-4 py-4">
                    {scanning && scanStatus
                        ? <p className="text-sm text-gray-500 dark:text-gray-400">{scanStatus}</p>
                        : balanceCredits !== null
                            ? <>
                                <p className="text-3xl font-medium text-gray-700 dark:text-gray-200">
                                    {creditsToDash(balanceCredits)} <span className="text-lg text-gray-400">DASH</span>
                                </p>
                                <p className="text-2xs text-gray-400 mt-1">
                                    {balanceCredits.toLocaleString()} credits · {myNotes.filter(n => !n.spent).length} unspent note{myNotes.filter(n => !n.spent).length === 1 ? '' : 's'}
                                    {myNotes.some(n => n.spent) && ` · ${myNotes.filter(n => n.spent).length} spent`}
                                </p>
                            </>
                            : <p className="text-sm text-gray-500">—</p>}
                </div>

                {myNotes.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                        {myNotes.map((note) => (
                            <div key={note.position} className={`px-4 py-2 flex items-center justify-between gap-2 ${note.spent ? 'opacity-50' : ''}`}>
                                <span className="text-2xs font-mono text-gray-400">#{note.position}</span>
                                <span className="text-xs font-medium">{creditsToDash(BigInt(note.value))} DASH</span>
                                {note.spent && <span className="text-2xs text-gray-400 uppercase">spent</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* HISTORY */}
            {history.length > 0 && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <h2 className="font-semibold">Transaction history</h2>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {history.map((entry) => {
                            const isIncoming = entry.kind === 'received'
                            const Icon = entry.kind === 'sent'
                                ? ArrowUpRight
                                : entry.kind === 'self' ? Repeat2 : ArrowDownLeft
                            const badge = entry.kind === 'sent'
                                ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                                : entry.kind === 'self'
                                    ? 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                                    : 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                            return (
                                <div key={`${entry.kind}-${entry.treeIndex}`} className="px-4 py-3 flex items-center gap-3">
                                    <div className={`shrink-0 rounded-full border p-1.5 ${badge}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold">
                                                {entry.kind === 'sent' ? 'Sent'
                                                    : entry.kind === 'self' ? 'To your address'
                                                        : 'Received'}
                                            </span>
                                            {entry.spent && (
                                                <span className="text-2xs text-gray-400 uppercase">spent</span>
                                            )}
                                            <span className="text-2xs font-mono text-gray-400">#{entry.treeIndex}</span>
                                        </div>
                                        <p className="text-2xs text-gray-500 dark:text-gray-400 break-all truncate">
                                            {entry.memo || (entry.kind === 'sent' ? 'no memo' : '—')}
                                        </p>
                                        {entry.kind === 'sent' && entry.address && (
                                            <p className="text-2xs font-mono text-gray-400 break-all truncate">
                                                to {entry.address.slice(0, 24)}…
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-xs font-semibold ${isIncoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {entry.kind === 'received' ? '+' : entry.kind === 'sent' ? '−' : '~'}{creditsToDash(entry.credits)} DASH
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <p className="px-4 py-2 text-2xs text-gray-400 border-t border-gray-200 dark:border-gray-800">
                        Derived locally from the note tree and your outgoing-viewing key —
                        amounts and memos never leave this device.
                    </p>
                </div>
            )}

            {/* RECEIVE */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Download className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h2 className="font-semibold">Receive (shielded)</h2>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {receiveAddress && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white p-2 shadow-sm shrink-0">
                            <QRCodeSVG value={receiveAddress} size={132} />
                        </div>
                    )}
                    <div className="flex-1 w-full space-y-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Share this address to RECEIVE shielded DASH. Funds land in your
                            shielded balance — only your phrase can decrypt them.
                        </p>
                        <button
                            onClick={copyAddress}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-left hover:border-sky-300 transition-colors"
                            title="Click to copy"
                        >
                            {receiveAddress || '…'}
                        </button>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={copyAddress}>
                                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReceiveIdx((i) => i + 1)}>
                                New address (#{receiveIdx + 1})
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEND */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h2 className="font-semibold">Send (shielded)</h2>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Recipient shielded address ({isMainnet ? 'dash1z…' : 'tdash1z…'})
                        </label>
                        <Input
                            type="text"
                            value={sendRecipient}
                            onChange={(e) => setSendRecipient(e.target.value)}
                            placeholder={isMainnet ? 'dash1z…' : 'tdash1z…'}
                            className="font-mono text-xs"
                            autoComplete="off"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Amount (DASH)
                            </label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.05"
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Memo (optional, max 32 chars)
                            </label>
                            <Input
                                type="text"
                                value={sendMemo}
                                onChange={(e) => setSendMemo(e.target.value)}
                                maxLength={32}
                                placeholder=""
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <p className="text-2xs text-gray-400">
                        The consensus fee is deducted from your shielded balance automatically
                        (pinned by the protocol — not configurable).
                    </p>

                    <Button className="w-full" onClick={handleSend} disabled={sending || !sendRecipient || !sendAmount}>
                        {sending
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{sendPhase || 'Sending…'}</>
                            : 'Send shielded'}
                    </Button>
                </div>
            </div>

            {/* SHIELD */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h2 className="font-semibold">Shield (identity → pool)</h2>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Amount to shield (DASH)
                        </label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={shieldAmount}
                            onChange={(e) => setShieldAmount(e.target.value)}
                            placeholder="0.01"
                            autoComplete="off"
                        />
                        <p className="text-2xs text-gray-400 mt-1">
                            Builds a self-custodial asset lock from YOUR funding address
                            (m/44&apos;/5&apos;/0&apos;/0/{Number(localStorage.getItem('identity_idx') || 0)}),
                            then converts it into a shielded note payable to you.
                        </p>
                    </div>

                    <Button className="w-full" onClick={handleShield} disabled={shielding || !shieldAmount}>
                        {shielding
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{shieldPhase || 'Shielding…'}</>
                            : 'Shield to my wallet'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
