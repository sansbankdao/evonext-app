// test/unit/lib/dapi-proxy-documents.test.mts
// F57 Phase 3 — the document/feed reads on the ladder: proxy-first request
// shape, honest empty answers, and the per-call wasm fallback contract.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchDocumentsProxyFirst,
    fetchDocumentViaProxyFirst,
} from '../../../lib/dapi-proxy';

const CONTRACT = 'EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJYNg63F';
const DOC_ID = 'BL8nuehbdeqimHe7o8zjdDaA5v9NLA8yT6qMNc9GbMm8';

function okEnvelope(result: unknown) {
    return {
        ok: true,
        json: async () => ({ success: true, result }),
    } as Response;
}

function errEnvelope(error: string, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => ({ success: false, error }),
    } as Response;
}

function lastRequestBody(): { method: string; params: any; network: string } {
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    return JSON.parse((call[1] as RequestInit).body as string);
}

const flatRow = {
    $id: DOC_ID,
    $ownerId: '8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy',
    content: 'Single contract test',
    language: 'en',
    sensitive: false,
    $revision: 1,
    $createdAt: 1791212560817,
    $updatedAt: null,
};

describe('dapi-proxy document reads (proxy PRIMARY, F57 Phase 3)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('get_documents: the proxy request shape (dataContractId/documentType/whereClause/orderBy/limit) + rows pass through', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([flatRow]));
        const fallback = vi.fn().mockResolvedValue([]);
        const rows = await fetchDocumentsProxyFirst('testnet', {
            contractId: CONTRACT,
            type: 'post',
            where: [['language', '==', 'en'], ['$createdAt', '>', 0]],
            orderBy: [['language', 'asc'], ['$createdAt', 'desc']],
            limit: 20,
        }, fallback);

        const body = lastRequestBody();
        expect(body.method).toBe('get_documents');
        expect(body.network).toBe('testnet');
        expect(body.params.dataContractId).toBe(CONTRACT);
        expect(body.params.documentType).toBe('post');
        expect(body.params.whereClause).toEqual([['language', '==', 'en'], ['$createdAt', '>', 0]]);
        expect(body.params.orderBy).toEqual([['language', 'asc'], ['$createdAt', 'desc']]);
        expect(body.params.limit).toBe(20);

        expect(rows).toHaveLength(1);
        expect(rows[0].$id).toBe(DOC_ID);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('get_documents: empty proxy array is an honest answer — returned as-is, no fallback', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]));
        const fallback = vi.fn().mockResolvedValue([{ $id: 'should-not-appear' }]);
        const rows = await fetchDocumentsProxyFirst('testnet', {
            contractId: CONTRACT, type: 'post', limit: 20,
        }, fallback);

        expect(rows).toEqual([]);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('get_documents: optional clauses omitted when absent (no whereClause key)', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]));
        await fetchDocumentsProxyFirst('testnet', {
            contractId: CONTRACT, type: 'post', limit: 3,
        }, vi.fn());

        const body = lastRequestBody();
        expect(body.params.whereClause).toBeUndefined();
        expect(body.params.orderBy).toBeUndefined();
        expect(body.params.startAfter).toBeUndefined();
        expect(body.params.startAt).toBeUndefined();
        expect(body.params.limit).toBe(3);
    });

    it('get_documents: proxy failure (success:false) -> the wasm fallback answers', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope('Invalid where clause: query must target a valid contract index'));
        const fallback = vi.fn().mockResolvedValue([flatRow]);
        const rows = await fetchDocumentsProxyFirst('testnet', {
            contractId: CONTRACT, type: 'post',
            where: [['$ownerId', '==', 'x']],
        }, fallback);

        expect(fallback).toHaveBeenCalledTimes(1);
        expect(rows).toEqual([flatRow]);
    });

    it('get_documents: a non-array proxy result is a shape break -> fallback', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope({ weird: true }));
        const fallback = vi.fn().mockResolvedValue([]);
        const rows = await fetchDocumentsProxyFirst('testnet', {
            contractId: CONTRACT, type: 'post',
        }, fallback);

        expect(fallback).toHaveBeenCalledTimes(1);
        expect(rows).toEqual([]);
    });

    it('get_document: found -> the row, no fallback', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope(flatRow));
        const fallback = vi.fn();
        const doc = await fetchDocumentViaProxyFirst('testnet', CONTRACT, 'post', DOC_ID, fallback);

        const body = lastRequestBody();
        expect(body.method).toBe('get_document');
        expect(body.params.documentId).toBe(DOC_ID);
        expect(doc?.$id).toBe(DOC_ID);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('get_document: the definitive "Document not found" verdict -> undefined WITHOUT burning the fallback', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope('Document not found', 404));
        const fallback = vi.fn();
        const doc = await fetchDocumentViaProxyFirst('testnet', CONTRACT, 'post', DOC_ID, fallback);

        expect(doc).toBeUndefined();
        expect(fallback).not.toHaveBeenCalled();
    });

    it('get_document: any other proxy failure -> the wasm fallback answers', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope('Upstream DAPI unavailable', 502));
        const fallback = vi.fn().mockResolvedValue(flatRow);
        const doc = await fetchDocumentViaProxyFirst('testnet', CONTRACT, 'post', DOC_ID, fallback);

        expect(fallback).toHaveBeenCalledTimes(1);
        expect(doc?.$id).toBe(DOC_ID);
    });
});
