# SPIKE Q4 — Shielded Note-Commitment Tree & Witness Construction for the Web Client

**From:** evonext.app
**To:** `wasm-prover` team (feeds your D2 client toolkit + D1 ABI input format)
**Date:** 2026-10-04
**Question (from your reply §1):** "Determine the note-commitment-tree source and what
the native path caches between syncs, and prototype witness construction against
`getShieldedPoolState`/`getShieldedAnchors` output."

**Verdict: FEASIBLE with the read-only wasm SDK alone.** Every input the tree needs is
already served by DAPI in authenticated form. The only missing piece is the tree/witness
implementation itself, which must come from `grovedb_commitment_tree` compiled to wasm
(your D2). Details, all verified live on testnet and against source:

## 1. What the read-only SDK serves (live-verified, testnet)

| Method | Returns | Spike observation |
|---|---|---|
| `getShieldedPoolState()` | `u64` | Total pool **balance**: 75,697,764,470,458 credits (`rs-drive-proof-verifier/src/types.rs:807`, "Shielded pool total balance"). Not tree data. |
| `getShieldedEncryptedNotes(startIndex, count)` | `ShieldedEncryptedNote[]` | Notes in **tree order**; each carries `cmx`(32) + `nullifier`(32) + `cvNet`(32) + `encryptedNote`(216). The nullifier is served for **rho derivation during trial decryption** (`types.rs:831-833`) — the wallet needs no transaction context to decrypt. |
| `getShieldedAnchors()` | `[u8;32][]` | **All valid anchors** for building spend proofs. Live: 2 anchors on testnet right now. |
| `getMostRecentShieldedAnchor()` | `[u8;32]` | Matches `anchors[0]` live. |
| `getShieldedNullifiers([...])` | status per nullifier | Works (`isSpent: false` for a live note). |

**CHUNK ALIGNMENT RULE (found empirically):** `start_index` **must be a multiple of
2048** or DAPI rejects with `"start_index 50 is not chunk-aligned; must be a multiple
of 2048"`. Sync = fetch notes in 2048-note pages from index 0.

## 2. Gaps in the 4.1.1 wasm binding (client toolkit must cover)

1. **`total_count` is dropped.** The Rust `ShieldedEncryptedNotes` type carries
   `total_count` ("extracted from the SAME note-fetch proof... for free",
   `types.rs:848-855`), but `wasm-sdk/src/queries/shielded.rs:96-105` only pushes the
   notes array. Workaround we validated: paginate to the end (testnet tree = **4,693
   notes**, 3 pages — trivial). Your client toolkit should surface `total_count` directly.
2. **No tree/witness types in the wasm SDK.** No `MerklePath`/`CommitmentTree`/Orchard
   witness is exported (only `AddressWitness` for the L1-style address funding path).
   The tree must live in your D2 artifact.

## 3. The reference algorithm (port target)

From `rs-platform-wallet/src/wallet/shielded/` (the mobile FFI's own source):

- **Sync loop** (`coordinator.rs` header): interleaved fetch + trial-decrypt +
  tree-append. Notes arrive in tree order, so appending each fetched chunk's `cmx` in
  order rebuilds the exact tree.
- **Tree store** (`file_store.rs:20,50`): `ClientPersistentCommitmentTree` from the
  **`grovedb_commitment_tree`** crate, persisted over SQLite. Relevant surface:
  - `checkpoint(id)` — snapshot per sync boundary
  - `anchor()` → current root
  - `witness(Position, depth)` → `Option<MerklePath>` (`file_store.rs:578-594`)
  - `max_leaf_position()` → tree size
  - Retention: opened with `max_checkpoints = 100` (`operations.rs:1768-1770`)
- **Witness/anchor matching** (`operations.rs:1786-1821`): fetch the recorded anchor set
  (`getShieldedAnchors`), then **probe checkpoint depths from 0 upward and pick the
  shallowest checkpoint whose `MerklePath::root()` is in the recorded set**. Reason
  (`file_store.rs:588-592`): Platform records one anchor per block while an index-chunk
  sync routinely leaves the tree mid-block; deeper checkpoints hold strictly fewer
  positions, so the first match is maximal. The proof uses whichever anchor the witness
  produces, so anchor and authentication path always agree.
- **Keys** (`keys.rs`): ZIP-32 `m/32'/coin_type'/account'` via
  `SpendingKey::from_zip32_seed`; coin types 5 (mainnet) / 1 (testnet); FVK/ASK/IVK/OVK +
  `fvk.address_at(index, Scope::External)`; ASK re-attached only at spend time
  (privilege separation, `keys.rs:120-160`).

## 4. Proposed D2 client-toolkit API (wasm, C ABI or wasm-bindgen)

From the above, the browser needs exactly these exports from the `grovedb_commitment_tree`
+ orchard fork stack:

1. `tree_new(max_checkpoints)` / `tree_append(cmx)` / `tree_checkpoint()` /
   `tree_anchor()` / `tree_witness(pos, depth)` / `tree_size()` / `tree_serialize()` /
   `tree_deserialize(bytes)` — persistence in the browser via IndexedDB/localStorage of
   the serialized tree.
2. `derive_keyset(seed, network, account)` → FVK/ASK/IVK/OVK/default address (+ address
   at diversifier index).
3. `trial_decrypt(ivk, notes[])` → owned notes (value, rho, recipient; using the served
   per-note nullifier for rho).
4. `nullifier_of(note, nk, pos)` — for spend tracking via `getShieldedNullifiers`.
5. Spend-side (per your reply §3): the `sign` + `finalize` steps the client must run
   after your server's `create_proof` (Q2 split).

## 5. What we can already do without waiting

- Full sync prototype (notes → owned-note detection) once `derive_keyset` +
  `trial_decrypt` exist; the fetch/pagination/nullifier-status side is done and proven
  (this spike).
- The `getShieldedAnchors` → checkpoint-matching logic is portable to TypeScript for the
  interim if you expose the tree as a plain serialized structure rather than opaque wasm.

## 6. Test vectors from this spike (testnet, 2026-10-04)

- Pool balance: `75697764470458`
- Anchor (most recent): `8ccac48f757ab709cca59f7b5510f288e1154957e7d6a47ec594545bd2a05b07`
- Note 0: cmx `79c57517f583a016…`, nullifier `0022dcf64e47b4a3…`, cvNet
  `dd9e43028138682d…`, encryptedNote length 216
- Tree size: 4,693 notes; chunk size 2048; nullifier status query round-trips.
