// test/unit/lib/dpns-ladder.test.mts
// F57 Phase 3b regression — the DPNS username lookups ride the ladder
// (proxy-first records.identity doc queries; the wasm-native sequence stays
// as the fallback). The feed's resolveUsername fans out ~2 lookups per
// author per load (F26s) — those must not hang on the wasm transport, and
// the row mapping (label + normalizedParentDomainName) must match the
// proxy's flat $-shape exactly.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const getDocumentsMock = vi.hoisted(() => vi.fn())
const getDpnsUsernamesMock = vi.hoisted(() => vi.fn())
const getWasmSdkMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/dash-wasm/compat', () => ({
    get_documents: getDocumentsMock,
    get_dpns_usernames: getDpnsUsernamesMock,
    dpns_convert_to_homograph_safe: vi.fn(),
    dpns_is_valid_username: vi.fn(),
    dpns_is_contested_username: vi.fn(() => false),
    dpns_register_name: vi.fn(),
    dpns_is_name_available: vi.fn(),
    dpns_resolve_name: vi.fn(),
}))

vi.mock('@/lib/services/wasm-sdk-service', () => ({
    getWasmSdk: getWasmSdkMock,
}))

import { dpnsService } from '@/lib/services/dpns-service'
import { DPNS_CONTRACT_ID, DPNS_DOCUMENT_TYPE } from '@/lib/constants'
import { base58 } from '@scure/base'

const ID_A = 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa'
const ID_B = '8Yj6VuAEr5VMRhYeume9fNgCueYNv2oUJmWeBqX5UUXy'

function okEnvelope(result: unknown) {
    return { ok: true, json: async () => ({ success: true, result }) } as Response
}

function lastRequestBody(): { method: string; params: any; network: string } {
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    return JSON.parse((call[1] as RequestInit).body as string)
}

const domainRow = (label: string, createdAt: number) => ({
    $id: `${label}-row`,
    $ownerId: ID_A,
    label,
    normalizedLabel: label,
    normalizedParentDomainName: 'dash',
    records: { identity: ID_A },
    $createdAt: createdAt,
})

describe('dpns-service: the username lookups on the ladder (F57 Phase 3b)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
        getDocumentsMock.mockReset()
        getDpnsUsernamesMock.mockReset()
        getWasmSdkMock.mockReset()
        ;(dpnsService as any).cache.clear()
        ;(dpnsService as any).reverseCache.clear()
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('pins the DPNS contract id at 32 base58 bytes (the 43-char gotcha class)', () => {
        expect(DPNS_CONTRACT_ID).toBe('GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec')
        expect(base58.decode(DPNS_CONTRACT_ID).length).toBe(32)
        expect(DPNS_DOCUMENT_TYPE).toBe('domain')
    })

    it('getAllUsernames goes PROXY-first and maps label.normalizedParentDomainName', async () => {
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
            okEnvelope([domainRow('caracal', 1700000000000), domainRow('evonextf39nov13identity', 1794534049708)]))

        const names = await dpnsService.getAllUsernames(ID_A)

        expect(names).toEqual(['caracal.dash', 'evonextf39nov13identity.dash'])
        const body = lastRequestBody()
        expect(body.method).toBe('get_documents')
        expect(body.network).toBe('testnet')
        expect(body.params.dataContractId).toBe(DPNS_CONTRACT_ID)
        expect(body.params.documentType).toBe('domain')
        expect(body.params.whereClause).toEqual([['records.identity', '==', ID_A]])
        expect(body.params.limit).toBe(20)
        expect(getWasmSdkMock).not.toHaveBeenCalled()
        expect(getDocumentsMock).not.toHaveBeenCalled()
    })

    it('an honest empty proxy answer still falls back to the wasm-native path (nameless parity)', async () => {
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([]))
        getWasmSdkMock.mockResolvedValue({ __mockSdk: true })
        getDpnsUsernamesMock.mockResolvedValue(['native.dash'])

        const names = await dpnsService.getAllUsernames(ID_B)

        expect(names).toEqual(['native.dash'])
        expect(getDpnsUsernamesMock).toHaveBeenCalledWith({ __mockSdk: true }, ID_B, 20)
    })

    it('a proxy failure falls back to the wasm-native sequence, then the wasm doc query', async () => {
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({ success: false, error: 'Upstream DAPI unavailable' }),
        } as unknown as Response)
        getWasmSdkMock.mockResolvedValue({ __mockSdk: true })
        getDpnsUsernamesMock.mockRejectedValue(new Error('native path down'))
        getDocumentsMock.mockResolvedValue([
            { ...domainRow('fallback', 1), records: { identity: ID_B } },
        ])

        const names = await dpnsService.getAllUsernames(ID_B)

        expect(names).toEqual(['fallback.dash'])
        /* The fallback doc query keeps the EXACT pre-ladder serialization. */
        expect(getDocumentsMock.mock.calls[0].slice(0, 8)).toEqual([
            { __mockSdk: true },
            DPNS_CONTRACT_ID,
            'domain',
            JSON.stringify([['records.identity', '==', ID_B]]),
            null,
            20,
            null,
            null,
        ])
    })

    it('getUsernameCreatedAt goes proxy-first and takes the EARLIEST $createdAt', async () => {
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okEnvelope([
            domainRow('one', 2000),
            domainRow('two', 1000),
            domainRow('zero', 0),
        ]))

        const createdAt = await dpnsService.getUsernameCreatedAt(ID_A)

        expect(createdAt).toBe(1000)
        expect(getWasmSdkMock).not.toHaveBeenCalled()
    })

    it('getUsernameCreatedAt falls back to the wasm doc query on a proxy failure', async () => {
        ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({ success: false, error: 'Upstream DAPI unavailable' }),
        } as unknown as Response)
        getWasmSdkMock.mockResolvedValue({ __mockSdk: true })
        getDocumentsMock.mockResolvedValue([{ ...domainRow('wasm', 5000) }])

        const createdAt = await dpnsService.getUsernameCreatedAt(ID_A)

        expect(createdAt).toBe(5000)
        expect(getDocumentsMock).toHaveBeenCalledTimes(1)
    })
})
