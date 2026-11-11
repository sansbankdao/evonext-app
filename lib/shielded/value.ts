// lib/shielded/value.ts
// Orchard value commitment, ported 1:1 from the Dash orchard fork
// (cargo git checkout orchard-94d8ef6bfc19d6d0/38ac9c1, tag dashified-0.14.1):
//   src/value.rs:358                    ValueCommitment::derive(value, rcv)
//   src/constants/fixed_bases.rs:38,41  VALUE_COMMITMENT_V_BYTES = b"v",
//                                       VALUE_COMMITMENT_R_BYTES = b"r"
//   src/value.rs:309                    sum of rcv's -> bsk (into_bsk)
//
// cv_net = [v_net]V + [rcv]R with
//   V = hash_to_curve("pallas", "z.cash:Orchard-cv")(b"v")
//   R = hash_to_curve("pallas", "z.cash:Orchard-cv")(b"r")  — reddsa.ts getBindingG()
// v_net is SIGNED (the fork uses i64/ValueSum internally; positive when value
// moves into the action, i.e. spend > output — builder.rs:438/464/497).

import { FR_MOD, PallasPoint } from './pasta';
import { hashToPallas } from './swu';
import { getBindingG } from './reddsa';

/** VALUE_COMMITMENT_PERSONALIZATION (value.rs / fixed_bases.rs). */
export const VALUE_COMMITMENT_PERSONALIZATION = 'z.cash:Orchard-cv';

/** VALUE_COMMITMENT_V_BYTES (fixed_bases.rs:38). */
export const VALUE_COMMITMENT_V_BYTES = new TextEncoder().encode('v');

/** G^Orchard-cv-v = hash_to_curve("pallas", "z.cash:Orchard-cv")(b"v") —
 *  the value basepoint. Lazily computed once. */
let valueCommitV: PallasPoint | null = null;
export function getValueCommitV(): PallasPoint {
  if (!valueCommitV) {
    valueCommitV = hashToPallas('pallas', VALUE_COMMITMENT_PERSONALIZATION, VALUE_COMMITMENT_V_BYTES);
  }
  return valueCommitV;
}

/** Wrap a SIGNED value into the scalar field: (v mod r) in [0, r). The fork's
 *  i64 ValueSum is converted into the scalar for the curve multiplication
 *  (value.rs ValueCommitment::derive), which is the same two's-complement
 *  convention the bundle digest layer uses for valueBalance. */
export function signedValueToScalar(v: bigint): bigint {
  const m = v % FR_MOD;
  return m < 0n ? m + FR_MOD : m;
}

/** ValueCommitment::derive(v_net, rcv) = [v_net]V + [rcv]R (value.rs:358). */
export function valueCommitment(vNet: bigint, rcv: bigint): PallasPoint {
  return getValueCommitV().mul(signedValueToScalar(vNet)).add(getBindingG().mul(rcv));
}

/** bsk = Σ rcv mod r (value.rs:309, into_bsk). The caller asserts the
 *  corresponding binding verification key against Σ cv_net − cv(valueBalance, 0)
 *  (bundle.rs:428-441) before broadcasting. */
export function sumRcvIntoBsk(rcvs: bigint[]): bigint {
  let bsk = 0n;
  for (const rcv of rcvs) bsk = (bsk + rcv) % FR_MOD;
  return bsk;
}
