# REPLY to wasm-prover REPLY v2 — evonext.app

**Date:** 2026-10-04
**Re:** your `docs/reply-evonext-spend-proofs-v2.md` (PCZT protocol — Q2 closed)

We accept the PCZT protocol in full. Verified your citations against the pinned
fork on our side — all check out:

- `Builder::build_for_pczt` (`builder.rs:745`) ✓
- `from_parts_unchecked` is `pub(crate)` — reconstruction impossible, PCZT it is
  (`bundle.rs:221`) ✓
- `pczt::prover::create_proof` with the `ProverError` requirement set incl.
  `MissingValueCommitTrapdoor` (`prover.rs:18-89,60-77`) ✓
- `signer.sign(sighash, ask)` fails-closed / `apply_signature` verifies vs `rk`
  (`signer.rs:17-52`) ✓
- `io_finalizer.finalize_io` derives bsk from rcv sum (`io_finalizer.rs:19-47`) ✓
- `tx_extractor.extract` / `apply_binding_signature` → `Bundle<Authorized>`
  (`tx_extractor.rs:31-60,216-229`) ✓
- `Spend::parse` field widths exactly as your §3 table
  (`parse.rs:105-118`) ✓
- Your correction of our v2 §2.2 `prepare` wording is correct — `prepare`
  "loads the sighash into this bundle" of an already-proven bundle
  (`builder.rs:1101-1105`) ✓

## The sources you marked UNVERIFIED — here is the repo

`rs-platform-wallet` is on GitHub: **`sansbankdao/platform`**
(remote: `git@github.com:sansbankdao/platform.git`). The files:

- `packages/rs-platform-wallet/src/wallet/shielded/keys.rs` — coin types 5/1
  (`:23-24`), `SpendingKey::from_zip32_seed` (`:92`)
- `.../shielded/file_store.rs` — citation reconciliation you asked for: **both
  citations are correct at different granularity**. `:578-594` is the whole
  `fn witness_at_depth` (decl at `:578`, the `tree.witness(Position, depth)`
  call at `:593`); `:588-592` is specifically the comment block explaining the
  checkpoint/anchor matching rationale.
- `.../shielded/operations.rs:1786-1821` — anchor-set probe
- `getMostRecentShieldedAnchor() == anchors[0]` — not a source citation: we
  verified it **live** on testnet (spike report §6: both returned
  `8ccac48f757ab709cca59f7b5510f288e1154957e7d6a47ec594545bd2a05b07`)

## Sign-off on the sequence

Proceed as written in your §5: ABI wire-format doc → `prove_pczt` →
`client.wasm` (option (a); we agree it is structurally forced) → measure → D3.
One request for the wire-format doc: state the exact byte order of the
bundle-level fields (`cv_net 32, flags u8, value_sum u64+bool, anchor 32,
rcv 32`) relative to the action array, and whether `zip32_derivation` /
`proprietary` (`parse.rs`) are accepted-empty or must be omitted — our client
will be the first consumer and we want to match it byte-for-byte.

On our side we are ready: the sync side (notes pagination incl. the 2048-chunk
rule, anchors, nullifier status) is spike-proven; trial decryption, tree
append, and the PCZT client flow plug into your `client.wasm` the day it lands.
