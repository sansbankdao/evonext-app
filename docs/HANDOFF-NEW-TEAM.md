<!-- docs/HANDOFF-NEW-TEAM.md -->

# FULL PROJECT HANDOFF — evonext-app (2026-11-13 edition)

**Written:** 2026-11-13 (end of the F29–F37b session) · **Baseline commit:**
`cd1df66` (master) · **For:** incoming team with ZERO context.

Every fact is backed by a file path, a command, or a live chain observation
— nothing guessed. Unverified items are marked **OPEN**.

READ `/AGENTS.md` SECOND. It is the complete engineering log (F22–F37b) with
all load-bearing invariants; this document is the map into it.

---

## 1. What happened in the last two sessions (the headline)

**SHIELDED DASH IS NOW A WORKING PRODUCT ON MAINNET.** The complete chain —
L1 asset lock → SHIELD (into the Orchard-style pool) → in-pool TRANSFER →
UNSHIELD (back to L1) — was executed **live on MAINNET with real funds**
(F36), after being proven on testnet (F29–F32). The `/shielded` viewer is
live in production on BOTH networks (F37/F37b), the deploy pipeline that was
broken for 3 weeks is fixed (F33), and the Android passkey unblock shipped
(F34).

Mainnet evidence (all verified live):
- Asset lock tx `f7126f9d3068e4594b316bf8ab5af5ad0515fed37427c5d4cb76d90ece93049e`
  (1.2M sats, block 2571235, insight:
  https://insight.dash.org/insight-api/tx/<txid>)
- Shielded note at tree index 5257/5259, 1B credits, decrypted with the
  coin-type-5 IVK — cryptographic proof the shield executed
- Transfer executed: hash
  `83bbb079ecc75ccf06149cc83bbb39553c4d40434140dff99c0ec2efa41ac4b3`
  (https://platform-explorer.com/transaction/<hash>)
- Unshield executed: withdrawal doc
  `2usNzQ7qDLCeZFjTqUnyLa2AdWXBFK2fxvbYxWBLmxao` in the system contract
  `4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6` (SAME contract ID on both
  networks), **L1 payout tx
  `c86f7d590ad77a904a076aaa4633d48e1ee97680bf3410e4ddc817a95c2bc7ce` =
  exactly 199,810 sats** (= 200,000 − ASSET_UNLOCK_TX_SIZE 190)
- Live pool on production: https://evonext.app/shielded renders the mainnet
  balance (856.8463 DASH ≈ $35,036 USD at last check; pool grows with
  third-party activity)

## 2. Project snapshot

- `evonext-app` v`26.11.12` — Next.js `16.3.8` + React `19.3.0`, TypeScript
  5.9.3, pnpm `11.21.0`, Node 24 (`.nvmrc`); static export (`output:
  'export'`), webpack forced via `--webpack`. Host: `/Workspace/sansbank/
  evonext.app`; remote `git@github.com:sansbankdao/evonext-app.git` (public).
- Deploys: Cloudflare Pages, git-triggered, framework preset **None**,
  build `npm run build`, output `out` (F26b). The 25 MiB/file limit (F33)
  is handled by the wasm Pages Function — see §6.
- Live: https://evonext.app — production network = mainnet
  (`lib/network.ts` getNetwork: host `evonext.app` → mainnet; everything
  else → testnet; SSR fallback testnet).

## 3. Verification gates — run SEQUENTIALLY, never in parallel

| Command | Expected |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, **1 warning** (intentional `postsState` exhaustive-deps in `app/posts/page.tsx`, F26o — fixing it re-breaks the feed) |
| `pnpm test:run` | **213 tests / 20 files**, all green |
| `pnpm build` | exit 0, 32 route HTMLs + `_headers` + `out/_routes.json`, NO wasm in `out/` (stripped) |
| `npx tsc -p tsconfig.e2e-check.json --noEmit` | 0 — **the ONLY type-check that sees `.mts` files** (root tsconfig glob excludes them; historical "tsc 0" over e2e was vacuous) |
| `npx playwright test --project=chromium` | 2 passed (serves `./out` via `test/static-server.mjs`) |
| Live e2e | `pnpm vitest run --config test/e2e/vitest.live.config.mjs shield-stage5` (testnet) — real network; never parallel; 15-min timeout |

**NEVER BUILD ON THE HOST.** User directive, re-emphasized 2026-11-12 and
covering ALL builds (Rust AND `pnpm build`): build on `evorunner`
(ssh alias, 172.81.178.120, Node 22.22 + corepack pnpm 11.21.0, repo rsync'd
to `~/evonext/web`) or the `sansbank` VM (127.0.0.1:2223). Host `tsc` /
`eslint` / unit tests / playwright / network probes are fine.

## 4. Secrets and state files — HANDLE WITH CARE

| File | Contents | Rules |
|---|---|---|
| `scratch-mainnet-state.json` | **REAL mainnet mnemonic (24-word) + WIF** for the dedicated e2e wallet; the wallet holds **~959M shielded credits in the pool** (500M d1 idx 5261, 385.86M d0 idx 5262, 73.52M d0 idx 5263) + ~31.9K duffs change on L1 | GITIGNORED (`/scratch-mainnet-state.json`). NEVER commit. It is the resume key for every mainnet stage script. |
| `scratch-shield-state.json` | testnet mnemonic/WIF + full stage state (`stage: 'unshielded'`) | GITIGNORED. Testnet funds only. |
| `scratch-*.mjs/.mts/.bundle.mjs` | stage harnesses (testnet + mainnet, NO secrets inside — they read the state files) | Untracked by convention; keep for reproducibility, delete at will. |

## 5. The shielded stack — what exists and where

`lib/shielded/` (~4,400 lines, all KAT-verified against the pinned fork):
`pasta.ts` (curves) · `hash.ts` · `swu.ts` · `sinsemilla.ts` · `ff1.ts` ·
`keys.ts` (ZIP-32; **coin_type 5 = mainnet, 1 = testnet**) · `note.ts`
(encrypt/decrypt/`deriveNullifier`) · `pczt-wire.ts` · `bundle.ts` (ZIP-244
digest + `compute_platform_sighash` + extra-data builders) · `reddsa.ts` ·
`poseidon.ts` · `prove.ts` (`buildOutputOnlyPczt` / `buildTransferPczt` +
`extraSighashData`) · `assemble.ts` (`assembleShieldFromAssetLock`,
`assembleShieldedTransfer`, `assembleShieldedWithdrawal`) · `tree.ts`
(incremental tree + witnesses) · `sync.ts` · `fees.ts` (`computeMinimum
ShieldedFee` = 114,140,000 for 2 actions; `computeShieldedWithdrawalFee` =
226,480,000) · **`address.ts` (F35: bech32m `dash1z…` codec, HRP dash/
tdash, type byte 0x10, pk_d Pallas validation)**.

Fees are CONSENSUS-PINNED — never invent a fee field. value_balance must
equal the computed fee EXACTLY. Provenance table: `docs/HANDOFF-shielded-e2e.md`.

## 6. Deployment architecture (F33 — read before touching the build)

- Cloudflare Pages rejects any bundle file > 25 MiB; the wasm SDK is
  26,513,399 bytes (25.29 MiB, no strippable sections — checked). So:
  - `pnpm build` = `next build --webpack && node scripts/strip-wasm-from-out.mjs`
    → deletes the wasm from `out/` + writes `out/_routes.json`
    (Function covers ONLY `/_next/static/media/wasm_sdk_bg*`).
  - `functions/_next/static/media/[[path]].js` proxies the COMMITTED wasm
    from raw.githubusercontent (repo public), `application/wasm` +
    immutable cache. Client code unchanged.
- Verify a deploy: served wasm URL (content-hashed, e.g.
  `wasm_sdk_bg.e9693c35.wasm`) → 200 + `application/wasm` +
  `content-length: 26513399` + sha256 `4c50b471b45466c2…`; `/shielded` →
  200. NOTE: HEAD on that URL returns odd text/html headers from the asset
  layer — harmless; browsers GET.
- `main-app-*.js` chunk hashes differ per build environment (evorunner Node
  22 vs Cloudflare Node 24) — benign; the cross-env invariants are the wasm
  sha256 + page set + `_headers`, NOT chunk hashes.

## 7. Hard-won gotchas (each one cost a session; do not rediscover)

1. **Mainnet insight (`insight.dash.org`) Cloudflare-challenges non-browser
   UAs** — every fetch needs a browser `User-Agent` + retry-on-challenge;
   `/tx/<txid>` may LACK `blockheight` — confirm via the
   `/addr/<addr>/utxo` `height` field of the lock's vout-1 credit output.
2. **esbuild + wasm two-instance bug** in scratch harnesses: a runtime
   `import(new URL(...).href)` of the wasm glue creates a SECOND, uninitialized
   instance beside the one bundled into `lib/shielded/assemble.ts`. ALWAYS
   `import * as wasm from './lib/dash-wasm/wasm_sdk.js'` STATICALLY. Also:
   esbuild-bundled dashcore-lib needs
   `--banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"`.
3. **`signByPrivateKey` requires a PrivateKey INSTANCE** (`wasm.PrivateKey
   .fromWIF(wif)`) — not a WIF string ('expected instance of _PrivateKey').
4. **vite 8 bundles vitest configs with rolldown 1.2.18**, which emits glob
   text (`**/…/**`) from BLOCK COMMENTS as live code — never put glob text in
   config-file comments. Also `defineConfig` breaks on `@vitejs/devtools/config`
   (not installed) — `test/e2e/vitest.live.config.mjs` exports a plain named
   object.
5. **Mainnet pool is BUSY**: pool-delta exactness across a window is broken by
   third-party transitions (tree grew +4 during one stage). Proof = identity
   checks (local tree root == live anchor, witness fold, nullifier reveal,
   notes decrypt) — not pool deltas.
6. Asset locks (Core v23): ONE OP_RETURN (`6a00`) at vout 0 + equal P2PKH
   credit output; proof references vout 0; locking X costs ~2X on-chain;
   L1 payout = amount − 190×coreFeePerByte. Credit outputs (vout 1) are NOT
   L1-spendable — `lib/core-chain.ts` filters them (F27f).
7. `initialize()` no-ops on a matching config — cross-network callers MUST
   compare `wasmSdkService.initializedNetwork()` and re-init (F37).
8. The one expected lint warning (F26o) and the disabled react-hooks v6
   compiler rules are documented decisions.
9. Host-side quirk: long-running bash under load — the shielded-sync
   "rewinds the mutable tail" test has an explicit 300s timeout (F34) because
   full-suite parallelism saturates the host.
10. evorunner cargo registry can have corrupt extractions ('failed to read
    …/Cargo.toml') — delete the named crate from BOTH
    `~/.cargo/registry/src/index.crates.io-*/` and `…/cache/…` then re-fetch.

## 8. Backlog — recommended order (from the 2026-11-13 review)

1. **In-app shielded wallet (TOP PICK)** — balance ("Find my notes" scan
   already computes it), **send to a `dash1z…` address** (`lib/shielded/
   address.ts` decodes it; build/assemble pipeline proven 3× live),
   receive = display your address. Turns shielding into a user feature; the
   e2e wallet's ~959M credits are perfect real-funds test funds.
2. **Dependabot triage — 85 vulns, 8 critical** (GitHub actively flags it).
3. **Hygiene batch:** footer links 404 (`/privacy` `/cookies` `/about`
   `/terms` — routes not in the export); CSP blocks Cloudflare's injected
   analytics beacon (allow or disable RUM); confirm withdrawal doc status
   flipped 2 → 3 (payout confirmed).
4. **Decide the e2e wallet funds** — keep as task-1 test funds (recommended)
   or unshield the remainder.
5. Later: app-services mainnet enablement (social needs a mainnet Yappr
   contract that doesn't exist — `EVONEXT_CONTRACT_ID_MAINNET = ''`),
   react-hooks v6 cleanup, multi-identity passkey recovery, DIP-17 address
   features, biometric-settings UI.

## 9. External services

| Service | URL | Notes |
|---|---|---|
| Shielded prover | `https://prover.sansbank.dev` (`POST /prove/pczt`) | The only proving path; ~60–135s; consensus-verified 4× live |
| DAPI proxy | `https://dapi.sansbank.dev/v1/dapi` | Identity reads only; mainnet backend was stale v13 (proxy-mainnet-stale caveat); shielded queries go through the WASM SDK directly |
| Insight mainnet | `https://insight.dash.org/insight-api` | UA-challenged (gotcha 1) |
| Insight testnet | `https://insight.testnet.networks.dash.org/insight-api` | |
| Price feed | `https://dashswap.xyz/v1/ticker/DASH` | CORS *, used by wallet + /shielded |
| Platform explorer | `https://platform-explorer.com/transaction/<hash>`, `/document/<id>`, `/dataContract/<id>` | Verified routes (mainnet) |
| Assetlinks | `https://evonext.app/.well-known/assetlinks.json` | F34 — production + debug fingerprints; blocks Android passkeys if wrong |

## 10. If you only remember five things

1. Read `/AGENTS.md` — it is the truth (F22–F37b, invariants 1–12).
2. NEVER build on the host — `evorunner` or `sansbank` only.
3. Gates sequentially: tsc 0 · eslint 0/1 · 213/213 · build (no wasm in out/)
   · e2e-tsc 0 · playwright 2/2.
4. `scratch-mainnet-state.json` holds a REAL mnemonic + the wallet's
   ~959M shielded credits — gitignored, never commit, keep safe.
5. Deploys are git-triggered and healthy since F33; verify by wasm sha256
   (`4c50b471…`) + `/shielded` 200.

*Prepared 2026-11-13 against `cd1df66` with all gates green.*
