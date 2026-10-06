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
