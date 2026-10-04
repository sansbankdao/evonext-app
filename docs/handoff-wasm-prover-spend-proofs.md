# HANDOFF — Spend-Proof (Unshield) Support for `wasm-prover` — v2

**From:** evonext.app (web client) team
**To:** `wasm-prover` team (`sansbankdao/wasm-prover`, deployed at `https://prover.sansbank.dev` — note: **.dev**, not .org)
**Date:** 2026-10-04 (v2; supersedes v1 sent 2026-10-04 morning — your reply answered most of §7, and our Q4 spike is complete)
**Status:** Feature work unblocked — all pre-ABI questions are now answered (mostly by your reply, one by our spike). The only remaining blocker before endpoint work is the Q2 signature split (your side: add `prepare/sign/finalize` plumbing or client-sig API).

---

## 0. Status of the original asks (what changed since v1)

| Item | Was | Now |
|---|---|---|
| §7 Q1 (sighash `extra_data` for the three spends) | open | **ANSWERED by your reply** — see §2.1 |
| §7 Q2 (client-supplied signatures) | open | **PARTIALLY answered** — the split exists in the crate (`prepare`/`sign`/`finalize`); no client-sig API yet. **Remaining ask** — see §2.2 |
| §7 Q3 (spend action serialization) | open | **ANSWERED by your reply** — see §2.3 |
| §7 Q4 (tree/anchor source for witnesses) | open | **ANSWERED by our spike (complete)** — see §3 |
| §7 Q5 (dummy-input/padding strategy) | open | **ANSWERED by your reply** — see §2.4 |
| D1 spend-proof endpoints | requested | **Ready to build** — all sighash/layout/fee questions closed; only Q2 split pending |
| D2 client toolkit | vague | **Specified concretely** (v1 §4.2 + our spike §4 API proposal) |
| D3 posture + docs | requested | unchanged, see §5 |

---

## 1. Why (unchanged from v1, condensed)

Wasm SDK 4.1.1 is **read-only** for shielded ops (no proving, no Orchard key
derivation — verified). evonext.app needs the three shielded SPEND operations
(transfer / unshield-to-Platform / withdraw-to-Core-L1) that evonext-mobile
performs natively via `platform-wallet-ffi` (`shielded_jni.cpp:854-1040`). Your
`shield_from_asset_lock` prover already works and is consensus-verified; we need
the same treatment for the three spend types. Trust model: server proves, client
keeps keys and broadcasts (Design A first, Design B — browser-proving from the
same crate — as the endgame; ABI reusable by both).

## 2. Answers received (cited so nobody re-litigates them)

### 2.1 Q1 — sighash `extra_data` per spend type (ANSWERED)

Source: `platform/packages/rs-dpp/src/shielded/sighash.rs`:

- **Shield / ShieldedTransfer:** `extra_data` is **EMPTY**.
- **ShieldedWithdrawal v0:** `output_script ‖ unshielding_amount (u64 LE) ‖ core_fee_per_byte (u32 LE) ‖ pooling (u8)`.
- **Unshield v0:** `output_address ‖ unshielding_amount (u64 LE)`.
- Sighash = `SHA-256("DashPlatformSighash" ‖ bundle_commitment ‖ extra_data)`.
- For ShieldedWithdrawal the **binding signature is the only authorization
  boundary** (no identity-key signature, no address-witness check) — so its
  integrity rides entirely on the binding sig covering the sighash.

### 2.2 Q2 — client signing split (PARTIAL — the one remaining blocker)

The orchard fork (`dashpay/orchard`, `builder.rs`) exposes the split we need:

- `prepare` (`builder.rs:1105`) — builds the unauthorized bundle, returns the
  commitment/sighash inputs;
- `sign(rng, ask)` (`:1154`) — adds spend-auth + binding signatures;
- `finalize` (`:1217`) — completes the bundle; **sign must complete before
  finalize**.

No client-sig API exists yet. **Ask:** expose a flow where the server runs
`prepare`, returns the sighash (or the prepared state), the client signs
client-side with `ask`, and the server/`finalize` completes it — so `ask` never
crosses the wire. If workerd's statelessness makes holding `prepare` state
impossible, tell us what state must round-trip and we'll shape the ABI around it
(e.g. client sends pre-computed spend-auth sigs and the server completes binding
after learning the sighash — enumerate what is feasible).

### 2.3 Q3 — spend-action serialization (ANSWERED)

`serialize_authorized_bundle` (`rs-dpp/src/shielded/builder/mod.rs:108`) uses the
**same 408-byte field layout for ALL actions** (`nullifier ‖ rk ‖ cmx ‖
encrypted_note ‖ cv_net ‖ spend_auth_sig`); there is no spend-only variant. Spend
actions carry `cmx` + `encrypted_note` like output actions.

### 2.4 Q4 (from our reply to you) — fees are NOT ABI parameters

Consensus charges exactly `compute_shielded_unshield_fee` /
`compute_minimum_shielded_fee` and **ignores surplus** (`unshield.rs:33-36`).
Builders return `(StateTransition, Credits)`. Do not add a fee field to the
spend ABI; return the computed fee (or let the client read it from the returned
transition) so the UI can show an accurate total.

### 2.5 Q5 — dummy inputs / padding (ANSWERED)

`build_spend_bundle_with` (`mod.rs:275+`) uses `BundleType::DEFAULT`, which
**pads with dummy actions** to grow the anonymity set; the
`extra_sighash_data` closure machinery exists (needed only by
IdentityCreateFromShieldedPool). Padding strategy is settled; expose a
`dummy_outputs`-style knob as you already do for shield.

## 3. Q4 — tree/anchor source: ANSWERED by our spike (complete 2026-10-04)

Full report: evonext.app `docs/spike-q4-shielded-tree-witness.md`. Findings,
live-verified on testnet:

1. **Every tree input is already served by DAPI in authenticated form.**
   `getShieldedEncryptedNotes(startIndex, count)` returns notes **in tree
   order**, each carrying `cmx`(32) + `nullifier`(32) + `cvNet`(32) +
   `encryptedNote`(216). The per-note nullifier is served **for rho derivation
   during trial decryption** (`rs-drive-proof-verifier/src/types.rs:831-833`) —
   the wallet needs no transaction context to decrypt.
2. **Chunk alignment:** `start_index` must be a **multiple of 2048** (DAPI
   rejects otherwise: "start_index 50 is not chunk-aligned; must be a multiple
   of 2048"). Sync = 2048-note pages from index 0.
3. Scale: testnet tree = **4,693 notes** (3 pages). Trivial for a browser.
4. Anchors: `getShieldedAnchors()` returns the valid anchor roots (2 on testnet
   now); `getMostRecentShieldedAnchor()` matches `anchors[0]`.
   `getShieldedNullifiers([...])` round-trips spent/unspent status.
5. **Reference algorithm** (`rs-platform-wallet/src/wallet/shielded/`): fetch
   pages → trial-decrypt with IVK → append `cmx` in order to
   `ClientPersistentCommitmentTree` (crate `grovedb_commitment_tree`) →
   **checkpoint per sync boundary** (retention 100) → for a spend, probe
   checkpoint depths from 0 upward and use the **shallowest checkpoint whose
   `MerklePath::root()` is in the `getShieldedAnchors` set** (Platform records
   one anchor per block while a chunk sync leaves the tree mid-block;
   `file_store.rs:578-594`, `operations.rs:1786-1821`). Anchor and auth path
   always agree via `MerklePath::root()`.
6. **Gaps in the 4.1.1 wasm binding** the toolkit must cover:
   `total_count` (carried in the Rust `ShieldedEncryptedNotes` type, provably,
   "for free" in the same proof — `types.rs:848-855`) is **dropped** by
   `wasm-sdk/src/queries/shielded.rs:96-105`; and no `MerklePath`/tree types are
   exported at all.

### Proposed D2 client-toolkit API (from the spike)

From the `grovedb_commitment_tree` + pinned orchard fork stack, the browser
needs exactly:

1. `tree_new(max_checkpoints)` / `tree_append(cmx)` / `tree_checkpoint()` /
   `tree_anchor()` / `tree_witness(pos, depth)` / `tree_size()` /
   `tree_serialize()` / `tree_deserialize(bytes)` — persistence in the browser
   via IndexedDB of the serialized tree.
2. `derive_keyset(seed, network, account)` → FVK/ASK/IVK/OVK + default address
   (+ address at diversifier index). ZIP-32 `m/32'/coin_type'/account'` via
   `SpendingKey::from_zip32_seed`; coin types **5 mainnet / 1 testnet**
   (`keys.rs:23-24,92`).
3. `trial_decrypt(ivk, notes[])` → owned notes (value, rho, recipient; rho from
   the served per-note nullifier).
4. `nullifier_of(note, nk, pos)` — for spend tracking via
   `getShieldedNullifiers`.
5. Spend-side per §2.2: the client runs `sign` after the server's `prepare`.

Packaging (your call, as before): a second committed `client.wasm`, or extra
exports in the existing module with the Worker serving only the server subset.

## 4. Remaining work (the short list)

1. **Q2 split (blocker for D1's exact shape):** decide/implement the
   `prepare`/`sign`/`finalize` flow so `ask` never crosses the wire (§2.2).
2. **D1 — three spend-proof endpoints** (`prove_shielded_transfer`,
   `prove_unshield`, `prove_shielded_withdraw`) using the now-closed Q1/Q3/Q5
   rulings and NO fee parameter (§2.4). Invariants to carry over from your
   shield endpoint: order is consensus-critical (build → `commitment()` of the
   unauthorized bundle → sighash → `create_proof` → apply signatures); same
   unified K=11 proving key (no second keygen); workerd constraints (no runtime
   `WebAssembly.compile`, no clock in busy loops, u64 → BigInt); measure the
   spend path's memory/time table (each spend action carries a spend AND an
   output description — cost per action may exceed the shield table's).
3. **D2 — client toolkit** per the §3 API list.
4. **D3 — posture + docs:** trust-model update (what the Worker learns per
   Design A: `ak`/`nk` + spent-note values/positions unless the §2.2 split is
   used, in which case it learns less); sha256 of rebuilt artifacts; ABI field
   tables incl. the §2.1 extra_data rulings.

## 5. Acceptance criteria (updated)

1. Each of the three spend transitions, proven by your service, passes the
   consensus path (`Bundle::try_from_parts(.., ProofSizeEnforcement::Strict)` +
   `BatchValidator::validate`) including spend-auth and binding signature checks.
2. Sighash correctness for each type is asserted in a test against the §2.1
   extra_data layouts (a wrong sighash passes locally and dies on chain).
3. End-to-end on **testnet** with evonext.app as the client: browser derives
   keys, receives shielded funds (your shield endpoint), performs a transfer,
   an unshield to a Platform address, and a withdrawal to a Core L1 address;
   all three broadcast and confirm.
4. Measured table in the README: wall time (cold/warm), peak wasm memory,
   per-action limits for the spend path.
5. ABI docs: request/response field tables, error codes, the fee-reporting
   convention (§2.4), and the signature-split protocol (§2.2).

## 6. What we bring (unchanged, verified)

- Self-custodial L1 asset locks (browser-built, v23 format) feeding your
  existing `shield_from_asset_lock` endpoint.
- Broadcast + confirmation tracking for state transitions and Core L1.
- The read-side shielded queries, now **spike-proven** (§3): note pagination
  with chunk alignment, anchors, nullifier status.
- Live testnet identity + funds + Node/browser harnesses ready to point at the
  new endpoints the day they land.
