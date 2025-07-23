/* tslint:disable */
/* eslint-disable */
/**
 * Convert a string to homograph-safe characters
 */
export function dpns_convert_to_homograph_safe(input: string): string;
/**
 * Check if a username is valid according to DPNS rules
 */
export function dpns_is_valid_username(label: string): boolean;
/**
 * Check if a username is contested (requires masternode voting)
 */
export function dpns_is_contested_username(label: string): boolean;
/**
 * Register a DPNS username
 */
export function dpns_register_name(sdk: WasmSdk, label: string, identity_id: string, public_key_id: number, private_key_wif: string, preorder_callback?: Function | null): Promise<any>;
/**
 * Check if a DPNS name is available
 */
export function dpns_is_name_available(sdk: WasmSdk, label: string): Promise<boolean>;
/**
 * Resolve a DPNS name to an identity ID
 */
export function dpns_resolve_name(sdk: WasmSdk, name: string): Promise<any>;
export function prefetch_trusted_quorums_mainnet(): Promise<void>;
export function prefetch_trusted_quorums_testnet(): Promise<void>;
export function identity_put(sdk: WasmSdk): Promise<void>;
export function epoch_testing(): Promise<void>;
export function docs_testing(sdk: WasmSdk): Promise<void>;
export function get_identities_token_balances(sdk: WasmSdk, identity_ids: string[], token_id: string): Promise<any>;
export function get_identity_token_infos(sdk: WasmSdk, identity_id: string, token_ids?: string[] | null, _limit?: number | null, _offset?: number | null): Promise<any>;
export function get_identities_token_infos(sdk: WasmSdk, identity_ids: string[], token_id: string): Promise<any>;
export function get_token_statuses(sdk: WasmSdk, token_ids: string[]): Promise<any>;
export function get_token_direct_purchase_prices(sdk: WasmSdk, token_ids: string[]): Promise<any>;
export function get_token_contract_info(sdk: WasmSdk, data_contract_id: string): Promise<any>;
export function get_token_perpetual_distribution_last_claim(sdk: WasmSdk, identity_id: string, token_id: string): Promise<any>;
export function get_token_total_supply(sdk: WasmSdk, token_id: string): Promise<any>;
export function get_identities_token_balances_with_proof_info(sdk: WasmSdk, identity_ids: string[], token_id: string): Promise<any>;
export function get_token_statuses_with_proof_info(sdk: WasmSdk, token_ids: string[]): Promise<any>;
export function get_token_total_supply_with_proof_info(sdk: WasmSdk, token_id: string): Promise<any>;
export function get_identity_token_infos_with_proof_info(sdk: WasmSdk, identity_id: string, token_ids?: string[] | null, _limit?: number | null, _offset?: number | null): Promise<any>;
export function get_identities_token_infos_with_proof_info(sdk: WasmSdk, identity_ids: string[], token_id: string): Promise<any>;
export function get_token_direct_purchase_prices_with_proof_info(sdk: WasmSdk, token_ids: string[]): Promise<any>;
export function get_token_contract_info_with_proof_info(sdk: WasmSdk, data_contract_id: string): Promise<any>;
export function get_token_perpetual_distribution_last_claim_with_proof_info(sdk: WasmSdk, identity_id: string, token_id: string): Promise<any>;
export function start(): Promise<void>;
export function verify_identity_response(): Promise<IdentityWasm | undefined>;
export function verify_data_contract(): Promise<DataContractWasm | undefined>;
export function verify_documents(): Promise<DocumentWasm[]>;
export function get_documents(sdk: WasmSdk, data_contract_id: string, document_type: string, where_clause?: string | null, order_by?: string | null, limit?: number | null, start_after?: string | null, start_at?: string | null): Promise<any>;
export function get_documents_with_proof_info(sdk: WasmSdk, data_contract_id: string, document_type: string, where_clause?: string | null, order_by?: string | null, limit?: number | null, start_after?: string | null, start_at?: string | null): Promise<any>;
export function get_document(sdk: WasmSdk, data_contract_id: string, document_type: string, document_id: string): Promise<any>;
export function get_document_with_proof_info(sdk: WasmSdk, data_contract_id: string, document_type: string, document_id: string): Promise<any>;
export function get_dpns_usernames(sdk: WasmSdk, identity_id: string, limit?: number | null): Promise<any>;
export function get_dpns_username(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_dpns_usernames_with_proof_info(sdk: WasmSdk, identity_id: string, limit?: number | null): Promise<any>;
export function get_dpns_username_with_proof_info(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_dpns_username_by_name(sdk: WasmSdk, username: string): Promise<any>;
export function get_dpns_username_by_name_with_proof_info(sdk: WasmSdk, username: string): Promise<any>;
export function get_status(sdk: WasmSdk): Promise<any>;
export function get_current_quorums_info(sdk: WasmSdk): Promise<any>;
export function get_total_credits_in_platform(sdk: WasmSdk): Promise<any>;
export function get_prefunded_specialized_balance(sdk: WasmSdk, identity_id: string): Promise<any>;
export function wait_for_state_transition_result(sdk: WasmSdk, state_transition_hash: string): Promise<any>;
export function get_path_elements(sdk: WasmSdk, path: string[], keys: string[]): Promise<any>;
export function get_total_credits_in_platform_with_proof_info(sdk: WasmSdk): Promise<any>;
export function get_prefunded_specialized_balance_with_proof_info(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_path_elements_with_proof_info(sdk: WasmSdk, path: string[], keys: string[]): Promise<any>;
export function identity_fetch(sdk: WasmSdk, base58_id: string): Promise<IdentityWasm>;
export function identity_fetch_with_proof_info(sdk: WasmSdk, base58_id: string): Promise<any>;
export function identity_fetch_unproved(sdk: WasmSdk, base58_id: string): Promise<IdentityWasm>;
export function get_identity_keys(sdk: WasmSdk, identity_id: string, key_request_type: string, specific_key_ids?: Uint32Array | null, search_purpose_map?: string | null, limit?: number | null, offset?: number | null): Promise<any>;
export function get_identity_nonce(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_identity_nonce_with_proof_info(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_identity_contract_nonce(sdk: WasmSdk, identity_id: string, contract_id: string): Promise<any>;
export function get_identity_contract_nonce_with_proof_info(sdk: WasmSdk, identity_id: string, contract_id: string): Promise<any>;
export function get_identity_balance(sdk: WasmSdk, id: string): Promise<any>;
export function get_identities_balances(sdk: WasmSdk, identity_ids: string[]): Promise<any>;
export function get_identity_balance_and_revision(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_identity_by_public_key_hash(sdk: WasmSdk, public_key_hash: string): Promise<IdentityWasm>;
export function get_identities_contract_keys(sdk: WasmSdk, identities_ids: string[], contract_id: string, document_type_name?: string | null, purposes?: Uint32Array | null): Promise<any>;
export function get_identity_by_non_unique_public_key_hash(sdk: WasmSdk, public_key_hash: string, start_after?: string | null): Promise<any>;
export function get_identity_token_balances(sdk: WasmSdk, identity_id: string, token_ids: string[]): Promise<any>;
export function get_identity_keys_with_proof_info(sdk: WasmSdk, identity_id: string, key_request_type: string, specific_key_ids?: Uint32Array | null, limit?: number | null, offset?: number | null): Promise<any>;
export function get_identity_balance_with_proof_info(sdk: WasmSdk, id: string): Promise<any>;
export function get_identities_balances_with_proof_info(sdk: WasmSdk, identity_ids: string[]): Promise<any>;
export function get_identity_balance_and_revision_with_proof_info(sdk: WasmSdk, identity_id: string): Promise<any>;
export function get_identity_by_public_key_hash_with_proof_info(sdk: WasmSdk, public_key_hash: string): Promise<any>;
export function get_identity_by_non_unique_public_key_hash_with_proof_info(sdk: WasmSdk, public_key_hash: string, start_after?: string | null): Promise<any>;
export function get_identities_contract_keys_with_proof_info(sdk: WasmSdk, identities_ids: string[], contract_id: string, _document_type_name?: string | null, purposes?: Uint32Array | null): Promise<any>;
export function get_identity_token_balances_with_proof_info(sdk: WasmSdk, identity_id: string, token_ids: string[]): Promise<any>;
export function data_contract_fetch(sdk: WasmSdk, base58_id: string): Promise<DataContractWasm>;
export function data_contract_fetch_with_proof_info(sdk: WasmSdk, base58_id: string): Promise<any>;
export function get_data_contract_history(sdk: WasmSdk, id: string, limit?: number | null, _offset?: number | null, start_at_ms?: bigint | null): Promise<any>;
export function get_data_contracts(sdk: WasmSdk, ids: string[]): Promise<any>;
export function get_data_contract_history_with_proof_info(sdk: WasmSdk, id: string, limit?: number | null, _offset?: number | null, start_at_ms?: bigint | null): Promise<any>;
export function get_data_contracts_with_proof_info(sdk: WasmSdk, ids: string[]): Promise<any>;
export function get_protocol_version_upgrade_state(sdk: WasmSdk): Promise<any>;
export function get_protocol_version_upgrade_vote_status(sdk: WasmSdk, start_pro_tx_hash: string, count: number): Promise<any>;
export function get_protocol_version_upgrade_state_with_proof_info(sdk: WasmSdk): Promise<any>;
export function get_protocol_version_upgrade_vote_status_with_proof_info(sdk: WasmSdk, start_pro_tx_hash: string, count: number): Promise<any>;
export function get_epochs_info(sdk: WasmSdk, start_epoch?: number | null, count?: number | null, ascending?: boolean | null): Promise<any>;
export function get_finalized_epoch_infos(sdk: WasmSdk, start_epoch?: number | null, count?: number | null, ascending?: boolean | null): Promise<any>;
export function get_evonodes_proposed_epoch_blocks_by_ids(sdk: WasmSdk, epoch: number, ids: string[]): Promise<any>;
export function get_evonodes_proposed_epoch_blocks_by_range(sdk: WasmSdk, epoch: number, limit?: number | null, start_after?: string | null, order_ascending?: boolean | null): Promise<any>;
export function get_current_epoch(sdk: WasmSdk): Promise<any>;
export function get_epochs_info_with_proof_info(sdk: WasmSdk, start_epoch?: number | null, count?: number | null, ascending?: boolean | null): Promise<any>;
export function get_current_epoch_with_proof_info(sdk: WasmSdk): Promise<any>;
export function get_finalized_epoch_infos_with_proof_info(sdk: WasmSdk, start_epoch?: number | null, count?: number | null, ascending?: boolean | null): Promise<any>;
export function get_evonodes_proposed_epoch_blocks_by_ids_with_proof_info(sdk: WasmSdk, epoch: number, pro_tx_hashes: string[]): Promise<any>;
export function get_evonodes_proposed_epoch_blocks_by_range_with_proof_info(sdk: WasmSdk, epoch: number, limit?: number | null, start_after?: string | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resources(sdk: WasmSdk, document_type_name: string, data_contract_id: string, index_name: string, _result_type: string, _allow_include_locked_and_abstaining_vote_tally?: boolean | null, start_at_value?: Uint8Array | null, limit?: number | null, _offset?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_voters_for_identity(sdk: WasmSdk, contract_id: string, document_type_name: string, index_name: string, index_values: any[], contestant_id: string, start_at_voter_info?: string | null, limit?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_identity_votes(sdk: WasmSdk, identity_id: string, limit?: number | null, start_at_vote_poll_id_info?: string | null, order_ascending?: boolean | null): Promise<any>;
export function get_vote_polls_by_end_date(sdk: WasmSdk, start_time_info?: string | null, end_time_info?: string | null, limit?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resources_with_proof_info(sdk: WasmSdk, document_type_name: string, data_contract_id: string, index_name: string, _result_type: string, _allow_include_locked_and_abstaining_vote_tally?: boolean | null, start_at_value?: Uint8Array | null, limit?: number | null, _offset?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_vote_state_with_proof_info(sdk: WasmSdk, data_contract_id: string, document_type_name: string, index_name: string, result_type: string, allow_include_locked_and_abstaining_vote_tally?: boolean | null, start_at_identifier_info?: string | null, count?: number | null, _order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_voters_for_identity_with_proof_info(sdk: WasmSdk, data_contract_id: string, document_type_name: string, index_name: string, contestant_id: string, start_at_identifier_info?: string | null, count?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_identity_votes_with_proof_info(sdk: WasmSdk, identity_id: string, limit?: number | null, offset?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_vote_polls_by_end_date_with_proof_info(sdk: WasmSdk, start_time_ms?: bigint | null, end_time_ms?: bigint | null, limit?: number | null, offset?: number | null, order_ascending?: boolean | null): Promise<any>;
export function get_contested_resource_vote_state(sdk: WasmSdk, data_contract_id: string, document_type_name: string, index_name: string, result_type: string, allow_include_locked_and_abstaining_vote_tally?: boolean | null, start_at_identifier_info?: string | null, count?: number | null, _order_ascending?: boolean | null): Promise<any>;
export function get_group_info(sdk: WasmSdk, data_contract_id: string, group_contract_position: number): Promise<any>;
export function get_group_members(sdk: WasmSdk, data_contract_id: string, group_contract_position: number, member_ids?: string[] | null, start_at?: string | null, limit?: number | null): Promise<any>;
export function get_identity_groups(sdk: WasmSdk, identity_id: string, member_data_contracts?: string[] | null, owner_data_contracts?: string[] | null, moderator_data_contracts?: string[] | null): Promise<any>;
export function get_group_infos(sdk: WasmSdk, contract_id: string, start_at_info: any, count?: number | null): Promise<any>;
export function get_group_actions(sdk: WasmSdk, contract_id: string, group_contract_position: number, status: string, start_at_info: any, count?: number | null): Promise<any>;
export function get_group_action_signers(sdk: WasmSdk, contract_id: string, group_contract_position: number, status: string, action_id: string): Promise<any>;
export function get_groups_data_contracts(sdk: WasmSdk, data_contract_ids: string[]): Promise<any>;
export function get_group_info_with_proof_info(sdk: WasmSdk, data_contract_id: string, group_contract_position: number): Promise<any>;
export function get_group_infos_with_proof_info(sdk: WasmSdk, contract_id: string, start_at_info: any, count?: number | null): Promise<any>;
export function get_group_members_with_proof_info(sdk: WasmSdk, data_contract_id: string, group_contract_position: number, member_ids?: string[] | null, start_at?: string | null, limit?: number | null): Promise<any>;
export function get_identity_groups_with_proof_info(sdk: WasmSdk, identity_id: string, member_data_contracts?: string[] | null, owner_data_contracts?: string[] | null, moderator_data_contracts?: string[] | null): Promise<any>;
export function get_group_actions_with_proof_info(sdk: WasmSdk, contract_id: string, group_contract_position: number, status: string, start_at_info: any, count?: number | null): Promise<any>;
export function get_group_action_signers_with_proof_info(sdk: WasmSdk, contract_id: string, group_contract_position: number, status: string, action_id: string): Promise<any>;
export function get_groups_data_contracts_with_proof_info(sdk: WasmSdk, data_contract_ids: string[]): Promise<any>;
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */
type ReadableStreamType = "bytes";
export class DataContractWasm {
  private constructor();
  free(): void;
  id(): string;
  toJSON(): any;
}
export class DocumentWasm {
  private constructor();
  free(): void;
  id(): string;
}
export class IdentityWasm {
  free(): void;
  constructor(platform_version: number);
  setPublicKeys(public_keys: Array<any>): number;
  getBalance(): number;
  setBalance(balance: number): void;
  increaseBalance(amount: number): number;
  reduceBalance(amount: number): number;
  setRevision(revision: number): void;
  getRevision(): number;
  toJSON(): any;
  hash(): Uint8Array;
  getPublicKeyMaxId(): number;
  static fromBuffer(buffer: Uint8Array): IdentityWasm;
  readonly balance: number;
}
export class IntoUnderlyingByteSource {
  private constructor();
  free(): void;
  start(controller: ReadableByteStreamController): void;
  pull(controller: ReadableByteStreamController): Promise<any>;
  cancel(): void;
  readonly type: ReadableStreamType;
  readonly autoAllocateChunkSize: number;
}
export class IntoUnderlyingSink {
  private constructor();
  free(): void;
  write(chunk: any): Promise<any>;
  close(): Promise<any>;
  abort(reason: any): Promise<any>;
}
export class IntoUnderlyingSource {
  private constructor();
  free(): void;
  pull(controller: ReadableStreamDefaultController): Promise<any>;
  cancel(): void;
}
export class WasmContext {
  private constructor();
  free(): void;
}
export class WasmError {
  private constructor();
  free(): void;
}
export class WasmSdk {
  private constructor();
  free(): void;
  version(): number;
  /**
   * Test serialization of different object types
   */
  testSerialization(test_type: string): any;
  /**
   * Create a new document on the platform.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `owner_id` - The identity ID of the document owner
   * * `document_data` - The document data as a JSON string
   * * `entropy` - 32 bytes of entropy for the state transition (hex string)
   * * `private_key_wif` - The private key in WIF format for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the created document
   */
  documentCreate(data_contract_id: string, document_type: string, owner_id: string, document_data: string, entropy: string, private_key_wif: string): Promise<any>;
  /**
   * Replace an existing document on the platform.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `document_id` - The ID of the document to replace
   * * `owner_id` - The identity ID of the document owner
   * * `document_data` - The new document data as a JSON string
   * * `revision` - The current revision of the document
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the replaced document
   */
  documentReplace(data_contract_id: string, document_type: string, document_id: string, owner_id: string, document_data: string, revision: bigint, private_key_wif: string, _key_id: number): Promise<any>;
  /**
   * Delete a document from the platform.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `document_id` - The ID of the document to delete
   * * `owner_id` - The identity ID of the document owner
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue confirming deletion
   */
  documentDelete(data_contract_id: string, document_type: string, document_id: string, owner_id: string, private_key_wif: string, _key_id: number): Promise<any>;
  /**
   * Transfer document ownership to another identity.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `document_id` - The ID of the document to transfer
   * * `owner_id` - The current owner's identity ID
   * * `recipient_id` - The new owner's identity ID
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the transfer result
   */
  documentTransfer(data_contract_id: string, document_type: string, document_id: string, owner_id: string, recipient_id: string, private_key_wif: string, _key_id: number): Promise<any>;
  /**
   * Purchase a document that has a price set.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `document_id` - The ID of the document to purchase
   * * `buyer_id` - The buyer's identity ID
   * * `price` - The purchase price in credits
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the purchase result
   */
  documentPurchase(data_contract_id: string, document_type: string, document_id: string, buyer_id: string, price: bigint, private_key_wif: string, key_id: number): Promise<any>;
  /**
   * Set a price for a document to enable purchases.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract
   * * `document_type` - The name of the document type
   * * `document_id` - The ID of the document
   * * `owner_id` - The owner's identity ID
   * * `price` - The price in credits (0 to remove price)
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the result
   */
  documentSetPrice(data_contract_id: string, document_type: string, document_id: string, owner_id: string, price: bigint, private_key_wif: string, key_id: number): Promise<any>;
  /**
   * Create a new data contract on Dash Platform.
   *
   * # Arguments
   *
   * * `owner_id` - The identity ID that will own the contract
   * * `contract_definition` - JSON string containing the contract definition
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - Optional key ID to use for signing (if None, will auto-select)
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the created contract
   */
  contractCreate(owner_id: string, contract_definition: string, private_key_wif: string, key_id?: number | null): Promise<any>;
  /**
   * Update an existing data contract on Dash Platform.
   *
   * # Arguments
   *
   * * `contract_id` - The ID of the contract to update
   * * `owner_id` - The identity ID that owns the contract
   * * `contract_updates` - JSON string containing the updated contract definition
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - Optional key ID to use for signing (if None, will auto-select)
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the update result
   */
  contractUpdate(contract_id: string, owner_id: string, contract_updates: string, private_key_wif: string, key_id?: number | null): Promise<any>;
  /**
   * Transfer credits from one identity to another.
   *
   * # Arguments
   *
   * * `sender_id` - The identity ID of the sender
   * * `recipient_id` - The identity ID of the recipient
   * * `amount` - The amount of credits to transfer
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - Optional key ID to use for signing (if None, will auto-select)
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the transfer result
   */
  identityCreditTransfer(sender_id: string, recipient_id: string, amount: bigint, private_key_wif: string, key_id?: number | null): Promise<any>;
  /**
   * Withdraw credits from an identity to a Dash address.
   *
   * # Arguments
   *
   * * `identity_id` - The identity ID to withdraw from
   * * `to_address` - The Dash address to send the withdrawn credits to
   * * `amount` - The amount of credits to withdraw
   * * `core_fee_per_byte` - Optional core fee per byte (defaults to 1)
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - Optional key ID to use for signing (if None, will auto-select)
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the withdrawal result
   */
  identityCreditWithdrawal(identity_id: string, to_address: string, amount: bigint, core_fee_per_byte: number | null | undefined, private_key_wif: string, key_id?: number | null): Promise<any>;
  /**
   * Update an identity by adding or disabling public keys.
   *
   * # Arguments
   *
   * * `identity_id` - The identity ID to update
   * * `add_public_keys` - JSON array of public keys to add
   * * `disable_public_keys` - Array of key IDs to disable
   * * `private_key_wif` - The private key in WIF format for signing (must be a master key)
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the update result
   */
  identityUpdate(identity_id: string, add_public_keys: string | null | undefined, disable_public_keys: Uint32Array | null | undefined, private_key_wif: string): Promise<any>;
  /**
   * Submit a masternode vote for a contested resource.
   *
   * # Arguments
   *
   * * `pro_tx_hash` - The ProTxHash of the masternode
   * * `contract_id` - The data contract ID containing the contested resource
   * * `document_type_name` - The document type name (e.g., "domain")
   * * `index_name` - The index name (e.g., "parentNameAndLabel")
   * * `index_values` - JSON array of index values (e.g., ["dash", "username"])
   * * `vote_choice` - The vote choice: "towardsIdentity:<identity_id>", "abstain", or "lock"
   * * `private_key_wif` - The masternode voting key in WIF format
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the vote result
   */
  masternodeVote(masternode_pro_tx_hash: string, contract_id: string, document_type_name: string, index_name: string, index_values: string, vote_choice: string, voting_key_wif: string): Promise<any>;
  /**
   * Mint new tokens according to the token's configuration.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `amount` - The amount of tokens to mint
   * * `identity_id` - The identity ID of the minter
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   * * `recipient_id` - Optional recipient identity ID (if None, mints to issuer)
   * * `public_note` - Optional public note for the mint operation
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenMint(data_contract_id: string, token_position: number, amount: string, identity_id: string, private_key_wif: string, key_id: number, recipient_id?: string | null, public_note?: string | null): Promise<any>;
  /**
   * Burn tokens, permanently removing them from circulation.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `amount` - The amount of tokens to burn
   * * `identity_id` - The identity ID of the burner
   * * `private_key_wif` - The private key in WIF format for signing
   * * `key_id` - The key ID to use for signing
   * * `public_note` - Optional public note for the burn operation
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenBurn(data_contract_id: string, token_position: number, amount: string, identity_id: string, private_key_wif: string, key_id: number, public_note?: string | null): Promise<any>;
  /**
   * Transfer tokens between identities.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `amount` - The amount of tokens to transfer
   * * `sender_id` - The identity ID of the sender
   * * `recipient_id` - The identity ID of the recipient
   * * `private_key_wif` - The private key in WIF format for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenTransfer(data_contract_id: string, token_position: number, amount: string, sender_id: string, recipient_id: string, private_key_wif: string): Promise<any>;
  /**
   * Freeze tokens for a specific identity.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `identity_to_freeze` - The identity ID whose tokens to freeze
   * * `freezer_id` - The identity ID of the freezer (must have permission)
   * * `private_key_wif` - The private key in WIF format for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenFreeze(data_contract_id: string, token_position: number, identity_to_freeze: string, freezer_id: string, private_key_wif: string): Promise<any>;
  /**
   * Unfreeze tokens for a specific identity.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `identity_to_unfreeze` - The identity ID whose tokens to unfreeze
   * * `unfreezer_id` - The identity ID of the unfreezer (must have permission)
   * * `private_key_wif` - The private key in WIF format for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenUnfreeze(data_contract_id: string, token_position: number, identity_to_unfreeze: string, unfreezer_id: string, private_key_wif: string): Promise<any>;
  /**
   * Destroy frozen tokens.
   *
   * # Arguments
   *
   * * `data_contract_id` - The ID of the data contract containing the token
   * * `token_position` - The position of the token in the contract (0-indexed)
   * * `identity_id` - The identity ID whose frozen tokens to destroy
   * * `destroyer_id` - The identity ID of the destroyer (must have permission)
   * * `private_key_wif` - The private key in WIF format for signing
   *
   * # Returns
   *
   * Returns a Promise that resolves to a JsValue containing the state transition result
   */
  tokenDestroyFrozen(data_contract_id: string, token_position: number, identity_id: string, destroyer_id: string, private_key_wif: string): Promise<any>;
}
export class WasmSdkBuilder {
  private constructor();
  free(): void;
  static new_mainnet(): WasmSdkBuilder;
  static new_mainnet_trusted(): WasmSdkBuilder;
  static new_testnet(): WasmSdkBuilder;
  static new_testnet_trusted(): WasmSdkBuilder;
  build(): WasmSdk;
  with_context_provider(context_provider: WasmContext): WasmSdkBuilder;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmcontext_free: (a: number, b: number) => void;
  readonly __wbg_identitywasm_free: (a: number, b: number) => void;
  readonly identitywasm_new: (a: number) => [number, number, number];
  readonly identitywasm_setPublicKeys: (a: number, b: any) => [number, number, number];
  readonly identitywasm_balance: (a: number) => number;
  readonly identitywasm_setBalance: (a: number, b: number) => void;
  readonly identitywasm_increaseBalance: (a: number, b: number) => number;
  readonly identitywasm_reduceBalance: (a: number, b: number) => number;
  readonly identitywasm_setRevision: (a: number, b: number) => void;
  readonly identitywasm_getRevision: (a: number) => number;
  readonly identitywasm_toJSON: (a: number) => [number, number, number];
  readonly identitywasm_hash: (a: number) => [number, number, number, number];
  readonly identitywasm_getPublicKeyMaxId: (a: number) => number;
  readonly identitywasm_fromBuffer: (a: number, b: number) => [number, number, number];
  readonly __wbg_datacontractwasm_free: (a: number, b: number) => void;
  readonly datacontractwasm_id: (a: number) => [number, number];
  readonly datacontractwasm_toJSON: (a: number) => [number, number, number];
  readonly dpns_convert_to_homograph_safe: (a: number, b: number) => [number, number];
  readonly dpns_is_valid_username: (a: number, b: number) => number;
  readonly dpns_is_contested_username: (a: number, b: number) => number;
  readonly dpns_register_name: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly dpns_is_name_available: (a: number, b: number, c: number) => any;
  readonly dpns_resolve_name: (a: number, b: number, c: number) => any;
  readonly __wbg_wasmsdk_free: (a: number, b: number) => void;
  readonly wasmsdk_version: (a: number) => number;
  readonly wasmsdk_testSerialization: (a: number, b: number, c: number) => [number, number, number];
  readonly __wbg_wasmsdkbuilder_free: (a: number, b: number) => void;
  readonly wasmsdkbuilder_new_mainnet: () => number;
  readonly wasmsdkbuilder_new_mainnet_trusted: () => [number, number, number];
  readonly wasmsdkbuilder_new_testnet: () => number;
  readonly wasmsdkbuilder_new_testnet_trusted: () => [number, number, number];
  readonly wasmsdkbuilder_build: (a: number) => [number, number, number];
  readonly wasmsdkbuilder_with_context_provider: (a: number, b: number) => number;
  readonly prefetch_trusted_quorums_mainnet: () => any;
  readonly prefetch_trusted_quorums_testnet: () => any;
  readonly identity_put: (a: number) => any;
  readonly epoch_testing: () => any;
  readonly docs_testing: (a: number) => any;
  readonly get_identities_token_balances: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identity_token_infos: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_identities_token_infos: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_token_statuses: (a: number, b: number, c: number) => any;
  readonly get_token_direct_purchase_prices: (a: number, b: number, c: number) => any;
  readonly get_token_contract_info: (a: number, b: number, c: number) => any;
  readonly get_token_perpetual_distribution_last_claim: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_token_total_supply: (a: number, b: number, c: number) => any;
  readonly get_identities_token_balances_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_token_statuses_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_token_total_supply_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identity_token_infos_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_identities_token_infos_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_token_direct_purchase_prices_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_token_contract_info_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_token_perpetual_distribution_last_claim_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly identitywasm_getBalance: (a: number) => number;
  readonly start: () => void;
  readonly wasmsdk_documentCreate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => any;
  readonly wasmsdk_documentReplace: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: bigint, m: number, n: number, o: number) => any;
  readonly wasmsdk_documentDelete: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => any;
  readonly wasmsdk_documentTransfer: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly wasmsdk_documentPurchase: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint, k: number, l: number, m: number) => any;
  readonly wasmsdk_documentSetPrice: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: bigint, k: number, l: number, m: number) => any;
  readonly verify_identity_response: () => any;
  readonly verify_data_contract: () => any;
  readonly verify_documents: () => any;
  readonly __wbg_documentwasm_free: (a: number, b: number) => void;
  readonly documentwasm_id: (a: number) => [number, number];
  readonly wasmsdk_contractCreate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
  readonly wasmsdk_contractUpdate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => any;
  readonly wasmsdk_identityCreditTransfer: (a: number, b: number, c: number, d: number, e: number, f: bigint, g: number, h: number, i: number) => any;
  readonly wasmsdk_identityCreditWithdrawal: (a: number, b: number, c: number, d: number, e: number, f: bigint, g: number, h: number, i: number, j: number) => any;
  readonly wasmsdk_identityUpdate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly wasmsdk_masternodeVote: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => any;
  readonly get_documents: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly get_documents_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly get_document: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_document_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_dpns_usernames: (a: number, b: number, c: number, d: number) => any;
  readonly get_dpns_username: (a: number, b: number, c: number) => any;
  readonly get_dpns_usernames_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_dpns_username_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_dpns_username_by_name: (a: number, b: number, c: number) => any;
  readonly get_dpns_username_by_name_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_status: (a: number) => any;
  readonly get_current_quorums_info: (a: number) => any;
  readonly get_total_credits_in_platform: (a: number) => any;
  readonly get_prefunded_specialized_balance: (a: number, b: number, c: number) => any;
  readonly wait_for_state_transition_result: (a: number, b: number, c: number) => any;
  readonly get_path_elements: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_total_credits_in_platform_with_proof_info: (a: number) => any;
  readonly get_prefunded_specialized_balance_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_path_elements_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly __wbg_wasmerror_free: (a: number, b: number) => void;
  readonly wasmsdk_tokenMint: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => any;
  readonly wasmsdk_tokenBurn: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => any;
  readonly wasmsdk_tokenTransfer: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => any;
  readonly wasmsdk_tokenFreeze: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => any;
  readonly wasmsdk_tokenUnfreeze: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => any;
  readonly wasmsdk_tokenDestroyFrozen: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => any;
  readonly identity_fetch: (a: number, b: number, c: number) => any;
  readonly identity_fetch_with_proof_info: (a: number, b: number, c: number) => any;
  readonly identity_fetch_unproved: (a: number, b: number, c: number) => any;
  readonly get_identity_keys: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => any;
  readonly get_identity_nonce: (a: number, b: number, c: number) => any;
  readonly get_identity_nonce_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identity_contract_nonce: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identity_contract_nonce_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identity_balance: (a: number, b: number, c: number) => any;
  readonly get_identities_balances: (a: number, b: number, c: number) => any;
  readonly get_identity_balance_and_revision: (a: number, b: number, c: number) => any;
  readonly get_identity_by_public_key_hash: (a: number, b: number, c: number) => any;
  readonly get_identities_contract_keys: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_identity_by_non_unique_public_key_hash: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identity_token_balances: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identity_keys_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_identity_balance_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identities_balances_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identity_balance_and_revision_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identity_by_public_key_hash_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_identity_by_non_unique_public_key_hash_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly get_identities_contract_keys_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_identity_token_balances_with_proof_info: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly data_contract_fetch: (a: number, b: number, c: number) => any;
  readonly data_contract_fetch_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_data_contract_history: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => any;
  readonly get_data_contracts: (a: number, b: number, c: number) => any;
  readonly get_data_contract_history_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => any;
  readonly get_data_contracts_with_proof_info: (a: number, b: number, c: number) => any;
  readonly get_protocol_version_upgrade_state: (a: number) => any;
  readonly get_protocol_version_upgrade_vote_status: (a: number, b: number, c: number, d: number) => any;
  readonly get_protocol_version_upgrade_state_with_proof_info: (a: number) => any;
  readonly get_protocol_version_upgrade_vote_status_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_epochs_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_finalized_epoch_infos: (a: number, b: number, c: number, d: number) => any;
  readonly get_evonodes_proposed_epoch_blocks_by_ids: (a: number, b: number, c: number, d: number) => any;
  readonly get_evonodes_proposed_epoch_blocks_by_range: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly get_current_epoch: (a: number) => any;
  readonly get_epochs_info_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_current_epoch_with_proof_info: (a: number) => any;
  readonly get_finalized_epoch_infos_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_evonodes_proposed_epoch_blocks_by_ids_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_evonodes_proposed_epoch_blocks_by_range_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly get_contested_resources: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => any;
  readonly get_contested_resource_voters_for_identity: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => any;
  readonly get_contested_resource_identity_votes: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_vote_polls_by_end_date: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly get_contested_resources_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => any;
  readonly get_contested_resource_vote_state_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly get_contested_resource_voters_for_identity_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => any;
  readonly get_contested_resource_identity_votes_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly get_vote_polls_by_end_date_with_proof_info: (a: number, b: number, c: bigint, d: number, e: bigint, f: number, g: number, h: number) => any;
  readonly get_contested_resource_vote_state: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly get_group_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_group_members: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_identity_groups: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_group_infos: (a: number, b: number, c: number, d: any, e: number) => any;
  readonly get_group_actions: (a: number, b: number, c: number, d: number, e: number, f: number, g: any, h: number) => any;
  readonly get_group_action_signers: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
  readonly get_groups_data_contracts: (a: number, b: number, c: number) => any;
  readonly get_group_info_with_proof_info: (a: number, b: number, c: number, d: number) => any;
  readonly get_group_infos_with_proof_info: (a: number, b: number, c: number, d: any, e: number) => any;
  readonly get_group_members_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_identity_groups_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly get_group_actions_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: any, h: number) => any;
  readonly get_group_action_signers_with_proof_info: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
  readonly get_groups_data_contracts_with_proof_info: (a: number, b: number, c: number) => any;
  readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
  readonly intounderlyingbytesource_type: (a: number) => number;
  readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
  readonly intounderlyingbytesource_start: (a: number, b: any) => void;
  readonly intounderlyingbytesource_pull: (a: number, b: any) => any;
  readonly intounderlyingbytesource_cancel: (a: number) => void;
  readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
  readonly intounderlyingsource_pull: (a: number, b: any) => any;
  readonly intounderlyingsource_cancel: (a: number) => void;
  readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
  readonly intounderlyingsink_write: (a: number, b: any) => any;
  readonly intounderlyingsink_close: (a: number) => any;
  readonly intounderlyingsink_abort: (a: number, b: any) => any;
  readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
  readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h90a790bbd381a06a: (a: number, b: number) => void;
  readonly _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hd571f46da4a3ec78: (a: number, b: number) => void;
  readonly closure2566_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure4344_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;