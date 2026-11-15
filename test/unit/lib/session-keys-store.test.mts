/* test/unit/lib/session-keys-store.test.mts
 * F57b — the multi-key session store (the Settings → Keys manager):
 * the material match at ADD, the honest refusals, the legacy `pk_` merge +
 * removal semantics, and the purpose-targeted WIF resolution
 * (TRANSFER for sends, AUTH CRITICAL|HIGH for documents). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* The REAL wasm glue (PrivateKeyWASM's derivation needs it). */
vi.mock('@/lib/dash-wasm/wasm_sdk.js', async (importOriginal) => {
    const actual = await importOriginal<any>()
    actual.initSync({ module: readFileSync(join(process.cwd(), 'lib/dash-wasm/wasm_sdk_bg.wasm')) })
    return actual
})

/* The service: skip the initialize (the store checks isReady/initializedNetwork). */
vi.mock('@/lib/services/wasm-sdk-service', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        getWasmSdk: async () => fakeSdk,
        wasmSdkService: Object.assign(actual.wasmSdkService ?? {}, {
            isReady: () => true,
            initializedNetwork: () => 'testnet',
            initialize: vi.fn(async () => { }),
        }),
    }
})

/* The identity fixture: the REAL derived key hashes (computed below). */
const fakeSdk = {
    getIdentity: vi.fn(async () => ({ publicKeys: registeredFixture() })),
}

/* secure-storage: an in-memory backend with the store's used surface
 * (set/get/delete). The legacy pk_ slot lives here too. */
const memory = new Map<string, string>()
vi.mock('@/lib/secure-storage', async (importOriginal) => {
    const actual = await importOriginal<any>()
    const backend = {
        set: (k: string, v: any) => { memory.set(k, String(v)) },
        get: (k: string) => memory.get(k) ?? null,
        delete: (k: string) => { memory.delete(k); return true },
    }
    return {
        ...actual,
        default: backend,
        secureStorage: backend,
        getPrivateKey: (identityId: string) => memory.get(`pk_${identityId}`) ?? null,
        getMnemonic: () => null,
    }
})

import * as wasm from '../../../lib/dash-wasm/wasm_sdk.js'
import { derive_key_from_seed_with_path } from '../../../lib/dash-wasm/compat.js'
import {
    addSessionKey,
    removeSessionKey,
    listSessionKeys,
    getSessionTransferWif,
    getSessionAuthWif,
} from '../../../lib/session-keys-store'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const ID = 'AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm'
const NETWORK = 'testnet' as const

const deriveAt = (path: string) =>
    derive_key_from_seed_with_path(MNEMONIC, undefined, path, NETWORK)

/* The real derived keys + their registered-shape fixture (hex hash160). */
const master = deriveAt("m/9'/1'/5'/0'/0'/0'/0'")
const authCritical = deriveAt("m/9'/1'/5'/0'/0'/0'/1'")
const transfer = deriveAt("m/9'/1'/5'/0'/0'/0'/3'")
const foreign = deriveAt("m/9'/1'/5'/0'/0'/1'/3'") // identityIdx 1 — NOT registered on this identity

const hashOf = (pub: string) => {
    const { sha256 } = require('@noble/hashes/sha2.js')
    const { ripemd160 } = require('@noble/hashes/legacy.js')
    const { hexToBytes } = require('@noble/hashes/utils.js')
    return Buffer.from(ripemd160(sha256(hexToBytes(pub)))).toString('hex')
}

function registeredFixture() {
    return [
        { id: 0, purpose: 0, securityLevel: 0, data: hashOf(master.public_key) },
        { id: 1, purpose: 0, securityLevel: 1, data: hashOf(authCritical.public_key) },
        { id: 3, purpose: 3, securityLevel: 1, data: hashOf(transfer.public_key) },
    ]
}

beforeEach(() => {
    memory.clear()
    vi.clearAllMocks()
    fakeSdk.getIdentity.mockImplementation(async () => ({ publicKeys: registeredFixture() }))
})

describe('session-keys-store (F57b Key Manager)', () => {
    it('add: a registered WIF is stored under its key id and listed as loaded', async () => {
        const entry = await addSessionKey(NETWORK, ID, transfer.private_key_wif)
        expect(entry.keyId).toBe(3)
        expect(entry.source).toBe('keystore')
        const { registered, loaded } = await listSessionKeys(NETWORK, ID)
        expect(registered.length).toBe(3)
        expect(loaded.get(3)?.source).toBe('keystore')
        expect(loaded.get(3)?.fingerprint).toHaveLength(16)
    })

    it('add: an UNREGISTERED WIF is refused honestly', async () => {
        await expect(addSessionKey(NETWORK, ID, foreign.private_key_wif))
            .rejects.toThrow(/NOT registered/)
    })

    it('add: an invalid WIF is refused honestly', async () => {
        await expect(addSessionKey(NETWORK, ID, 'not-a-wif'))
            .rejects.toThrow(/not a valid private key/)
    })

    it('the legacy pk_ slot material-matches into the list (source legacy)', async () => {
        memory.set(`pk_${ID}`, authCritical.private_key_wif)
        const { loaded } = await listSessionKeys(NETWORK, ID)
        expect(loaded.get(1)?.source).toBe('legacy')
    })

    it('remove: drops the store entry AND clears a same-material legacy slot', async () => {
        await addSessionKey(NETWORK, ID, transfer.private_key_wif)
        memory.set(`pk_${ID}`, transfer.private_key_wif)
        await removeSessionKey(NETWORK, ID, 3)
        const { loaded } = await listSessionKeys(NETWORK, ID)
        expect(loaded.has(3)).toBe(false)
        expect(memory.get(`pk_${ID}`)).toBeUndefined()
    })

    it('remove: a DIFFERENT legacy key survives', async () => {
        await addSessionKey(NETWORK, ID, transfer.private_key_wif)
        memory.set(`pk_${ID}`, authCritical.private_key_wif)
        await removeSessionKey(NETWORK, ID, 3)
        expect(memory.get(`pk_${ID}`)).toBe(authCritical.private_key_wif)
    })

    it('the TRANSFER resolution: the store entry wins; an auth-only store yields null', async () => {
        expect(await getSessionTransferWif(NETWORK, ID)).toBeNull()
        await addSessionKey(NETWORK, ID, transfer.private_key_wif)
        expect(await getSessionTransferWif(NETWORK, ID)).toBe(transfer.private_key_wif)

        memory.clear()
        await addSessionKey(NETWORK, ID, authCritical.private_key_wif)
        expect(await getSessionTransferWif(NETWORK, ID)).toBeNull()
    })

    it('the AUTH resolution requires CRITICAL|HIGH — a MASTER key is not a document key', async () => {
        await addSessionKey(NETWORK, ID, master.private_key_wif)
        expect(await getSessionAuthWif(NETWORK, ID)).toBeNull()
        await addSessionKey(NETWORK, ID, authCritical.private_key_wif)
        expect(await getSessionAuthWif(NETWORK, ID)).toBe(authCritical.private_key_wif)
    })

    it('the legacy fallback: no store entry, but a matching legacy WIF resolves', async () => {
        memory.set(`pk_${ID}`, transfer.private_key_wif)
        expect(await getSessionTransferWif(NETWORK, ID)).toBe(transfer.private_key_wif)
        /* A legacy AUTH key does NOT satisfy the TRANSFER resolution. */
        memory.set(`pk_${ID}`, authCritical.private_key_wif)
        expect(await getSessionTransferWif(NETWORK, ID)).toBeNull()
    })
})
