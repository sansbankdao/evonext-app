<!-- docs/HANDOFF-shielded-e2e.md -->

# HANDOFF — Full End-to-End Shielded (SHIELD / TRANSFER / UNSHIELD)

Date: 2026-11-10. Baseline commit: `1520d90` (master). Written for a FRESH
session whose goal is: **SHIELD, shielded TRANSFER, and UNSHIELD all working
end-to-end on testnet, and on mainnet once the network allows it.**

Every claim below is backed by a file path, a command, or a live call made
on 2026-11-10. Nothing is guessed. Where a fact could not be verified, it is
explicitly marked **OPEN**.

---

## 1. What is already done (do NOT redo — extend)

All of the following is committed in `1520d90`, pure TypeScript in
`lib/shielded/`, and KAT-verified byte-for-byte against the pinned fork or
the upstream crates. 167/167 unit tests pass (`pnpm test:run`), `tsc
--noEmit` = 0, `pnpm lint` = 0 errors / 1 known intentional
`postsState` exhaustive-deps warning (see AGENTS.md, F26o).

| Module | Port of | Verification |
| --- | --- | --- |
| `pasta.ts` | pasta_curves-0.5.2 Pallas/Vesta curve + Fp/Fq fields | KATs from crate internals (earlier session) |
| `hash.ts` | BLAKE2b personalized hashes incl. `PrfExpand::*` | KATs (earlier session) |
| `swu.ts` | Simplified SWU + isogeny `hash_to_curve` | KATs (earlier session) |
| `sinsemilla.ts` | Sinsemilla hash/commit | KATs (earlier session) |
| `ff1.ts` | FF1-AES diversifier derivation | KATs (earlier session) |
| `keys.ts` | ZIP-32 Orchard keys, FVK/IVK/DK/OVK, KA | KATs (earlier session) |
| `note.ts` | note commitment, encryption/decryption, **`deriveNullifier`** (Poseidon + `mod_r_p` + `K^orchard`), **`noteCommitmentPoint`** | 3 fork-generated nullifier KATs + golden-vector encryption KAT |
| `pczt-wire.ts` | wasm-prover `src/pczt_wire.rs` (PCZT v1 wire format) | round-trip KAT on real 1154-byte fixture + **LIVE parse of the prover's real response** |
| `tree.ts` | grovedb_commitment_tree incremental tree | 8/8 KATs vs `test_vectors/commitment_tree.json` from the fork |
| `sync.ts` | rs-platform-wallet coordinator + file_store | 7 tests with real-crypto encryptor, anchor verification, nullifier status |
| `reddsa.ts` | reddsa-0.5.2 (RedPallas/RedDSA) sign/verify/randomize over `SpendAuthG` / `Binding` | 6 KATs generated via self-asserting Rust generator (evorunner) |
| `bundle.ts` | `bundle/commitments.rs` ZIP-244 digest + `sighash.rs` `compute_platform_sighash` + v0 extra-data layouts | golden-vector KAT `4129796966e923cb...4dfbb21b7f7e` |
| `poseidon.ts` + generated `poseidon-constants.ts` | halo2_poseidon-0.1.0 P128Pow5T3 over Fp | 4 permute KATs from the crate's own `test_vectors.rs` |

### Live-verified facts (2026-11-10)

- `POST https://prover.sansbank.dev/prove/pczt` (content-type
  `application/octet-stream`, body = raw request frame) is DEPLOYED and
  WORKS. Response = JSON `{"response": "<hex of the PCZT response frame>"}`.
  Proof of life: POSTing `test/fixtures/pczt-request-v1-2actions.bin`
  returned HTTP 200; the unwrapped frame parses with our
  `parsePcztFrame` → 2 actions, `valueSumMagnitude = 40000n`,
  `valueSumIsNegative = false`, `zkproof` = 7264 bytes, valid anchor
  `14713a11...ae22650a`. Cold proving-key build in the worker isolate took
  ~63 s for 2 actions (subsequent calls in the same isolate reuse it —
  `/health` reports `pkIsCached`).
- Other prover endpoints (verified from `wasm-prover/src/index.js`):
  `POST /prove/shield` (L1 asset-lock → pool, the original deployed flow)
  and `GET /health`. `https://prover.sansbank.dev` is DAO-wide (Cloudflare
  Worker, account in the `sansbank.dev` zone).
- wasm SDK 5.0.0-rc.8 (`lib/dash-wasm/wasm_sdk.d.ts`) CONFIRMED to expose
  everything the sync engine and assembly need (verified 2026-11-10):
  `getShieldedEncryptedNotes(startIndex: bigint, count: number)` →
  `ShieldedEncryptedNote[]` (d.ts:15809), `getShieldedNullifiers(
  nullifiers: Uint8Array[])` → `ShieldedNullifierStatus[]` (d.ts:15814),
  `getShieldedPoolState()` → `bigint | undefined` (d.ts:15819),
  `getShieldedAnchors()` → `Uint8Array[]` (d.ts:15804). Our
  `lib/shielded/sync.ts` `ShieldedSyncSource` interface already matches
  these names/arities — the fresh session only has to wrap the real
  `WasmSdk` object.
- Network status (verified live via `dapi.sansbank.dev` get_status):
  - **Testnet**: Platform `5.0.0-rc.8`, protocol `current: 14` — shielded
    fully live. Chain height ~670k at verification time.
  - **Mainnet**: Platform `4.2.0-dev.11`, protocol `current: 13`,
    `latest/nextEpoch: 14` — **shielded NOT live**. `get_shielded_pool_state`
    is also not served by the proxy for mainnet. Mainnet end-to-end is
    therefore **BLOCKED on the mainnet protocol-v14 activation**. No
    activation date is known to this repo — do not guess one; check
    `get_status` again at session start.
- The DAPI read proxy does NOT serve shielded queries (`get_shielded_pool_state`
  → "Method 'get_shielded_pool_state' is not supported." on both networks
  — verified). All shielded reads MUST go through the vendored WASM SDK
  (`WasmTrustedContext.prefetchTestnet()` + `WasmSdkBuilder.testnet()
  .withTrustedContext(ctx)` per invariant 7 in AGENTS.md). **OPEN**: the
  proxy currently reports mainnet software `4.2.0-dev.11` while the
  vendored SDK is `5.0.0-rc.8`; whether `WasmSdkBuilder.mainnet()` of rc.8
  works against the current v13 mainnet is UNVERIFIED (not needed until
  mainnet activation).

---

## 2. Repos and pinned sources (read these, do not skim)

- This repo: `/Workspace/sansbank/evonext.app` (master @ `1520d90`).
  Project rules: `/home/shomari/.pi/agent/AGENTS.md` (deterministic facts,
  full sources, minimum diff) + `/Workspace/sansbank/evonext.app/AGENTS.md`
  (load-bearing invariants — webpack aliases, `Buffer` ProvidePlugin,
  network singleton, headers policy).
- Prover: `/Workspace/sansbank/wasm-prover` — `src/lib.rs` (`prove_pczt`
  export, error codes, response accessors), `src/pczt_wire.rs` (the wire
  spec in comments, line-for-line), `src/index.js` (worker routing/JSON
  envelope), `docs/design-pczt-wire-format.md`, `docs/reply-evonext-spend-proofs-v2.md`.
  The original integration handoff we have been executing against:
  `docs/handoff-shielded-client-integration.md` (in this repo) — its D2
  "implement POST /prove/shielded" item is STALE: the deployed endpoint is
  `/prove/pczt` and it is live (see §1).
- Fork: `~/.cargo/git/checkouts/orchard-94d8ef6bfc19d6d0/38ac9c1`
  (dashpay/orchard @ `dashified-0.14.1`). Key files: `src/builder.rs`
  (`build_pczt_from_parts`, `apply_signatures`, `value_sum`, `cv_net`
  derivation), `src/pczt.rs` (`Spend::parse` / `Output::parse` field
  order), `src/bundle.rs` + `src/bundle/commitments.rs` (digest),
  `src/value.rs` (`ValueCommitment::derive`, `into_bsk`, `into_bvk`),
  `src/note_encryption.rs` (`prf_ock_orchard`, `outgoing_plaintext_bytes`),
  `src/keys.rs`, `src/note.rs` + `src/note/nullifier.rs`, `src/spec.rs`.
- Platform: `/Workspace/sansbank/platform/packages/rs-dpp/src/shielded/`
  (`sighash.rs` — extra_data layouts, `builder/mod.rs` — `commitment()` →
  sighash → `apply_signatures` order).
- Remote Rust builds: `ssh evorunner` with
  `export PATH=$HOME/.cargo/bin:$PATH` (no cargo locally). Scratch
  projects used so far live in `/tmp/nf-kat` (also rsync'd to evorunner)
  and `/tmp/reddsa-kat` — pattern: depend on the fork via
  `orchard = { git = "https://github.com/dashpay/orchard.git", tag =
  "dashified-0.14.1" }`, print hex vectors, consume them in vitest.

---

## 3. What remains (the fresh session's work)

Ordered by dependency. Each item lists the exact fork citation it must
mirror and how to verify it. **Every primitive needed already exists in
`lib/shielded/` — what is left is assembly, one small KAT, and the
network/broadcast integration.**

### Step 1 — value commitment `cv_net` (small, KAT-able)

- Fork: `src/value.rs:358` — `ValueCommitment::derive(value, rcv) =
  hash_to_curve(VALUE_COMMITMENT_PERSONALIZATION)(V_BYTES) * value +
  hash_to_curve(...)(R_BYTES) * rcv`, with
  `VALUE_COMMITMENT_PERSONALIZATION = b"z.cash:Orchard-cv"`,
  `VALUE_COMMITMENT_V_BYTES = b"v"`, `VALUE_COMMITMENT_R_BYTES = b"r"`
  (`src/constants/fixed_bases.rs:38,41`).
- Per-action net value: `value_sum = spend.note.value() - output.value`
  (`src/builder.rs:438`); `cv_net = ValueCommitment::derive(v_net, rcv)`
  (`src/builder.rs:464`/`:497`). Sign convention: positive when value
  moves into the action (spend > output). `value` is a `NoteValue`
  (u64-ish; the fork converts via `i64`/`ValueSum` internally — check
  `value.rs` for the exact signed path before implementing; the digest
  layer already handles signed `valueBalance` via two's complement).
- TS: add `valueCommitment(vNet: bigint, rcv: bigint): PallasPoint` +
  `getValueCommitV()` to `lib/shielded/reddsa.ts` or a new
  `lib/shielded/value.ts` (R = existing `getBindingG()`).
- VERIFY: scratch Rust on evorunner — print `ValueCommitment::derive(v,
  rcv).to_bytes()` for 3–4 (v, rcv) pairs including v = 0 and a negative
  v; consume as vitest KATs. (~15 min of work.)

### Step 2 — outgoing ciphertext `out_ciphertext` (small, KAT-able)

- Fork: `src/note_encryption.rs:33-48` — `prf_ock_orchard` =
  Blake2b-256 personalized `b"Zcash_Orchardock"` over
  `ovk(32) || cv.to_bytes()(32) || cmx_bytes(32) || epk_bytes(32)`;
  `:251-258` — outgoing plaintext = `pk_d(32) || esk(32)` (64 bytes),
  ChaCha20-Poly1305 zero nonce → 80 bytes (`OUT_CIPHERTEXT_SIZE`).
  Called from `src/builder.rs:388` and `src/action.rs:227`.
- TS: `encryptOutgoingPlaintext(ovk, cvPoint, cmxBytes, epkBytes, pkDBytes,
  eskBytes)` using existing `blake2b256Personal` + noble chacha20poly1305.
- VERIFY: scratch Rust vector (the encryptor path is deterministic given
  esk) OR cross-check via the golden-vector action (its `out_ciphertext`
  was `[0x03; 80]` synthetic — so generate a real one on evorunner).
- NOTE: `out_ciphertext` feeds the ZIP-244 `nh` hasher, so it must be
  IDENTICAL between the PCZT request sent to the prover and the final
  assembled bundle (the prover copies action data through verbatim —
  confirmed by the fixture round-trip).

### Step 3 — PCZT request construction (`lib/shielded/prove.ts`, new)

- Assemble a `PcztFrame` (existing types) for a real transfer:
  - spend side: note selected from `lib/shielded/sync.ts` (unspent
    `OwnedNote` with `witness` — the stored `IncrementalWitness`-style
    `{position, path}` must be re-serialized into the wire witness layout
    `position u32 LE + 32 x [u8;32]`, leaf-layer sibling first,
    `tree.rs:147-160`);
  - output side: recipient address (43 bytes) + amount + NEW random
    `rseed` (crypto.getRandomValues) + the action's change output when
    needed (same layout, recipient = own address at a fresh index);
  - `alpha` = fresh random scalar per spend (fork randomizes `rk` with it;
    `reddsa.ts` `randomizeVerificationKey` must reproduce the same `rk`);
  - `rcv` per action (fresh random scalar) — bsk later = `Σ rcv`
    (`value.rs:309`, `into_bsk`);
  - `flags = 0x03`, `valueSumMagnitude/IsNegative` per the transfer
    direction, `anchor` = the verified anchor from sync (must be a
    recorded Platform anchor — `sync.ts` already enforces this);
  - `dummy_sk`/`zip32_derivation`/`proprietary`/`user_address` flags = 0
    (v1 forbids them; the server rejects 1);
  - `spend_auth_sig` absent (flag 0), `zkproof` absent (flag 0) in the
    REQUEST.
- Serialize with `serializePcztFrame` (existing), POST to
  `https://prover.sansbank.dev/prove/pczt`, unwrap the JSON `response`
  hex, parse with `parsePcztFrame` (existing).
- VERIFY: unit tests on synthetic frames (round-trip already covered) +
  a live smoke against the prover with a REAL synced note (this is the
  first true end-to-end milestone: request → 200 → parseable proof).
  Timeouts: allow ≥ 120 s cold.

### Step 4 — signature application (authorized bundle assembly)

- After the prover returns, compute
  `bundle_commitment = hashBundleTxidData(actions, flags, valueBalance,
  anchor)` (existing) over the ACTION DATA (which the prover echoed back;
  use the parsed response actions, not the request, to guarantee byte
  identity), then `sighash = computePlatformSighash(bundle_commitment,
  extraData)` with `extraData = new Uint8Array(0)` for transfer
  (`sighash.rs:35`).
- Per spend action: `spend_auth_sig = spendAuthSign(ask, alpha, sighash)`
  (existing `reddsa.ts`; `ask` from the user's ZIP-32 spending key —
  `keys.ts` already derives it from the account mnemonic).
- Binding: `bsk = Σ rcv mod r` → `bindingSig = bindingSign(bsk, sighash)`
  (existing). Self-check: `getVerificationKeyFromScalar(bsk, bindingG)`
  must equal `Σ cv_net − ValueCommitment::derive(valueBalance, 0)`
  (`bundle.rs:428-441`) — implement this assertion; it catches rcv /
  cv_net sign bugs before broadcasting.

### Step 5 — broadcast via the wasm SDK

- `ShieldedTransferTransitionOptions` (d.ts): `{ actions:
  SerializedOrchardAction[], valueBalance: bigint, anchor: Uint8Array,
  proof: Uint8Array, bindingSignature: Uint8Array }`;
  `SerializedOrchardActionOptions`: `{ nullifier, rk, cmx, encryptedNote
  (216 B), cvNet, spendAuthSig (64 B) }` — all from the parsed response +
  Step-4 signatures.
- **OPEN**: the 216-byte `encryptedNote` layout on the wire (epk || ct ||
  rk or similar) — read the `SerializedOrchardAction` class + rs-dpp
  `SerializedOrchardAction` struct before assembling; do NOT guess the
  field order.
- Broadcast: follow the existing `stateTransitionService` pattern
  (`lib/services/state-transition-service.ts`) for constructing +
  broadcasting a transition with the 5.0 SDK. **OPEN**: exact SDK method
  name for shielded transfer broadcast (look for
  `shieldedTransferTransition` / `tokenShieldedTransferTransition`
  classes at d.ts:12201 / 13602 and their broadcast path).

### Step 6 — SHIELD (L1 → pool) and UNSHIELD (pool → L1) variants

- SHIELD: `ShieldFromAssetLockTransitionOptions` (d.ts:1299), class at
  12031. The asset-lock mechanics are already solved in this repo
  (`lib/core-chain.ts` — v23 asset locks, F24/F27i invariants: OP_RETURN
  at vout 0, chain-proof height = Platform's `coreChainLockedHeight`).
  Output-only bundle (no spends) — the deployed `/prove/shield` endpoint
  already proves this shape (consensus-verified per AGENTS.md), but the
  fresh session MAY prefer routing everything through the new
  `/prove/pczt` client flow for uniformity (the PCZT format supports
  output-only frames — `action_count` ≥ 1 with spend-less actions is
  possible? **OPEN**: check `pczt_wire.rs` whether an action may omit the
  spend section; the wire format has a spend section per action, so
  output-only bundles may NOT fit v1 — the fork pads with dummy actions
  instead; read `builder.rs` padding logic first).
- UNSHIELD: `UnshieldTransitionOptions` (d.ts:1944), class at 13911.
  extra_data = `unshieldExtraSighashData(outputAddress,
  unshieldingAmount)` (existing, byte-layout KAT'd). The bundle spends
  from the pool and has NO Orchard outputs (or a change output) — same
  assembly as Step 3–5 with the unshield extra_data in the sighash.
- Shielded WITHDRAWAL (DIP-18 pooling) is a separate transition with its
  own extra_data (`shieldedWithdrawalExtraSighashData`, existing) —
  defer unless asked.

### Step 7 — end-to-end verification protocol

For each of SHIELD / TRANSFER / UNSHIELD on testnet (and mainnet when
unblocked):
1. Use a funded test identity (the repo's known test identity
   `8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy` has credits; L1 funding
   keys derive from the same mnemonic per `lib/core-chain.ts`).
2. Run the flow in Node first (`tsx` script) — every prior milestone was
   Node-verified before browser.
3. Verify on-chain: balance deltas via `getIdentityBalance` /
   `getShieldedPoolState`; nullifiers marked spent via
   `getShieldedNullifiers`; new notes discoverable via a fresh sync
   (`lib/shielded/sync.ts` against the real DAPI).
4. Only then wire the UI (send.tsx already has the L1 withdrawal card
   from F25 as a pattern reference).

---

## 4. Practical gotchas (learned the hard way this milestone)

- The worker wraps PCZT responses in JSON hex (`{"response": "..."}`) —
  ALWAYS unwrap before parsing; the raw frame starts `01 | count(u16 LE)
  | 03 | ...`.
- `parsePcztFrame` field names: `valueSumMagnitude`, `valueSumIsNegative`,
  `zkproof` (NOT `valueSum`/`proof`).
- Prover cold start: first proof in a fresh isolate rebuilds the proving
  key (~63 s for 2 actions observed; the `/prove/shield` path reported
  ~minutes for its build historically). Use ≥ 120 s fetch timeouts and
  never run two cold proofs in parallel.
- vitest: an ASYNC `vi.waitFor` callback that awaits a dynamic import
  never sees updates — use sync callbacks and pre-import in beforeEach
  (F26p note in AGENTS.md).
- `fvkFromBytes` takes the 96-byte serialized FVK; a raw 32-byte spending
  key goes through `fullViewingKeyFromSpendingKey` (returns `{ak, nk,
  rivk}` — `nk` is a bigint; serialize with `bigintToBytes32LE`).
- `fp` in `pasta.ts` has no `mod` export — field ops already reduce;
  `bytes32LEToBigint` does NOT range-check (validate `< FP_MOD` where a
  canonical element is required, as `deriveNullifier` does).
- The wasm SDK's `WasmSdkBuilder.withTrustedContext` CONSUMES the builder
  (use its return) — F27i note in AGENTS.md.
- Node tests must init the wasm with `initSync({module: bytes})`
  (`fetch(file://)` unsupported) — invariant 7 in AGENTS.md.
- Run `pnpm test:run`, `pnpm lint`, `pnpm build` SEQUENTIALLY, never in
  parallel (false TS6053 / exit-124 failures historically).

## 5. Definition of done

- SHIELD, TRANSFER, UNSHIELD each executed on testnet with on-chain
  verification (balance deltas + nullifier status + rediscovery by sync),
  with all test artifacts documented.
- Mainnet: same, OR a documented live `get_status` showing protocol v14
  still pending — in which case mainnet remains explicitly blocked and
  the blocker is stated, not worked around.
- Full pipeline green: `tsc --noEmit` = 0, `pnpm lint` = 0 errors (the 1
  known postsState warning persists), `pnpm test:run` all pass,
  `pnpm build` = exit 0.
- AGENTS.md updated with the results (mark F28c done + record
  verification).
