// lib/shielded/prove.ts
// Output-only bundle assembly + PCZT v1 request construction, ported 1:1
// from rs-dpp v5.0.0-rc.8 (shielded/builder/mod.rs build_output_only_bundle
// + prove_and_sign_bundle ordering), the Dash orchard fork (38ac9c1)
// builder.rs / note.rs / tree.rs dummy-spend machinery, and the prover
// team's client sequence (wasm-prover/docs/HANDOFF-WEB-TEAM.md §2):
//   1. build PCZT            (this module, steps a-e below)
//   2. bundle commitment     (bundle.ts hashBundleTxidData, from the PCZT fields)
//   3. platform sighash      (bundle.ts computePlatformSighash + v14 extra_data)
//   4-5. sign every spend    (reddsa.ts spendAuthSign; dummy spends signed with
//                             their local dummy_sk — dummy_sk NEVER rides the wire)
//   6. serialize + POST      (pczt-wire.ts serializePcztFrame)
//   7-8. binding sign + extract (reddsa.ts reddsaSign on the binding base;
//                             broadcast is the caller's job — NOT this module)
// Dummy-note construction mirrors the fork exactly:
//   Note::dummy (note.rs:227-242):  random sk -> fvk -> address_at(0, External);
//                                   value 0; rho = Rho::from_nf_old(Nullifier::dummy)
//   Nullifier::dummy (nullifier.rs:53-55): extract_p(pallas::Point::random(rng))
//                                          = extract_p(generator * uniform-scalar)
//   MerklePath::dummy (tree.rs:119-126): position = rng u32; path = 32 x uniform-base
//   builder.rs:305 / :433:            alpha / rcv = pallas::Scalar::random(rng)
//   builder.rs:378:                 output rho = Rho::from_nf_old(spend nullifier)
//   builder.rs:279-287:             a value-ZERO spend passes the anchor check with
//                                   ANY path (bundle anchor = Anchor::empty_tree())
//   zcash_note_encryption lib.rs:506-517: ovk = None -> RANDOM ock + RANDOM
//                                   outgoing plaintext (never zero-filled)
// Value-commitment signs: an action's v_net = spend_value - output value, so an
// output-only action commits to a NEGATIVE value (value.ts signedValueToScalar).

import { getSpendAuthG, deriveAskAndAk, fullViewingKeyFromSpendingKey, deriveDkOvk, diversifyHash, diversifierAtIndex, ivkFromFvk, deriveAddressBytes, toScalar, toBase, type FullViewingKeyParts } from './keys';
import { PallasPoint, bigintToBytes32LE } from './pasta';
import { derivePsi, deriveRcm, deriveEsk, noteCommitment, noteCommitmentPoint, deriveNullifier, DASH_MEMO_SIZE } from './note';
import { valueCommitment, sumRcvIntoBsk } from './value';
import { encryptNotePlaintext, encryptOutgoingPlaintext } from './encrypt';
import { hashBundleTxidData, computePlatformSighash, FLAGS_ENABLED, type BundleActionEffects } from './bundle';
import { reddsaSign, randomizeVerificationKey, spendAuthSign, getBindingG } from './reddsa';
import { emptyRoots } from './tree';
import { TREE_DEPTH, serializePcztFrame, parsePcztFrame, type PcztAction, type PcztFrame, type PcztSpend, type PcztOutput, type PcztWitness } from './pczt-wire';

/** Bundle flags byte for the credit pool's output-only bundles: rs-dpp builds
 *  with BundleType::Transactional { flags: OrchardFlags::SPENDS_DISABLED,
 *  bundle_required: false } — spends_enabled = false, outputs_enabled = true
 *  (bundle.rs:73-75 FLAG_SPENDS_ENABLED = 1, FLAG_OUTPUTS_ENABLED = 2). The
 *  same byte feeds the wire header AND the bundle commitment. */
export const FLAGS_OUTPUT_ONLY = 0x02;

/** Anchor::empty_tree() (tree.rs:67-69) = EMPTY_ROOTS[32] of the incremental
 *  note commitment tree. */
export function emptyTreeAnchor(): Uint8Array {
  return bigintToBytes32LE(emptyRoots(TREE_DEPTH)[TREE_DEPTH]);
}

/** CSPRNG hook (n bytes). The tests inject a deterministic stream. */
export type RandFn = (n: number) => Uint8Array;

/** Default hook over Web Crypto (browser + Node >= 19). */
export const defaultRand: RandFn = (n) => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

/** One output of the bundle. For the rs-dpp Shield/ShieldFromIdentity/
 *  ShieldFromAssetLock flows this is the single real output; filler outputs
 *  (rs-dpp `dummy_outputs` param) are generated internally — fresh random
 *  address, value 0, empty memo, no OVK (builder.rs OutputInfo::dummy). */
export interface OutputOnlySpec {
  /** 43-byte raw Orchard address of the recipient. */
  recipient: Uint8Array;
  /** Note value in credits (u64). */
  value: bigint;
  /** 36-byte Dash memo (rs-dpp shielded/memo.rs layout). */
  memo: Uint8Array;
  /** Sender's External-scope OVK so the sender can recover this note from
   *  chain data (rs-dpp passes Some(...) for the real output). null = the
   *  unrecoverable random-key branch. */
  senderOvk: Uint8Array | null;
}

export interface BuildOutputOnlyOptions {
  outputs: OutputOnlySpec[];
  /** Number of filler dummy outputs appended after the real ones
   *  (rs-dpp build_output_only_bundle `dummy_outputs`). Default 0. */
  dummyOutputs?: number;
  /** Protocol-v14 extra sighash data (bundle.ts shieldExtraSighashData /
   *  shieldFromIdentityExtraSighashData / shieldFromAssetLockExtraSighashData). */
  extraSighashData: Uint8Array;
  rand?: RandFn;
}

export interface OutputOnlyBuild {
  /** Fully signed PCZT frame, ready for serializePcztFrame + POST. */
  frame: PcztFrame;
  /** The platform sighash every spend-auth signature was made over. */
  sighash: Uint8Array;
  /** bsk = Σ rcv mod r — derive the binding signature AFTER the prover
   *  returns (HANDOFF §2 step 8); never serialized. */
  bsk: bigint;
  /** The bundle anchor (empty-tree root for output-only bundles). */
  anchor: Uint8Array;
  /** Signed value balance (negative — value entering the pool). */
  valueBalance: bigint;
}

interface DummySpendMaterial {
  ask: bigint;
  alpha: bigint;
}

/** Generate one filler output exactly like the fork's OutputInfo::dummy
 *  (builder.rs:360-364): fresh random sk -> fvk -> address_at(0, External),
 *  value ZERO, empty memo, no OVK. */
function dummyOutput(rand: RandFn): OutputOnlySpec {
  const sk = rand(32);
  const fvk = fullViewingKeyFromSpendingKey(sk);
  const { dk } = deriveDkOvk(fvk);
  const d = diversifierAtIndex(dk, 0);
  const recipient = deriveAddressBytes(ivkFromFvk(fvk), d);
  return { recipient, value: 0n, memo: new Uint8Array(DASH_MEMO_SIZE), senderOvk: null };
}

/** Assemble one (dummy spend + output) action pair, mirroring the fork's
 *  SpendInfo::dummy + OutputInfo::build (builder.rs:264-276 / :373-...). */
function buildAction(
  output: OutputOnlySpec,
  materialOut: { dummies: DummySpendMaterial[] },
  rand: RandFn,
): { action: PcztAction; effects: BundleActionEffects; rcv: bigint } {
  // --- dummy spend half (Note::dummy + MerklePath::dummy) ---
  const dummySkBytes = rand(32);
  const { ask: dummyAsk, ak: dummyAk } = deriveAskAndAk(dummySkBytes);
  const dummyFvk = fullViewingKeyFromSpendingKey(dummySkBytes);
  const dummyNkBytes = bigintToBytes32LE(dummyFvk.nk);
  const { dk: dummyDk } = deriveDkOvk(dummyFvk);
  const dummyD = diversifierAtIndex(dummyDk, 0);
  const dummyRecipient = deriveAddressBytes(ivkFromFvk(dummyFvk), dummyD);
  // Nullifier::dummy(rng): extract_p(generator * uniform-scalar) — the RHO of
  // the dummy note (Rho::from_nf_old), NOT the wire nullifier.
  const dummyRho = getSpendAuthG().mul(toScalar(rand(64))).extractP();
  if (dummyRho === null) throw new Error('dummy rho: random point is the identity (redraw)');
  const dummyRhoBytes = bigintToBytes32LE(dummyRho);
  const dummyRseed = rand(32);
  // The wire nullifier is the dummy note's REAL nullifier under its fvk's nk
  // (the prover recomputes it from the note fields we send — this must match).
  const dummyGD = diversifyHash(dummyD);
  const dummyPkD = PallasPoint.fromBytes(dummyRecipient.slice(11, 43));
  const dummyPsi = derivePsi(dummyRseed, dummyRhoBytes);
  const dummyRcm = deriveRcm(dummyRseed, dummyRhoBytes);
  const dummyCmPoint = noteCommitmentPoint(dummyGD, dummyPkD, 0n, dummyRhoBytes, dummyPsi, dummyRcm);
  const wireNullifier = deriveNullifier(dummyNkBytes, dummyRhoBytes, dummyPsi, dummyCmPoint);
  const alpha = toScalar(rand(64));
  const rkPoint = randomizeVerificationKey(dummyAk, alpha, getSpendAuthG());
  if (rkPoint.isIdentity()) throw new Error('rk: randomized key is the identity (redraw)');
  const rkBytes = rkPoint.toBytes();
  // MerklePath::dummy: random position + 32 uniform-base path nodes.
  const witnessPosition = new DataView(rand(4).buffer, 0).getUint32(0, true);
  const witnessPath: Uint8Array[] = [];
  for (let i = 0; i < TREE_DEPTH; i++) witnessPath.push(bigintToBytes32LE(toBase(rand(64))));
  const spend: PcztSpend = {
    nullifier: wireNullifier,
    rk: rkBytes,
    spendAuthSig: null, // signed AFTER the sighash is computed
    recipient: dummyRecipient,
    value: 0n,
    rho: dummyRhoBytes,
    rseed: dummyRseed,
    // The fork's build_for_pczt sets Some(fvk) for EVERY spend (real and dummy
    // alike); the prover builds the circuit from it (PROVER_MISSING_FVK = 100).
    fvk: fvkToBytes(dummyFvk),
    witness: { position: witnessPosition, path: witnessPath },
    alpha: bigintToBytes32LE(alpha),
  };
  materialOut.dummies.push({ ask: dummyAsk, alpha });

  // --- output half (OutputInfo::build, builder.rs:373-...) ---
  // rho = Rho::from_nf_old(nf_old) — the SPEND half's wire nullifier.
  const outRho = wireNullifier;
  const outRseed = rand(32);
  const outEsk = deriveEsk(outRseed, outRho);
  if (outEsk === 0n) throw new Error('output esk is zero (redraw)');
  const { epkBytes, encCiphertext } = encryptNotePlaintext(output.recipient, output.value, outRseed, output.memo, outEsk);
  const rcv = toScalar(rand(64));
  const cvNetPoint = valueCommitment(-output.value, rcv);
  const outPkD = PallasPoint.fromBytes(output.recipient.slice(11, 43));
  const outCmx = noteCommitmentPoint(
    diversifyHash(output.recipient.slice(0, 11)),
    outPkD,
    output.value,
    outRho,
    derivePsi(outRseed, outRho),
    deriveRcm(outRseed, outRho),
  ).extractP();
  if (outCmx === null) throw new Error('output cmx: commitment is the identity (redraw)');
  const outCmxBytes = bigintToBytes32LE(outCmx);
  const outCiphertext = output.senderOvk !== null
    ? encryptOutgoingPlaintext(output.senderOvk, cvNetPoint.toBytes(), outCmxBytes, epkBytes, output.recipient.slice(11, 43), bigintToBytes32LE(outEsk))
    : encryptOutgoingPlaintext(rand(32), cvNetPoint.toBytes(), outCmxBytes, epkBytes, rand(32), rand(32)); // fork's ovk=None branch: random ock + random plaintext
  const outputHalf: PcztOutput = {
    cmx: outCmxBytes,
    ephemeralKey: epkBytes,
    encCiphertext,
    outCiphertext,
    recipient: output.recipient,
    value: output.value,
    rseed: outRseed,
    ock: null, // build_for_pczt leaves ock unset (pczt-wire.ts Output doc)
  };

  const action: PcztAction = { cvNet: cvNetPoint.toBytes(), rcv: bigintToBytes32LE(rcv), spend, output: outputHalf };
  const effects: BundleActionEffects = {
    nullifier: wireNullifier,
    cmx: outCmxBytes,
    ephemeralKey: epkBytes,
    encCiphertext,
    cvNet: cvNetPoint.toBytes(),
    rk: rkBytes,
    outCiphertext,
  };
  return { action, effects, rcv };
}

/** The 96-byte FVK encoding parsed by keys.ts fvkFromBytes:
 *  ak (32) || nk (32) || rivk (32) (keys.rs FullViewingKey::to_bytes). */
function fvkToBytes(fvk: FullViewingKeyParts): Uint8Array {
  const out = new Uint8Array(96);
  out.set(fvk.ak.toBytes(), 0);
  out.set(bigintToBytes32LE(fvk.nk), 32);
  out.set(bigintToBytes32LE(fvk.rivk), 64);
  return out;
}

/**
 * Build a fully signed output-only PCZT request (HANDOFF §2 steps 1-6 up to
 * serialization). The returned frame is ready for `serializePcztFrame`.
 */
export function buildOutputOnlyPczt(options: BuildOutputOnlyOptions): OutputOnlyBuild {
  const rand = options.rand ?? defaultRand;
  const dummyOutputs = options.dummyOutputs ?? 0;
  if (options.outputs.length === 0) throw new Error('buildOutputOnlyPczt: at least one output is required');
  if (options.extraSighashData.length !== 33 && options.extraSighashData.length !== 0) {
    throw new Error('buildOutputOnlyPczt: extraSighashData must be the 33-byte v14 layout (or empty for pre-v14)');
  }
  const outputs: OutputOnlySpec[] = [...options.outputs];
  for (let i = 0; i < dummyOutputs; i++) outputs.push(dummyOutput(rand));

  /* Fork MIN_ACTIONS parity (orchard builder.rs:94): a transactional bundle
   * with any requested actions pads to max(requested, 2) with automatic
   * dummies. rs-dpp relies on this automatic padding (its
   * build_output_only_bundle passes dummy_outputs = 0 for a single real
   * output and still serializes exactly 2 on-wire actions), and consensus
   * prices the shielded fee from the on-wire action count against a wallet
   * reservation of exactly 2 — a 1-action shield would be rejected. */
  while (outputs.length < 2) outputs.push(dummyOutput(rand));

  const material = { dummies: [] as DummySpendMaterial[] };
  const actions: PcztAction[] = [];
  const effects: BundleActionEffects[] = [];
  const rcvs: bigint[] = [];
  let valueBalance = 0n;
  for (const out of outputs) {
    const built = buildAction(out, material, rand);
    actions.push(built.action);
    effects.push(built.effects);
    rcvs.push(built.rcv);
    valueBalance -= out.value; // output-only: value enters the pool
  }

  const anchor = emptyTreeAnchor();
  const commitment = hashBundleTxidData(effects, FLAGS_OUTPUT_ONLY, valueBalance, anchor);
  const sighash = computePlatformSighash(commitment, options.extraSighashData);

  // HANDOFF §2 steps 4-5: every spend carries a spend-auth signature; dummy
  // spends are signed with their local dummy ask (dummy_sk cleared afterwards —
  // it exists only inside this function call and never reaches the wire).
  for (let i = 0; i < actions.length; i++) {
    const { ask, alpha } = material.dummies[i];
    const { rk, sig } = spendAuthSign(ask, alpha, sighash, rand(80));
    if (Buffer.from(rk).toString('hex') !== Buffer.from(actions[i].spend.rk).toString('hex')) {
      throw new Error('spendAuthSign rk mismatch with the action rk (internal inconsistency)');
    }
    actions[i].spend.spendAuthSig = sig;
  }

  const bsk = sumRcvIntoBsk(rcvs);
  return {
    frame: {
      flags: FLAGS_OUTPUT_ONLY,
      valueSumMagnitude: -valueBalance,
      valueSumIsNegative: true,
      anchor,
      actions,
      zkproof: null,
    },
    sighash,
    bsk,
    anchor,
    valueBalance,
  };
}

// ---------------------------------------------------------------------------
// Transfer bundles (ShieldedTransfer): real spends + real outputs. Ported 1:1
// from rs-dpp v5.0.0-rc.8 (shielded/builder/shielded_transfer.rs
// build_shielded_transfer_transition) layered on the fork Builder pairing rule
// (builder.rs: spend i pairs with output i in ONE action; the short side pads
// with dummies; MIN_ACTIONS = 2). Differences from buildOutputOnlyPczt:
//   * the spend half of action i < spends.length is the REAL note (real
//     nullifier under the owner's nk, rk = ak randomized by alpha, witness
//     against the LIVE bundle anchor — not the empty-tree anchor);
//   * action i >= spends.length reuses the proven dummy-spend machinery of
//     buildAction unchanged;
//   * an action's v_net = spend_value - output_value (value.ts
//     signedValueToScalar handles the sign);
//   * bundle flags = FLAGS_ENABLED (0x03 — spends + outputs enabled), the
//     sighash extra_data is EMPTY (rs-dpp prove_and_sign_bundle(..., &[])),
//     and value_balance = total_spent - total_output = the fee (POSITIVE;
//     consensus pins it to compute_minimum_shielded_fee — fees.ts).
// ---------------------------------------------------------------------------

/** One real note being spent, with everything the prover needs to build the
 *  spend circuit (pczt_wire.rs parse_spend fields). */
export interface TransferSpendSpec {
  /** 43-byte raw Orchard address of the note (d(11) || pk_d(32)). */
  recipient: Uint8Array;
  /** Note value in credits (u64). */
  value: bigint;
  /** 32-byte rho — the nullifier of the action that CREATED this note
   *  (Rho::from_nf_old). */
  rho: Uint8Array;
  /** 32-byte rseed (derives psi/rcm; prover recomputes the note commitment). */
  rseed: Uint8Array;
  /** Full viewing key parts owning the note (ak / nk / rivk). */
  fvk: FullViewingKeyParts;
  /** Spend authorizing key scalar (reduced mod r) for the spendAuthSig. */
  ask: bigint;
  /** Merkle witness against the bundle anchor: leaf position + the 32-node
   *  leaf-to-root authentication path (OrchardTree.authPath). */
  witness: PcztWitness;
}

export interface BuildTransferOptions {
  spends: TransferSpendSpec[];
  /** Real outputs, rs-dpp order: the recipient output first, then the change
   *  output (if any). Filler dummies pad to max(spends, outputs, 2). */
  outputs: OutputOnlySpec[];
  /** The LIVE bundle anchor the spend witnesses were built against (32 bytes).
   *  Must be one of Platform's recorded anchors (100-checkpoint retention). */
  anchor: Uint8Array;
  /** Transparent extra_data bound into the platform sighash. EMPTY for a
   *  ShieldedTransfer (rs-dpp shielded_transfer.rs: prove_and_sign_bundle
   *  (..., &[])); a ShieldedWithdrawal passes
   *  shieldedWithdrawalExtraSighashData(outputScript, required, coreFee,
   *  pooling) where required == the resulting value_balance (withdrawal
   *  amount + withdrawal fee) — rs-dpp shielded_withdrawal.rs binds exactly
   *  those fields so a relay cannot malleate the Core-facing payout. */
  extraSighashData?: Uint8Array;
  rand?: RandFn;
}

export interface TransferBuild {
  /** Fully signed PCZT frame, ready for serializePcztFrame + POST. */
  frame: PcztFrame;
  /** The platform sighash every spend-auth signature was made over. */
  sighash: Uint8Array;
  /** bsk = Σ rcv mod r — for the post-prove binding signature. */
  bsk: bigint;
  /** The bundle anchor (the live anchor passed in). */
  anchor: Uint8Array;
  /** Signed value balance (POSITIVE for a transfer — the fee leaving the pool). */
  valueBalance: bigint;
}

/** Assemble one (real spend + output) action pair. The spend half mirrors the
 *  fork's SpendInfo::build (builder.rs:264-...): the note commitment is
 *  recomputed from the note fields, the wire nullifier is the note's real
 *  nullifier under the owner fvk's nk, and rk = ak randomized by a fresh
 *  alpha. The output half is byte-identical math to buildAction's output half
 *  (rho = this action's nullifier via Rho::from_nf_old). */
function buildRealSpendAction(
  spendSpec: TransferSpendSpec,
  output: OutputOnlySpec,
  rand: RandFn,
): { action: PcztAction; effects: BundleActionEffects; rcv: bigint; alpha: bigint } {
  // --- real spend half ---
  const spendD = spendSpec.recipient.slice(0, 11);
  const spendPkD = PallasPoint.fromBytes(spendSpec.recipient.slice(11, 43));
  const spendGD = diversifyHash(spendD);
  const spendPsi = derivePsi(spendSpec.rseed, spendSpec.rho);
  const spendRcm = deriveRcm(spendSpec.rseed, spendSpec.rho);
  const spendCmPoint = noteCommitmentPoint(spendGD, spendPkD, spendSpec.value, spendSpec.rho, spendPsi, spendRcm);
  const nkBytes = bigintToBytes32LE(spendSpec.fvk.nk);
  const wireNullifier = deriveNullifier(nkBytes, spendSpec.rho, spendPsi, spendCmPoint);
  const alpha = toScalar(rand(64));
  const rkPoint = randomizeVerificationKey(spendSpec.fvk.ak, alpha, getSpendAuthG());
  if (rkPoint.isIdentity()) throw new Error('rk: randomized key is the identity (redraw)');
  const rkBytes = rkPoint.toBytes();
  const spend: PcztSpend = {
    nullifier: wireNullifier,
    rk: rkBytes,
    spendAuthSig: null, // signed AFTER the sighash is computed
    recipient: spendSpec.recipient,
    value: spendSpec.value,
    rho: spendSpec.rho,
    rseed: spendSpec.rseed,
    // Real spends carry Some(fvk) exactly like dummies (PROVER_MISSING_FVK = 100).
    fvk: fvkToBytes(spendSpec.fvk),
    witness: spendSpec.witness,
    alpha: bigintToBytes32LE(alpha),
  };

  // --- output half (OutputInfo::build; rho = Rho::from_nf_old(this nullifier)) ---
  const outRho = wireNullifier;
  const outRseed = rand(32);
  const outEsk = deriveEsk(outRseed, outRho);
  if (outEsk === 0n) throw new Error('output esk is zero (redraw)');
  const { epkBytes, encCiphertext } = encryptNotePlaintext(output.recipient, output.value, outRseed, output.memo, outEsk);
  const rcv = toScalar(rand(64));
  // v_net = spend_value - output_value (the action's real value flow).
  const cvNetPoint = valueCommitment(spendSpec.value - output.value, rcv);
  const outPkD = PallasPoint.fromBytes(output.recipient.slice(11, 43));
  const outCmx = noteCommitmentPoint(
    diversifyHash(output.recipient.slice(0, 11)),
    outPkD,
    output.value,
    outRho,
    derivePsi(outRseed, outRho),
    deriveRcm(outRseed, outRho),
  ).extractP();
  if (outCmx === null) throw new Error('output cmx: commitment is the identity (redraw)');
  const outCmxBytes = bigintToBytes32LE(outCmx);
  const outCiphertext = output.senderOvk !== null
    ? encryptOutgoingPlaintext(output.senderOvk, cvNetPoint.toBytes(), outCmxBytes, epkBytes, output.recipient.slice(11, 43), bigintToBytes32LE(outEsk))
    : encryptOutgoingPlaintext(rand(32), cvNetPoint.toBytes(), outCmxBytes, epkBytes, rand(32), rand(32)); // fork's ovk=None branch: random ock + random plaintext
  const outputHalf: PcztOutput = {
    cmx: outCmxBytes,
    ephemeralKey: epkBytes,
    encCiphertext,
    outCiphertext,
    recipient: output.recipient,
    value: output.value,
    rseed: outRseed,
    ock: null, // build_for_pczt leaves ock unset (pczt-wire.ts Output doc)
  };

  const action: PcztAction = { cvNet: cvNetPoint.toBytes(), rcv: bigintToBytes32LE(rcv), spend, output: outputHalf };
  const effects: BundleActionEffects = {
    nullifier: wireNullifier,
    cmx: outCmxBytes,
    ephemeralKey: epkBytes,
    encCiphertext,
    cvNet: cvNetPoint.toBytes(),
    rk: rkBytes,
    outCiphertext,
  };
  return { action, effects, rcv, alpha };
}

/** Build a fully signed transfer PCZT request, mirroring rs-dpp's
 *  build_shielded_transfer_transition up to (but excluding) the Halo2 proof:
 *  action pairing, fee-carving value balance, empty extra sighash data, and
 *  every spend's spendAuthSig over the platform sighash. The caller chooses
 *  outputs so that Σ spends − Σ outputs = computeMinimumShieldedFee(action
 *  count) EXACTLY — consensus pins value_balance to that fee. */
export function buildTransferPczt(options: BuildTransferOptions): TransferBuild {
  const rand = options.rand ?? defaultRand;
  if (options.spends.length === 0) throw new Error('buildTransferPczt: at least one spend is required');
  if (options.outputs.length === 0) throw new Error('buildTransferPczt: at least one output is required');
  if (options.anchor.length !== 32) throw new Error('buildTransferPczt: anchor must be 32 bytes');
  const spends = [...options.spends];
  const outputs = [...options.outputs];
  /* rs-dpp: num_actions = spends.len().max(2) — outputs always fit because
   * the wallet emits exactly one recipient + one change output. Here the
   * caller controls outputs, so pad to max(spends, outputs, 2) (the fork
   * Builder pads the short side with dummies — same pairing rule). */
  const numActions = Math.max(spends.length, outputs.length, 2);
  while (outputs.length < numActions) outputs.push(dummyOutput(rand));

  const material = { dummies: [] as DummySpendMaterial[] };
  const signers: { ask: bigint; alpha: bigint }[] = [];
  const actions: PcztAction[] = [];
  const effects: BundleActionEffects[] = [];
  const rcvs: bigint[] = [];
  let valueBalance = 0n;
  for (let i = 0; i < numActions; i++) {
    const out = outputs[i];
    valueBalance -= out.value;
    if (i < spends.length) {
      const built = buildRealSpendAction(spends[i], out, rand);
      actions.push(built.action);
      effects.push(built.effects);
      rcvs.push(built.rcv);
      signers.push({ ask: spends[i].ask, alpha: built.alpha });
      valueBalance += spends[i].value;
    } else {
      /* Dummy-spend action — reuse the proven buildAction machinery as-is. */
      const built = buildAction(out, material, rand);
      actions.push(built.action);
      effects.push(built.effects);
      rcvs.push(built.rcv);
      const dm = material.dummies[material.dummies.length - 1];
      signers.push({ ask: dm.ask, alpha: dm.alpha });
    }
  }

  /* Consensus: a shielded transfer's value_balance IS the fee and must be
   * positive (state_transition_validation.rs:34-44). */
  if (valueBalance <= 0n) {
    throw new Error('buildTransferPczt: total spent must exceed total output (value_balance = fee > 0)');
  }

  const anchor = new Uint8Array(options.anchor);
  const commitment = hashBundleTxidData(effects, FLAGS_ENABLED, valueBalance, anchor);
  /* Extra_data is empty for a ShieldedTransfer (rs-dpp shielded_transfer.rs:
   * prove_and_sign_bundle(builder, prover, [ask], &[])) and the withdrawal
   * field bundle for a ShieldedWithdrawal (see BuildTransferOptions). */
  const sighash = computePlatformSighash(commitment, options.extraSighashData ?? new Uint8Array(0));

  for (let i = 0; i < actions.length; i++) {
    const { ask, alpha } = signers[i];
    const { rk, sig } = spendAuthSign(ask, alpha, sighash, rand(80));
    if (Buffer.from(rk).toString('hex') !== Buffer.from(actions[i].spend.rk).toString('hex')) {
      throw new Error('spendAuthSign rk mismatch with the action rk (internal inconsistency)');
    }
    actions[i].spend.spendAuthSig = sig;
  }

  const bsk = sumRcvIntoBsk(rcvs);
  return {
    frame: {
      flags: FLAGS_ENABLED,
      valueSumMagnitude: valueBalance,
      valueSumIsNegative: false,
      anchor,
      actions,
      zkproof: null,
    },
    sighash,
    bsk,
    anchor,
    valueBalance,
  };
}

// ---------------------------------------------------------------------------
// Prover transport (wasm-prover/docs/HANDOFF-WEB-TEAM.md §1): the request body
// is the raw wire frame (application/octet-stream, no JSON wrapper); the 200
// response JSON carries `response` = hex of the SAME frame with the zkproof
// trailer filled. Errors are { error, errorCode, detail } — callers key on
// errorCode (§6), never on the message text.
// ---------------------------------------------------------------------------

export const PROVER_BASE_URL = 'https://prover.sansbank.dev';

/** Prover base for the CURRENT runtime: the browser goes through the
 *  same-origin Pages Function proxy (/api/prove/pczt — functions/api/prove/
 *  pczt.js) because the prover worker answers NO CORS preflight (verified
 *  live 2026-11-13: OPTIONS -> 405, no Access-Control-* headers — a browser
 *  POST dies with net::ERR_FAILED); Node keeps the direct URL. */
/* Client scopes = browser main thread AND Web Workers (the shielded
 * engine worker posts to /api too — the prover answers no CORS preflight,
 * and under COEP an opaque no-cors response is unusable). Node probes
 * (window/self/location all absent) still hit the absolute prover URL. */
const isClientScope = (): boolean =>
  typeof window !== 'undefined' ||
  (typeof self !== 'undefined' && typeof document === 'undefined' && typeof location !== 'undefined');

export const proverBaseUrl = (): string =>
  isClientScope() ? '/api' : PROVER_BASE_URL;

export interface ProvePcztResult {
  /** The parsed frame with the zkproof trailer filled. */
  frame: PcztFrame;
  /** The response frame re-serialized (byte-identical to parse input). */
  bytes: Uint8Array;
  /** Response meta (pkMs/proveMs/instanceInitMs are always 0 under workerd;
   *  pkWasCached + isolateId are the meaningful fields). */
  meta?: Record<string, unknown>;
}

export class ProvePcztError extends Error {
  readonly status: number;
  readonly errorCode?: number;
  readonly detail?: string;
  constructor(status: number, message: string, errorCode?: number, detail?: string) {
    super(message);
    this.name = 'ProvePcztError';
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

/** POST a serialized PCZT frame and parse the proved response. NETWORK
 *  errors (fetch throws — DNS/TLS/connection resets; live-hit 2026-11-14 on
 *  Node) are retried up to 3 attempts with a short backoff; HTTP-level
 *  errors are NOT retried (they are prover verdicts). */
export async function postPcztFrame(frameBytes: Uint8Array, baseUrl: string = proverBaseUrl()): Promise<ProvePcztResult> {
  let response: Response;
  for (let attempt = 1; ; attempt++) {
    try {
      response = await fetch(`${baseUrl}/prove/pczt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: frameBytes as unknown as BodyInit,
      });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (!response.ok) {
    let message = `prover HTTP ${response.status}`;
    let errorCode: number | undefined;
    let detail: string | undefined;
    try {
      const body = await response.json() as { error?: string; errorCode?: number; detail?: string };
      if (body.error) message = body.error;
      errorCode = body.errorCode;
      detail = body.detail;
    } catch { /* non-JSON error body — keep the HTTP status message */ }
    throw new ProvePcztError(response.status, message, errorCode, detail);
  }
  const body = await response.json() as { response?: string; meta?: Record<string, unknown> };
  if (typeof body.response !== 'string' || body.response.length === 0 || !/^[0-9a-fA-F]+$/.test(body.response)) {
    throw new ProvePcztError(200, 'prover returned a malformed response hex');
  }
  const hex = body.response;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const frame = parsePcztFrame(bytes);
  if (frame.zkproof === null) {
    throw new ProvePcztError(200, 'prover response frame has no zkproof');
  }
  // HANDOFF §2 step 6: the response must be the SAME frame with ONLY the
  // zkproof trailer filled — reject any prover-side field mutation.
  const requestCanonical = Buffer.from(serializePcztFrame(parsePcztFrame(frameBytes))).toString('hex');
  const responseCanonical = Buffer.from(serializePcztFrame({ ...frame, zkproof: null })).toString('hex');
  if (responseCanonical !== requestCanonical) {
    throw new ProvePcztError(200, 'prover response frame differs from the request outside the zkproof');
  }
  return { frame, bytes, meta: body.meta };
}

/**
 * The binding signature (HANDOFF §2 step 8, run AFTER the prover returns):
 * bvk = [bsk]binding_G; sig = RedDSA^{Orchard-binding}(bsk, sighash).
 * `random80` is the 80 bytes of RedDSA nonce-generation randomness. */
export function signBinding(bsk: bigint, sighash: Uint8Array, random80: Uint8Array): { bvk: Uint8Array; sig: Uint8Array } {
  const base = getBindingG();
  const bvk = base.mul(bsk).toBytes();
  const sig = reddsaSign({ sk: bsk, vkBytes: bvk, msg: sighash, random80, base });
  return { bvk, sig };
}
