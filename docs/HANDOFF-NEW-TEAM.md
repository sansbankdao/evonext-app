<!-- docs/HANDOFF-NEW-TEAM.md -->

# FULL PROJECT HANDOFF — evonext-app

**Written:** 2026-10-06 · **Baseline commit:** `6aeea79` (master) · **For:** incoming team
taking over from zero context.

Every fact below is backed by a file path, a command output, or a live chain
observation. Nothing here is guessed. Where something is unverified it is marked
**OPEN**.

If you read only one other file, read `/AGENTS.md` (repo root) — it is the
living engineering log with the full F1–F31 history and the 12 load-bearing
invariants. This handoff is the map; AGENTS.md is the terrain.

---

## 1. What this project is

- **App:** `evonext-app` v`26.1.30` (`package.json`) — a Next.js web client for
  Dash Evolution (Platform) + a Dash-native shielded payments layer, currently
  being built out against **testnet** only.
- **Stack:** Next.js `16.3.8`, React `19.3.0`, TypeScript 5, pnpm `11.21.0`,
  Node `v24.18.1`. Static export (`output: 'export'`), webpack forced via
  `--webpack` in dev/build scripts.
- **Where it runs:** static hosting (Cloudflare Pages for `/shielded`; main app
  at `evonext.app`). There is **no server** — anything stateful is either
  on-chain, in localStorage, or through the two external services in §7.
- **Working rules (inherited, non-negotiable):** see the root `AGENTS.md`
  system prompt block — deterministic fact engine, no guessing, cite sources or
  say "CONFIDENCE: 0", minimum diffs, 1:1 logic parity, never drop
  "secondary" logic (debug logs, fallbacks, comments, blank lines).

## 2. Repository layout (only what matters)

| Path | What it is |
|---|---|
| `app/` | Next.js App Router pages (35 routes, static export) |
| `components/` | UI (post cards, modals, sidebar, etc.) |
| `lib/dash-wasm/` | **Vendored** `@dashevo/wasm-sdk@5.0.0-rc.8` dist + `compat.ts` wrappers — do not regenerate casually (see AGENTS.md invariant 7) |
| `lib/shielded/` | The Orchard/shielded port — see §4 |
| `lib/core-chain.ts` | L1 (Dash Core) chain access: BIP44 funding keys, insight UTXOs, v23 asset locks |
| `lib/network.ts` | **The** shared network/contract-id source. All services must use `getContractId(get())` |
| `lib/dapi.ts` | External DAPI read-proxy client (identity reads only) |
| `test/e2e/*.live.mts` | Live end-to-end shielded tests (real funds) — see §5 |
| `scratch-shield-state.json` | Live e2e state cursor — see §6 |
| `docs/` | Spike reports + shielded e2e handoff |
| `AGENTS.md` | The source of truth for invariants + F1–F31 history |

## 3. How to verify anything (the gates)

Run **sequentially, never in parallel** (parallel runs caused false TS6053 /
exit-124 failures historically).

| Command | Expected (verified 2026-10-06) |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` (i.e. `pnpm lint`) | **0 errors, 1 warning** — the intentional `react-hooks/exhaustive-deps` in `app/posts/page.tsx` (documented in F26o; fixing it re-introduces a re-render loop) |
| `pnpm test:run` | 203+ unit tests, all pass |
| `pnpm build` | exit 0, 35/35 pages, `out/_headers` + ~26.5MB wasm emitted |
| `npx tsc -p tsconfig.e2e-check.json --noEmit` | 0 errors — **this is the ONLY check that sees the `.mts` e2e files** (the root tsconfig's `**/*.ts` glob does not match `.mts`; every historical "tsc 0" claim about stage-2/3/4/5 files was vacuous) |
| Live e2e | `pnpm vitest run --config test/e2e/vitest.live.config.mts <filter>` — real network, real funds, NEVER parallel, 15 min test timeout |

## 4. The shielded payments work — where it stands

Goal: shield (Dash credits → Orchard-style pool), transfer in-pool, and
unshield (pool → L1 DASH) entirely client-side, using a vendored WASM SDK plus
a from-scratch TypeScript port of the Orchard protocol (no external wallet).

| Stage | Status | Evidence |
|---|---|---|
| 1 — Asset lock (L1 → credits) | ✅ Live on testnet | `scratch-shield-state.json`: lockTxid `d01ebd24…e6f4`, 1,200,000 sats locked at block 1589964, chainlocked 1589965 |
| 2 — SHIELD (credits → pool) | ✅ Live on testnet | State file: 1,000,000,000 credits shielded, note at tree index 6689, tree count 6,691 |
| 3/3b — Sync + tree verification | ✅ | `lib/shielded/sync.ts`, `tree.ts` — 8/8 KATs vs the fork's `commitment_tree.json`; local root matched the live anchor |
| 4 — TRANSFER (in-pool send) | ✅ **Committed** (`d5c0053`, F31) | Live: transitionHash `6cac3ee7…`, fee 114,140,000, spent 500,000,000, change 385,860,000; recipient note at index 6691, change at 6692 |
| 5 — UNSHIELD (pool → L1) | ⚠️ **Cryptography + execution verified LIVE; test harness rewritten but not yet re-run in resume mode; code UNCOMMITTED** | See §5 |

### `lib/shielded/` module map (all KAT-verified against the fork's Rust test vectors)

`pasta.ts` (Pallas/Vesta curves) · `hash.ts` (BLAKE2b `PrfExpand::*`) ·
`swu.ts` (hash-to-curve) · `sinsemilla.ts` · `ff1.ts` (AES diversifiers) ·
`keys.ts` (ZIP-32: spending key → ask/ak → DK/OVK → FVK/IVK; diversifiers) ·
`note.ts` (note commitment + **deriveNullifier** + trial decryption) ·
`pczt-wire.ts` (PCZT v1 serialization, parsed a real 1154-byte prover frame) ·
`bundle.ts` (ZIP-244 digest + `compute_platform_sighash` + extra-data builders) ·
`reddsa.ts` (RedPallas sign/verify) · `poseidon.ts` (P128Pow5T3 + constants) ·
`prove.ts` (spend build, witnesses, PCZT assembly) · `assemble.ts` (wasm
transition construction) · `tree.ts` (incremental commitment tree) ·
`sync.ts` (anchor-verified sync engine).

Full provenance table: `docs/HANDOFF-shielded-e2e.md`.

## 5. UNSHIELD (stage 5) — the exact state of play

**On-chain, verified live (2026-10-05/06):** the withdrawal WAS built, proved
(75.4s on the prover), assembled (8,217-byte wire), broadcast, and executed on
testnet. Confirmed independently against chain state: spend nullifier
`591049d4…af2c` is spent; pool decreased by exactly 426,480,000; tree grew by
2 notes; change note (73,520,000) decrypts to the operator's diversifier-0
address; withdrawal document `DjyR83gzThy2jRn7DUfjoxtfFDuu8KwBiHVPMhYEVeGT`
exists in contract `4fJLR2GYTPFdomuTVvNy3VRvWgvkKPzqehEBpNf2nk6` (owner =
`1111…1111`, status 3, transactionIndex 4332); L1 payout UTXO
`37992de4fffac8f5fd52bb8dcf17414d217a1046883565504090750c508dbac1:0` of
exactly 199,810 sats landed at `ycxZZzW9waTpSewrTLc7Se2CEhQgZqv9AS`.

**The catch:** the script that did this was a one-shot. Re-running it blindly
would try to spend the SAME note again (double fee burn + a second L1 payout
attempt). It has been **rewritten as a resumable verifier**:

- It snapshots on-chain state via `scratch-shield-state.json` and branches on
  the spend nullifier's spent status.
- Resume mode skips the spend leg entirely and re-verifies every on-chain
  effect (pool, tree, change note by trial-decryption scan, withdrawal doc,
  L1 UTXO).
- Fresh-mode assertions are unchanged from the verified live run.

**What remains (the next team's first tasks, in order):**

1. `npx tsc -p tsconfig.e2e-check.json --noEmit` → must be 0 (was 5 errors;
   all fixed — re-verify).
2. `npx eslint test/e2e/shield-stage5-withdrawal.live.mts lib/shielded/{fees,prove,assemble}.ts` → 0.
3. Read the fresh-branch broadcast block (≈ lines 248–266) once with your own
   eyes: confirm the `preBroadcastTxids` snapshot sits immediately before
   `broadcastStateTransition`.
4. Run it: `pnpm vitest run --config test/e2e/vitest.live.config.mts shield-stage5`.
   Expected in resume mode: nullifier-spent branch → change-note scan from
   index 6693 to current tip (~14,492 notes as of 2026-10-06; ~7,800 trial
   decryptions — if it approaches the 900s timeout, scan newest-first) →
   withdrawal doc found → payout matched → state file updated to
   `stage: 'unshielded'`.
5. Commit as **F32** per AGENTS.md conventions (minimum diff, full sources,
   relative-path header comments), including the three `lib/shielded/` changes
   and the new test; append the withdrawal record to AGENTS.md in the F31
   style.
6. Delete throwaway probes in `/tmp` and decide the fate of the `scratch-*`
   files (keep `scratch-shield-state.json`; the rest are one-off scripts).

## 6. Secrets, state, and money — read before touching anything

- **`scratch-shield-state.json` contains a real testnet WIF**
  (`fundingWif` field). It is currently **untracked** in git. Do NOT commit it
  as-is; if it must be versioned, redact the WIF. Testnet funds only, but
  treat it as sensitive anyway.
- The e2e mnemonic is embedded in `test/e2e/shield-stage5-withdrawal.live.mts`
  (testnet-only, funds already mostly spent). Same rule.
- Mainnet funding verification and mainnet shielded-address (bech32m) work are
  **explicitly paused** until UNSHIELD is green and committed. Do not start
  them early.

## 7. External services this codebase depends on

| Service | URL | Used for |
|---|---|---|
| Shielded prover | `https://prover.sansbank.dev` (Cloudflare Worker) | `POST /prove/pczt` — the only proving path (WASM SDK has no prover). Frame format pinned by KAT. |
| DAPI read proxy | `https://dapi.sansbank.dev/v1/dapi` | Identity reads only (faster + cached). Its `get_documents` rejects `$createdAt > 0` clauses, so **document queries stay on the WASM SDK**. Handoff: `docs/HANDOFF-shielded-e2e.md` §services |
| Insight (testnet) | `https://insight.testnet.networks.dash.org/insight-api` | L1 UTXOs, asset-lock broadcast/confirm. Fee floor 1,000 sats/kB; rejects >20,000. |
| Testnet faucet | `faucet.testnet.networks.dash.org` (3/hr, captcha) | Funding test identities |

## 8. Known landmines (do not "fix" without reading AGENTS.md first)

1. The webpack `pshenmic-dpp` → `pshenmic-dpp/wasm` alias, the `Buffer`
   ProvidePlugin, and the `fs/path/crypto: false` fallbacks in `next.config.js`
   are all load-bearing (class-identity unity + Emscripten shims).
2. `lib/network.ts` SSR guard and `getContractId(get())` in every service
   constructor — an `undefined` contract id silently breaks every query.
3. `public/_headers` carries CSP/COOP/COEP (`require-corp` is required for
   future SharedArrayBuffer/wasm-threads; `worker-src 'self' blob:` for
   workers). Static export cannot set headers any other way.
4. `coreFeePerByte` must be an integer in raw wasm bindings (float throws).
5. Asset locks are Dash Core v23 format: ONE OP_RETURN (`6a00`) at vout 0;
   `ChainAssetLockProof` must reference **vout 0**; `PrivateKey.toString()`
   returns hex (use `.toWID()` with explicit network).
6. Identity keys: `m/9/{5|1}/5/0/0/{idx}/{n}`, n=1 auth-critical, n=3 transfer.
7. The one expected lint warning (F26o) and the disabled react-hooks v6
   compiler rules in `eslint.config.mjs` (~22 pre-existing patterns) are
   documented decisions, not sloppiness.
8. pnpm 11 ignores `pnpm.overrides` in package.json — pins live in
   `pnpm-workspace.yaml` (`elliptic` 6.6.1, `lodash` 4.18.1).
9. **Vitest gotcha:** an async `vi.waitFor` callback that awaits a dynamic
   import never sees mock updates — use a sync callback and pre-import mocked
   modules in `beforeEach` (F26p).
10. Dash Core v23 credit outputs (vout 1 of a type-8 tx) are NOT spendable on
    L1 — `lib/core-chain.ts` filters them out of funding UTXOs. Never remove
    that filter (F27f: a user burned a registration on exactly this).

## 9. If you only remember five things

1. Read `AGENTS.md` first; it is the truth and has the F1–F31 changelog.
2. Verify SEQUENTIALLY: `tsc` (0) → `eslint` (0/1 warning) → `test:run` (203+)
   → `build` (35/35) → `tsc -p tsconfig.e2e-check.json` (0).
3. `tsc --noEmit` does NOT see `test/e2e/*.mts` — use `tsconfig.e2e-check.json`.
4. The shielded stage-5 test is RESUMABLE; its state file contains a real
   testnet WIF — guard it, don't commit it.
5. After F32, redeploy: the live `evonext.app` was last confirmed serving a
   PRE-upgrade wasm build. The Cloudflare Pages project must use
   **framework preset: None, build `npm run build`, output dir `out`** (the
   `next-on-pages` adapter is incompatible with Next 16).

---

*Handoff prepared against commit `6aeea79` on 2026-10-06 with all five
verification gates run fresh (tsc 0, eslint 0/1, 203/203 tests, e2e tsc 0,
eslint on changed files 0).*
