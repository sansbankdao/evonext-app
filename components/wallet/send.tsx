'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { BoltIcon, UserIcon } from '@heroicons/react/24/outline'

// import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import bs58 from 'bs58'
import toast from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'

import { getIdentityIdx } from '@/lib/secure-storage'

import {
    DASH_DECIMALS,

    DEFAULT_ASSET,

    DUSD_CONTRACT_ID_MAINNET,
    DUSD_CONTRACT_ID_TESTNET,
    DUSD_DECIMALS,
    DUSD_USD_VALUE,

    SANS_CONTRACT_ID_MAINNET,
    SANS_CONTRACT_ID_TESTNET,
    SANS_DECIMALS,
    SANS_USD_VALUE,
} from '@/lib/constants'
const {
    WasmSdkBuilder,
    WasmTrustedContext,
    dpns_resolve_name,
} = require('@/lib/dash-wasm/compat')
import { getAsset, getMnemonic } from '@/lib/secure-storage'
import { IToken } from '@/lib/types'
import { sendCredit, sendToken, withdrawToCore } from '@/lib/wallet-manager'
import { shieldedEngine } from '@/lib/shielded/engine-client'

import moment from 'moment'
// @ts-ignore
import numeral from 'numeral'

interface IWalletSendProps {
    isFullScreen: boolean;
}

interface IAmountInputProps {
    asset: {
        ticker: string;
    }
}

const isBase58IdentityId = (_str: string) => {
// Basic validation: ensure we have a non-empty string.
    if (typeof _str !== 'string' || _str.length === 0) {
        return false
    }

    try {
        // Attempt to decode the Base58 string into a byte array (Uint8Array).
        const decodedBytes = bs58.decode(_str)

        // Check if the resulting byte array has a length of exactly 32.
        return decodedBytes.length === 32
    } catch (e) {
        // If decode() throws an error, it means the string is not valid Base58.
        // This can happen if it contains invalid characters like '0', 'O', 'I', 'l'.
        return false
    }
}

/** Validate a Core (L1) Base58Check address: 1 version + 20 hash + 4 checksum. */
const isCoreAddress = (_str: string) => {
    if (typeof _str !== 'string' || _str.length < 26) {
        return false
    }

    try {
        // A valid Dash address decodes to 25 bytes (version + hash160 + checksum).
        return bs58.decode(_str).length === 25
    } catch (e) {
        return false
    }
}

export function WalletSend({ isFullScreen }: IWalletSendProps) {
    const { user } =  useAuth()
    const { network } =  useNetwork()

    const [asset, setAsset] = useState<IToken>(DEFAULT_ASSET)

    /* Withdraw-to-Core (L1) state. */
    const [coreAddress, setCoreAddress] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [withdrawNote, setWithdrawNote] = useState<string | null>(null)
    const [identityFirstUse, setIdentityFirstUse] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    /* The send confirmation balances (F53d): both send paths return the
     * post-transfer balances; there is no transition-hash surface. */
    const [tokenNote, setTokenNote] = useState<{ ticker: string; recipient: string; sender?: string } | undefined>()
    const [errorMsgs, setErrorMsgs] = useState()
    const [isShowingVideoPreview, setIsShowingVideoPreview] = useState('hidden')

    const [receiver, setReceiver] = useState<string>('')
    const [amount, setAmount] = useState<string>('')

    /* F56f — the WASM-ENGINE PREFLIGHT: the Send button stays disabled with
     * an honest 'Loading wallet engine…' until the service is ready, so the
     * owner NEVER sees a forever-spinner after the confirm (the wasm load +
     * the trusted-context prefetch happen while the form is being filled). */
    const [engineReady, setEngineReady] = useState(false)

    /* F56c — WHERE THE FUNDS COME FROM. The three balance lanes (the owner
     * directive): Identity (credits), Transparent (the DIP-17 address pool),
     * Shielded (the Orchard pool). All three send TO an identity — the
     * Transparent lane = type 11 (the reference wire), the Shielded lane =
     * the engine's poolExit top-up. */
    const [source, setSource] = useState<'identity' | 'transparent' | 'shielded'>('identity')
    const [identityBalance, setIdentityBalance] = useState<bigint | null>(null)
    const [transparentBalance, setTransparentBalance] = useState<bigint | null>(null)
    const [shieldedBalance, setShieldedBalance] = useState<bigint | null>(null)

    useEffect(() => {
        /* Request asset. */
        setAsset(getAsset())
    }, [])

    /* Refresh the source balances (on mount + on the source switch). */
    const refreshSourceBalances = async () => {
        const sdkNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
        try {
            if (user?.balance !== undefined && user?.balance !== null) setIdentityBalance(BigInt(user.balance))
        } catch { /* leave null */ }
        try {
            const { readTransparentAddress } = await import('@/lib/moves-service')
            if (!getMnemonic()) {
                /* F57b — the WIF-only session: the DIP-17 pool is
                 * seed-derived and this wallet has no seed — the pool is
                 * empty BY DEFINITION. Show 0 honestly and quietly (the
                 * identity lane carries the spendable balance). */
                setTransparentBalance(0n)
            } else {
                const addr = await readTransparentAddress(sdkNetwork as 'mainnet' | 'testnet', 0)
                setTransparentBalance(addr.balance)
            }
        } catch (e: any) {
            console.error('transparent balance read failed:', e?.message)
        }
        try {
            const mnemonic = getMnemonic()
            if (mnemonic) {
                await shieldedEngine.start({ network: sdkNetwork, mnemonic })
                const snap = await shieldedEngine.snapshot()
                setShieldedBalance(BigInt(snap.balance))
            } else {
                /* F57b — the WIF-only session: the Orchard keys are
                 * ZIP-32 seed-derived — empty by definition. */
                setShieldedBalance(0n)
            }
        } catch (e: any) {
            console.error('shielded balance read failed:', e?.message)
        }
    }

    useEffect(() => {
        void (async () => {
            /* F57 Phase 1: the balance reads are TRUSTLESS — the
             * transparent lane no longer warms the wasm engine as a side
             * effect, so the F56f engine gate is now EXPLICIT: the sends
             * still execute on the wasm engine until Phase 2 (the same
             * guarded initialize ensureWasmReady runs at submit). */
            try {
                await Promise.all([
                    refreshSourceBalances(),
                    (async () => {
                        const { wasmSdkService } = await import('@/lib/services/wasm-sdk-service')
                        const { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } = await import('@/lib/constants')
                        /* The SYNCHRONOUS host switch — useNetwork's state
                         * is stale ('testnet') during the first render on
                         * production (the F57 Phase 1 race fix). */
                        const { getNetwork } = await import('@/lib/network')
                        const sdkNetwork = getNetwork() as 'mainnet' | 'testnet'
                        if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== sdkNetwork) {
                            await wasmSdkService.initialize({
                                network: sdkNetwork,
                                contractId: sdkNetwork === 'mainnet'
                                    ? EVONEXT_CONTRACT_ID_MAINNET
                                    : EVONEXT_CONTRACT_ID_TESTNET,
                            })
                        }
                    })(),
                ])
            } catch { /* the send-time ensureWasmReady re-attempts (F56d) */ }
            setEngineReady(true)
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, user?.identityId])

    const SOURCE_META: Record<'identity' | 'transparent' | 'shielded', { label: string; fee: string }> = {
        identity: { label: 'Identity', fee: 'network fee ≈ 0.00003 DASH paid from the identity' },
        transparent: { label: 'Transparent', fee: 'the address pays the transfer + fee (≈ 0.00002 DASH)' },
        shielded: { label: 'Shielded', fee: 'pool fee ≈ 0.00114 DASH deducted from the pool' },
    }

    const openScanner = () => {
    }

    /* F57f — RECIPIENT DETAILS (replaces the broken hardcoded
     * 'Identity Balance: 0 / Block Time: 1234567890' placeholders): REAL
     * live data about the address/identity the user is about to send to.
     * Identity ids resolve through the proxy-first identity service + the
     * DPNS reverse lookup; Core addresses resolve through insight
     * (balances + first transaction). Everything is honest: a miss or a
     * failure surfaces as an explicit line, never fake zeros. */
    type ReceiverInfo = {
        kind: 'identity' | 'address'
        username?: string
        identityId?: string
        balanceCredits?: number
        confirmedDuffs?: number
        unconfirmedDuffs?: number
        firstTxTime?: number
        error?: string
    }
    const [receiverInfo, setReceiverInfo] = useState<ReceiverInfo | null>(null)
    const [receiverInfoLoading, setReceiverInfoLoading] = useState(false)
    useEffect(() => {
        let cancelled = false
        const raw = receiver.trim()
        setReceiverInfo(null)
        if (!raw) {
            setReceiverInfoLoading(false)
            return
        }
        const timer = setTimeout(() => {
            void (async () => {
                setReceiverInfoLoading(true)
                try {
                    if (isBase58IdentityId(raw)) {
                        /* Identity id: balance via the proxy-first service
                         * + the DPNS reverse username (independent, best-
                         * effort). */
                        const { identityService } = await import('@/lib/services/identity-service')
                        const { dpnsService } = await import('@/lib/services/dpns-service')
                        const [identity, username] = await Promise.all([
                            identityService.getIdentity(raw),
                            dpnsService.resolveUsername(raw).catch(() => null),
                        ])
                        if (cancelled) return
                        if (!identity) {
                            setReceiverInfo({ kind: 'identity', error: 'Identity not found on this network' })
                        } else {
                            setReceiverInfo({
                                kind: 'identity',
                                username: username || undefined,
                                identityId: raw,
                                balanceCredits: identity.balance,
                            })
                        }
                    } else if (isCoreAddress(raw)) {
                        /* Core (L1) address: insight balances + the first
                         * transaction (best-effort page walk, capped). */
                        const base = network === 'mainnet'
                            ? 'https://insight.dash.org/insight-api'
                            : 'https://insight.testnet.networks.dash.org/insight-api'
                        const fx = (path: string) => fetch(base + path, { signal: AbortSignal.timeout(10000) })
                        const info = await fx('/addr/' + encodeURIComponent(raw))
                            .then(r => r.ok ? r.json() : null)
                        if (cancelled) return
                        if (!info) {
                            setReceiverInfo({ kind: 'address', error: 'Address not found on this network' })
                            return
                        }
                        /* First transaction: insight's global /txs/?address
                         * is newest-first and paginated — page pagesTotal-1
                         * IS the oldest page, so its last item is the
                         * recipient's first use (one fetch). The per-address
                         * /addr/<addr>/txs sub-route 404s on this insight
                         * build (probed). */
                        let firstTxTime: number | undefined
                        try {
                            const list = await fx(`/txs/?address=${encodeURIComponent(raw)}&pageNum=${Math.max(0, Number(info.pagesTotal ?? 1) - 1)}`)
                                .then(r => r.ok ? r.json() : null)
                            if (cancelled) return
                            const txs = Array.isArray(list?.txs) ? list.txs : []
                            if (txs.length > 0) firstTxTime = Number(txs[txs.length - 1]?.time)
                        } catch { /* first-use is best-effort */ }
                        if (cancelled) return
                        setReceiverInfo({
                            kind: 'address',
                            /* insight reports balance as a DASH float —
                             * balanceSat/unconfirmedBalanceSat are the
                             * duffs we want. */
                            confirmedDuffs: Number(info.balanceSat) || 0,
                            unconfirmedDuffs: Number(info.unconfirmedBalanceSat) || 0,
                            firstTxTime,
                        })
                    } else {
                        /* A DPNS username: resolve to the identity id, then
                         * the identity lookup. F57g: this is the ONE branch
                         * that needs the wasm SDK (resolveIdentity ->
                         * dpns_resolve_name) — on a COLD session the 26.5MB
                         * module load + trusted-context prefetch can exceed
                         * 8s, so the deadline must be generous (25s) AND
                         * honest: a timeout says TIMED OUT, not 'not found'. */
                        const { dpnsService } = await import('@/lib/services/dpns-service')
                        const resolvedId = await Promise.race([
                            dpnsService.resolveIdentity(raw).catch(() => null),
                            new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 25_000)),
                        ])
                        if (cancelled) return
                        if (resolvedId === 'timeout') {
                            setReceiverInfo({ kind: 'identity', error: 'Recipient lookup timed out — try again in a moment' })
                            return
                        }
                        let finalId: string | null = resolvedId
                        if (!finalId) {
                            /* F57g — the wasm-INDEPENDENT ladder fallback:
                             * query the DPNS domain documents through the dapi
                             * proxy directly. The native dpns_resolve_name
                             * needs a configured wasm SDK, which may still be
                             * loading on a cold session; the domain doc's
                             * records.identity[0] IS the owning identity. */
                            try {
                                const label = raw.trim().toLowerCase().replace(/\.dash$/, '')
                                const { fetchDocumentsProxyFirst } = await import('@/lib/dapi-proxy')
                                const { DPNS_CONTRACT_ID, DPNS_DOCUMENT_TYPE } = await import('@/lib/constants')
                                const { dpnsNormalizeLabel } = await import('@/lib/services/dpns-service')
                                const docs = await fetchDocumentsProxyFirst((network === 'mainnet' ? 'mainnet' : 'testnet'), {
                                    contractId: DPNS_CONTRACT_ID,
                                    type: DPNS_DOCUMENT_TYPE,
                                    /* F57g — homoglyph-normalize the label (the
                                     * contract schema: o->0, i->1, l->1) and lead
                                     * with the parent (the parentNameAndLabel
                                     * index's order) — both live-proven. */
                                    where: [
                                        ['normalizedParentDomainName', '==', 'dash'],
                                        ['normalizedLabel', '==', dpnsNormalizeLabel(label)],
                                    ],
                                    limit: 1,
                                }, async () => [])
                                const doc = Array.isArray(docs) ? docs[0] : null
                                /* records.identity is a SCALAR identity-id
                                 * string on the DPNS domain docs (live-probed
                                 * — NOT an array). */
                                const fromRecords = (doc as any)?.records?.identity
                                    ?? (doc as any)?.data?.records?.identity
                                if (typeof fromRecords === 'string' && fromRecords.length > 0) {
                                    finalId = fromRecords
                                } else if (Array.isArray(fromRecords) && typeof fromRecords[0] === 'string') {
                                    finalId = fromRecords[0]
                                }
                            } catch { /* fall through to the honest not-found line */ }
                        }
                        if (!finalId) {
                            setReceiverInfo({ kind: 'identity', error: 'No identity found for this username' })
                            return
                        }
                        const { identityService } = await import('@/lib/services/identity-service')
                        const identity = await identityService.getIdentity(finalId)
                        if (cancelled) return
                        if (!identity) {
                            setReceiverInfo({ kind: 'identity', error: 'Identity not found on this network' })
                        } else {
                            setReceiverInfo({
                                kind: 'identity',
                                username: raw,
                                identityId: finalId,
                                balanceCredits: identity.balance,
                            })
                        }
                    }
                } catch (err: any) {
                    if (!cancelled) {
                        setReceiverInfo({
                            kind: 'identity',
                            error: (err && typeof err.message === 'string' && err.message) || 'Recipient lookup failed',
                        })
                    }
                } finally {
                    if (!cancelled) setReceiverInfoLoading(false)
                }
            })()
        }, 700)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [receiver, network])

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value

        // Use a regex to allow only valid numeric/decimal characters.
        // This allows an empty string, numbers, and a single decimal point.
        const regex = /^[0-9]*\.?[0-9]*$/

        if (regex.test(value)) {
            // Prevent leading zeros like "01" or "05" but allow "0." and "0.5"
            if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
                // If "01" is entered, this will set the value to "1"
                setAmount(value.substring(1))
            } else {
                setAmount(value)
            }
        }
    }

    /* Handle asset transfer request. */
    const send = async () => {
        /* Initialize locals. */
        let assetValue
        let assetDecimals
        let assetUsdValue
        let error
        let response
        let safeReceiver
        let sdk

        /* Reset state. */
        setErrorMsgs(undefined)

        /* Validate receiver. */
        if (typeof receiver === null) {
            return showErrorToast('Please enter an IDENTITY ADDRESS.')
        }

        // When you need the numeric value for calculations, parse the string.
        // Default to 0 if the string is empty or just a ".".
        const numericAmount = parseFloat(amount) || 0

        /* Validate duffs. */
        if (numericAmount === null || numericAmount === 0) {
            return showErrorToast('Please enter an AMOUNT to send.')
        }

        /* Request (active) asset. */
        const asset = getAsset()

        switch(asset.id) {
        case DUSD_CONTRACT_ID_MAINNET:
        case DUSD_CONTRACT_ID_TESTNET: {
            /* Calculate DASH value. */
            assetValue = BigInt(Math.trunc(numericAmount * (10 ** DUSD_DECIMALS)))

            /* F57j.4 — the USD value: the LIVE dashswap ticker price
             * (cache first, a non-fatal 8s refresh — the same pattern as
             * the DASH branch below; the send NEVER blocks on a cosmetic
             * figure), falling back to the pinned $1.00 peg. */
            const { readCachedTokenPrice, fetchTokenUsdPrice } = await import('@/lib/wallet-assets')
            let dusdUsdValue = readCachedTokenPrice('DUSD') ?? DUSD_USD_VALUE
            const dusdLive = await fetchTokenUsdPrice('DUSD')
            if (dusdLive) dusdUsdValue = dusdLive

            /* Calculate USD value. */
            assetUsdValue = numericAmount * dusdUsdValue
            break
        }
        case SANS_CONTRACT_ID_MAINNET:
        case SANS_CONTRACT_ID_TESTNET: {
            /* Calculate DASH value. */
            assetValue = BigInt(Math.trunc(numericAmount * (10 ** SANS_DECIMALS)))

            /* F57j.4 — the LIVE SANS price (the hardcoded $0.01 was ~6x
             * off the live ladder price), cache first + a non-fatal
             * refresh, falling back to the pinned 0.01. */
            const { readCachedTokenPrice, fetchTokenUsdPrice } = await import('@/lib/wallet-assets')
            let sansUsdValue = readCachedTokenPrice('SANS') ?? SANS_USD_VALUE
            const sansLive = await fetchTokenUsdPrice('SANS')
            if (sansLive) sansUsdValue = sansLive

            /* Calculate USD value. */
            assetUsdValue = numericAmount * sansUsdValue
            break
        }
        default:
            /* Calculate DASH value. */
            assetValue = BigInt(Math.trunc(numericAmount * (10 ** DASH_DECIMALS)))

            /* F56e — THE SEND-PANEL HANG FIX: this ticker fetch had NO
             * timeout and NO error handling — on a slow connection it hung
             * the send FOREVER (the owner's exact report; the DUSD branch
             * uses a constant and worked). The price now comes from the
             * shared cache first (instant) and falls back to 0 — the send
             * NEVER blocks on the network for a cosmetic USD figure. */
            const { readCachedDashPrice } = await import('@/lib/wallet-assets')
            let dashUsdValue = readCachedDashPrice() ?? 0
            try {
                const ctrl = new AbortController()
                const timer = setTimeout(() => ctrl.abort(), 8000)
                const tickerResponse = await fetch('https://dashswap.xyz/v1/ticker/DASH', { signal: ctrl.signal })
                clearTimeout(timer)
                const ticker = await tickerResponse.json()
                if (Number(ticker?.quote?.USD?.price ?? 0) > 0) {
                    dashUsdValue = Number(ticker.quote.USD.price)
                    const { writeCachedDashPrice } = await import('@/lib/wallet-assets')
                    writeCachedDashPrice(dashUsdValue)
                }
            } catch { /* the cached/0 price — the send continues */ }

            /* Calculate USD value. */
            assetUsdValue = numericAmount * dashUsdValue
        }

        /* Confirm user request. */
        if (confirm(`Are you sure you want to send ${numeral(numericAmount).format('0,0.00[0000]')} ${asset.ticker} (valued @ ${numeral(assetUsdValue).format('0,0.00[0000]')} USD) to ${receiver}?`)) {

            /* Set flag. */
            setIsSubmitting(true)

            /* Request Identity index. */
            const identityIdx = getIdentityIdx()

            /* Validate Identity or Username format. */
            if (!isBase58IdentityId(receiver)) {
                /* Handle network. */
                // 4.1.1 API: the trusted context discovers live masternode
                // addresses at runtime (the old hard-coded list was removed).
                if (network === 'mainnet') {
                    const context = await WasmTrustedContext.prefetchMainnet()
                    sdk = await WasmSdkBuilder.mainnet().withTrustedContext(context).build()
                } else {
                    const context = await WasmTrustedContext.prefetchTestnet()
                    sdk = await WasmSdkBuilder.testnet().withTrustedContext(context).build()
                }

                /* Resolve username (w/ onchain query). F57g: the wasm
                 * resolver accepts BOTH the bare label and the '.dash'
                 * suffix (live-probed both forms -> the same identity), but
                 * DPNS labels are stored LOWERCASE — an uppercase-typed
                 * username would miss. This branch only runs when the input
                 * already failed the 32-byte id decode, so lowercasing can
                 * never corrupt a real identity id. */
                safeReceiver = await dpns_resolve_name(sdk, receiver.trim().toLowerCase())
            } else {
                safeReceiver = receiver
            }

            /* F56: the protocol REJECTS self-transfers ('Credits transfer
             * recipient must be another identity' — live-confirmed on
             * mainnet 2026-11-15). Guard early with a friendly toast and
             * point at the Move card. */
            if (asset.id === '0' && safeReceiver && user?.identityId && safeReceiver === user.identityId) {
                showErrorToast("You can't send to your own identity — use the Move card on the Receive tab to move funds between your balances.")
                setIsSubmitting(false)
                return
            }

            /* Validate asset. */
            if (asset.id === '0') {
                /* Per-source balance guard (F56c). */
                const bal = source === 'identity'
                    ? identityBalance
                    : source === 'transparent'
                        ? transparentBalance === null ? null : transparentBalance - 4_000_000n
                        : shieldedBalance
                if (bal !== null && assetValue > bal) {
                    setIsSubmitting(false)
                    return showErrorToast(`Insufficient ${SOURCE_META[source].label} balance (${Number(bal) / 1e11} DASH available).`)
                }

                if (source === 'transparent') {
                    /* F56c: the DIP-17 address → the recipient identity
                     * (type 11, the consensus-exact reference wire). */
                    try {
                        const { moveTransparentToIdentity } = await import('@/lib/moves-service')
                        const r = await moveTransparentToIdentity({
                            network: (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet',
                            identityId: safeReceiver,
                            addressIndex: 0,
                            amountCredits: assetValue,
                            onProgress: () => { },
                        })
                        setTokenNote({
                            ticker: asset.ticker,
                            recipient: `${numeral(Number(0) / 1e11).format('0,0[.]00000000')}`,
                            sender: 'your Transparent balance',
                        })
                        toast.success(`Sent ${numeral(numericAmount).format('0,0.00[0000]')} DASH from Transparent — tx ${r.transitionHash.slice(0, 16)}…`)
                        setAmount('')
                        setIsSubmitting(false)
                        void refreshSourceBalances()
                        return
                    } catch (err: any) {
                        console.error(err)
                        setErrorMsgs(err?.consensusError ?? err?.message)
                        setIsSubmitting(false)
                        return
                    }
                }
                if (source === 'shielded') {
                    /* F56c: the shielded pool → the recipient identity
                     * (type 22 via the engine worker; the notes never leave). */
                    try {
                        const mnemonic = getMnemonic()
                        await shieldedEngine.start({ network: network === 'mainnet' ? 'mainnet' : 'testnet', mnemonic: mnemonic || '' })
                        const r = await shieldedEngine.poolExit({
                            kind: 'topUpIdentity',
                            identityId: Buffer.from(bs58.decode(safeReceiver)).toString('hex'),
                            netCredits: assetValue.toString(),
                        })
                        setTokenNote({
                            ticker: asset.ticker,
                            recipient: numeral(Number(r.netCredits) / 1e11).format('0,0[.]00000000'),
                            sender: 'your Shielded balance',
                        })
                        toast.success(`Sent ${numeral(numericAmount).format('0,0.00[0000]')} DASH from Shielded — fee ${Number(r.feeCredits) / 1e11} DASH`)
                        setAmount('')
                        setIsSubmitting(false)
                        void refreshSourceBalances()
                        return
                    } catch (err: any) {
                        console.error(err)
                        setErrorMsgs(err?.message)
                        setIsSubmitting(false)
                        return
                    }
                }

                /* Request a credit transfer. */
                response = await sendCredit(
                    network!,
                    user!.identityId,
                    identityIdx,
                    safeReceiver,
                    assetValue
                ).catch(err => {
                    console.error(err)
                    setErrorMsgs(err?.message)
                })
            } else {
                /* Request a credit transfer. */
                response = await sendToken(
                    network!,
                    user!.identityId,
                    identityIdx,
                    asset.id,
                    safeReceiver,
                    assetValue
                ).catch(err => {
                    console.error(err)
                    setErrorMsgs(err?.message)
                })
            }

            /* Confirmation (F53d): the high-level ops expose NO transition
             * hashes — both return the POST-transfer balances. Show those
             * (per-asset decimals: DASH 11 credits, DUSD 6, SANS 8); the
             * old 'UNKNOWN TXID' + nexa-explorer link is gone. */
            const txResponse = response as any
            if (txResponse && txResponse.recipientBalance !== undefined) {
                const decimals = asset.id === '0' || asset.id === 'shielded'
                    ? DASH_DECIMALS
                    : (asset.id === DUSD_CONTRACT_ID_MAINNET || asset.id === DUSD_CONTRACT_ID_TESTNET)
                        ? DUSD_DECIMALS
                        : SANS_DECIMALS
                setTokenNote({
                    ticker: asset.ticker,
                    recipient: numeral(parseFloat(txResponse.recipientBalance.toString()) / (10 ** decimals)).format('0,0[.]00000000'),
                    sender: txResponse.senderBalance !== undefined
                        ? numeral(parseFloat(txResponse.senderBalance.toString()) / (10 ** decimals)).format('0,0[.]00000000')
                        : undefined,
                })
            }

            /* Set flag. */
            setIsSubmitting(false)
        }
    }

    // const updateIdentityDetails = (_receiver: string) => {
    //     setReceiver(_receiver)
    // }


    // const amount = ref(null)
    // const receiver = ref(null)
    // const currency = ref(null)
    // const satoshis = ref(null)
    // const txidem = ref(null)
    // const errorMsgs = ref(null)

    // const reciverBalance = ref(null)
    // const identityFirstUse = ref(null)
    // const receiverFirstTx = ref(null)
    // const consolidation = ref(null)

    // const video = ref(null)
    // const scanner = ref(null)
    // const cameraError = ref(null)

    // const isShowingVideoPreview = ref('hidden')

    // const getIdentityBalance = async (_identity) => {
    //     return 123
    // }

    // const getIdentityFirstUse = async (_identity) => {
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
    //         return alert('Enter a destination Identity.')
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
    //     if (confirm(`Are you sure you want to consolidate ${consolidation.value.coins} coin inputs to ${Identity.id}?`)) {
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

    // const updateIdentityDetails = async () => {
    //     console.log('RECEIVER', receiver.value)

    //     /* Clear errors. */
    //     clearErrors()

    //     reciverBalance.value = await getIdentityBalance(receiver.value)
    //         .catch(err => console.error(err))
    //     // console.log('ADDRESS BALANCE', reciverBalance.value)

    //     identityFirstUse.value = await getIdentityFirstUse(receiver.value)
    //         .catch(err => console.error(err))
    //     // console.log('ADDRESS FIRST USE', identityFirstUse.value)

    //     receiverFirstTx.value = await getTransaction(identityFirstUse.value.tx_hash)
    //         .catch(err => console.error(err))
    //     // console.log('FIRST TX', receiverFirstTx.value)
    // }

    // const clearErrors = () => {
    //     errorMsgs.value = null
    // }

    return (
        <main className="grid grid-cols-1 lg:grid-cols-7 gap-8 lg:divide-x-2 divide-solid divide-sky-200">
            <div className="col-span-4">
                {/* F56c — WHERE THE FUNDS COME FROM (the owner directive):
                 * the three balance lanes with their live balances. Only the
                 * DASH-credits asset shows it (tokens have a single lane). */}
                {asset.id === '0' && <section className="mt-5">
                    <h2 className="text-xs tracking-widest text-sky-700 font-medium uppercase mb-2">
                        Send from
                    </h2>
                    <div className="flex rounded-xl bg-sky-100/80 border border-sky-200 p-1 gap-1">
                        {(['identity', 'transparent', 'shielded'] as const).map((s) => {
                            const bal = s === 'identity'
                                ? identityBalance
                                : s === 'transparent'
                                    ? transparentBalance
                                    : shieldedBalance
                            return (
                                <button
                                    key={s}
                                    onClick={() => setSource(s)}
                                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${source === s ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-700 hover:bg-white/70'}`}
                                >
                                    <span className="block">{SOURCE_META[s].label}</span>
                                    <span className={`block font-mono text-[11px] ${source === s ? 'text-sky-100' : 'text-sky-500'}`}>
                                        {bal === null ? '…' : `${numeral(Number(bal) / 1e11).format('0,0.00[0000]')}`}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 italic">
                        {SOURCE_META[source].fee}
                    </p>
                </section>}

                <section className="mt-5 flex flex-row gap-1">
                    <input
                        className="w-full px-3 py-1 text-xl sm:text-2xl bg-cyan-100 border-2 border-cyan-300 rounded-md shadow"
                        type="text"
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        placeholder="Enter a Username or Identity ID"
                    />

                    <div onClick={openScanner}>
                        <svg className="cursor-pointer w-12 h-12 hover:text-red-500 hover:cursor-pointer" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"></path>
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
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={handleAmountChange}
                        placeholder={`Enter a (${asset.ticker}) amount`}
                        aria-label={`Amount in ${asset.ticker}`}
                    />

                    {/* <!-- <h4 v-if="satoshis > 0" className="mt-1 ml-3 text-sm text-gray-500 font-medium">
                        = {{numeral(satoshis / 100).format('0,0')}} {{Identity.asset?.ticker}}
                    </h4> --> */}
                </section>

                <button
                    onClick={send}
                    className={`w-fit flex items-center my-5 px-5 py-2 text-2xl font-medium bg-blue-200 border-2 border-blue-400 rounded-md shadow hover:bg-blue-300 ${(isSubmitting || !engineReady) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    disabled={isSubmitting || !engineReady}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 size-8 animate-spin" />
                            Sending {asset.ticker}...
                        </>
                    ) : !engineReady ? (
                        <>
                            <Loader2 className="mr-2 size-8 animate-spin" />
                            Loading wallet engine...
                        </>
                    ) : (
                        `Send ${asset.ticker}`
                    )}
                </button>

                {tokenNote && <section className="my-10">
                    <div>
                        <h3 className="text-sm text-gray-500 font-medium">Transaction sent successfully!</h3>
                        <h3 className="text-xs text-gray-500 mt-1">
                            {tokenNote.ticker} balances after the transfer — recipient: {tokenNote.recipient}{tokenNote.sender ? ` · yours: ${tokenNote.sender}` : ''}
                        </h3>
                    </div>
                </section>}

                {errorMsgs && <section className="my-10">
                    <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                        clipRule="evenodd"
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
                </section>}

                {/* F57f — the RECIPIENT card (replaces the broken hardcoded
                 * 'Identity Balance / First Transaction' placeholders):
                 * live data about who is about to receive the funds. */}
                {(receiverInfoLoading || receiverInfo) && <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/80 to-sky-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-sky-700" />
                            <h2 className="text-xs tracking-widest text-sky-700 font-medium uppercase">
                                Recipient
                            </h2>
                        </div>
                        {receiverInfoLoading && (
                            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                        )}
                    </div>

                    {receiverInfoLoading && !receiverInfo ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 w-1/2 rounded bg-sky-200/70" />
                            <div className="h-3 w-1/3 rounded bg-sky-200/70" />
                        </div>
                    ) : receiverInfo?.error ? (
                        <p className="text-sm text-rose-600 break-words">
                            {receiverInfo.error}
                        </p>
                    ) : receiverInfo?.kind === 'address' ? (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">Confirmed</p>
                                <p className="text-base font-semibold text-slate-800 break-all">
                                    {numeral((receiverInfo.confirmedDuffs ?? 0) / 1e8).format('0,0.00[0000]')} DASH
                                </p>
                            </div>
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">Unconfirmed</p>
                                <p className="text-base font-semibold text-slate-800 break-all">
                                    {numeral((receiverInfo.unconfirmedDuffs ?? 0) / 1e8).format('0,0.00[0000]')} DASH
                                </p>
                            </div>
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">First transaction</p>
                                <p className="text-base font-semibold text-slate-800">
                                    {receiverInfo.firstTxTime
                                        ? moment.unix(receiverInfo.firstTxTime).format('MMM D, YYYY')
                                        : '—'}
                                </p>
                                {receiverInfo.firstTxTime && (
                                    <p className="text-2xs italic text-sky-600">
                                        {moment.unix(receiverInfo.firstTxTime).fromNow()}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">Identity balance</p>
                                <p className="text-base font-semibold text-slate-800">
                                    {numeral((receiverInfo?.balanceCredits ?? 0) / 1e11).format('0,0.00[0000]')} DASH
                                </p>
                            </div>
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">Username</p>
                                <p className="text-base font-semibold text-sky-700 break-all">
                                    {receiverInfo?.username
                                        ? `@${receiverInfo?.username.replace(/\.dash$/, '')}`
                                        : '—'}
                                </p>
                            </div>
                            <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-center">
                                <p className="text-2xs text-slate-500 uppercase tracking-wide">Identity ID</p>
                                <p className="text-base font-semibold text-slate-800 break-all" title={receiver}>
                                    {(() => { const id = receiverInfo?.identityId ?? receiver
                                        return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id })()}
                                </p>
                            </div>
                        </div>
                    )}
                </section>}
            </div>

            <section className="pl-0 lg:pl-5 col-span-3 flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-medium">
                        Advanced Options
                    </h1>
                </div>

                {/* BEGIN WITHDRAW TO CORE (L1) */}
                <div className="px-4 py-5 rounded-lg border-2 border-sky-200 bg-sky-50">
                    <h2 className="text-xl font-medium tracking-widest">
                        Withdraw to Dash (L1)
                    </h2>

                    <p className="mt-2 text-sm text-slate-600">
                        Move identity credits back to a Dash (Core) address.
                        The withdrawal is signed by YOUR transfer key — no server ever holds your keys.
                    </p>

                    <section className="mt-4 flex flex-col gap-3">
                        <input
                            className="w-full px-3 py-1 text-lg bg-cyan-100 border-2 border-cyan-300 rounded-md shadow"
                            type="text"
                            value={coreAddress}
                            onChange={(e) => setCoreAddress(e.target.value)}
                            placeholder="Enter a Dash (L1) address"
                            autoComplete="off"
                        />

                        <input
                            className="w-full px-3 py-1 text-lg bg-cyan-100 border-2 border-cyan-300 rounded-md shadow"
                            type="text"
                            inputMode="decimal"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="Amount in DASH"
                            aria-label="Withdraw amount in DASH"
                        />

                        <button
                            onClick={async () => {
                                /* Reset state. */
                                setWithdrawNote(null)

                                /* Validate destination. */
                                if (!isCoreAddress(coreAddress)) {
                                    return showErrorToast('Please enter a valid Dash (L1) address.')
                                }

                                /* Validate amount. */
                                const numeric = parseFloat(withdrawAmount) || 0
                                if (numeric <= 0) {
                                    return showErrorToast('Please enter an AMOUNT to withdraw.')
                                }

                                /* Confirm the withdrawal. */
                                if (!confirm(`Withdraw ${withdrawAmount} DASH from your identity to:\n\n${coreAddress}\n\nContinue?`)) {
                                    return
                                }

                                /* Set flag. */
                                setIsWithdrawing(true)

                                try {
                                    /* Set credits (100B credits per DASH). */
                                    const credits = BigInt(Math.trunc(numeric * 1e11))

                                    /* Request withdrawal. */
                                    const response = await withdrawToCore(
                                        network!,
                                        user?.identityId!,
                                        getIdentityIdx() || 0,
                                        credits,
                                        coreAddress,
                                        1,
                                    )

                                    /* Set note. F57h — an UNCONFIRMED result is
                                     * NOT a failure: the network was slow to
                                     * include the withdrawal in a block. The
                                     * note must tell the user NOT to resubmit
                                     * (a repeat could pay out twice). */
                                    if ((response as any)?.unconfirmed) {
                                        setWithdrawNote(
                                            `Withdrawal submitted — the network is confirming it (it was slow to respond). It should process with an upcoming block. Do NOT submit again until it shows in your History.`
                                        )
                                    } else {
                                        setWithdrawNote(
                                            `Withdrawal submitted! The funds will arrive at your Dash address after the network processes the withdrawal (usually within minutes to about a day).`
                                        )
                                    }
                                } catch (err: any) {
console.error('WITHDRAW FAILED', err)
                                    /* F57h — the SDK's own high-level ops wrap
                                     * errors with "Withdrawal failed: …"
                                     * (the string is in the wasm binary) — do
                                     * not double-prefix. */
                                    const rawMsg = err?.message || 'unknown error'
                                    showErrorToast(rawMsg.startsWith('Withdrawal failed') ? rawMsg : `Withdrawal failed: ${rawMsg}`)
                                } finally {
                                    /* Reset flag. */
                                    setIsWithdrawing(false)
                                }
                            }}
                            className={`w-fit flex items-center px-5 py-2 text-xl font-medium bg-sky-200 border-2 border-sky-400 rounded-md shadow hover:bg-sky-300 ${isWithdrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={isWithdrawing}
                        >
                            {isWithdrawing ? (
                                <>
                                    <Loader2 className="mr-2 size-6 animate-spin" />
                                    Withdrawing...
                                </>
                            ) : (
                                'Withdraw to Dash'
                            )}
                        </button>

                        {withdrawNote && <p className="text-sm text-emerald-700 font-medium">
                            {withdrawNote}
                        </p>}
                    </section>
                </div>
                {/* END WITHDRAW TO CORE (L1) */}
            </section>
        </main>
    )
}
