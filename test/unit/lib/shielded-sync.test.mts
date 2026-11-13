// test/unit/lib/shielded-sync.test.mts
// Unit tests for lib/shielded/sync.ts. The DAPI source is mocked; "our" notes
// are produced by a TEST-SIDE encryptor that runs the real primitives
// (kaAgreePoint DH + OrchardKDF + ChaCha20-Poly1305 + noteCommitment), so the
// sync layer's trial decryption, tree append, rewind, checkpoint and witness
// logic all run against cryptographically valid wires.
import { describe, it, expect, beforeEach } from 'vitest';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import {
  ShieldedSync,
  ShieldedNoRecordedAnchorError,
  SHIELDED_CHUNK_SIZE,
  type ShieldedSyncSource,
} from '@/lib/shielded/sync';
import { OrchardTree, leafToBytes } from '@/lib/shielded/tree';
import {
  spendingKeyFromSeed,
  fullViewingKeyFromSpendingKey,
  ivkFromFvk,
  deriveDkOvk,
  diversifierAtIndex,
  diversifyHash,
  kaDerivePublic,
  kaAgreePoint,
  kdfOrchard,
  deriveAddressBytes,
} from '@/lib/shielded/keys';
import { derivePsi, deriveEsk, deriveRcm, noteCommitment } from '@/lib/shielded/note';
import { bigintToBytes32LE, bytes32LEToBigint } from '@/lib/shielded/pasta';

// Deterministic test identity (NOT a real wallet).
const SEED = hexToBytes('ab'.repeat(32));
const sk = spendingKeyFromSeed(SEED, 1, 0); // coin type 1 = testnet
const fvk = fullViewingKeyFromSpendingKey(sk);
const ivk = ivkFromFvk(fvk);
const { dk } = deriveDkOvk(fvk);

interface Wire {
  cmx: Uint8Array;
  cvNet: Uint8Array;
  encryptedNote: Uint8Array;
  nullifier: Uint8Array;
}

/** Encrypt a note of `value` credits to OUR ivk's diversifier `j`, the real
 *  way (sender side of zcash_note_encryption):
 *    esk → epk = [esk]g_d; shared = [esk]pk_d (= [ivk]epk by DH symmetry);
 *    key = KDF(shared || epk); ct = ChaCha20-Poly1305(key, 0)(pt).
 *  The served `nullifier` field carries rho (rs-sdk decrypt.rs). */
function encryptToUs(j: number, value: bigint, rho: Uint8Array, memoByte = 0): Wire {
  const d = diversifierAtIndex(dk, j);
  const gD = diversifyHash(d);
  const pkD = kaDerivePublic(gD, ivk);
  const rseed = new Uint8Array(32);
  rseed[0] = 0x42;
  rseed[31] = j & 0xff;
  // Real ZIP-212: esk is DERIVED from (rseed, rho) — checkNoteValidity
  // rejects the note otherwise.
  const esk = deriveEsk(rseed, rho);
  const epk = kaAgreePoint(esk, gD);
  const epkBytes = epk.toBytes();
  const shared = kaAgreePoint(esk, pkD);
  const key = kdfOrchard(shared, epkBytes);
  const pt = new Uint8Array(88);
  pt[0] = 0x02; // ZIP-212
  pt.set(d, 1);
  const vBytes = new Uint8Array(8);
  let v = value;
  for (let i = 0; i < 8; i++) { vBytes[i] = Number(v & 0xffn); v >>= 8n; }
  pt.set(vBytes, 12);
  pt.set(rseed, 20);
  pt.fill(memoByte, 52); // memo = 36 bytes at offset 52 (COMPACT_NOTE_SIZE)
  const ct = chacha20poly1305(key, new Uint8Array(12)).encrypt(pt);
  const psi = derivePsi(rseed, rho);
  const rcm = deriveRcm(rseed, rho);
  const cmx = noteCommitment(gD, pkD, value, rho, psi, rcm);
  if (cmx === null) throw new Error('test encryptor: null commitment');
  const wire = new Uint8Array(216);
  wire.set(epkBytes, 0);
  wire.set(ct, 32); // out_ciphertext (80) left as zeros — not needed for sync
  return { cmx: bigintToBytes32LE(cmx), cvNet: new Uint8Array(32).fill(9), encryptedNote: wire, nullifier: rho };
}

/** A foreign note: epk = identity encodes as all-zero (pasta.fromBytes), so
 *  trial decryption rejects it BEFORE the expensive scalar multiply — keeps
 *  the mocked chunk-crossing test fast. cmx is a real field element so the
 *  tree append runs for real. */
function foreignNote(i: number): Wire {
  const cmx = bigintToBytes32LE((BigInt(i) * 2654435761n + 12345n) % (2n ** 254n));
  return { cmx, cvNet: new Uint8Array(32), encryptedNote: new Uint8Array(216), nullifier: new Uint8Array(32).fill(i & 0xff) };
}

class MockSource implements ShieldedSyncSource {
  wires: Wire[] = [];
  spentNullifiers = new Set<string>(); // hex
  anchorsPruned = false;

  async getShieldedEncryptedNotes(startIndex: bigint, count: number) {
    const s = Number(startIndex);
    return this.wires.slice(s, s + count);
  }

  private rootHex(count: number): string {
    const tree = new OrchardTree();
    for (let i = 0; i < count; i++) tree.append(bytes32LEToBigint(this.wires[i].cmx));
    return bytesToHex(leafToBytes(tree.root()));
  }

  async getShieldedAnchors(): Promise<Uint8Array[]> {
    // Platform retains recent checkpoints; after pruning, only an OLD root.
    if (this.anchorsPruned) return [hexToBytes(this.rootHex(Math.max(0, this.wires.length - 7)))];
    return [hexToBytes(this.rootHex(this.wires.length))];
  }

  async getMostRecentShieldedAnchor(): Promise<Uint8Array | undefined> {
    if (this.wires.length === 0) return undefined;
    return hexToBytes(this.rootHex(this.wires.length));
  }

  async getShieldedNullifiers(nullifiers: Uint8Array[]) {
    return nullifiers.map((n) => ({ nullifier: n, isSpent: this.spentNullifiers.has(bytesToHex(n)) }));
  }
}

function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

describe('shielded sync layer', () => {
  let source: MockSource;
  let storage: ReturnType<typeof memStorage>;
  let sync: ShieldedSync;

  beforeEach(() => {
    source = new MockSource();
    storage = memStorage();
    sync = new ShieldedSync(source, storage, 'test_shielded', ivk, fvk.nk);
  });

  it('syncs a sub-chunk pool and decrypts exactly our notes', async () => {
    // 7 foreign + 3 ours (j = 0, 1, 2) + 4 foreign, interleaved.
    for (let i = 0; i < 7; i++) source.wires.push(foreignNote(i));
    const ours = [
      encryptToUs(0, 1000n, new Uint8Array(32).fill(0x0a)),
      encryptToUs(1, 2000n, new Uint8Array(32).fill(0x0b), 0x5a),
      encryptToUs(2, 3000n, new Uint8Array(32).fill(0x0c)),
    ];
    source.wires.push(ours[0]);
    source.wires.push(foreignNote(100));
    source.wires.push(ours[1]);
    source.wires.push(foreignNote(101));
    source.wires.push(ours[2]);
    source.wires.push(foreignNote(102), foreignNote(103));

    const progress: number[] = [];
    const ok = await sync.syncPass((p) => progress.push(p.scanned));
    expect(ok).toBe(true);
    expect(sync.size).toBe(14);
    expect(progress).toEqual([14]);
    expect(sync.notes.length).toBe(3);
    expect(sync.notes.map((n) => n.position)).toEqual([7, 9, 11]);
    expect(sync.notes.map((n) => n.value)).toEqual(['1000', '2000', '3000']);
    expect(sync.balance()).toBe(6000n);
    expect(sync.notes.every((n) => !n.spent)).toBe(true);
    // Recipients must match deriveAddressBytes(ivk, d) for j = 0, 1, 2.
    for (let j = 0; j < 3; j++) {
      expect(sync.notes[j].recipient).toBe(bytesToHex(deriveAddressBytes(ivk, diversifierAtIndex(dk, j))));
    }
    expect(sync.notes[1].memo).toBe(bytesToHex(new Uint8Array(36).fill(0x5a)));
    // Anchor probe must match the freshest checkpoint.
    const probe = await sync.refreshAnchors();
    expect(probe.matched?.count).toBe(14);
    expect(probe.mostRecent).toBe(probe.matched?.root);
    // A second pass at the same tip records no new notes and no new checkpoint.
    const ok2 = await sync.syncPass();
    expect(ok2).toBe(true);
    expect(sync.size).toBe(14);
    expect(sync.notes.length).toBe(3);
  });

  it('persists state and restores an equivalent sync from storage', async () => {
    for (let i = 0; i < 5; i++) source.wires.push(foreignNote(i));
    source.wires.push(encryptToUs(0, 777n, new Uint8Array(32).fill(0x0d)));
    await sync.syncPass();
    const restored = new ShieldedSync(source, storage, 'test_shielded', ivk, fvk.nk);
    expect(restored.size).toBe(6);
    expect(restored.balance()).toBe(777n);
    expect(restored.notes[0].position).toBe(5);
  });

  /* Heavy multi-pass Poseidon/decryption loop: sits near the 60s global
   * cap when the FULL parallel suite saturates the host (observed 68-82s
   * at load 7-9 on 2026-11-12; passes in ~10-25s standalone). Explicit
   * headroom so suite-level load spikes can't fail the gate. */
  it('rewinds the mutable tail chunk on the next pass (no duplicates, notes re-recorded)', async () => {
    // Grow the pool to CHUNK + 3: one full chunk + a 3-note tail containing
    // our note at position CHUNK + 1.
    for (let i = 0; i < SHIELDED_CHUNK_SIZE; i++) source.wires.push(foreignNote(i));
    source.wires.push(foreignNote(SHIELDED_CHUNK_SIZE));
    const rho = new Uint8Array(32).fill(0x0e);
    source.wires.push(encryptToUs(3, 4242n, rho));
    source.wires.push(foreignNote(SHIELDED_CHUNK_SIZE + 2));
    expect(source.wires.length).toBe(SHIELDED_CHUNK_SIZE + 3);

    const ok = await sync.syncPass();
    expect(ok).toBe(true);
    expect(sync.size).toBe(SHIELDED_CHUNK_SIZE + 3);
    expect(sync.notes.length).toBe(1);
    expect(sync.notes[0].position).toBe(SHIELDED_CHUNK_SIZE + 1);

    // The tail chunk is mutable → next pass rewinds to CHUNK, re-fetches
    // (now with 2 new notes appended), re-appends — no duplicates.
    source.wires.push(foreignNote(SHIELDED_CHUNK_SIZE + 3), foreignNote(SHIELDED_CHUNK_SIZE + 4));
    const ok2 = await sync.syncPass();
    expect(ok2).toBe(true);
    expect(sync.size).toBe(SHIELDED_CHUNK_SIZE + 5);
    const counts = new Map<number, number>();
    const parsed = JSON.parse(storage.map.get('test_shielded')!);
    expect(parsed.leaves.length).toBe(SHIELDED_CHUNK_SIZE + 5);
    expect(new Set(parsed.leaves).size).toBe(parsed.leaves.length); // no dup leaves
    for (const n of sync.notes) counts.set(n.position, (counts.get(n.position) ?? 0) + 1);
    expect(sync.notes.length).toBe(1); // our note re-recorded exactly once
    expect(sync.notes[0].position).toBe(SHIELDED_CHUNK_SIZE + 1);
    expect(sync.balance()).toBe(4242n);
  }, 300_000);

  it('refreshSpent marks spent notes and drops them from the balance', async () => {
    source.wires.push(encryptToUs(0, 100n, new Uint8Array(32).fill(1)));
    source.wires.push(encryptToUs(1, 200n, new Uint8Array(32).fill(2)));
    await sync.syncPass();
    expect(sync.balance()).toBe(300n);
    source.spentNullifiers.add(sync.notes[0].spendNullifier!);
    await sync.refreshSpent();
    expect(sync.notes[0].spent).toBe(true);
    expect(sync.notes[1].spent).toBe(false);
    expect(sync.balance()).toBe(200n);
    // Persistence round-trip keeps the spent flag.
    const restored = new ShieldedSync(source, storage, 'test_shielded', ivk, fvk.nk);
    expect(restored.balance()).toBe(200n);
  });

  it('witnessForSpend returns a path that folds to the recorded anchor', async () => {
    for (let i = 0; i < 9; i++) source.wires.push(foreignNote(i));
    source.wires.push(encryptToUs(0, 555n, new Uint8Array(32).fill(0x0f)));
    for (let i = 10; i < 15; i++) source.wires.push(foreignNote(i));
    await sync.syncPass();
    const witness = await sync.witnessForSpend(9);
    expect(witness.position).toBe(9);
    expect(witness.path.length).toBe(32);
    const probe = await sync.refreshAnchors();
    expect(bytesToHex(witness.anchor)).toBe(probe.matched?.root);
    // Fold independently via rootFromPath (tree.ts is KAT'd separately).
    const cmxLeaf = bytes32LEToBigint(hexToBytes(JSON.parse(storage.map.get('test_shielded')!).leaves[9]));
    const folded = OrchardTree.rootFromPath(cmxLeaf, 9, witness.path.map(bytes32LEToBigint));
    expect(bytesToHex(leafToBytes(folded))).toBe(bytesToHex(witness.anchor));
  });

  it('witnessForSpend throws ShieldedNoRecordedAnchorError when the note post-dates every recorded anchor', async () => {
    for (let i = 0; i < 12; i++) source.wires.push(foreignNote(i));
    source.wires.push(encryptToUs(0, 1n, new Uint8Array(32).fill(0x1f)));
    for (let i = 0; i < 6; i++) source.wires.push(foreignNote(200 + i));
    await sync.syncPass(); // tree = 19 notes; checkpoint at 19
    // Platform prunes: its anchor set now only contains the root at 12
    // (wires.length - 7), which does NOT cover our note at position 12.
    source.anchorsPruned = true;
    await expect(sync.witnessForSpend(12)).rejects.toBeInstanceOf(ShieldedNoRecordedAnchorError);
  });

  it('a corrupted storage blob falls back to a fresh state', () => {
    storage.map.set('test_shielded', '{not json');
    const fresh = new ShieldedSync(source, storage, 'test_shielded', ivk, fvk.nk);
    expect(fresh.size).toBe(0);
    expect(fresh.balance()).toBe(0n);
    storage.map.set('test_shielded', JSON.stringify({ version: 99 }));
    const fresh2 = new ShieldedSync(source, storage, 'test_shielded', ivk, fvk.nk);
    expect(fresh2.size).toBe(0);
  });
});
