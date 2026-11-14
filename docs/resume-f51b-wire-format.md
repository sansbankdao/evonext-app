# F51b/F51c RESUME STATE — type-11/15 broadcast (session of 2026-11-15)

## PROVEN FACTS (all live/byte-verified)
1. TYPE-7 (IdentityCreditTransfer) WORKS: manual noble sig over sha256d(getSignableBytes),
   [31+recid|r|s], broadcast via the WASM's broadcastStateTransition = ACCEPTED,
   recipient +exactly 1,000,000 credits. Hashes: hashSkip b4e5bdf82c46c53bcc4fa13136451771685847caf9478df69ed5614040a6df2a,
   hashFull b8f32cc53d8371b027e07266edb16e86d0658039732b102505208b0d721f1a2a.
   ALSO type-7 works via the DIRECT grpc path (scratch-grpc-7-probe.mts, nonce 7, EcbX credited).
2. DRIVE = BINCODE 2 (standard+big_endian) via the direct grpc — proven by the type-7 acceptance.
3. Direct grpc transport WORKS: DashPlatformSDK({network:'testnet'}).grpcPool.getClient()
   .broadcastStateTransition(BroadcastStateTransitionRequest.create({stateTransition: bytes})).
   NO re-encode (unlike the wasm's broadcastStateTransition which re-encodes divergently).
4. WASM GLUE ENCODER BUG (proven by a real bincode-2.0.1 Rust probe):
   the wasm's IdentityTopUpFromAddressesTransition inner wire = the CORRECT bytes
   SHIFTED-RIGHT-BY-4-BITS from the inputs' nonce/credits onward.
   Reference encoding (133B, confirmed by cargo probe /tmp/bincodetest):
   [01 maplen][00 P2pkh][hash20][01 nonce=state+1][fc credits-4B-BE][00 output-None]
   [id32][01 00 00 fee(len,variant0,index0)][00 ufi][01 witlen][00 P2pkh-variant][41 siglen][sig65]
   Signable = [0b tag][00 version][the fields WITHOUT the witnesses] = 67B.
5. Witness encoding in the wire = [witlen][00 variant][41 = BinaryData length byte][65-byte sig].
   AddressWitness::P2pkh payload = LENGTH-PREFIXED BinaryData (drive consumed [00][31][31] of my
   raw sig → '33 bytes' read → proven).
6. Drive's deserialize dispatch: [0b = the umbrella tag][00 = the version] (the version-1 probe:
   'IdentityTopUpFromAddressesTransition allowed 0..=0 found 1' CONFIRMS the 2nd byte = the version).
7. CURRENT BLOCKER: the reference-form wire via the direct grpc → the error =
   'unable to deserialize StateTransition : UnexpectedVariant { type_name: "DataContractConfig",
   allowed 0..=2, found: 153 }' (0x99 = the id's byte 5!) AND the error-data shows the inputs map
   decoded with the credits = 1,000,000 (= min_identity_funding_amount!) while the nonce = 1 (mine).
   => suspicion: my [fc][1c5c3de0] credits read differently by the backend, OR the error context
   = {address, REQUIRED 1M} (a min-funding check), and the deserialize error = the real one.
   NEXT STEPS: (a) print the FULL message field of drive-error-data-bin (the last run's
   'message' = the OLD 'DataContractConfig' bin — re-decode the CURRENT one!);
   (b) test the wire WITHOUT the feeStrategy/user_fee_increase fields (defaults?);
   (c) test the credits as [fd][8B BE] (the u64-class tag instead of [fc]);
   (d) compare with the type-18's V1-only lesson (the version byte?).
8. Type-15 (Shield) = the SAME root cause family (the wasm's encoder shift) — after the 11 works,
   apply the same reference-form treatment to assembleShieldFromTransparent's broadcast.
9. scratch-* files with the current probes: scratch-patch-11.mts, scratch-ref11-broadcast.mts,
   scratch-direct-variants.mts, scratch-manual-7-11.mts, scratch-grpc-broadcast-11.mts.
10. The rc.5 drive source = /tmp/platform-rc8 (the sparse checkout); the bincode 2.0.1 source =
    ~/.cargo/registry (SINGLE_BYTE_MAX=250; 251=2B, 252=4B?? NO: 251=u16(2B), 252=u32(4B), 253=u64(8B)).
11. The type-11 struct (rs-dpp): {inputs: BTreeMap<PlatformAddress,(AddressNonce u32, Credits u64)>,
    output: Option<(PlatformAddress, Credits)>, identity_id, fee_strategy: Vec<AddressFundsFeeStrategyStep>,
    user_fee_increase: u8, input_witnesses: Vec<AddressWitness>} — NO identity-signature field
    (witness-only authorization).
12. Address-nonce rule (rc.5 address_balances_and_nonces.rs): the input nonce must be EXACTLY
    state_nonce + 1.

## UPDATE (the same session, the latest probes)
13. The variant probes (scratch-direct-variants.mts) DECODED THE DISPATCH:
    - [0b][01] → 'IdentityTopUpFromAddressesTransition allowed 0..=0 found 1' => the 2nd byte = the version ✓
    - [0c][00] → 'AddressFundsFeeStrategyStep allowed 0..=1 found 34' => the tag 12 = AddressFundsTransfer arm ✓
14. The reference-form wire ([0b][00][01][00][hash20][01][fc 1c5c3de0][00][id32][01 00 00][00][01][00][41][sig])
    via the direct grpc → the error = the error-data [2 = AddressNotEnoughFundsError?][the context =
    {the-address, (nonce=1 ✓, the credits read as 1,000,000 = min_identity_funding_amount?!)}].
    The consensus_error = the STALE 'DataContractConfig found 153' (from the earlier wasm-form send).
    OPEN QUESTION: is the '1,000,000' the DECODED credits or the REQUIRED minimum? If the decoded
    credits = 1M, the consensus's credits-varint read of [fc][1c5c3de0] differs — test [fd][8B BE].
15. The consensus_error field of the drive-data = [98 8f array(143)] = [1][8][140][the base64 message]
    — the message = 'unable to deserialize StateTransition : UnexpectedVariant { type_name:
    "DataContractConfig", allowed 0..=2, found: 153 }' — 153 = 0x99 = the id's byte 5.
