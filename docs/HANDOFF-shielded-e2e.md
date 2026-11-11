<!-- docs/HANDOFF-shielded-e2e.md -->

# HANDOFF — Full End-to-End Shielded (SHIELD / TRANSFER / UNSHIELD)

Date: 2026-11-10. Baseline commit: `1520d90` (master). Written for a FRESH
session whose goal is: **SHIELD, shielded TRANSFER, and UNSHIELD all working
end-to-end — on testnet FIRST (the version-matched network: testnet software
== vendored SDK == 5.0.0-rc.8), THEN on mainnet (UNBLOCKED since 2026-11-08,
see §1).** REVIEWED + UPDATED 2026-11-11: mainnet protocol-v14 activation
confirmed live, all OPENs resolved, proxy-mainnet-stale caveat added.

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
  - **Mainnet**: Platform `5.0.3` (dapi + drive), tenderdash `1.8.2`,
    protocol `latest: 14, current: 14` since the epoch 87→88 boundary on
    **2026-11-08 21:53:16 UTC** (epoch 88 startTime `1794174796794`) —
    **shielded IS LIVE on mainnet**. Verified live 2026-11-11 via two
    independent sources: (a) the pshenmic platform-explorer JSON API
    (`https://platform-explorer.pshenmic.dev/status` — network `evo1`,
    indexer `synced` 100%, fresh block timestamp `2026-11-11T14:58:38Z`);
    (b) the vendored 5.0.0-rc.8 WASM SDK against mainnet:
    `getShieldedPoolState()` = `819781434098910` credits (≈ 8,197.81 DASH
    at 10¹¹ credits/DASH), `getShieldedAnchors()` = 27 anchors,
    `getShieldedEncryptedNotes(0n, 10)` = 10 notes, each `encryptedNote`
    exactly 216 bytes. Mainnet end-to-end is therefore UNBLOCKED; the user
    has approved and will fund live mainnet execution (2026-11-11).
    Execution ORDER per user directive: all writes on testnet FIRST, then
    mainnet.
- The DAPI read proxy does NOT serve shielded queries (`get_shielded_pool_state`
  → "Method 'get_shielded_pool_state' is not supported." on both networks
  — verified). All shielded reads MUST go through the vendored WASM SDK
  (`WasmTrustedContext.prefetchTestnet()` + `WasmSdkBuilder.testnet()
  .withTrustedContext(ctx)` per invariant 7 in AGENTS.md). **PROXY CAVEAT
  (2026-11-11)**: the proxy's MAINNET backend is STALE — its `get_status`
  reports software `4.2.0-dev.11`, protocol `current: 13`, epoch `87`,
  with `time.block` frozen at `1794174614160` (2026-11-08 21:50 UTC, ~65 h
  behind its own fresh `time.local`; `node`/`chain`/`network`/`stateSync`
  are null). The original 'mainnet v13 / shielded NOT live' claim in this
  document came from that stale backend and was already wrong when written
  (activation happened 2026-11-08). Mainnet identity reads via
  `lib/dapi-proxy.ts` (proxy-first) serve stale data until the proxy
  backend is upgraded — handoff issued to the proxy team:
  `dev-dapi-proxy/docs/HANDOFF-mainnet-backend-upgrade-v5.md`. **UPDATE
  (2026-11-11, same day — RESOLVED, deployed 17:04Z)**: the proxy team
  upgraded the mainnet backend to drive/dapi 5.0.3 + tenderdash 1.8.2 +
  dashd 24.0.0 (live-re-verified by us: get_status 5.0.3 / protocol
  14/14/14 / epoch 88 / ~33 s block lag), shipped six shielded read
  methods on the proxy live on BOTH networks (get_shielded_pool_state /
  get_shielded_anchors / get_shielded_most_recent_anchor /
  get_shielded_notes_count / get_shielded_encrypted_notes /
  get_shielded_nullifiers — {data,dataB64} wrappers, string balances;
  live-verified by us), and added /health/deep (503 when time.block lags
  >30 min; verified 'ok'). Their follow-up: dev-dapi-proxy commit 257aaec
  (docs/HANDOFF-mainnet-backend-upgrade-v5-deployed.md — their repo purges
  resolved handoffs; read it from git history). Their one open ask of us:
  migrate our shielded reads from the WASM SDK to those proxy methods —
  DONE same-day (lib/dapi-proxy.ts `makeProxyFirstShieldedSource`, proxy
  PRIMARY + per-call WASM fallback, 10 new tests, live-verified on both
  networks — see AGENTS.md F29). The rc.8
  mainnet-compatibility question is RESOLVED (see the mainnet bullet):
  the vendored SDK works against the current v14 mainnet.

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
  sighash → `apply_signatures` order). NOTE (2026-11-11): this local
  checkout (`2811ac3bf6`) PREDATES the protocol-v14 outputs-only bundle
  binding (see Step 6(g)) — the authoritative v14 sighash source is the
  GitHub tag `v5.0.0-rc.8` file
  `packages/rs-dpp/src/shielded/sighash.rs`:
  `https://raw.githubusercontent.com/dashpay/platform/v5.0.0-rc.8/packages/rs-dpp/src/shielded/sighash.rs`
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

### Step 3 — PCZT request construction (`lib/shielded/prove.ts`) — DONE + LIVE-VERIFIED

**STATUS**: `lib/shielded/prove.ts` builds a complete OUTPUT-ONLY PCZT locally
(fork-exact dummy spend halves: Note::dummy / MerklePath::dummy /
Nullifier::dummy constructions, output rho = the spend half's wire nullifier,
per-action cv_net = V*(spend - output) + R*rcv, ZIP-244 digest ->
computePlatformSighash with the 33-byte v14 extra data, every spend half
spend-auth-signed incl. dummy_asks, bsk = Σ rcv), `postPcztFrame` POSTs the
raw wire frame (application/octet-stream — the HANDOFF's "no JSON wrapper" is
literal: the wire parser reads the BODY as a frame; a curl `-d @file.json`
probe returns 400 ERR_FIELD_EMPTY_BODY) and rejects any prover-side field
mutation (response must be the request frame + ONLY the zkproof trailer).
**Live round-trip** (/tmp/prove-roundtrip.mjs): 2-action output-only frame
(1 real self-send of 1,000,000 credits + 1 filler dummy) = 3,673 wire bytes
-> HTTP 200 with a 7,264-byte proof (the EXACT size of the prover team's own
2-action fixture) in 47.5 s (pkWasCached = false, fresh isolate). Binding
signature (`signBinding`) verifies locally. 8/8 unit tests
(test/unit/lib/shielded-prove.test.mts) cover structure, serialize/parse
round-trip, sighash self-consistency from the parsed frame, spend-auth sig
verification, bsk consistency, recipient trial-decryption of the real output,
and the binding signature. The plan below now applies to the SPEND-CAPABLE
extension (real note spends from the synced tree) — everything it specifies
remains valid and builds directly on this module:


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

**DONE + runtime-verified (2026-11-11) for the SHIELD-FROM-ASSET-LOCK
v1 transition** — `lib/shielded/assemble.ts`
`assembleShieldFromAssetLock({assetLockProof, assetLockPrivateKey, build,
provedFrame, surplusOutput?, platformVersion?, rand?})`:
1. re-validates the proved frame against the local build byte-for-byte
   (zkproof excluded), 2. maps frame halves onto `SerializedOrchardAction`
   instances (`encryptedNote = epk ‖ enc_ciphertext ‖ out_ciphertext`,
   216 B), 3. guards `valueSumIsNegative` and passes the POSITIVE
   `valueSumMagnitude` as the transition's u64 `valueBalance`
   (`build_bound_bundle` parity), 4. computes the binding sig with
   `signBinding(build.bsk, build.sighash, rand(80))`, 5. constructs
   `new ShieldFromAssetLockTransition({…, signature: new Uint8Array(0)})`
   → `.toStateTransition()` → `.signByPrivateKey(assetLockPrivateKey,
   null, undefined)` (returns the SIGNED WIRE BYTES) →
   `StateTransition.fromBytes(wireBytes)` for broadcast.
Wire framing (runtime-dumped, not just source-read): `0x12` (umbrella
enum index 18) ‖ `0x01` (V1) ‖ standard+big-endian bincode fields —
varint `≤250` literal / `0xfb` u16BE / `0xfc` u32BE / `0xfd` u64BE;
AssetLockProof Chain = `0x01`, height varint, OutPoint = `0x20 ‖ txid(32
raw) ‖ vout u32 varint`; `getSignableBytes()` = all-except-signature;
ECDSA = SHA-256d(signable) → 65-byte `[v=27+4+recid ‖ r ‖ s]` low-S,
keyId/keyType ignored for this transition type.
`AssetLockProof.createIdentityId()` = SHA-256d(outpoint36) = the 32-byte
identifier for BOTH the `0x86` extra-sighash builder and the transition's
unique identifier. KAT `test/unit/lib/shielded-assemble.test.mts` (4
tests, real vendored wasm) walks the full signed wire field-by-field.
CAUGHT + FIXED: `prove.ts` was missing the fork's automatic MIN_ACTIONS
pad (`builder.rs:94` — `max(requested, 2)`; consensus prices the shielded
fee from the on-wire action count vs a wallet reservation of exactly 2,
so a 1-action shield would be REJECTED) — now pads to ≥ 2. GOTCHA:
noble 2.x `secp256k1.verify` defaults `prehash:true` — pass
`{prehash:false}` for a pre-hashed digest.
The remaining piece for a live SHIELD is only the funding side: the
core-chain asset-lock + chainlock-height wait (the F27i flow in
`lib/core-chain.ts` / `lib/registrar-manager.ts`) feeding `assemble()`
→ `sdk.broadcastStateTransition(stateTransition)` on TESTNET first.

### Step 5 — broadcast via the wasm SDK

- `ShieldedTransferTransitionOptions` (d.ts): `{ actions:
  SerializedOrchardAction[], valueBalance: bigint, anchor: Uint8Array,
  proof: Uint8Array, bindingSignature: Uint8Array }`;
  `SerializedOrchardActionOptions`: `{ nullifier, rk, cmx, encryptedNote
  (216 B), cvNet, spendAuthSig (64 B) }` — all from the parsed response +
  Step-4 signatures.
- **RESOLVED (2026-11-11)**: the 216-byte `encryptedNote` wire layout is
  `epk(32) || enc_ciphertext(104) || out_ciphertext(80)`. Sources: rs-dpp
  `src/shielded/mod.rs:146` (doc comment on `SerializedAction.encrypted_note`;
  the struct at :125 is the wasm binding's `SerializedOrchardAction` —
  field names/widths match: nullifier 32, rk 32, cmx 32, encrypted_note
  216, cv_net 32, spend_auth_sig 64); the fork's `memo.rs:135-138`
  (`DashMemo` MEMO_SIZE = 36 → plaintext 88 → ciphertext 104, vs upstream
  `ZcashMemo` 512/564/580 at :100-110); rs-dpp `src/shielded/memo.rs`
  (the 36-byte memo is structured: 4-byte kind tag + 32-byte payload).
  Our `lib/shielded/note.ts:16-24` constants already match byte-for-byte
  (`FULL_ENCRYPTED_NOTE_LEN = 32 + 104 + 80 = 216`) and `note.ts:289-291`
  already parses this layout. Live-verified on mainnet 2026-11-11:
  `getShieldedEncryptedNotes(0n, 1)` returned `encryptedNote.length === 216`.
- Broadcast: follow the existing `stateTransitionService` pattern
  (`lib/services/state-transition-service.ts`) for constructing +
  broadcasting a transition with the 5.0 SDK. **RESOLVED (2026-11-11)**:
  the 5.0.0-rc.8 WasmSdk class has NO dedicated shielded write methods
  (no `shieldedTransfer()` etc. — full method list audited); construct the
  transition class (`ShieldedTransferTransition` d.ts:12201 — its options
  interface at d.ts:1460 is exactly the field list above; the token-pool
  sibling `TokenShieldedTransferTransition` is at d.ts:13599 — 13602 was
  its constructor line) and broadcast via
  `sdk.broadcastStateTransition(st, settings?)` (d.ts:14846;
  `broadcastAndWait` + `waitForStateTransitionResult` also exist).

### Step 6 — SHIELD (L1 → pool) and UNSHIELD (pool → L1) variants

- SHIELD: `ShieldFromAssetLockTransitionOptions` (d.ts:1299), class at
  12024 (corrected 2026-11-11; 12031 was stale). The asset-lock mechanics are already solved in this repo
  (`lib/core-chain.ts` — v23 asset locks, F24/F27i invariants: OP_RETURN
  at vout 0, chain-proof height = Platform's `coreChainLockedHeight`).
  Output-only bundle (no spends) — the deployed `/prove/shield` endpoint
  already proves this shape (consensus-verified per AGENTS.md), and the
  output-only-via-`/prove/pczt` question is **RESOLVED (2026-11-11):
  SUPPORTED via dummy spend halves** —
  (a) the PCZT v1 wire has a FIXED 1845-byte action block with BOTH a
      spend (1410 B) and an output (370 B) section; an action can never
      omit its spend half (`pczt_wire.rs` header comment; fork
      `pczt.rs:112-120` — `Action { cv_net, spend: Spend, output: Output }`,
      both halves non-Option);
  (b) output-only bundles fill the spend halves with DUMMY notes (fork
      `builder.rs:911-922` 'pair up the spends and outputs, extending with
      dummy values as necessary') and the action count is
      `max(max(spends, outputs), MIN_ACTIONS = 2)` (fork `builder.rs:37` +
      `num_actions` at :76-109) — a 1-output SHIELD = **2 actions**, each
      publishing a dummy nullifier on the wire (rs-dpp `builder/mod.rs:743-744`
      test comment);
  (c) rs-dpp's own output-only builder (`build_output_only_bundle`,
      `builder/mod.rs:190-229`) uses `BundleType::Transactional { flags:
      SPENDS_DISABLED }` + **`Anchor::empty_tree()`** — no spends means no
      witness verification, so the anchor is the empty-tree root (our
      `lib/shielded/tree.ts` can compute it; KAT against the fork's
      `Anchor::empty_tree().to_bytes()` on evorunner);
  (d) dummy-note construction to mirror: fork `note.rs:227-243` (random sk
      → fvk → `address_at(0, External)` → value-ZERO note, rho =
      `Rho::from_nf_old(Nullifier::dummy(rng))` = random 32 B) and
      `tree.rs:119-125` `MerklePath::dummy` (random u32 position + 32
      random `pallas::Base` auth-path nodes); the prover requires the same
      per-action fields for dummy spends as for real ones
      (`pczt/prover.rs:55-80`);
  (e) `dummy_sk` MUST NOT go on the wire (v1 rejects flag 1 — the client
      strips it before sending) — the client keeps the dummy spending key
      and signs the dummy spend itself with the dummy ask (fork
      `pczt.rs:1061-1066` + `builder.rs:1112-1114` 'we can create
      signatures for dummy spends immediately');
  (f) `value_balance` is NEGATIVE for output-only bundles (value flowing
      in — rs-dpp `shield_from_asset_lock.rs:58-71` `checked_neg`) → wire
      `valueSumIsNegative = 1`, magnitude = the absolute shield amount;
  (g) **PROTOCOL-14 SIGHASH BINDING (new, consensus-critical)**: at v14 an
      outputs-only bundle's extra_data is NOT empty — it is
      `bundle_tag(1) || owner(32)` (`credit_pool_output_only_extra_sighash_data_v0`,
      rc.8 `sighash.rs:909-914`), gated by
      `dpp.methods.credit_pool_bundle_binding = Some(0)` (rc.8
      `dpp_method_versions/v3.rs:16`, selected by protocol v14 at
      `v14.rs:2804`). For ShieldFromAssetLock: tag `0x86`, owner =
      `assetLockProof.createIdentityId()` (rc.8 `sighash.rs:866-870`; wasm
      binding d.ts:8860 — the same 32 bytes our registrar already derives
      from the lock outpoint, F27i). ShieldFromIdentity: tag `0x85` ||
      identity_id. Shield (from platform addresses): tag `0x84` || SHA-256
      of the concatenated 21-byte input addresses in BTreeMap key order
      (`shield_funding_digest_v0`, rc.8 `sighash.rs:811-819`). Rationale
      (rc.8 `sighash.rs:884-908`): outputs-only bundles carry no anchor
      pinning them to one pool, so unbound bundle bytes are free-standing
      and replayable. TRANSFER extra_data stays EMPTY (rc.8 `sighash.rs`
      module doc: 'extra_data is empty only for the credit pool's
      ShieldedTransfer...'). The LOCAL platform checkout (`2811ac3bf6`)
      predates this binding — use the GitHub tag `v5.0.0-rc.8`
      `packages/rs-dpp/src/shielded/sighash.rs` as authoritative.
  (h) `ShieldFromAssetLockTransitionOptions` (d.ts:1299) additionally carries
      a top-level `signature: Uint8Array` field (separate from
      `bindingSignature`) and an optional `platformVersion` — the interface's
      own doc comment says protocol 14 admits only transition version 1
      ('whose bundle binds its kind and its asset lock') and to 'build the
      bundle's sighash for the same protocol version'. Determine the exact
      v1 field placement from the rc.8 rs-dpp transition source at assembly
      time; do NOT guess.
  (i) TS-side builder to add: `lib/shielded/bundle.ts` currently has only
      `computePlatformSighash` (:120), `unshieldExtraSighashData` (:134)
      and `shieldedWithdrawalExtraSighashData` (:143) — the v14
      `credit_pool_output_only_extra_sighash_data_v0` (tag||owner, 33 B)
      builder from (g) must be ported + KAT'd before SHIELD assembly.
- UNSHIELD: `UnshieldTransitionOptions` (d.ts:1944), class at 13911.
  `outputAddress` is a DIP-17 PLATFORM address (`PlatformAddressLike` —
  21 bytes: type byte + 20-byte hash, or bech32m string; d.ts:1944-1950),
  NOT a Core L1 address — L1 payout is the separate
  `ShieldedWithdrawalTransition` below or a follow-up
  `addressFundsWithdrawal` (present in the audited 5.0.0-rc.8 WasmSdk
  method list). extra_data = `unshieldExtraSighashData(outputAddress,
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
- Mainnet: UNBLOCKED since 2026-11-08 (protocol v14 live on both
  networks — §1). Same flow and on-chain verification protocol as
  testnet, executed with user-supplied DASH (user directive 2026-11-11:
  testnet writes FIRST, then mainnet). NOTE: `get_status` from the
  dapi.sansbank.dev proxy is NOT a trustworthy mainnet source until the
  proxy backend is upgraded (its mainnet backend is frozen pre-activation
  — see the PROXY CAVEAT in §1); use the WASM SDK or
  `https://platform-explorer.pshenmic.dev/status` instead.
- Full pipeline green: `tsc --noEmit` = 0, `pnpm lint` = 0 errors (the 1
  known postsState warning persists), `pnpm test:run` all pass,
  `pnpm build` = exit 0.
- AGENTS.md updated with the results (mark F28c done + record
  verification).
