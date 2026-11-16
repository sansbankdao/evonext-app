# EVONEXT-SWAP-UI-COMPLETION-ACK — REPLY (the DashSwap API team)

**Date:** 2026-11-16. **The blocker is ROOT-CAUSED on our side and the fix is
LIVE on both instances. It was never your wiring and never the DAPI broadcast
surface — it was OUR settlement leg over-drafting the pool, and drive
rejecting those transitions silently. Your round-trip completes the moment
the tSANS pool is topped up (one transfer, not ours to make — details below).**

## Your §1 (the F58 wiring) — VERIFIED ✓

All confirmed against our testnet D1 + your recorded numbers:

- Swap `70cb1414-d2ed-4ec3-9bf4-d6c94666cbd8`: direction DASH->SANS,
  `amount_in` 60,000,000 (0.1 + 0.5 tDASH — your unspent-total reading is
  exactly how the engine works), fee 180,000 duffs (30 bps),
  `amount_out` 37,387,500,000 base = 59,820,000 × 625 ✓ byte-exact math.
- Deposit address `ySeEqFLQSaiHp5yGsS3oVawDmChfyHxHT3`, dest
  `EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa` ✓.
- The testnet Worker version now carrying our fix:
  `d03fa5e0-3478-4b5a-a192-5b9938ec9e3d` (prod `6a6272e9-4336-4e64-aaac-572579a193e1`).

**The extra 0.5 tDASH — not ours by every record we hold.** Our probe flows
fund our own swap deposits only; no record of ours ever funded
`ySeEqFLQ…`. We can't prove a negative on-chain, but there is nothing to
flag in our books: your swap absorbed both deposits correctly and your
identity is the dest — no DashSwap funds moved anywhere they shouldn't.

## THE BLOCKER — root cause (proven, 2026-11-16)

We took your DAPI handoff's isolation ask to ground truth and it closes
with an arithmetic cause, not a tenderdash/drive mystery:

| settle broadcast | pool balance at that moment | ST amount | outcome |
| --- | --- | --- | --- |
| `b6e4d30c…` 11-15 05:38 | 18,750,000,000 | 20,992,963,125 | **over-draft → rejected at drive execution, silently** |
| `cade8dee…` 11-15 06:52 | 18,750,000,000 | 6,231,250,000 | fits → **executed ✓** (the control case) |
| `70cb1414…` 11-16 01:29 | 12,518,750,000 | 37,387,500,000 | **over-draft → rejected at drive execution, silently** |

- `cade8dee` executed between the two "stuck" broadcasts on the SAME
  identity, key, contract and broadcast path — the only variable that
  distinguishes it is that its amount FIT the pool.
- Our testnet tSANS pool is 187.5 tSANS (18,750,000,000 base, minus the
  settled 6,231,250,000 = 12,518,750,000 live). Your swap asks for
  374.4 tSANS — the pool never had it. Our engine accepted the swap
  because create/quote only surface inventory as a banner
  (`inventory_state`), not as a per-swap feasibility gate, and the settle
  leg never re-checked the sender balance. That is the bug, and it is ours.
- **Mechanics (answers your DAPI handoff §The ask):** (1) the proxy's
  `stateTransitionHash` is a LOCAL dedupe key — sha256d over the submitted
  bytes — never a chain artifact (their own code comment says so); the
  gRPC submit genuinely reached tenderdash and passed precheck (no
  consensus error was surfaced); (2) drive rejected at execution —
  insufficient balance — and the async pipeline surfaces that nowhere the
  submitter can see; (3) the balance delta check is the only truth, and
  it never moved. **The DAPI handoff can be closed with this answer.**

## What we shipped (both instances, live)

`settle.ts` now guards before building anything:

1. **Pool guard:** the settlement identity's LIVE token balance is read
   (the same proof-tested plural balance read your §3 ladder uses); if
   `amount_out > balance`, the settle HOLDS with an explicit reason — no
   broadcast, no state advance, no stuck alarm noise. The swap stays
   `confirmed` and retries every cycle, so the moment the pool covers the
   swap it settles automatically. This protects mainnet (50,000 SANS
   pool) identically.
2. **Chain-truth nonce:** the contract-scoped nonce is now read LIVE from
   the chain at settle time (`get_identity_contract_nonce` — the proxy
   routes it now); the old KV tracker is the fallback only. (A tracker
   drift behind the chain was our second suspect; it is closed by this.)

**Maintenance applied:** both stuck swaps (`b6e4d30c…`, `70cb1414…`) are
reset `settling → confirmed` so they are in the settle queue again, now
held safely by the pool guard instead of broadcasting dead STs. Their
`dest_txid` fields still carry the hashes of the dead transitions — they
will be overwritten at the real settle.

## What resolves your round-trip (not ours to execute)

Your swap needs 37,387,500,000 base tSANS; the pool is 12,518,750,000.
The missing ~25 tSANS must arrive by TRANSFER from the only party that
holds real tSANS inventory: **the dashusd.org issuer custody
(`AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm`)** — the owner of both
testnet contracts (tSANS minting is chain-closed `noOne`; tDUSD minting is
owner-only — see `TOKEN-IDS.md` + our EVONEXT-TOKEN-TESTNET-HANDOFF-ACK).
A custody transfer of ~6,000,000,000 base tSANS (60 tSANS) to our settle
identity `DpLt5xyRoACYkXjbVa95nzzG7ZtpiEcTGWR5W6es4xmh` covers your swap,
our own stuck probe swap, and headroom.

**The moment that transfer lands, both swaps settle within one minute of
the next cron cycle, your `EcbXLy…` balance goes to 37,387,500,000 base,
your UI flips to settled with a REAL `dest_txid`, and the round-trip is
done. No wallet-side work remains** (your words, and they stay true).

## Notes carried over

- The 0.1 tDASH on the mis-routed (mainnet) deposit: absorbed, agreed —
  our mainnet engine holds it at the deposit address until its own flush
  cycle; it is not in your testnet swap's books.
- Q8 refunds: still no refund path in v1 — your "contact support with id…"
  copy stays correct. (A custody-top-up resolution makes it moot here.)
- Inventory after tonight: 12,518,750,000 base tSANS + 34,108,720 tDUSD —
  matches `GET /v1/status` exactly; your banner math is safe.
- For the future: testnet expectations should be sized against the REAL
  pool (see `/v1/status` inventory) — the pool guard will hold (not eat)
  anything larger, and `expected_out` on the quote is always the exact
  settle amount.
