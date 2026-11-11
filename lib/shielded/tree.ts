// lib/shielded/tree.ts
// Orchard note commitment tree (MerkleCRH^Orchard over Pallas) — ported 1:1
// from the pinned orchard fork (dashpay/orchard dashified-0.14.1 @ 38ac9c1):
//   - tree.rs MerkleHashOrchard::combine  (the hash)
//   - tree.rs EMPTY_ROOTS                  (uncommitted-subtree roots)
//   - tree.rs MerklePath::root             (path fold)
//   - incrementalmerkletree 0.8.1 semantics (append / root / auth path)
//
// MerkleCRH^Orchard(level, left, right) =
//   extract_p_bottom(SinsemillaHashToPoint_{z.cash:Orchard-MerkleCRH}(
//     I2LEBSP_10(level) || I2LEBSP_255(left) || I2LEBSP_255(right)))
// (tree.rs:225-235). Layers: leaves are layer 32, the root is layer 0; the
// `level` argument to combine is the HEIGHT OF THE INPUT SUBTREES (l = 0 when
// hashing two leaves). The uncommitted leaf is pallas::Base(2)
// (tree.rs:26-29, zips #thmuncommittedorchard).
//
// The tree is append-only; leaves beyond the append frontier are implicitly
// the uncommitted value, so any node whose whole 2^h-leaf range lies past the
// frontier equals EMPTY_ROOTS[h]. Every COMPLETE subtree root is cached in
// `nodes` at append time (append merges eagerly along the new leaf's ancestor
// path), so root() and authPath() only ever recurse into genuinely partial
// (frontier-straddling) subtrees — O(depth^2) hashes per call.

import { FP_MOD, bigintToBytes32LE, bytes32LEToBigint } from './pasta';
import { sinsemillaHashToPoint } from './sinsemilla';

/** SWU hash-to-curve personalization for the Merkle CRH generator
 *  (constants/sinsemilla.rs:29). */
export const MERKLE_CRH_PERSONALIZATION = 'z.cash:Orchard-MerkleCRH';

/** ℓ^Orchard_Merkle (constants/sinsemilla.rs:24). */
export const L_ORCHARD_MERKLE = 255;

/** MERKLE_DEPTH_ORCHARD (constants.rs:14). */
export const NOTE_COMMITMENT_TREE_DEPTH = 32;

/** The uncommitted leaf, pallas::Base(2) (tree.rs:26-29). */
export const UNCOMMITTED_ORCHARD = 2n;

/** MerkleHashOrchard::combine (tree.rs:225-235). `level` = height of the input
 *  subtrees; `left`/`right` are field elements (0 <= x < q_P). Returns
 *  extract_p_bottom of the hash point, i.e. the x-coordinate or 0 for the
 *  point at infinity (the fork's `.unwrap_or(pallas::Base::zero())`). */
export function merkleCRH(level: number, left: bigint, right: bigint): bigint {
  if (!Number.isInteger(level) || level < 0 || level >= (1 << 10)) {
    throw new RangeError(`merkleCRH: level must be in [0, 2^10), got ${level}`);
  }
  // I2LEBSP_k(level) with k = K = 10 (constants/sinsemilla.rs:76-79),
  // then each operand's to_le_bits().take(L_ORCHARD_MERKLE).
  const bits = new Array<number>(10 + 2 * L_ORCHARD_MERKLE);
  let o = 0;
  for (let i = 0; i < 10; i++) bits[o++] = (level >> i) & 1;
  for (const x of [left, right]) {
    let v = x;
    for (let i = 0; i < L_ORCHARD_MERKLE; i++) {
      bits[o++] = Number(v & 1n);
      v >>= 1n;
    }
  }
  return sinsemillaHashToPoint(MERKLE_CRH_PERSONALIZATION, bits).extractPBottom();
}

const emptyRootsCache = new Map<number, bigint[]>();

/** EMPTY_ROOTS for a tree of the given depth (tree.rs:30-42): roots[0] is the
 *  uncommitted leaf and roots[h] = merkleCRH(h-1, roots[h-1], roots[h-1]) for
 *  h in 1..=depth, so roots[h] is the root of an EMPTY subtree of height h. */
export function emptyRoots(depth: number): bigint[] {
  let roots = emptyRootsCache.get(depth);
  if (!roots) {
    roots = [UNCOMMITTED_ORCHARD];
    for (let h = 1; h <= depth; h++) {
      roots.push(merkleCRH(h - 1, roots[h - 1], roots[h - 1]));
    }
    emptyRootsCache.set(depth, roots);
  }
  return roots;
}

/** An incremental Orchard note commitment tree. Nodes are field elements; use
 *  leafFromBytes / leafToBytes at the byte boundary. Production depth is 32;
 *  smaller depths exist only for the fork's own depth-4 KAT vectors. */
export class OrchardTree {
  readonly depth: number;

  private readonly leaves: bigint[] = [];

  /** nodes[h]: index (in units of 2^h leaves) → root of the COMPLETE subtree
   *  covering [idx·2^h, (idx+1)·2^h). Written eagerly by append. */
  private readonly nodes: Map<number, bigint>[];

  constructor(depth: number = NOTE_COMMITMENT_TREE_DEPTH) {
    if (!Number.isInteger(depth) || depth < 1 || depth > NOTE_COMMITMENT_TREE_DEPTH) {
      throw new RangeError(`OrchardTree: depth must be in [1, ${NOTE_COMMITMENT_TREE_DEPTH}], got ${depth}`);
    }
    this.depth = depth;
    this.nodes = Array.from({ length: depth + 1 }, () => new Map<number, bigint>());
  }

  get size(): number {
    return this.leaves.length;
  }

  /** Appends a leaf; returns its position. Amortized O(1) merges: the loop
   *  runs once per trailing 1-bit of the position. */
  append(leaf: bigint): number {
    if (leaf < 0n || leaf >= FP_MOD) {
      throw new RangeError('OrchardTree.append: leaf must be a canonical field element');
    }
    const position = this.leaves.length;
    this.leaves.push(leaf);
    let node = leaf;
    let h = 0;
    let idx = position;
    this.nodes[0].set(idx, node);
    while (idx & 1) {
      const left = this.nodes[h].get(idx - 1);
      if (left === undefined) {
        throw new Error('OrchardTree.append: invariant violated — missing left sibling');
      }
      node = merkleCRH(h, left, node);
      h += 1;
      idx >>= 1;
      this.nodes[h].set(idx, node);
    }
    return position;
  }

  /** Root of the subtree of height `h` covering [idx·2^h, (idx+1)·2^h):
   *  cached if complete, EMPTY_ROOTS[h] if wholly past the frontier, else
   *  computed from its (complete | empty | partial) children. */
  private subtreeRoot(h: number, idx: number): bigint {
    const cached = this.nodes[h].get(idx);
    if (cached !== undefined) return cached;
    if (idx * 2 ** h >= this.leaves.length) return emptyRoots(this.depth)[h];
    // Partially filled subtree — recurse. h >= 1 is guaranteed: h === 0 with
    // idx < leaves.length would have been cached by append.
    const left = this.subtreeRoot(h - 1, idx * 2);
    const right = this.subtreeRoot(h - 1, idx * 2 + 1);
    return merkleCRH(h - 1, left, right);
  }

  /** The tree root (an Anchor value). The empty tree's root is
   *  EMPTY_ROOTS[depth]. */
  root(): bigint {
    if (this.leaves.length === 0) return emptyRoots(this.depth)[this.depth];
    return this.subtreeRoot(this.depth, 0);
  }

  /** The authentication path for the leaf at `position`: 32 (or `depth`)
   *  siblings, path[h] = sibling at height h (the fork's MerklePath, whose
   *  auth_path[0] is the leaf-layer sibling — PCZT wire §3.3). */
  authPath(position: number): bigint[] {
    if (!Number.isInteger(position) || position < 0 || position >= this.leaves.length) {
      throw new RangeError(`OrchardTree.authPath: position ${position} out of range (size ${this.leaves.length})`);
    }
    const path = new Array<bigint>(this.depth);
    for (let h = 0; h < this.depth; h++) {
      // `>>>` (unsigned) so positions >= 2^31 stay correct.
      path[h] = this.subtreeRoot(h, (position >>> h) ^ 1);
    }
    return path;
  }

  /** MerklePath::root (tree.rs:147-160): folds the candidate leaf value up
   *  the path; bit `l` of `position` selects the combine side at height l. */
  static rootFromPath(
    leaf: bigint,
    position: number,
    path: readonly bigint[],
    depth: number = NOTE_COMMITMENT_TREE_DEPTH,
  ): bigint {
    if (path.length !== depth) {
      throw new RangeError(`rootFromPath: path must have ${depth} nodes, got ${path.length}`);
    }
    let node = leaf;
    for (let l = 0; l < depth; l++) {
      // `&` on int32: at l === 31 the mask is the sign bit and `!== 0` is
      // still the correct test.
      node = (position & (1 << l)) === 0
        ? merkleCRH(l, node, path[l])
        : merkleCRH(l, path[l], node);
    }
    return node;
  }
}

/** MerkleHashOrchard::from_bytes (tree.rs:197-202): parses the canonical
 *  little-endian repr; null for a non-canonical encoding (>= q_P). */
export function leafFromBytes(bytes: Uint8Array): bigint | null {
  if (bytes.length !== 32) return null;
  const v = bytes32LEToBigint(bytes);
  return v < FP_MOD ? v : null;
}

/** MerkleHashOrchard::to_bytes (tree.rs:192-195): 32-byte little-endian
 *  canonical repr. */
export function leafToBytes(value: bigint): Uint8Array {
  return bigintToBytes32LE(value);
}
