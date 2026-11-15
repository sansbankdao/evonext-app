// test/unit/lib/trustless-reads.test.mts
// F57 Phase 1 — the trustless READ ladder (lib/trustless-reads.ts):
// proxy-first with the "not supported" memo, the pshenmic JS SDK tier
// (2-attempt rotation), and the lazy WASM last-resort tier. Contract tests
// with a fake DashPlatformSDK + the dapi-proxy envelope pattern (the
// dapi-proxy-shielded style); module state (the SDK cache + the unsupported
// memo) is reset per test via vi.resetModules.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bech32m } from '@scure/base';

/* Holders survive vi.resetModules (vi.hoisted); the vi.fn()s themselves are
 * re-created in beforeEach. */
const h = vi.hoisted(() => ({
    sdkGetAddressesInfos: undefined as any,
    sdkGetTokenBalances: undefined as any,
    serviceInitializedNetwork: undefined as any,
    serviceInitialize: undefined as any,
    getWasmSdk: undefined as any,
    compatTokenBalances: undefined as any,
}));

vi.mock('dash-platform-sdk', () => ({
    DashPlatformSDK: class {
        platformAddresses = {
            getAddressesInfos: (...args: unknown[]) => h.sdkGetAddressesInfos(...args),
        };
        tokens = {
            getIdentitiesTokenBalances: (...args: unknown[]) => h.sdkGetTokenBalances(...args),
        };
    },
}));

vi.mock('../../../lib/services/wasm-sdk-service', () => ({
    wasmSdkService: {
        initializedNetwork: () => h.serviceInitializedNetwork(),
        initialize: (...args: unknown[]) => h.serviceInitialize(...args),
    },
    getWasmSdk: () => h.getWasmSdk(),
}));

vi.mock('../../../lib/constants', () => ({
    EVONEXT_CONTRACT_ID_MAINNET: 'contract-mainnet',
    EVONEXT_CONTRACT_ID_TESTNET: 'contract-testnet',
}));

vi.mock('../../../lib/dash-wasm/compat', () => ({
    get_identities_token_balances_with_proof_info: (...args: unknown[]) =>
        h.compatTokenBalances(...args),
}));

import type { ProxyNetwork } from '../../../lib/trustless-reads';

const NETWORK: ProxyNetwork = 'testnet';

function okEnvelope(result: unknown) {
    return { ok: true, json: async () => ({ success: true, result }) } as Response;
}
function errEnvelope(error: string) {
    return { ok: true, json: async () => ({ success: false, error }) } as Response;
}
function lastRequestBody(): { method: string; params: any; network: string } {
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    return JSON.parse((call[1] as RequestInit).body as string);
}

/** bech32m-encode a DIP-17 P2PKH address for a 20-byte hash160. */
function dip17Address(hash160: Uint8Array, hrp: 'dash' | 'tdash' = 'tdash'): string {
    const payload = new Uint8Array(21);
    payload[0] = 0xb0;
    payload.set(hash160, 1);
    return bech32m.encode(hrp, bech32m.toWords(payload));
}

const HASH_A = new Uint8Array(20).fill(0xaa);
const HASH_B = new Uint8Array(20).fill(0xbb);
const ADDR_A = dip17Address(HASH_A);
/* The variant-hex key the consumers look up (tag 0 || hash160). */
const KEY_A = '00' + 'aa'.repeat(20);
const KEY_B = '00' + 'bb'.repeat(20);

const loadModule = async () =>
    await import('../../../lib/trustless-reads');

describe('trustless reads (F57 Phase 1 ladder)', () => {
    beforeEach(() => {
        vi.resetModules();
        h.sdkGetAddressesInfos = vi.fn();
        h.sdkGetTokenBalances = vi.fn();
        h.serviceInitializedNetwork = vi.fn(() => NETWORK);
        h.serviceInitialize = vi.fn();
        h.getWasmSdk = vi.fn();
        h.compatTokenBalances = vi.fn();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('tier 1: the proxy serves get_addresses_infos — correct key + params, no pshenmic call', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([{ address: ADDR_A, balance: '123', nonce: 2 }]));
        h.sdkGetAddressesInfos.mockResolvedValue([]);

        const { getAddressesInfos } = await loadModule();
        const infos = await getAddressesInfos(NETWORK, [ADDR_A]);

        const body = lastRequestBody();
        expect(body.method).toBe('get_addresses_infos');
        expect(body.network).toBe(NETWORK);
        expect(body.params).toEqual({ addresses: [ADDR_A] });

        expect(infos.size).toBe(1);
        expect(infos.get(KEY_A)).toEqual({ balance: 123n, nonce: 2 });
        expect(h.sdkGetAddressesInfos).not.toHaveBeenCalled();
    });

    it('tier 1: the explicit "not supported" verdict is memoized — the next call skips the proxy', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(errEnvelope("Method 'get_addresses_infos' is not supported."));
        h.sdkGetAddressesInfos.mockResolvedValue([
            { address: { bytes: () => new Uint8Array([0, ...HASH_A]) }, balance: 5n, nonce: 1 },
        ]);

        const { getAddressesInfos } = await loadModule();
        const first = await getAddressesInfos(NETWORK, [ADDR_A]);
        expect(first.get(KEY_A)).toEqual({ balance: 5n, nonce: 1 });
        expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

        const second = await getAddressesInfos(NETWORK, [ADDR_A]);
        expect(second.get(KEY_A)).toEqual({ balance: 5n, nonce: 1 });
        /* The memo: NO second proxy round trip. */
        expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });

    it('tier 1: any OTHER proxy error falls through per call (no memo)', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(errEnvelope('boom'));
        h.sdkGetAddressesInfos.mockResolvedValue([]);

        const { getAddressesInfos } = await loadModule();
        await getAddressesInfos(NETWORK, [ADDR_A]);
        await getAddressesInfos(NETWORK, [ADDR_A]);

        expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
        expect(h.sdkGetAddressesInfos).toHaveBeenCalledTimes(2);
    });

    it('tier 2: the pshenmic result keys by the variant-hex bytes; 2 attempts on failure then the WASM tier', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope("Method 'get_addresses_infos' is not supported."));
        h.sdkGetAddressesInfos
            .mockRejectedValueOnce(new Error('UNIMPLEMENTED'))
            .mockRejectedValueOnce(new Error('UNIMPLEMENTED again'));
        const fakeSdk = {
            getAddressesInfos: vi.fn().mockResolvedValue(
                new Map([[KEY_A, { balance: 77n, nonce: 9n }]])),
        };
        h.getWasmSdk.mockResolvedValue(fakeSdk);
        /* The F37 gotcha: the WASM tier re-initializes on a network mismatch. */
        h.serviceInitializedNetwork = vi.fn(() => 'mainnet');

        const { getAddressesInfos } = await loadModule();
        const infos = await getAddressesInfos(NETWORK, [ADDR_A]);

        expect(h.sdkGetAddressesInfos).toHaveBeenCalledTimes(2);
        expect(h.getWasmSdk).toHaveBeenCalledTimes(1);
        expect(h.serviceInitialize).toHaveBeenCalledWith({
            network: NETWORK,
            contractId: 'contract-testnet',
        });
        expect(infos.get(KEY_A)).toEqual({ balance: 77n, nonce: 9 });
    });

    it('tier 1 tokens: holders mapped, non-holders (balance undefined) omitted', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope("Method 'get_identities_token_balances' is not supported."));
        h.sdkGetTokenBalances.mockResolvedValue([
            { identityId: { base58: () => 'id-holder' }, balance: 15_000_000n },
            { identityId: { base58: () => 'id-empty' }, balance: undefined },
        ]);

        const { getIdentitiesTokenBalances } = await loadModule();
        const balances = await getIdentitiesTokenBalances(
            NETWORK, ['id-holder', 'id-empty'], 'token-id');

        const body = lastRequestBody();
        expect(body.method).toBe('get_identities_token_balances');
        expect(body.params).toEqual({ identityIds: ['id-holder', 'id-empty'], tokenId: 'token-id' });

        expect(balances.size).toBe(1);
        expect(balances.get('id-holder')).toBe(15_000_000n);
        expect(balances.has('id-empty')).toBe(false);
    });

    it('tier 3 tokens: the WASM compat fallback maps the {data:[{identityId,balance}]} response', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            errEnvelope("Method 'get_identities_token_balances' is not supported."));
        h.sdkGetTokenBalances
            .mockRejectedValueOnce(new Error('seeds down'))
            .mockRejectedValueOnce(new Error('seeds down again'));
        h.compatTokenBalances.mockResolvedValue({
            data: [{ identityId: 'id-x', balance: '7' }],
        });

        const { getIdentitiesTokenBalances } = await loadModule();
        const balances = await getIdentitiesTokenBalances(NETWORK, ['id-x'], 'token-id');

        expect(h.sdkGetTokenBalances).toHaveBeenCalledTimes(2);
        expect(h.compatTokenBalances).toHaveBeenCalledTimes(1);
        expect(balances.get('id-x')).toBe(7n);
    });

    it('tier 2 tokens: a proxy SUCCESS is used verbatim (string balance -> bigint)', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([{ identityId: 'id-y', balance: '1000000' }]));

        const { getIdentitiesTokenBalances } = await loadModule();
        const balances = await getIdentitiesTokenBalances(NETWORK, ['id-y'], 'token-id');

        expect(balances.get('id-y')).toBe(1_000_000n);
        expect(h.sdkGetTokenBalances).not.toHaveBeenCalled();
    });
});
