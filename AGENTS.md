<!-- AGENTS.md -->

# EvoNext — Agent Working Notes

This file records verified findings and an ordered work plan for updating, debugging, and testing
this codebase. Every entry below is backed by a source path or command output. Do not add
unverified claims here.

## Project Snapshot

- App: `evonext-app` v`26.1.30` — `package.json:2-3`
- Stack: Next.js `14.1.0`, React `18.2.0`, TypeScript `5` — `package.json:34,37`
- Build: static export (`output: 'export'`) — `next.config.js:3`
- Source size: 127 TS/TSX files (excluding `node_modules`/`.next`/`.git`)

### Verification status (last full pass, all commands run sequentially — never concurrently)

- `pnpm build` -> **exit 0**; `✓ Compiled successfully`; `Generating static pages (36/36)`;
  zero `Export encountered errors` / `Error occurred prerendering` / `window is not defined`;
  static artifacts emitted for the two Task 6 routes (`out/followers.html` 18821 B,
  `out/following.html` 18950 B).
- `pnpm lint` -> **exit 0**; **0 errors**, **8 warnings** (all `react-hooks/exhaustive-deps`).
- `pnpm test:run` -> **exit 0**; `Test Files 5 passed (5)`, `Tests 62 passed (62)`.
- `tsc --noEmit` -> **exit 0**.
- Remaining non-fatal build warning: `Specified "headers" will not automatically work with
  "output: export"` (fires twice) from `next.config.js` `headers()` combined with `output: 'export'`.
- The 8 `react-hooks/exhaustive-deps` warnings, by file:line —
  `app/explore/page.tsx:90,133`, `app/followers/page.tsx:173`, `app/following/page.tsx:176`,
  `app/profile/create/page.tsx:75`, `app/profile/page.tsx:120`,
  `components/post/likes-modal.tsx:57`, `components/settings/biometric-settings.tsx:20`.
  These are warnings, not errors; fixing them changes refetch semantics (product logic), so they
  remain deliberately deferred pending an explicit decision.

### Operational note (user directive)

- `pnpm build` on the user's host is approved. It is a `next build` (webpack compile + static
  prerender of 36 pages); it does **not** invoke a native/Rust/cargo compilation — no `pshenmic_dpp.node`
  build step runs. The `sansbank` VM is **not** required.
- Run builds/tests/lint **sequentially, never in parallel**. Running `pnpm build` concurrently with
  `tsc` previously produced a false `TS6053` failure (both processes contending over `.next/types`) and
  a false `exit 124` (the `timeout` wrapper's own deadline code). Both were methodology artifacts, not
  real defects.
- Package manager: pnpm `11.21.0`, Node `v24.18.1` (observed)
- Remotes: `origin` -> `git@github.com:sansbankdao/evonext-app.git`; branch `master` was ahead of
  `origin2/master` by 6 commits (note: `origin2` is not present in `git remote -v`)

## Verified Findings

### F1. Unit tests — SOLVED (Task 2)
Before (Task 2): `./node_modules/.bin/vitest run` reported `Test Files 1 failed (1)` /
`Tests 3 failed | 2 passed (5)`.
After (Task 2): `Tests 5 passed (5)`.
Original failing cases in `test/unit/services/post-service.test.ts` were:
1. `should create a post document correctly` — line 130: `expected {...} to have property "id"`,
   received `undefined`.
2. `should handle profileService correctly in enrichment (singleton vs new)` — line 204:
   `expected +0 to be 5`.
3. `should fall back to default user when profile fetch fails` — line 266: `expected +0 to be 5`.

### F2. Unit-test root cause — SOLVED (Task 2): non-constructable `vi.fn` mock
Verified stderr from vitest:
```
The vi.fn() mock did not use 'function' or 'class' in its implementation
Error enriching post: TypeError: (contractId) => ({ getProfile: ... }) is not a constructor
    at PostService.enrichPost (lib/services/post-service.ts:138:24)
```
- `test/unit/services/post-service.test.ts:12` defines the `ProfileService` mock as an arrow
  function inside `vi.fn(...)`.
- `lib/services/post-service.ts:138` calls `new ProfileService(...)`.
- `enrichPost` swallows the throw in its `catch` (`lib/services/post-service.ts:183`), so
  `post.likes` stays `0`.
- Same arrow-function pattern in the fallback test at `test/unit/services/post-service.test.ts:230`.

### F3. `createPost` test contradicted its own spy — SOLVED (Task 2)
- `post-service.ts:210` returns `this.create(ownerId, data)`, which transforms via
  `BaseDocumentService.create` (`document-service.ts:211`).
- The test replaces `postService.create` with a spy returning a raw doc
  (`test/unit/services/post-service.test.ts:117-124`), so `result.id` is `undefined` while the
  assertion at line 130 expected `'new-post-id'`. Fixed by asserting the raw `$id` (`:130`).
  Also corrected the fallback-test username expectation to `'unknown-...'` (verified:
  `'unknown-user'.substring(0,8) + '...'` === `'unknown-...'`) and corrected its stats
  expectation to `0` (source `lib/services/post-service.ts:129-183`: the entire enrichment body
  shares one try/catch, so a rejected `getProfile` skips all stats/interactions).

### F4. TypeScript errors — SOLVED (Task 1)
Before: `tsc --noEmit` exited `2` with six `TS2351: This expression is not constructable` errors:
`app/profile/create/page.tsx:60,118`, `app/test-create/page.tsx:83`,
`components/dpns/username-modal.tsx:321`, `components/id/registrar-modal.tsx:378`,
`contexts/auth-context.tsx:311`.
Cause: `lib/services/profile-service.ts` exports both class `ProfileService` (`:66`) and singleton
`profileService` (`:550`); call sites destructured the singleton and called `new profileService(...)`.
After the Task 1 fix: `tsc --noEmit` exits `0`.

### F5. `pnpm test:run` — SOLVED (Task 3), blocked by pnpm build-script gating
Before (Task 3): `pnpm test:run` exited `1`:
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: cbor-extract@2.2.0, esbuild@0.27.2, msw@2.12.7, unrs-resolver@1.11.1
[ERROR] Command failed with exit code 1: pnpm install
```
Fix: set `allowBuilds` to `true` for the live packages in `pnpm-workspace.yaml`
(`esbuild`, `msw`, `unrs-resolver`; `cbor-extract` was dropped by the SDK dev bump, see F9),
then `pnpm install --no-frozen-lockfile`.
After (Task 3): `pnpm install` exits `0` (build scripts run) and `pnpm test:run` exits `0`
(`Tests 5 passed (5)`).

### F6. Lint errors — SOLVED (Task 4)
Before: `next lint` exited `1`.
- Error `react/no-unescaped-entities`: `app/libs/page.tsx:88:140`, `app/studio/page.tsx:88:140`
  (both are the apostrophe in `platform's`).
- Warnings `react-hooks/exhaustive-deps`: `app/explore/page.tsx:90,133`,
  `app/profile/create/page.tsx:75`, `app/profile/page.tsx:120`,
  `components/post/likes-modal.tsx:57`, `components/settings/biometric-settings.tsx:20`
Fix: replaced the apostrophe with `&apos;` in both files (`Access user profiles, post data, and
interact with the platform&apos;s UI ...`).
After: `pnpm lint` exits `0`; only the 6 pre-existing `react-hooks/exhaustive-deps` WARNINGS remain
(not errors).

### F7. Test suite was a stub — EXPANDED (Task 5)
Before: 6 test-related files; the only unit test was `test/unit/services/post-service.test.ts`.
- `test/README.md` said `Tests are coming soon...` (now rewritten with a file/coverage table).
- `playwright.config.ts:5` set `testDir: './test/e2e'`, but that directory did not exist.

Added unit tests (Vitest) for pure-logic modules:
- `test/unit/lib/utils.test.ts` — `cn`, `formatTime`, `formatNumber`, `getInitials` (16 tests).
- `test/unit/lib/post-helpers.test.ts` — `identityIdToBytes`, `createPostDocument`,
  `extractHashtags`, `extractMentions`, `validatePost` (18 tests).
- `test/unit/lib/cache-manager.test.ts` — `CacheManager` set/get/ttl/tags/stats/cleanup (13 tests).
- `test/unit/lib/retry-utils.test.ts` — `retryAsync`, `retryPostCreation`, `isNetworkError`,
  `isRetryableError` (10 tests).
Verified: `pnpm test:run` exits `0` -> `Test Files 5 passed (5)`, `Tests 62 passed (62)`.

Added e2e directory + test:
- `test/e2e/home.spec.ts` — home page loads (title + non-error response).
Verified: `./node_modules/.bin/playwright test --project=chromium` exits `0` -> `2 passed`
(after `./node_modules/.bin/playwright install chromium`).

### F12. Playwright e2e was unrunnable — SOLVED (Task 5, fallout of adding `test/e2e`)
Three separate, verified problems:
1. `playwright.config.ts` had no `webServer.timeout`; the default 60s was exceeded because
   `curl` measured the Next dev server healthy in ~51s `FINAL_HTTP:200` and Next dev then compiles
   `/` on demand. Fix: added `timeout: 180000` to `webServer`.
2. Default Playwright test `timeout` 30s was exceeded by the first navigation's cold compile
   (~77s). Fix: added top-level `timeout: 120000` and used `{ waitUntil: 'domcontentloaded' }` in
   `test/e2e/home.spec.ts`.
3. Chromium binary was absent (`Executable doesn't exist at
   /home/shomari/.cache/ms-playwright/chromium_headless_shell-1208/...`). Fix: ran
   `./node_modules/.bin/playwright install chromium` (the repo already exposes `pnpm test:e2e:install`).
After: `./node_modules/.bin/playwright test --project=chromium` exits `0` -> `2 passed (29.2s)`.

### F8. Stale `.app/*` pages and `new profileService` usage — RESOLVED (Task 6, Option B)
Original state: `.app/followers/page.tsx` and `.app/following/page.tsx` were git-tracked but dead code:
not in the `tsc` program (`tsc --listFiles` showed no project `.app/` files), not routable by Next
(dot-directories are not routes; `app/followers`/`app/following` did not exist), and unreferenced
(no `href="/followers"` or `href="/following"` anywhere in `app/ components/ lib/ contexts/`).
`.app/followers/page.tsx:138` read `const ps = new profileService(getContractId(network!))` followed
by `profileService.ps(identityIds)` — a broken pattern (`profileService` is a singleton object, not a
constructor; `network` was undefined in that scope; `ps` was misused as a property name).
The sibling `.app/following/page.tsx:229` correctly used `profileService.getProfilesByIdentityIds(identityIds)`.

Action taken (user approved Option B + enabling `setData`):
- Created real routes `app/followers/page.tsx` and `app/following/page.tsx`.
- Repaired the broken call to `profileService.getProfilesByIdentityIds(identityIds)` and removed the
  now-dead `getContractId` helper plus the `EVONEXT_CONTRACT_ID_MAINNET`/`_TESTNET` imports it used.
- Enabled `setData(followers)` / `setData(followingUsers)` (previously commented out, so neither page
  could ever render data).
- Removed a genuine unused import: `useState` from `app/followers/page.tsx`.
- Added sidebar links (`components/layout/sidebar.tsx` `getNavigation`): `Community` -> `/followers`
  (repointed from `/`) and a new `Following` -> `/following`, both reusing icons already imported.
- `git rm -r .app` (both tracked files deleted).
- Type-fix fallout of bringing the files into the `tsc` program: `.filter(Boolean)` does not narrow
  `T | null`, so both files now annotate the map callback `(follow: any): X | null` and use
  `.filter((f): f is X => Boolean(f))`. Runtime behavior is identical.

Verified: `tsc --noEmit` exits `0`; `pnpm lint` exits `0` (2 new `react-hooks/exhaustive-deps`
warnings appeared, identical in kind to the 6 pre-existing deferred ones — they existed in `.app/`
too, just were never linted); `pnpm test:run` exits `0` -> `Tests 62 passed (62)`;
`pnpm build` now reaches `Generating static pages (36/36)` (was 34/34), and the remaining exit-1 is
the pre-existing F11 (`window is not defined`), not a regression — the new pages render `<Sidebar />`,
which transitively reaches the module-scope `getNetwork()` in `lib/services/profile-service.ts:549`,
crashing at the identical chunk offset `8651` in `.next/server/chunks/2003.js`. F11 (work plan item 7)
is the fix for that shared root cause.

Still present (inert, unchanged): `lib/services/post-service.ts:137` holds
`// const ps = new profileService(getContractId(getNetwork()))` — it is inside a comment, so it never
executes. (Line 138 immediately below is the Task 1 repair `new ProfileService(...)`.)

### F9. `dash-platform-sdk` dev bump — DONE (user request, tracked with Task 3)
Goal: use the latest DEV release and DO NOT include the DCG SDK.
- Registry `dev` dist-tag = `1.5.0-dev.11` (`npm view dash-platform-sdk dist-tags`).
- Maintainer is `pshenmic <pshenmic@gmail.com>` (`npm view dash-platform-sdk maintainers`) — this is the
  pshenmic SDK, not the DCG `@dashevo/*` SDK. `@dashevo` occurrences in `pnpm-lock.yaml`: `0`.
- `package.json`: `dash-platform-sdk` `1.2.0` -> `1.5.0-dev.11`; transitive `pshenmic-dpp`
  (a direct dependency at `lib/wallet-manager.ts:3`, `lib/types.ts:2`) `1.0.23-rc.7` -> `2.0.0-dev.29`.
- API compatibility verified against the published type declarations: `new DashPlatformSDK({network})`,
  `tokens.createBaseTransition`, `tokens.createStateTransition`, `identities.getIdentityByIdentifier`,
  `stateTransitions.broadcast`, `PrivateKeyWASM.fromWIF`, and `GasFeesPaidByWASM` all still exist.
  `./node_modules/.bin/tsc --noEmit` exits `0` after the bump.
- The one non-peer dependency that disappeared is `cbor-extract`, so `pnpm-workspace.yaml` no longer
  lists it.

### F10. `next build` native-binary failure — SOLVED (fallout of F9)
Before: `pnpm build` failed (`exit 1`). `pshenmic-dpp@2.0.0-dev.29` exposes an `exports` map whose
`node` condition resolves to `dist/src/native.js`, which imports `dist/binaries/node.cjs`; that file
does `require(\`./${path.join('native', target, 'pshenmic_dpp.node')}\`)`, and webpack reported
`Module parse failed: Unexpected character ... pshenmic_dpp.node` for the `.node` binaries.
The old `pshenmic-dpp@1.0.23-rc.7` was `"main": "dist/wasm/index.js"` (pure WASM), so it never hit this.
Fix (in `next.config.js`, `webpack` function):
- alias `pshenmic-dpp` -> `pshenmic-dpp/wasm` (the same pure-WASM entry the package's own `browser`
  condition uses) so every compilation takes the WASM path;
- for the client (`!isServer`), `resolve.fallback.worker_threads = false` (the WASM entry guards
  `worker_threads` behind an `isNode` check, but webpack still statically resolves it).
After: webpack `Compiled successfully` and `Generating static pages (34/34)`.

### F11. Static-export prerender `window is not defined` — SOLVED (Task 7)
Before fix, `pnpm build` exited `1` with `ReferenceError: window is not defined` while
`Export encountered errors on following paths:` `/claim`, `/connect`, `/test-create`,
`/test-dpns-debug`, `/test-dpns`, `/test-wasm`, `/wallet`.
(Task 6 added `/followers` and `/following` to this set — they render `<Sidebar />`, which reaches the
same module; verified `pnpm build` output listed 9 paths and crashed at the identical chunk offset
`8651`. Those two were victims of F11, not of Task 6.)
Cause (verified): `lib/services/profile-service.ts:549`
`const profileContractId = getContractId(getNetwork())` called `getNetwork()`
(`lib/services/profile-service.ts:26-27`, `window.location.host`) at module evaluation time. The
compiled crash site `.next/server/chunks/2003.js` contained
`new d("mainnet"===(()=>{let e;return"evonext.app"===window.location.host?...`. This line is present in
committed `HEAD` (NOT introduced by Task 1-3). `post-service.ts` defines the same `getNetwork()`
but does NOT call it at module scope, so it did not crash.

Fix (minimum diff, 1 line changed in `lib/services/profile-service.ts:27`):
```diff
 const getNetwork = () => {
-    const host = window.location.host
+    // Guard for SSR / static-export prerender where `window` is undefined.
+    // Client-side behavior is unchanged; server-side falls back to 'testnet'.
+    const host = typeof window !== 'undefined' ? window.location.host : ''
```
Rationale: with `host = ''` the untouched `switch` falls through to `default: network = 'testnet'`,
which is the same value the client already produces for any non-`evonext.app` host, and the same
fallback `lib/dash-platform-client.ts:84` applies (`(getNetwork() as ...) || 'testnet'`). The guard
pattern (`typeof window !== 'undefined' ? window.location.hostname : 'localhost'`) already exists in
`lib/passkey.ts:31,88`.

Why only this one call site mattered: `grep -rn getNetwork lib app components contexts` shows the
other three definitions (`lib/services/post-service.ts:42`, `lib/dash-platform-client.ts:28`,
`contexts/auth-context.tsx:45`) are each only *called* inside functions (`post-service.ts:138`,
`dash-platform-client.ts:84,86`, `auth-context.tsx:104,205,332`), so they never run at module load.
`profile-service.ts:549` was the sole module-scope caller.

Verified after fix (`.next` removed first): `pnpm build` exits **0**;
`Generating static pages (36/36)`; zero occurrences of `Export encountered errors` /
`Error occurred prerendering` / `window is not defined` in the log; previously-failing paths `/claim`,
`/connect`, `/followers`, `/following`, `/test-create`, `/test-dpns-debug`, `/test-dpns`,
`/test-wasm`, `/wallet` all now emit static HTML (`out/followers.html`, `out/following.html`, ...).
Also `tsc --noEmit` exits `0`; `pnpm lint` exits `0` (0 errors, 8 warnings as before);
`pnpm test:run` -> `Tests 62 passed (62)`.
Client/SSR parity check: the emitted **server** chunks no longer contain the unguarded
`"evonext.app"===window.location.host` form for `profile-service`; the guarded expression appears in
**client** chunks (e.g. `.next/static/chunks/6739-e27eddc99aa464cc.js`). The three remaining
unguarded occurrences on the server belong to `dash-platform-client.ts` and `auth-context.tsx`,
both function-scoped and therefore never evaluated during prerender (proven by the passing build).

### F13. `lib/wallet-manager.ts` runtime compatibility with the bumped SDKs — AUDITED, COMPATIBLE (Task 8)
Scope was a *runtime* audit (types already passed after F9, but the `wasm.d.ts` and `native.d.ts`
barrels are byte-identical — both just `export * from './dpp/{enums,dpp,types}.js'` — so a green `tsc`
proves nothing about which runtime entry is loaded). No files were changed by this task.

Verified facts (each with its command):
- Installed versions match the Task 3 target: `dash-platform-sdk` = `1.5.0-dev.11`,
  `pshenmic-dpp` = `2.0.0-dev.29` (`node -e require(.../package.json).version`).
- `pshenmic-dpp` `exports` map: `"."` -> `{browser: ./dist/src/wasm.js, node: ./dist/src/native.js,
  default: ./dist/src/wasm.js}` plus `"./wasm"` and `"./native"`.
- The aliased entry resolves both symbols `wallet-manager.ts` imports: loading
  `pshenmic-dpp/dist/src/wasm.js` directly yields `PrivateKeyWASM: function`,
  `GasFeesPaidByWASM: object`, `PrivateKeyWASM.fromWIF: function`,
  `GasFeesPaidByWASM.ContractOwner: 1` (159 exports total).
- The whole `dash-platform-sdk` surface called by the file exists at runtime on
  `new DashPlatformSDK({network:'testnet'})`: `tokens.createBaseTransition`,
  `tokens.createStateTransition`, `identities.getIdentityByIdentifier`, `stateTransitions.broadcast`,
  `documents.create`, `documents.createStateTransition` — all `function`.
- The vendored WASM SDK used via `./dash-wasm/wasm_sdk` still declares every symbol the file uses:
  `lib/dash-wasm/wasm_sdk.d.ts` `WasmSdkBuilder` (:756), `new_mainnet_trusted` (:764),
  `new_testnet_trusted` (:766), `derive_key_from_seed_with_path` (:204),
  `get_identities_token_balances_with_proof_info` (:141), `identityCreditTransfer` (:495) — signatures
  unchanged. `@nexajs/crypto` `hash160` is `function`.

**Load-bearing invariant (new finding).** `dash-platform-sdk` imports the *bare* specifier
`'pshenmic-dpp'` in dozens of files (`node_modules/dash-platform-sdk/src/**`). Under plain Node that
bare specifier resolves to the **node/native** entry while an explicit `pshenmic-dpp/wasm` import gets
the WASM entry — i.e. two distinct DPP instances in that context
(`node` printed `running on native dpp (x86_64-unknown-linux-gnu)` alongside a loaded
`pshenmic-dpp/wasm`). In the browser the F10 webpack alias (`pshenmic-dpp` -> `pshenmic-dpp/wasm`)
forces both the SDK's internal bare imports and `wallet-manager.ts` onto the *single* WASM entry.
Evidence: `.next/static/chunks/8625-0f8c87c4e675dc9d.js` contains the WASM thread worker name
`pshenmic-dpp-wasm-thread`, while `pshenmic_dpp.node` references in `.next/static/chunks/` = `0` and
the string `running on native` appears nowhere in the client bundle. Conclusion: the F10 alias is
load-bearing for DPP *instance identity*, not merely for avoiding the `.node` parse error — removing or
narrowing it would risk class-identity failures (`PrivateKeyWASM`/`IdentifierWASM` from a different
instance) in the browser. Recorded here as an invariant; no code change made.

Note: `test/` contains no test that references `wallet-manager`, so this audit was statically driven
(module loading + bundle inspection), not by an existing test.

## Ordered Work Plan

1. [DONE] Fix the six `new profileService(...)` -> `new ProfileService(...)` call sites so `tsc`
   exits 0. Also exported `ProfileService` from `lib/services/index.ts` for `app/test-create/page.tsx`.
   Verified: `./node_modules/.bin/tsc --noEmit` exits `0`.
2. [DONE] Fix the unit-test mock shape (constructable function/class) and reconcile the
   contradictory assertions in `test/unit/services/post-service.test.ts`.
   Verified: `./node_modules/.bin/vitest run` -> `Tests 5 passed (5)`;
   `./node_modules/.bin/tsc --noEmit` exits `0`.
3. [DONE] Unblock `pnpm test:run` (approve `esbuild`/`msw`/`unrs-resolver` build scripts in
   `pnpm-workspace.yaml`; `cbor-extract` no longer applies).
   Verified: `pnpm install --no-frozen-lockfile` exits `0`; `pnpm test:run` exits `0`.
   Same task request: bump to the latest `dash-platform-sdk` DEV release (`1.5.0-dev.11`) without the
   DCG SDK. Verified: `@dashevo` count `0`; `tsc --noEmit` exits `0`.
4. [DONE] Fix the two `react/no-unescaped-entities` errors (`app/libs/page.tsx`, `app/studio/page.tsx`).
   Verified: `pnpm lint` exits `0` (6 `react-hooks/exhaustive-deps` warnings remain; warnings are not
   errors, so the optional cleanup of those is deferred to Task 5.)
5. [DONE] Expanded unit coverage beyond the single `post-service` test and created `test/e2e`.
   Added 4 unit files (57 new tests) and `test/e2e/home.spec.ts`; rewrote `test/README.md`.
   Verified: `pnpm test:run` exits `0` -> `Test Files 5 passed (5)`, `Tests 62 passed (62)`;
   `./node_modules/.bin/playwright test --project=chromium` exits `0` -> `2 passed`.
   Config fixes for the e2e run are documented in F12.
6. [DONE] Resolved the stale `.app/*` pages (user chose Option B): promoted both to real routes
   (`app/followers`, `app/following`), repaired the broken `new profileService` call to
   `profileService.getProfilesByIdentityIds(...)`, enabled the disabled `setData`, added sidebar
   links, and `git rm -r .app`. Verified: `tsc --noEmit` exits `0`; `pnpm lint` exits `0`;
   `pnpm test:run` exits `0` -> `Tests 62 passed (62)`; `pnpm build` reaches
   `Generating static pages (36/36)`. Full detail in F8.
7. [DONE] Fixed static-export prerender `window is not defined` (module-scope `getNetwork()` in
   `lib/services/profile-service.ts:549`) via a `typeof window !== 'undefined'` guard so
   `pnpm build` exits `0`. Verified: `pnpm build` exits `0` -> `Generating static pages (36/36)`,
   no export errors; `tsc --noEmit` exits `0`; `pnpm lint` exits `0`; `pnpm test:run` ->
   `Tests 62 passed (62)`. Full detail in F11.
8. [DONE] Audited `lib/wallet-manager.ts` runtime compatibility with
   `dash-platform-sdk@1.5.0-dev.11` / `pshenmic-dpp@2.0.0-dev.29`: imported entry, exported symbols
   (`PrivateKeyWASM`, `GasFeesPaidByWASM`, `fromWIF`), the full `dash-platform-sdk` method surface
   called, and the vendored `wasm_sdk.d.ts` signatures. All compatible; **no files changed**. Found and
   recorded one invariant: the F10 webpack alias is load-bearing for DPP instance identity (browser
   shares one WASM instance; bare `pshenmic-dpp` under Node is a different instance). Full detail in F13.

### Final verification pass (2026-10-02, after all 8 items)

All 8 items above are complete. Re-ran the full suite sequentially after finishing Task 8:
`pnpm build` **exit 0** (`Generating static pages (36/36)`, no export errors), `pnpm lint` **exit 0**
(0 errors / 8 warnings), `pnpm test:run` **exit 0** (`Tests 62 passed (62)`), `tsc --noEmit`
**exit 0**. Details and the warning inventory are in the `## Project Snapshot` verification section.

### Known remaining items (not yet actioned, need a decision)

- `next.config.js` `headers()` is a no-op under `output: 'export'` (build warns twice). Either remove
  the `headers()` block or document that edge/static hosting must supply those headers.
- The 8 `react-hooks/exhaustive-deps` warnings listed in the snapshot. Fixing them is a behavior
  change (refetch semantics), so it requires explicit approval.
- No automated test references `lib/wallet-manager.ts` (relevant to F13's static-only audit).

## Working Rules For This Repo

- Follow the global instruction at `/home/shomari/.pi/agent/AGENTS.md` (deterministic facts, no
  guesses, full sources, minimum diff, 1:1 logic parity).
- After each completed task, update this file (mark the task done and record the verification command
  and result).
