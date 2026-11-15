# F57 — DECOUPLING PLAN: dapi.sansbank.dev primary, no trusted fetching
(the owner directive, 2026-11-15: "THERE SHOULD BE NO TRUSTED FETCHING —
JUST USE THE API" + "if dapi.sansbank.dev fails then make sure we still
have a fallback to the network")

## THE CONSTRAINT (empirically proven, F57)
The vendored wasm SDK (5.0.0-rc.8) REFUSES non-trusted mode:
  "Context provider error: Non-trusted mode is not supported in WASM.
   Please construct a WasmTrustedContext via prefetchMainnet/prefetchTestnet/
   prefetchDevnet/prefetchLocal and attach it with
   WasmSdkBuilder.withTrustedContext()."
The proof/quorum verification is welded into the wasm — the SDK cannot be
built without the (flaky) DAPI-discovery prefetch. The F57 = move OFF the
wasm SDK, piece by piece.

## THE CURRENT STATE (what is already proxy-first)
- Identity reads: dapi.sansbank.dev PRIMARY + the wasm fallback (F27o)
- Shielded reads: the proxy-first source + the per-call wasm fallback (F29)
- The token balances / the address-infos / the documents / the writes:
  STILL wasm-SDK-bound (the trusted context).

## PHASE 1 — the remaining READS off the wasm
1. getAddressesInfos (the DIP-17 balances/nonces — the dashboard's
   Transparent row + the Send panel's source balances):
   the DAPI RPC EXISTS (the proto: getAddressesInfos) — either
   (a) the dev-dapi-proxy exposes it (the DAPI-team handoff; the JS-SDK
       worker pool = the same method, the wasm-free), or
   (b) the app calls it via the pshenmic DashPlatformSDK (the JS, in-bundle,
       the direct seed connections, NO trusted context, NO wasm).
2. getIdentitiesTokenBalances (the DUSD/SANS rows): the same two options.
3. get_documents (the posts/profiles): the proxy HAS it, but the Yappr feed
   relies on the `$createdAt > 0` range clauses the proxy's index
   validation REJECTS (the F27o) — the proxy needs the relaxed clause
   support OR the app keeps the wasm for the feed reads only.

## PHASE 2 — the WRITES off the wasm (the trusted context leaves the send path)
- The sends = the MANUAL transitions (the F54-proven pattern):
  the wasm GLUE builds the transition class (the module = loaded at login —
  NO SDK/trusted-context needed!), the noble ECDSA signs the signable bytes,
  and lib/direct-grpc.ts broadcasts the raw wire to the DAPI seed hosts —
  live-verified: the type-7 exact hashes + the type-11/15 reference wires.
- The wallet-manager's sendCredit/sendToken/withdrawToCore get the
  manual-transition path (the wasm SDK broadcast = the fallback).
- The nonce: getIdentityNonce = either the proxy or a direct-grpc query
  (the same unary pattern the broadcast uses).

## PHASE 3 — the wasm goes to ZERO
- The key derivation (deriveKeyFromSeedWithPath) → the pure-TS slip10 port
  (@noble/curves + @scure/bip32 — the m/9'/5'...' paths = standard BIP32).
- The signing = the noble ECDSA (ALREADY pure TS in the F54 flows).
- THEN the 26.5MB wasm, the Pages Function, the trusted-context prefetch,
  and this entire failure class DISAPPEAR.

## THE RESILIENCE LADDER (shipped F57, commit a1ec2ff)
- The service init: 5 attempts, the 2/4/8/16s exponential backoff (~30s) —
  the discovery endpoint flakes in bursts.
- The reads: the proxy-first with the per-call wasm fallback (F27o/F29) —
  the proxy down = the network; the network down = the proxy.
- The wasm load: 3x retry (F56d); the connect page + the Send panel =
  the honest 'Loading wallet engine…' states (F56g/F56f).
