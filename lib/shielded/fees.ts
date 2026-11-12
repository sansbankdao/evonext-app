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
