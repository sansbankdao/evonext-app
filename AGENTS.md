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
- WASM SDK: `lib/dash-wasm/` — raw dist of `@dashevo/wasm-sdk@4.1.1` + `compat.ts`

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

## Key external references

- Prover service: `https://prover.sansbank.dev` (Cloudflare Worker, DAO-wide; currently
  only `POST /prove/shield` for `shield_from_asset_lock`; consensus-verified).
- Shielded sync reference (port target for web): `platform/packages/rs-platform-wallet/src/
  wallet/shielded/` — `keys.rs` (ZIP-32 `m/32/coin_type/account`, coin types 5 mainnet /
  1 testnet, `SpendingKey::from_zip32_seed`), `coordinator.rs` (fetch + trial-decrypt +
  tree-append), `file_store.rs` (`ClientPersistentCommitmentTree` from
  `grovedb_commitment_tree` over SQLite), `note_selection.rs`, `operations.rs`,
  `prover.rs`. Mobile's `platform-wallet-ffi` builds from this crate.
- Sighash extra_data (`rs-dpp/src/shield/sighash.rs`): shield/transfer = empty; withdrawal =
  `output_script || amount(u64 LE) || coreFee(u32 LE) || pooling(u8)`; unshield =
  `output_address || amount(u64 LE)`. Sighash = SHA-256("DashPlatformSighash" || commitment
  || extra_data). Orchard fork `builder.rs:1105/1154/1217`: `prepare -> sign -> finalize`
  split exists (client-signing flow possible; `finalize` emits the binding signature).
- Fees for shielded spends are consensus-computed, NOT request parameters (builders return
  `(StateTransition, Credits)`); client must not invent a fee field.
- Insight APIs (CORS *): `https://insight.dash.org/insight-api` (mainnet),
  `https://insight.testnet.networks.dash.org/insight-api` (testnet). Faucet:
  `https://faucet.testnet.networks.dash.org` (3/hr, Cap captcha).
- System withdrawals contract: `4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6` (doc type
  `withdrawal`; status 2 = signed, 3 = complete). EvoNext contracts: testnet
  `465jdPpFCZefhb4g2k2FpCcrKpPYhJJskDqbGFsKu6wb`, mainnet
  `6fBkKSne1xQ5GCPW9fdwEkH7nk8oYPu48vYiYssWzhX8` (`lib/constants.ts`).

## Active work

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
2. Pending decisions: shielded-balance UI, DIP-17 platform-address features, biometric
   settings integration, react-hooks v6 cleanup pass.
3. Known unverified: the -20.33B credit fee breakdown (F25).
4. **Deployment is MANUAL/stale — F26**: the live evonext.app served the OLD pre-F22
   wasm on 2026-10-04 (deployed asset `wasm_sdk_bg.c3177f65.wasm`, 8,013,662 bytes,
   sha256 `ca6e51ce…`, CONTAINS dead F22 addresses `52.34.144.50`/`35.82.197.197`),
   reproducing the F22 hang despite master being fixed. Our source wasm is 20,319,523
   bytes (sha256 `5b779125…`), zero embedded IPs. Local `out/` (Oct 4) is complete
   (32 route HTMLs, `_headers`, wasm `cf2b0aef`) and current with all code through
   F25 — user must redeploy it. Verify a deployment by checking the served wasm's
   byte size (8.0MB = stale; 20.3MB = current).
5. **F26b — Cloudflare Pages deployment switched OFF next-on-pages (2026-10-04)**:
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
- After each completed task, update this file (mark done + record verification).
