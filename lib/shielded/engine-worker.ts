// lib/shielded/engine-worker.ts
//
// The SHIELDED ENGINE WEB WORKER — the wallet's entire shielded stack
// (wasm SDK init, ZIP-32 key derivation, the note-tree sync engine, spend
// status, transaction history and the send pipeline) runs INSIDE this
// worker so the main thread NEVER blocks on curve math (the F43 wallet
// hang). One worker instance serves both the Assets list's Shielded row
// and the full-screen WalletShielded view.
//
// Message protocol (postMessage only — structured clone):
//   main -> worker:
//     { type: 'init', network, mnemonic, state }   state = persisted sync
//                                                  JSON from localStorage
//     { type: 'rpc', id, method, params }
//   worker -> main:
//     { type: 'ready' }
//     { type: 'initFailed', error }
//     { type: 'persist', state }                   main thread localStorage
//     { type: 'scanProgress', scanned, alignedCount, balance, owned }
//     { type: 'sendProgress', phase }
//     { type: 'result', id, ok, payload?, error? }
//
// Every engine behavior mirrors the LIVE-VERIFIED main-thread code it
// replaces (F40/F41 assets.tsx scan loop + shielded.tsx scan/send/poll +
// wasm-sdk-service init) — see lib/shielded/wallet.ts headers.

import init, { WasmSdkBuilder, WasmTrustedContext } from '../dash-wasm/wasm_sdk'
import { mnemonicToSeedSync } from '@scure/bip39'

import { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } from '../constants'
import { makeProxyFirstShieldedSource } from '../dapi-proxy'
import {
    deriveShieldedWalletKeys, sendShielded, buildShieldedHistory,
    unshieldToAddress, topUpIdentityFromPool,
    shieldedAddressAt, type ShieldedWalletKeys,
} from './wallet'
import { ShieldedSync, type OwnedShieldedNote } from './sync'

type Network = 'mainnet' | 'testnet'

/* Worker scope typing without the webworker lib (tsc stays DOM-only). */
const ctx = self as unknown as {
    postMessage: (message: unknown) => void
    addEventListener: (type: 'message', cb: (event: MessageEvent) => void) => void
}

const post = (message: unknown) => ctx.postMessage(message)

/** Serialized engine snapshot (all u64s as decimal strings — the u64/u128
 *  string rule; JSON never sees a number above 2^53). */
interface EngineSnapshot {
    balance: string
    alignedCount: number
    notes: OwnedShieldedNote[]
    sentCount: number
}

/* --- State -------------------------------------------------------------- */

let network: Network = 'testnet'
/** Guards against a second 'init' while one is still running (the
 *  client single-flights, but the worker is the last line of defense —
 *  concurrent initEngine runs break the wasm's closures). */
let initInFlight = false
let sdk: any = null
let keys: ShieldedWalletKeys | null = null
let sync: ShieldedSync | null = null

/** The persisted blob the main thread handed us; the sync persists back
 *  through this bridge (workers have no localStorage). */
let persistedState: string | null = null

const bridgeStorage = {
    getItem: (_key: string): string | null => persistedState,
    setItem: (_key: string, value: string) => {
        persistedState = value
        /* Fire-and-forget: the main thread writes localStorage in message
         * order; a lost write at page-close is recoverable (the sync is
         * resumable by design). */
        post({ type: 'persist', state: value })
    },
}

const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
    Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms)),
    ])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/* --- Engine construction (mirrors WasmSdkService + makeShieldedSync) ---- */

async function initEngine(options: {
    network: Network
    mnemonic: string
    state: string | null
}): Promise<void> {
    network = options.network
    persistedState = options.state

    /* WASM module (the glue fetches wasm_sdk_bg.wasm itself). */
    await init()

    /* Trusted-context DAPI discovery + the 8s request timeout — the exact
     * WasmSdkService._performInitialization sequence, minus window/localStorage
     * (workers have neither). */
    const contractId = network === 'mainnet' ? EVONEXT_CONTRACT_ID_MAINNET : EVONEXT_CONTRACT_ID_TESTNET
    const context = network === 'mainnet'
        ? await WasmTrustedContext.prefetchMainnet()
        : await WasmTrustedContext.prefetchTestnet()
    const builder = network === 'mainnet'
        ? WasmSdkBuilder.mainnet().withTrustedContext(context)
        : WasmSdkBuilder.testnet().withTrustedContext(context)
    sdk = builder.withSettings(undefined, 8000, undefined, undefined).build()

    /* ZIP-32 account-0 keys (coin_type 5 mainnet / 1 testnet). */
    const seed = mnemonicToSeedSync(options.mnemonic)
    keys = deriveShieldedWalletKeys(seed, network)

    /* Proxy-first sync source (dapi.sansbank.dev with per-call WASM fallback,
     * F29) over the worker's own SDK. */
    const wasmSource = {
        getShieldedEncryptedNotes: (start: bigint, count: number) => sdk.getShieldedEncryptedNotes(start, count),
        getShieldedAnchors: () => sdk.getShieldedAnchors(),
        getMostRecentShieldedAnchor: () => sdk.getMostRecentShieldedAnchor(),
        getShieldedNullifiers: (nullifiers: Uint8Array[]) => sdk.getShieldedNullifiers(nullifiers),
    }
    const source = makeProxyFirstShieldedSource(network, wasmSource)
    sync = new ShieldedSync(
        source, bridgeStorage, `evonext_shielded_sync_${network}`, keys.ivk, keys.fvk.nk, keys.ovk)
}

const snapshot = (): EngineSnapshot => {
    const s = sync as ShieldedSync
    return {
        balance: s.balance().toString(),
        alignedCount: s.size,
        notes: [...s.notes],
        sentCount: s.sent.length,
    }
}

/* --- RPC methods --------------------------------------------------------- */

/** The F43 scan loop, 1:1 (6 attempts, 150s syncPass / 60s refreshSpent
 *  caps, 5s backoff — the pass is resumable; the wasm request-timeout can
 *  leave a query pending FOREVER (F30)). Runs off the main thread now. */
async function rpcScan(): Promise<EngineSnapshot> {
    const s = sync as ShieldedSync
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            const ok = await withTimeout(s.syncPass(({ scanned }) => {
                post({ type: 'scanProgress', scanned, alignedCount: s.size, balance: s.balance().toString(), owned: s.notes.length })
            }), 150000, `shielded scan (attempt ${attempt + 1})`)
            if (!ok) throw new Error('scan interrupted')
            await withTimeout(s.refreshSpent(), 60000, 'spend-status refresh')
            post({
                type: 'scanProgress', scanned: s.size, alignedCount: s.size,
                balance: s.balance().toString(), owned: s.notes.length,
            })
            return snapshot()
        } catch (error: any) {
            console.error(`shielded engine scan attempt ${attempt + 1} failed:`, error?.message)
            await sleep(5000)
        }
    }
    throw new Error('The shielded scan did not complete — try again')
}

async function rpcSettle(params: {
    direction: 'below' | 'above'
    baseline: string
}): Promise<EngineSnapshot> {
    const s = sync as ShieldedSync
    const baseline = BigInt(params.baseline)
    for (let i = 0; i < 8; i++) {
        await sleep(15000)
        try {
            await s.syncPass()
            await s.refreshSpent()
        } catch { /* keep polling */ }
        const credits = s.balance()
        post({
            type: 'scanProgress', scanned: s.size, alignedCount: s.size,
            balance: credits.toString(), owned: s.notes.length,
        })
        if ((params.direction === 'below' && credits < baseline) ||
            (params.direction === 'above' && credits > baseline)) break
    }
    return snapshot()
}

async function rpcSend(params: {
    recipient: string
    amountCredits: string
    memoText?: string
}): Promise<{ transitionHash: string; feeCredits: string; changeCredits: string; spentPositions: number[] }> {
    const result = await sendShielded({
        sdk: sdk as any,
        keys: keys as ShieldedWalletKeys,
        sync: sync as ShieldedSync,
        network,
        recipient: params.recipient,
        amountCredits: BigInt(params.amountCredits),
        memoText: params.memoText,
        onProgress: (phase) => post({ type: 'sendProgress', phase }),
    })
    return {
        transitionHash: result.transitionHash,
        feeCredits: result.feeCredits.toString(),
        changeCredits: result.changeCredits.toString(),
        spentPositions: result.spentPositions,
    }
}

async function rpcPoolExit(params: {
    kind: 'unshield' | 'topUpIdentity'
    outputAddress?: string
    identityId?: string
    netCredits: string
}): Promise<{ transitionHash: string; feeCredits: string; changeCredits: string; spentPositions: number[]; netCredits: string }> {
    const common = {
        sdk: sdk as any,
        keys: keys as ShieldedWalletKeys,
        sync: sync as ShieldedSync,
        network,
        netCredits: BigInt(params.netCredits),
        onProgress: (phase: string) => post({ type: 'sendProgress', phase }),
    }
    const result = params.kind === 'unshield'
        ? await unshieldToAddress({ ...common, outputAddress: params.outputAddress! })
        : await topUpIdentityFromPool({ ...common, identityId: new Uint8Array(Buffer.from(params.identityId!, 'hex')) })
    return {
        transitionHash: result.transitionHash,
        feeCredits: result.feeCredits.toString(),
        changeCredits: result.changeCredits.toString(),
        spentPositions: result.spentPositions,
        netCredits: result.netCredits.toString(),
    }
}

/* --- Message pump --------------------------------------------------------- */

const handleRpc = async (id: number, method: string, params: any): Promise<void> => {
    try {
        if (!sync || !keys || !sdk) throw new Error('The shielded engine is not initialized')
        let payload: unknown
        switch (method) {
        case 'scan':
            payload = await rpcScan()
            break
        case 'snapshot':
            payload = snapshot()
            break
        case 'history':
            payload = buildShieldedHistory(sync as ShieldedSync, keys, network).map((entry) => ({
                ...entry,
                credits: entry.credits.toString(),
            }))
            break
        case 'send':
            payload = await rpcSend(params)
            break
        case 'settle':
            payload = await rpcSettle(params)
            break
        case 'poolExit':
            payload = await rpcPoolExit(params)
            break
        case 'receiveAddress':
            payload = shieldedAddressAt(keys, Number(params?.index ?? 0), network)
            break
        case 'keys':
            /* The SHIELD flow (asset-lock path) still assembles on the main
             * thread (its wasm AssetLockProof/PrivateKey objects live in the
             * MAIN thread's SDK). Key exposure is unchanged from F40 — the
             * keys were always derived in this page's memory; they only move
             * across the same-origin boundary of this very page. */
            payload = keys
            break
        default:
            throw new Error(`Unknown shielded-engine method: ${method}`)
        }
        post({ type: 'result', id, ok: true, payload })
    } catch (error: any) {
        post({ type: 'result', id, ok: false, error: error?.message || String(error) })
    }
}

ctx.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as any
    if (data?.type === 'init') {
        if (initInFlight) return
        initInFlight = true
        initEngine({ network: data.network, mnemonic: data.mnemonic, state: data.state })
            .then(() => post({ type: 'ready' }))
            .catch((error: any) => post({ type: 'initFailed', error: error?.message || String(error) }))
            .finally(() => { initInFlight = false })
        return
    }
    if (data?.type === 'rpc') {
        void handleRpc(Number(data.id), String(data.method), data.params)
    }
})
