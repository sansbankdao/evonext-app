'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { ClipboardDocumentIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'
import { getMnemonic } from '@/lib/secure-storage'
import { derivePlatformReceiveAddress } from '@/lib/platform-address'
import { shieldedEngine } from '@/lib/shielded/engine-client'
import { WalletMoveCard } from './move-card'


interface Token {
    id: string;
}

interface WalletDepositProps {
    isFullScreen: boolean;
}


export function WalletDeposit({ isFullScreen }: WalletDepositProps) {
    const { user } =  useAuth()
    const { network } = useNetwork()
    const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
    /* F61 — the dead 'Choose a deposit currency' section (a Vue-era mock
     * offering USDT/Bitcoin on a Dash Platform wallet!) and its state
     * (depositAmount / handleChangeAsNumber / isShowingCurrencyOptions /
     * clipboardHandler) are REMOVED — no renderer, no behavior. */

    /* RECEIVE addresses for the two L2 pools — Transparent (the DIP-17
     * Platform payment address, dash1k…/tdash1k…) and Shielded (the
     * Orchard address, dash1z…/tdash1z…, derived in the shielded engine
     * worker). The identity id above remains the target for direct
     * identity credit transfers. */
    const [platformAddr, setPlatformAddr] = useState('')
    const [shieldedAddr, setShieldedAddr] = useState('')
    /* F57j — the locked-session honesty: after a reload the in-memory key
     * material is GONE (the F57b model — memory-only, wiped on unload)
     * until the unlock banner above re-materializes it. While it is gone,
     * the mnemonic-derived tiles say WHY they are empty instead of a
     * silent '…'. */
    const [locked, setLocked] = useState(false)
    /* ONE address shown at a time (owner directive — never all three at
     * once): 'transparent' | 'shielded' | 'identity'. */
    const [receiveTarget, setReceiveTarget] = useState<'transparent' | 'shielded' | 'identity'>('transparent')

    useEffect(() => {
        let cancelled = false
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
        /* Transparent: LOCAL derivation (no network I/O). */
        const initTransparent = (): boolean => {
            try {
                const mnemonic = getMnemonic()
                if (!mnemonic) {
                    /* F61 — clear a previously derived address too: the
                     * 'Lock now' / idle re-lock path re-runs this while the
                     * address state still holds the old value, and the tile
                     * would keep rendering a REAL address while the session
                     * is locked (post-reload it is '' anyway). */
                    if (!cancelled) { setLocked(true); setPlatformAddr('') }
                    return false
                }
                const platform = derivePlatformReceiveAddress(sdkNetwork, 0)
                if (!cancelled) { setPlatformAddr(platform); setLocked(false) }
                return true
            } catch (err: any) {
                /* The tiles simply show '…' — never block the page. */
                console.error('receive-address init failed:', err?.message)
                return false
            }
        }
        /* Shielded: the address derives in the engine worker — the worker
         * init (the wasm fetch + the trusted-context prefetch) can take
         * tens of seconds on a cold session (live-verified 2026-11-18: the
         * Assets Shielded row lands at ~45s while the old fixed 10×3s retry
         * had already given up at ~33s and the tile stayed '…' even though
         * the engine was fine). So: wait for the material (covers the
         * post-reload unlock), start the engine, and keep retrying every
         * 3s while this tab is mounted until it answers. */
        const shieldedLoop = async (): Promise<void> => {
            while (!cancelled) {
                const mnemonic = getMnemonic()
                if (!mnemonic) {
                    /* F61 — the same lock honesty as the transparent tile. */
                    if (!cancelled) { setLocked(true); setShieldedAddr('') }
                    await sleep(2500)
                    continue
                }
                if (!cancelled) setLocked(false)
                try {
                    await shieldedEngine.start({ network: sdkNetwork, mnemonic })
                } catch {
                    await sleep(3000)
                    continue
                }
                try {
                    const shielded = await shieldedEngine.receiveAddress(0)
                    if (!cancelled) setShieldedAddr(shielded)
                    return
                } catch {
                    await sleep(3000)
                }
            }
        }
        void initTransparent()
        void shieldedLoop()
        /* F57j — re-run the local derivation when the session unlocks while
         * this tab is open (restorePayload dispatches the event; a tab
         * switch would also remount this component). The shielded loop
         * picks the material up on its own next tick. F61 — the LOCK
         * event re-runs it too: without the mnemonic the tiles drop to
         * their locked hints. */
        const onMaterialChanged = () => { void initTransparent() }
        window.addEventListener('evonext:session-unlocked', onMaterialChanged)
        window.addEventListener('evonext:session-locked', onMaterialChanged)
        return () => {
            cancelled = true
            window.removeEventListener('evonext:session-unlocked', onMaterialChanged)
            window.removeEventListener('evonext:session-locked', onMaterialChanged)
        }
    }, [sdkNetwork])

    const copyAddress = async (value: string, what: string) => {
        if (!value) return
        try {
            await navigator.clipboard.writeText(value)
            toast.success(`${what} address copied to clipboard`)
        } catch {
            showErrorToast(`Failed to copy the ${what} address`)
        }
    }

    const Identity = {
        setAsset: (tokenid: string) => {},
        abbr: user?.dpnsUsername || '...`',
        address: user?.identityId || '...',
    }

    return (
        <main className="{props.isFullScreen === true ? 'grid lg:grid-cols-2 gap-8' : ''}">
            {/* F61 — the identity card is NO LONGER a <Link href={identityId}>:
             * an identity id is NOT a route (the click 404'd). It now links
             * to the identity's EXPLORER page (the route live-verified in
             * F48), and the stale 'Scan the QR code… click the image to
             * open your preferred wallet' copy tells the truth. */}
            <a
                href={`https://${sdkNetwork === 'mainnet' ? 'www' : 'testnet'}.platform-explorer.com/identity/${Identity.address}`}
                target="_blank"
                rel="noopener noreferrer"
            >
                <section className="w-full px-3 py-2 my-5 bg-sky-100 border-2 border-sky-300 rounded-lg shadow">
                    <h2 className="text-xl sm:text-2xl text-sky-500/50 font-medium text-center uppercase tracking-widest">
                        Dash Platform Identity
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
                        Your identity id — direct Platform credit transfers land here. Click to view it on the explorer.
                    </p>
                </section>
            </a>

            {/* RECEIVE — ONE address at a time (owner directive): a
                segmented selector over Transparent (Platform), Shielded
                (private) and the identity id (direct credit transfers). */}
            <section className="my-5 rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-sky-900 uppercase tracking-wide">
                        Receive
                    </h2>
                </div>

                {/* Segmented selector. */}
                <div className="flex rounded-xl bg-sky-100/80 border border-sky-200 p-1 gap-1">
                    {([
                        { key: 'transparent', label: 'Transparent' },
                        { key: 'shielded', label: 'Shielded' },
                        { key: 'identity', label: 'Identity' },
                    ] as const).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setReceiveTarget(key)}
                            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${receiveTarget === key ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-700 hover:bg-white/70'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* The selected address. */}
                {(() => {
                    const value = receiveTarget === 'transparent'
                        ? platformAddr
                        : receiveTarget === 'shielded'
                            ? shieldedAddr
                            : (user?.identityId || '')
                    const what = receiveTarget === 'transparent'
                        ? 'Transparent'
                        : receiveTarget === 'shielded'
                            ? 'Shielded'
                            : 'Identity'
                    const subtitle = receiveTarget === 'transparent'
                        ? 'Your DIP-17 Platform payment address — funds land in your Transparent balance.'
                        : receiveTarget === 'shielded'
                            ? 'Your Orchard address — only your phrase can see and spend these funds.'
                            : 'Your identity id — direct Platform credit transfers.'
                    return (
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                            <div className="rounded-xl border border-sky-200 bg-white p-2 shadow-sm shrink-0">
                                {value
                                    ? <QRCodeSVG value={value} size={148} />
                                    : locked
                                        ? <div className="w-[148px] h-[148px] flex flex-col items-center justify-center gap-1 text-center px-2">
                                            <LockClosedIcon className="h-5 w-5 text-amber-500" />
                                            <span className="text-[11px] leading-tight text-gray-500">Session locked —<br />restore your keys above</span>
                                          </div>
                                        : <div className="w-[148px] h-[148px] flex items-center justify-center text-sm text-gray-400">…</div>}
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <p className="text-xs text-gray-500">{subtitle}</p>
                                <button
                                    onClick={() => copyAddress(value, what)}
                                    title="Click to copy"
                                    className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-xs text-gray-700 break-all text-left hover:border-sky-400 transition-colors"
                                >
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                                    <span className="break-all">{value || (locked ? 'Locked — restore your keys above' : '…')}</span>
                                </button>
                                <button
                                    onClick={() => copyAddress(value, what)}
                                    className="w-full sm:w-auto rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-4 py-2 transition-colors"
                                >
                                    Copy {what} address
                                </button>
                            </div>
                        </div>
                    )
                })()}
            </section>

            <WalletMoveCard />

        </main>
    )
}
