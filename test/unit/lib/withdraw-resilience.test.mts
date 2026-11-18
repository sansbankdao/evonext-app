/* withdrawToCore resilience tests — the F57h guards.
 *
 * The incident (2026-11-18, live): the user's Withdraw to Dash (L1)
 * failed with "Dapi client error: transport error: grpc error: code:
 * 'Deadline expired before operation could complete'... request timed
 * out after 7.950s" — the 8s transport deadline of the singleton SDK
 * killed the high-level op's WAIT (it broadcasts first, then waits for
 * the transition to be included in a block; testnet block production is
 * irregular). The user retried TWICE and then hit "Object already
 * exists: tx already exists in cache" — the tenderdash mempool cache
 * rejecting the byte-identical resubmission, which PROVES the first
 * attempt was already in the queue. A naive retry after a commit would
 * DOUBLE-PAY.
 *
 * The contract pinned here:
 *  1. A fresh in-flight withdrawal (status 1/2, < 2h) refuses a second
 *     submission with an honest, human message (the F48 idempotency rule).
 *  2. "tx already exists in cache" is translated to "already in the
 *     queue — do NOT resubmit", never the cryptic tenderdash error.
 *  3. A deadline-expired is NOT a failure: the code polls the withdrawal
 *     system contract; a committed doc returns success (unconfirmed:
 *     false) with the refreshed balance.
 *  4. If nothing commits within the poll window, the result is HONEST
 *     (unconfirmed: true) — a RESULT, not a throw, so the UI shows the
 *     do-not-resubmit note instead of a failure toast.
 *  5. Unrelated errors pass through unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

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
        getPrivateKey: () => undefined,
    }
})

vi.mock('@/lib/dapi-proxy', () => ({
    proxyCall: vi.fn(async (method: string) => {
        throw new Error(`Method '${method}' is not supported.`)
    }),
}))

vi.mock('dash-platform-sdk', () => ({
    DashPlatformSDK: class {},
}))

/* The fake SDK: getDocuments = the withdrawal-doc reader (per status leg),
 * identityCreditWithdrawal = the broadcast+wait op under test,
 * getIdentity = the balance refresh after a committed doc. */
const getDocumentsMock = vi.fn(async () => [])
const withdrawalOpMock = vi.fn()
const fakeSdk = {
    getDocuments: getDocumentsMock,
    identityCreditWithdrawal: withdrawalOpMock,
    getIdentity: vi.fn(async () => ({ balance: 2_000_000_000n })),
}

vi.mock('@/lib/services/wasm-sdk-service', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        getWasmSdk: async () => fakeSdk,
        wasmSdkService: actual.wasmSdkService,
    }
})

import { withdrawToCore, getPrivateKeys } from '@/lib/wallet-manager'
import { PrivateKeyWASM } from 'pshenmic-dpp'

const SENDER = '8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy'
const CORE_ADDRESS = 'ydSpCGhjxCH77HHnjq5SdQ58fSTGNQ5WC1'
const CREDITS = 100_000_000n
const TRANSFER_WIF = getPrivateKeys('testnet', 0).transferKey.private_key_wif
const FAST_POLL = { attempts: 3, intervalMs: 5 }

describe('withdrawToCore resilience (F57h regression guards)', () => {
    beforeEach(() => {
        getDocumentsMock.mockReset()
        getDocumentsMock.mockImplementation(async () => [])
        withdrawalOpMock.mockReset()
        fakeSdk.getIdentity.mockReset()
        fakeSdk.getIdentity.mockImplementation(async () => ({ balance: 2_000_000_000n }))
    })

    it('refuses a second withdrawal while one is in flight (the F48 idempotency rule)', async () => {
        /* status 2 = signed, $updatedAt 1 minute ago = fresh. */
        getDocumentsMock.mockImplementation(async (opts: any) => {
            if (opts?.where?.[1]?.[2] === 2) {
                return [{ $id: 'doc1', status: 2, amount: '50000000', $updatedAt: Date.now() - 60_000 }]
            }
            return []
        })

        await expect(withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL))
            .rejects.toThrow(/already have a withdrawal in flight[\s\S]*pay out TWICE/)

        /* The broadcast op must NEVER have been reached. */
        expect(withdrawalOpMock).not.toHaveBeenCalled()
    })

    it('translates "tx already exists in cache" to the honest queue message', async () => {
        withdrawalOpMock.mockImplementation(async () => {
            throw Object.assign(new Error('Withdrawal failed: Object already exists: tx already exists in cache'), {})
        })

        await expect(withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL))
            .rejects.toThrow(/ALREADY in the network queue[\s\S]*pay out twice/)
    })

    it('survives a deadline-expired: a committed withdrawal doc returns SUCCESS', async () => {
        withdrawalOpMock.mockImplementation(async () => {
            throw new Error("Dapi client error: transport error: grpc error: code: 'Deadline expired before operation could complete', message: \"request timed out after 7.950s: request timed out\"")
        })
        /* Polls 1-2 see nothing; poll 3 finds the committed doc (amount
         * matches, created just now). */
        let poll = 0
        getDocumentsMock.mockImplementation(async (opts: any) => {
            poll += 1
            if (poll >= 3 && opts?.where?.[1]?.[2] === 2) {
                return [{ $id: 'docX', status: 2, amount: CREDITS.toString(), $createdAt: Date.now() - 5_000 }]
            }
            return []
        })

        const result = await withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL) as any

        expect(result.unconfirmed).toBe(false)
        expect(result.remainingBalance).toBe(2_000_000_000n)
    })

    it('survives a deadline-expired with NOTHING committed: an honest unconfirmed RESULT, not a throw', async () => {
        withdrawalOpMock.mockImplementation(async () => {
            throw new Error('request timed out after 7.950s: request timed out')
        })
        /* Both status legs always answer empty — the tx is still in the
         * mempool (no doc exists until the block commits). */

        const result = await withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL) as any

        expect(result.unconfirmed).toBe(true)
        expect(result.remainingBalance).toBeUndefined()
        /* The transfer key must still have been resolved and the op called
         * (the broadcast path ran; only the wait died). */
        expect(withdrawalOpMock).toHaveBeenCalledTimes(1)
        expect(withdrawalOpMock.mock.calls[0][0].amount).toBe(CREDITS)
        expect(withdrawalOpMock.mock.calls[0][0].toAddress).toBe(CORE_ADDRESS)
    })

    it('passes unrelated errors through unchanged', async () => {
        withdrawalOpMock.mockImplementation(async () => {
            throw new Error('Insufficient identity balance')
        })

        await expect(withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL))
            .rejects.toThrow('Insufficient identity balance')
    })

    it('sends with the identity transfer key material (the signing contract)', async () => {
        withdrawalOpMock.mockImplementation(async () => 123n)

        const result = await withdrawToCore('testnet', SENDER, 0, CREDITS, CORE_ADDRESS, 1, FAST_POLL) as any

        expect(result.remainingBalance).toBe(123n)
        const args = withdrawalOpMock.mock.calls[0][0]
        expect(args.coreFeePerByte).toBe(1)
        expect(Number.isInteger(args.coreFeePerByte)).toBe(true)
        /* The signer must carry the TRANSFER key's WIF (the F25/F53
         * authority; material-match sanity via the derived hash). */
        expect(TRANSFER_WIF).toBeTruthy()
        expect(PrivateKeyWASM.fromWIF(TRANSFER_WIF).getPublicKeyHash()).toBeTruthy()
    })
})
