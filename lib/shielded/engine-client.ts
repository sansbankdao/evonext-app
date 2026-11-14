// lib/shielded/engine-client.ts
//
// MAIN-THREAD client for the shielded engine worker
// (lib/shielded/engine-worker.ts). Exposes the same operations the
// main-thread code used to run inline — scan, balance, history, send,
// settle poll — as pure async RPC, so the wallet UI never blocks on the
// note-tree scan or the spend-halves build (the F43 wallet hang).
//
//  - ONE worker per page (module singleton); start() is idempotent per
//    (network, mnemonic) and re-inits when either changes.
//  - Persistence stays in localStorage on the MAIN thread: the worker
//    posts every state blob ('persist'), this client writes it. The UI's
//    instant-seed path reads the same blob via persistedShieldedBalance().
//  - Key material stays in the worker; the one exception is the SHIELD
//    flow, whose wasm AssetLockProof objects live in the MAIN thread's
//    SDK (see the worker's 'keys' method).

import type { OwnedShieldedNote } from './sync'
import type { ShieldedWalletKeys } from './wallet'
import type { ShieldedHistoryKind } from './wallet'

type Network = 'mainnet' | 'testnet'

export interface ShieldedSnapshot {
    /** Sum of UNSPENT note values (decimal credits string). */
    balance: string
    alignedCount: number
    notes: OwnedShieldedNote[]
    sentCount: number
}

export interface ShieldedHistoryRow {
    kind: ShieldedHistoryKind
    /** Decimal credits string (u64 string rule). */
    credits: string
    address?: string
    memo: string
    treeIndex: number
    spent: boolean
}

export interface ShieldedSendResult {
    transitionHash: string
    feeCredits: string
    changeCredits: string
    spentPositions: number[]
}

interface Pending {
    resolve: (value: any) => void
    reject: (error: Error) => void
}

export type ScanStatusHandler = (status: {
    scanned: number
    alignedCount: number
    balance: string
    owned: number
}) => void
export type SendPhaseHandler = (phase: string) => void

const SYNC_STATE_KEY = (network: Network) => `evonext_shielded_sync_${network}`

/** The unspent sum from the PERSISTED state — lets the UI show the last
 *  known balance instantly (the engine scan then refines it). */
export function persistedShieldedBalance(network: Network): bigint | null {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(SYNC_STATE_KEY(network))
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as { notes?: OwnedShieldedNote[] }
        if (!Array.isArray(parsed.notes)) return null
        let total = 0n
        for (const note of parsed.notes) {
            if (!note.spent) total += BigInt(note.value)
        }
        return total
    } catch {
        return null
    }
}

class ShieldedEngineClient {
    private worker: Worker | null = null
    private nextId = 1
    private pending = new Map<number, Pending>()
    private startKey: string | null = null
    private startPromise: Promise<void> | null = null
    private network: Network = 'testnet'
    private scanStatusHandlers = new Set<ScanStatusHandler>()
    private sendPhaseHandlers = new Set<SendPhaseHandler>()

    private ensureWorker(): Worker {
        if (this.worker) return this.worker
        const worker = new Worker(
            new URL('./engine-worker.ts', import.meta.url),
            { type: 'module' })
        worker.addEventListener('message', (event: MessageEvent) => {
            const data = event.data as any
            if (data?.type === 'persist') {
                try { window.localStorage.setItem(SYNC_STATE_KEY(this.network), data.state) } catch { /* private mode */ }
                return
            }
            if (data?.type === 'scanProgress') {
                for (const handler of this.scanStatusHandlers) {
                    handler({
                        scanned: Number(data.scanned),
                        alignedCount: Number(data.alignedCount),
                        balance: String(data.balance),
                        owned: Number(data.owned),
                    })
                }
                return
            }
            if (data?.type === 'sendProgress') {
                for (const handler of this.sendPhaseHandlers) handler(String(data.phase))
                return
            }
            if (data?.type === 'result' && this.pending.has(Number(data.id))) {
                const entry = this.pending.get(Number(data.id)) as Pending
                this.pending.delete(Number(data.id))
                if (data.ok) entry.resolve(data.payload)
                else entry.reject(new Error(String(data.error || 'shielded engine failure')))
            }
        })
        worker.addEventListener('error', (event: ErrorEvent) => {
            /* A worker crash must not wedge pending callers forever. */
            for (const [, entry] of this.pending) {
                entry.reject(new Error(event.message || 'the shielded engine worker crashed'))
            }
            this.pending.clear()
            this.worker = null
            this.startPromise = null
            this.startKey = null
        })
        this.worker = worker
        return worker
    }

    /** Idempotent per (network, mnemonic) AND SINGLE-FLIGHT: multiple
     *  components (the wallet page, the Assets row, the Deposit tab) may
     *  call start() in the same tick — they ALL share one in-flight init
     *  (three concurrent 'init' messages break the worker's wasm
     *  closures: 'FnOnce called more than once'). Re-inits the engine
     *  when the key CHANGES. */
    start(options: { network: Network; mnemonic: string }): Promise<void> {
        const key = `${options.network}:${options.mnemonic}`
        if (this.startKey === key && this.startPromise) return this.startPromise
        if (this.startPromise) {
            /* A start is in flight (possibly for another key) — chain
             * behind it, then re-evaluate. */
            return this.startPromise.then(() => this.start(options))
        }
        const worker = this.ensureWorker()
        this.network = options.network
        let raw: string | null = null
        try { raw = window.localStorage.getItem(SYNC_STATE_KEY(options.network)) } catch { /* private mode */ }
        this.startPromise = new Promise<void>((resolve, reject) => {
            const onReady = (event: MessageEvent) => {
                const data = event.data as any
                if (data?.type === 'ready') {
                    worker.removeEventListener('message', onReady)
                    worker.removeEventListener('message', onFailed)
                    this.startKey = key
                    resolve()
                } else if (data?.type === 'initFailed') {
                    worker.removeEventListener('message', onReady)
                    worker.removeEventListener('message', onFailed)
                    this.startPromise = null
                    this.startKey = null
                    reject(new Error(String(data.error || 'shielded engine init failed')))
                }
            }
            const onFailed = onReady
            worker.addEventListener('message', onReady)
            worker.postMessage({ type: 'init', network: options.network, mnemonic: options.mnemonic, state: raw })
        })
        return this.startPromise
    }

    private call<T>(method: string, params?: unknown, timeoutMs = 0): Promise<T> {
        const worker = this.ensureWorker()
        const id = this.nextId++
        return new Promise<T>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    this.pending.delete(id)
                    reject(new Error(`${method} timed out after ${timeoutMs / 1000}s`))
                }, timeoutMs)
            }
            this.pending.set(id, {
                resolve: (value: T) => { if (timer) clearTimeout(timer); resolve(value) },
                reject: (error: Error) => { if (timer) clearTimeout(timer); reject(error) },
            })
            worker.postMessage({ type: 'rpc', id, method, params })
        })
    }

    onScanStatus(handler: ScanStatusHandler): () => void {
        this.scanStatusHandlers.add(handler)
        return () => { this.scanStatusHandlers.delete(handler) }
    }

    onSendPhase(handler: SendPhaseHandler): () => void {
        this.sendPhaseHandlers.add(handler)
        return () => { this.sendPhaseHandlers.delete(handler) }
    }

    /** The bounded + retried note-tree scan (the F43 loop, now in the
     *  worker). Progress arrives via onScanStatus. */
    runScan(): Promise<ShieldedSnapshot> {
        return this.call<ShieldedSnapshot>('scan', undefined, 1200000)
    }

    /** Current engine state WITHOUT scanning (instant apply). */
    snapshot(): Promise<ShieldedSnapshot> {
        return this.call<ShieldedSnapshot>('snapshot')
    }

    history(): Promise<ShieldedHistoryRow[]> {
        return this.call<ShieldedHistoryRow[]>('history')
    }

    send(params: {
        recipient: string
        amountCredits: string
        memoText?: string
    }): Promise<ShieldedSendResult> {
        return this.call<ShieldedSendResult>('send', params, 600000)
    }

    /** Post-broadcast settle poll (the wallet's pollUntilSettled, in the
     *  worker; up to 8 × 15s). Progress arrives via onScanStatus. */
    settle(direction: 'below' | 'above', baseline: string): Promise<ShieldedSnapshot> {
        return this.call<ShieldedSnapshot>('settle', { direction, baseline }, 300000)
    }

    receiveAddress(index: number): Promise<string> {
        return this.call<string>('receiveAddress', { index })
    }

    /** F51b pool-exit moves (worker-side: notes/witnesses never leave):
     *  'unshield' → pool credits to a transparent platform address (17);
     *  'topUpIdentity' → pool credits to an identity balance (22). The
     *  identityId travels as 64-char hex. */
    poolExit(params: {
        kind: 'unshield' | 'topUpIdentity'
        outputAddress?: string
        identityId?: string
        netCredits: string
    }): Promise<ShieldedSendResult & { netCredits: string }> {
        return this.call<ShieldedSendResult & { netCredits: string }>('poolExit', params, 600000)
    }

    /** Keys for the main-thread SHIELD flow only (asset-lock path). */
    keys(): Promise<ShieldedWalletKeys> {
        return this.call<ShieldedWalletKeys>('keys')
    }
}

/** The page-wide engine client (shared by the Assets list and the
 *  full-screen WalletShielded view). */
export const shieldedEngine = new ShieldedEngineClient()
