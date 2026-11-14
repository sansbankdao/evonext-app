// lib/shielded/fees.ts
// compute_minimum_shielded_fee_v0, ported 1:1 from rs-dpp v5.0.0-rc.8
// (packages/rs-dpp/src/shielded/compute_minimum_shielded_fee/v0/mod.rs:65)
// with the PROTOCOL-v14 constants pinned from rs-platform-version:
//   v14.rs:201 -> DRIVE_ABCI_VALIDATION_VERSIONS_V10 (event_constants):
//     shielded_proof_verification_fee      = 40_000_000   (drive_abci_validation_versions/v10.rs:343)
//     shielded_per_action_processing_fee   = 22_000_000   (v10.rs:352)
//     shielded_storage_bytes_per_action    = 550          (v10.rs:361)
//   v14.rs:223 -> FEE_VERSION2 -> FEE_STORAGE_VERSION1:
//     per-byte rate = storage_disk_usage_credit_per_byte
//                   + storage_processing_credit_per_byte
//                   = 27_000 + 400 = 27_400               (fee/storage/v1.rs:6-7)
//   FEE_VERSION2.uses_version_fee_multiplier_permille = Some(1000) = x1.0 (no-op).
//
// Formula (mod.rs:48-52):
//   min_fee = compute_fee + num_actions * storage_fee_per_action
//   compute_fee = shielded_proof_verification_fee + num_actions * shielded_per_action_processing_fee
//   storage_fee_per_action = shielded_storage_bytes_per_action * per_byte_rate
//
// Consensus PINS a ShieldedTransfer's value_balance to exactly this value —
// overpayment buys nothing and leaks a distinguishing fee fingerprint
// (rs-dpp shielded/builder/shielded_transfer.rs doc comment, rc.8). All
// arithmetic in rs-dpp is checked; bigint arithmetic here cannot overflow.

const SHIELDED_PROOF_VERIFICATION_FEE = 40_000_000n

const SHIELDED_PER_ACTION_PROCESSING_FEE = 22_000_000n

const SHIELDED_STORAGE_BYTES_PER_ACTION = 550n

const SHIELDED_STORAGE_PER_BYTE_RATE = 27_000n + 400n

/** The flat minimum shielded fee (in credits) for a pool-paid transition
 *  (ShieldedTransfer / Unshield / ShieldedWithdrawal) with `numActions`
 *  on-wire actions — the value_balance consensus pins the transition to.
 *  The wallet builder uses num_actions = max(spends, 2) (rs-dpp
 *  shielded_transfer.rs: MIN_ACTIONS pad means the on-wire count is always
 *  >= 2). */
export function computeMinimumShieldedFee(numActions: number): bigint {
  if (!Number.isInteger(numActions) || numActions < 0) {
    throw new RangeError(`computeMinimumShieldedFee: numActions must be a non-negative integer, got ${numActions}`)
  }
  const n = BigInt(numActions)
  const computeFee = SHIELDED_PROOF_VERIFICATION_FEE + n * SHIELDED_PER_ACTION_PROCESSING_FEE
  const storageFee = n * SHIELDED_STORAGE_BYTES_PER_ACTION * SHIELDED_STORAGE_PER_BYTE_RATE
  return computeFee + storageFee
}

/* Flat storage component added for ShieldedWithdrawal ONLY: the transition
 * inserts a Core withdrawal document (plus its withdrawals-contract index
 * entries, `AddWithdrawalDocument`) whose GroveDB-metered cost (~110M
 * credits) is flat regardless of action count. Priced as 4100 effective
 * bytes at the same per-byte storage rate. Source: rs-dpp
 * src/shielded/mod.rs:51 `SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES: u64 =
 * 4100`, applied in compute_shielded_withdrawal_fee_v0
 * (src/shielded/compute_minimum_shielded_fee/v0/mod.rs:122). */
const SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES = 4_100n

/** compute_shielded_withdrawal_fee (v0): the ShieldedWithdrawal fee =
 *  computeMinimumShieldedFee(numActions) + 4100 * per-byte storage rate.
 *  Consensus carves EXACTLY this from the pool on every withdrawal (rs-dpp
 *  shielded/builder/shielded_withdrawal.rs: 'The fee is not a parameter').
 *  For numActions = 2 on protocol v14: 114,140,000 + 112,340,000 =
 *  226,480,000 credits. */
export function computeShieldedWithdrawalFee(numActions: number): bigint {
  return computeMinimumShieldedFee(numActions)
    + SHIELDED_WITHDRAWAL_DOCUMENT_STORAGE_BYTES * SHIELDED_STORAGE_PER_BYTE_RATE
}

/* Asset-lock base for the SHIELD-from-asset-lock validator (protocol v14):
 * the drive-side v1 validation charges a flat 50,000 x CREDITS_PER_DUFF
 * (= 1000 credits per duff) asset-lock base on top of the pool fee and
 * checks remaining_credit_value >= shield_amount + pool_fee (AGENTS.md
 * F31a, from the v14 validation source read). EXACT arithmetic corroborated
 * live twice: F29 stage-2 testnet + F36 stage-2 mainnet sized 1.2B-credit
 * locks for 1B shields — 1.2B − 1B − 164,140,000 = the recorded 35,860,000
 * surplus, both broadcasts ACCEPTED on-chain. */
const ASSET_LOCK_BASE_CREDITS_PER_DUFF = 50_000n
const CREDITS_PER_DUFF = 1_000n

/** The pool fee a ShieldFromAssetLock's remaining credit value must cover
 *  for `numActions` on-wire actions (v14). For 2 actions: 114,140,000 +
 *  50,000,000 = 164,140,000 credits. */
export function computeShieldFromAssetLockPoolFee(numActions: number): bigint {
  return computeMinimumShieldedFee(numActions)
    + ASSET_LOCK_BASE_CREDITS_PER_DUFF * CREDITS_PER_DUFF
}

/** Safe lock sizing for a shield of `shieldCredits`: the pool fee + 25%
 *  headroom so a conservative fee estimate can never brick the flow (an
 *  oversized lock just donates a small surplus to the fee pools, bounded by
 *  the 20B-credit implicit cap). Headroom stays FAR under that cap. */
export function recommendedAssetLockCredits(shieldCredits: bigint): bigint {
  const fee = computeShieldFromAssetLockPoolFee(2)
  const withHeadroom = shieldCredits + fee + fee / 4n
  /* Round up to a whole satoshi (1000 credits) for the L1 lock value. */
  return ((withHeadroom + 999n) / 1000n) * 1000n
}

/* ---- F51b: the three new pool-edge fees (protocol v14, validation v10) ----
 * All verified against rs-dpp v5.0.0-rc.8 compute_minimum_shielded_fee/v0 +
 * the shielded/mod.rs effective-byte constants (F51a probe, 2026-11-14):
 * unshield address write 222 B, identity top-up balance rewrite 8 B,
 * ShieldFromIdentity identity write allowance (2x400 + 500 B floor). */

/** compute_shielded_unshield_fee (v0): the Unshield transition (17) carves
 *  EXACTLY this from the pool (builder/unshield.rs: 'The fee is not a
 *  parameter'); the net (unshielding_amount - fee) is credited to the
 *  output transparent address. For 2 actions: 114,140,000 + 6,082,800 =
 *  120,222,800 credits. */
export function computeUnshieldFee(numActions: number): bigint {
  return computeMinimumShieldedFee(numActions)
    + 222n * SHIELDED_STORAGE_PER_BYTE_RATE
}

/** compute_shielded_identity_top_up_fee (v0): IdentityTopUpFromShieldedPool
 *  (22) carves EXACTLY this from the pool; the identity receives the net.
 *  For 2 actions: 114,140,000 + 219,200 = 114,359,200 credits. */
export function computeIdentityTopUpFromShieldedPoolFee(numActions: number): bigint {
  return computeMinimumShieldedFee(numActions)
    + 8n * SHIELDED_STORAGE_PER_BYTE_RATE
}

/** compute_shielded_identity_balance_write_fee (v0): the ShieldFromIdentity
 *  (21) ADMISSION FLOOR — the identity is debited amount + the METERED fee
 *  which may be lower than this floor (compute_.../v0/mod.rs: 'Execution
 *  charges the actual metered fee, which may be lower'). Client-side we use
 *  the floor for sizing/validation only. For 2 actions: 114,140,000 +
 *  1,300x27,400 = 149,760,000 credits. */
export function computeShieldFromIdentityFeeFloor(numActions: number): bigint {
  return computeMinimumShieldedFee(numActions)
    + (BigInt(numActions) * 400n + 500n) * SHIELDED_STORAGE_PER_BYTE_RATE
}
