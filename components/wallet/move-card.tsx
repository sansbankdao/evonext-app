'use client'

/*
 * components/wallet/move-card.tsx — the internal-move card on the Receive tab
 * (the owner directive: the internal-move UI lives on RECEIVE, Dashpay-style).
 *
 * Lanes (all live-verified on testnet 2026-11-15):
 *   Transparent → Identity      (type 11  IdentityTopUpFromAddresses — the
 *                                consensus-exact reference wire + the direct grpc)
 *   Transparent → Shielded      (type 15  Shield — the same transport, the prover
 *                                builds the zk proof)
 *   Shielded   → Identity      (type 22 via the engine's poolExit)
 *   Shielded   → Transparent   (type 17 via the engine's poolExit)
 *
 * Amounts are entered in DASH (1 DASH = 1e11 credits).
 */

import { useEffect, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { toast } from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'
import { getMnemonic } from '@/lib/secure-storage'
import { shieldedEngine } from '@/lib/shielded/engine-client'
import { moveTransparentToIdentity, moveTransparentToShielded, readTransparentAddress } from '@/lib/moves-service'

type Lane = 'transparent' | 'shielded' | 'identity'

const FROM_OPTIONS: { key: 'transparent' | 'shielded'; label: string }[] = [
    { key: 'transparent', label: 'Transparent' },
    { key: 'shielded', label: 'Shielded' },
]

const TO_OPTIONS: Record<'transparent' | 'shielded', { key: Lane; label: string }[]> = {
    transparent: [
        { key: 'identity', label: 'Identity' },
        { key: 'shielded', label: 'Shielded' },
    ],
    shielded: [
        { key: 'identity', label: 'Identity' },
        { key: 'transparent', label: 'Transparent' },
    ],
}

const CREDITS_PER_DASH = 100_000_000_000n

export function WalletMoveCard() {
    const { user } = useAuth()
    const { network } = useNetwork()
    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'

    const [from, setFrom] = useState<'transparent' | 'shielded'>('transparent')
    const [to, setTo] = useState<Lane>('identity')
    const [amountDash, setAmountDash] = useState('')
    const [busy, setBusy] = useState(false)
    const [phase, setPhase] = useState('')
    const [transparentBalance, setTransparentBalance] = useState<bigint | null>(null)
    const [shieldedBalance, setShieldedBalance] = useState<bigint | null>(null)

    const toOptions = TO_OPTIONS[from]
    const effectiveTo = toOptions.some((o) => o.key === to) ? to : toOptions[0].key

    const refreshBalances = async () => {
        try {
            const addr = await readTransparentAddress(sdkNetwork as 'mainnet' | 'testnet', 0)
            setTransparentBalance(addr.balance)
        } catch { setTransparentBalance(null) }
        try {
            const snap = await shieldedEngine.snapshot()
            setShieldedBalance(BigInt(snap.balance))
        } catch { setShieldedBalance(null) }
    }

    useEffect(() => {
        void refreshBalances()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sdkNetwork])

    const move = async () => {
        const dash = parseFloat(amountDash || '0')
        if (!(dash > 0)) {
            showErrorToast('Enter an amount first')
            return
        }
        const credits = BigInt(Math.round(dash * 1e11))
        if (!user?.identityId) {
            showErrorToast('Sign in first')
            return
        }
        const mnemonic = getMnemonic()
        if (!mnemonic && from === 'transparent') {
            showErrorToast('Session phrase missing — sign in again')
            return
        }
        setBusy(true)
        const t = toast.loading(`Moving ${dash} DASH…`)
        try {
            if (from === 'transparent' && effectiveTo === 'identity') {
                const r = await moveTransparentToIdentity({
                    network: sdkNetwork as 'mainnet' | 'testnet',
                    identityId: user.identityId,
                    addressIndex: 0,
                    amountCredits: credits,
                    onProgress: setPhase,
                })
                toast.success(`Moved! Input ${Number(r.inputCredits) / 1e11} DASH · tx ${r.transitionHash.slice(0, 16)}…`, { id: t })
            } else if (from === 'transparent' && effectiveTo === 'shielded') {
                const r = await moveTransparentToShielded({
                    network: sdkNetwork as 'mainnet' | 'testnet',
                    mnemonic: mnemonic || '',
                    addressIndex: 0,
                    recipientIndex: 0,
                    amountCredits: credits,
                    memoText: 'evonext move',
                    onProgress: setPhase,
                })
                toast.success(`Shielded! tx ${r.transitionHash.slice(0, 16)}…`, { id: t })
            } else if (from === 'shielded' && effectiveTo === 'identity') {
                await shieldedEngine.start({ network: sdkNetwork, mnemonic: mnemonic || '' })
                const r = await shieldedEngine.poolExit({
                    kind: 'topUpIdentity',
                    identityId: user.identityId,
                    netCredits: credits.toString(),
                })
                toast.success(`Topped up the identity by ${Number(r.netCredits) / 1e11} DASH`, { id: t })
            } else {
                await shieldedEngine.start({ network: sdkNetwork, mnemonic: mnemonic || '' })
                const addr = await readTransparentAddress(sdkNetwork as 'mainnet' | 'testnet', 0)
                const r = await shieldedEngine.poolExit({
                    kind: 'unshield',
                    outputAddress: addr.bech32m,
                    netCredits: credits.toString(),
                })
                toast.success(`Unshielded ${Number(r.netCredits) / 1e11} DASH to Transparent`, { id: t })
            }
            setAmountDash('')
            await refreshBalances()
        } catch (err: any) {
            toast.dismiss(t)
            const detail = err?.consensusError ?? err?.message ?? 'Unknown error'
            showErrorToast(`Move failed: ${String(detail).slice(0, 200)}`)
        } finally {
            setBusy(false)
            setPhase('')
        }
    }

    const balDisplay = (credits: bigint | null): string =>
        credits === null ? '…' : `${Number(credits) / 1e11} DASH`

    return (
        <section className="my-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-violet-50/80 to-violet-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
                    Move between balances
                </h2>
                <ArrowPathIcon className="w-4 h-4 text-violet-500" />
            </div>

            {/* FROM */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 w-10">From</span>
                <div className="flex flex-1 rounded-xl bg-violet-100/80 border border-violet-200 p-1 gap-1">
                    {FROM_OPTIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFrom(key)}
                            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${from === key ? 'bg-violet-600 text-white shadow-sm' : 'text-violet-700 hover:bg-white/70'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                    {balDisplay(from === 'transparent' ? transparentBalance : shieldedBalance)}
                </span>
            </div>

            {/* TO */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 w-10">To</span>
                <div className="flex flex-1 rounded-xl bg-violet-100/80 border border-violet-200 p-1 gap-1">
                    {toOptions.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTo(key)}
                            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${effectiveTo === key ? 'bg-violet-600 text-white shadow-sm' : 'text-violet-700 hover:bg-white/70'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.0001"
                    placeholder="0.0000"
                    value={amountDash}
                    onChange={(e) => setAmountDash(e.target.value)}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-violet-400 focus:outline-none disabled:opacity-50"
                />
                <span className="text-xs text-gray-500 font-mono">DASH</span>
            </div>

            <button
                onClick={move}
                disabled={busy || !user?.identityId}
                className="mt-3 w-full rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
                {busy
                    ? (phase || 'Moving…')
                    : `Move ${toOptions.find((o) => o.key === effectiveTo)?.label ?? ''}`}
            </button>
            {!user?.identityId && (
                <p className="mt-2 text-xs text-gray-500">Sign in to move funds between your balances.</p>
            )}
        </section>
    )
}
