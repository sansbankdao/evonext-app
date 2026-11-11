// test/unit/lib/dapi-proxy-shielded.test.mts
// Proxy-PRIMARY shielded read wrappers (lib/dapi-proxy.ts): request shape,
// {data,dataB64} decoding, and per-call WASM fallback.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchShieldedEncryptedNotesViaProxy,
    fetchShieldedAnchorsViaProxy,
    fetchMostRecentShieldedAnchorViaProxy,
    fetchShieldedNullifiersViaProxy,
    fetchShieldedPoolStateViaProxy,
    fetchShieldedNotesCountViaProxy,
    makeProxyFirstShieldedSource,
} from '../../../lib/dapi-proxy';

const HEX32_A = '11'.repeat(32);
const HEX32_B = '22'.repeat(32);
const HEX216 = 'aa'.repeat(216);

function okEnvelope(result: unknown) {
    return {
        ok: true,
        json: async () => ({ success: true, result }),
    } as Response;
}

function errEnvelope(error: string) {
    return {
        ok: true,
        json: async () => ({ success: false, error }),
    } as Response;
}

function lastRequestBody(): { method: string; params: any; network: string } {
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    return JSON.parse((call[1] as RequestInit).body as string);
}

const noteRow = {
    cmx: { data: HEX32_A },
    cvNet: { data: HEX32_B },
    encryptedNote: { data: HEX216 },
    nullifier: { data: HEX32_A },
};

describe('dapi-proxy shielded reads (proxy PRIMARY)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('encrypted notes: request body + {data} hex decoding + lengths', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([noteRow]));
        const fallback = vi.fn().mockResolvedValue([]);
        const rows = await fetchShieldedEncryptedNotesViaProxy(2048n, 2048, 'mainnet', fallback);

        const body = lastRequestBody();
        expect(body.method).toBe('get_shielded_encrypted_notes');
        expect(body.network).toBe('mainnet');
        expect(body.params.startIndex).toBe('2048'); // string, not number
        expect(body.params.count).toBe(2048);

        expect(rows).toHaveLength(1);
        expect(rows[0].cmx).toBeInstanceOf(Uint8Array);
        expect(rows[0].cmx).toHaveLength(32);
        expect(rows[0].cmx[0]).toBe(0x11);
        expect(rows[0].cvNet[0]).toBe(0x22);
        expect(rows[0].encryptedNote).toHaveLength(216);
        expect(rows[0].encryptedNote[0]).toBe(0xaa);
        expect(rows[0].nullifier).toHaveLength(32);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('encrypted notes: proxy error falls back to WASM', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(errEnvelope('boom'));
        const fallbackRows = [{ cmx: new Uint8Array(32), cvNet: new Uint8Array(32), encryptedNote: new Uint8Array(216), nullifier: new Uint8Array(32) }];
        const fallback = vi.fn().mockResolvedValue(fallbackRows);
        const rows = await fetchShieldedEncryptedNotesViaProxy(0n, 2048, 'testnet', fallback);
        expect(fallback).toHaveBeenCalledTimes(1);
        expect(rows).toBe(fallbackRows);
    });

    it('encrypted notes: malformed row (short cmx) falls back to WASM', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([{ ...noteRow, cmx: { data: '11'.repeat(31) } }]));
        const fallback = vi.fn().mockResolvedValue([]);
        const rows = await fetchShieldedEncryptedNotesViaProxy(0n, 2048, 'mainnet', fallback);
        expect(fallback).toHaveBeenCalledTimes(1);
        expect(rows).toHaveLength(0);
    });

    it('anchors: array of {data} -> Uint8Array[32]', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([{ data: HEX32_A }, { data: HEX32_B }]));
        const fallback = vi.fn().mockResolvedValue([]);
        const anchors = await fetchShieldedAnchorsViaProxy('mainnet', fallback);
        expect(anchors).toHaveLength(2);
        expect(anchors[0][0]).toBe(0x11);
        expect(anchors[1][0]).toBe(0x22);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('anchors: network failure falls back to WASM', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fetch failed'));
        const wasmAnchors = [new Uint8Array(32).fill(7)];
        const fallback = vi.fn().mockResolvedValue(wasmAnchors);
        const anchors = await fetchShieldedAnchorsViaProxy('testnet', fallback);
        expect(fallback).toHaveBeenCalledTimes(1);
        expect(anchors).toBe(wasmAnchors);
    });

    it('most recent anchor: {data} decode; null (empty pool) -> undefined', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okEnvelope({ data: HEX32_B }))
            .mockResolvedValueOnce(okEnvelope(null));
        const fallback = vi.fn().mockResolvedValue(undefined);
        const a = await fetchMostRecentShieldedAnchorViaProxy('mainnet', fallback);
        expect(a).toBeInstanceOf(Uint8Array);
        expect(a![0]).toBe(0x22);
        const b = await fetchMostRecentShieldedAnchorViaProxy('mainnet', fallback);
        expect(b).toBeUndefined();
        expect(fallback).not.toHaveBeenCalled();
    });

    it('nullifiers: sends 64-char hex strings, maps isSpent + decodes', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([
                { nullifier: { data: HEX32_A }, isSpent: true },
                { nullifier: { data: HEX32_B }, isSpent: false },
            ]));
        const fallback = vi.fn().mockResolvedValue([]);
        const out = await fetchShieldedNullifiersViaProxy(
            [new Uint8Array(32).fill(0x33)], 'mainnet', fallback);
        const body = lastRequestBody();
        expect(body.params.nullifiers).toEqual(['33'.repeat(32)]);
        expect(out).toHaveLength(2);
        expect(out[0].isSpent).toBe(true);
        expect(out[0].nullifier[0]).toBe(0x11);
        expect(out[1].isSpent).toBe(false);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('pool state: decimal string -> bigint; null -> undefined; garbage -> fallback', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okEnvelope('809521943371910'))
            .mockResolvedValueOnce(okEnvelope(null))
            .mockResolvedValueOnce(okEnvelope(809521943371910)); // number, not string
        const fallback = vi.fn().mockResolvedValue(42n);
        const a = await fetchShieldedPoolStateViaProxy('mainnet', fallback);
        expect(a).toBe(809521943371910n);
        const b = await fetchShieldedPoolStateViaProxy('mainnet', fallback);
        expect(b).toBeUndefined();
        const c = await fetchShieldedPoolStateViaProxy('mainnet', fallback);
        expect(c).toBe(42n); // fell back
        expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('notes count: decimal string -> bigint', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope('5194'));
        const fallback = vi.fn().mockResolvedValue(undefined);
        const n = await fetchShieldedNotesCountViaProxy('testnet', fallback);
        expect(n).toBe(5194n);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('makeProxyFirstShieldedSource: proxy-first for all 4 methods; per-call WASM fallback', async () => {
        const wasm = {
            getShieldedEncryptedNotes: vi.fn().mockResolvedValue(['wasm-notes']),
            getShieldedAnchors: vi.fn().mockResolvedValue(['wasm-anchors']),
            getMostRecentShieldedAnchor: vi.fn().mockResolvedValue(undefined),
            getShieldedNullifiers: vi.fn().mockResolvedValue(['wasm-nullifiers']),
        };
        const src = makeProxyFirstShieldedSource('mainnet', wasm as any);

        // Round 1: proxy healthy — everything served from the proxy.
        (fetch as unknown as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okEnvelope([noteRow]))
            .mockResolvedValueOnce(okEnvelope([{ data: HEX32_A }]))
            .mockResolvedValueOnce(okEnvelope({ data: HEX32_B }))
            .mockResolvedValueOnce(okEnvelope([{ nullifier: { data: HEX32_A }, isSpent: false }]));
        const notes = await src.getShieldedEncryptedNotes(0n, 2048);
        const anchors = await src.getShieldedAnchors();
        const recent = await src.getMostRecentShieldedAnchor();
        const statuses = await src.getShieldedNullifiers([new Uint8Array(32)]);
        expect(notes[0].cmx).toBeInstanceOf(Uint8Array);
        expect(anchors[0][0]).toBe(0x11);
        expect(recent![0]).toBe(0x22);
        expect(statuses[0].isSpent).toBe(false);
        expect(wasm.getShieldedEncryptedNotes).not.toHaveBeenCalled();
        expect(wasm.getShieldedAnchors).not.toHaveBeenCalled();
        expect(wasm.getMostRecentShieldedAnchor).not.toHaveBeenCalled();
        expect(wasm.getShieldedNullifiers).not.toHaveBeenCalled();

        // Round 2: proxy dead — each call independently falls back.
        (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fetch failed'));
        await expect(src.getShieldedEncryptedNotes(0n, 2048)).resolves.toEqual(['wasm-notes']);
        await expect(src.getShieldedAnchors()).resolves.toEqual(['wasm-anchors']);
        await expect(src.getMostRecentShieldedAnchor()).resolves.toBeUndefined();
        await expect(src.getShieldedNullifiers([new Uint8Array(32)])).resolves.toEqual(['wasm-nullifiers']);
        expect(wasm.getShieldedEncryptedNotes).toHaveBeenCalledTimes(1);
        expect(wasm.getShieldedAnchors).toHaveBeenCalledTimes(1);
        expect(wasm.getMostRecentShieldedAnchor).toHaveBeenCalledTimes(1);
        expect(wasm.getShieldedNullifiers).toHaveBeenCalledTimes(1);
    });
});
