// lib/shielded/wallet.ts
//
// In-app shielded wallet service — composes the proven lib/shielded stack
// (sync engine + PCZT builders + live prover + assembly + address codec +
// fees) behind a small API the wallet UI can drive.
//
// Every code path here mirrors a LIVE-VERIFIED harness (see AGENTS.md):
//   - balance/scan:      ShieldedSync (proxy-first source, F29/F37)
//   - SHIELD:            asset-lock path, F29 stage-2 + F36 mainnet stage-2
//   - SEND (transfer):   F31 stage-4 + F36 mainnet stage-4
// Keys derive from the session mnemonic via ZIP-32 (coin_type 5 mainnet /
// 1 testnet, account 0) — the same derivation the /shielded viewer's
// "Find my notes" scan uses. Keys never leave the client; only PCZT frames
// go to the prover service (https://prover.sansbank.dev, consensus-verified).

import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js'
import bs58 from 'bs58'
import { mnemonicToSeedSync } from '@scure/bip39'

import {
    spendingKeyFromSeed, fullViewingKeyFromSpendingKey, deriveAskAndAk,
    deriveDkOvk, ivkFromFvk, diversifierAtIndex, deriveAddressBytes,
    type FullViewingKeyParts,
} from './keys'
import { encodeOrchardAddress, decodeOrchardAddress } from './address'
import {
    buildTransferPczt, buildOutputOnlyPczt, postPcztFrame,
    type OutputOnlyBuild, type TransferBuild,
} from './prove'
import { serializePcztFrame } from './pczt-wire'
import { assembleShieldedTransfer, assembleShieldFromAssetLock, assembleUnshield, assembleIdentityTopUpFromShieldedPool, assembleShieldFromIdentity, assembleShieldFromTransparent } from './assemble'
import { signAddressWitness } from './assemble-signing'
import {
    computeMinimumShieldedFee, computeShieldFromAssetLockPoolFee,
    recommendedAssetLockCredits, computeUnshieldFee,
    computeIdentityTopUpFromShieldedPoolFee, computeShieldFromIdentityFeeFloor,
} from './fees'
import { shieldFromAssetLockExtraSighashData, shieldFromIdentityExtraSighashData, unshieldExtraSighashData, identityTopUpFromShieldedExtraSighashData, shieldExtraSighashData } from './bundle'
import { decodeOrchardAddress as decodeOrchardAddr, } from './address'
import { bech32m } from '@scure/base'

/** Decode a transparent platform address (tdash1k/dash1k) to its 21-byte
 *  PlatformAddress encoding for the Unshield output + sighash extra data:
 *  TYPE TAG (0 = P2pkh, 1 = P2sh) || 20-byte hash160 — NOT the bech32m
 *  payload's 0xb0 type byte (live-hit 2026-11-14: the wasm
 *  PlatformAddress decoder rejects variant 0xb0 = 'allowed: Range { min:
 *  0, max: 1 }, found: 176'; rs-dpp sighash.rs:300-307 pushes the SAME
 *  0/1 tag || hash). */
function decodePlatformAddressBytes(address: string, network: 'mainnet' | 'testnet'): Uint8Array {
    const decoded = bech32m.decode(address as any)
    const hrp = network === 'mainnet' ? 'dash' : 'tdash'
    if (decoded.prefix !== hrp) throw new Error(`Address HRP ${decoded.prefix} does not match network ${network}`)
    const payload = bech32m.fromWords(decoded.words)
    if (payload.length !== 21 || payload[0] !== 0xb0) throw new Error('Not a transparent platform address (P2PKH 0xb0 payload)')
    const out = new Uint8Array(21)
    out[0] = 0 /* PlatformAddress::P2pkh type tag */
    out.set(payload.slice(1), 1)
    return out
}
import { ShieldedSync, type OwnedShieldedNote, type ShieldedSyncSource } from './sync'
import { makeProxyFirstShieldedSource } from '../dapi-proxy'

/** ZIP-32 coin type per network (rs-platform-wallet keys.rs): 5 mainnet / 1 testnet. */
export const coinTypeForNetwork = (network: 'mainnet' | 'testnet'): number =>
    network === 'mainnet' ? 5 : 1

/** Wallet key material derived from the session seed (account 0). */
export interface ShieldedWalletKeys {
    /** ZIP-32 spending key (32 bytes) — master of everything below. */
    sk: Uint8Array
    fvk: FullViewingKeyParts
    /** Spend-authorizing key scalar (spendAuthSig). */
    ask: bigint
    /** External-scope outgoing viewing key (sender recovers own outputs). */
    ovk: Uint8Array
    /** Incoming viewing key scalar (trial decryption + address derivation). */
    ivk: bigint
    /** Diversifier key (address derivation at any index). */
    dk: Uint8Array
}

/** Derive the full wallet key set from a BIP39 seed (ZIP-32, account 0). */
export function deriveShieldedWalletKeys(seed: Uint8Array, network: 'mainnet' | 'testnet'): ShieldedWalletKeys {
    const sk = spendingKeyFromSeed(seed, coinTypeForNetwork(network), 0)
    const fvk = fullViewingKeyFromSpendingKey(sk)
    const { ask } = deriveAskAndAk(sk)
    const { dk, ovk } = deriveDkOvk(fvk)
    const ivk = ivkFromFvk(fvk)
    return { sk, fvk, ask, ovk, ivk, dk }
}

/** The wallet's shielded payment address at a diversifier index
 *  (bech32m: dash1z… mainnet / tdash1z… testnet). */
export function shieldedAddressAt(keys: ShieldedWalletKeys, index: number, network: 'mainnet' | 'testnet'): string {
    const raw = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, index))
    return encodeOrchardAddress(raw, network)
}

/** Build the wallet's sync engine against an initialized WasmSdk: reads go
 *  proxy-FIRST (dapi.sansbank.dev) with per-call WASM fallback (F29), and
 *  state persists in localStorage per network (account 0). */
export function makeShieldedSync(
    sdk: any,
    network: 'mainnet' | 'testnet',
    mnemonic: string,
    storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): ShieldedSync {
    const wasmSource: ShieldedSyncSource = {
        getShieldedEncryptedNotes: (start, count) => sdk.getShieldedEncryptedNotes(start, count),
        getShieldedAnchors: () => sdk.getShieldedAnchors(),
        getMostRecentShieldedAnchor: () => sdk.getMostRecentShieldedAnchor(),
        getShieldedNullifiers: (nullifiers) => sdk.getShieldedNullifiers(nullifiers),
    }
    const source = makeProxyFirstShieldedSource(network, wasmSource)
    const seed = mnemonicToSeedSync(mnemonic)
    const keys = deriveShieldedWalletKeys(seed, network)
    /* nk is REQUIRED for correct spend-status queries (the on-chain registry
     * holds spend nullifiers, not the rows' rhos — F40 fix); ovk enables
     * ZIP-144 recovery of OUR outgoing payments (history, F41). */
    return new ShieldedSync(source, storage, `evonext_shielded_sync_${network}`, keys.ivk, keys.fvk.nk, keys.ovk)
}

/** 36-byte Dash memo: 4-byte kind tag ([1,0,0,0] = text) + UTF-8 payload
 *  (rs-dpp shielded/memo.rs; F29 harness layout). */
export function textMemo(text: string): Uint8Array {
    const memo = new Uint8Array(36)
    memo.set([1, 0, 0, 0], 0)
    const payload = new TextEncoder().encode(text)
    if (payload.length > 32) {
        throw new Error('memo text is limited to 32 bytes')
    }
    memo.set(payload, 4)
    return memo
}

export interface SelectedSpend {
    note: OwnedShieldedNote
    witness: { position: number; path: Uint8Array[] }
}

export interface NoteSelection {
    spends: SelectedSpend[]
    /** Credits back to our own default address (index 0). 0 = no change output. */
    changeCredits: bigint
    /** Consensus-pinned fee for the resulting action count. */
    feeCredits: bigint
    /** The bundle anchor every witness folds to. */
    anchor: Uint8Array
}

/** Select unspent notes to cover `amountCredits` + the consensus fee.
 *  Notes are accumulated smallest-first; each candidate must be witnessable
 *  at a RECORDED anchor (sync.witnessForSpend throws ShieldedNoRecordedAnchorError
 *  for notes too new to spend — those are skipped, matching the wallet's
 *  select_recorded_spends semantics). The action count (and therefore the
 *  fee) grows with the spend count: max(spends, outputs, 2). */
export async function selectNotesForSend(
    sync: ShieldedSync,
    amountCredits: bigint,
    /* F51b: the spend-side pool transitions (Unshield, IdentityTopUpFrom-
     * ShieldedPool) price the fee with THEIR consensus formula instead of
     * the transfer's computeMinimumShieldedFee. The fee function receives
     * (spendCount, withChange) and returns the carved fee; the default is
     * the transfer fee. */
    feeFn: (spendCount: number, withChange: boolean) => bigint = (spendCount, withChange) =>
        computeMinimumShieldedFee(Math.max(spendCount, withChange ? 2 : 1, 2)),
): Promise<NoteSelection> {
    await sync.refreshSpent()
    const unspent = [...sync.notes]
        .filter((n) => !n.spent)
        .sort((a, b) => (BigInt(a.value) < BigInt(b.value) ? -1 : 1))
    if (unspent.length === 0) {
        throw new Error('No unspent shielded notes — shield some credits first')
    }

    /* The recipient + (optional) change outputs are at most 2; the action
     * count is max(spends, outputs, 2). */
    const feeFor = feeFn

    let acc = 0n
    let chosen: OwnedShieldedNote[] = []
    for (const note of unspent) {
        chosen.push(note)
        acc += BigInt(note.value)
        const fee = feeFor(chosen.length, true)
        if (acc >= amountCredits + fee) break
    }
    const fee = feeFor(chosen.length, true)
    if (acc < amountCredits + fee) {
        throw new Error(
            `Insufficient shielded balance: have ${acc} credits, need ${amountCredits + fee} ` +
            `(amount + consensus fee ${fee})`)
    }

    /* Witness every chosen note; skip (and re-select around) any note that
     * no recorded anchor can witness yet. */
    let anchor: Uint8Array | undefined
    const spends: SelectedSpend[] = []
    for (const note of chosen) {
        try {
            const w = await sync.witnessForSpend(note.position)
            anchor = w.anchor
            spends.push({ note, witness: { position: w.position, path: w.path } })
        } catch (error) {
            if ((error as Error)?.name !== 'ShieldedNoRecordedAnchorError') throw error
            /* note too new — drop it and continue with the rest */
        }
    }
    if (spends.length === 0 || !anchor) {
        throw new Error('No spendable note has a recorded anchor yet — wait a few blocks and retry')
    }

    const spentTotal = spends.reduce((s, x) => s + BigInt(x.note.value), 0n)
    const finalFee = feeFor(spends.length, true)
    if (spentTotal < amountCredits + finalFee) {
        throw new Error(
            `Insufficient witnessable balance: ${spentTotal} credits witnessable, ` +
            `need ${amountCredits + finalFee}`)
    }
    const changeCredits = spentTotal - amountCredits - finalFee
    return { spends, changeCredits, feeCredits: finalFee, anchor }
}

export interface SendShieldedResult {
    /** Skip-signature transition hash (hex) — the broadcast identity. */
    transitionHash: string
    feeCredits: bigint
    changeCredits: bigint
    spentPositions: number[]
}

/** SEND: pool → pool transfer to a dash1z…/tdash1z… address. Proven live
 *  (F31 stage-4 testnet, F36 stage-4 mainnet). The prover takes ~50–135 s
 *  per transaction; onProgress reports the phase. */
export async function sendShielded(options: {
    sdk: any
    keys: ShieldedWalletKeys
    sync: ShieldedSync
    network: 'mainnet' | 'testnet'
    recipient: string
    amountCredits: bigint
    memoText?: string
    onProgress?: (phase: string) => void
}): Promise<SendShieldedResult> {
    const { sdk, keys, sync, network, recipient, amountCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (amountCredits <= 0n) throw new Error('Amount must be positive')

    /* Validate the recipient address (HRP class must match the network). */
    const decoded = decodeOrchardAddress(recipient.trim())
    if (decoded.network !== network) {
        throw new Error(`Recipient is a ${decoded.network} address but the wallet is on ${network}`)
    }
    const recipientBytes = decoded.raw

    progress('Selecting notes…')
    const selection = await selectNotesForSend(sync, amountCredits)

    /* rs-dpp output order: recipient output first, then change (if any). */
    const outputs = [{
        recipient: recipientBytes,
        value: amountCredits,
        memo: textMemo(options.memoText ?? ''),
        senderOvk: keys.ovk,
    }]
    if (selection.changeCredits > 0n) {
        outputs.push({
            recipient: deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, 0)),
            value: selection.changeCredits,
            memo: new Uint8Array(36),
            senderOvk: keys.ovk,
        })
    }

    progress('Building the transaction…')
    const build: TransferBuild = buildTransferPczt({
        spends: selection.spends.map(({ note, witness }) => ({
            recipient: hexToBytes(note.recipient),
            value: BigInt(note.value),
            rho: hexToBytes(note.nullifier), /* the row's nullifier IS the note's rho (F31) */
            rseed: hexToBytes(note.rseed),
            fvk: keys.fvk,
            ask: keys.ask,
            witness,
        })),
        outputs,
        anchor: selection.anchor,
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Assembling…')
    const assembled = await assembleShieldedTransfer({ build, provedFrame: proved.frame })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))

    /* The spent notes' nullifiers are now revealed — refresh local state. */
    await sync.refreshSpent()

    return {
        transitionHash,
        feeCredits: selection.feeCredits,
        changeCredits: selection.changeCredits,
        spentPositions: selection.spends.map((s) => s.note.position),
    }
}

export interface ShieldCreditsOptions {
    sdk: any
    keys: ShieldedWalletKeys
    network: 'mainnet' | 'testnet'
    /** CONFIRMED + CHAINLOCKED asset lock (registrar flow built it):
     *  wasm AssetLockProof instance (Chain variant) + its PrivateKey. */
    assetLockProof: unknown
    assetLockPrivateKey: unknown
    /** The asset-lock identifier (base58 string from createIdentityId()). */
    assetLockIdentifierBase58: string
    /** Credits to move into the pool (must be ≤ locked credits − pool fee). */
    shieldCredits: bigint
    /** Diversifier index of OUR receiving address (default 0). */
    recipientIndex?: number
    memoText?: string
    onProgress?: (phase: string) => void
}

export interface ShieldCreditsResult {
    transitionHash: string
    /** Donated-to-fee-pools surplus (locked − shielded − pool fee). */
    surplusCredits: bigint
}

/** SHIELD: move an L1 asset lock's value into the pool as an Orchard note
 *  payable to OUR address. Proven live (F29 stage-2 testnet, F36 stage-2
 *  mainnet). The L1 lock itself is built + confirmed by the registrar-side
 *  flow (lib/core-chain.ts) BEFORE this runs. */
export async function shieldWithAssetLock(options: ShieldCreditsOptions): Promise<ShieldCreditsResult> {
    const { sdk, keys, assetLockProof, assetLockPrivateKey, assetLockIdentifierBase58, shieldCredits } = options
    const progress = options.onProgress ?? (() => { })
    const recipientIndex = options.recipientIndex ?? 0

    /* The pool fee the v1 validator requires (locked ≥ shielded + fee). */
    if (shieldCredits <= 0n) throw new Error('Shield amount must be positive')

    const identifierBytes = bs58.decode(assetLockIdentifierBase58)
    const extraSighashData = shieldFromAssetLockExtraSighashData(identifierBytes)

    const recipientBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, recipientIndex))
    progress('Building the shield transaction…')
    const build: OutputOnlyBuild = buildOutputOnlyPczt({
        outputs: [{
            recipient: recipientBytes,
            value: shieldCredits,
            memo: textMemo(options.memoText ?? ''),
            senderOvk: keys.ovk,
        }],
        /* rs-dpp parity: auto-pads to 2 on-wire actions (MIN_ACTIONS). */
        extraSighashData,
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Assembling…')
    const assembled = await assembleShieldFromAssetLock({
        assetLockProof,
        assetLockPrivateKey,
        build,
        provedFrame: proved.frame,
    })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))

    return {
        transitionHash,
        surplusCredits: 0n, /* computed by the caller from the lock value */
    }
}

export { recommendedAssetLockCredits }

/* --- Transaction history (F41) --- */

export type ShieldedHistoryKind = 'sent' | 'received' | 'self'

export interface ShieldedHistoryEntry {
  kind: ShieldedHistoryKind
  /** Credits moved (for 'sent': the outgoing amount; for notes: the value). */
  credits: bigint
  /** Recipient (bech32, 'sent' + 'self' entries) or our address (change). */
  address?: string
  /** Decoded memo text (printable prefix). */
  memo: string
  /** Tree index of the note this entry refers to. */
  treeIndex: number
  /** Current on-chain spend status of the backing note. */
  spent: boolean
}

/** Decode the printable text of a 36-byte memo (kind tag [1,0,0,0] + UTF-8). */
const memoTextOf = (memoHex: string): string => {
  try {
    const bytes = hexToBytes(memoHex)
    const payload = bytes.slice(4)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(payload)
    return text.replace(/\0+$/g, '').trim()
  } catch {
    return ''
  }
}

/** Build the wallet's transaction history from the sync state:
 *  - 'sent': rows that do NOT decrypt for us but whose out_ciphertext opens
 *    under our OVK — payments to OTHERS, with the exact amount + recipient
 *    (ZIP-144 sender recovery, from chain data — no local log needed);
 *  - 'self': owned notes created by OUR actions (send changes, self-sends,
 *    shields-to-self, dummy-paired changes — the OVK opens them);
 *  - 'received': owned notes we did NOT create — incoming transfers from
 *    another party (or a shield built by another device of the same seed).
 *  Sorted newest-first (tree order). */
export function buildShieldedHistory(
  sync: ShieldedSync,
  keys: ShieldedWalletKeys,
  network: 'mainnet' | 'testnet',
): ShieldedHistoryEntry[] {
  const entries: ShieldedHistoryEntry[] = []

  for (const sent of sync.sent) {
    entries.push({
      kind: 'sent',
      credits: BigInt(sent.value),
      address: encodeOrchardAddress(hexToBytes(sent.recipient), network),
      memo: memoTextOf(sent.memo),
      treeIndex: sent.position,
      spent: false, /* outgoing payments never "spend" — they are final */
    })
  }

  for (const note of sync.notes) {
    entries.push({
      kind: note.createdByUs ? 'self' : 'received',
      credits: BigInt(note.value),
      address: shieldedAddressAtFromRaw(hexToBytes(note.recipient), network),
      memo: memoTextOf(note.memo),
      treeIndex: note.position,
      spent: note.spent,
    })
  }

  return entries.sort((a, b) => b.treeIndex - a.treeIndex)
}

/** bech32-encode a RAW 43-byte address (history display). */
const shieldedAddressAtFromRaw = (raw: Uint8Array, network: 'mainnet' | 'testnet'): string =>
  encodeOrchardAddress(raw, network)

/* --- SHIELD from the identity's L1 balance (asset-lock path, proven) --- */

const SHIELD_PENDING_KEY = (address: string) => `evonext_shield_pending_lock_${address}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface ShieldFromBalanceResult {
    /** The L1 asset-lock txid (its value is now in the pool). */
    lockTxid: string
    /** The shield transition's skip-signature hash (hex). */
    transitionHash: string
    /** Credits moved into the pool as OUR note. */
    shieldCredits: bigint
    /** Credits donated to the fee pools (locked − shielded − pool fee). */
    surplusCredits: bigint
}

/** SHIELD credits from the identity's L1 funding balance: build + broadcast
 *  a self-custodial asset lock (lib/core-chain.ts, the registrar-proven
 *  v23 format), wait for confirmation + chainlock (F27i), then convert the
 *  lock into an Orchard note payable to OUR address (F29/F36-proven path).
 *  RESUME-SAFE: the pending lock is persisted right after broadcast and a
 *  retry resumes it instead of double-burning (F27e/F27f lesson). */
export async function shieldFromBalance(options: {
    sdk: any
    keys: ShieldedWalletKeys
    network: 'mainnet' | 'testnet'
    identityIdx: number
    shieldCredits: bigint
    memoText?: string
    onProgress?: (phase: string) => void
}): Promise<ShieldFromBalanceResult> {
    const { sdk, keys, network, identityIdx, shieldCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (shieldCredits <= 0n) throw new Error('Shield amount must be positive')

    const coreChain: typeof import('../core-chain') = await import('../core-chain')
    const funding = coreChain.deriveFundingKey(network, identityIdx)
    const pendingKey = SHIELD_PENDING_KEY(funding.address)

    /* The L1 lock must cover the shield amount + the pool fee (+ headroom
     * so a conservative estimate never bricks the flow). */
    const lockCredits = recommendedAssetLockCredits(shieldCredits)
    const lockSatoshis = Number(lockCredits / 1000n) /* 1 duff = 1000 credits */
    if (lockCredits > shieldCredits + computeShieldFromAssetLockPoolFee(2) * 4n) {
        throw new Error('Shield amount too small for the consensus pool fee')
    }

    let txid: string
    let blockheight: number

    const pending = typeof window !== 'undefined' ? window.localStorage.getItem(pendingKey) : null
    if (pending) {
        const saved = JSON.parse(pending) as { txid: string; blockheight: number }
        progress(`Resuming your pending asset lock (${saved.txid.slice(0, 16)}…)…`)
        txid = saved.txid
        blockheight = saved.blockheight
    } else {
        progress('Checking your L1 balance…')
        const utxos = await coreChain.getFundingUtxos(network, funding.address)
        const funded = utxos.reduce((sum: number, u: any) => sum + u.satoshis, 0)
        if (utxos.length === 0 || funded < lockSatoshis) {
            throw new Error(
                `Insufficient L1 balance at ${funding.address}: ${funded} sats spendable, ${lockSatoshis} needed`)
        }

        progress('Building your asset lock transaction…')
        const assetLock = coreChain.createAssetLockTransaction(
            network, funding.privateKeyWif, utxos, lockSatoshis)

        progress('Broadcasting to the Dash network…')
        txid = await coreChain.broadcastTransaction(network, assetLock.hex)
        try { window.localStorage.setItem(pendingKey, JSON.stringify({ txid, blockheight: 0 })) } catch { /* private mode */ }
    }

    progress(`Waiting for confirmation (tx ${txid.slice(0, 16)}…)…`)
    const confirmed = await coreChain.waitForConfirmation(
        network, txid, undefined, undefined,
        (attempt, max) => progress(`Waiting for confirmation… (${attempt}/${max})`))
    blockheight = confirmed.blockheight
    if (!blockheight) {
        /* Mainnet insight /tx/<txid> can LACK the blockheight field (F36
         * gotcha) — derive it from the credit output's utxo confirmation
         * height (the same method the mainnet stage-1 harness verified). */
        const insightBase = network === 'mainnet'
            ? 'https://insight.dash.org/insight-api'
            : 'https://insight.testnet.networks.dash.org/insight-api'
        for (let i = 0; i < 20 && !blockheight; i++) {
            await sleep(15000)
            try {
                const response = await fetch(
                    `${insightBase}/addr/${funding.address}/utxo`)
                const utxos = await response.json()
                const credit = Array.isArray(utxos)
                    ? utxos.find((u: any) => u.txid === txid && u.vout === 1)
                    : undefined
                if (credit && typeof credit.height === 'number') blockheight = credit.height
            } catch { /* keep polling */ }
        }
        if (!blockheight) {
            throw new Error('The asset lock confirmed but its block height could not be read — retry to resume')
        }
    }
    try { window.localStorage.setItem(pendingKey, JSON.stringify({ txid, blockheight })) } catch { /* ignore */ }

    /* Platform validates the proof against ITS core-chain-locked height (F27i). */
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const outPoint = new wasm.OutPoint(txid, 0)
    const creationIdentity = String(
        wasm.AssetLockProof.createChainAssetLockProof(blockheight, outPoint).createIdentityId())
    let platformHeight = 0
    for (;;) {
        progress('Waiting for the lock to be chainlocked…')
        await sleep(15000)
        const resp: any = await sdk.getIdentityWithProofInfo(creationIdentity)
        platformHeight = resp.metadata.coreChainLockedHeight
        if (platformHeight >= blockheight) break
    }

    const assetLockProof = wasm.AssetLockProof.createChainAssetLockProof(platformHeight, outPoint)
    const assetLockPrivateKey = wasm.PrivateKey.fromWIF(funding.privateKeyWif)
    const identifier = String(assetLockProof.createIdentityId())

    const shielded = await shieldWithAssetLock({
        sdk,
        keys,
        network,
        assetLockProof,
        assetLockPrivateKey,
        assetLockIdentifierBase58: identifier,
        shieldCredits,
        memoText: options.memoText,
        onProgress: progress,
    })

    try { window.localStorage.removeItem(pendingKey) } catch { /* ignore */ }
    return {
        lockTxid: txid,
        transitionHash: shielded.transitionHash,
        shieldCredits,
        surplusCredits: lockCredits - shieldCredits - computeShieldFromAssetLockPoolFee(2),
    }
}

/* ---------------------------------------------------------------------------
 * F51b — ShieldFromIdentity (21): the identity's credit balance -> the
 * shielded pool. Identity-signed with the TRANSFER key (builder doc) —
 * unlike the asset-lock shield there is NO L1 lock: the identity itself is
 * debited amount + the metered fee. Fee floor for 2 actions = 149,760,000
 * (execution may charge less — the floor is for sizing only).
 * ------------------------------------------------------------------------- */

/** ShieldFromIdentity (21): move `amount` credits from the identity balance
 *  into a new note at OUR address (recipientIndex). transferWif = the
 *  identity's TRANSFER key (n=3). `nonce` = the identity's CURRENT nonce
 *  (chain-read via getIdentityNonce) — the transition carries CURRENT + 1
 *  (live-verified 2026-11-14: the bare current value is rejected with
 *  'invalid identity nonce ... we are setting N, error is nonce already
 *  present at tip'); the increment is applied HERE so callers pass exactly
 *  what getIdentityNonce returns. */
export async function shieldFromIdentity(options: {
    sdk: any
    keys: ShieldedWalletKeys
    network: 'mainnet' | 'testnet'
    identityId: string | Uint8Array
    amount: bigint
    nonce: bigint
    transferWif: string
    transferKeyId: number
    recipientIndex?: number
    memoText?: string
    onProgress?: (phase: string) => void
}): Promise<{ transitionHash: string; amount: bigint; feeFloor: bigint }> {
    const { sdk, keys, network, amount, nonce, transferWif, transferKeyId } = options
    const progress = options.onProgress ?? (() => { })
    if (amount <= 0n) throw new Error('Amount must be positive')

    const identityBytes = typeof options.identityId === 'string'
        ? bs58.decode(options.identityId)
        : options.identityId
    if (identityBytes.length !== 32) throw new Error('identityId: expected 32 bytes')

    const recipientIndex = options.recipientIndex ?? 0
    const recipientBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, recipientIndex))

    progress('Building the shield transaction…')
    const build: OutputOnlyBuild = buildOutputOnlyPczt({
        outputs: [{
            recipient: recipientBytes,
            value: amount,
            memo: textMemo(options.memoText ?? ''),
            senderOvk: keys.ovk,
        }],
        extraSighashData: shieldFromIdentityExtraSighashData(identityBytes),
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Assembling…')
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const transferPrivateKey = wasm.PrivateKey.fromWIF(transferWif)
    const assembled = await assembleShieldFromIdentity({
        identityId: identityBytes,
        amount,
        nonce,
        build,
        provedFrame: proved.frame,
        transferPrivateKey,
        transferKeyId,
    })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))

    return {
        transitionHash,
        amount,
        feeFloor: computeShieldFromIdentityFeeFloor(2),
    }
}

/** Utility: hex of bytes (used by the UI for compact display). */
export const hexOf = (b: Uint8Array) => bytesToHex(b)

/* ---------------------------------------------------------------------------
 * F51b — the pool-exit edges: Unshield (17, pool -> transparent address) and
 * IdentityTopUpFromShieldedPool (22, pool -> identity credits). Both reuse
 * the proven transfer pipeline (selectNotesForSend -> buildTransferPczt ->
 * prover -> assemble -> broadcast); they differ from a transfer ONLY in the
 * sighash extra data, the consensus fee formula and the assembled
 * transition. There is NO recipient Orchard output: the only real output is
 * the change note (value_balance = net + fee; net goes to the transparent
 * address / identity).
 * ------------------------------------------------------------------------- */

/** Unshield (17): move `netCredits` from the shielded pool to OUR
 *  transparent platform address (outputAddress, a tdash1k/dash1k bech32m
 *  string or 21 raw bytes). Fee = computeUnshieldFee(2) = 120,222,800
 *  credits, carved exactly; net is credited to the address. */
export async function unshieldToAddress(options: {
    sdk: any
    keys: ShieldedWalletKeys
    sync: ShieldedSync
    network: 'mainnet' | 'testnet'
    outputAddress: string | Uint8Array
    netCredits: bigint
    onProgress?: (phase: string) => void
}): Promise<SendShieldedResult & { netCredits: bigint }> {
    const { sdk, keys, sync, network, outputAddress, netCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (netCredits <= 0n) throw new Error('Amount must be positive')
    if (netCredits > 2n ** 63n - 1n) throw new Error('Amount too large')

    progress('Selecting notes…')
    /* selectNotesForSend already targets amountCredits + ITS OWN feeFn —
     * pass the net only (double-adding the fee failed the final check,
     * live-hit 2026-11-14). */
    const selection = await selectNotesForSend(sync, netCredits, (spendCount) =>
        computeUnshieldFee(Math.max(spendCount, 2)))
    const required = netCredits + selection.feeCredits

    /* The only real Orchard output is the change note (to our default
     * diversifier-0 address). */
    const changeBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, 0))
    const outputs = [{
        recipient: changeBytes,
        value: selection.changeCredits,
        memo: new Uint8Array(36),
        senderOvk: keys.ovk,
    }]

    const outputAddressBytes = typeof outputAddress === 'string'
        ? decodePlatformAddressBytes(outputAddress, network)
        : outputAddress
    progress('Building the transaction…')
    const build: TransferBuild = buildTransferPczt({
        spends: selection.spends.map(({ note, witness }) => ({
            recipient: hexToBytes(note.recipient),
            value: BigInt(note.value),
            rho: hexToBytes(note.nullifier),
            rseed: hexToBytes(note.rseed),
            fvk: keys.fvk,
            ask: keys.ask,
            witness,
        })),
        outputs,
        anchor: selection.anchor,
        extraSighashData: unshieldExtraSighashData(outputAddressBytes, netCredits + selection.feeCredits),
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Assembling…')
    const assembled = await assembleUnshield({ build, provedFrame: proved.frame, outputAddress: outputAddressBytes })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))
    await sync.refreshSpent()

    return {
        transitionHash,
        feeCredits: selection.feeCredits,
        changeCredits: selection.changeCredits,
        spentPositions: selection.spends.map((s) => s.note.position),
        netCredits,
    }
}

/** IdentityTopUpFromShieldedPool (22): move `netCredits` from the pool into
 *  the identity's credit balance (identityId, 32 bytes). Fee =
 *  computeIdentityTopUpFromShieldedPoolFee(2) = 114,359,200 credits; the
 *  transition's topUpAmount field carries the GROSS (net + fee) and
 *  consensus credits the identity the net. */
export async function topUpIdentityFromPool(options: {
    sdk: any
    keys: ShieldedWalletKeys
    sync: ShieldedSync
    network: 'mainnet' | 'testnet'
    identityId: Uint8Array
    netCredits: bigint
    onProgress?: (phase: string) => void
}): Promise<SendShieldedResult & { netCredits: bigint }> {
    const { sdk, keys, sync, identityId, netCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (netCredits <= 0n) throw new Error('Amount must be positive')

    progress('Selecting notes…')
    /* Same as unshield: the selector adds feeFn itself — pass the net only. */
    const selection = await selectNotesForSend(sync, netCredits, (spendCount) =>
        computeIdentityTopUpFromShieldedPoolFee(Math.max(spendCount, 2)))
    const required = netCredits + selection.feeCredits

    const changeBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, 0))
    const outputs = [{
        recipient: changeBytes,
        value: selection.changeCredits,
        memo: new Uint8Array(36),
        senderOvk: keys.ovk,
    }]

    progress('Building the transaction…')
    const build: TransferBuild = buildTransferPczt({
        spends: selection.spends.map(({ note, witness }) => ({
            recipient: hexToBytes(note.recipient),
            value: BigInt(note.value),
            rho: hexToBytes(note.nullifier),
            rseed: hexToBytes(note.rseed),
            fvk: keys.fvk,
            ask: keys.ask,
            witness,
        })),
        outputs,
        anchor: selection.anchor,
        extraSighashData: identityTopUpFromShieldedExtraSighashData(identityId, required),
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Assembling…')
    /* topUpAmount is the GROSS (= required = net + fee): consensus credits
     * topUpAmount - fee to the identity (rs-dpp v0/mod.rs struct doc).
     * Live-hit 2026-11-14: passing the net was rejected with
     * 'bundle verification failed'. */
    const assembled = await assembleIdentityTopUpFromShieldedPool({ build, provedFrame: proved.frame, identityId, topUpAmount: required })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))
    await sync.refreshSpent()

    return {
        transitionHash,
        feeCredits: selection.feeCredits,
        changeCredits: selection.changeCredits,
        spentPositions: selection.spends.map((s) => s.note.position),
        netCredits,
    }
}

/* ---------------------------------------------------------------------------
 * F51c — Shield (15): transparent platform address -> the shielded pool.
 * The input address signs its own witness (65-byte recoverable ECDSA over
 * the transition's signable bytes, SHA-256d — the same convention as the
 * identity-key signature, live-verified). Inputs cover shield amount + the
 * compute fee (84,000,000 for 2 actions); the metered note storage is
 * charged from the input balance at execution, so the caller leaves
 * headroom via the feeBuffer.
 * ------------------------------------------------------------------------- */

/** Shield (15): move `shieldCredits` from OUR transparent DIP-17 address
 *  (derivePlatformReceiveKey index) into a new note at OUR Orchard address
 *  (recipientIndex). Requires the mnemonic (address-key derivation). */
export async function shieldFromTransparent(options: {
    sdk: any
    keys: ShieldedWalletKeys
    network: 'mainnet' | 'testnet'
    shieldCredits: bigint
    addressIndex?: number
    recipientIndex?: number
    memoText?: string
    onProgress?: (phase: string) => void
}): Promise<{ transitionHash: string; shieldCredits: bigint; computeFee: bigint }> {
    const { sdk, keys, network, shieldCredits } = options
    const progress = options.onProgress ?? (() => { })
    if (shieldCredits <= 0n) throw new Error('Amount must be positive')

    const { derivePlatformReceiveKey } = await import('../platform-address')
    const addressIndex = options.addressIndex ?? 0
    const { address, privateKeyHex, wif } = derivePlatformReceiveKey(network, addressIndex)

    /* The wasm PlatformAddress 21-byte form = tag(0) || hash160. */
    const { bech32m: b32 } = await import('@scure/base')
    const payload = b32.fromWords(b32.decode(address as any).words)
    if (payload.length !== 21 || payload[0] !== 0xb0) throw new Error('Unexpected transparent address payload')
    const addressBytes = new Uint8Array(21)
    addressBytes[0] = 0
    addressBytes.set(payload.slice(1), 1)

    progress('Reading the address nonce…')
    /* getAddressesInfos keys its map by the VARIANT-FORM hex (tag||hash160,
     * live-hit 2026-11-14: a bech32m-string key misses the entry). */
    const info = await sdk.getAddressesInfos([address])
    const addressKeyHex = Buffer.from(addressBytes).toString('hex')
    const infoEntry = info?.get ? info.get(addressKeyHex) : undefined
    /* The nonce can arrive as a BigInt (wasm getter) — PlatformAddressInput
     * takes a NUMBER ('Cannot convert a BigInt value to a number'). */
    const nonce: number = infoEntry?.nonce === undefined ? 0 : Number(infoEntry.nonce)
    const balance: bigint = infoEntry?.balance !== undefined ? BigInt(infoEntry.balance) : 0n
    if (infoEntry === undefined) throw new Error('The address has no Platform record yet')
    if (balance < shieldCredits) throw new Error(`Transparent balance ${balance} < shield amount ${shieldCredits}`)

    /* The 0x84 digest binds the input addresses in map-key order. */
    const extraSighashData = shieldExtraSighashData([{ type: 0 as const, hash160: addressBytes.slice(1) }])

    const recipientIndex = options.recipientIndex ?? 0
    const recipientBytes = deriveAddressBytes(keys.ivk, diversifierAtIndex(keys.dk, recipientIndex))

    progress('Building the shield transaction…')
    const build: OutputOnlyBuild = buildOutputOnlyPczt({
        outputs: [{
            recipient: recipientBytes,
            value: shieldCredits,
            memo: textMemo(options.memoText ?? ''),
            senderOvk: keys.ovk,
        }],
        extraSighashData,
    })

    progress('Proving (the zk-SNARK prover can take up to ~2 minutes)…')
    const proved = await postPcztFrame(serializePcztFrame(build.frame))

    progress('Signing the address witness…')
    const wasm: any = await import('../dash-wasm/wasm_sdk')
    const addressPrivateKey = wasm.PrivateKey.fromWIF(wif)
    const assembled0 = await assembleShieldFromTransparent({
        inputs: [{ addressBytes, nonce, amount: balance }],
        build,
        provedFrame: proved.frame,
        witnessSignatures: [],
    })
    const signable = (assembled0.stateTransition as any).getSignableBytes()
    const witnessSignature = signAddressWitness(addressPrivateKey.toBytes(), signable)

    const assembled = await assembleShieldFromTransparent({
        inputs: [{ addressBytes, nonce, amount: balance }],
        build,
        provedFrame: proved.frame,
        witnessSignatures: [witnessSignature],
    })

    progress('Broadcasting…')
    await sdk.broadcastStateTransition(assembled.stateTransition)
    const transitionHash = String((assembled.stateTransition as any).hash(true))

    return {
        transitionHash,
        shieldCredits,
        computeFee: 84_000_000n,
    }
}
