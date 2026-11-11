<!-- AGENTS.md -->

# EvoNext — Agent Working Notes

This file records verified findings and current state for updating, debugging, and testing
this codebase. Every entry is backed by a source path or command output. Do not add
unverified claims here. Full historical detail for every completed task lives in the git
history of this file (see log below for commit hashes) — keep only load-bearing facts here.

## Project Snapshot

- App: `evonext-app` v`26.1.30` — `package.json`
- Stack: Next.js `16.3.8`, React `19.3.0`, TypeScript 5, pnpm `11.21.0`, Node `v24.18.1`
- Build: static export (`output: 'export'`), webpack forced via `--webpack` in dev/build
  scripts (Turbopack is default in 16; the webpack config is load-bearing, see invariants)
- WASM SDK: `lib/dash-wasm/` — raw dist of `@dashevo/wasm-sdk@5.0.0-rc.8` + `compat.ts`
  (upgraded F27o from 4.2.0-dev.11 for testnet protocol v14 / Platform v5.0.0; the wasm
  grew 20.7MB -> 26.5MB). `dash-platform-sdk` bumped 1.5.0-dev.11 -> 1.5.3 (wallet-manager).

### Verification status (current baseline; run sequentially, never in parallel)

- `tsc --noEmit` -> 0
- `pnpm lint` (`eslint .`) -> 0 errors, 0 warnings
- `pnpm test:run` -> 5 files, 62 tests passed
- `pnpm build` -> exit 0, 35/35 pages + 2 route handlers, `out/_headers` + 20MB wasm emitted
- `playwright test --project=chromium` -> 2 passed (serves `./out` via `test/static-server.mjs`)

### Operational notes

- Run builds/tests/lint **sequentially, never in parallel** (parallel runs caused false
  TS6053 / exit-124 failures historically).
- pnpm 11 ignores `pnpm.overrides` in package.json — use `pnpm-workspace.yaml`.
- Remote: `origin` = `git@github.com:sansbankdao/evonext-app.git` (branch `master`).

## Load-bearing invariants & gotchas (do not remove or regress)

1. **webpack `pshenmic-dpp` -> `pshenmic-dpp/wasm` alias** (next.config.js): the package's
   `node` condition resolves to a native `.node` binary webpack cannot parse, AND under
   plain Node the bare specifier and the wasm entry are two distinct DPP instances; the
   alias forces browser bundle class-identity unity. Never narrow/remove. Also
   `worker_threads: false` + `fs/path/crypto: false` client fallbacks (latter for the
   Emscripten `@dashevo/bls` via dashcore-lib; dead code in the browser).
2. **`Buffer` ProvidePlugin** (next.config.js) required by `@dashevo/dashcore-lib`
   (`lib/core-chain.ts`, L1 support).
3. **`lib/network.ts`** is the shared `getNetwork()`/`getContractId()` source (SSR-guarded
   `typeof window`). All service singletons must be constructed with
   `getContractId(get())` — an `undefined` contract ID silently breaks every query.
   `lib/dash-platform.ts` is dead code.
4. **`public/_headers`** carries the CSP/COOP/COEP policy (static export cannot set headers
   in next.config). COOP/COEP `require-corp` is REQUIRED for future SharedArrayBuffer /
   wasm-threads use; `worker-src 'self' blob:` permits Web Workers.
5. **Route handlers** under `app/.well-*` need `export const dynamic = 'force-static'`
   (Next 15+ enforces under output:export).
6. **react-hooks v6 compiler rules are disabled** in `eslint.config.mjs`
   (set-state-in-effect, preserve-manual-memoization, purity, immutability) — ~22
   pre-existing patterns; re-enabling needs a dedicated cleanup pass.
   `lib/dash-wasm/**` is lint-excluded.
7. **WASM SDK 4.1.1** (`lib/dash-wasm/`): embeds NO DAPI addresses — runtime discovery via
   `WasmTrustedContext.prefetchTestnet()/prefetchMainnet()` +
   `WasmSdkBuilder.{testnet,mainnet}().withTrustedContext(ctx)`.
   `lib/dash-wasm/compat.ts` re-exports + old-name wrappers; 19 consumers import
   `dash-wasm/compat`. Node tests must use `initSync({module: bytes})`
   (`fetch(file://)` unsupported). Old build was v2-era with 8 dead hardcoded testnet
   addresses — that was the F22 login hang.
8. **WASM SDK is read-only for shielded ops** — no prover, no Orchard key derivation in
   `wasm_sdk_bg.wasm` (verified). Shield/spend flows need the external prover service.
9. **Self-custodial asset locks (Dash Core v23 format)**: one OP_RETURN (script `6a00`) at
   vout 0 carrying the locked value + P2PKH credit output(s) in the payload summing to the
   same; `ChainAssetLockProof` must reference vout **0** (the OP_RETURN), never the credit
   output. Locking X burns X + places X in a credit output (~2X on-chain cost).
   `PrivateKey.toString()` returns hex — use `.toWID()` with explicit network. Relay fee
   min 1000 sats/kB; insight rejects >20000.
10. **`coreFeePerByte` must be an integer** in raw wasm bindings (float 1.2 throws).
11. Transitive deps shipping in the client bundle: `elliptic` (1 chunk, pinned 6.6.1 via
    pnm-workspace.yaml), `lodash` (2 chunks, pinned 4.18.1). `crypto-js`/`secure-ls`
    remain tree-shaken (0 chunks).
12. Identity keys: `m/9/{net 5|1}/5/0/0/{idx}/{n}` — n=1 auth-critical (DPNS), n=3
    transfer (CRITICAL). Transfer/withdrawal signer = IdentitySigner with transfer WIF.

## Completed work log (full detail in git history of this file)

- Tasks 1-8 (2026-10-02, commits `3a1de66`, `e10e58c`): tsc fixes (ProfileService export),
  test mock fixes, pnpm build-scripts allowlist, lint fixes, test suite expansion
  (5 files / 62 tests), `.app/*` -> real routes, SSR window guard, wallet-manager SDK audit.
- Follow-ups A/B/C + #2/#4 (2026-10-02): `public/_headers` policy move, unused imports,
  exhaustive-deps triage, dependency audit (106 -> 95), Next 14.2.35.
- Session (2026-10-03): all 8 exhaustive-deps warnings resolved; contract-ID fix via
  `lib/network.ts`; biometric-settings structure repair (still not rendered anywhere);
  Next 15.5.27 + React 19.3.0.
- **F22** (2026-10-03, commit `5c056cb`): login hang fixed — replaced vendored Sep-2025
  wasm SDK (8 dead hardcoded testnet DAPI addresses) with `@dashevo/wasm-sdk@4.1.1` +
  `compat.ts`; Next 16.3.8 + ESLint 9 flat config + `--webpack` scripts + Playwright
  serves `./out`.
- **F24** (2026-10-03, commit `6297b7f`): self-custodial asset locks — removed ALL
  `/v1/registrar/*` server calls; new `lib/core-chain.ts` (BIP44 funding keys
  `m/44/5/0/0/N`, insight UTXO queries, v23 asset-lock build/sign/broadcast, confirmation
  polling); rewrote `lib/registrar-manager.ts` + `registrar-modal.tsx` (user's own
  funding address + QR + deposit polling); removed server-order resume from
  `app/connect/page.tsx`; elliptic pinned 6.6.1. Live-verified end-to-end on testnet:
  identity `8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy` (39.85B credits, 5 keys),
  username `ev0nextse1fcust0dy.dash`.
- **F25** (2026-10-04, commit `6381391`): unshield live-verified + integrated —
  `identityCreditWithdrawal` 1B credits -> 0.01 DASH UTXO at the funding address in
  minutes (withdrawal doc `GjHevt7mS5gEpwuLSBsXYQyxyA1PLyJHJCp4c8fqwTix` in the system
  contract, status 2 -> 3, Core tx `8ae97854...` mined at block 1565942);
  `withdrawToCore()` in wallet-manager + "Withdraw to Dash (L1)" card in send.tsx.
  Balance anomaly: -20.33B credits between identity creation and withdrawal (identity
  nonce=1, DPNS nonce=2 — no third party moved funds); fee breakdown UNVERIFIED.
  Spend-proof handoff issued: `docs/handoff-wasm-prover-spend-proofs.md`; prover team
  replied: `wasm-prover/docs/reply-evonext-spend-proofs.md` — all their citations verified.
- **F28a — ALL packages upgraded to latest across every dist-tag + pipeline restored;
  shielded-crypto KAT resolved to 114/114 (2026-11-10/11)**:
  (a) **Package sweep**: newest version across ALL dist-tags including dev/pre-release.
  Notables: next 16.3.8 -> 16.5.0-canary.47 (eslint-config-next matched), tailwindcss
  3.3.0 -> 4.3.5 (postcss.config.js now uses '@tailwindcss/postcss'; globals.css uses
  `@import 'tailwindcss';` + `@config '../tailwind.config.js';` to keep the JS theme),
  eslint 10.14.0, framer-motion 14.12.0, zustand 5.1.0, tailwind-merge 3.7.0, uuid 14.0.3,
  date-fns 4.4.0, dash-platform-sdk 1.6.1, pshenmic-dpp 2.0.1-dev.6, @types/node 26.6.6,
  jsdom 31.0.0, msw 3.0.5, vitest 5.1.0, @playwright/test + playwright
  1.66.0-alpha-2026-11-11, lucide-react 1.72.0, moment 2.31.0.
  (b) **Two forced pins**: @dicebear/core stays on 9.4.3 (must match @dicebear/collection
  9.4.2 — v10/v11 removed createAvatar and their Style types are incompatible with
  lib/avatar-dicebear.ts) and typescript stays on 5.9.3, the newest 5.x (typescript-eslint
  hard-blocks TS >= 7.0, issue #10940 — eslint-config-next threw from dis/index.js).
  TS 7.1.0-dev also removed tsconfig `baseUrl` (TS5102); the `@/*` paths mapping stays.
  (c) **dash-platform-sdk 1.6.1 signature change**: wallet-manager.ts documents.create now
  takes a 5th arg identityContractNonce (hoisted `const identityContractNonce = BigInt(1)`
  passed positionally; still reused by createStateTransition; the whole function remains a
  TODO stub — no real contract/type/data yet).
  (d) **Shielded KAT root cause — JSON float64 corruption of u64 vectors**: the two failing
  cmx assertions (keys-vector[0] 4502e339… and notes-vector[0] a5706f3d…) were NOT library
  bugs. Rust ground truth (evorunner crate ~/orchard-kat against the fork's own types)
  proved every intermediate correct: g_d/pk_d (byte-exact), psi/rcm/esk (LE-mod from the
  fork's spec.rs from_uniform_bytes — NO input reversal), value bit widths (g_d/pk_d 256,
  v 64, rho/psi 255 — total 1086 bits). The true defect: test/fixtures/shielded-vectors.json
  stored note values as JSON NUMBERS — notes[].v = 8567075990963576717 and keys[].note_v =
  15643327852135767324 both exceed Number.MAX_SAFE_INTEGER, so JS JSON.parse rounded them
  (…6832 / …8064) and BigInt(corrupted) produced a wrong v -> wrong cmx. FIX: the fixture
  now stores both u64 fields as decimal STRINGS; the test's existing `BigInt(v.v)` /
  `BigInt(v.note_v)` calls work unchanged. GOTCHA for any future fixture with u64/u128:
  always emit decimal strings, never JSON numbers.
  (e) Probe-harness lesson: an earlier intermediate dump probe added a bogus `.reverse()`
  before from_uniform_bytes, printing psi/rcm as the BE-reduction — that corrupted the
  'ground truth' and sent the hunt down a wrong branch; trust only probes whose final
  public API output matches a known-good reference (the fork's Note::commitment x-coord
  a5706f3d…).
  (f) Rust probe working notes: fork rev dashpay/orchard tag dashified-0.14.1 = commit
  38ac9c19 (crate 0.14.0). API names that differ from upstream Zcash: RandomSeed (was
  Rseed) with from_bytes([u8;32], &Rho) validating esk; Note::from_parts(Address,
  NoteValue, Rho, RandomSeed); IncomingViewingKey::from_bytes(&[u8;64]) is ONE-arg
  (dk || ivk LE); PreparedIncomingViewingKey has no payment_address() (use
  IncomingViewingKey::address(Diversifier)); Diversifier::from_bytes([u8;11]) (tuple ctor
  private); Address::to_raw_address_bytes() = d(11)||pk_d(32).
  (g) Build/test context: builds run on evorunner (never the host — see the hard rule
  below); `export PATH=$HOME/.cargo/bin:$PATH` required there. Verified after the fix:
  tsc 0, eslint 0 errors / 1 known postsState warning, **114/114 tests (8 files)**, build
  35/35 static pages.

## Key external references

- Prover service: `https://prover.sansbank.dev` (Cloudflare Worker, DAO-wide; currently
  only `POST /prove/shield` for `shield_from_asset_lock`; consensus-verified).
- DAPI read proxy: `https://dapi.sansbank.dev/v1/dapi` (POST `{method,params,network}` ->
  `{success,result}`; clustered JS-SDK worker pool, cached). Served methods incl.
  identity_fetch / get_identity_balance / get_documents / get_status. Testnet backend
  upgraded 2026-10-20 to Core v24 + Platform v5.0.0-rc.5 (protocol v14); mainnet untouched.
  NOTE: the proxy's get_documents path enforces STRICTER grpc index validation than the
  WASM SDK — it REJECTS the `$createdAt > 0` range clauses the Yappr feed relies on
  (returns 'where clause on non indexed property'), so document queries stay on the WASM
  SDK. `lib/dapi-proxy.ts` uses the proxy ONLY for identity reads (its cache wins there),
  with the WASM SDK as automatic fallback. Handoff: `dev-dapi-proxy/docs/HANDOFF-testnet-v24-platform-v5.md`.
- Shielded sync reference (port target for web): `platform/packages/rs-platform-wallet/src/
  wallet/shielded/` — `keys.rs` (ZIP-32 `m/32/coin_type/account`, coin types 5 mainnet /
  1 testnet, `SpendingKey::from_zip32_seed`), `coordinator.rs` (fetch + trial-decrypt +
  tree-append), `file_store.rs` (`ClientPersistentCommitmentTree` from
  `grovedb_commitment_tree` over SQLite), `note_selection.rs`, `operations.rs`,
  `prover.rs`. Mobile's `platform-wallet-ffi` builds from this crate.
- Sighash extra_data (`rs-dpp/src/shielded/sighash.rs` — the local platform
  checkout 2811ac3bf6 PREDATES the v14 binding; authoritative source = GitHub tag
  `v5.0.0-rc.8` copy of that file): transfer = empty; **shield / outputs-only =
  `bundle_tag(1) || owner(32)` at protocol v14** (`credit_pool_bundle_binding =
  Some(0)`: ShieldFromAssetLock `0x86 || assetLockProof.createIdentityId()`;
  ShieldFromIdentity `0x85 || identity_id`; Shield `0x84 || sha256(concat of the
  21-byte input addresses in BTreeMap key order)`); withdrawal =
  `output_script || amount(u64 LE) || coreFee(u32 LE) || pooling(u8)`; unshield =
  `output_address || amount(u64 LE)`. Sighash = SHA-256("DashPlatformSighash" || commitment
  || extra_data). Orchard fork `builder.rs:1105/1154/1217`: `prepare -> sign -> finalize`
  split exists (client-signing flow possible; `finalize` emits the binding signature).
- Fees for shielded spends are consensus-computed, NOT request parameters (builders return
  `(StateTransition, Credits)`); client must not invent a fee field.
- Insight APIs (CORS *): `https://insight.dash.org/insight-api` (mainnet),
  `https://insight.testnet.networks.dash.org/insight-api` (testnet). Faucets:
  `https://faucet.testnet.networks.dash.org` (3/hr, Cap captcha) and
  **`https://faucet.thepasta.org` (the 'yappr testnet faucet', user-verified
  2026-11-11)** — GET `/api/status` returns {balance, coreFaucetAmount: 1
  (DASH/req), rateLimits: {soft: 3, turnstile: 10, hard: 25},
  capEndpoint `/cap/v1/`, hardCapEndpoint `/cap/hard/`, turnstileSiteKey
  0x4AAAAAAEc7OCY_Mbh19FLS, network testnet}; the request endpoint is POST
  `/api/core-faucet` (JSON body incl. deposit address + CAP/turnstile token —
  client implementation lives in the Dash Core→Platform Bridge app bundle at
  `https://bridge.thepasta.org` whose testnet network config sets
  faucetBaseUrl to this host; the front `https://faucet.yappr.io` currently
  301s to `faucet.yipyapyop.net` which is NXDOMAIN — use thepasta.org
  directly).
- System withdrawals contract: `4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6` (doc type
  `withdrawal`; status 2 = signed, 3 = complete). EvoNext contracts: testnet
  `465jdPpFCZefhb4g2k2FpCcrKpPYhJJskDqbGFsKu6wb`, mainnet
  `6fBkKSne1xQ5GCPW9fdwEkH7nk8oYPu48vYiYssWzhX8` (`lib/constants.ts`).

## Active work

0. **F28b — shielded Milestones 1–4 COMPLETE (2026-11-10, commit `1520d90`)**:
   PCZT v1 wire port (`lib/shielded/pczt-wire.ts`, round-trip KAT on a real
   1154-byte 2-action fixture from wasm-prover), incremental note-commitment
   tree (`lib/shielded/tree.ts`, 8/8 KATs vs the fork's own
   `commitment_tree.json`), sync engine with Platform-anchor verification
   (`lib/shielded/sync.ts`, 7 tests, real-crypto encryptor), RedDSA sign /
   verify / randomize (`lib/shielded/reddsa.ts`, 6 Rust-generated KATs),
   ZIP-244 bundle digest + `compute_platform_sighash` + rs-dpp v0 extra-data
   builders (`lib/shielded/bundle.ts`, golden-vector KAT
   `4129796966e9...b21b7f7e` from `bundle/commitments.rs`), Poseidon
   P128Pow5T3 (`lib/shielded/poseidon.ts` + generated
   `poseidon-constants.ts`, 4 crate permute KATs), and `deriveNullifier`
   in `lib/shielded/note.ts` (3 KATs generated on the pinned fork via
   `Note::nullifier`). **The full prover wire loop is LIVE-VERIFIED**: POST
   of the 2-action fixture to `https://prover.sansbank.dev/prove/pczt`
   returned HTTP 200 with a JSON-hex envelope whose frame parses with our
   TS parser (2 actions, valueSum 40000, proof 7264 bytes, valid anchor;
   cold proving-key build ~63 s in the worker). 167/167 tests, tsc 0,
   eslint 0 errors (1 known postsState warning). The FRESH-SESSION plan
   for end-to-end SHIELD / TRANSFER / UNSHIELD is
   `docs/HANDOFF-shielded-e2e.md` (execution started 2026-11-11 — see F29).
   **F29c — the full PCZT build+prove loop is LIVE-VERIFIED with OUR OWN
   frames**: `lib/shielded/prove.ts` builds a complete output-only PCZT
   locally (dummy spend halves per the fork's Note::dummy / MerklePath::dummy
   / Nullifier::dummy — rho = extract_p of a random point, random sk -> fvk
   -> address, random position + 32 uniform-base path nodes, has_matching_-
   anchor = true for value-ZERO spends so anchor = Anchor::empty_tree();
   output rho = the spend half's wire nullifier; per-action cv_net =
   V*(spend - output) + R*rcv; sighash = ZIP-244 digest ->
   computePlatformSighash + the v14 33-byte extra data; EVERY spend half
   signed with its own ask incl. dummy_asks over the sighash; bsk = Σ rcv),
   `postPcztFrame` POSTs the raw wire frame (application/octet-stream — the
   HANDOFF's "no JSON wrapper" is literal: the wire parser reads the BODY as
   a frame) and verifies the response frame is byte-identical except the
   zkproof trailer. Live round-trip (/tmp/prove-roundtrip.mjs): 2-action
   output-only frame (1 real self-send of 1_000_000 credits + 1 filler
   dummy) = 3,673 wire bytes -> HTTP 200 with a 7,264-byte proof (the EXACT
   size of the prover team's own 2-action fixture — fixed-size halo2 proofs
   per action count) in 47.5 s (pkWasCached = false, fresh isolate). The
   prover's strict builders recomputed every cv/cmx/nf/psi/esk from our
   fields and the proof's circuits enforce every public-input relation —
   the strongest possible pre-broadcast verification of the whole
   encrypt/value/keys/sighash/wire stack. Binding signature (signBinding,
   bvk = [bsk]binding_G, RedDSA^{Orchard-binding}(bsk, sighash)) verifies
   locally. 199/199 tests (18 files; vitest testTimeout raised 30s -> 60s —
   the heavyweight pure-TS crypto suites breached 30s under parallel load),
   tsc 0, eslint 0. NETWORK FACTS (verified live
   2026-11-11): BOTH networks run protocol v14 — testnet = Platform
   5.0.0-rc.8 (== vendored SDK, version-matched), MAINNET = Platform 5.0.3
   (dapi+drive, tenderdash 1.8.2) since the epoch 87->88 boundary
   2026-11-08 21:53:16 UTC (verified via the pshenmic platform-explorer
   JSON API — network evo1, indexer synced 100%, epoch 88, protocol
   current 14 — AND via the vendored rc.8 WASM SDK on mainnet:
   getShieldedPoolState = 819781434098910 credits, 27 anchors, notes'
   encryptedNote exactly 216 B). **Shielded IS LIVE ON MAINNET** — the
   2026-11-10 'mainnet v13 / blocked' claim came from the
   dapi.sansbank.dev proxy's STALE mainnet backend (get_status reports
   software 4.2.0-dev.11, protocol current 13, epoch 87, time.block frozen
   at 2026-11-08 21:50 UTC ~65 h behind its own fresh time.local;
   node/chain/network/stateSync null). Mainnet proxy-first identity reads
   (lib/dapi-proxy.ts) served stale data until the proxy backend was
   upgraded — RESOLVED same-day (2026-11-11, deployed 17:04Z): the DAPI team
   upgraded the mainnet backend to drive/dapi 5.0.3 + tenderdash 1.8.2 +
   dashd 24.0.0 (live-re-verified by us: get_status 5.0.3 / protocol
   14/14/14 / epoch 88 / ~33 s block lag), shipped six shielded read
   methods on the proxy live on BOTH networks (get_shielded_pool_state /
   get_shielded_anchors / get_shielded_most_recent_anchor /
   get_shielded_notes_count / get_shielded_encrypted_notes /
   get_shielded_nullifiers — {data,dataB64} field wrappers, string
   balances, startIndex as string-or-number; live-verified by us), and
   added a /health/deep freshness guard (503 when time.block lags >30 min;
   verified: mainnet freshness 'ok', blockLagMs 47463). Follow-up doc:
   dev-dapi-proxy commit 257aaec
   (docs/HANDOFF-mainnet-backend-upgrade-v5-deployed.md — their repo purges
   resolved handoffs, read it from git history); they also noted
   dash-platform-sdk@1.6.1 ships a ShieldedController (our pinned 1.5.3
   lacks it). THEIR OPEN ASK OF US — migrate lib/shielded/ sync reads to
   the six proxy methods — DONE same-day (F29 below): proxy is now the
   PRIMARY gateway with per-call WASM fallback
   (lib/dapi-proxy.ts makeProxyFirstShieldedSource).
   Writes: testnet FIRST (version-matched),
   then mainnet (user-funded, approved 2026-11-11).
   **F29d — v1 ShieldFromAssetLockTransition runtime-mapped + assembly
   module built (2026-11-11)**: the whole transition surface was verified
   by DRIVING the vendored wasm-sdk in Node (not just reading rc.8
   rs-dpp — sparse clone at /tmp/platform-rc8, branch v5.0.0-rc.8).
   Facts: (a) v1 struct {assetLockProof, actions[], valueBalance: u64,
   anchor, proof, bindingSignature, surplusOutput: Option<PlatformAddress>,
   signature}; v0 is REFUSED from protocol v14 (version.rs). (b) The
   StateTransition umbrella enum is Encode/PlatformSerialize-derived
   (state_transition/mod.rs:547); ShieldFromAssetLock = index 18 =
   0x12. (c) Wire framing (runtime-dumped for a dummy fixture): 0x12 ||
   0x01 (V1) || bincode config::standard().with_big_endian() fields
   (rs-platform-serialization enc/mod.rs:71-74 — varint: <=250 single
   byte, 0xfb u16 BE, 0xfc u32 BE, 0xfd u64 BE). AssetLockProof Chain
   variant = 0x01, height = varint, OutPoint = 0x20 || txid(32 raw) ||
   vout u32 varint. getSignableBytes() = all-except-signature (empty
   signature = trailing 0x00 len prefix). (d) SerializedAction.
   encrypted_note = epk(32) || enc_ciphertext(104) || out_ciphertext(80)
   = 216 B (rs-dpp shielded/mod.rs:252 + builder/mod.rs:134
   serialize_authorized_bundle — matches the DAPI-served note size).
   (e) value_balance = -bundle.value_sum as a POSITIVE u64 magnitude
   (build_bound_bundle, builder/shield_from_asset_lock.rs:152) — pass
   frame.valueSumMagnitude, never the signed sum. (f) Signing =
   stateTransition.signByPrivateKey(privateKey, keyId?, keyType?):
   SHA-256d(getSignableBytes()), 65-byte [v=27+4+recid | r | s] low-S
   recoverable ECDSA, RETURN VALUE = THE SIGNED WIRE BYTES (mutates the
   signature in place); keyId/keyType IGNORED for this transition type
   (runtime-verified identical output for 0/ECDSA_SECP256K1 vs null).
   (g) AssetLockProof.createIdentityId() = SHA-256d(outPoint36) —
   runtime-verified == ChainAssetLockProof::create_identifier — this is
   the 32-byte identifier for the 0x86 extra-sighash builder AND the
   transition's unique identifier (v1 state_transition_like.rs). (h)
   broadcast = sdk.broadcastStateTransition(stateTransition) (re-parsed
   via StateTransition.fromBytes(signedBytes)); WasmSdkBuilder
   .withTrustedContext CONSUMES the builder (use its return). NEW
   lib/shielded/assemble.ts: assembleShieldFromAssetLock({assetLockProof,
   assetLockPrivateKey, build, provedFrame, surplusOutput?, platform-
   Version?, rand?}) — re-validates the proved frame against the local
   build (byte equality with zkproof:null), guards valueSumIsNegative,
   maps frame halves -> SerializedOrchardAction instances, computes the
   RedDSA binding sig (signBinding, bvk = [bsk]binding_G), constructs the
   wasm transition, signs, re-parses; returns {stateTransition,
   wireBytes, bindingSignature}. BUG FOUND + FIXED in prove.ts by the
   assembly KAT: fork MIN_ACTIONS parity was missing — builder.rs:94
   pads a non-empty transactional bundle to max(requested, 2) actions
   with AUTOMATIC dummies (rs-dpp relies on this: build_output_only_bundle
   passes dummy_outputs=0 and still gets 2 on-wire actions; consensus
   prices the shielded fee from the on-wire action count vs a wallet
   reservation of exactly 2 — a 1-action shield would be rejected).
   prove.ts now appends dummies to >= 2. GOTCHA (noble 2.x):
   secp256k1.verify DEFAULTS prehash:true (hashes the input again) —
   pass {prehash:false} for a 32-byte digest (bit the first assemble
   test iteration). test/unit/lib/shielded-assemble.test.mts (4 tests,
   REAL vendored wasm via initSync — same pattern as compat-derive):
   full field-by-field wire decode with a big-endian varint walker,
   ECDSA verify + recovery-id->pub match, binding-sig verify, 3
   rejection guards. 203/203 tests (19 files), tsc 0, eslint 0 errors
   (1 known postsState warning). REMAINING for the live shield: the
   funding-side UX (core-chain asset lock + wait for Platform's
   core-chain-locked height — the F27i flow) feeding assemble() ->
   broadcastStateTransition on TESTNET first.
1. **Q4 spike DONE** (2026-10-04): report at `docs/spike-q4-shielded-tree-witness.md`.
   Key findings: all tree inputs are served by DAPI in authenticated form (notes in tree
   order with cmx + nullifier + cvNet + encryptedNote; per-note nullifier is served for
   rho derivation during trial decryption; anchors list + most-recent anchor; nullifier
   status). Chunk alignment: start_index must be a multiple of 2048. Testnet tree =
   4,693 notes (pool balance 75.7T credits). Gaps in wasm 4.1.1: `total_count` dropped
   by the binding; no MerklePath/tree types exported. Algorithm to port: fetch notes
   (2048-note pages) -> trial-decrypt with IVK -> append cmx to
   ClientPersistentCommitmentTree -> match checkpoint root against getShieldedAnchors
   (shallowest depth wins; 100 checkpoints retention). Proposed client-toolkit API in
   report section 4.
18. **F29 — proxy-PRIMARY shielded reads + SHIELD/TRANSFER/UNSHIELD
   execution started (2026-11-11)**: user directive: the DAPI proxy is the
   PRIMARY read gateway with WASM fallback, and the shielded write pipeline
   is to be executed end-to-end on testnet AND mainnet (testnet first, per
   the approved order). TRACK A (DONE + live-verified): lib/dapi-proxy.ts
   gained the six shielded wrappers (fetchShieldedEncryptedNotesViaProxy —
   startIndex sent as a STRING, rows decoded {data hex} -> Uint8Array with
   exact length checks 32/32/216/32; fetchShieldedAnchorsViaProxy;
   fetchMostRecentShieldedAnchorViaProxy (proxy null -> undefined);
   fetchShieldedNullifiersViaProxy (inputs sent as 64-char hex, isSpent
   boolean); fetchShieldedPoolStateViaProxy + fetchShieldedNotesCountViaProxy
   (decimal STRING -> bigint, null -> undefined)) and
   makeProxyFirstShieldedSource(network, wasmSource) returning a
   ShieldedSyncSource that is proxy-FIRST with per-call WASM fallback.
   New test/unit/lib/dapi-proxy-shielded.test.mts (10 tests: request shape,
   decoding, malformed -> fallback, per-call independence). Live-verified
   through the esbuild-bundled REAL code against dapi.sansbank.dev on BOTH
   networks: testnet pool 85,092,626,948,858 credits / 6,667 notes / 2
   anchors; mainnet pool 809,521,943,371,910 credits (matches the DAPI
   team's deploy-time number exactly) / 5,194 notes / 34 anchors; the
   most-recent anchor IS a member of the recorded anchor set on both
   networks (list is not newest-first ordered); simulated outage falls back
   to WASM; zero unexpected fallbacks. NOTE ShieldedSync still has NO
   production call site (tests only) — wiring it into the UI is part of the
   write-pipeline work. Verified: tsc 0, eslint 0/1, 177/177 (15 files).
   TRACK B (in progress): the handoff Steps 1-7 (cv_net, ock, prove.ts,
   signatures incl. the v14 tag||owner extra_data, broadcast via
   broadcastStateTransition, SHIELD/UNSHIELD specifics, live verification).
2. **F26c — login `.length` crash FIXED (2026-10-04)**: after the F26b deployment,
   connect threw `Cannot read properties of undefined (reading 'length')`. Root cause
   (Node-reproduced): the 4.1.1 `deriveKeyFromSeedWithPath` returns a `PathDerived
   KeyInfo` CLASS with camelCase getters, but `compat.ts`'s
   `derive_key_from_seed_with_path` returned it raw; consumers read the old snake_case
   plain fields (`masterKey.public_key` -> undefined -> `hexToBin(undefined)` ->
   `.length` crash). Fix: the compat wrapper now maps 1:1 to the old shape
   (`public_key`/`private_key_hex`/`private_key_wif`/`address`/`network`/`path`).
   Verified live in Node: full hash160 search path works (identity found, 5 keys with
   the exact JSON shape the app expects — purpose/securityLevel as NUMBERS, data
   base64, direct `.publicKeys` access works); secp256k1 path returns undefined and
   the existing guard handles it. New unit test
   `test/unit/lib/compat-derive.test.mts` (overrides the global setup mock with
   importOriginal + initSync of the real wasm). Also flake-fixed post-service test's
   200ms `vi.waitFor` -> 1000ms. Verified: tsc 0, eslint clean, 6 files/63 tests.
3. **F26d — second wave of class-vs-plain-shape gaps in identity lookup FIXED
   (2026-10-04)**: after F26c deployed, connect progressed further but hit two more
   4.1.1 class-instance gaps in `searchByHash160`: `result[0].id` returned an
   `Identifier` object (not string) and the publicKeys items' getters returned enum
   STRINGS ("AUTHENTICATION"/"MASTER"), so the connect page's
   `purpose === 0 && securityLevel === 1||2` find failed (signingPublicKey undefined).
   Fix: `searchByHash160` now normalizes via `.toJSON()` (the same pattern
   `searchBySecp256k1` and `identityService.getIdentity` already use), restoring the
   old plain shape (string id, numeric purpose/securityLevel). Verified in Node:
   full connect flow — string identityId, signingPublicKey id=1 found, private key
   matched, WIF derived. tsc 0, eslint clean, 63/63 tests.
4. **F26e — document creation failures FIXED + full lifecycle LIVE-VERIFIED
   (2026-10-04)**: profile creation failed with `Unknown error` (masked wasm error).
   Two root causes, both Node-reproduced:
   (a) **signing-key mismatch**: the connect flow stores the CRITICAL auth key's WIF
   (key id 1) but `getSigningKey` picked the first AUTH key (id 0, MASTER) —
   document transitions require CRITICAL|HIGH: exact error `Invalid public key
   security level MASTER. The state transition requires one of CRITICAL | HIGH`.
   Fix: `getSigningKey(identity, privateKey)` now matches by key material —
   `PrivateKeyWASM.fromWIF(wif).getPublicKeyHash()` vs the identity key's `data`
   (hex hash160 for type 2; hex compressed key for type 0 via getPublicKey().bytes()),
   with the old heuristic as fallback. Applied to create/update/delete.
   (b) **opaque errors**: wasm errors carry `.message` but are not `Error` instances;
   the catch blocks now extract `(error as any)?.message || 'Unknown error'`.
   (c) **flat document shape**: `transformDocument` read `doc.data.revision` (crash —
   4.1.1 docs are flat with `$revision`) and `doc.id` (undefined — it's `$id`);
   fixed to `$revision ?? data.revision` and `$id || id`; `$revision` added to
   `ProfileDocument`. (Avatar path unreachable — contract has no avatar type.)
   LIVE-VERIFIED on testnet with the app's exact post-fix logic: create → replace
   (rev 1→2) → delete all succeeded for the test identity; test artifacts cleaned up.
   Note: identity key `.data` is HEX on the class getter but base64 in `.toJSON()`.
   vitest.config.ts: hookTimeout 60s / testTimeout 30s (post-service beforeAll
   imports the wasm-backed ProfileService and flaked at the 10s default under
   parallel load; 2 consecutive full runs green).
5. **F26f — profile EDIT was a no-op; fixed + update path LIVE-VERIFIED
   (2026-10-05)**: the user reported no profile tx appeared; root causes found
   in `/profile` and the services:
   (a) `app/profile/page.tsx` `handleSaveProfile` was a STUB — showed a
   success toast and never sent a transition. The page also never fetched the
   on-chain profile (edit form always started blank, header showed the
   identity-id prefix). Fixed: fetch profile via ProfileService.getProfile on
   mount; real save via updateProfile with validation (displayName required,
   website must match contract pattern ^https?://.+); Save button shows
   "Saving..." + disabled while submitting; DPNS @username shown when known.
   (b) `updateDocument` does a FULL REPLACE — `updateProfile` built `data`
   from only the changed fields, which would silently DROP location/website/
   bannerId. Fixed: fetch the raw document (get_documents + toJSON, strip
   `$`-prefixed keys), merge updates over it. `createProfile` also dropped
   location/website (create page collected them but never passed them) —
   signature now `(ownerId, displayName, bio?, location?, website?,
   avatarData?)`; create page passes them. `IUser` gained `location?`/
   `website?`; `transformDocument` maps them (contract profile schema:
   displayName/avatarId/bannerId/bio/location/website — verified on-chain).
   LIVE-VERIFIED on testnet: create (4 fields) -> merged replace -> all fields
   survived, rev 1->2, edits applied; probe cleaned up. tsc 0, eslint 0, 63/63.
   NOTE: user's profile `H7qSEi8h...` (BetaTesterExtraordinaire, rev 1) is
   intact from ~26 days ago; their failed creates never landed. The
   `secure-storage.ts` beforeunload/pagehide handler clears stored keys on
   every page unload — suspected cause of the reported "disconnect on Edit"
   (unconfirmed; not reproduced).
6. **F26g — getSigningKey material match was DEAD on the raw class; FIXED
   (2026-10-05)**: user's profile edit failed with `Invalid public key security
   level MASTER`. Root cause: the F26e match required `k.type === 2`, but the
   raw IdentityPublicKey class exposes `keyType` ("ECDSA_HASH160") /
   `keyTypeNumber` — `k.type` is UNDEFINED, so the match never fired and the
   fallback picked the first AUTH key = MASTER (id 0). (The F26e Node
   verification matched on `.data` only, which masked the dead condition.)
   Fix: type predicate accepts keyType string / keyTypeNumber / numeric type;
   `data` compared as hex AND base64 (class getter is hex, toJSON is base64);
   fallback now prefers AUTH keys with CRITICAL|HIGH (MASTER is rejected for
   documents anyway) and warns instead of failing silently. Verified against
   the user's real identity keys (old condition matches nothing, old fallback
   = MASTER id 0 — exactly the reported error) and end-to-end with a real WIF:
   matched id 1 CRITICAL, create succeeded, probe cleaned up. tsc 0, eslint 0,
   63/63.
7. **F26h — empty website/location strings violate the contract schema; FIXED
   (2026-10-05)**: after F26g the user's edit failed with `JsonSchemaError:
   "" does not match "^https?://.+\$", path: /website`. The profile form sends
   `website: ''`/`location: ''`; JSON Schema validates empty strings against
   patterns, so "" must be OMITTED from the document, not sent. updateProfile
   now deletes empty location/website from the payload (set-when-truthy,
   delete-when-falsy, plus defensive cleanup after the raw merge).
   Live-verified all three cases on testnet: create with both fields ->
   clearing (document left with bio+displayName only) -> setting website
   again; probe cleaned up. tsc 0, eslint 0, 63/63.
8. **F26i — every page refresh bounced to /connect (auth race); FIXED
   (2026-10-05)**: profile edit VERIFIED WORKING on-chain by the user
   (2 successful updates, rev 1->2, displayName AlphaTesterExtraordinaire +
   location/website landed). Remaining bug: on refresh, the session restore
   (async: dynamic imports + SDK init) had not finished when `withAuth` ran
   its effect, saw `user: null`, and redirected to /connect — user's own
   console log shows `withAuth check - user: null` BEFORE the restore
   completes. Fix: `isRestoringSession` state (true until restoreSession
   settles), exposed on the AuthContext; withAuth gates its redirect on it
   and shows the spinner while restoring. tsc 0, eslint 0, 63/63.
9. **F26j — UI fixes batch (2026-10-05)**:
   (a) **"Joined" date was `new Date()`** (always showed the current month) —
   now uses the on-chain profile's $createdAt via IUser.joinedAt (user's
   profile: September 2025, per the chain).
   (b) **Profile page bottom padding** `pb-16 lg:pb-0` so the fixed mobile
   footer (h-[45px], `lg:hidden`) doesn't cover content on small screens.
   (c) **Avatar "Customize Your Avatar" dialog was clipped**: the dialog had
   `max-h-[90vh] overflow-hidden` but no explicit height, so the inner
   `flex h-full` row grew to ~4000px and was clipped with no scroll (preview
   and buttons unreachable; verified via Playwright getBoundingClientRect).
   Fix: `h-[90vh] flex flex-col` on Dialog.Content + `flex-1 min-h-0` on the
   row; controls column scrolls. Also wired handleSaveAvatar (was a stub) to
   persist the encoded avatar in localStorage
   (`evonext_avatar_<identityId>`), restore on mount, and clear on Reset —
   the active contract has NO avatar document type, so on-chain avatar
   storage is not possible yet. Verified in browser: dialog 810px, preview
   canvas renders, 32 sliders.
   (d) **Font floor raised**: Tailwind fontSize overrides xs 12->13px,
   sm 14->15px, new `text-2xs` (11px) for intentionally tiny text; button
   `sm` size text-xs -> text-sm (Edit profile button 12 -> 15px); right
   sidebar footer links moved to text-2xs.
   (e) **Right sidebar Stats were hardcoded mock data** ("2 hours ago", 7-day
   streak, 342 followers, 128 posts, 1234 likes, 12.3%). Now REAL, from the
   Yappr social contract on testnet `EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJY
   Ng63F` (post/follow/like types; indices ownerAndTime, followers,
   postOwnerLikes verified on-chain). Queries via get_documents, limit 100
   (Dash Platform per-query cap) with '+' suffix when truncated; posting
   streak computed from post $createdAt day-set; engagement = likes/posts
   (shown as em-dash when truncated). NOTE: network guard is
   `network === 'mainnet'` (NOT !== 'testnet') because NetworkProvider's
   default case sets network to the raw host string on localhost/IPFS.
   Verified live: Yappr user 9Hah95qN... = 100+ posts (last Jan 27), 2
   followers, 100+ likes; user ADtgYG2... = 1 post (Jun 25), 2 likes,
   0 followers. tsc 0, eslint 0, 63/63.
10. **F26k — tabbed stats + network stats + DiceBear avatars + profile
   buttons (2026-10-05)**:
   (a) **Stats card now tabbed**: "My Stats" (default) / "Network Stats".
   Network stats come from the Yappr contract via full pagination (the
   contract has NO countable indices and no documentsCountable, so
   getDocumentsCount is rejected by DAPI; counts are computed client-side
   by paginating orderBy $id asc + startAfter=<last $id>). Live testnet
   totals: 500 posts, 37 unique posters, 614 likes, 55 follows, 205
   replies, 0 profiles (profile type unused on Yappr). Cached in
   localStorage (evonext_network_stats_testnet) with 1h TTL; 4 doc types
   scanned in parallel (~5-8s cold).
   (b) **YAPPR_CONTRACT_ID_TESTNET updated** to the LATEST contract
   EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJYNg63F (per yap.pr/about; old
   AyWK6n... constant was stale and unused).
   (c) **Avatars migrated to DiceBear 9.2.4** matching the Yappr repo:
   new lib/avatar-dicebear.ts (28-style styleMap, cached SVG data-URI
   generation, DICEBEAR_STYLES/labels, DEFAULT_AVATAR_STYLE='thumbs',
   generateRandomSeed, encodeAvatarData = JSON {seed,style},
   parseAvatarConfig handles JSON/plain/legacy v2 -> null); AvatarCanvas
   rewritten as a DiceBear <img> renderer with props {seed, style?, size?,
   className?}; all 14 call sites updated (post-card parses author
   .avatarData via parseAvatarConfig, falls back to username seed);
   profile avatar dialog rebuilt Yappr-style (style grid + custom seed +
   randomize) replacing the 32-slider canvas UI; localStorage avatar now
   stores the Yappr JSON encoding; legacy v2: strings ignored on restore.
   @dicebear/* installed via pnpm (npm install errors in this repo).
   (d) **Share Profile button wired**: copies <origin>/profile to clipboard
   + toast (no public profile-view route exists yet).
   (e) **Account Settings button wired**: routes to /settings.
   (f) **Platform Info panel**: was displaying the old EvoNext contract
   465jd...; now shows the latest Yappr contract as 'Yappr Contract ID'
   hyperlinked to the official Dash Platform Explorer
   (testnet.platform-explorer.com/dataContract/<id> — route verified live;
   pshenmic's platform-explorer.dev hosts are a JSON API, not the UI) in a
   new tab. Mainnet falls back to the EvoNext contract on
   platform-explorer.com.
   Verified in browser via Playwright: tabs + live network numbers,
   avatar save/restore across reload, clipboard copy, /settings nav,
   correct contract link href/label/target. tsc 0, eslint 0, 63/63.
11. **F26l — Post button + post creation fixed, posting LIVE-VERIFIED
   (2026-10-05)**:
   (a) **Post button did nothing outside /posts**: ComposeModal was only
   mounted on app/posts/page.tsx; the sidebar Post button sets
   isComposeOpen in the zustand store but nothing rendered. Mounted
   ComposeModal globally in app/layout.tsx, removed the duplicate mount
   from the posts page. Playwright-verified: modal opens from /explore
   and /profile; /posts has exactly one dialog.
   (b) **Post creation failed with "[object Object]"**: root cause (Node
   reproduced) — dash-platform-client.createPost called the OLD positional
   sdk.documentCreate(contractId, type, ownerId, dataString, entropy, wif)
   which no longer exists in the 4.1.1 bindings; the actual error is
   "failed to read 'document' from options: Reflect.get called on
   non-object" (WasmSdkError is not an Error instance and retry-utils'
   new Error(String(error)) flattened it). Fixed: createPost now delegates
   to stateTransitionService.createDocument (the proven 4.1.1 path:
   Document instance + owner identity key matched to the WIF +
   IdentitySigner, same as profile creation). retry-utils and the compose
   modal now extract .message from non-Error rejections.
   (c) **LIVE-VERIFIED on testnet**: post document
   HyfFfaXmdp3hpE3nqaa5gr3FjF7tUPf3nzsmV8WohzdH (rev 1) created for
   identity 8Yj6... with the exact createDocument logic; retrievable via
   getDocuments. Post schema on 465jd: content (req, max 500), language
   (req, ^[a-z]{2}$), isSensitive (req, boolean), replyToPostId/mediaUrl/
   mentionIds (32-byte identifier byte arrays — replies MUST be bs58-
   decoded before sending), hashtag (pattern ^[a-zA-Z0-9_]{1,100}$),
   remix (string max 500). tsc 0, eslint 0, 63/63.
12. **F26m — feed display fixes (2026-10-05)**: the /posts feed showed
   "User nknown"/"@user_nknown" (transform read doc.ownerId which is
   undefined on 4.x documents — the id is $ownerId) and "Invalid Date"
   (transform produced an ISO string but PostCard renders
   new Date(post.createdAt * 1000), i.e. epoch SECONDS). Fixed: the
   transform reads $-prefixed fields with plain fallbacks and emits epoch
   seconds; "No posts yet" no longer flashes during load (useAsyncState
   gained an initialLoading param; the posts page starts loading:true and
   its setLoading(true/false) calls were re-enabled — they had been
   commented out, which also left the refresh spinner spinning forever;
   loadPosts deps now use the stable setters instead of the whole
   postsState object, which re-triggered the effect every render).
   Verified: 20 cards render, 0 Invalid Date, 0 "User nknown".
13. **F26n — ONE contract migration + WASM SDK 4.2.0-dev.11 (2026-10-05)**:
   (a) **Single contract**: per user directive everything now uses ONLY the
   official Yappr contract EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJYNg63F.
   EVONEXT_CONTRACT_ID_TESTNET points to it; the old EvoNext contracts
   (testnet 465jd..., mainnet 6fBk...) are RETIRED (mainnet constant is ''
   — no Yappr mainnet contract exists; social features unavailable there).
   All services' createDocument flows adapted to the Yappr schema: post =
   {content, language(req), sensitive(req), mediaUrl(URL string),
   quotedPostId(identifier)} — no replyToPostId/hashtag/remix fields;
   replies are a SEPARATE 'reply' type (parentId + parentOwnerId, both
   identifier fields; dashClient.createPost branches on replyToPostId and
   fetches the parent post for its owner); like = {postId, postOwnerId}
   (postOwnerId fetched from the parent post; feeds the postOwnerLikes
   index); follow = {followingId}; bookmark = {postId}; profile has
   bannerUrl (not bannerId) and NO avatar document type (createProfile no
   longer calls createAvatar — avatars are DiceBear/local).
   (b) **WASM SDK upgraded 4.1.1 -> 4.2.0-dev.11** (dist/raw files copied
   into lib/dash-wasm; backups in /tmp/backup_411_*). Reason: 4.1.1 could
   not create ANY document with identifier/byteArray fields — the JS glue
   converts property values to bigint/string arrays and Drive rejects with
   "storage: protocol: value error: structure error: not an array of
   bytes" (reproduced via documentCreate AND the manual
   DocumentCreateTransition/BatchTransition/StateTransition path, and on
   4.2.0-dev.11's manual path too). In 4.2.0-dev.11 the schema validator
   accepts base58 identifier STRINGS (DPP identifier contentMediaType), so
   all identifier fields are passed as base58 strings. 4.2 runtime diffs
   handled: Identity has .publicKeys (getPublicKeys() is declared in the
   4.2 d.ts but DOES NOT EXIST at runtime — wallet-manager uses an
   any-cast); IdentityPublicKey.keyId replaces .id; everything else
   (deriveKeyFromSeedWithPath, getIdentityByNonUniquePublicKeyHash ->
   toJSON with numeric purpose/securityLevel, getDocuments, documentCreate,
   getIdentityContractNonce, DPNS statics) verified compatible.
   (c) **LIVE-VERIFIED on testnet** on EWR695: post BL8nuehbdeqimHe7o8zjd
   DaA5v9NLA8yT6qMNc9GbMm8, reply 7JTkTiANEw167mZTYD8KuM3nbXgnZeKhx28EPZz
   JbhE3, like wds9ezmFD6anK6Sg12L3ekiXdQqJHCbyJDQoDXcbTif (retrievable via
   the postOwnerLikes index), follow DxAsHeieFnp59qcUN1ZcB9tqarAZx3kY1mTz
   nQxeuR71, bookmark EwufgUjq5aFBkFF6Q7zy6RYWWWhCNp3uoES1AaELqA1F — all
   created with the app's exact createDocument logic and queryable. Feed
   shows real Yappr posts in the browser, no page errors. Note: pre-migration
   posts/profiles on the retired 465jd contract are no longer visible.
   tsc 0, eslint 0, 63/63.
14. **F26o — feed ordered by an unindexed `$createdAt` (stale Jan 26 feed);
   FIXED (2026-10-05)**: user reported the feed showed only posts dated
   2026-01-26 while today is Oct 5. Root cause (Node-reproduced via
   `/tmp/dcl/yappr-indices.mjs`): the Yappr 'post' type has NO $createdAt-only
   index — only ownerAndTime [$ownerId,$createdAt], languageTimeline
   [language,$createdAt], quotedPostAndOwner, quotedPostOwnerAndTime. DAPI
   silently ignored the unsupported bare `orderBy: [['$createdAt','desc']]`,
   returning arbitrary/unindexed order (top = Jan 26). Our test posts existed
   with correct Oct 5 timestamps (verified in the same diagnostic) — writes
   were fine, only the read ordering was wrong. Fix, matching yap.pr's
   PostService.getTimeline/getUserPosts:
   (a) `lib/dash-platform-client.ts` `_executePostsQuery`: global feed now
   where [['language','==','en'],['$createdAt','>',0]] + orderBy
   [['language','asc'],['$createdAt','desc']] (languageTimeline index);
   author feed where [['$ownerId','==',id],['$createdAt','>',0]] + orderBy
   [['$ownerId','asc'],['$createdAt','desc']] (ownerAndTime index).
   (b) `lib/services/post-service.ts` getTimeline (languageTimeline pattern)
   and getUserPosts (ownerAndTime pattern, plus the missing $createdAt>0
   range clause). getReplies (replyToId) / getPostsByHashtag (primaryHashtag)
   still reference fields that don't exist on the Yappr 'post' type, but grep
   confirmed they are never called — left untouched.
   (c) Live-verified both index patterns in Node (top result 2026-10-05) and
   in the browser (Playwright + static server): 20 cards, newest-first 40min →
   1h → 2h → 4d → 5d, 0 Invalid Date, 0 "User nknown". Unit test updated to
   the indexed query shape. NOTE: app/posts/page.tsx:182 has a pre-existing
   intentional exhaustive-deps WARNING (postsState deliberately omitted in
   F26m to stop re-trigger loops) — expected lint state is now "0 errors,
   1 warning". tsc 0, 63/63.
15. **F26p — real interaction counts + real post detail page (2026-10-05)**:
   user reported the card counts (comments/likes/remixes) were random
   placeholders (they changed between reloads — `Math.floor(Math.random…)`
   in the posts-page transform) and the post detail screen showed a fully
   mocked post ("This is a sample post content", "User 123",
   "-1789426464573 seconds ago", fake replies).
   (a) Node-verified against DAPI first: likes/replies/quotes CAN be counted
   by querying 'like' (postId), 'reply' (parentId) and 'post'
   (quotedPostId) with base58-string where clauses + orderBy matching the
   postId-led index; byte-array where clauses FAIL on 4.2 ("where clause on
   non indexed property"); the **'in' operator WORKS**, so all counts for a
   whole feed batch come from 3 paginated queries (likeService's old
   byte-array + unindexed orderBy query was broken by F26o's discovery).
   (b) `lib/dash-platform-client.ts`: new getInteractionCounts(postIds)
   (3 batched paginated queries, per-type try/catch so one failure leaves
   counters at 0), getPostById(id) (get_document), getReplies(postId)
   ('reply' via parentAndTime, oldest first).
   (c) `app/posts/page.tsx`: random counts → 0, then getInteractionCounts
   fills them before setData.
   (d) `lib/services/like-service.ts` getPostLikes: base58-string where +
   orderBy [['postId','asc'],['$ownerId','asc']] (postAndOwner index);
   removed the bs58 byte-array conversion.
   (e) `lib/services/post-service.ts`: countReplies now queries the
   separate 'reply' type via get_documents (paginated, parentAndTime index)
   instead of the dead post.replyToId field; countRemixes counts posts with
   quotedPostId set via quotedPostAndOwner index (Yappr has NO 'remix'
   type).
   (f) `app/post/page.tsx`: removed ALL mock data — fetches the real post
   via getPostById, real counts via getInteractionCounts, real replies via
   getReplies (transformPostDoc mirrors the feed transform: $-fields,
   epoch-SECONDS createdAt, "User xxxxxx" placeholder authors); the reply
   form now really posts via dashClient.createPost(content,
   {replyToPostId}) (creates a 'reply' doc) and re-fetches replies + count
   from the chain; toast errors surface real messages.
   (g) Test updates: post-service stats tests now mock the WASM layer
   (wasm-sdk-service getWasmSdk→{}, compat get_documents→[]) since
   countReplies reads 'reply' through get_documents; IMPORTANT vitest
   gotcha found while debugging: an **async vi.waitFor callback that awaits
   a dynamic import never sees updates** — use a sync callback and
   pre-import the mocked modules in beforeEach.
   (h) Verified live in browser: feed counts stable across reloads and
   matching on-chain data (test post BL8nue… = 1 like / 1 reply); detail
   page /post#<id> shows real content, real counts (1/1), the real reply
   ("Reply test"), "3 hours ago" instead of negative seconds, no fake
   sample text. tsc 0, lint 0 errors/1 known warning, 63/63 tests.
16. **F26q — real like/unlike button + real user info on detail page
   (2026-10-05)**: user asked to wire the like and reply buttons for real
   (remixes/tips deferred) and reported the detail page showed wrong user
   info.
   (a) REPLY was already wired — the compose modal (opened by PostCard's
   reply button via the replyingTo store field) calls dashClient.
   createPost(content, {replyToPostId}), which creates a real 'reply'
   document; live-verified in the browser (reply count on the test post
   went 1→2 on-chain, then the test reply was deleted).
   (b) LIKE: `components/post/post-card.tsx` handleLike now writes to the
   chain via likeService.likePost/unlikePost with optimistic UI and
   rollback on failure; requires a logged-in identity (error toast
   otherwise); the hideAvatar "Your Posts" branch still opens LikesModal.
   Two like-service bugs fixed on the way: getLike used the broken
   byte-array where clause (fixed to base58 string + postAndOwner index
   orderBy, same as getPostLikes) and **likePost fetched the parent post
   with this.documentType (= 'like') instead of 'post', so every like
   failed with "Post not found for like"**. likedByMe initial state comes
   free from getInteractionCounts(postIds, viewerId) — the like docs
   already fetched carry $ownerId; the feed and detail transforms set
   post.liked from it.
   (c) DETAIL PAGE USER INFO: there are ZERO profile documents on the
   Yappr contract, so displayName can't come from there; author info now
   resolves via `applyAuthorProfiles` in app/post/page.tsx — profile
   displayName/avatarData when a profile exists + **DPNS username via
   dpnsService.resolveUsername** (independent contract, 1h reverse cache)
   for every author (post + replies). Main PostCard also gets
   isOwnPost={user?.identityId === post.author.id} so own posts render
   "You wrote ..." like the feed. Live-verified: reply author shows the
   real DPNS name (evonextselfcustody.dash) and own post shows "You
   wrote".
   (d) Live-verified like flow in the browser (seeded pk_<identityId>
   localStorage key with the auth-critical WIF): like → count 0→1 + red
   heart + on-chain like doc G4iRKj35fnp7CnGZNkKvSLG66bJvQy9fkEu3HS14KQd2;
   unlike → doc deleted, count 1→0; the already-liked test post renders
   red with count 1 from likedByMe. Test artifacts cleaned up on-chain
   (like doc removed, test reply removed). tsc 0, 63/63, lint 0 errors
   /1 known warning.
17. **F26r — "No posts yet" during load fixed; post header = @handle +
   identity ID (2026-10-05)**: user reported (a) the Posts page still
   showed "No posts yet" while loading, (b) the detail header duplicated
   the DPNS name ("NewMoneyHoney69.dash" + "@NewMoneyHoney69.dash"), and
   asked for @NewMoneyHoney69 with the identity ID below it.
   (a) ROOT CAUSE (browser timeline reproduced with a 400ms poller): in
   loadPosts, `setLoading(true)` was followed by `setError(null)` — and
   useAsyncState's setError implementation sets `loading: false`
   unconditionally, cancelling the loading state one state update later.
   Result: the spinner rendered for a single microtask (loading branch
   hit once in a debug log), then the empty state filled the entire load
   until data arrived. Fix: clear the error BEFORE setting loading
   (setError(null) then setLoading(true)) in app/posts/page.tsx.
   Verified: spinner shows for the whole load; "No posts yet" appears 0
   times; cards render when data lands.
   (b) PostCard user header (non-own, non-hideAvatar posts) now renders
   `@<DPNS label without .dash suffix>` at text-[15px] font-semibold,
   time after it, and the identity ID below in text-2xs gray-400 mono — no
   more duplicated name; applies to detail, feed and reply cards alike.
   (c) User's like on post FETDGwSLvVbZo33tgwJEwyGKUHaPGhvuct5154CmBAkW
   confirmed on-chain: like doc 4bCu4Qvi2YiMH4UdUbvs9jiwzEmEufsG2NwCZ9s
   AmYLf, owner ADtgYG2…xLFFB. tsc 0, 63/63, lint 0 errors/1 known
   warning.
18. **F26s — full identity ID; usernames on the Posts feed (2026-10-05)**:
   (a) PostCard now renders the FULL identity ID under the @handle
   (user asked not to abbreviate it); break-all so the 44-char ID wraps.
   (b) Feed usernames were user_xxx placeholders (profile/DPNS resolution
   only existed on the detail page). Moved that logic into a shared
   helper `resolveItemAuthors` in lib/post-helpers.ts (generic over any
   item with an {id, username, displayName, avatarData?} author; profile
   displayName/avatarData when present + dpnsService.resolveUsername,
   5-min/1-hour caches); app/post/page.tsx now imports it as
   applyAuthorProfiles (behavior unchanged), and app/posts/page.tsx runs
   it over the sorted posts before caching/setData (failure leaves
   placeholder names). Live-verified: feed and detail both show
   "@NewMoneyHoney69" with the full ID for post FETDGw…. Cost: ~2N
   parallel lookups per feed load, mostly cache hits after first run.
   tsc 0, 63/63, lint 0 errors/1 known warning.
19. **F26t — markdown rendering in post content (2026-10-05)**: user
   reported post tR8JrLh4WxriyzbdBnQFcY5zp5JGrDppAwZc3ZEBaGy showed raw
   markdown ("**Telegram channel**") and wanted URLs clickable. New
   components/ui/markdown-content.tsx — ported from yap.pr's
   components/ui/markdown-content.tsx (token-based, NO dangerously-
   SetInnerHTML, React-escaped so content can never inject HTML):
   supports **bold**, *italic*, `code`, URLs, and styles @mentions /
   #hashtags / $cashtags in accent color (NOT linked — no hashtag/username
   routes yet). Per user requirement, URLs are clickable ONLY on the
   details page: MarkdownContent takes interactiveLinks (default false =
   plain text) and PostCard takes interactive (default false); the details
   page passes interactive to the main post AND reply cards, feed cards
   leave links as plain text so a click keeps opening the post details.
   Verified in browser for the post above: details page renders both URLs
   as <a target="_blank" rel="noopener noreferrer"> and the two **bold**
   spans; feed renders bold but ZERO content anchors and no raw asterisks.
   tsc 0, 63/63, lint 0 errors/1 known warning.
20. **F26u — URLs clickable on feed cards too (2026-10-05)**: user asked
   to make links clickable from card lists while keeping card clicks
   going to the details page. Simplified the F26t design: the
   interactiveLinks/interactive props are REMOVED — MarkdownContent now
   always renders URLs as anchors with target="_blank" + rel="noopener
   noreferrer" and onClick stopPropagation, so a link click opens the
   URL in a new tab and does NOT trigger the card's details navigation;
   clicking anywhere else on the card still routes to /post#id.
   Verified in browser on the feed: t.me link is a real anchor, clicking
   it opened a popup to https://t.me/divatoz while the page stayed on
   /posts, and clicking the content area navigated to /post#tR8JrLh4….
   tsc 0, 63/63, lint 0 errors/1 known warning.
21. **F26v — About page version pulled from package.json (2026-10-05)**:
   the settings About section hardcoded "Version 25.9.4" (stale since
   F22-era). Now imports package.json directly (tsconfig already has
   resolveJsonModule) and renders `Version {packageJson.version}`;
   package.json version bumped 26.1.30 → 26.10.5. Verified in the
   browser (settings → About tab): shows "Version 26.10.5"; no 25.9.4
   anywhere in out/. tsc 0, 63/63, lint 0 errors/1 known warning.
22. **F26w — homepage stats + trending from real data (2026-10-05)**:
   app/maison.tsx (the logged-in home page) was entirely mocked: fake
   stats ("3K+ Active Users / 873 Remixes Today / 42 Mini Apps"), fake
   trending topics (#DashPlatform 1.2K posts +15%…), and fake trending
   posts (cryptodev/web3builder/defimaster with Invalid Date — mocks
   passed ISO strings where PostCard expects epoch seconds).
   (a) Extracted the right-sidebar's network-stats code into shared
   lib/network-stats.ts (NetworkStats, NETWORK_STATS_CACHE_KEY/TTL_MS,
   countAllDocuments, fetchDocs, loadNetworkStats) plus
   readCachedNetworkStats/refreshNetworkStats helpers; right-sidebar
   now imports from it (local copies deleted, behavior unchanged —
   serve cached snapshot immediately, refresh in background when
   stale/missing).
   (b) Extracted transformPostDoc (post detail page's document→PostCard
   mapper) into lib/post-helpers.ts for reuse.
   (c) maison now shows: stats = Active Users (uniquePosters) / Total
   Posts / Total Likes from the real paginated counters; trending topics
   = hashtags counted from the 20 most recent posts (no fake +% badges;
   honest empty state when none); trending posts = real recent posts
   with real counts (getInteractionCounts), real author names
   (resolveItemAuthors), sorted by likes+replies+remixes, top 3 — no
   Invalid Date. Verified in browser: "39 Active Users / 506 Total Posts
   / 624 Total Likes", real posts (@pasta, @momo, @Alex with DPNS names
   and correct dates), zero fake markers. tsc 0, 63/63, lint 0 errors/1
   known warning.
23. **F26x — liking a reply failed ("Failed to like post"); FIXED
   (2026-10-05)**: user could not like the first reply of post
   4NeHEzYg8xPbhXEgL4nXYmBwJysrQrwLNs9zE74HXMZB. Root cause
   (Node-reproduced): likeService.likePost looked up the parent with
   sdk.getDocument(contractId, 'post', postId) — for a REPLY the id
   lives in the 'reply' type, and getDocument returns undefined (not an
   error) → "Post not found for like" → likePost returned false. Fix:
   try 'post' first, fall back to 'reply'. Verified in browser: like on
   reply 3LARzvedKhDpQY3JEdTbB1NkxMJdndrzTCKpBxTkUuCr went 0→1 with
   on-chain doc 5zhPtHc8ANpDN5pNLKe3FTW4XZh3mjJoKTbBTfe6E8Ck (owner
   8Yj6Vu…), reload showed the existing like red (likedByMe works for
   replies), unlike removed it on-chain (cleanup complete). tsc 0,
   63/63, lint 0 errors/1 known warning.
24. **F26y — text fix**: "secured by Dash Platform v2 🛡️" → "secured by
   Dash Platform 🛡️" (maison hero, single occurrence).
27. **F27b — passkey (WebAuthn PRF) key vault: spike + core lib (2026-10-05)**:
   Spike `docs/spike-passkey-prf-vault.md` (reviews react-native-passkey v3.6.2
   + passkey-server-example; they informed the PRF pattern). KEY FINDINGS:
   - Existing `lib/passkey.ts` is BROKEN BY DESIGN: entropy = SHA-256(rawId ||
     authenticatorData), but a WebAuthn assertion's authenticatorData contains
     the incrementing signature counter -> non-deterministic, unrecoverable.
     Only consumer (gifts/page.tsx) logs it. Must be REPLACED.
   - `lib/biometric-storage.ts` = auth theater (authenticate() returns true
     post-credentials.get, no key derivation, no signature verification).
   - THE PRIMITIVE is the WebAuthn `prf` (hmac-secret) extension: deterministic
     32-byte secret from (credential, salt); syncs via iCloud Keychain/Google
     Password Manager; same passkey + salt -> same output cross-device. PRF is
     NOT universal (older YubiKeys lack it) -> gate on
     `clientExtensionResults.prf.enabled`; MNEMONIC STAYS AS RECOVERY.
   - NEW `lib/passkey-vault.ts` (client-only, no server; keeps static-export
     model): Option A `enrollVault`/`unlockVault` = HKDF-SHA256(PRF output,
     salt, 'evonext:pv:kek:v1') KEK -> AES-GCM-256-wrap existing identity WIF,
     record {credentialId,salt,iv,ciphertext} in localStorage `evonext_pv_v1_`
     (survives page unload, NOT device loss — localStorage doesn't sync).
     Option C `createIdentityEntropy`/`recoverIdentityEntropy` = DETERMINISTIC
     salt (SHA-256 'evonext:identity-entropy:v1:N') + HKDF info
     'evonext:pv:entropy:v1' -> 32B master entropy recoverable on ANY synced
     device with NOTHING stored; exported as BIP39 12-WORD mnemonic (16-byte
     entropy — 128 bits matches secp256k1's ~128-bit security level; 24 words
     would add zero brute-force margin, per BIP39 + Pollard-rho facts) via
     @scure/bip39@2.4.0 (added as direct dep; import must be
     '@scure/bip39/wordlists/english.js' — scure exports only *.js paths).
     rpId PINNED to 'evonext.app' (parent domain) so test.evonext.app and
     evonext.app share passkeys (WebAuthn allows registrable-suffix rpId);
     localhost/IPFS fall back to hostname. Errors: PasskeyVaultError codes
     UNSUPPORTED/PRF_UNSUPPORTED/CANCELLED/NOT_FOUND/DECRYPT_FAILED/FAILED.
     Passkeys are NEVER exportable (security property) — the mnemonic is the
     export path.
   - Integration: dash-platform-client.ts key-retrieval chain is now
     memory -> passkey vault (only when hasVault(identityId), so no spurious
     prompt) -> legacy biometric. Fixes F26 'disconnect on Edit' pain (key
     re-derivable after page unload).
   - Tests `test/unit/lib/passkey-vault.test.mts`: 12 tests. WebAuthn mocked
     with DETERMINISTIC prf (mirrors a real authenticator) so real
     HKDF/AES-GCM run unmocked; proves Option A round-trip + Option C
     cross-device entropy identity + multi-index separation. GOTCHAS: jsdom
     window.crypto lacks subtle -> polyfill via Object.defineProperty(window,
     'crypto', {value: node webcrypto}); vitest MUST import { vi } from
     'vitest' even with globals:true (tsc); Uint8Array<ArrayBufferLike> needs
     'as BufferSource' casts for TS5 webcrypto typings.
   - Verified: tsc 0, eslint 0/1, 75/75 (7 files), build 35/35.
   - **Connect-page UI WIRED (F27c, 2026-10-05)**: app/connect/page.tsx now has
     'Create with Passkey' + 'Recover with Passkey' buttons below the mnemonic
     form (hidden when isUserVerifyingPlatformAuthenticatorAvailable() is false).
     CREATE: createIdentityEntropy(0, 'evonext-identity-0') -> 12-WORD BACKUP
     GATE (numbered grid + 'I wrote it down' confirm; passkey and words are the
     SAME secret) -> handleMnemonic(words, skipCreateConfirm=true) — the
     existing flow stores the mnemonic (secure-storage) and the registrar modal
     creates the identity from it, so passkey-derived identities are
     INDISTINGUISHABLE from mnemonic identities on-chain (BIP39 entropy <->
     mnemonic is 1:1). RECOVER: recoverIdentityEntropy(0) -> same mnemonic ->
     standard hash160 lookup -> login. handleMnemonic gained optional 2nd param
     _skipCreateConfirm (default false; old callers unchanged).
     Passkey user.name/displayName = 'EvoNext Identity #1' (1-based label for
     index 0) — WebAuthn has NO credential-rename API, so these strings are
     frozen at creation and shown forever by Apple/Google password managers
     (user hit the old 'evonext-identity-0' placeholder in the Apple
     Passwords prompt on testnet.evonext.app; createIdentityEntropy gained an
     optional displayName param). Errors:
     PasskeyVaultError code CANCELLED = silent, PRF_UNSUPPORTED/UNSUPPORTED =
     'use a recovery phrase instead' toast. Verified in-browser: buttons render
     alongside Sign In; clicking Create in headless Chromium (no authenticator)
     does not crash. LIVE passkey ceremony (real Touch ID/Android) NOT yet
     tested — needs a real authenticator. Multi-identity recovery (indices >0)
     not exposed in UI yet (recover tries index 0 only).
26. **F27a — header bell as its own button + nav cleanup (2026-10-05)**:
   - Notification bell moved OUT of the Profile pill into its OWN
     header button (own bg-white/20 rounded-md, 8px left of Profile);
     verified: bellIsOwnElement, own bg + rounded border, left of
     Profile, navigates to /notifications.
   - "Identity" nav item REMOVED (duplicate of the header Profile).
   - Sidebar footer IDENTITY block click now navigates to /profile —
     restructured so the identity area is its own button (Radix's
     DropdownMenu.Trigger was swallowing the click); the dropdown menu
     is now on the ellipsis icon only. Verified: click -> /profile.
   - notifications page main width: removed the max-w-[600px] +
     mr-[350px] cap so it uses flex-1 like the profile page. Verified:
     list items fill main's full width, right sidebar directly adjacent.
   tsc 0, 63/63, lint 0 errors/1 known warning.
25. **F26z — notifications page is LIVE with real data (2026-10-05)**:
   app/notifications/page.tsx was 100% mocked (fake user123/user456
   likes/follows/replies). Replaced with real on-chain data:
   - new `lib/services/notification-service.ts`
     `fetchUserInteractions(identityId, dpnsUsername, network)`: likes /
     replies / remixes on the viewer's recent posts (via the new
     dashClient.getInteractionsForPosts — individual rows with actor +
     $createdAt), followers (queried directly on the follow type —
     followService is bound to lib/network.ts's getNetwork which returns
     the raw host on localhost/IPFS and hangs; the direct query with the
     same client+contract works), and @mentions of the viewer's DPNS
     name in the 20 most recent posts. Self-interactions excluded;
     actor names resolved via resolveItemAuthors; sorted newest-first.
   - read state: local-only cursor `evonext_notifications_read_<id>`
     (there is no on-chain "seen" marker); "Mark all as read" sets it to
     the newest notification's $createdAt and persists across reloads.
   - page: filter tabs All/Likes/Reposts/Replys/Follows/Mentions, post
     content snippets link to `/post#<id>`, actor displayName shown
     (DPNS name), AvatarCanvas seeded by avatarData when present.
   Verified in browser with the user's real identity (ADtgYG2…): 4 real
   notifications rendered (zkjays.dash liked 8/9/2026, caracal.dash
   replied x2 + liked 6/26/2026), Likes filter -> 2, Mentions -> empty
   state, Mark-all hides button + dots and persists after reload. tsc 0,
   63/63, lint 0 errors/1 known warning.
   NOTE: the sidebar nav has no Notifications entry (page is reachable
   via /notifications URL) — adding it is a separate task. Also
   followService still uses the lib/network.ts singleton pattern (works
   on the real domain; only the notification path needed the direct
   query today).

2. **F27d — registrar deposit amounts + funding UX FIXED (2026-10-06)**: the
   asset lock was ASSET_LOCK_SATOSHIS = 100_000_000 (1.0 DASH — the
   '0.1 DASH' comment was wrong), so MINIMUM_DEPOSIT demanded 2.00005 tDASH
   and the user's 1 tDASH deposit stalled registration. Now contested-aware:
   ASSET_LOCK_SATOSHIS = 3_000_000 (0.03 DASH, uncontested) +
   CONTESTED_ASSET_LOCK_SATOSHIS = 20_000_000 (0.2 DASH, contested —
   dpns_is_contested_username from the wasm SDK; NOTE: ALL usernames <20
   chars are contested, so 0.2 is the common case). Deposit required =
   locked*2 + 5_000 via new minimumDepositSatoshis() (double cost =
   OP_RETURN burn + equal P2PKH credit output, invariant #9).
   getFundingInfo(network, idx, username?) + registerIdentityAndUsername
   both pick the lock from the username. Registrar modal: QR 360->180px,
   modal h-full -> max-h-[90vh], LIVE balance display (Received X / Y DASH
   + progress bar, polled every 5s; 'Deposit detected — continuing…' when
   full) — auto-continue on full deposit already existed and is unchanged.
   Username input is disabled once the funding panel opens (the lock size
   is fixed by the submitted username). createAssetLockTransaction sends
   change back to the funding address, so a user's earlier partial deposit
   (e.g. the 1 tDASH) is reusable — same mnemonic => same funding address.
   Verified: tsc 0, eslint 0/1, 75/75, build 35/35. NOT yet browser-verified
   with a live deposit (funding panel needs a session mnemonic + real L1 tx).
3. **F27e — registration 'Waiting for confirmation' stall FIXED (2026-10-06)**:
   user got stuck after 'Deposit detected'. Root cause: TESTNET BLOCK
   PRODUCTION IS IRREGULAR — measured live via insight /blocks: gaps of
   3-80+ min between blocks (tip 1571313 was ~80 min old, then blocks
   resumed at 0.5-5 min gaps within the same hour). waitForConfirmation
   polled /tx/<txid> with NO fetch timeout (a hung insight request would
   freeze the flow forever) and gave up after 60x15s = 15 min.
   Fixes (lib/core-chain.ts): fetchWithTimeout (AbortController, 10s) on
   ALL insight calls in the wait path; 120 attempts (30 min); per-attempt
   try/catch (404 before mempool propagation / timeouts roll over);
   onAttempt callback -> UI shows 'Waiting for confirmation… (N/120)
   tx <16hex>…'; timeout error names the txid + says the deposit is SAFE.
   RESUME (lib/registrar-manager.ts): the asset-lock txid is persisted to
   localStorage `evonext_pending_lock_<fundingAddress>` right after
   broadcast and cleared after confirmation; a retry RESUMES the pending
   lock instead of broadcasting a SECOND lock (which would double-burn).
   The modal's deposit poll also skips the required-balance check when a
   pending lock exists (change output can be below 'required').
   Verified: tsc 0, eslint 0/1, 75/75, build 35/35.
4. **F27f — 'Registration failed' on retry: unspendable credit output spent
   (2026-10-06)**: after the F27e deploy the user retried registration and
   got an immediate 'Registration failed'. Root cause: their FIRST asset
   lock (broadcast pre-F27e, confirmed, identityCreate never ran) left a
   0.2 tDASH CREDIT OUTPUT at their own funding address (vout 1 of the
   type-8 tx). getFundingUtxos returned ALL utxos including it, the poll
   counted it toward the balance, and createAssetLockTransaction spent it
   as an input — Core REJECTS spending asset-lock credit outputs on L1
   (they can only be consumed by Platform via the lock proof; spending one
   would double-spend the locked value). Fixes (lib/core-chain.ts):
   getTxType() (insight /tx/<txid> DOES return the DIP-2 `type` field —
   verified live: coinbase tx returns version 3 / type 5; txTypeCache
   map; lookup errors treat as regular), getFundingUtxos now FILTERS vout-1
   outputs of type-8 txs (change at vout 2+ stays spendable), and
   findUnusedAssetLock() finds a stranded lock for RESUME.
   registrar-manager auto-resumes an unused lock (no second burn — this
   also recovers the user's ORIGINAL 0.2 lock without any manual
   localStorage hack); the modal poll skips the balance check when EITHER
   a persisted pending lock OR an on-chain unused lock exists. Verified:
   tsc 0, eslint 0/1, 75/75, build 35/35.
5. **F27g — registration 'e.match' crash: F26c snake_case regression FIXED
   (2026-10-06)**: user error `Registration failed: undefined is not an
   object (evaluating 'e.match')` (JavaScriptCore phrasing). Root cause:
   F26c (Oct 4) flipped compat's derive_key_from_seed_with_path to a
   SNAKE_CASE plain object to fix the CONNECT flow, but
   lib/registrar-manager.ts still read `key.derived.publicKey` (camelCase,
   which worked against the raw 4.1.1 class during the F24 live test on
   Oct 3 — registration was never re-verified after F26c). undefined →
   hexToBytes(undefined) → `.match` on undefined. Node repro
   (/tmp/repro-derive.mjs): camelCase read = undefined → TypeError
   'reading match'; snake_case read = 66-hex → 33 bytes. Fix: one-line
   read change to `key.derived.public_key`. Audited ALL other
   getPrivateKeys/derive consumers (wallet-manager getPublicKeys,
   identity-manager x2, connect page, modal): every other read is already
   snake_case; core-chain.ts `.publicKey` is dashcore-lib's own API
   (correct). REGISTRATION HAS NOT BEEN LIVE-VERIFIED end-to-end since
   F24 — flag for the next testnet run. Verified: tsc 0, eslint 0/1,
   75/75, build 35/35.
6. **F27h — 'Registration failed: Unknown error' diagnosis + step-labeled
   errors (2026-10-06)**: the message 'Unknown error' was traced INTO the
   wasm binary: it is tonic-0.14.6's description for grpc code 2 (UNKNOWN)
   — i.e., a DAPI call rejected the request with an unmapped/empty status
   (strings wasm_sdk_bg.wasm -> '...error parsing grpc-status...Unknown
   error...tonic-0.14.6/src/status.rs:496'). Deterministically RULED OUT
   via a full Node repro of the registrar's OFFLINE construction sequence
   (dummy txid): OutPoint/createChainAssetLockProof/createIdentityId
   (String() -> proper base58; Identifier HAS toString in BOTH 4.1.1 and
   4.2 — my earlier '[object Object]' theory was wrong, grep window too
   small)/new Identity/5x IdentityPublicKey+addPublicKey/IdentitySigner/
   PrivateKey.fromWIF all PASS on 4.2.0-dev.11; IdentityCreateOptions and
   DpnsRegisterNameOptions field shapes match the call sites. CONCLUSION:
   the failure is inside identityCreate's broadcast OR the DPNS step —
   needs the failing STEP from the field. Shipped: try/catch around
   sdk.identityCreate (-> 'identity create failed: <msg>') and
   dpns_register_name (-> 'username registration failed: <msg> — NOTE:
   your identity WAS created on-chain; refresh and log in...'), each with
   a console.error of the raw error. Next failure toast will name the step.
   OPEN SUSPECTS for the grpc code-2: (a) the resumed lock is ALREADY
   SPENT on Platform (Platform-side consumption does NOT spend the L1
   credit UTXO, so findUnusedAssetLock can resume a spent lock — needs a
   Platform-side check if confirmed); (b) chain-proof height
   (current-insight-height vs Platform's core view); (c) 4.2.0-dev.11
   transition serialization for identity create (doc transitions ARE
   live-verified on 4.2 via F27a post/reply/like; identity create is NOT).
   Verified: tsc 0, eslint 0/1, 75/75, build 35/35.
7. **F27i — 'Asset lock proof core chain height' root-caused + FIXED
   (2026-10-06)**: the labeled errors (F27h) pinpointed identityCreate;
   the rejection is the chain proof's core_chain_locked_height. ROOT
   CAUSE (live-verified in Node): the proof was built at the insight TIP,
   but Platform validates it against ITS OWN core-chain-locked height —
   measured live: metadata.coreChainLockedHeight 1571981 vs insight tip
   1571983 (tip AHEAD => 'in the future' => rejection; F24 passed because
   chainlocks kept pace on Oct 3). Fix in registrar-manager: (a) derive
   creationIdentity from a THROWAWAY proof at the lock's own block height
   (the id commits to the outpoint only — height-independent); (b) read
   Platform's chainlocked height from `sdk.getIdentityWithProofInfo(
   creationIdentity).metadata.coreChainLockedHeight` — Node-verified to
   work for a MISSING identifier too (data undefined, metadata present,
   no throw; ResponseMetadata.coreChainLockedHeight is a number getter,
   .height is BigInt); (c) while that height is < the lock's block, the
   lock is not chainlocked — progress 'Waiting for the lock to be
   chainlocked...' + re-poll every 15s; (d) build the FINAL proof at
   Platform's chainlocked height. ALSO: the same metadata query detects
   an ALREADY-EXISTING identity (the user's second error 'Object already
   exists:' — a previous attempt had created it) -> friendly throw
   telling them to log in and claim the username instead (standalone
   claim path exists: /claim + useUsernameModal + dpns-service
   .registerUsername). NOTE: WasmSdkBuilder.withTrustedContext CONSUMES
   the builder (use its return) — calling build() on the consumed one
   throws 'null pointer passed to rust'. waitForConfirmation already
   returned `blockheight` (lowercase, insight field) — now destructured.
   Verified: tsc 0, eslint 0/1, 75/75, build 35/35.
8. **F27j — contested-name funding shortfall: top-up + retry at the DPNS
   step (2026-10-06)**: after the F27i chainlock fix, identity creation
   SUCCEEDED (identity 7msBY... created with exactly the 0.2-lock's
   200,000,000,000 credits) but the DPNS step failed 'Insufficient
   identity balance: 197... required: 200...'. Root cause: DPNS contested
   cost = action_cost + special_option_cost x 10^4 (the 10^4 multiplier is
   in the DPNS crate), so a contested name costs ~the full 200B credits,
   but the identity was funded with exactly the lock amount minus the
   creation fee (~197.5B left) — ~3M short. ALSO the user saw a SECOND
   passkey named with an identity id (not 'EvoNext Identity #1'):
   VERIFIED the deployed testnet.evonext.app build is byte-identical to
   local (page chunk 7c5bbe + vault chunk 7010 both pass the correct
   label; vault user.name = the label). The only code paths creating
   passkeys are handlePasskeyCreate (label 'EvoNext Identity #1') and
   handlePasskeyRecover (recoverIdentityEntropy(0) — same label). An
   identity-id-named passkey CANNOT be created by this build; the likely
   explanation is the user's password manager created/prompted a credential
   during a WebAuthn ceremony it didn't recognize, OR an older cached chunk
   ran. No code change made for the passkey naming (no defect found in the
   deployed build). FIX (top-up retry in registrar-modal): on an
   /insufficient identity balance/i failure at the DPNS step, call
   topUpAndRetryUsername() which (a) derives the identity id from the
   persisted pending lock's outpoint (evonext_pending_lock_<addr>), (b)
   builds a 0.01-DASH asset lock from the funding wallet's SPENDABLE change
   (getFundingUtxos excludes unspendable credit outputs), (c) waits for it
   to confirm + reach Platform's core-chain-locked height, (d) calls
   sdk.identityTopUp({identity, assetLockProof, assetLockPrivateKey}) —
   NOTE: IdentityTopUpOptions has NO signer field (authorized purely by the
   lock key), and (e) retries registerIdentityAndUsername once. New core-
   chain imports: broadcastTransaction, createAssetLockTransaction,
   deriveFundingKey, waitForConfirmation. Verified: tsc 0, eslint 0/1,
   75/75, build 35/35.
9. **F27k — automatic top-up flow + live identity balance on the deposit
   screen (2026-10-06)**: the user's identity (7msBY...) was created with
   exactly the 0.2-lock (200,000,000,000 credits) but the DPNS contested-
   name cost exceeded it by ~3M, and the F27j single-shot top-up retry was
   insufficient UX (fired once, no balance feedback). Reworked the
   registrar modal per the user's directive: (a) the identity balance is
   ALWAYS shown on the funding screen once the identity exists — polled
   live every 4s via sdk.getIdentity(...).balance, displayed in DASH
   (credits / 1e3 / 1e8 — 1 duff = 1000 credits) + raw credits, amber when
   a top-up is needed / green otherwise; (b) on an 'insufficient identity
   balance' DPNS failure the modal now enters TOP-UP MODE (needsTopUp
   state) instead of firing a one-shot retry: the funding address + QR
   stay visible, the heading switches to 'send a top-up of at least
   0.10000 DASH', the progress bar switches to an amber 'Top-up received
   X / 0.20005' bar, and a dedicated 4s interval watches the funding
   address's SPENDABLE utxos (getFundingUtxos excludes credit outputs);
   (c) the moment the top-up deposit lands, processTopUp(0.1 DASH) runs
   AUTOMATICALLY — derive the identity id from the mnemonic's auth key
   (searchByHash160, robust — NOT the localStorage pending-lock hack),
   build a 0.1-DASH asset lock from the change, wait for it to confirm +
   chainlock, sdk.identityTopUp({identity, assetLockProof,
   assetLockPrivateKey}) (no signer field), refresh the balance display,
   and retry registerIdentityAndUsername once. isToppingUpRef prevents
   concurrent top-ups; a failure re-arms needsTopUp so a further deposit
   retries. The deposit-status bar is an IIFE picking creation vs top-up
   target by needsTopUp. NOTE the top-up amount 0.1 DASH was chosen to
   comfortably cover the ~3M shortfall (0.1 DASH = 100M credits).
   Verified: tsc 0, eslint 0/1 (only the known postsState warning),
   75/75, build 35/35; new UI strings confirmed present in the emitted
   chunk 4110. Full top-up flow NOT browser-verified end-to-end (needs a
   live funded wallet); each underlying API call is individually verified.
10. **F27l — top-up flow added to the CLAIM modal (username-modal.tsx)
   (2026-10-06)**: F27k put the top-up UI in the REGISTRAR modal
   (components/id/registrar-modal.tsx), but the user was actually on the
   CLAIM flow (/claim -> UsernameModal, the only modal with a 'Register
   Username' button), which had NO funding capability — so the
   'insufficient identity balance' error had no recovery there. Ported the
   full F27k top-up flow into components/dpns/username-modal.tsx:
   (a) LIVE identity balance card (polled every 4s via getIdentity
   .balance, credits/1e3/1e8 -> DASH + raw credits; amber when top-up
   needed / green otherwise) shown above the Register button whenever the
   balance is known;
   (b) on an /insufficient identity balance/i failure the modal enters
   top-up mode (needsTopUp) -> renders an amber funding panel with the
   funding address (deriveFundingKey) as text + QRCodeSVG, a live
   'Top-up received X / 0.20005 DASH' progress bar, and a topUpProgress
   line during processing;
   (c) a 4s interval watches the funding address's SPENDABLE utxos; when
   >= 0.20005 DASH lands, processTopUp() runs AUTOMATICALLY (build 0.1-DASH
   lock from change -> confirm + chainlock -> sdk.identityTopUp (no signer
   field) -> refresh balance -> toast 'Balance topped up! Click Register
   Username again'). isToppingUpRef prevents concurrent runs; a failure
   re-arms the watcher. Identity id = the modal's currentIdentityId (the
   user is already logged in here, so no searchByHash160 needed — unlike
   the registrar modal).
   NOTE the two modals now share the top-up logic but are NOT factored
   into a shared hook (kept as parallel implementations to keep the diff
   minimal and avoid touching the verified registrar flow).
   Verified: tsc 0, eslint 0/1 (known postsState warning), 75/75, build
   35/35; new strings confirmed in emitted chunks (layout + 6916).
11. **F27m — 'Fund YOUR Identity' screen visual refresh (2026-10-06)**:
   user asked for a UI refresh of the registrar funding panel 'without
   losing any information/details'. Redesigned the flat section into a
   modern rounded-2xl card (gradient header 'Fund YOUR Identity' +
   'Self-custodial — you hold the keys' subhead). ALL original elements
   preserved 1:1: (a) live identity-balance card (now a 2-column row:
   DASH value left, raw credits right; amber/green by needsTopUp); (b) QR
   in a bordered white tile (still clickable -> handlePayment); (c) 'Send
   at least X DASH' line (creation amount / 0.10000 top-up amount by
   needsTopUp) — the amount button still calls handlePayment; (d) the
   funding address as a full-width monospace button (still handlePayment,
   break-all); (e) the LIVE deposit-status card (Received/Top-up received
   X / Y DASH + progress bar + 'Deposit detected — creating your
   identity…' / 'Top-up detected — processing automatically…') — same
   IIFE picking creation vs top-up target, same polling
   (PAYMENT_DETECTION_INTERVAL 5s + the 4s top-up watcher), unchanged
   logic; (f) the self-custody PLEASE NOTE block ('you control the keys…
   asset lock for YOUR new Identity… completes automatically…poll every
   few seconds'). NO behavior/logic changed — pure presentational
   reorganization. Verified: tsc 0, eslint 0/1, 75/75, build 35/35; all
   strings confirmed in emitted chunk 6916.
12. **F27n — errors no longer flash-and-vanish; persistent dismissible
   error toasts app-wide (2026-10-06)**: user reported errors flash
   on-screen and disappear before they can be read. Root cause: the global
   react-hot-toast <Toaster> used duration: 3000 for EVERYTHING including
   errors. Fix: (a) new shared helper lib/toast-error.tsx exporting
   showErrorToast(message) — a toast.custom renderer with role='alert',
   duration: Infinity (persists until dismissed), and an X button
   (aria-label='Dismiss', toast.dismiss(t.id)); (b) migrated ALL
   toast.error( call sites across the app to showErrorToast( — 20 files
   (app/post, marketplace, profile, profile/create, apps, bootstrap,
   contract, roadmap, settings, gifts, connect, wallet; components:
   post-card, compose-modal x2, biometric-settings, registrar-modal,
   username-modal, ClaimGiftFlow, CreateGiftFlow). Success/info toasts
   keep the 3s auto-dismiss (only errors persist). Removed the now-unused
   react-hot-toast default import from app/settings/page.tsx and
   app/connect/page.tsx. NOTE: I deliberately did NOT set a global
   error:{duration:Infinity} on the Toaster — that would have made the
   remaining default-style error toasts persist WITHOUT an X button
   (trapping users); migrating call sites to the X-dismissible helper is
   the correct fix. Verified: tsc 0, eslint 0/1 (known postsState
   warning), 75/75, build 35/35; compiled chunk 2670 confirms
   aria-label:'Dismiss', role:'alert', duration:1/0 (Infinity),
   animate-enter.
13. **F27o — WASM SDK 5.0.0-rc.8 + DAPI read proxy for identity reads (2026-10-25)**:
   (a) **SDK upgrade** for the testnet protocol-v14 / Platform-v5.0.0 upgrade (handoff
   `dev-dapi-proxy/docs/HANDOFF-testnet-v24-platform-v5.md`): the testnet backend moved
   4.2.0-dev.11 -> 5.0.0-rc.5 on 2026-10-20 after a 10-15->10-20 network HALT (the
   v13->v14 upgrade block). We vendored `@dashevo/wasm-sdk@5.0.0-rc.8` (raw dist ->
   lib/dash-wasm; backups of the 4.2.0-dev.11 files in /tmp/backup_4211_*). The 5.0 d.ts
   keeps every compat.ts wrapper signature (Document/IdentitySigner/PlatformVersion/WasmSdk,
   documentCreate, identityCreate/identityTopUp, getIdentityWithProofInfo, dpns*,
   deriveKeyFromSeedWithPath, WasmTrustedContext.prefetchTestnet) — compat.ts needed NO
   changes. `dash-platform-sdk` bumped 1.5.0-dev.11 -> 1.5.3 (wallet-manager's
   DashPlatformSDK; its `rc`/`dev` tags are OLDER — 1.5.3 `latest` is correct).
   (b) **SMOKE-VERIFIED against the upgraded testnet** (Node, /tmp/smoke-wasm5.mjs +
   smoke-wasm5-write.mjs): reads (getIdentity balance, getIdentityWithProofInfo
   coreChainLockedHeight, getIdentityNonce) PASS; the WRITE path (new Document +
   sdk.documentCreate + documentDelete — the app's exact state-transition-service
   path) created and deleted a probe post on protocol v14. 75/75 unit tests pass on the
   5.0 wasm. identityCreate/identityTopUp with a chain asset-lock proof NOT re-run (no
   funded wallet in CI) — the F27i/F27j flow is the one to re-verify live.
   (c) **DAPI read proxy for identity reads (performance)**: new `lib/dapi-proxy.ts`
   wraps `https://dapi.sansbank.dev/v1/dapi` (12s AbortController timeout, unwraps the
   {success,result} envelope). identity-service.getIdentity now calls
   fetchIdentityViaProxy (proxy-first, WASM SDK fallback, plain-object result normalized
   with a `.toJSON()` shim so downstream logic is unchanged). NOTE the proxy's
   get_documents path enforces STRICTER grpc index validation than the WASM SDK — it
   REJECTS the `$createdAt > 0` range clause the Yappr feed uses ('where clause on non
   indexed property'; the WASM SDK silently tolerates it) — so document queries were
   deliberately LEFT on the WASM SDK; only identity reads (identity_fetch,
   get_identity_balance) go through the proxy. Verified: tsc 0, eslint 0/1 (known
   postsState warning), 75/75, build 35/35; emitted wasm e9693c35 = 26,513,399 bytes.
14. Pending decisions: shielded-balance UI, DIP-17 platform-address features, biometric
   settings integration, react-hooks v6 cleanup pass.
15. Known unverified: the -20.33B credit fee breakdown (F25).
16. **Deployment is MANUAL/stale — F26**: the live evonext.app served the OLD pre-F22
   wasm on 2026-10-04 (deployed asset `wasm_sdk_bg.c3177f65.wasm`, 8,013,662 bytes,
   sha256 `ca6e51ce…`, CONTAINS dead F22 addresses `52.34.144.50`/`35.82.197.197`),
   reproducing the F22 hang despite master being fixed. Our source wasm is 20,319,523
   bytes (sha256 `5b779125…`), zero embedded IPs. Local `out/` (Oct 4) is complete
   (32 route HTMLs, `_headers`, wasm `cf2b0aef`) and current with all code through
   F25 — user must redeploy it. Verify a deployment by checking the served wasm's
   byte size (8.0MB = stale pre-F22; 20.3MB = F22-F27 4.2.0-dev.11; 26.5MB = F27o+
   5.0.0-rc.8 current).
17. **F26b — Cloudflare Pages deployment switched OFF next-on-pages (2026-10-04)**:
   root cause of all failed deploys since Oct 2: the Pages project used the Next.js
   framework preset, whose build command `npx @cloudflare/next-on-pages@1` broke
   twice — (a) npm ERESOLVE inside the adapter's own deps (workers-types ^4 vs
   wrangler 4.x's ^5), and (b) `next-on-pages@1.13.16` peer-requires
   `next >=14.3.0 && <=15.5.2` (verified from its installed package.json) while the
   repo is on Next 16.3.8. App is a pure static export, so the adapter is
   unnecessary: dashboard build config changed to **framework preset None,
   build command `npm run build`, output directory `out`**. Cloudflare Pages
   natively serves the static export (pretty URLs `/x` -> `x.html`, `_headers`
   honored, immutable cache for `/_next/static/*`). If a future deploy fails,
   check these three dashboard fields first.
   **VERIFIED LIVE 2026-10-04 after the switch** (trigger commit `88d9add`):
   served wasm = `cf2b0aef` (sha256 `5b779125…`, byte-identical to our source),
   6,312,866 bytes on the wire (brotli), `cache-control: immutable` +
   `content-encoding: br`; ZERO dead DAPI IPs in the served binary; CSP/COOP/
   COEP live; HTML `max-age=0, must-revalidate` (release detection intact);
   pretty URLs (`/connect`, `/explore`) return 200 text/html.

## Working Rules For This Repo

- Follow the global instruction at `/home/shomari/.pi/agent/AGENTS.md` (deterministic
  facts, no guesses, full sources, minimum diff, 1:1 logic parity).
- **NEVER build Rust/native toolchains on the host** (user directive, 2026-10-25).
  Always build on a remote machine: `sansbank` VM (ssh alias, 127.0.0.1:2223, cargo
  1.98.1, 4 cores, 4 GB RAM) or `evorunner` (ssh alias, 172.81.178.120, cargo 1.92.0,
  6 cores, 16 GB RAM — prefer for heavy builds). Both verified live 2026-10-25.
- After each completed task, update this file (mark done + record verification).
