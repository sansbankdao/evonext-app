# HANDOFF — Session close 2026-11-18 (F57i → F57j.6) — NEXT: complete the SWAP tab + UI cleanup

Repo: `/Workspace/sansbank/evonext.app` · HEAD `c24cc9f` on origin/master (ALL pushed).
Gates at close: tsc 0 · eslint clean · **363/363 tests (40 files)** · build green ·
**the Cloudflare Pages pipeline FIXED (F57i) — every push builds and deploys again**.

---

## 1. What this session shipped (oldest → newest)

| Commit | What |
|---|---|
| `6c26081` | **F57i — the Pages pipeline UNBROKEN.** Every build since F57d failed with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: the F57d overrides were never written into the committed `pnpm-lock.yaml` (the evorunner installs had rewritten ITS copy — the divergence was invisible off CI). Lockfile regenerated against master's exact files on evorunner + `minimatch@11.0.9` added to `minimumReleaseAgeExclude`. |
| `d85c9bc` | **F57j — the receive tiles explain the locked session** ('Session locked — restore your keys above' instead of a silent `…`) + the `evonext:session-unlocked` event from `restorePayload` + the banner's reconnect copy fix. |
| `5b0eeef` | **F57j.2 — the shielded receive address retries until the engine is ready** (the fixed 10×3s retry died at ~33s; the cold worker init lands ~45s). |
| `85ad9e2` | **F57j.3 — the in-place recovery-phrase UPGRADE for WIF-only sessions** (`upgradeSessionWithMnemonic`) + the banner's amber 'Private-key session' card + `hasMnemonic` on `SessionLockInfo`. |
| `9081cf8` | **F57j.4 — the LIVE asset prices from `dashswap.xyz/v1` tickers** (per the owner's directive): DASH/SANS/DUSD tickers (CORS `*` on all three), per-symbol 10-min caches, the pinned constants = fallbacks only. SANS $0.0598 live vs the stale $0.01. |
| `4a6628f` | **F57j.5 — the seed-upgrade paste crash fixed** (`__wbindgen_malloc`): validation moved to pure-JS `@scure/bip39` `validateMnemonic` (v2 = boolean-returning) + the F56g ensure-init before the derivation. |
| `c24cc9f` | **F57j.6 — the phrase-mismatch error names BOTH identities** ('…not this session's identity (…). Paste the phrase that created THIS identity'). |

Live-verified at close: the wallet chunk `page-860b000eec5f4e67.js` carries the F57j.5 copy
('never ask again'); the F57j.4 price cache keys + the dashswap fetch URLs are in the deployed
chunks; the F57j.6 push builds via the fixed pipeline.

**The owner's session arc this round:** stale-deploy discovery → the dashboard build log
obtained → the lockfile root cause fixed (F57i) → the deposit/locked-tiles UX (F57j/j.2) →
the WIF-only dead end understood and bridged (F57j.3) → the live prices (F57j.4) → the paste
crash + the 'why ask again' question (F57j.5, F57j.6). **The owner ended the session with
'ALL GOOD!' after successfully understanding the shielded-needs-seed constraint.**

---

## 2. THE PRODUCT TRUTH established this session (do not regress)

1. **The key material is MEMORY-ONLY** (the F57b model, owner-approved): wiped on every
   unload; restored via the unlock ladder. The banner (wallet page, above the tabs) is the
   gate: PRF vault → one ceremony; password vault → one password; neither → reconnect.
2. **WIF-only sessions can NEVER see shielded/seed features** — the Orchard keys are a
   ZIP-32 TREE derived from the seed; a single private key is one leaf and cannot
   reconstruct the tree. Same on desktop/mobile (protocol-level, not an app choice).
   The bridge = `upgradeSessionWithMnemonic` (the amber card): paste the phrase that
   created THIS identity → validated pure-JS → the credentials resolved exactly the
   connect way → verified against the session identity (a mismatch refuses AND rolls the
   memory back exactly) → stored + announced. **On success with an existing password
   vault: `markPasswordVaultStale` → the re-save nudge → one password restores everything
   on every reload — the ask-again loop ends.**
3. **The owner's identities** (testnet):
   - `atlanta-degen-for-life` / `AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm` (~49 DASH)
     — created WITH a seed; the current session identity.
   - `ADtgYG2…` — the owner's older identity (the phrase they pasted belonged to it; the
     guard refused correctly).
   - The e2e identities: `EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa`
     (evonextf39nov13identity.dash; the mnemonic in `scratch-identity-state.json`; the
     HARDENED-path WIF fixtures on evorunner at `/tmp/f39-auth-wif` + `/tmp/f39-transfer-wif`,
     derived by `scratch-derive-hardened.mts`); `8Yj6Vu…` (the legal-winner wallet);
     the settlement identity `DpLt5xyRoACYkXjbVa95nzzG7ZtpiEcTGWR5W6es4xmh`.
4. **The prices live from `dashswap.xyz/v1/ticker/{DASH|SANS|DUSD}`** (CORS `*`; 2026-11-18:
   $37.38 / $0.0598 / $1.00). The constants in `lib/constants.ts` (`DUSD_USD_VALUE=1.00`,
   `SANS_USD_VALUE=0.01`) = OFFLINE FALLBACKS only — a zero/negative live price falls back,
   never `0 × balance`. Cache keys `evonext_tok_usd_<SYM>` + `evonext_dash_usd` (10-min TTL,
   8s abort, non-fatal everywhere — the F56e never-block rule).

---

## 3. NEXT SESSION — MISSION A: complete the SWAP tab

The app-side swap track is DONE and PROVEN WITH REAL FUNDS (F58/F58.1 in AGENTS.md — read
both fully): the network-aware Pages Function, the quote→create→deposit→status ladder, the
pinned status vocabulary (pending → detected → confirmed → settling → settled), the
`dest_txid` semantics (the engine's internal dedupe key — NEVER displayed/linked as a chain
receipt), and the LIVE testnet round-trip that settled exactly (the e2e identity holds
tSANS 37,387,500,000 = the expected delta; their pool math exact to the digit).

REMAINING, in the order the owner will likely want:

1. **The UI verification pass on the SETTLED state** (F58.1's explicit leftover): drive the
   real browser over the swap `70cb1414-…` record (in `evonext_swaps_testnet` of the e2e
   session) — the settled badge, the dest_txid display + copy, the SANS row on /wallet.
2. **The DUSD direction** (DASH→DUSD): only DASH→SANS was proven end-to-end. The same
   ladder, different token decimals (6) — verify the quote→create→settle display path.
3. **The reverse direction / the flip button**: the bootstrap is ONE-WAY (DASH→tokens);
   the flip button is disabled with the note. The DashSwap team owns the reverse lane —
   check `../dashswap-api` for any movement before touching it.
4. **The still-open DashSwap questions** (the F47 ten, `../dashswap-api/EVONEXT-SWAP-UI-HANDOFF.md`):
   (8) overpayment/underpayment REFUND semantics — the engine has NO refund/failure states
   (the honest 'contact support' copy stays until they ship one); the F58 live deposit ALSO
   swept an unattributed 0.5 tDASH into the swap (their unspent-total semantics) — decide the
   user-facing display for overpayment; (9) webhook/SSE future; (10) rate limits; (2) a
   dynamic direction/min-max endpoint.
5. **Mainnet swap enablement** — awaiting the owner's mainnet top-up (their directive from
   the F58 era).
6. **The recipient choice**: the bootstrap settles to SELF (dest_platformid = the session
   identity). If the owner wants swap-to-another-identity, that is THEIR engine change —
   file it, do not improvise.

The swap code: `components/wallet/swap.tsx` (608 lines), `functions/api/dashswap/[[path]].js`
(the network-aware key-holding proxy; the secrets set via the wrangler path from the owner's
staged keys). Their repo: `../dashswap-api` (the handoff + the ACK docs live there).

## 4. NEXT SESSION — MISSION B: the UI cleanup list (itemized, with files)

1. **The idle re-lock timer + 'Lock now'** (the B4 backlog, owner-approved direction):
   `lib/secure-storage.ts` storePrivateKey's comment names it; the visible re-lock button +
   an idle timer; wire into the SessionLockBanner (lock = clear the memory + show the
   locked ladder).
2. **The Notifications sidebar entry** (the old queue item — the page exists at
   /notifications, reachable only by URL; add it to BOTH sidebar nav lists like the
   Shielded Pool pattern from F37b).
3. **deposit.tsx vestigials** (the F50 makeover left dead parts):
   - the bottom 'Choose a deposit currency:' selector + Copy/Share block (an old-card
     remnant below the Move card);
   - `depositAmount`/`handleChangeAsNumber`/`isShowingCurrencyOptions` state — check for
     renderers before deleting;
   - the commented-out blocks (~lines 62-65, 163-166, 198-200, 301) and the stale
     'Scan the QR code… click the image' copy on the 340px identity QR;
   - the identity card is a `<Link href={Identity.address}>` — an identity id is NOT a
     route; click behavior = whatever the Link resolves (likely a 404) — decide copy vs
     explorer link.
4. **assets.tsx dead state**: `displayDusdBalanceUsd`/`displaySansBalanceUsd` (declared,
   never set/used) — remove.
5. **The Move card 'From' ellipsis**: the owner's screenshot showed `From: Transparent |
   Shielded | …` — the transparent option shows '…' before the address resolves; give it
   the same locked/loading treatment.
6. **The engine-derived SHIELDED history as the FIFTH History source** (the queue item):
   F41's buildShieldedHistory (sent/self/received from the local scan, no DAPI) into
   `lib/wallet-history.ts`'s mergeActivity + the History tab.
7. **Retire the `evonext_bio_*` biometric theater** (the backlog item;
   `lib/biometric-storage.ts` = auth theater per F27b) — check consumers before removing.
8. **Cursor pagination** (`nextCursor` unwired — the queue item) for the history reads.
9. **The optional owner item**: consolidate the two tiny L1 UTXOs (1,620 + 49,620 sats on
   the settlement wallet's funding address) — an L1 self-send; needs their say-so.
10. **The GitHub Dependabot banner** ('85 vulnerabilities') = the per-path pre-scan count;
    `pnpm audit` = 1 (elliptic, unpatchable upstream, pinned 6.6.1). Nothing to do; it
    refreshes async.

---

## 5. Environment cheat-sheet (all verified this session)

- **Builds/tests NEVER on the host** (the owner CPU policy). evorunner: `ssh evorunner`,
  workdir `~/evonext/web`, node22 at `~/.local/node22/bin` (export PATH), pnpm via
  corepack (`COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.21.0 …`).
  rsync pattern: `rsync -aR <files> evorunner:~/evonext/web/` (the -aR relative delivery —
  the F58d misdelivery lesson).
- **Deploy = `git push -q origin master`** → the FIXED pipeline builds. ALWAYS verify the
  DEPLOYED behavior afterward (a live chunk hash + a marker-string grep), not the upload.
- **Playwright on evorunner**: the bundled chromium (the 'chrome' channel is GONE —
  /opt/google/chrome not found; drop `channel: 'chrome'`). **:3000 is SQUATTED by a foreign
  app that 303s to /user/login** (the static server EADDRINUSEs silently behind it) — use
  the dedicated :3999 (`PORT=3999 node test/static-server.mjs`; `fuser -k 3999/tcp` after).
- **The SPA nav in probes**: click the VISIBLE `a[href="/wallet"]` via
  `evaluate(() => { const ls=[...document.querySelectorAll('a[href="/wallet"]')];
  const i=ls.findIndex(el=>!!el.offsetParent); if(i>=0) ls[i].click() })` — the first match
  is often a hidden mobile-footer link and Playwright times out on it.
- **The F57i validation recipe** (use it for ANY future CI-step doubt):
  `git archive HEAD | ssh evorunner 'mkdir -p ~/evonext/lockcheck && tar x -C
  ~/evonext/lockcheck'` → drop the candidate files in → `pnpm install --frozen-lockfile`
  (the EXACT failing CI step) → tsc → vitest → build. Delete the dir after.
- **Cloudflare**: the local wrangler token belongs to the 'HöS' account (8 projects,
  NO evonext) — evonext's Pages lives in a different account; the git-integration is the
  only deploy path (keep it healthy). Wrangler config on evorunner = `~/.wrangler/config/
  default.toml` (NOT ~/.config/...). The token refresh = form-encoded POST with a
  `wrangler/4.162.0` UA (JSON bodies and default UAs get blocked).

## 6. The gotchas that cost real time this session (carry forward)

1. **The lockfile must stay committed with the workspace overrides** — CI dies at install
   otherwise and the failure is INVISIBLE off CI (the evorunner lockfile drifts silently).
   After ANY `pnpm-workspace.yaml` change: regenerate the lockfile on evorunner against
   master's exact files, commit BOTH.
2. **The deposit shows ONE address at a time** (the F50 selector, default Transparent) —
   a body-text grep for `dash1z` finds nothing until the Shielded SEGMENT is selected;
   the segment click = `getByRole('button', {name:'Shielded'}).first()` (the Move card's
   option steals naive text locators).
3. **`getIdentityByPublicKeyHash` wants HEX** (a base64 input throws 'Invalid hex string');
   the identity keys derive from the HARDENED paths (`m/9'/net'/5'/0'/0'/idx'/n'` —
   `lib/wallet-manager.ts getPrivateKeys`); unhardened derivations produce keys that match
   no identity. And probe 'FOUND's from `.catch(() => 'THREW…')` patterns are TRUTHY ERROR
   STRINGS — assert types, not truthiness.
4. **The wasm ensure-init before ANY glue use** on pages without an up-front init
   (the F56g pattern; F57j.5's crash): `await getWasmSdk().catch(() =>
   wasmSdkService.initialize({network, contractId}))`.
5. **`getSessionCredentials` = a LIVE chain search** (the identity-index walk, seconds) —
   any probe asserting the post-upgrade state needs poll-ticks, not a fixed wait.
6. **@scure/bip39 v2 `validateMnemonic(mnemonic, wordlist)` returns a BOOLEAN** (it does
   not throw).
7. **The wasm-glue derivation in Node probes**: use the `WasmSdk.deriveKeyFromSeedWithPath`
   STATIC directly (the compat wrappers live on the bundled instance; a bare
   `import * as wasm` + `wasm.derive_key_from_seed_with_path` does not exist on the ESM
   surface — only the class statics do).
8. **evorunner's ssh heredoc patching breaks on `\\n`** inside double-quoted ssh commands —
   write probe files on the HOST, scp them; never inline-patch JS via ssh python heredocs.

## 7. The open items NOT in this session's scope (recorded, do not lose)

- The DAPI-proxy broadcast-not-executing blocker was RESOLVED by their team (the F58.1
  settlements executed) — no wallet-side work remains.
- The DashSwap team's remaining answers (§3.4 above).
- The mainnet identity `CZUa7rTx…` + the F36 wallet (scratch-mainnet-state.json) — the
  mainnet swap enablement waits on the owner's top-up.
- `docs/HANDOFF-F57-PHASE1.md`'s Phase B/C watch (the DAPI team's trustless-reads work).
