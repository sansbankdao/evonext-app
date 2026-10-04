# HANDOFF — Spend-Proof (Unshield) Support for `wasm-prover`

**From:** evonext.app (web client) team
**To:** `wasm-prover` team (`sansbankdao/wasm-prover`, deployed at `https://prover.sansbank.dev` — note: **.dev**, not .org)
**Date:** 2026-10-04
**Status:** Request for feature work — the client is ready to integrate on delivery

---

## 1. Why

The Dash **wasm SDK 4.1.1** is confirmed **read-only** for the foreseeable future
(no proving, no state-transition building for shielded spends). Our web client
(`evonext.app`) therefore cannot perform the three shielded SPEND operations
without your service. Your `shield_from_asset_lock` prover already works and is
consensus-verified — we need the SAME treatment for the three spend types so
evonext.app gains full shield/unshield parity with evonext-mobile.

Reference implementations that already work **natively** (evonext-mobile, via
`platform-wallet-ffi` — file `android/app/src/main/jni/rsffi/shielded_jni.cpp:854-1040`):

| Operation | Native FFI call | Direction |
|---|---|---|
| Shielded transfer | `platform_wallet_manager_shielded_transfer(manager, walletId, resolver, account, recipientRaw43, amount, memo)` | Orchard → Orchard |
| Unshield | `platform_wallet_manager_shielded_unshield(manager, walletId, resolver, account, toPlatformAddr, amount)` | Orchard → Platform address (`dash1k…/tdash1k…`) |
| Withdraw | `platform_wallet_manager_shielded_withdraw(manager, walletId, resolver, account, toCoreAddress, amount, coreFeePerByte)` | Orchard → Core L1 (base58 `X…/y…`) |

All three "spend shielded notes, build a Halo2 proof (CachedOrchardProver), and
broadcast the state transition to Platform inside the FFI". We need you to prove
the bundle; the browser keeps keys and broadcasts (your existing trust model).

## 2. What the wasm SDK 4.1.1 gives us today (verified, `lib/dash-wasm/wasm_sdk.d.ts` + strings of `wasm_sdk_bg.wasm`)

- Transition **types** exist and are serializable:
  `ShieldFromAssetLockTransition`, `ShieldTransition`, `UnshieldTransition`,
  `ShieldedTransferTransition`, `ShieldedWithdrawalTransition` — including a
  `UnshieldTransitionV0` with fields `outputAddress, actions, unshieldingAmount,
  anchor, proof, bindingSignature` and a `ShieldedWithdrawalTransition` with
  `actions, unshieldingAmount, anchor, proof, bindingSignature, coreFeePerByte,
  pooling, outputScript` (seen in the wasm's embedded struct descriptions).
- **Read-side** queries only: `getShieldedPoolState`, `getShieldedAnchors`,
  `getShieldedEncryptedNotes`, `getShieldedNullifiers` (+ `WithProofInfo` variants).
- **No proof creation of any kind** in the SDK (verified: zero prover functions
  in the wasm) and **no Orchard key derivation** from a mnemonic.
- So the full client stack (key derivation → note decryption → note selection →
  witness construction → proving → broadcast) must be supplied by YOU + our
  existing asset-lock/L1 code.

## 3. The three deliverables

### D1 — Spend-proof endpoints (primary)

New C-ABI exports in `src/lib.rs` + new Worker routes, one per spend type
(analysis below; final split decided in §4):

1. `prove_shielded_transfer` — spends N notes, outputs M notes
   (`ShieldedTransferTransition`: `actions, valueBalance, anchor, proof,
   bindingSignature, …`).
2. `prove_unshield` — spends N notes, output is a **Platform address**
   (`UnshieldTransition`: `outputAddress, actions, unshieldingAmount, …`).
3. `prove_shielded_withdraw` — spends N notes, output is a **Core L1 script**
   (`ShieldedWithdrawalTransition`: `outputScript, coreFeePerByte, pooling,
   unshieldingAmount, …`).

Known-good invariants you already established (carry them over):
- Order is consensus-critical: fix the action set (`build` incl. padding) → take
  `commitment()` from the **unauthorized** bundle → derive the platform sighash →
  `create_proof` → `apply_signatures` over that sighash.
- Sighash = `SHA-256("DashPlatformSighash" || bundle_commitment || extra_data)`
  (`platform/packages/rs-dpp/src/shielded/sighash.rs:35`). For **shield** and
  **shielded_transfer** the comment states extra_data is empty. **VERIFY and
  DOCUMENT what extra_data is for unshield and shielded_withdrawal** — those
  transitions carry transparent fields (output address / core fee / output
  script), so a non-empty extra_data is plausible. A wrong sighash passes
  locally and dies on chain.
- The proving key is the SAME unified Orchard circuit (K=11, one `ProvingKey::build`)
  — spend actions add circuit constraints but require NO second keygen. Your
  `pk_build()` cold-start cost (~30-50 s measured) is unchanged.
- wasm `i64`/u64 → `BigInt` in JS. workerd: no runtime `WebAssembly.compile`,
  no global-scope `crypto.randomUUID()`, no clock in busy loops.
- Memory: your Worker measured 99.88 MB peak @ 2 output actions of the 128 MB
  limit, hard fail at 7. **Measure the spend path too** — each spend action
  carries both a spend and an output description, so cost per action may rise;
  publish the new table.

### D2 — Client toolkit module (secondary, but required for D1 to be usable)

The browser needs key/note primitives that neither the read-only wasm SDK nor
your current prover exposes. They all exist in the **same pinned orchard fork**
(`dashpay/orchard`, tag `dashified-0.14.1`) you already compile:

- `derive_spending_key(seed)` — Dash coin types: **mainnet 5, testnet 1**
  (mobile reference: `keys.rs:78-81`).
- Shielded address derivation (43 raw bytes = 11-byte diversifier + pk_d) and
  bech32m encoding (`dash1z…` / `tdash1z…`).
- Full/Incoming viewing key derivation; **note decryption** of the
  `getShieldedEncryptedNotes` results (epk + enc_ciphertext + out_ciphertext →
  value, rho, rseed, recipient).
- Nullifier computation (`note.nullifier(nk)`).
- Merkle witness construction (auth path + position + anchor) from the note
  commitment tree — tree state source TBD between pool-state queries and the
  anchor queries; please propose the exact recipe you used natively.

Two packaging options, your call:
- **(a)** a second committed artifact `client.wasm` (keys + notes + witnesses,
  optionally also local proving), loaded by the browser from your repo/CDN;
- **(b)** extend the existing single module with additional exports and let the
  Worker serve only the server-side subset.

### D3 — Posture + docs update

- Update the README/AGENTS "trust model": what the server can and cannot learn
  per spend (see §4). The current hard rule "never holds a spending key … no
  API token" must be restated for whatever the spend ABI ends up accepting.
- Record the sha256 of the rebuilt `orchard.wasm` (repo rule #3).
- Publish the new ABI table (input widths, action layout — the 408-byte
  `nullifier || rk || cmx || encrypted_note || cv_net || spend_auth_sig` layout
  presumably still applies to every action; confirm for spend-only actions).

## 4. The trust-model decision we need from you (blocker for D1's exact shape)

A spend circuit needs private inputs the OUTPUT-only shield path never had:
per spent note — **note plaintext (value, rho, rseed/recipient), the nullifier
key `nk`, the spend-authorizing key `ak`, and the Merkle auth path**.

- **Design A — server proves, client signs.** Browser derives keys and decrypts
  its notes locally, then sends per-spend circuit inputs (ak, nk, note, auth
  path) + the output set + anchor to the Worker; Worker does
  `build → commitment → sighash → create_proof` and — if it also receives
  `ask`/`bsk` — the signatures. Without `ask` the client must sign
  (`apply_signatures` split): verify the orchard fork allows pre-signing or a
  second round-trip (Worker returns the commitment/sighash; client returns
  spend-auth sigs). **Posture change to document:** the Worker temporarily
  learns `ak`/`nk` and the spent notes' values/positions. `nk` alone lets a
  prover link your future nullifiers; `ak`/`ask` never let it spend (spending
  requires `ask`). DAO-operated service may be acceptable — decide and state it.
- **Design B — browser proves (recommended endgame).** Compile the SAME crate
  (it already builds under `wasm32-unknown-unknown` — your committed
  `orchard.wasm` is the existence proof) for **browser** delivery with
  `build_output_only_bundle`/`prove_and_sign_bundle`-style spend paths exposed
  locally. Keys and witnesses never leave the tab. Your README's "browser is
  the worse host" argument was about the Worker's 128 MB ceiling; in-browser
  there is no such fixed cap, and our app already ships
  COOP/COEP + `require-corp` headers (evonext.app `public/_headers`), so wasm
  threads/atomics (the `halo2_proofs` `multicore` `compile_error!`) are
  satisfiable if you later want parallel proving. Ship single-threaded first,
  measure, then optimize.

Our preference: implement **A first** (fastest to unblock the client), design
the ABI so it is reusable by **B**, and keep B on the roadmap.

## 5. Acceptance criteria

1. For each of the three spend transitions, a bundle produced by your service
   passes the consensus verification path you already scripted
   (`Bundle::try_from_parts(.., ProofSizeEnforcement::Strict)` +
   `BatchValidator::validate`, `rs-drive-abci/…/shielded_common/mod.rs:95-238`)
   — with SPENDS, including spend-auth and binding signature validation.
2. End-to-end on **testnet** with evonext.app as the client: browser derives
   keys from a mnemonic, receives shielded funds (your existing shield
   endpoint), performs a transfer, an unshield, and a withdrawal to an L1
   address; all three broadcast and confirm.
3. Measured table added to the README: wall time (cold/warm), peak wasm memory,
   per-action limits for the spend path.
4. ABI documentation: request/response field tables, error codes via
   `err_ptr`/`err_len`, and the sighash/extra_data ruling for each transition.

## 6. What we bring (client side, already verified)

- Self-custodial L1 asset locks (browser-built, v23 format) — can feed
  `shield_from_asset_lock` today (your existing endpoint).
- Broadcast + confirmation tracking for state transitions and Core L1.
- The read-side shielded queries for note/pool/anchor/nullifier state.
- Live testnet identity + funds + a proven harness (Node + browser) we can
  point at your new endpoints the day they land.

## 7. Open questions for your team

1. Exact `extra_data` for `Unshield` and `ShieldedWithdrawal` sighashes
   (`rs-dpp/src/shielded/sighash.rs` + the state-transition serializers are the
   source of truth).
2. Does the orchard fork's `apply_signatures` support a client-supplied
   signature set (Design A without `ask` crossing the wire)?
3. Serialization the transitions expect from `serialize_authorized_bundle` for
   spend bundles (field order/widths; do spend-only actions still carry `cmx`
   + `encrypted_note`?).
4. Tree/anchor source: which query provides the commitment-tree nodes the
   witness needs, and what does the native path cache between syncs?
5. Dummy-input strategy for spends (padding actions to grow the anonymity set)
   and whether zero-value spend fillers are consensus-legal here.
