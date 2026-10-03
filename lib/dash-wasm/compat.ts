// lib/dash-wasm/compat.ts
//
// Compatibility layer for the @dashevo/wasm-sdk 4.1.1 API migration.
//
// The 4.1.1 WASM SDK replaced the old standalone snake_case functions
// (which took the SDK instance as their first argument) with camelCase
// methods on `WasmSdk` / statics on `WasmSdk`, changed several signatures
// (e.g. `getDocuments` now takes a query object and returns a Map of
// `Document` instances) and removed the hard-coded DAPI address list that
// shipped in older builds (the root cause of the login hang — see AGENTS.md).
//
// This module re-exports the full new API surface and adds thin wrappers
// that preserve the OLD call signatures and response shapes, so consumer
// code keeps its original logic unchanged.

/* Re-export the entire new API surface. */
export * from './wasm_sdk'

import {
    Document,
    IdentitySigner,
    PlatformVersion,
    WasmSdk,
} from './wasm_sdk'
import type {
    DocumentOrderByClause,
    DocumentWhereClause,
} from './wasm_sdk'

/* Parse a where/orderBy clause that may arrive as a JSON string (the old
 * API expected JSON strings) or as an already-built array of clauses. */
const parseClauses = (
    value: string | unknown[] | null | undefined
): unknown[] | undefined => {
    if (value === null || value === undefined) {
        return undefined
    }

    let clauses = value

    if (typeof value === 'string') {
        clauses = JSON.parse(value)
    }

    return Array.isArray(clauses) && clauses.length > 0
        ? (clauses as unknown[])
        : undefined
}

/* Convert a `Document` instance into the plain JSON shape the old API
 * returned ($id, $ownerId, data fields at the top level). */
const documentToJSON = (document: Document): any => {
    return document.toJSON(PlatformVersion.current())
}

/**
 * Query documents (old signature preserved).
 */
export async function get_documents(
    sdk: WasmSdk,
    data_contract_id: string,
    document_type: string,
    where_clause?: string | unknown[] | null,
    order_by?: string | unknown[] | null,
    limit?: number | null,
    start_after?: string | null,
    start_at?: string | null
): Promise<any> {
    const response = await sdk.getDocuments({
        dataContractId: data_contract_id,
        documentTypeName: document_type,
        where: parseClauses(where_clause) as DocumentWhereClause[] | undefined,
        orderBy: parseClauses(order_by) as DocumentOrderByClause[] | undefined,
        limit: limit ?? undefined,
        startAfter: start_after || undefined,
        startAt: start_at || undefined,
    })

    return Array.from(response.values())
        .filter((document): document is Document => document !== undefined)
        .map(documentToJSON)
}

/**
 * Get a single document by ID (old signature preserved).
 */
export async function get_document(
    sdk: WasmSdk,
    data_contract_id: string,
    document_type: string,
    document_id: string
): Promise<any> {
    const document = await sdk.getDocument(
        data_contract_id,
        document_type,
        document_id
    )

    return document ? documentToJSON(document) : undefined
}

/**
 * Old callers used the proof variant but consumed the document directly;
 * the plain fetch returns the same effective data.
 */
export async function get_document_with_proof_info(
    sdk: WasmSdk,
    data_contract_id: string,
    document_type: string,
    document_id: string
): Promise<any> {
    return get_document(sdk, data_contract_id, document_type, document_id)
}

/**
 * Fetch an identity (old signature preserved).
 */
export async function identity_fetch(
    sdk: WasmSdk,
    base58_id: string
): Promise<any> {
    return sdk.getIdentity(base58_id)
}

/**
 * Identity balance (old signature preserved).
 *
 * The new API returns the confirmed credits as a bigint; the old callers
 * expect the `{ confirmed, total }` object shape.
 */
export async function get_identity_balance(
    sdk: WasmSdk,
    id: string
): Promise<any> {
    const balance = await sdk.getIdentityBalance(id)

    if (balance === undefined || balance === null) {
        return undefined
    }

    const confirmed = Number(balance)

    return { confirmed, total: confirmed }
}

/**
 * Identity lookup by public key hash (old signatures preserved).
 */
export async function get_identity_by_public_key_hash(
    sdk: WasmSdk,
    public_key_hash: string
): Promise<any> {
    return sdk.getIdentityByPublicKeyHash(public_key_hash)
}

export async function get_identity_by_non_unique_public_key_hash(
    sdk: WasmSdk,
    public_key_hash: string,
    start_after?: string | null
): Promise<any> {
    return sdk.getIdentityByNonUniquePublicKeyHash(
        public_key_hash,
        start_after ?? undefined
    )
}

/**
 * DPNS helpers (old signatures preserved; now statics on WasmSdk).
 */
export function dpns_convert_to_homograph_safe(input: string): string {
    return WasmSdk.dpnsConvertToHomographSafe(input)
}

export function dpns_is_valid_username(label: string): boolean {
    return WasmSdk.dpnsIsValidUsername(label)
}

export function dpns_is_contested_username(label: string): boolean {
    return WasmSdk.dpnsIsContestedUsername(label)
}

/**
 * Register a DPNS username (old signature preserved).
 *
 * The new API requires the full `Identity` object, its public key and an
 * `IdentitySigner`; they are assembled here from the identity ID, key ID
 * and WIF the old callers provided.
 */
export async function dpns_register_name(
    sdk: WasmSdk,
    label: string,
    identity_id: string,
    public_key_id: number,
    private_key_wif: string,
    preorder_callback?: Function | null
): Promise<any> {
    const identity = await sdk.getIdentity(identity_id)

    if (!identity) {
        throw new Error(`Identity not found: ${identity_id}`)
    }

    const identityKey = identity.getPublicKeyById(public_key_id)

    if (!identityKey) {
        throw new Error(`Identity public key not found: ${public_key_id}`)
    }

    const signer = new IdentitySigner()
    signer.addKeyFromWif(private_key_wif)

    return sdk.dpnsRegisterName({
        label,
        identity,
        identityKey,
        signer,
        ...(preorder_callback
            ? {
                  preorderCallback: preorder_callback as (
                      preorderDocument: Document
                  ) => void,
              }
            : {}),
    })
}

/**
 * List the DPNS usernames owned by an identity (old signature preserved).
 */
export async function get_dpns_usernames(
    sdk: WasmSdk,
    identity_id: string,
    limit?: number | null
): Promise<any> {
    return sdk.getDpnsUsernames({
        identityId: identity_id,
        limit: limit ?? undefined,
    } as any)
}

/**
 * Check if a DPNS name is available for registration (old signature preserved).
 */
export async function dpns_is_name_available(
    sdk: WasmSdk,
    name: string
): Promise<any> {
    return sdk.dpnsIsNameAvailable(name)
}

/**
 * Validate a BIP39 mnemonic (old signature preserved).
 */
export function validate_mnemonic(
    mnemonic: string,
    language_code?: string | null
): boolean {
    return WasmSdk.validateMnemonic(mnemonic, language_code ?? undefined)
}

/**
 * Resolve a DPNS name to an identity ID (old signature preserved).
 */
export async function dpns_resolve_name(
    sdk: WasmSdk,
    name: string
): Promise<any> {
    return sdk.dpnsResolveName(name)
}

/**
 * Key derivation from a seed phrase (old signature preserved).
 */
export function derive_key_from_seed_with_path(
    mnemonic: string,
    passphrase: string | null | undefined,
    path: string,
    network: string
): any {
    return WasmSdk.deriveKeyFromSeedWithPath({
        mnemonic,
        passphrase: passphrase ?? undefined,
        path,
        network,
    })
}

/**
 * Token balances (old signature preserved).
 *
 * The new API returns the balances as a Map inside the proof response; the
 * old callers expect `response.data` to be an array of
 * `{ identityId, balance }` entries.
 */
export async function get_identities_token_balances_with_proof_info(
    sdk: WasmSdk,
    identity_ids: string[],
    token_id: string
): Promise<any> {
    const response = await sdk.getIdentitiesTokenBalancesWithProofInfo(
        identity_ids,
        token_id
    )

    if (response && response.data instanceof Map) {
        return {
            ...response,
            data: Array.from(response.data.entries()).map(
                ([identityId, balance]) => ({ identityId, balance })
            ),
        }
    }

    return response
}

/**
 * Wait for a state transition result (old signature preserved).
 */
export async function wait_for_state_transition_result(
    sdk: WasmSdk,
    state_transition_hash: string
): Promise<any> {
    return sdk.waitForStateTransitionResult(state_transition_hash)
}
