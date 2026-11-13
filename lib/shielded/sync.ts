// lib/shielded/sync.ts
// Shielded balance sync layer — the web port of
// platform/packages/rs-platform-wallet/src/wallet/shielded/{sync,coordinator}.rs.
//
// Semantics mirrored 1:1 from the wallet (each cited):
//  - CHUNK_SIZE = 2048 (`1 << 11`, rs-drive's on-chain MMR chunk size) and
//    `start_index` must be chunk-aligned (sync.rs:45-54).
//  - The mutable tail chunk is RE-FETCHED every pass: a pass that ends on a
//    partial chunk leaves the next pass rewound to that chunk's start
//    (sync.rs:60-65, 330-331, 374-376).
//  - One checkpoint per pass at the tree's true post-append leaf count
//    (sync.rs:543-571).
//  - Spend anchor selection: fetch Platform's recorded anchor set, then probe
//    our checkpoints NEWEST-FIRST (shallowest); the first checkpoint whose
//    root is recorded wins, and every spent note must be witnessable at that
//    checkpoint (operations.rs extract_spends_and_anchor /
//    select_recorded_spends). A note that post-dates the newest recorded
//    checkpoint yields a clean "no recorded anchor" error — nothing is
//    broadcast.
//
// Trial decryption uses the existing KAT-validated tryDecryptNoteWireWithMemo
// (rs-sdk try_decrypt_note_with_memo). The served per-note `nullifier` field
// IS the note's rho during trial decryption (rs-sdk decrypt.rs).
//
// Persistence: a single JSON blob in localStorage (leaves as 32-byte hex,
// owned notes, checkpoints). localStorage does NOT survive device loss, so the
// mnemonic/passkey recovery path must be able to re-sync from scratch — it can
// (alignedCount 0), just slowly.

import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { OrchardTree, leafFromBytes, leafToBytes } from './tree';
import {
    tryDecryptNoteWireWithMemo, derivePsi, deriveRcm, noteCommitmentPoint, deriveNullifier,
} from './note';
import { diversifyHash } from './keys';
import { PallasPoint, bigintToBytes32LE } from './pasta';

/** On-chain MMR chunk size (rs-drive paths.rs `1 << 11`; rs-platform-wallet
 *  sync.rs:54). Fetch start_index must be a multiple of this. */
export const SHIELDED_CHUNK_SIZE = 2048;

/** How many checkpoints we keep locally. Platform's commitment tree is opened
 *  with max_checkpoints retention 100 (operations.rs:1767-1768); keeping the
 *  same bound costs nothing and maximizes anchor-probe coverage. */
export const MAX_LOCAL_CHECKPOINTS = 100;

/** The four WasmSdk (5.0.0-rc.8) query methods this layer consumes, as a
 *  structural interface so tests can substitute a mock. */
export interface ShieldedSyncSource {
  getShieldedEncryptedNotes(
    startIndex: bigint,
    count: number,
  ): Promise<Array<{ cmx: Uint8Array; cvNet: Uint8Array; encryptedNote: Uint8Array; nullifier: Uint8Array }>>;
  getShieldedAnchors(): Promise<Uint8Array[]>;
  getMostRecentShieldedAnchor(): Promise<Uint8Array | undefined>;
  getShieldedNullifiers(nullifiers: Uint8Array[]): Promise<Array<{ nullifier: Uint8Array; isSpent: boolean }>>;
}

/** A note that trial-decrypted for OUR ivk. Values are strings so JSON never
 *  sees a number above 2^53 (the u64/u128 string rule). */
export interface OwnedShieldedNote {
  position: number;
  nullifier: string; // hex, 32 bytes — the ROW's nullifier = the note's rho
  /** hex, 32 bytes — the note's OWN spend nullifier,
   *  Note::nullifier(nk, rho, psi, cm) (F40 fix: the row's nullifier is the
   *  creating action's spend-side nullifier — for SPEND-created notes that
   *  is the PARENT's revealed nullifier, and dummy spends publish theirs
   *  too, so querying the rho ALWAYS reports spent=true. The true spend
   *  nullifier must be recomputed from the note secrets). */
  spendNullifier?: string;
  value: string; // decimal credits (u64)
  rseed: string; // hex, 32 bytes
  recipient: string; // hex, 43-byte raw Orchard address (diversifier || pk_d)
  memo: string; // hex, 36-byte Dash memo
  spent: boolean; // refreshed via getShieldedNullifiers
}

interface PersistedCheckpoint {
  count: number; // tree leaf count at checkpoint time
  root: string; // hex, 32-byte tree root (anchor candidate)
}

interface PersistedSyncStateV1 {
  version: 1;
  /** Notes processed so far, INCLUDING a partial tail chunk (see rewind). */
  alignedCount: number;
  leaves: string[]; // hex cmx in tree order
  notes: OwnedShieldedNote[];
  checkpoints: PersistedCheckpoint[]; // newest first
}

export interface ShieldedSyncProgress {
  scanned: number; // total notes scanned so far
  owned: number; // notes decrypted for our ivk so far
}

export interface AnchorProbeResult {
  /** All anchors Platform currently accepts for spends (hex). */
  recorded: string[];
  /** Platform's most recent anchor (hex), if any. */
  mostRecent?: string;
  /** The newest local checkpoint whose root is recorded, if any. */
  matched?: PersistedCheckpoint;
}

export class ShieldedNoRecordedAnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShieldedNoRecordedAnchorError';
  }
}

export class ShieldedSync {
  private readonly source: ShieldedSyncSource;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  private readonly storageKey: string;
  private readonly ivk: bigint;
  /** Nullifier deriving key — REQUIRED for correct spend-status queries
   *  (refreshSpent): the on-chain nullifier registry holds spend nullifiers
   *  (Note::nullifier(nk, rho, psi, cm)), NOT the rows' rho values. */
  private readonly nk: bigint | undefined;

  private state: PersistedSyncStateV1;
  private tree: OrchardTree | null = null;
  private lastProbe: AnchorProbeResult | null = null;

  constructor(
    source: ShieldedSyncSource,
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    storageKey: string,
    ivk: bigint,
    nk?: bigint,
  ) {
    this.source = source;
    this.storage = storage;
    this.storageKey = storageKey;
    this.ivk = ivk;
    this.nk = nk;
    this.state = this.load();
  }

  private load(): PersistedSyncStateV1 {
    const raw = this.storage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedSyncStateV1;
        if (
          parsed && parsed.version === 1 && Array.isArray(parsed.leaves) &&
          Array.isArray(parsed.notes) && Array.isArray(parsed.checkpoints) &&
          typeof parsed.alignedCount === 'number'
        ) {
          return parsed;
        }
      } catch {
        // fall through to a fresh state — a corrupted blob must not brick sync.
      }
    }
    return { version: 1, alignedCount: 0, leaves: [], notes: [], checkpoints: [] };
  }

  private persist(): void {
    this.storage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  /** The commitment tree, rebuilt from the persisted leaves on first use
   *  (O(n) re-append — acceptable at testnet scale). */
  private getTree(): OrchardTree {
    if (!this.tree) {
      const tree = new OrchardTree();
      for (const leafHex of this.state.leaves) {
        const leaf = leafFromBytes(hexToBytes(leafHex));
        if (leaf === null) {
          throw new Error(`ShieldedSync: persisted leaf is non-canonical (${leafHex})`);
        }
        tree.append(leaf);
      }
      this.tree = tree;
    }
    return this.tree;
  }

  /** Total notes scanned (tree leaf count). */
  get size(): number {
    return this.state.leaves.length;
  }

  /** Our decrypted notes (position order). */
  get notes(): readonly OwnedShieldedNote[] {
    return this.state.notes;
  }

  /** Sum of UNSPENT note values (credits). Call refreshSpent() first for a
   *  live answer. */
  balance(): bigint {
    let total = 0n;
    for (const note of this.state.notes) {
      if (!note.spent) total += BigInt(note.value);
    }
    return total;
  }

  /** One sync pass: rewind the mutable tail chunk to its chunk start, fetch
   *  pages from there, append every note's cmx to the tree, trial-decrypt
   *  each note, checkpoint, and persist. Returns false when the source is
   *  unreachable mid-pass (state persisted up to the last completed page). */
  async syncPass(onProgress?: (p: ShieldedSyncProgress) => void): Promise<boolean> {
    const CHUNK = SHIELDED_CHUNK_SIZE;
    // Rewind the mutable tail: the buffer chunk is re-fetched every pass
    // (sync.rs:60-65). Drop any notes recorded in the tail — re-fetch +
    // re-decrypt reproduces them.
    const start = this.state.alignedCount - (this.state.alignedCount % CHUNK);
    if (this.state.leaves.length > start) {
      this.state.leaves.length = start;
      this.state.notes = this.state.notes.filter((n) => n.position < start);
      this.state.alignedCount = start;
      this.tree = null; // force rebuild from the truncated leaves
      this.lastProbe = null;
    }
    const tree = this.getTree();

    let scanned = this.state.alignedCount;
    for (;;) {
      let page;
      try {
        page = await this.source.getShieldedEncryptedNotes(BigInt(scanned), CHUNK);
      } catch (error) {
        console.error('ShieldedSync: note fetch failed mid-pass:', error);
        this.persist();
        return false;
      }
      if (page.length === 0) break;
      for (let i = 0; i < page.length; i++) {
        const wire = page[i];
        const leaf = leafFromBytes(wire.cmx);
        if (leaf === null) {
          throw new Error(`ShieldedSync: served note ${scanned + i} has a non-canonical cmx`);
        }
        tree.append(leaf);
        this.state.leaves.push(bytesToHex(wire.cmx));
        // The served nullifier IS the note's rho for trial decryption.
        const hit = tryDecryptNoteWireWithMemo(this.ivk, wire);
        if (hit) {
          this.state.notes.push({
            position: scanned + i,
            nullifier: bytesToHex(wire.nullifier),
            ...(this.nk !== undefined
              ? { spendNullifier: bytesToHex(this.spendNullifierFor(
                bytesToHex(wire.nullifier), hit.note.rseed, hit.address, hit.note.v)) }
              : {}),
            value: hit.note.v.toString(),
            rseed: bytesToHex(hit.note.rseed),
            recipient: bytesToHex(hit.address),
            memo: bytesToHex(hit.memo),
            spent: false,
          });
        }
      }
      scanned += page.length;
      this.state.alignedCount = scanned;
      this.persist();
      onProgress?.({ scanned, owned: this.state.notes.length });
      if (page.length < CHUNK) break; // tip reached
    }

    // One checkpoint per pass at the tree's true post-append leaf count
    // (sync.rs:543-571). Platform's tree only grows, so a checkpoint whose
    // tail we later rewind is still a historical tree state — the anchor
    // probe decides whether Platform still records it.
    const root = bytesToHex(leafToBytes(tree.root()));
    if (this.state.checkpoints[0]?.count !== scanned) {
      this.state.checkpoints.unshift({ count: scanned, root });
      if (this.state.checkpoints.length > MAX_LOCAL_CHECKPOINTS) {
        this.state.checkpoints.length = MAX_LOCAL_CHECKPOINTS;
      }
    }
    this.lastProbe = null;
    this.persist();
    return true;
  }

  /** Fetch Platform's recorded anchor set + most-recent anchor and probe our
   *  checkpoints newest-first (operations.rs select_recorded_spends). */
  async refreshAnchors(): Promise<AnchorProbeResult> {
    const [recordedRaw, mostRecent] = await Promise.all([
      this.source.getShieldedAnchors(),
      this.source.getMostRecentShieldedAnchor(),
    ]);
    const recorded = new Set(recordedRaw.map(bytesToHex));
    const result: AnchorProbeResult = {
      recorded: [...recorded],
      mostRecent: mostRecent ? bytesToHex(mostRecent) : undefined,
    };
    for (const cp of this.state.checkpoints) {
      if (recorded.has(cp.root)) {
        result.matched = cp;
        break;
      }
    }
    this.lastProbe = result;
    return result;
  }

  /** Note::nullifier(nk, rho, psi, cm) from a note's stored secrets (the
   *  rho = the row's nullifier; address = diversifier(11) || pk_d(32); the
   *  commitment is recomputed exactly as the prover/protocol does). */
  private spendNullifierFor(rhoHex: string, rseed: Uint8Array, recipient: Uint8Array, value: bigint): Uint8Array {
    if (this.nk === undefined) {
      throw new Error('ShieldedSync: spend-status queries require nk (pass the FVK\'s nk)');
    }
    const rho = hexToBytes(rhoHex);
    const psi = derivePsi(rseed, rho);
    const rcm = deriveRcm(rseed, rho);
    const cm = noteCommitmentPoint(
      diversifyHash(recipient.slice(0, 11)),
      PallasPoint.fromBytes(recipient.slice(11, 43)),
      value, rho, psi, rcm,
    );
    return deriveNullifier(bigintToBytes32LE(this.nk), rho, psi, cm);
  }

  /** Refresh the spent flag of every owned note via getShieldedNullifiers —
   *  queried with each note's RECOMPUTED spend nullifier (the on-chain
   *  registry holds spend nullifiers, not rhos — see OwnedShieldedNote). */
  async refreshSpent(): Promise<void> {
    if (this.state.notes.length === 0) return;
    const nullifiers = this.state.notes.map((n) =>
      hexToBytes(n.spendNullifier ?? bytesToHex(
        this.spendNullifierFor(n.nullifier, hexToBytes(n.rseed), hexToBytes(n.recipient), BigInt(n.value)))))
      ;
    const statuses = await this.source.getShieldedNullifiers(nullifiers);
    const byHex = new Map(statuses.map((s) => [bytesToHex(s.nullifier), s.isSpent]));
    for (let i = 0; i < this.state.notes.length; i++) {
      const spent = byHex.get(bytesToHex(nullifiers[i]));
      if (spent !== undefined) {
        this.state.notes[i].spent = spent;
        if (this.nk !== undefined && !this.state.notes[i].spendNullifier) {
          this.state.notes[i].spendNullifier = bytesToHex(nullifiers[i]);
        }
      }
    }
    this.persist();
  }

  /** The witness (auth path) for the note at `position` against the newest
   *  recorded anchor (operations.rs witness_at_depth). The tree is rebuilt
   *  truncated to the matched checkpoint's leaf count, so the folded root
   *  equals the anchor byte-for-byte. Throws ShieldedNoRecordedAnchorError
   *  when no recorded anchor can witness the note (the clean, retryable
   *  outcome — nothing may be broadcast). */
  async witnessForSpend(position: number): Promise<{ anchor: Uint8Array; position: number; path: Uint8Array[] }> {
    const probe = this.lastProbe ?? (await this.refreshAnchors());
    // Newest-first: the first checkpoint whose root is recorded wins; deeper
    // checkpoints hold strictly fewer positions, so once the note post-dates
    // the newest recorded checkpoint nothing deeper can contain it
    // (operations.rs: the probe stops as soon as a selected note is no longer
    // witnessable at a depth).
    let matched: PersistedCheckpoint | undefined;
    for (const cp of this.state.checkpoints) {
      if (!probe.recorded.includes(cp.root)) continue;
      matched = cp;
      break;
    }
    if (!matched || position >= matched.count) {
      throw new ShieldedNoRecordedAnchorError(
        `no recorded anchor can witness note at position ${position} ` +
        `(checkpoints: ${this.state.checkpoints.length}, recorded: ${probe.recorded.length})`,
      );
    }
    // Rebuild truncated to the checkpoint (O(count) — fine at testnet scale).
    const tree = new OrchardTree();
    for (let i = 0; i < matched.count; i++) {
      const leaf = leafFromBytes(hexToBytes(this.state.leaves[i]));
      if (leaf === null) throw new Error('ShieldedSync: persisted leaf is non-canonical');
      tree.append(leaf);
    }
    const path = tree.authPath(position);
    // Sanity: the folded root must be the anchor we claim.
    const folded = OrchardTree.rootFromPath(
      leafFromBytes(hexToBytes(this.state.leaves[position])) as bigint,
      position,
      path,
    );
    if (bytesToHex(leafToBytes(folded)) !== matched.root) {
      throw new Error('ShieldedSync: internal witness inconsistency (folded root != anchor)');
    }
    return { anchor: hexToBytes(matched.root), position, path: path.map(leafToBytes) };
  }
}
