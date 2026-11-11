// lib/shielded/pczt-wire.ts
// PCZT v1 wire format — parser + serializer, ported 1:1 from
// wasm-prover/src/pczt_wire.rs (commit b44f278), which is the authoritative
// implementation serving `POST https://prover.sansbank.dev/prove/pczt`.
//
// Layout (all multi-byte integers little-endian; see HANDOFF-WEB-TEAM.md §3):
//   header  45 B : version(1) action_count(u16) flags(1) value_sum magnitude(u64)
//                  value_sum.is_negative(0|1) anchor(32)
//   action ≤1845 B: cv_net(32) rcv(1+32)
//                  spend  : nullifier(32) rk(32) spend_auth_sig(1+64)
//                           recipient(1+43) value(1+8) rho(1+32) rseed(1+32)
//                           fvk(1+96) witness(1 + pos u32 + 32×32 path)
//                           alpha(1+32) dummy_sk(1) zip32(1) proprietary(1)
//                  output : cmx(32) ephemeral_key(32) enc_ciphertext(104)
//                           out_ciphertext(80) recipient(1+43) value(1+8)
//                           rseed(1+32) ock(1+32) user_address(1) zip32(1)
//                           proprietary(1)
//   trailer ≥2 B : zkproof(1 + u32 len + bytes) bsk(1)
//
// Presence-flag rules: 0x00 absent / 0x01 present; anything else → ERR_BAD_FLAG_BYTE
// (4). Forbidden-in-v1 fields are fixed-width single bytes that MUST be 0x00 →
// ERR_FIELD_UNSUPPORTED (5) otherwise. The frame is exact-length: running short →
// ERR_TRUNCATED (3), trailing bytes after the trailer → ERR_EXCESS_BYTES (6).
// Action blocks are VARIABLE-LENGTH: a parser MUST walk flags sequentially from
// the header (never index header + i × 1845).

/** Wire format version byte (always first). */
export const PCZT_VERSION = 1;

export const HEADER_LEN = 45;

/** Spend section max (all optionals present) — pczt_wire.rs:148-151. */
export const SPEND_SECTION_LEN = 32 + 32 + (1 + 64) + (1 + 43) + (1 + 8)
  + (1 + 32) + (1 + 32) + (1 + 96) + (1 + 4 + 32 * 32) + (1 + 32) + 3;

/** Output section max (all optionals present) — pczt_wire.rs:154-156. */
export const OUTPUT_SECTION_LEN = 32 + 32 + 104 + 80 + (1 + 43) + (1 + 8)
  + (1 + 32) + (1 + 32) + 3;

/** Action block max — pczt_wire.rs:159. */
export const ACTION_WIRE_LEN = 32 + (1 + 32) + SPEND_SECTION_LEN + OUTPUT_SECTION_LEN;

/** Orchard note commitment tree depth — the witness carries exactly this many
 *  32-byte path nodes (`NOTE_COMMITMENT_TREE_DEPTH` in the fork). */
export const TREE_DEPTH = 32;

/** DashMemo ciphertext length (36-byte memo). */
export const ENC_CIPHERTEXT_LEN = 104;

export const OUT_CIPHERTEXT_LEN = 80;

/** Recipient raw address length: d(11) || pk_d(32). */
export const RECIPIENT_LEN = 43;

/** Error codes — pczt_wire.rs `codes` module. Codes are stable; key on them,
 *  never on message text. 1 = success; 7–25 follow the fork's ParseError enum
 *  order 1:1; 26/27 are value-sum / empty-actions; 100–113 are ProverError. */
export const PCZT_ERR = {
  OK: 1,
  VERSION: 2,
  TRUNCATED: 3,
  BAD_FLAG_BYTE: 4,
  FIELD_UNSUPPORTED: 5,
  EXCESS_BYTES: 6,
  INVALID_ANCHOR: 7,
  INVALID_BSK: 8,
  INVALID_DUMMY_SK: 9,
  INVALID_ENC_CIPHERTEXT: 10,
  INVALID_CMX: 11,
  INVALID_FVK: 12,
  INVALID_NULLIFIER: 13,
  INVALID_OUT_CIPHERTEXT: 14,
  INVALID_RK: 15,
  INVALID_RSEED: 16,
  INVALID_RECIPIENT: 17,
  INVALID_RHO: 18,
  INVALID_ALPHA: 19,
  INVALID_CV_NET: 20,
  INVALID_RCV: 21,
  INVALID_WITNESS: 22,
  INVALID_ZIP32: 23,
  MISSING_RHO: 24,
  BAD_FLAGS: 25,
  BAD_VALUE_SUM: 26,
  NO_ACTIONS: 27,
  UNEXPECTED_FORK_ERROR: 28,
  PROVER_MISSING_FVK: 100,
  PROVER_MISSING_RSEED: 101,
  PROVER_MISSING_RECIPIENT: 102,
  PROVER_MISSING_RHO: 103,
  PROVER_MISSING_ALPHA: 104,
  PROVER_MISSING_VALUE: 105,
  PROVER_MISSING_RCV: 106,
  PROVER_MISSING_WITNESS: 107,
  PROVER_INVALID_SPEND_NOTE: 108,
  PROVER_INVALID_OUTPUT_NOTE: 109,
  PROVER_RHO_MISMATCH: 110,
  PROVER_WRONG_FVK: 111,
  PROVER_IDENTITY_RK: 112,
  PROVER_FAILED: 113,
  PANIC: 200,
  BAD_POINTER: 201,
} as const;

/** Wire-level error with a stable numeric code (pczt_wire.rs WireError). */
export class PcztWireError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(`error ${code}: ${message}`);
    this.name = 'PcztWireError';
    this.code = code;
  }
}

function truncated(need: number, have: number): PcztWireError {
  return new PcztWireError(
    PCZT_ERR.TRUNCATED,
    `frame truncated: need ${need} more bytes, have ${have}`,
  );
}

function badFlag(field: string, value: number): PcztWireError {
  return new PcztWireError(
    PCZT_ERR.BAD_FLAG_BYTE,
    `field \`${field}\`: flag byte must be 0 or 1, got ${value}`,
  );
}

/** A parsed Merkle witness: leaf-to-root path (pczt_wire.rs comment at
 *  parse_spend; fork tree.rs:147-160 — path[0] is the leaf-layer sibling,
 *  path[31] the sibling just below the root; bit l of `position` selects the
 *  combine side at level l). */
export interface PcztWitness {
  position: number;
  path: Uint8Array[];
}

/** Spend half. Field names mirror the fork's `Spend` struct (pczt.rs:137-216).
 *  `zip32_derivation`, `dummy_sk` and `proprietary` are rejected at the frame
 *  layer in v1 and therefore absent here. */
export interface PcztSpend {
  nullifier: Uint8Array;
  rk: Uint8Array;
  spendAuthSig: Uint8Array | null;
  recipient: Uint8Array | null;
  value: bigint | null;
  rho: Uint8Array | null;
  rseed: Uint8Array | null;
  fvk: Uint8Array | null;
  witness: PcztWitness | null;
  alpha: Uint8Array | null;
}

/** Output half (fork's `Output`, pczt.rs:219-259). `ock` is optional —
 *  `build_for_pczt` leaves it unset. */
export interface PcztOutput {
  cmx: Uint8Array;
  ephemeralKey: Uint8Array;
  encCiphertext: Uint8Array;
  outCiphertext: Uint8Array;
  recipient: Uint8Array | null;
  value: bigint | null;
  rseed: Uint8Array | null;
  ock: Uint8Array | null;
}

/** One parsed action block (pczt_wire.rs WireAction). */
export interface PcztAction {
  cvNet: Uint8Array;
  rcv: Uint8Array | null;
  spend: PcztSpend;
  output: PcztOutput;
}

/** A complete parsed frame (pczt_wire.rs RequestWire). `version` is validated
 *  on parse and always written as 1 on serialize, so it is not carried. */
export interface PcztFrame {
  flags: number;
  valueSumMagnitude: bigint;
  valueSumIsNegative: boolean;
  anchor: Uint8Array;
  actions: PcztAction[];
  zkproof: Uint8Array | null;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Minimal bounds-checked cursor over the frame (pczt_wire.rs Reader). */
class Reader {
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {}

  get offset(): number {
    return this.pos;
  }

  take(n: number): Uint8Array {
    if (n < 0 || n > 0xffffffff) {
      throw new PcztWireError(PCZT_ERR.TRUNCATED, 'frame length overflow');
    }
    const end = this.pos + n;
    if (end > this.buf.length) {
      throw truncated(end - this.pos, this.buf.length - this.pos);
    }
    const out = this.buf.slice(this.pos, end);
    this.pos = end;
    return out;
  }

  array(n: number): Uint8Array {
    return this.take(n);
  }

  u8(): number {
    return this.take(1)[0];
  }

  u16le(): number {
    const b = this.take(2);
    return b[0] | (b[1] << 8);
  }

  u32le(): number {
    const b = this.take(4);
    return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  }

  u64le(): bigint {
    const b = this.take(8);
    let v = 0n;
    for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[i]);
    return v;
  }

  /** Presence flag: 0x00 absent, 0x01 present, anything else malformed. */
  flag(field: string): boolean {
    const v = this.u8();
    if (v === 0) return false;
    if (v === 1) return true;
    throw badFlag(field, v);
  }

  /** Presence flag for a field that MUST be absent in v1. The byte is still
   *  consumed (the format is fixed-width), but only 0x00 is accepted. */
  forbidden(field: string): void {
    const v = this.u8();
    if (v !== 0) {
      throw new PcztWireError(
        PCZT_ERR.FIELD_UNSUPPORTED,
        `field \`${field}\` must not be present in wire format v1 (flag byte ${v})`,
      );
    }
  }

  /** `optional` = one presence flag + fixed-width payload. */
  optional(n: number, field: string): Uint8Array | null {
    if (this.flag(field)) {
      return this.array(n);
    }
    return null;
  }

  optionalU64(field: string): bigint | null {
    if (this.flag(field)) {
      return this.u64le();
    }
    return null;
  }
}

/** Parses a complete request (or response) buffer — pczt_wire.rs parse_request.
 *
 *  The frame is exact-length checked: running short yields ERR_TRUNCATED,
 *  trailing bytes after the trailer yield ERR_EXCESS_BYTES. A zero
 *  `action_count` is rejected (ERR_NO_ACTIONS) — the fork's builder cannot
 *  produce an empty bundle and `extract` would return `None` there. */
export function parsePcztFrame(buf: Uint8Array): PcztFrame {
  const r = new Reader(buf);

  const version = r.u8();
  if (version !== PCZT_VERSION) {
    throw new PcztWireError(
      PCZT_ERR.VERSION,
      `wire version must be 1, got ${version}`,
    );
  }

  const actionCount = r.u16le();
  const flags = r.u8();
  const valueSumMagnitude = r.u64le();
  const negByte = r.u8();
  let valueSumIsNegative: boolean;
  if (negByte === 0) {
    valueSumIsNegative = false;
  } else if (negByte === 1) {
    valueSumIsNegative = true;
  } else {
    throw badFlag('value_sum.is_negative', negByte);
  }
  const anchor = r.array(32);

  // Reject absurd counts before allocating (pczt_wire.rs:417 comment): the
  // exact-length check below is what actually bounds the allocation.
  if (actionCount === 0) {
    throw new PcztWireError(
      PCZT_ERR.NO_ACTIONS,
      'action_count must be at least 1',
    );
  }

  const actions: PcztAction[] = [];
  for (let i = 0; i < actionCount; i++) {
    try {
      actions.push(parseAction(r));
    } catch (e) {
      if (e instanceof PcztWireError) {
        // per-action context, mirroring parse_request's "action N: ..." prefix
        throw new PcztWireError(e.code, `action ${i}: ${e.message.slice(`error ${e.code}: `.length)}`);
      }
      throw e;
    }
  }

  // Trailer.
  const zkproof = r.flag('zkproof')
    ? r.take(r.u32le())
    : null;
  r.forbidden('bsk');

  if (r.offset !== buf.length) {
    throw new PcztWireError(
      PCZT_ERR.EXCESS_BYTES,
      `frame is exact-length: consumed ${r.offset} of ${buf.length} bytes`,
    );
  }

  return {
    flags,
    valueSumMagnitude,
    valueSumIsNegative,
    anchor,
    actions,
    zkproof,
  };
}

function parseAction(r: Reader): PcztAction {
  const cvNet = r.array(32);
  const rcv = r.optional(32, 'rcv');
  const spend = parseSpend(r);
  const output = parseOutput(r);
  return { cvNet, rcv, spend, output };
}

function parseSpend(r: Reader): PcztSpend {
  const nullifier = r.array(32);
  const rk = r.array(32);
  const spendAuthSig = r.optional(64, 'spend_auth_sig');
  const recipient = r.optional(RECIPIENT_LEN, 'spend.recipient');
  const value = r.optionalU64('spend.value');
  const rho = r.optional(32, 'spend.rho');
  const rseed = r.optional(32, 'spend.rseed');
  const fvk = r.optional(96, 'spend.fvk');

  let witness: PcztWitness | null = null;
  if (r.flag('spend.witness')) {
    const position = r.u32le();
    const path: Uint8Array[] = [];
    for (let i = 0; i < TREE_DEPTH; i++) {
      path.push(r.array(32));
    }
    witness = { position, path };
  }

  const alpha = r.optional(32, 'spend.alpha');

  // Forbidden in v1; the format stays fixed-width so these three bytes are
  // always consumed and only `0x00` is accepted.
  r.forbidden('spend.dummy_sk');
  r.forbidden('spend.zip32_derivation');
  r.forbidden('spend.proprietary');

  return {
    nullifier,
    rk,
    spendAuthSig,
    recipient,
    value,
    rho,
    rseed,
    fvk,
    witness,
    alpha,
  };
}

function parseOutput(r: Reader): PcztOutput {
  const cmx = r.array(32);
  const ephemeralKey = r.array(32);
  const encCiphertext = r.array(ENC_CIPHERTEXT_LEN);
  const outCiphertext = r.array(OUT_CIPHERTEXT_LEN);
  const recipient = r.optional(RECIPIENT_LEN, 'output.recipient');
  const value = r.optionalU64('output.value');
  const rseed = r.optional(32, 'output.rseed');
  const ock = r.optional(32, 'output.ock');
  r.forbidden('output.user_address');
  r.forbidden('output.zip32_derivation');
  r.forbidden('output.proprietary');
  return {
    cmx,
    ephemeralKey,
    encCiphertext,
    outCiphertext,
    recipient,
    value,
    rseed,
    ock,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Growable writer; mirrors Reader field-for-field (pczt_wire.rs Writer). */
class Writer {
  private buf: number[] = [];

  get length(): number {
    return this.buf.length;
  }

  bytes(b: Uint8Array): void {
    for (let i = 0; i < b.length; i++) this.buf.push(b[i]);
  }

  u8(v: number): void {
    this.buf.push(v & 0xff);
  }

  u16le(v: number): void {
    this.u8(v);
    this.u8(v >> 8);
  }

  u32le(v: number): void {
    this.u8(v);
    this.u8(v >> 8);
    this.u8(v >> 16);
    this.u8(v >> 24);
  }

  u64le(v: bigint): void {
    let n = v;
    for (let i = 0; i < 8; i++) {
      this.u8(Number(n & 0xffn));
      n >>= 8n;
    }
  }

  flag(present: boolean): void {
    this.u8(present ? 1 : 0);
  }

  optional(v: Uint8Array | null, expectedLen: number, field: string): void {
    this.flag(v !== null);
    if (v !== null) {
      if (v.length !== expectedLen) {
        throw new PcztWireError(
          PCZT_ERR.UNEXPECTED_FORK_ERROR,
          `serialize: field \`${field}\` must be ${expectedLen} bytes, got ${v.length}`,
        );
      }
      this.bytes(v);
    }
  }

  optionalU64(v: bigint | null): void {
    this.flag(v !== null);
    if (v !== null) {
      this.u64le(v);
    }
  }

  forbiddenPlaceholder(): void {
    this.u8(0);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}

/** Serializes a request/response — pczt_wire.rs serialize_request. The Worker
 *  serializes its response (with `zkproof` present) through this same shape;
 *  the client serializes its request (zkproof absent) through it too. */
export function serializePcztFrame(frame: PcztFrame): Uint8Array {
  const w = new Writer();

  if (frame.actions.length === 0) {
    throw new PcztWireError(PCZT_ERR.NO_ACTIONS, 'action_count must be at least 1');
  }
  if (frame.actions.length > 0xffff) {
    throw new PcztWireError(
      PCZT_ERR.UNEXPECTED_FORK_ERROR,
      `serialize: action_count ${frame.actions.length} exceeds u16::MAX`,
    );
  }

  w.u8(PCZT_VERSION);
  w.u16le(frame.actions.length);
  w.u8(frame.flags);
  w.u64le(frame.valueSumMagnitude);
  w.u8(frame.valueSumIsNegative ? 1 : 0);
  if (frame.anchor.length !== 32) {
    throw new PcztWireError(
      PCZT_ERR.UNEXPECTED_FORK_ERROR,
      `serialize: anchor must be 32 bytes, got ${frame.anchor.length}`,
    );
  }
  w.bytes(frame.anchor);

  for (const action of frame.actions) {
    if (action.cvNet.length !== 32) {
      throw new PcztWireError(
        PCZT_ERR.UNEXPECTED_FORK_ERROR,
        `serialize: cv_net must be 32 bytes, got ${action.cvNet.length}`,
      );
    }
    w.bytes(action.cvNet);
    w.optional(action.rcv, 32, 'rcv');

    // Spend section.
    const s = action.spend;
    if (s.nullifier.length !== 32) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: nullifier must be 32 bytes, got ${s.nullifier.length}`);
    }
    w.bytes(s.nullifier);
    if (s.rk.length !== 32) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: rk must be 32 bytes, got ${s.rk.length}`);
    }
    w.bytes(s.rk);
    w.optional(s.spendAuthSig, 64, 'spend_auth_sig');
    w.optional(s.recipient, RECIPIENT_LEN, 'spend.recipient');
    w.optionalU64(s.value);
    w.optional(s.rho, 32, 'spend.rho');
    w.optional(s.rseed, 32, 'spend.rseed');
    w.optional(s.fvk, 96, 'spend.fvk');
    if (s.witness !== null) {
      w.flag(true);
      w.u32le(s.witness.position);
      if (s.witness.path.length !== TREE_DEPTH) {
        throw new PcztWireError(
          PCZT_ERR.UNEXPECTED_FORK_ERROR,
          `serialize: witness path must have ${TREE_DEPTH} nodes, got ${s.witness.path.length}`,
        );
      }
      for (const node of s.witness.path) {
        if (node.length !== 32) {
          throw new PcztWireError(
            PCZT_ERR.UNEXPECTED_FORK_ERROR,
            `serialize: witness path node must be 32 bytes, got ${node.length}`,
          );
        }
        w.bytes(node);
      }
    } else {
      w.flag(false);
    }
    w.optional(s.alpha, 32, 'spend.alpha');
    w.forbiddenPlaceholder(); // dummy_sk
    w.forbiddenPlaceholder(); // zip32_derivation
    w.forbiddenPlaceholder(); // proprietary

    // Output section.
    const o = action.output;
    if (o.cmx.length !== 32) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: cmx must be 32 bytes, got ${o.cmx.length}`);
    }
    w.bytes(o.cmx);
    if (o.ephemeralKey.length !== 32) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: ephemeral_key must be 32 bytes, got ${o.ephemeralKey.length}`);
    }
    w.bytes(o.ephemeralKey);
    if (o.encCiphertext.length !== ENC_CIPHERTEXT_LEN) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: enc_ciphertext must be ${ENC_CIPHERTEXT_LEN} bytes, got ${o.encCiphertext.length}`);
    }
    w.bytes(o.encCiphertext);
    if (o.outCiphertext.length !== OUT_CIPHERTEXT_LEN) {
      throw new PcztWireError(PCZT_ERR.UNEXPECTED_FORK_ERROR, `serialize: out_ciphertext must be ${OUT_CIPHERTEXT_LEN} bytes, got ${o.outCiphertext.length}`);
    }
    w.bytes(o.outCiphertext);
    w.optional(o.recipient, RECIPIENT_LEN, 'output.recipient');
    w.optionalU64(o.value);
    w.optional(o.rseed, 32, 'output.rseed');
    w.optional(o.ock, 32, 'output.ock');
    w.forbiddenPlaceholder(); // user_address
    w.forbiddenPlaceholder(); // zip32_derivation
    w.forbiddenPlaceholder(); // proprietary
  }

  // Trailer.
  if (frame.zkproof !== null) {
    w.flag(true);
    w.u32le(frame.zkproof.length);
    w.bytes(frame.zkproof);
  } else {
    w.flag(false);
  }
  w.forbiddenPlaceholder(); // bsk

  return w.toBytes();
}
