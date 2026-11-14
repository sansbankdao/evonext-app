/* sendToken regression tests — the F53 crash guards.
 *
 * The original bug: the F25-era sendToken ran on the dash-platform-sdk
 * wrapper and read `identity.publicKeys[3]` — undefined on the 5.0 SDK —
 * crashing every token send with 'Cannot read properties of undefined
 * (reading 3)'. These tests drive the REWRITTEN sendToken with a mock SDK
 * and assert the CONTRACT that matters: it resolves (contract, position)
 * from the TOKEN id, matches the transfer key by material, passes the
 * right args to sdk.tokenTransfer, and throws an HONEST error for a token
 * that is not live (never a TypeError). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

/* getTransferKey calls identity-manager.getIdentities (its result is
 * unused in the return path, but the CALL must succeed offline). */
vi.mock('@/lib/identity-manager', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        getIdentities: vi.fn(async () => [{ publicKeys: [{ id: 1, purpose: 0, securityLevel: 1 }] }]),
    }
})

vi.mock('@/lib/secure-storage', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        getMnemonic: () => 'legal winner thank year wave sausage worth useful legal winner thank yellow',
        getIdentityIdx: () => 0,
    }
})

/* The fake SDK: getTokenContractInfo resolves the live-verified tDUSD
 * (token id → contract GWghYQoD…, position 0); tokenTransfer captures the
 * args; getIdentity returns an identity whose publicKeys carry the REAL
 * derived transfer key's hash (computed below via the real wasm). */
const tokenTransferMock = vi.fn()
const fakeSdk = {
    getTokenContractInfo: vi.fn(async (tokenId: string) => tokenId === '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz'
        ? { contractId: 'GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23', tokenContractPosition: 0 }
        : undefined),
    tokenTransfer: tokenTransferMock,
    getIdentity: vi.fn(async () => ({})), // publicKeys filled per-test
}

vi.mock('@/lib/services/wasm-sdk-service', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        getWasmSdk: async () => fakeSdk,
        wasmSdkService: actual.wasmSdkService,
    }
})

import { sendToken, getPrivateKeys } from '@/lib/wallet-manager'
import { PrivateKeyWASM } from 'pshenmic-dpp'

const DUSD_TOKEN_ID = '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz'
const DUSD_CONTRACT = 'GWghYQoDFEb3osEfigrF7CKdZLWauxC7TwM4jsJyqa23'
const SENDER = '8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy'
const RECIPIENT = '5apjqb8KhwqMHFRuP59SdDvfFzkzTMhN2wEsHVTPKtU9'
const TRANSFER_WIF = getPrivateKeys('testnet', 0).transferKey.private_key_wif
const TRANSFER_PUB_HASH = PrivateKeyWASM.fromWIF(TRANSFER_WIF).getPublicKeyHash()

describe('sendToken (F53 regression guards)', () => {
    beforeEach(() => {
        tokenTransferMock.mockReset()
        fakeSdk.getIdentity.mockImplementation(async () => ({
            publicKeys: [
                { keyId: 1, data: '00'.repeat(20), purpose: 0, securityLevel: 1 },
                { keyId: 3, data: TRANSFER_PUB_HASH, purpose: 0, securityLevel: 1 },
            ],
        }))
    })

    it('resolves (contract, position) from the TOKEN id and passes them to tokenTransfer', async () => {
        await sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 15_000_000n)

        expect(fakeSdk.getTokenContractInfo).toHaveBeenCalledWith(DUSD_TOKEN_ID)
        expect(tokenTransferMock).toHaveBeenCalledTimes(1)
        const args = tokenTransferMock.mock.calls[0][0]
        /* THE critical assertion: the transfer must target the CONTRACT the
         * token lives in (GWghYQoD…), never the token id itself. */
        expect(args.dataContractId).toBe(DUSD_CONTRACT)
        expect(args.tokenPosition).toBe(0)
        expect(args.senderId).toBe(SENDER)
        expect(args.recipientId).toBe(RECIPIENT)
        expect(args.amount).toBe(15_000_000n)
        expect(typeof args.amount).toBe('bigint')
    })

    it('matches the transfer key BY MATERIAL (keyId 3) — not a positional [3] read', async () => {
        await sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 1n)
        const args = tokenTransferMock.mock.calls[0][0]
        /* The identityKey must be the entry whose data equals the derived
         * transfer key's hash — the anti-pattern (publicKeys[3]) broke on
         * any object whose keys are not index-ordered. */
        expect(args.identityKey.keyId).toBe(3)
        expect(String(args.identityKey.data).toLowerCase()).toBe(TRANSFER_PUB_HASH.toLowerCase())
        expect(args.signer).toBeDefined()
    })

    it('finds the transfer key through nested wrapper shapes (never a positional read)', async () => {
        /* The EXACT original crash shape: wrapper objects whose publicKeys
         * is NOT an index array — the old `publicKeys[3]` read threw
         * 'reading 3 of undefined'. The material match walks VALUES, so a
         * nested-record wrapper still yields the key. */
        fakeSdk.getIdentity.mockImplementation(async () => ({
            publicKeys: {
                byId: { 3: { keyId: 3, data: TRANSFER_PUB_HASH, purpose: 0, securityLevel: 1 } },
                list: [{ keyId: 3, data: TRANSFER_PUB_HASH, purpose: 0, securityLevel: 1 }],
            },
        }))
        await sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 1n)
        expect(tokenTransferMock).toHaveBeenCalledTimes(1)
        const args = tokenTransferMock.mock.calls[0][0]
        expect(args.identityKey.keyId).toBe(3)
    })

    it('throws the honest error when the transfer key is missing (empty/undefined keys)', async () => {
        fakeSdk.getIdentity.mockImplementation(async () => ({ publicKeys: [] }))
        await expect(sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 1n))
            .rejects.toThrow(/no transfer key matching the derived key material/)
        expect(tokenTransferMock).not.toHaveBeenCalled()

        fakeSdk.getIdentity.mockImplementation(async () => ({}))
        await expect(sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 1n))
            .rejects.toThrow(/no transfer key matching the derived key material/)
        expect(tokenTransferMock).not.toHaveBeenCalled()
    })

    it('throws the honest not-live error for an unknown token (no crash)', async () => {
        await expect(sendToken('testnet', SENDER, 0, 'PhantomTokenIdNotOnChain0000000000000000000', RECIPIENT, 1n))
            .rejects.toThrow(/not live on testnet yet/)
        expect(tokenTransferMock).not.toHaveBeenCalled()
    })

    it('rejects an identity that cannot be found (honest error)', async () => {
        fakeSdk.getIdentity.mockImplementation(async () => undefined)
        await expect(sendToken('testnet', SENDER, 0, DUSD_TOKEN_ID, RECIPIENT, 1n))
            .rejects.toThrow(/Identity not found/)
        expect(tokenTransferMock).not.toHaveBeenCalled()
    })
})
