# EVONEXT-TOKEN-TESTNET-HANDOFF — ACK (from the DashSwap API team)

**Date:** 2026-11-16. **Status: your §1 verified ✓; §2's ask is ALREADY
SERVED — your e2e identity holds 45 tDUSD as of tonight; §2's tSANS
question resolved with a CONSTANT FIX on your side.**

---

## §1 — CONFIRMED, with one addition

Re-ran everything through `dapi.sansbank.dev/v1/dapi` (your §4 commands):

- tDUSD `3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz` (testnet) →
  `{dataContractId: "GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23",
  tokenContractPosition: 0}` — **matches your resolution byte-for-byte** ✓
- Mainnet DUSD `DYqxCsuDgYsEAJ2ADnimkwNdL7C4xbe4No4so19X9mmd` →
  `{dataContractId: "8CkcAPokwFdxEu2tUu2VdLTjgK3eeR1wUGJcxhjsWaDz",
  tokenContractPosition: 0}` — unchanged ✓

**ADDITION — tSANS is ALREADY LIVE, and your constant is wrong.** You asked
us to "confirm whether tSANS is planned to go live the same way — it is
currently Resource not found". It is not planned — it went live days ago,
and the id your handoff carries is not the token id:

- `get_token_contract_info(A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw)`
  (testnet) → **resolves**: `{dataContractId:
  "2EUW1Do3exKMDKaj9uh5jkPPSUcrMgXfWUraiz6ALrwP", tokenContractPosition: 0}`
- `get_token_contract_info(A36eJF2kCcZmZSNnjhQeDtMGMQUyryPniyCTSBueDXT)`
  (your handoff's id) → `Resource not found` — reproduced.
- Our id is not just resolvable — it has moved real value: our testnet
  swap engine settled 58,537,382,500 base tSANS across three on-chain
  transfers to it.

**ACTION FOR YOU: replace your tSANS constant with
`A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw`** (contract `2EUW1Do3…`,
position 0 — same shape as your DUSD pin). The wallet's not-live gate will
stop firing for tSANS once the constant is fixed; the token itself needs
nothing.

## §2 — the inventory ask: you ALREADY hold it; and who can/can't mint

**Verified tonight via the proof-verified plural balance read:**

| Identity | tDUSD balance (base) |
| --- | --- |
| `EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa` (your e2e) | **45,000,000 (= 45 tDUSD)** |
| `5apjqb8KhwqMHFE4JGJeFnmNCjbBRSFhYKVREzwGCYs` | empty (confirms your read) |
| `DpLt5xyRoACYkXjbVa95nzzG7ZtpiEcTGWR5W6es4xmh` (our settle identity) | 34,108,720 (our swap pool — unchanged since the 2026-11-14 settle) |

**Your `EcbXLy…` received 45,000,000 base tDUSD between your handoff's
"none" verification and tonight.** Your suggested ask was "e.g. 50 tDUSD" —
45 is within integration range, and more can follow through the same
channel if you need it.

**About "presumably your inventory ops" (the vanished 15M):** we audited
our side, and the answer is more interesting than a sweep —

- Our settle identity's balance is EXACTLY `50,000,000 − 15,891,280` — the
  2026-11-14 settled swap and nothing else. We moved nothing.
- The 15,000,000 you sent to `5apjqb8…` on the F53c test left **`ADtgYG2MHikwv4UiZeY8faUsEkH1YDjEnJFhGbuXLfFB`
  — our E2E destination identity** (it now holds 41,590,672 =
  61,590,672 − 15,000,000 exactly; it received 15,891,280 from our settled
  swap just before). So the DEPOSIT into your test was our side's gesture;
  the later REMOVAL from `5apjqb8…` required that identity's own keys —
  which we have never held. Whoever holds `5apjqb8…` moved it.

**The mint-authority truth (this corrects the mental model in your
handoff):** we do NOT hold mint authority on either testnet token, and
never did — this also closes the "mint/inventory authority" open item from
DAPI-HANDOFF-2 §4-5 with the real answer:

- Both testnet contracts are owned by
  **`AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm`** — the dashusd.org
  issuer's treasury-side custody (a third-party identity; our keys provably
  don't derive it).
- **tDUSD**: uncapped supply, minting = contract owner only → only the
  issuer custody mints. (Empirical: a mint attempt from our identity
  fails "not authorized… Authorized action takers: ContractOwner".)
- **tSANS**: minting rules = **`noOne`** — NOBODY can mint, ever. Supply
  is fully pre-minted and hard-capped at 21,000,000 tSANS; all inventory
  flows by transfer only.
- Our own bootstrap inventory (both tokens) arrived BY TRANSFER from that
  custody. For partner testnet inventory, the routing is: the issuer
  custody (which evidently already reached you) or transfers from our
  pools — our pools ARE the swap engine's float, so we give sparingly.

## §3 — your side, acknowledged

Nothing to change on our side for your read ladder — `get_token_contract_info`
and `get_identities_token_balances` (plural, proof-verified) behave exactly
as you describe, and your three-tier ladder matches how our own engine
reads state. One caution carried over from our history: the SINGULAR
`get_identity_token_balances` is the lenient read (it can echo
non-existent ids); your instinct to trust the plural proof method is right.

## §4 — the swap round-trip (F47 track)

Your e2e identity now has real tDUSD to exercise wallet send → receive →
explorer-verify. For the swap round-trip against our testnet Worker, your
`EVONEXT-SWAP-UI-HANDOFF.md` questions are partially answered in our
FRONTEND-HANDOFF-3-ACK (testnet Worker URL + dev key); the remaining items
(status vocabulary, units/decimals, settlement deep-link artifact) are
answered in `FRONTEND-HANDOFF-2-RESPONSE.md` §status/§fee and the live
`GET /v1/status` — say the word and we'll do a consolidated inline answer
in your repo like this one.

**Verification one-liners (no auth), for your side:**

```
curl dapi.sansbank.dev/v1/dapi -d '{"method":"get_token_contract_info","params":{"tokenId":"A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw"},"network":"testnet"}'
curl dapi.sansbank.dev/v1/dapi -d '{"method":"get_identities_token_balances_with_proof_info","params":{"identityIds":["EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa"],"tokenId":"3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz"},"network":"testnet"}'
```
