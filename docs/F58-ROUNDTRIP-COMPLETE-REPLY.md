# F58-ROUNDTRIP-COMPLETE — REPLY (the DashSwap API team)

**Date:** 2026-11-16. **Confirmed on-chain and in our D1: the round-trip is
closed and your note's one observation is a mis-route, not an archive —
nothing was deleted. Your swap row persists and Fetch returns it, on the
testnet instance.**

## The settlements — verified independently

- D1: both swaps `settled` (updated 2026-11-16 02:24:56 UTC, one pass):
  - `70cb1414…` → `dest_txid 6c19bea5c5bcc5eb87472304dfda61306345bcce679ed72f545d55bc571803d5`, amount_out 37,387,500,000
  - `b6e4d30c…` → `dest_txid 880ee2e9608f1a772c801273b92a1356b5160b46da8d1b4073d8bbf2f1c7904d`, amount_out 20,992,963,125
- Chain: the plural proof read on `EcbXLy…` returns tSANS
  **37,387,500,000 exactly** — your number, to the digit.
- Pool arithmetic: your 4,138,286,875 remaining matches our live
  inventory read (our own Fetch response now carries
  `inventory_base_duffs: 4138286875`). The owner's 500 tSANS top-up
  landed; the guard passed; both settles executed within one cron pass.
  This is the fix working as designed: hold → top-up → self-heal.

## Your Fetch 404 — the row was never archived; you hit the wrong instance

- **D1 row exists** (no cleanup has ever run against testnet rows; our
  maintenance this week only ever updated status/dest_txid in place).
- **The testnet instance returns it right now**:

```
curl https://testnet.dashswap.xyz/v1/swap/70cb1414-d2ed-4ec3-9bf4-d6c94666cbd8 \
  -H "X-API-Key: <your TESTNET dev key>"
→ HTTP 200 {"success":true,"swap":{... "status":"settled",
  "dest_txid":"6c19bea5…","amount_out":37387500000, ...},"network":"testnet"}
```

- **The mainnet instance for that id answers exactly your symptom**:
  valid mainnet key + an id that only exists on testnet →
  `{"error":"Oops! There is NO swap with that id."}` (404). That is the
  same mis-route class as your first one, one layer over: your Function's
  `?network=testnet` routing covered quote/create, but the FETCH (your
  history/detail view) went to the mainnet base with your mainnet key.

**Action (yours, small): route the fetch/history path through the testnet
base too — and extend the Function's routing self-test to cover a fetch,
not just a quote/create.** Until then your history view will 404 exactly
as you saw while the swap cache keeps showing the truth.

The engine-side history does persist: `status` stays `settled` forever, `dest_txid` stays queryable, and List/Fetch carry the inventory fields. No retention or archive policy exists on testnet rows.

## Closing

Swap track CLOSED from our side too — F58 round-trip proven end-to-end
with real funds on a real partner flow. Standing items remain ours only
(DUSD-base pair + refunds = v2; mainnet UI-driven swap still awaiting your
ready-signal on the mainnet dev-key wiring).
