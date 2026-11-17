/**
 * test/unit/lib/wallet-history.test.ts — F59: the History tab's data-layer
 * contract. Pure transforms (no wasm, no network): the withdrawal-doc
 * mapping (the F48 flat shape), the swap-record mapping, the merge sort,
 * and the status vocabulary. Pinning these prevents the old dead-scaffold
 * History tab from ever regressing (hardcoded DEFAULT_TX, empty-string
 * renderers, the bogus explorer.dash.org/tx/ link with an empty txid).
 */
import { describe, it, expect, vi } from 'vitest'
import { base58 } from '@scure/base'
import {
    SYSTEM_WITHDRAWAL_CONTRACT_ID, CREDITS_PER_DASH, DUFFS_PER_DASH,
    WITHDRAWAL_QUERY_DEADLINE_MS, PLATFORM_ACTIVITY_TYPES,
    dashOfMax, withdrawalToRow, swapToRow, mergeActivity, queryWithdrawalRows,
    queryActivityRows, activityToRow, PlatformActivityRow,
    queryTokenRows, tokenToRow, TOKEN_HISTORY_CONTRACT_ID,
    swapStatusLabel, swapStatusFailed, swapIsSettled, readSwapHistory,
    ActivityRow, SwapRecord,
} from '@/lib/wallet-history'

const T100M_WITHDRAWAL_DOC = {
    $id: 'DRUb1QjP9HY2G9Kz84ahZdZpTT76HuifB44BJJKmMamJ',
    amount: 100000000,
    status: 3,
    transactionIndex: 4332,
    transactionSignHeight: 1591102,
    $createdAt: 1700000000000,
    $updatedAt: 1700000300000,
}

describe('wallet-history: the F48 contract', () => {
    it('carries the verified system withdrawal contract id', () => {
        /* The 44-char 32-byte form — a 43-char (31-byte) transcription of
         * this id circulated in session notes and rc.8's query deserializer
         * rejects any identifier not decoding to exactly 32 bytes. */
        expect(SYSTEM_WITHDRAWAL_CONTRACT_ID).toBe('4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6')
        expect(base58.decode(SYSTEM_WITHDRAWAL_CONTRACT_ID).length).toBe(32)
    })

    it('uses the verified unit ratios (credits 1e11, duffs 1e8)', () => {
        expect(CREDITS_PER_DASH).toBe(1e11)
        expect(DUFFS_PER_DASH).toBe(1e8)
    })

    it('maps a complete (status 3) withdrawal to a paid row with the explorer doc link', () => {
        const row = withdrawalToRow(T100M_WITHDRAWAL_DOC, 'testnet')
        expect(row).not.toBeNull()
        expect(row!.kind).toBe('withdrawal')
        expect(row!.amountLabel).toBe('0.001')
        expect(row!.assetLabel).toBe('DASH')
        expect(row!.statusLabel).toBe('Paid')
        expect(row!.tone).toBe('ok')
        expect(row!.href).toBe('https://testnet.platform-explorer.com/document/DRUb1QjP9HY2G9Kz84ahZdZpTT76HuifB44BJJKmMamJ')
        expect(row!.when).toBe(1700000300000)
        expect(row!.key).toBe('withdrawal-DRUb1QjP9HY2G9Kz84ahZdZpTT76HuifB44BJJKmMamJ')
    })

    it('maps a signed (status 2) withdrawal to the awaiting-payout pending row', () => {
        const row = withdrawalToRow({ ...T100M_WITHDRAWAL_DOC, status: 2 }, 'testnet')
        expect(row!.statusLabel).toBe('Awaiting payout')
        expect(row!.tone).toBe('pending')
    })

    it('mainnet withdrawal rows link to the www explorer host', () => {
        const row = withdrawalToRow(T100M_WITHDRAWAL_DOC, 'mainnet')
        expect(row!.href).toContain('https://www.platform-explorer.com/document/')
    })

    it('accepts string amounts (the JSON contract may deliver u64 as a string)', () => {
        const row = withdrawalToRow({ ...T100M_WITHDRAWAL_DOC, amount: '200000000' }, 'testnet')
        expect(row!.amountLabel).toBe('0.002')
    })

    it('returns null for a malformed doc instead of fabricating a row', () => {
        expect(withdrawalToRow(null as unknown as Record<string, unknown>, 'testnet')).toBeNull()
        expect(withdrawalToRow({}, 'testnet')).toBeNull()
        expect(withdrawalToRow({ amount: 5 }, 'testnet')).toBeNull()
    })
})

describe('wallet-history: the swap rows', () => {
    const BASE = {
        swapid: '70cb1414-d2ed-4ec3-9bf4-d6c94666cbd8',
        direction: 'DASH->SANS',
        amount_in: 59820000,
        amount_out: 37387500000,
        dest_txid: 'f0a0a74fb91084f630f931956dca427376cf74df',
        status: 'settled',
        created_at: 1700000000000,
        updated_at: 1700001200000,
    }

    it('maps the settled F58 round-trip swap exactly (duffs in, SANS base out)', () => {
        const row = swapToRow(BASE as any, 8, 'SANS')
        expect(row!.kind).toBe('swap')
        expect(row!.amountLabel).toBe('0.5982')
        expect(row!.directionLabel).toBe('swapped to SANS')
        expect(row!.outLabel).toBe('373.875 SANS')
        expect(row!.statusLabel).toBe('Settled')
        expect(row!.tone).toBe('ok')
        expect(row!.when).toBe(1700001200000)
    })

    it('applies per-token out decimals (DUSD 6)', () => {
        const row = swapToRow({ ...BASE, direction: 'DASH->DUSD', amount_out: 123456789 } as any, 6, 'DUSD')
        expect(row!.directionLabel).toBe('swapped to DUSD')
        expect(row!.outLabel).toBe('123.456789 DUSD')
    })

    it('pending statuses map to the pending tone with the engine labels', () => {
        for (const status of ['pending', 'detected', 'confirmed', 'settling']) {
            const row = swapToRow({ ...BASE, status } as any, 8, 'SANS')
            expect(row!.tone).toBe('pending')
            expect(row!.statusLabel).toBe(swapStatusLabel(status))
        }
    })

    it('unrecognized engine statuses are neutral-with-label, never a fake failure', () => {
        expect(swapStatusFailed('someNewState')).toBe(false)
        expect(swapStatusFailed('settled')).toBe(false)
        const row = swapToRow({ ...BASE, status: 'someNewState' } as any, 8, 'SANS')
        expect(row!.tone).toBe('pending')
        expect(row!.statusLabel).toBe('Status: someNewState')
    })

    it('the pinned vocabulary is complete and settles only on settled', () => {
        expect(swapIsSettled('settled')).toBe(true)
        expect(swapIsSettled('settling')).toBe(false)
        expect(swapStatusLabel('settled')).toBe('Settled')
    })

    it('returns null for malformed records (missing swapid OR missing direction)', () => {
        expect(swapToRow(null as unknown as SwapRecord, 8, 'SANS')).toBeNull()
        expect(swapToRow({ swapid: 'x' } as any, 8, 'SANS')).toBeNull()
        expect(swapToRow({ swapid: 'x', direction: 42 } as unknown as SwapRecord, 8, 'SANS')).toBeNull()
    })
})

describe('wallet-history: the merge', () => {
    it('sorts newest first and prefers withdrawals on timestamp ties', () => {
        const w = { key: 'w1', kind: 'withdrawal', when: 1000, amountLabel: '1', assetLabel: 'DASH', directionLabel: '', statusLabel: '', tone: 'ok' } as ActivityRow
        const s = { key: 's1', kind: 'swap', when: 2000, amountLabel: '2', assetLabel: 'DASH', directionLabel: '', statusLabel: '', tone: 'ok' } as ActivityRow
        const w2 = { key: 'w2', kind: 'withdrawal', when: 1000, amountLabel: '1', assetLabel: 'DASH', directionLabel: '', statusLabel: '', tone: 'ok' } as ActivityRow
        const merged = mergeActivity([w, w2], [s])
        expect(merged.map((r) => r.key)).toEqual(['s1', 'w1', 'w2'])
    })
})

describe('wallet-history: the local swap cache read', () => {
    it('returns an empty list when nothing is cached (no crash, no fake rows)', () => {
        expect(readSwapHistory('testnet')).toEqual([])
        expect(readSwapHistory('mainnet')).toEqual([])
    })
})

describe('wallet-history: the dash truncation', () => {
    it('truncates instead of rounding (the F37b pattern — toFixed would round)', () => {
        expect(dashOfMax(855.98797113858)).toBe('855.9879')
        expect(dashOfMax(812)).toBe('812')
        expect(dashOfMax(0.5982)).toBe('0.5982')
        expect(dashOfMax(0.001)).toBe('0.001')
        expect(dashOfMax(855.98797, 4)).toBe('855.9879')
        expect(dashOfMax(856.84632481858, 4)).toBe('856.8463')
        expect(dashOfMax(NaN)).toBe('0')
    })
    it('supports the 8-decimal mode for the swap in/out legs', () => {
        expect(dashOfMax(0.5982, 8)).toBe('0.5982')
        expect(dashOfMax(0.001234567, 8)).toBe('0.00123456')
    })
})

describe('wallet-history: the F59 withdrawal query race (queryWithdrawalRows)', () => {
    it('carries the 30s deadline constant (the F30 pending-forever guard)', () => {
        expect(WITHDRAWAL_QUERY_DEADLINE_MS).toBe(30_000)
    })

    it('maps the live F46 docs to rows and reports no error', async () => {
        const port = {
            getDocuments: vi.fn().mockResolvedValue([T100M_WITHDRAWAL_DOC, { ...T100M_WITHDRAWAL_DOC, $id: 'HkJHnjwphTtd' }]),
        }
        const { rows, error } = await queryWithdrawalRows(port, 'EcbX', 'testnet')

        expect(port.getDocuments).toHaveBeenCalledWith(
            SYSTEM_WITHDRAWAL_CONTRACT_ID, 'withdrawal',
            [['$ownerId', '==', 'EcbX']],
            [['$ownerId', 'asc'], ['$updatedAt', 'desc']],
            25,
        )
        expect(error).toBeNull()
        expect(rows).toHaveLength(2)
        expect(rows[0].kind).toBe('withdrawal')
        expect(rows[0].directionLabel).toBe('withdrawn to Core')
    })

    it('degrades a HANGING query (the F30 wasm future) to the deadline error — never a fake empty', async () => {
        const port = { getDocuments: vi.fn().mockReturnValue(new Promise(() => {})) }
        const { rows, error } = await queryWithdrawalRows(port, 'EcbX', 'testnet', 25)

        expect(rows).toEqual([])
        expect(error).toBe('query timed out')
    })

    it('propagates the real error message (the honest error line)', async () => {
        const port = {
            getDocuments: vi.fn().mockRejectedValue(
                new Error('Invalid documents query: fromObject: serde deserialization error')),
        }
        const { rows, error } = await queryWithdrawalRows(port, 'EcbX', 'testnet')

        expect(rows).toEqual([])
        expect(error).toBe('Invalid documents query: fromObject: serde deserialization error')
    })

    it('falls back to the honest generic when the failure carries no message', async () => {
        const port = { getDocuments: vi.fn().mockRejectedValue('nope') }
        const { error } = await queryWithdrawalRows(port, 'EcbX', 'testnet', 25)

        expect(error).toBe('withdrawal history unavailable')
    })

    it('treats a non-array answer as an empty set with no error', async () => {
        const port = { getDocuments: vi.fn().mockResolvedValue({ weird: true }) }
        const { rows, error } = await queryWithdrawalRows(port, 'EcbX', 'testnet', 25)

        expect(rows).toEqual([])
        expect(error).toBeNull()
    })
})

describe('wallet-history: the indexer-backed identity activity (F57c, mobile-parity mapping)', () => {
    it('pins the indexer query to the mobile-parity value-mover types', () => {
        expect(PLATFORM_ACTIVITY_TYPES).toEqual(['creditTransfer', 'identityTopUp', 'identityCreditWithdrawal'])
    })

    const baseRow = {
        id: 166261885,
        txid: '16508EB5F697F8EC',
        transitionId: '16508eb5f697f8ec',
        identityId: 'EcbX',
        height: 687089,
        blocktime: 1794779969,
        type: 'creditTransfer',
        contractId: null,
        documentType: null,
        documentId: null,
        amount: 1000000,
        role: 'sender',
        network: 'testnet',
    }
    const fullTxid = 'a'.repeat(64)

    it('creditTransfer sender -> sent credits (out) with the /transaction/ deep-link', () => {
        const row = activityToRow({ ...baseRow, txid: fullTxid }, 'testnet')
        expect(row).not.toBeNull()
        expect(row!.kind).toBe('transfer')
        expect(row!.direction).toBe('out')
        expect(row!.directionLabel).toBe('sent credits')
        expect(row!.amountLabel).toBe('0.00001')
        expect(row!.when).toBe(1794779969 * 1000)
        expect(row!.href).toBe(`https://testnet.platform-explorer.com/transaction/${fullTxid}`)
    })

    it('creditTransfer receiver -> received credits (in); identityTopUp -> topped up from Core', () => {
        const recv = activityToRow({ ...baseRow, role: 'receiver', txid: fullTxid }, 'testnet')
        expect(recv!.direction).toBe('in')
        expect(recv!.directionLabel).toBe('received credits')
        const topUp = activityToRow({ ...baseRow, type: 'identityTopUp', role: null, txid: fullTxid }, 'mainnet')
        expect(topUp!.directionLabel).toBe('topped up from Core')
        expect(topUp!.direction).toBe('in')
        expect(topUp!.href).toContain('https://www.platform-explorer.com/transaction/')
    })

    it('identityCreditWithdrawal rows are DROPPED (the F48 doc source is authoritative — no duplicates)', () => {
        expect(activityToRow({ ...baseRow, type: 'identityCreditWithdrawal', role: 'owner', txid: fullTxid }, 'testnet')).toBeNull()
    })

    it('non-wallet activity is dropped: batch, unknown types, bad txid, no amount, unknown role', () => {
        expect(activityToRow({ ...baseRow, type: 'batch', amount: null, txid: fullTxid }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, type: 'identityUpdate', amount: 5, txid: fullTxid }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, txid: null }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, txid: 'short' }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, amount: null }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, amount: 0 }, 'testnet')).toBeNull()
        expect(activityToRow({ ...baseRow, role: 'observer', txid: fullTxid }, 'testnet')).toBeNull()
        expect(activityToRow(null as unknown as PlatformActivityRow, 'testnet')).toBeNull()
    })

    it('queryActivityRows maps rows and degrades a hung fetch to the deadline error', async () => {
        const ok = await queryActivityRows(
            { fetchActivities: async () => [{ ...baseRow, txid: fullTxid }] }, 'testnet', 25)
        expect(ok.rows).toHaveLength(1)
        expect(ok.error).toBeNull()

        const hung = await queryActivityRows(
            { fetchActivities: () => new Promise(() => {}) }, 'testnet', 25)
        expect(hung.rows).toEqual([])
        expect(hung.error).toBe('query timed out')

        const failed = await queryActivityRows(
            { fetchActivities: async () => { throw new Error('proxy HTTP 503') } }, 'testnet', 25)
        expect(failed.rows).toEqual([])
        expect(failed.error).toBe('proxy HTTP 503')
    })
})

describe('wallet-history: token transfers via the token-history system contract (F57c.1, DAPI Phase A)', () => {
    const EC = 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa'
    const DP = 'DpLt5xyRoACYkXjbVa95nzzG7ZtpiEcTGWR5W6es4xmh'
    const SANS = 'A36eJF2kyYXwxCtJGsgbR3CTAscUFaNxZN19UqUfM1kw'
    const doc = {
        $id: '7KhAtu7bJSMWM6qNAYJb5Gn7yGFcUcbUEKGhCBjNX4P',
        $ownerId: DP,
        toIdentityId: EC,
        tokenId: SANS,
        amount: 37387500000,
        $createdAt: 1794795838803,
    }

    it('pins the token-history contract id to 32 bytes', async () => {
        const { base58 } = await import('@scure/base')
        expect(base58.decode(TOKEN_HISTORY_CONTRACT_ID)).toHaveLength(32)
    })

    it('maps an incoming settlement: received SANS, 8 decimals, ms epoch, document link', () => {
        const row = tokenToRow(doc, EC, 'testnet')
        expect(row).not.toBeNull()
        expect(row!.kind).toBe('transfer')
        expect(row!.direction).toBe('in')
        expect(row!.directionLabel).toBe('received SANS')
        expect(row!.amountLabel).toBe('373.875')
        expect(row!.assetLabel).toBe('SANS')
        expect(row!.when).toBe(1794795838803) // MILLISECONDS, used directly
        expect(row!.href).toBe(`https://testnet.platform-explorer.com/document/${doc.$id}`)
    })

    it('maps an outgoing send; rejects unknown tokens, bad amounts, self-transfers', () => {
        const out = tokenToRow({ ...doc, $ownerId: EC, toIdentityId: DP }, EC, 'testnet')
        expect(out!.direction).toBe('out')
        expect(out!.directionLabel).toBe('sent SANS')
        // DUSD 6 decimals via the OTHER known token
        const dusd = tokenToRow({ ...doc, tokenId: '3oTHkj8nqn82QkZRHkmUmNBX696nzE1rg1fwPRpemEdz', amount: 45000000 }, EC, 'testnet')
        expect(dusd!.amountLabel).toBe('45')
        expect(dusd!.assetLabel).toBe('DUSD')
        expect(tokenToRow({ ...doc, tokenId: 'ZZZ' }, EC, 'testnet')).toBeNull()
        expect(tokenToRow({ ...doc, amount: 0 }, EC, 'testnet')).toBeNull()
        expect(tokenToRow({ ...doc, amount: 'nan' }, EC, 'testnet')).toBeNull()
        expect(tokenToRow({ ...doc, $ownerId: EC, toIdentityId: EC }, EC, 'testnet')).toBeNull()
        expect(tokenToRow(null as unknown as typeof doc, EC, 'testnet')).toBeNull()
    })

    it('queryTokenRows: allSettled keeps good legs with a partial-failure error; deadline race', async () => {
        const partial = await queryTokenRows({
            fetchTokenDocs: async (tokenId, field) => {
                if (field === '$ownerId') throw new Error('proxy HTTP 503')
                return tokenId === SANS ? [doc] : [] // the incoming leg, SANS only
            },
        }, EC, 'testnet', 25)
        expect(partial.rows).toHaveLength(1)
        expect(partial.error).toBe('token history partially unavailable')

        const hung = await queryTokenRows(
            { fetchTokenDocs: () => new Promise(() => {}) }, EC, 'testnet', 25)
        expect(hung.rows).toEqual([])
        expect(hung.error).toBe('query timed out')
    })
})
