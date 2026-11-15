# HANDOFF — F57 PHASE 1: the reads off the wasm (dapi.sansbank.dev primary)
Session handoff written 2026-11-15 at the close of the F55–F57 sprint.
The next session begins Phase 1 with this document + AGENTS.md as the source
of truth. NOTHING in this doc is speculation — every claim is backed by a
commit, a live verification recorded in AGENTS.md, or an on-chain fact.

---

## 1. WHERE THE PROJECT STANDS RIGHT NOW

**evonext-app v26.11.15+ on master** — the last commits today (the newest last):
`ba3f669` F56g (the connect wasm init + the field removal) → `6bba650` (the
connect button loading state) → `a1ec2ff` F57 kickoff (the retry ladder + the
CSP beacon) → `9eb6010` (the F57 plan doc) → `cf8ccd4` (the F56c AGENTS
record). Everything is DEPLOYED and live-verified on BOTH domains
(evonext.app = mainnet, testnet.evonext.app = testnet) — verify a deploy by
grepping the LIVE chunks (the hashes differ per build environment — never
compare hashes across hosts; grep for the FEATURE STRINGS).

**Gates at close of session**: tsc 0 · eslint 0 errors (the known
postsState warning) · **254/254 tests (28 files)** · playwright 2/2 · the
evorunner builds green. The test suite gained 11 tests today across three
new files (see §5).

**The owner's CPU POLICY (BINDING, added to AGENTS.md F56f)**: ALL CPU-heavy
work (the test suites, tsc, the playwright runs) runs on `Sansbank` (the
local VM) or `evorunner` (LunaNode VPS, 6 cores/16GB, prefer for the heavy
builds) — NEVER on the host. The host = only rsync/ssh/curl/greps. The
trigger: the full vitest suite (28 parallel workers × the 26.5MB wasm
initSync) launched detached several times pegged the host alongside the
owner's own two VirtualBox VMs (Sansbank + APECS = ~57% CPU continuously).
NOTE: `evorunner` gained a **100GB volume** (2026-11-15) — disk is no longer
a constraint there.

**The deploy pipeline** (unchanged, F33): push → Cloudflare Pages builds →
`functions/_next/static/media/[[path]].js` serves the 26.5MB wasm from the
edge (30-day cache + SWR as of F56f) → verify the deploys by grepping the
LIVE chunk feature-strings.

---

## 2. THE WALLET / IDENTITY STATE (all real, all live-verified)

**MAINNET (the active testing wallet — the F36 mnemonic in
`scratch-mainnet-state.json`, gitignored, 24 words):**
- Identity **`CZUa7rTxZZUL3vF5MrtFj1fT2TX5C1YtqnTxT2gFmG3P`**,
  username **`evonextmainnetf55.dash`** — created THROUGH THE PRODUCTION UI
  on 2026-11-15 (the F55 milestone; the lock
  `294f9394eab29e1c48fd9bb80c08f18fcc81d192d517e12f4d8aa725e060561e`,
  block 2572087).
- Balance after the F56 matrix testing: **839,462,820 credits** (nonce 2) ·
  the DIP-17 address `dash1kplq428dxhfc5538nnr5uky4gyjegfex2sgdsgut` =
  **37,177,180 credits** (nonce 3) · the shielded pool ≈ **455M credits**
  unspent · the L1 spendable at the funding address `XbQbuiQaxAqVAu7NLKTDD
  mvd6ngUK2ySAS` ≈ 1.46M sats + the unspendable credit outputs.
- The owner said they would send DASH credits TO `evonextmainnetf55.dash`
  from another identity — **that incoming transfer completes the type-7
  lane on mainnet** (self-transfers are PROTOCOL-FORBIDDEN:
  "Credits transfer recipient must be another identity" — live-confirmed).
  WATCH FOR IT FIRST THING next session: read the identity balance, if it
  grew, record the delta + the lane closes.

**TESTNET**: the F39 identity `EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa`
(`evonextf39nov13identity.dash`) — the private-key login e2e identity; the
F39 mnemonic in `scratch-identity-state.json` (gitignored). The legal-winner
wallet (8Yj6Vu…, in AGENTS) = the older test fund.

**The F36 wallet** = the dedicated mainnet wallet (24-word, coin_type 5) —
the owner-funded real funds; used for ALL the mainnet matrix testing per
the owner's directive.

---

## 3. WHAT SHIPPED TODAY (the F55–F57 index — the details in AGENTS.md)

| Milestone | What |
|---|---|
| **F55/F55b** | PRIVATE-KEY LOGIN live (WIF-only sign-in, the desktop/mobile parity); the first-ever MAINNET identity created through the production UI; the uncontested asset lock HALVED to 0.015 DASH (the DPNS contest threshold moved <20 → <15 chars — live-verified both networks); the registrar's stranded-lock resume fixed (only when a fresh lock is unaffordable) |
| **F56** | THE MOVE MATRIX COMPLETE on mainnet: types 9/11/15/21/17/22 executed with exact deltas (7 = protocol-forbidden self-transfer; 16/18/19 = F36). The wasm SDK is TRUSTED-MODE-ONLY (proven — see §6). The mainnet consensus errors decoded BY HAND (the 5.0.3 StateError variant map); the shield fee gate = shield + 84M + the METERED fee (36.7M–57.1M, varies) |
| **F56b** | The self-transfer guard + toast in the Send UI; the mainnet dashboard's Shielded row FIXED (the engine init retries 3× — the wasm fetch aborts through the Pages Function) |
| **F56c** | The asset-row HIGHLIGHT + the Total-card icon reflects the selection; the DASH-default-on-reload (the persisted selection cleared on mount — the SANS-stuck Send panel can't recur); the Send page 'Send from' selector (Identity/Transparent/Shielded with the live balances) |
| **F56d** | The send-path crash (`wasmsdk_deriveKeyFromSeedWithPath` of undefined) FIXED: the wasm-load retry (3×) in the service + `ensureWasmReady` before every key derivation + **11 regression tests** |
| **F56e** | Each balance loads INDEPENDENTLY + SKELETONS (`IToken.loading`; null = loading, 0 = real zero); the shared DASH/USD price cache; the Send panel's unguarded ticker fetch (the forever-hang on a slow connection) fixed with the cache + an 8s abort |
| **F56f** | THE PREFETCH ROOT CAUSE: `Failed to prefetch quorums: HTTP request error` killed the init with no retry/caching — the trusted-context is now MEMOIZED per network (one success reused forever) + the prefetch+build retries; **the sends use the SERVICE's singleton SDK** (no per-call builder/prefetch); the DUSD/SANS rows ALWAYS present (the skeleton → even zero); the Send button = 'Loading wallet engine…' preflight |
| **F56g** | The private-key login crash (`__wbindgen_malloc`) fixed at the root: **the connect page initializes the wasm ON MOUNT** + the button state; the Identity ID field REMOVED (the discovery is always automatic — the owner: never required) |
| **F57 kickoff** | The init retry ladder 5× (2/4/8/16s ≈ 30s); the CSP beacon allowed; **the empirical proof + the plan: the wasm SDK is trusted-mode-only BY DESIGN** ("Non-trusted mode is not supported in WASM" — verbatim), so the decoupling = the only path to the owner's vision |

---

## 4. THE DECOUPLING PLAN (docs/HANDOFF-F57-decoupling-proxy-primary.md)

The owner's destination: **dapi.sansbank.dev = the primary, no trusted
fetching, the network as the fallback.** The wasm SDK blocks it (trusted-
mode-only), so the app decouples FROM the wasm in three phases. The reads
are ALREADY proxy-first for the identities (F27o) and the shielded (F29)
with per-call wasm fallbacks.

---

## 5. PHASE 1 SPEC — the next session's work

**GOAL: the dashboard's remaining reads (the address-infos + the token
balances) served by dapi.sansbank.dev (the primary) with the direct-network
fallback — the wasm SDK's trusted context leaves the READ path entirely.**

**Target reads** (currently the wasm SDK's
`getAddressesInfos` / `get_identities_token_balances_with_proof_info`):
1. `getAddressesInfos([address])` — the DIP-17 Transparent row's balance +
   the nonce (the wallet page's platformCredits + the Send panel's source
   balances + the moves-service's readTransparentAddress).
2. `getIdentitiesTokenBalances` (the DUSD/SANS rows).

**Option A (PREFERRED if the DAPI team accepts)**: a handoff to
`dev-dapi-proxy` (their repo purges resolved handoffs — read the history or
open fresh) to expose the two methods as JSON, the same shape as the six
shielded methods (F29: `{data,dataB64}` wrappers, the string balances).
Their worker pool = the pshenmic JS-SDK = wasm-free = zero trusted fetching.
**The ask**: `get_addresses_infos` (the params: the bech32m address array;
the response: the map keyed by the variant-form hex `00||hash160` — THE KEY
FORMAT IS LOAD-BEARING, see AGENTS F51c) + `get_identities_token_balances`
(the token-id params, the string balances).

**Option B (no external dependency)**: call the two methods through the
**pshenmic `DashPlatformSDK`** (the JS SDK ALREADY in the bundle —
lib/wallet-manager imports it): `new DashPlatformSDK({network})` connects to
the DAPI seed hosts directly over grpc-web — NO trusted context, NO wasm,
NO proof verification (the plain reads). Both methods exist in the proto
surface (getAddressesInfos / getIdentitiesTokenBalances). RISK to verify
first: the JS SDK's browser-side grpc-web + the CORS against the seed hosts
(the wasm does the same transports so the CORS = likely fine — VERIFY with
a small probe before wiring).

**The wiring pattern**: extend `lib/dapi-proxy.ts` (or a new
`lib/trustless-reads.ts`) with `getAddressesInfosViaProxy(network, addresses)`
+ `getTokenBalancesViaProxy(network, identityId, tokenIds)` — **the
proxy-first with the per-call fallback to the current wasm path** (the exact
F29 pattern: the proxy failure = the logged fallback, never a hard fail).
Then swap the consumers:
- app/wallet/page.tsx (the platformCredits effect)
- components/wallet/assets.tsx (the DUSD/SANS task)
- components/wallet/send.tsx (the refreshSourceBalances)
- lib/moves-service.ts (readTransparentAddress)
Keep `IToken.loading` semantics EXACTLY (null = loading → the skeleton).

**The acceptance test**: the production mainnet dashboard loads the total +
all four rows with the wasm SDK NEVER constructed for the reads (the
console: no `WasmTrustedContext` traffic; the only wasm traffic = the
engine's shielded scan + the login derivation). Then the DAPI-proxy-down
test: block dapi.sansbank.dev (the devtools) → the reads fall back to the
network → NOTHING shows a zero-that-is-a-lie.

**Also in Phase 1 (small)**: the `dev-dapi-proxy` handoff doc if Option A.

---

## 6. THE TRUSTED-MODE PROOF (pin this — it settles the architecture debate)

The wasm SDK, built WITHOUT the trusted context, on ANY read:
```
Context provider error: Non-trusted mode is not supported in WASM.
Please construct a WasmTrustedContext via prefetchMainnet/prefetchTestnet/
prefetchDevnet/prefetchLocal and attach it with WasmSdkBuilder.withTrustedContext().
```
The probe: `scratch-sdk-no-context-probe.mts` (the bundle + the run). The
consequence: **every wasm-SDK consumer carries the flaky DAPI-discovery
prefetch** (`Failed to prefetch quorums: HTTP request error` — live-observed
in the browser AND in Node the same day). Phase 2 kills it for the sends
(the manual transitions + lib/direct-grpc.ts = the F54-proven path, the raw
wire to the seed hosts, no SDK); Phase 3 (the pure-TS slip10 key derivation)
kills the wasm entirely.

---

## 7. THE REGRESSION-TEST ARCHITECTURE (protect it!)

Three layers, born from the owner's demand ("WE NEED MORE TESTS TO BLOCK
THESE REGRESSIONS!!") after THREE production crashes in one day — ALL the
same class (a wasm-glue consumer running before the module load):
1. `test/unit/lib/wasm-glue-init.test.ts` — the MECHANISM: the exact
   production TypeErrors ("reading 'wasmsdk_deriveKeyFromSeedWithPath'",
   the fromWIF path) before the load + the success after initSync.
2. `test/unit/lib/wasm-sdk-service-retry.test.ts` — the SERVICE: a flaky
   init() retries and finishes; 3 failures do NOT poison the singleton; the
   singleton = reset via the constructor's statics in beforeEach.
3. `test/unit/lib/send-credit-readiness.test.ts` +
   `test/unit/lib/private-key-login.test.ts` — the ORDER guards:
   initialize/getWasmSdk MUST run before the first glue touch; the broken
   glue = simulated; the call order = asserted.
**The rule for ANY new wasm-touching code**: it either (a) awaits the
service init first (getWasmSdk/ensureWasmReady), or (b) gets an order test.
THE SETUP GOTCHA: test/setup.ts globally mocks '@/lib/dash-wasm/wasm_sdk.js'
(WITH the .js) with EMPTY stubs — a file that needs the REAL glue overrides
with importOriginal+initSync (the compat-derive pattern); a file that needs
STUBS must declare the mock WITHOUT the .js suffix to dodge the setup
conflict (the two specifiers resolve to the same file — the file-level wins).

---

## 8. THE OPEN ITEMS (nothing blocking, in priority order)

1. **The owner's incoming credit transfer** → closes the type-7 mainnet lane
   (§2). Verify on the session start.
2. **F57 Phase 1** (§5) — THIS is the mandate.
3. **F57 Phase 2**: the sends via the manual transitions + direct-grpc (the
   nonce = the proxy/direct-grpc query).
4. **F57 Phase 3**: the pure-TS slip10 key derivation → the wasm = ZERO →
   the Pages Function + the trusted fetching = DELETED.
5. The F53a-era leftovers: biometric-settings is still imported by nothing;
   the passkey recovery = index-0 only; the react-hooks v6 cleanup pass.
6. The GitHub repo shows ~85 PRE-EXISTING vulnerability warnings (not
   introduced by us) — a dependabot triage pass someday.

---

## 9. OPERATIONAL RULES (all binding — the full text in AGENTS.md)

- **Build ONLY on evorunner** (or the Sansbank VM) — NEVER the host. The
  CPU policy = the test suites too. The heavy vitest = `--maxWorkers=1` on
  the host is the last resort; prefer evorunner.
- **Commit + push to master on completion**; the deploy = automatic
  (Cloudflare Pages); verify by grepping the LIVE chunk feature-strings.
- **Test suites**: `npx vitest run` (the throttled --maxWorkers=1 on the
  host is acceptable; the evorunner = preferred). NEVER leave a detached
  run alive.
- **Review the sources directly for answers** (the owner's standing
  instruction — it broke the F54/F56 deadlock repeatedly: the bincode
  probe, the 5.0.3 StateError variant map, the trusted-mode error).
- The scratch files = untracked; the state files = GITIGNORED (the
  mnemonics/WIFs!). NEVER print a mnemonic/WIF.
- The network probe gotchas: the mainnet insight = a browser UA required;
  the raw wasm SDK in Node = initSync({module: readFileSync(...)}) FIRST;
  the dapi.sansbank.dev = the JSON envelope {success,result}.
