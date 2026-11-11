// test/unit/lib/shielded-tree.test.mts
// KAT for lib/shielded/tree.ts against the orchard fork's own test vectors
// (dashpay/orchard dashified-0.14.1 @ 38ac9c1, src/test_vectors/), extracted
// to test/fixtures/shielded-tree-vectors.json. These are the official
// zcash-hackworks orchard merkle tree / empty roots vectors.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hexToBytes } from '@noble/hashes/utils.js';
import {
  OrchardTree,
  emptyRoots,
  leafFromBytes,
  leafToBytes,
  UNCOMMITTED_ORCHARD,
} from '@/lib/shielded/tree';
import { FP_MOD } from '@/lib/shielded/pasta';

interface TreeVectors {
  empty_roots: string[];
  merkle_path_vectors_depth4: { leaves: string[]; paths: string[][]; root: string }[];
  frontier_test_depth32: { commitments: string[]; anchor: string };
}

const vectors: TreeVectors = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/shielded-tree-vectors.json'), 'utf8'),
);

const le = (hex: string) => BigInt('0x' + Buffer.from(hexToBytes(hex)).reverse().toString('hex'));

describe('orchard note commitment tree', () => {
  it('computes all 33 EMPTY_ROOTS exactly', () => {
    const roots = emptyRoots(32);
    expect(roots.length).toBe(33);
    expect(roots[0]).toBe(UNCOMMITTED_ORCHARD);
    expect(roots[0]).toBe(2n);
    for (let h = 0; h <= 32; h++) {
      expect(leafToBytes(roots[h])).toEqual(hexToBytes(vectors.empty_roots[h]));
    }
  });

  it('empty depth-32 tree root equals EMPTY_ROOTS[32]', () => {
    const tree = new OrchardTree(32);
    expect(tree.size).toBe(0);
    expect(leafToBytes(tree.root())).toEqual(hexToBytes(vectors.empty_roots[32]));
  });

  it('reproduces the 16 depth-4 ShardTree vectors (incremental append + root + auth paths)', () => {
    // Fork test (tree.rs test_vectors): ONE ShardTree<_, 4, 3> accumulates
    // leaves across vectors — step i appends vectors[i].leaves[i], then the
    // root must equal vectors[i].root and the auth path of every earlier
    // position j must equal vectors[i].paths[j].
    const tree = new OrchardTree(4);
    for (let i = 0; i < 16; i++) {
      const tv = vectors.merkle_path_vectors_depth4[i];
      const pos = tree.append(le(tv.leaves[i]));
      expect(pos).toBe(i);
      expect(tree.size).toBe(i + 1);
      expect(leafToBytes(tree.root())).toEqual(hexToBytes(tv.root));
      for (let j = 0; j <= i; j++) {
        const path = tree.authPath(j);
        expect(path.length).toBe(4);
        for (let h = 0; h < 4; h++) {
          expect(leafToBytes(path[h])).toEqual(hexToBytes(tv.paths[j][h]));
        }
      }
    }
  });

  it('rootFromPath folds each depth-4 vector path back to its root', () => {
    const tree = new OrchardTree(4);
    for (let i = 0; i < 16; i++) {
      const tv = vectors.merkle_path_vectors_depth4[i];
      tree.append(le(tv.leaves[i]));
      for (let j = 0; j <= i; j++) {
        const leafJ = le(vectors.merkle_path_vectors_depth4[j].leaves[j]);
        const folded = OrchardTree.rootFromPath(leafJ, j, tv.paths[j].map(le), 4);
        expect(leafToBytes(folded)).toEqual(hexToBytes(tv.root));
      }
    }
  });

  it('reproduces the depth-32 Frontier root (5 real commitments)', () => {
    // Fork test (tree.rs): Frontier<MerkleHashOrchard, 32> over 5 real
    // commitments must root at the pinned anchor (zcash-hackworks vector).
    const tree = new OrchardTree(32);
    for (const c of vectors.frontier_test_depth32.commitments) {
      tree.append(le(c));
    }
    expect(tree.size).toBe(5);
    expect(leafToBytes(tree.root())).toEqual(hexToBytes(vectors.frontier_test_depth32.anchor));
  });

  it('authPath at depth 32 returns 32 nodes and folds back to the root', () => {
    const tree = new OrchardTree(32);
    const leaves = vectors.frontier_test_depth32.commitments.map(le);
    for (const c of leaves) tree.append(c);
    for (let j = 0; j < leaves.length; j++) {
      const path = tree.authPath(j);
      expect(path.length).toBe(32);
      const folded = OrchardTree.rootFromPath(leaves[j], j, path);
      expect(folded).toBe(tree.root());
    }
  });

  it('leafFromBytes rejects non-canonical encodings (>= q_P)', () => {
    expect(leafFromBytes(leafToBytes(FP_MOD))).toBeNull();
    expect(leafFromBytes(new Uint8Array(31))).toBeNull();
    expect(leafFromBytes(new Uint8Array(32).fill(0xff))).toBeNull();
    expect(leafFromBytes(leafToBytes(2n))).toBe(2n);
  });

  it('authPath rejects out-of-range positions', () => {
    const tree = new OrchardTree(4);
    tree.append(2n);
    expect(() => tree.authPath(1)).toThrowError(RangeError);
    expect(() => tree.authPath(-1)).toThrowError(RangeError);
  });
});
