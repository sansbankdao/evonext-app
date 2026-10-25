/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

type ReadableStreamType = "bytes";

/**
 * A Platform address can be provided as:
 * - A PlatformAddress object
 * - A Uint8Array (21 bytes: type byte + 20-byte hash)
 * - A bech32m string (e.g., "dash1..." or "tdash1...")
 */
export type PlatformAddressLike = PlatformAddress | Uint8Array | string;

/**
 * An array of Platform addresses.
 */
export type PlatformAddressLikeArray = Array<PlatformAddressLike>;



/**
 * A chained document query — a provable semi-join:
 * `SELECT * FROM <outerDocumentType> WHERE $id IN
 *   (SELECT <joinProperty> FROM <innerDocumentType> WHERE ...)`.
 *
 * The inner query must target an indexOnly document type and resolve to
 * an index carrying `joinProperty`, and `joinProperty` must declare a
 * same-contract `refersTo: permanentDocument` targeting
 * `outerDocumentType` ("posts I liked": inner `like` through `byLiker`,
 * join `postId`, outer `post`) whose `refersTo` carries no `lookup`: a
 * reference resolved through a unique index holds no document ids, so it is
 * refused as a join property. There are no outer-side clauses by
 * design — the verifier derives the outer query from the proven inner
 * results.
 */
interface ChainedDocumentsQuery {
    /** The contract both document types live in. */
    dataContractId: string | Uint8Array;
    /** The indexOnly document type queried directly (e.g. "like"). */
    innerDocumentType: string;
    /** Inner where clauses, same shape as a documents query's `where`. */
    where?: any[];
    /** Inner ordering, same shape as a documents query's `orderBy`. */
    orderBy?: any[];
    /**
     * REQUIRED page size of the inner query — it bounds the derived
     * outer query, so there is no server-default fallback.
     */
    innerLimit: number;
    /** The inner property whose proven values become the outer `$id`s. */
    joinProperty: string;
    /** The joined document type — the `refersTo` target (e.g. "post"). */
    outerDocumentType: string;
}

/**
 * Both halves of a verified chained query, in inner-proof order.
 */
interface ChainedDocumentsResult {
    /**
     * The inner projections exactly as the inner query alone would
     * return them; the last one's join property is the pagination
     * cursor.
     */
    innerDocuments: Document[];
    /**
     * The joined outer documents, ordered by first appearance of their
     * id among the inner projections (deduplicated). When the join
     * property is a `deletableDocument` reference, a referenced document
     * deleted since is proven absent and has no entry here: match the
     * halves by id, not by position.
     */
    outerDocuments: Document[];
    /**
     * The join values that have NO outer document, in first-appearance
     * order: referenced documents deleted since, each one a proven
     * absence. Always empty under a `permanentDocument` join property,
     * and under a `moderatedDocument` one, which reports its missing
     * documents in `removedOuterDocuments`.
     */
    missingOuterIds: Identifier[];
    /**
     * The join values whose outer document the contract's moderators
     * removed, each with its proven removal record, in first-appearance
     * order. Only a `moderatedDocument` join property reports any; there a
     * join value with neither a document nor a record is a verification
     * error.
     */
    removedOuterDocuments: JoinedDocumentRemoval[];
}

/**
 * The removal record of a document a join through a `moderatedDocument`
 * reference reports removed: the `ContractDocumentRemovalEntry` a removals
 * query returns, its identifiers `Identifier`s, as the join's other ids are.
 */
interface JoinedDocumentRemoval {
    documentId: Identifier;
    /** The identity that owned the document when it was removed. */
    documentOwnerId: Identifier;
    /** The contract owner or moderator that removed it. */
    moderatorId: Identifier;
    /** Why, as the moderator wrote it: the text may be empty. */
    reason: ContractModerationReason;
    /** The time of the block that removed it, in milliseconds. */
    removedAt: bigint;
    /** A double SHA-256 of the document when it was removed, as 64 hex characters. */
    documentHash: string;
    /** The contract owner or moderator that restored the document; absent while the removal stands. */
    restoredBy?: Identifier;
    /** The time of the block that restored it, in milliseconds; absent while the removal stands. */
    restoredAt?: bigint;
    /**
     * The values the record keeps of the document, by the property path its type lists under
     * `moderatorAbilities.deleteKeepsFields`, shown as the document's `properties` show them.
     * Empty when the type keeps none.
     */
    keptFields: Record<string, unknown>;
}



/**
 * A key registered with `totalBudget` or `expiresAt` carries usage limits (protocol version
 * 14): the credits its transitions may take from the identity over its lifetime, and the block
 * time in milliseconds from which it can no longer sign. Only AUTHENTICATION keys below MASTER
 * may carry them. The limits are part of what the identity signs when the key is registered.
 */
export interface IdentityPublicKeyInCreationOptions {
    keyId: number;
    purpose: PurposeLike;
    securityLevel: SecurityLevelLike;
    keyType: KeyTypeLike;
    isReadOnly?: boolean;
    data: Uint8Array;
    signature?: Uint8Array;
    contractBounds?: ContractBounds;
    totalBudget?: bigint;
    expiresAt?: bigint;
}

/**
 * IdentityPublicKeyInCreation serialized as a plain object. `$formatVersion` is "0" for a key
 * without limits and "1" for a key that may carry them.
 */
export interface IdentityPublicKeyInCreationObject {
    $formatVersion: string;
    keyId: number;
    purpose: Purpose;
    securityLevel: SecurityLevel;
    keyType: KeyType;
    isReadOnly: boolean;
    data: Uint8Array;
    signature?: Uint8Array;
    contractBounds?: ContractBoundsObject;
    totalBudget?: bigint;
    expiresAt?: bigint;
}

/**
 * IdentityPublicKeyInCreation serialized as JSON.
 */
export interface IdentityPublicKeyInCreationJSON {
    $formatVersion: string;
    keyId: number;
    purpose: string;
    securityLevel: string;
    keyType: string;
    isReadOnly: boolean;
    data: string;
    signature?: string;
    contractBounds?: ContractBoundsJSON;
    totalBudget?: number | string;
    expiresAt?: number | string;
}



/**
 * A single `distinctFrom` declaration on a document type.
 *
 * Mirrors the `distinctFrom` keyword of the v3 document meta-schema, which is
 * active from protocol version 14. The field name is the schema keyword's
 * own, so what `contract.toJSON()` shows under `distinctFrom` and what these
 * accessors return line up key for key.
 */
export type DocumentPropertyDistinctFrom = {
    /**
     * Dotted path of the declaring property within the document type, for
     * example `"delegateId"`, or `"meta.reviewerId"` for a nested one. An
     * identifier property, or a typed array of identifiers whose `items`
     * carry the declaration, in which case every element is bound. This is the same string consensus reports in the `property` field
     * of `DocumentPropertyNotDistinctError` (code 10419).
     */
    path: string;
    /**
     * What the property's value must differ from: `"$ownerId"` for the
     * document's owner, or the dotted path of another identifier property of
     * the same document type. Consensus refuses a create or replace whose two
     * values are equal; when the named property is absent from the document
     * there is nothing to differ from, so the write passes.
     */
    distinctFrom: string;
};



/**
 * A value of the document a reference of the document type points at, which
 * stands wherever a property path does: `reference`, a top-level property of
 * the type whose `refersTo` finds one document (by id, or by a `findBy`
 * without a function), and `field`, a property path of the referenced type,
 * its `$id`, `$ownerId` or `$creatorId`, or a time or height it records. It
 * is read as that property of that type is. The platform judges a rule
 * reading one once the references hold, with the documents their checks read;
 * `checkDocumentPropertyConstraints` does not judge it.
 */
export type PropertyConstraintReferenced = {
    referenced: [reference: string, field: string];
};

/**
 * Where a rule reads a value: the dotted path of a property of the document
 * type, that path under `$old.` for the stored version the write replaces
 * (`$old.price`; absent on a create), or a value of a referenced document.
 */
export type PropertyConstraintPath = string | PropertyConstraintReferenced;

/**
 * An integer expression of a `propertyConstraints` rule.
 *
 * - a number: an integer value, a `bigint` past `Number.MAX_SAFE_INTEGER`
 *   (rules report such a literal as a `bigint`, exactly);
 * - a string: the dotted path of an integer or boolean property, whose value
 *   it takes (a boolean reads as 1 for true and 0 for false), 0 when the
 *   document leaves the property out, under `$old.` the stored version's; or
 *   a system value (`PropertyConstraintSystemProperty`): a time or height the
 *   document type records by listing it in `required`, or `$revision` on a
 *   type keeping one, either under `$old.` for the stored version's;
 * - `ifAbsent`: a property path and the integer it takes when left out;
 * - `add`, `multiply`, `min` and `max` over two or more operands,
 *   `subtract`, `divide`, `modulo` and `power` over exactly two, `abs` over
 *   one. Arithmetic is exact over 128-bit
 *   integers; `divide` and `modulo` are Euclidean;
 * - `length` and `byteLength`: the characters (as `maxLength` counts them)
 *   and the UTF-8 bytes of a string property; `count`: the items of an array
 *   property, or the bytes of a byte array property. Each is 0 when the
 *   document leaves the property out;
 * - `countPresent`: how many of two or more properties, no two alike, the
 *   document holds, each as `present` tests it, so
 *   `{ equal: [{ countPresent: ['email', 'phone', 'handle'] }, 1] }` asks
 *   for exactly one of them;
 * - `byteAt`: the byte, 0 to 255, at an index (counted from 0, up to 65535)
 *   of a byte array property, 0 when the array does not hold it or the
 *   document leaves the array out;
 * - `countOf` and `sumOf`: a total read from state, how many documents of a
 *   type of the same contract match a filter, or the total of an integer
 *   property over them, as the type's count or sum trees keep it once the
 *   write is done. `checkDocumentPropertyConstraints` does not judge a rule
 *   reading one;
 * - `referenced`: an integer or boolean value, or a time or height, of the
 *   document a reference points at (`PropertyConstraintReferenced`).
 */
export type PropertyConstraintExpression =
| number
| bigint
| string
| PropertyConstraintReferenced
| { ifAbsent: [path: PropertyConstraintPath, value: number | bigint] }
| { add: PropertyConstraintExpression[] }
| { multiply: PropertyConstraintExpression[] }
| { subtract: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { divide: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { modulo: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { power: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { min: PropertyConstraintExpression[] }
| { max: PropertyConstraintExpression[] }
| { abs: PropertyConstraintExpression }
| { length: PropertyConstraintPath }
| { byteLength: PropertyConstraintPath }
| { count: PropertyConstraintPath }
| { countPresent: PropertyConstraintPath[] }
| { byteAt: [path: PropertyConstraintPath, index: number] }
| { countOf: [documentType: string] | [documentType: string, filter: PropertyConstraintAggregateFilter] }
| {
    sumOf:
    | [documentType: string, property: string]
    | [documentType: string, property: string, filter: PropertyConstraintAggregateFilter]
};

/**
 * Which documents a `countOf` or `sumOf` totals: each key, a property path of
 * the counted type or `"$ownerId"`, mapped to the value its documents must
 * take there, read from the document being written: a property path of it,
 * `"$ownerId"`, an integer, or a `const` string or base58 identifier.
 */
export type PropertyConstraintAggregateFilter = Record<
string,
string | number | bigint | { const: string }
>;

/**
 * One side of a comparison of strings or identifiers, or of a `startsWith` or
 * `endsWith` of strings or byte arrays.
 *
 * - a string: the dotted path of a string, an identifier or a byte array
 *   property, under `$old.` the stored version's, or `"$ownerId"`, the
 *   document's owner, or `"$old.$ownerId"`, the stored version's (the owner
 *   before a transfer or a purchase), each an identifier;
 * - `const`: a string constant, a base58 identifier beside an identifier
 *   property or `$ownerId`, or hex digits, two a byte, beside a byte array
 *   property in a `startsWith` or `endsWith`;
 * - `ifAbsent`: a string property with the string it takes when left out;
 * - `referenced`: a value of the document a reference points at
 *   (`PropertyConstraintReferenced`), compared as the other side says: as a
 *   string beside a `const` or a string property, as an identifier beside an
 *   identifier property or `$ownerId` (its `$id`, `$ownerId` and `$creatorId`
 *   always are).
 *
 * A property the document leaves out without a default equals nothing, and
 * a byte array left out starts and ends with nothing.
 */
export type PropertyConstraintEqualityOperand =
| string
| PropertyConstraintReferenced
| { const: string }
| { ifAbsent: [path: PropertyConstraintPath, value: string] };

/**
 * A `propertyConstraints` rule, or a condition inside one.
 *
 * - a comparison of two integer expressions; `equal` and `notEqual` also
 *   compare strings or identifiers, which are never ordered;
 * - `in`: an integer expression and two or more distinct integers, or a
 *   string or identifier property (or `$ownerId` or `$old.$ownerId`) and two or more distinct
 *   strings or base58 identifiers;
 * - `startsWith` / `endsWith`: two strings, a `const` or a string property
 *   each, the first starting or ending with the second, byte for byte; or
 *   two byte arrays, a byte array property or a `const` of hex digits each;
 * - `contains`: a typed array property and the value one of its elements must
 *   equal, an integer expression, a string or an identifier operand as its
 *   elements are; an array the document leaves out holds nothing;
 * - `present` / `absent`: whether the document holds a property of any type;
 * - `notIn`: what `in` lists, holding when the operand takes none of the values;
 * - `anyOf` / `allOf` over two or more conditions, `not` over one, `ifThen`
 *   over two (the second must hold when the first does) and `ifThenElse` over
 *   three (the second must hold when the first does, the third when it does
 *   not). Conditions are checked in order and no further than the outcome
 *   needs.
 */
export type PropertyConstraintCondition =
| { equal: [PropertyConstraintExpression, PropertyConstraintExpression] | [PropertyConstraintEqualityOperand, PropertyConstraintEqualityOperand] }
| { notEqual: [PropertyConstraintExpression, PropertyConstraintExpression] | [PropertyConstraintEqualityOperand, PropertyConstraintEqualityOperand] }
| { lessThan: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { lessThanOrEqual: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { greaterThan: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { greaterThanOrEqual: [PropertyConstraintExpression, PropertyConstraintExpression] }
| { in: [PropertyConstraintExpression, Array<number | bigint>] | [PropertyConstraintPath | { ifAbsent: [path: PropertyConstraintPath, value: string] }, string[]] }
| { notIn: [PropertyConstraintExpression, Array<number | bigint>] | [PropertyConstraintPath | { ifAbsent: [path: PropertyConstraintPath, value: string] }, string[]] }
| { startsWith: [PropertyConstraintEqualityOperand, PropertyConstraintEqualityOperand] }
| { endsWith: [PropertyConstraintEqualityOperand, PropertyConstraintEqualityOperand] }
| { contains: [path: PropertyConstraintPath, PropertyConstraintExpression | PropertyConstraintEqualityOperand] }
| { present: PropertyConstraintPath }
| { absent: PropertyConstraintPath }
| { anyOf: PropertyConstraintCondition[] }
| { allOf: PropertyConstraintCondition[] }
| { not: PropertyConstraintCondition }
| { ifThen: [PropertyConstraintCondition, PropertyConstraintCondition] }
| { ifThenElse: [PropertyConstraintCondition, PropertyConstraintCondition, PropertyConstraintCondition] };

/**
 * How a rule reads a property: `value` as an integer operand, `presence` in
 * `present`, `absent` or `countPresent`, `text` compared with strings,
 * `identifier` compared with identifiers, `length` by the size of a string
 * (`length` or `byteLength`), `count` by the items of an array or byte array,
 * `elements` by the elements a `contains` looks among, `bytes` by the bytes of
 * a byte array (`byteAt`, or a `startsWith` or `endsWith` of byte arrays).
 */
export type PropertyConstraintReadKind =
| 'value'
| 'presence'
| 'text'
| 'identifier'
| 'length'
| 'count'
| 'elements'
| 'bytes';

/**
 * A system value a rule reads: the block time in milliseconds (`At`), the
 * Platform block height (`AtBlockHeight`) or the Core block height
 * (`AtCoreBlockHeight`) of the document's creation, its last update (a create,
 * a replace or a price update) and its last transfer (a create, a transfer or
 * a purchase); or `$revision`, 1 on a create and one more for each later
 * write. Under `$old.` it is the stored version's, the document a write
 * replaces (0 on a create, which has none).
 */
export type PropertyConstraintSystemProperty =
| PropertyConstraintSystemValue
| `$old.${PropertyConstraintSystemValue}`;

/** A system value of one version of the document. */
export type PropertyConstraintSystemValue =
| '$createdAt'
| '$updatedAt'
| '$transferredAt'
| '$createdAtBlockHeight'
| '$updatedAtBlockHeight'
| '$transferredAtBlockHeight'
| '$createdAtCoreBlockHeight'
| '$updatedAtCoreBlockHeight'
| '$transferredAtCoreBlockHeight'
| '$revision';

/**
 * A `countOf` or `sumOf` total a rule reads: how many documents of
 * `documentType`, a type of the same contract, match the filter, or the total
 * of their integer `property` (a `sumOf` only). `filter` lists the keys the
 * documents are matched by, properties of that type or `$ownerId`; the values
 * they must take are in the rule. The platform reads the total from state when
 * the document is sent; `checkDocumentPropertyConstraints` cannot, and does
 * not judge a rule reading one.
 */
export type PropertyConstraintTotalRead = {
    kind: 'countOf' | 'sumOf';
    documentType: string;
    property?: string;
    filter: string[];
};

/**
 * A value a rule reads of the document a reference of the type points at,
 * `{ "referenced": [reference, path] }`: `reference` is the top-level
 * property of the type holding the reference, `path` the field of the
 * referenced document (a property path of its type, `$id`, `$ownerId`,
 * `$creatorId`, or a time or height it records), read as `kind` says. The
 * platform reads the referenced document when it checks the reference;
 * `checkDocumentPropertyConstraints` cannot, and does not judge a rule
 * reading one.
 */
export type PropertyConstraintReferencedRead = {
    reference: string;
    path: string;
    kind: PropertyConstraintReadKind;
};

/**
 * A single `propertyConstraints` rule of a document type.
 */
export type DocumentPropertyConstraint = {
    /** The rule's name, its key in `propertyConstraints`. Rules are checked in name order. */
    name: string;
    /** The rule as the schema declares it. */
    rule: PropertyConstraintCondition;
    /**
     * Every property of the document type the rule reads, in declared order,
     * one of the stored version under its `$old.` path; `$ownerId` and
     * `$old.$ownerId` are no properties and are not listed, and neither is a
     * value of a referenced document (`readsReferenced`).
     */
    reads: Array<{ path: string; kind: PropertyConstraintReadKind }>;
    /**
     * Whether the rule reads `$ownerId` or `$old.$ownerId`, or a total that
     * depends on the owner: then a transfer or a purchase is judged against it
     * too.
     */
    readsOwner: boolean;
    /**
     * The system values the rule reads, in declared order, of either version. A
     * price update is judged against a rule reading the update's, a transfer or
     * a purchase against one reading the transfer's, and each against one
     * reading `$revision`.
     */
    readsSystem: PropertyConstraintSystemProperty[];
    /**
     * Whether the rule reads the stored version of the document through
     * `$old.`. `checkDocumentPropertyConstraints` judges it only when told what
     * the stored version is: none for a create, or the stored document.
     */
    readsStored: boolean;
    /**
     * The `countOf` and `sumOf` totals the rule reads, in declared order, one
     * read twice listed twice. The pre-check does not judge a rule reading one.
     */
    readsTotals: PropertyConstraintTotalRead[];
    /**
     * The values the rule reads of the documents the type's references point
     * at, in declared order, one read twice listed twice. The pre-check does not
     * judge a rule reading one.
     */
    readsReferenced: PropertyConstraintReferencedRead[];
};

/**
 * Why a document breaks a rule, the `violation` consensus reports in
 * `DocumentPropertyConstraintViolatedError` (code 10422): `NotMet` when the
 * rule evaluates to false, or the fault met evaluating it.
 */
export type PropertyConstraintViolationKind =
| 'NotMet'
| 'Overflow'
| 'DivisionByZero'
| 'NegativeExponent'
| 'NotAnInteger';

/**
 * The first rule a document breaks, as consensus would report it.
 */
export type DocumentPropertyConstraintViolation = {
    /** The broken rule's name. */
    rule: string;
    violation: PropertyConstraintViolationKind;
    /** A readable reason, as in the consensus error's message. */
    message: string;
};



/**
 * Address witness for P2PKH spending in Object form.
 */
export interface AddressWitnessP2pkhObject {
    $type: "p2pkh";
    signature: Uint8Array;
}

/**
 * Address witness for P2SH spending in Object form.
 */
export interface AddressWitnessP2shObject {
    $type: "p2sh";
    signatures: Uint8Array[];
    redeemScript: Uint8Array;
}

/**
 * Address witness (P2PKH or P2SH) in Object form.
 */
export type AddressWitnessObject = AddressWitnessP2pkhObject | AddressWitnessP2shObject;

/**
 * Address witness for P2PKH spending in JSON form.
 */
export interface AddressWitnessP2pkhJSON {
    $type: "p2pkh";
    signature: string;
}

/**
 * Address witness for P2SH spending in JSON form.
 */
export interface AddressWitnessP2shJSON {
    $type: "p2sh";
    signatures: string[];
    redeemScript: string;
}

/**
 * Address witness (P2PKH or P2SH) in JSON form.
 */
export type AddressWitnessJSON = AddressWitnessP2pkhJSON | AddressWitnessP2shJSON;



/**
 * AssetLockProof serialized as a plain object.
 *
 * Internally-tagged discriminated union — `$type` discriminates the variant and
 * the variant's fields sit alongside it. Mirrors the rs-dpp serde shape (which
 * uses `#[serde(tag = "$type")]` on the enum) and the convention used by
 * `AddressWitness` / `AddressFundsFeeStrategyStep`.
 */
export type AssetLockProofObject =
| ({ $type: "instant" } & InstantAssetLockProofObject)
| ({ $type: "chain" } & ChainAssetLockProofObject);

/**
 * AssetLockProof serialized as JSON.
 */
export type AssetLockProofJSON =
| ({ $type: "instant" } & InstantAssetLockProofJSON)
| ({ $type: "chain" } & ChainAssetLockProofJSON);



/**
 * BatchTransition serialized as a plain object.
 */
export interface BatchTransitionObject {
    $formatVersion: string;
    ownerId: Uint8Array;
    transitions: BatchedTransitionObject[];
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature: Uint8Array;
}

/**
 * BatchTransition serialized as JSON.
 */
export interface BatchTransitionJSON {
    $formatVersion: string;
    ownerId: string;
    transitions: BatchedTransitionJSON[];
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature: string;
}



/**
 * Block proposers mapping: base58 Identifier string -> block count (bigint).
 */
export type BlockProposersMap = Map<string, bigint>;

export interface FinalizedEpochInfoOptions {
    firstBlockTime: bigint;
    firstBlockHeight: bigint;
    totalBlocksInEpoch: bigint;
    firstCoreBlockHeight: number;
    nextEpochStartCoreBlockHeight: number;
    totalProcessingFees: bigint;
    totalDistributedStorageFees: bigint;
    totalCreatedStorageFees: bigint;
    coreBlockRewards: bigint;
    blockProposers: BlockProposersMap;
    feeMultiplierPermille: bigint;
    protocolVersion: number;
}

/**
 * FinalizedEpochInfo serialized as a plain object.
 */
export interface FinalizedEpochInfoObject {
    firstBlockTime: bigint;
    firstBlockHeight: bigint;
    totalBlocksInEpoch: bigint;
    firstCoreBlockHeight: number;
    nextEpochStartCoreBlockHeight: number;
    totalProcessingFees: bigint;
    totalDistributedStorageFees: bigint;
    totalCreatedStorageFees: bigint;
    coreBlockRewards: bigint;
    blockProposers: BlockProposersMap;
    feeMultiplierPermille: bigint;
    protocolVersion: number;
}

/**
 * FinalizedEpochInfo serialized as JSON.
 * u64 values within JS safe integer range are numbers, otherwise strings.
 */
export interface FinalizedEpochInfoJSON {
    firstBlockTime: number | string;
    firstBlockHeight: number | string;
    totalBlocksInEpoch: number | string;
    firstCoreBlockHeight: number;
    nextEpochStartCoreBlockHeight: number;
    totalProcessingFees: number | string;
    totalDistributedStorageFees: number | string;
    totalCreatedStorageFees: number | string;
    coreBlockRewards: number | string;
    blockProposers: Record<string, number | string>;
    feeMultiplierPermille: number | string;
    protocolVersion: number;
}



/**
 * ChainAssetLockProof serialized as a plain object.
 */
export interface ChainAssetLockProofObject {
    coreChainLockedHeight: number;
    outPoint: OutPointObject;
}

/**
 * ChainAssetLockProof serialized as JSON.
 */
export interface ChainAssetLockProofJSON {
    coreChainLockedHeight: number;
    outPoint: OutPointJSON;
}



/**
 * ContenderWithSerializedDocument serialized as a plain object.
 */
export interface ContenderWithSerializedDocumentObject {
    $formatVersion: string;
    identityId: Uint8Array;
    serializedDocument: Uint8Array | null;
    voteTally: number | null;
}

/**
 * ContenderWithSerializedDocument serialized as JSON.
 */
export interface ContenderWithSerializedDocumentJSON {
    $formatVersion: string;
    identityId: string;
    serializedDocument: string | null;
    voteTally: number | null;
}



/**
 * ContestedDocumentVotePollWinnerInfo serialized as a plain object.
 *
 * Custom Serialize emits a flat `{type, identity?}` shape — `identity`
 * (synthesized name) carries the inner Identifier for the WonByIdentity
 * variant.
 */
export type ContestedDocumentVotePollWinnerInfoObject =
| { $type: "noWinner" }
| { $type: "locked" }
| { $type: "wonByIdentity"; identity: Uint8Array };

/**
 * ContestedDocumentVotePollWinnerInfo serialized as JSON.
 */
export type ContestedDocumentVotePollWinnerInfoJSON =
| { $type: "noWinner" }
| { $type: "locked" }
| { $type: "wonByIdentity"; identity: string };



/**
 * Cursor describing where to resume fetching group infos.
 */
export interface GroupInfosStartAt {
    /**
     * Group contract position.
     */
    position: number;

    /**
     * Include the entry at `position`.
     * @default false
     */
    included?: boolean;
}

/**
 * Query parameters for retrieving group infos.
 */
export interface GroupInfosQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Cursor describing where to resume from.
     * @default undefined
     */
    startAt?: GroupInfosStartAt;

    /**
     * Maximum number of groups to return.
     * @default undefined
     */
    limit?: number;
}



/**
 * DataContractUpdateTransition serialized as a plain object.
 */
export interface DataContractUpdateTransitionObject {
    dataContract: DataContractObject;
    identityNonce: bigint;
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature?: Uint8Array;
}

/**
 * DataContractUpdateTransition serialized as JSON.
 */
export interface DataContractUpdateTransitionJSON {
    dataContract: DataContractJSON;
    identityNonce: string;
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature?: string;
}



/**
 * Distribution amounts per identity: base58 Identifier string -> token amount (bigint).
 */
export type DistributionAmountsMap = Map<string, bigint>;

/**
 * Pre-programmed distributions: timestamp (string) -> distribution amounts map.
 */
export type PreProgrammedDistributionsMap = Map<string, DistributionAmountsMap>;



/**
 * Fee strategy step in Object form (output of a transition's `toObject()`).
 *
 * Discriminated by `type`: "deductFromInput" reduces an input's contribution
 * by the fee, "reduceOutput" reduces an output's amount by the fee. The
 * `index` selects the input/output position.
 */
export type FeeStrategyStepObject =
| { $type: "deductFromInput"; index: number }
| { $type: "reduceOutput"; index: number };

/**
 * Fee strategy step in JSON form (output of a transition's `toJSON()`).
 *
 * Identical shape to `FeeStrategyStepObject` because the only payload is a
 * small `index` (u16) which serializes the same way in both binary and
 * human-readable formats.
 */
export type FeeStrategyStepJSON =
| { $type: "deductFromInput"; index: number }
| { $type: "reduceOutput"; index: number };



/**
 * Flexible ProTxHash type that accepts ProTxHash object, hex string, or Uint8Array.
 *
 * - Hex string: 64-character hex-encoded hash (reversed byte order, as displayed)
 * - Uint8Array: 32 bytes in internal byte order
 */
export type ProTxHashLike = ProTxHash | string | Uint8Array;
export type ProTxHashLikeArray = Array<ProTxHashLike>;



/**
 * Flexible input type for KeyType - accepts the enum, string name, or numeric value.
 */
export type KeyTypeLike = KeyType | "ecdsa_secp256k1" | "bls12_381" | "ecdsa_hash160" | "bip13_script_hash" | "eddsa_25519_hash160" | 0 | 1 | 2 | 3 | 4;



/**
 * Flexible input type for Pooling - accepts the enum, string name, or numeric value.
 */
export type CreditWithdrawalTransitionPoolingLike = Pooling | "never" | "ifavailable" | "standard" | 0 | 1 | 2;



/**
 * Flexible input type for Purpose - accepts the enum, string name, or numeric value.
 */
export type PurposeLike = Purpose | "authentication" | "encryption" | "decryption" | "transfer" | "system" | "voting" | "owner" | 0 | 1 | 2 | 3 | 4 | 5 | 6;



/**
 * Flexible input type for SecurityLevel - accepts the enum, string name, or numeric value.
 */
export type SecurityLevelLike = SecurityLevel | "master" | "critical" | "high" | "medium" | 0 | 1 | 2 | 3;



/**
 * Flexible network type that accepts Network enum, string names, or numeric values.
 *
 * String values (case-insensitive): "mainnet", "testnet", "devnet", "regtest"
 * Numeric values: 0 (mainnet), 1 (testnet), 2 (devnet), 3 (regtest)
 */
export type NetworkLike = Network | "mainnet" | "testnet" | "devnet" | "regtest" | 0 | 1 | 2 | 3;



/**
 * Group action status filter.
 */
export type GroupActionStatusFilter = 'ACTIVE' | 'CLOSED';

/**
 * Cursor describing where to resume fetching group actions.
 */
export interface GroupActionsStartAt {
    /**
     * Group action identifier.
     */
    actionId: IdentifierLike

    /**
     * Include the `actionId` entry in the result set.
     * @default false
     */
    included?: boolean;
}

/**
 * Query parameters for retrieving group actions.
 */
export interface GroupActionsQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Position of the group within the contract.
     */
    groupContractPosition: number;

    /**
     * Filter actions by status.
     */
    status: GroupActionStatusFilter;

    /**
     * Cursor describing where to resume from.
     * @default undefined
     */
    startAt?: GroupActionsStartAt;

    /**
     * Maximum number of actions to return.
     * @default undefined
     */
    limit?: number;
}



/**
 * Group members mapping: base58 Identifier string -> power.
 */
export type GroupMembersMap = Map<string, number>;

/**
 * Group serialized as a plain object.
 */
export interface GroupObject {
    $formatVersion: string;
    members: Record<string, number>;
    requiredPower: number;
}

/**
 * Group serialized as JSON.
 */
export interface GroupJSON {
    $formatVersion: string;
    members: Record<string, number>;
    requiredPower: number;
}



/**
 * GroupAction serialized as a plain object.
 *
 * Versioned enum tagged with `$formatVersion`. V0 fields use snake_case
 * (rs-dpp's GroupActionV0 has no `rename_all` attribute).
 */
export interface GroupActionObject {
    $formatVersion: "0";
    contract_id: Uint8Array;
    proposer_id: Uint8Array;
    token_contract_position: number;
    event: GroupActionEventObject;
}

/**
 * GroupAction serialized as JSON.
 */
export interface GroupActionJSON {
    $formatVersion: "0";
    contract_id: string;
    proposer_id: string;
    token_contract_position: number;
    event: GroupActionEventJSON;
}



/**
 * GroupActionEvent serialized as a plain object.
 *
 * Internally tagged with `$kind` (chosen over `$type` to avoid colliding with
 * the inner TokenEvent's own `$type` discriminator). The inner TokenEvent
 * fields flatten at the same level — both keys coexist.
 */
export type GroupActionEventObject = { $kind: "tokenEvent" } & TokenEventObject;

/**
 * GroupActionEvent serialized as JSON.
 */
export type GroupActionEventJSON = { $kind: "tokenEvent" } & TokenEventJSON;



/**
 * Identity serialized as a plain object.
 */
export interface IdentityObject {
    $formatVersion: string;
    id: Identifier;
    publicKeys: IdentityPublicKeyObject[];
    balance: bigint;
    revision: bigint;
}

/**
 * Identity serialized as JSON (with string identifiers).
 * Note: u64 fields are numbers when within JS safe integer range (< 2^53),
 * or strings when exceeding it.
 */
export interface IdentityJSON {
    $formatVersion: string;
    id: string;
    publicKeys: IdentityPublicKeyJSON[];
    balance: number | string;
    revision: number | string;
}



/**
 * Input address spending credits — Object form (output of a transition's `toObject()`).
 *
 * `address` is the 21-byte PlatformAddress (1 type byte + 20-byte hash) as a Uint8Array.
 */
export interface PlatformAddressInputObject {
    address: Uint8Array;
    nonce: number;
    amount: bigint;
}

/**
 * Input address spending credits — JSON form (output of a transition's `toJSON()`).
 *
 * `address` is hex-encoded; `amount` may be a string when above `Number.MAX_SAFE_INTEGER`.
 */
export interface PlatformAddressInputJSON {
    address: string;
    nonce: number;
    amount: number | string;
}

/**
 * Output address receiving credits — Object form.
 *
 * `amount` is `null` only for asset-lock funding transitions, where exactly one
 * output (acting as the change recipient) absorbs the asset-lock remainder. For
 * all other transitions (transfer / withdrawal / identity flows / credit transfer)
 * the amount is always present.
 */
export interface PlatformAddressOutputObject {
    address: Uint8Array;
    amount: bigint | null;
}

/**
 * Output address receiving credits — JSON form.
 */
export interface PlatformAddressOutputJSON {
    address: string;
    amount: number | string | null;
}



/**
 * InstantAssetLockProof serialized as a plain object.
 */
export interface InstantAssetLockProofObject {
    instantLock: Uint8Array;
    transaction: Uint8Array;
    outputIndex: number;
}

/**
 * InstantAssetLockProof serialized as JSON.
 */
export interface InstantAssetLockProofJSON {
    instantLock: string;
    transaction: string;
    outputIndex: number;
}



/**
 * Options for `WasmSdk.encryptDocumentProperty`: encrypt a message into a byte property whose
 * schema declares `encryptedFor`, the way the declaration says.
 */
export interface EncryptDocumentPropertyOptions {
    /** The contract that declares the document type. */
    dataContract: DataContract;
    /** The document type. */
    documentTypeName: string;
    /** The property declaring `encryptedFor`, such as `encryptedMessage`; dotted when nested. */
    property: string;
    /** The message. A string is encoded as UTF-8. */
    plaintext: Uint8Array | string;
    /** The writer's key; its id goes into the declaration's `senderKey` property. */
    senderKey: IdentityPublicKey;
    /** The private half of `senderKey`. */
    senderPrivateKey: PrivateKey;
    /** The recipient's key; its id goes into the declaration's `recipientKey` property. */
    recipientKey: IdentityPublicKey;
}

/**
 * Options for `WasmSdk.decryptDocumentProperty`. The recipient decrypts with its private key
 * and the sender's key; the sender can read its own message back with its private key and the
 * recipient's key.
 */
export interface DecryptDocumentPropertyOptions {
    /** The contract that declares the document's type. */
    dataContract: DataContract;
    /** The document holding the ciphertext; its type is `document.documentTypeName`. */
    document: Document;
    /** The property declaring `encryptedFor`. */
    property: string;
    /** The private half of the recipient's key, the one `recipientKey` names. */
    recipientPrivateKey: PrivateKey;
    /** The sender's key, the one `senderKey` names (see `encryptedPropertyEnvelope`). */
    senderKey: IdentityPublicKey;
}

/** Options for `WasmSdk.encryptedPropertyEnvelope`. */
export interface EncryptedPropertyEnvelopeOptions {
    /** The contract that declares the document's type. */
    dataContract: DataContract;
    /** The document; its type is `document.documentTypeName`. */
    document: Document;
    /** The property declaring `encryptedFor`. */
    property: string;
}



/**
 * Options for burning tokens.
 */
export interface TokenBurnOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The amount of tokens to burn.
     */
    amount: bigint;

    /**
     * The identity ID of the token holder burning tokens.
     */
    identityId: Identifier;

    /**
     * Optional public note for the burn operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed token burning.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for claiming tokens from a distribution.
 */
export interface TokenClaimOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID claiming the tokens.
     */
    identityId: Identifier;

    /**
     * The type of distribution to claim from: "preProgrammed", "perpetual" or "oncePerIdentity".
     */
    distributionType: "preProgrammed" | "perpetual" | "oncePerIdentity";

    /**
     * Optional public note for the claim operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for constructing a SerializedOrchardAction.
 */
export interface SerializedOrchardActionOptions {
    nullifier: Uint8Array;
    rk: Uint8Array;
    cmx: Uint8Array;
    encryptedNote: Uint8Array;
    cvNet: Uint8Array;
    spendAuthSig: Uint8Array;
}

/**
 * A serialized Orchard action (spend-output pair) in Object form.
 */
export interface SerializedOrchardActionObject {
    nullifier: Uint8Array;
    rk: Uint8Array;
    cmx: Uint8Array;
    encryptedNote: Uint8Array;
    cvNet: Uint8Array;
    spendAuthSig: Uint8Array;
}

/**
 * A serialized Orchard action (spend-output pair) in JSON form.
 */
export interface SerializedOrchardActionJSON {
    nullifier: string;
    rk: string;
    cmx: string;
    encryptedNote: string;
    cvNet: string;
    spendAuthSig: string;
}



/**
 * Options for constructing a ShieldFromAssetLockTransition.
 * Uses WASM instance types for complex fields like AssetLockProof.
 */
export interface ShieldFromAssetLockTransitionOptions {
    assetLockProof: AssetLockProof;
    actions: SerializedOrchardAction[];
    valueBalance: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    signature: Uint8Array;
    /**
     * Optional platform address that receives the asset-lock surplus
     * (`assetLockValue − valueBalance − fee`). When omitted, the surplus is
     * folded into the fee pools, but only up to the implicit fee cap.
     * Accepts a PlatformAddress, a 21-byte Uint8Array, or a bech32m string.
     */
    surplusOutput?: PlatformAddressLike;
    /**
     * The protocol version to build for; defaults to the version this library
     * targets. Protocol version 14 admits only transition version 1, whose
     * bundle binds its kind and its asset lock; earlier versions admit only
     * version 0. Build the bundle's sighash for the same protocol version.
     */
    platformVersion?: PlatformVersionLike;
}

/**
 * ShieldFromAssetLockTransition serialized as a plain object.
 */
export interface ShieldFromAssetLockTransitionObject {
    $formatVersion: string;
    assetLockProof: AssetLockProofObject;
    actions: SerializedOrchardActionObject[];
    valueBalance: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    signature: Uint8Array;
    surplusOutput?: Uint8Array;
}

/**
 * ShieldFromAssetLockTransition serialized as JSON (human-readable).
 */
export interface ShieldFromAssetLockTransitionJSON {
    $formatVersion: string;
    assetLockProof: AssetLockProofJSON;
    actions: SerializedOrchardActionJSON[];
    valueBalance: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
    signature: string;
    surplusOutput?: string;
}



/**
 * Options for constructing a ShieldFromIdentityTransition (identity balance to shielded pool).
 * The bundle is an outputs-only Orchard bundle; the transition is identity-signed with a
 * TRANSFER key after construction.
 */
export interface ShieldFromIdentityTransitionOptions {
    identityId: IdentifierLike;
    amount: bigint;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    nonce: bigint;
    userFeeIncrease?: number;
}

/**
 * ShieldFromIdentityTransition serialized as a plain object.
 */
export interface ShieldFromIdentityTransitionObject {
    $formatVersion: string;
    identityId: Uint8Array;
    amount: bigint;
    actions: SerializedOrchardActionObject[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    nonce: bigint;
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature: Uint8Array;
}

/**
 * ShieldFromIdentityTransition serialized as JSON (human-readable).
 */
export interface ShieldFromIdentityTransitionJSON {
    $formatVersion: string;
    identityId: string;
    amount: number | string;
    actions: SerializedOrchardActionJSON[];
    anchor: string;
    proof: string;
    bindingSignature: string;
    nonce: number | string;
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature: string;
}



/**
 * Options for constructing a ShieldTransition.
 * Uses WASM instance types for complex fields.
 */
export interface ShieldTransitionOptions {
    inputs: PlatformAddressInput[];
    actions: SerializedOrchardAction[];
    amount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
    inputWitnesses: AddressWitness[];
}

/**
 * ShieldTransition serialized as a plain object.
 */
export interface ShieldTransitionObject {
    $formatVersion: string;
    inputs: PlatformAddressInputObject[];
    actions: SerializedOrchardActionObject[];
    amount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
    inputWitnesses: AddressWitnessObject[];
}

/**
 * ShieldTransition serialized as JSON (human-readable).
 */
export interface ShieldTransitionJSON {
    $formatVersion: string;
    inputs: PlatformAddressInputJSON[];
    actions: SerializedOrchardActionJSON[];
    amount: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
    inputWitnesses: AddressWitnessJSON[];
}



/**
 * Options for constructing a ShieldedTransferTransition.
 */
export interface ShieldedTransferTransitionOptions {
    actions: SerializedOrchardAction[];
    valueBalance: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * ShieldedTransferTransition serialized as a plain object.
 */
export interface ShieldedTransferTransitionObject {
    $formatVersion: string;
    actions: SerializedOrchardActionObject[];
    valueBalance: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * ShieldedTransferTransition serialized as JSON (human-readable).
 */
export interface ShieldedTransferTransitionJSON {
    $formatVersion: string;
    actions: SerializedOrchardActionJSON[];
    valueBalance: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
}



/**
 * Options for constructing a ShieldedWithdrawalTransition.
 *
 * `pooling` accepts the `Pooling` enum, the lower-case name string
 * ("never" / "ifavailable" / "standard"), or the numeric value (0/1/2) — same
 * shape as IdentityCreditWithdrawalTransition.
 */
export interface ShieldedWithdrawalTransitionOptions {
    actions: SerializedOrchardAction[];
    unshieldingAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    coreFeePerByte: number;
    pooling: CreditWithdrawalTransitionPoolingLike;
    outputScript: Uint8Array;
}

/**
 * ShieldedWithdrawalTransition serialized as a plain object.
 */
export interface ShieldedWithdrawalTransitionObject {
    $formatVersion: string;
    actions: SerializedOrchardActionObject[];
    unshieldingAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    coreFeePerByte: number;
    pooling: PoolingWasm;
    outputScript: Uint8Array;
}

/**
 * ShieldedWithdrawalTransition serialized as JSON (human-readable).
 */
export interface ShieldedWithdrawalTransitionJSON {
    $formatVersion: string;
    actions: SerializedOrchardActionJSON[];
    unshieldingAmount: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
    coreFeePerByte: number;
    pooling: string;
    outputScript: string;
}



/**
 * Options for constructing a TokenBurnFromPoolTransition. Destroys `amount` tokens held in the token's shielded pool by spending the given notes; the signer must be authorized to burn.
 */
export interface TokenBurnFromPoolTransitionOptions {
    base: TokenBaseTransition;
    amount: bigint;
    publicNote?: string;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenClaimToPoolTransition. Claims a distribution straight into the token's shielded pool; a perpetual claim names the cycle-aligned moment it claims up to.
 */
export interface TokenClaimToPoolTransitionOptions {
    base: TokenBaseTransition;
    distributionType?: TokenDistributionTypeLike;
    claimUpTo?: bigint;
    publicNote?: string;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenDirectPurchaseToPoolTransition. Buys `tokenCount` tokens for at most `totalAgreedPrice` credits and receives them shielded as the given notes.
 */
export interface TokenDirectPurchaseToPoolTransitionOptions {
    base: TokenBaseTransition;
    tokenCount: bigint;
    totalAgreedPrice: bigint;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenMintToPoolTransition. Mints `amount` tokens straight into the token's shielded pool as the given notes; the signer must be authorized to mint.
 */
export interface TokenMintToPoolTransitionOptions {
    base: TokenBaseTransition;
    amount: bigint;
    publicNote?: string;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenPurchaseFromShieldedPoolTransition (token purchase paid from the credit pool). Two Orchard
 * bundles: the token pool bundle and the credit pool fee bundle. There is no platform signature.
 */
export interface TokenPurchaseFromShieldedPoolTransitionOptions {
    dataContractId: IdentifierLike;
    tokenContractPosition: number;
    tokenId: IdentifierLike;
    tokenCount: bigint;
    totalAgreedPrice: bigint;
    tokenActions: SerializedOrchardAction[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardAction[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenPurchaseFromShieldedPoolTransitionObject {
    $formatVersion: string;
    dataContractId: Uint8Array;
    tokenContractPosition: number;
    tokenId: Uint8Array;
    tokenCount: bigint;
    totalAgreedPrice: bigint;
    tokenActions: SerializedOrchardActionObject[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardActionObject[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenPurchaseFromShieldedPoolTransitionJSON {
    $formatVersion: string;
    dataContractId: string;
    tokenContractPosition: number;
    tokenId: string;
    tokenCount: number | string;
    totalAgreedPrice: number | string;
    tokenActions: SerializedOrchardActionJSON[];
    tokenAnchor: string;
    tokenProof: string;
    tokenBindingSignature: string;
    feeActions: SerializedOrchardActionJSON[];
    feeAnchor: string;
    feeProof: string;
    feeBindingSignature: string;
    creditAmount: number | string;
}



/**
 * Options for constructing a TokenShieldTransition. Moves `amount` tokens from the signer's identity balance into the token's shielded pool.
 */
export interface TokenShieldTransitionOptions {
    base: TokenBaseTransition;
    amount: bigint;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenShieldedPayment: an Orchard spend bundle in the payment
 * token's shielded pool whose value balance (`amount`) pays a document action's token cost.
 */
export interface TokenShieldedPaymentOptions {
    amount: bigint;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * TokenShieldedPayment serialized as a plain object.
 */
export interface TokenShieldedPaymentObject {
    amount: bigint;
    actions: SerializedOrchardActionObject[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * TokenShieldedPayment serialized as JSON.
 */
export interface TokenShieldedPaymentJSON {
    amount: number | string;
    actions: SerializedOrchardActionJSON[];
    anchor: string;
    proof: string;
    bindingSignature: string;
}



/**
 * Options for constructing a TokenShieldedTransferTransition. Spends and re-creates notes inside the token's shielded pool; the identity only pays the fee.
 */
export interface TokenShieldedTransferTransitionOptions {
    base: TokenBaseTransition;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenShieldedTransferWithShieldedFeeTransition (token shielded transfer paid from the credit pool). Two Orchard
 * bundles: the token pool bundle and the credit pool fee bundle. There is no platform signature.
 */
export interface TokenShieldedTransferWithShieldedFeeTransitionOptions {
    dataContractId: IdentifierLike;
    tokenContractPosition: number;
    tokenId: IdentifierLike;
    tokenActions: SerializedOrchardAction[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardAction[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenShieldedTransferWithShieldedFeeTransitionObject {
    $formatVersion: string;
    dataContractId: Uint8Array;
    tokenContractPosition: number;
    tokenId: Uint8Array;
    tokenActions: SerializedOrchardActionObject[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardActionObject[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenShieldedTransferWithShieldedFeeTransitionJSON {
    $formatVersion: string;
    dataContractId: string;
    tokenContractPosition: number;
    tokenId: string;
    tokenActions: SerializedOrchardActionJSON[];
    tokenAnchor: string;
    tokenProof: string;
    tokenBindingSignature: string;
    feeActions: SerializedOrchardActionJSON[];
    feeAnchor: string;
    feeProof: string;
    feeBindingSignature: string;
    creditAmount: number | string;
}



/**
 * Options for constructing a TokenUnshieldTransition. Spends shielded notes and credits `amount` tokens to `recipientId`.
 */
export interface TokenUnshieldTransitionOptions {
    base: TokenBaseTransition;
    amount: bigint;
    recipientId: IdentifierLike;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}



/**
 * Options for constructing a TokenUnshieldWithShieldedFeeTransition (identity-less unshield). Two Orchard
 * bundles: the token pool bundle and the credit pool fee bundle. There is no platform signature.
 */
export interface TokenUnshieldWithShieldedFeeTransitionOptions {
    dataContractId: IdentifierLike;
    tokenContractPosition: number;
    tokenId: IdentifierLike;
    recipientId: IdentifierLike;
    amount: bigint;
    tokenActions: SerializedOrchardAction[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardAction[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenUnshieldWithShieldedFeeTransitionObject {
    $formatVersion: string;
    dataContractId: Uint8Array;
    tokenContractPosition: number;
    tokenId: Uint8Array;
    recipientId: Uint8Array;
    amount: bigint;
    tokenActions: SerializedOrchardActionObject[];
    tokenAnchor: Uint8Array;
    tokenProof: Uint8Array;
    tokenBindingSignature: Uint8Array;
    feeActions: SerializedOrchardActionObject[];
    feeAnchor: Uint8Array;
    feeProof: Uint8Array;
    feeBindingSignature: Uint8Array;
    creditAmount: bigint;
}

export interface TokenUnshieldWithShieldedFeeTransitionJSON {
    $formatVersion: string;
    dataContractId: string;
    tokenContractPosition: number;
    tokenId: string;
    recipientId: string;
    amount: number | string;
    tokenActions: SerializedOrchardActionJSON[];
    tokenAnchor: string;
    tokenProof: string;
    tokenBindingSignature: string;
    feeActions: SerializedOrchardActionJSON[];
    feeAnchor: string;
    feeProof: string;
    feeBindingSignature: string;
    creditAmount: number | string;
}



/**
 * Options for constructing an IdentityCreateFromShieldedPoolTransition.
 * Uses WASM instance types for complex fields. The new identity's id is
 * derived from the action nullifiers, so it is not part of the options.
 */
export interface IdentityCreateFromShieldedPoolTransitionOptions {
    publicKeys: IdentityPublicKeyInCreation[];
    denomination: bigint;
    actions: SerializedOrchardAction[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    sendToAddressOnCreationFailure: PlatformAddressLike;
}

/**
 * IdentityCreateFromShieldedPoolTransition serialized as a plain object.
 *
 * `sendToAddressOnCreationFailure` is the raw 21 bytes of a PlatformAddress
 * (type byte + 20-byte hash); the JSON form (below) carries the same value as
 * a hex string.
 */
export interface IdentityCreateFromShieldedPoolTransitionObject {
    $formatVersion: string;
    publicKeys: IdentityPublicKeyInCreationObject[];
    denomination: bigint;
    actions: SerializedOrchardActionObject[];
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
    sendToAddressOnCreationFailure: Uint8Array;
    identityId: Uint8Array;
}

/**
 * IdentityCreateFromShieldedPoolTransition serialized as JSON (human-readable).
 */
export interface IdentityCreateFromShieldedPoolTransitionJSON {
    $formatVersion: string;
    publicKeys: IdentityPublicKeyInCreationJSON[];
    denomination: number | string;
    actions: SerializedOrchardActionJSON[];
    anchor: string;
    proof: string;
    bindingSignature: string;
    sendToAddressOnCreationFailure: string;
    identityId: string;
}



/**
 * Options for constructing an IdentityTopUpFromShieldedPoolTransition (shielded pool to an
 * existing identity's balance). The bundle is an Orchard spend whose binding signature commits
 * to identityId and topUpAmount; there is no platform signature.
 */
export interface IdentityTopUpFromShieldedPoolTransitionOptions {
    identityId: IdentifierLike;
    actions: SerializedOrchardAction[];
    topUpAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

export interface IdentityTopUpFromShieldedPoolTransitionObject {
    $formatVersion: string;
    identityId: Uint8Array;
    actions: SerializedOrchardActionObject[];
    topUpAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

export interface IdentityTopUpFromShieldedPoolTransitionJSON {
    $formatVersion: string;
    identityId: string;
    actions: SerializedOrchardActionJSON[];
    topUpAmount: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
}



/**
 * Options for constructing an UnshieldTransition.
 */
export interface UnshieldTransitionOptions {
    outputAddress: PlatformAddressLike;
    actions: SerializedOrchardAction[];
    unshieldingAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * UnshieldTransition serialized as a plain object.
 *
 * `outputAddress` is the raw 21 bytes of a PlatformAddress (type byte + 20-byte hash);
 * the JSON form (below) carries the same value as a hex string.
 */
export interface UnshieldTransitionObject {
    $formatVersion: string;
    outputAddress: Uint8Array;
    actions: SerializedOrchardActionObject[];
    unshieldingAmount: bigint;
    anchor: Uint8Array;
    proof: Uint8Array;
    bindingSignature: Uint8Array;
}

/**
 * UnshieldTransition serialized as JSON (human-readable).
 */
export interface UnshieldTransitionJSON {
    $formatVersion: string;
    outputAddress: string;
    actions: SerializedOrchardActionJSON[];
    unshieldingAmount: number | string;
    anchor: string;
    proof: string;
    bindingSignature: string;
}



/**
 * Options for creating a BlockInfo instance.
 */
export interface BlockInfoOptions {
    timeMs: bigint;
    height: bigint;
    coreHeight: number;
    epochIndex: number;
}

/**
 * BlockInfo serialized as a plain object.
 */
export interface BlockInfoObject {
    timeMs: bigint;
    height: bigint;
    coreHeight: number;
    epochIndex: number;
}

/**
 * BlockInfo serialized as JSON.
 * u64 fields are numbers when within JS safe integer range, strings when exceeding it.
 */
export interface BlockInfoJSON {
    timeMs: number | string;
    height: number | string;
    coreHeight: number;
    epochIndex: number;
}



/**
 * Options for creating a GroupStateTransitionInfo instance.
 */
export interface GroupStateTransitionInfoOptions {
    groupContractPosition: number;
    actionId: IdentifierLike;
    isActionProposer?: boolean;
}



/**
 * Options for creating a PrefundedVotingBalance instance.
 */
export interface PrefundedVotingBalanceOptions {
    indexName: string;
    credits: bigint;
}



/**
 * Options for creating a new Document.
 */
export interface DocumentOptions {
    /** Document properties/data */
    properties: Record<string, unknown>;
    /** Document type name from the data contract */
    documentTypeName: string;
    /** Data contract ID this document belongs to */
    dataContractId: IdentifierLike;
    /** Owner identity ID */
    ownerId: IdentifierLike;
    /** Document revision (default: 1n) */
    revision?: bigint;
    /**
     * Document ID. Derived when not provided (see `identityContractNonce`).
     * Together with `identityContractNonce` it must equal the derived id, or
     * the constructor throws: the nonce fixes the id, and a different explicit
     * one could only be referenced, never created. Whatever is given here is
     * replaced by `new DocumentCreateTransition(...)`, which can only carry the
     * id consensus recomputes.
     */
    id?: IdentifierLike;
    /** Entropy bytes (32 bytes, auto-generated if not provided) */
    entropy?: Uint8Array;
    /**
     * Identity contract nonce the create transition of this document is going
     * to use. From protocol version 14 the id of a new document commits to
     * that nonce, so without it the derived `id` is a placeholder that
     * `new DocumentCreateTransition(...)` replaces (and mirrors back onto this
     * document). Pass the nonce here, or call `setIdForCreation`, to have the
     * final id from the start.
     */
    identityContractNonce?: bigint;
    /** Platform version the id is derived for (default: latest) */
    platformVersion?: PlatformVersionLike;
}

/**
 * Document serialized as a plain object.
 * Note: u64 fields are serialized as BigInt when using toObject().
 */
export interface DocumentObject {
    $id: Identifier;
    $ownerId: Identifier;
    $revision?: bigint;
    $createdAt?: bigint;
    $updatedAt?: bigint;
    $transferredAt?: bigint;
    $createdAtBlockHeight?: bigint;
    $updatedAtBlockHeight?: bigint;
    $transferredAtBlockHeight?: bigint;
    $createdAtCoreBlockHeight?: number;
    $updatedAtCoreBlockHeight?: number;
    $transferredAtCoreBlockHeight?: number;
    /** When a moderator last wrote the fields the document type keeps for its moderators */
    $moderatedAt?: bigint;
    /** The moderator who last wrote them */
    $moderatedBy?: Identifier;
    $dataContractId: Identifier;
    $type: string;
    [key: string]: unknown;
}

/**
 * Document serialized as JSON (with string identifiers).
 * Note: u64 fields are stringified since JSON doesn't support BigInt.
 */
export interface DocumentJSON {
    $id: string;
    $ownerId: string;
    $revision?: string;
    $createdAt?: string;
    $updatedAt?: string;
    $transferredAt?: string;
    $createdAtBlockHeight?: string;
    $updatedAtBlockHeight?: string;
    $transferredAtBlockHeight?: string;
    $createdAtCoreBlockHeight?: number;
    $updatedAtCoreBlockHeight?: number;
    $transferredAtCoreBlockHeight?: number;
    /** When a moderator last wrote the fields the document type keeps for its moderators */
    $moderatedAt?: string;
    /** The moderator who last wrote them */
    $moderatedBy?: string;
    $dataContractId: string;
    $type: string;
    [key: string]: unknown;
}



/**
 * Options for creating a new document on Dash Platform.
 */
export interface DocumentCreateOptions {
    /**
     * The document to create.
     * Use `new Document(...)` or `Document.fromJSON(...)` to construct it.
     * Must include dataContractId, documentTypeName, ownerId, and entropy.
     */
    document: Document;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.create.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The most, in credits, the document pays into the contest it joins when its
     * document type has a contested index. From protocol version 14 it is charged
     * the fund to join the contest, which doubles once the contest holds 250
     * contenders and again for every 50 more, and is refused, paid, when that is
     * more than this. The identity must hold what it states. Leave it out to state
     * the fund to join read just before the document is submitted. A document that
     * joins no contest ignores it.
     */
    contestFund?: bigint;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for creating a new identity on Dash Platform.
 */
export interface IdentityCreateOptions {
    /**
     * The identity to create (with public keys set up).
     * Use Identity.create() to build the identity structure first.
     */
    identity: Identity;

    /**
     * Asset lock proof from the Core chain.
     * Use AssetLockProof.createInstantAssetLockProof() or AssetLockProof.createChainAssetLockProof().
     */
    assetLockProof: AssetLockProof;

    /**
     * Private key for signing the asset lock proof.
     * This is the private key that controls the asset lock output.
     */
    assetLockPrivateKey: PrivateKey;

    /**
     * Signer containing private keys for the identity's public keys.
     * Use IdentitySigner to add keys for signing identity key proofs.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for creating an IdentityTopUpTransition instance.
 */
export interface IdentityTopUpTransitionOptions {
    assetLockProof: AssetLockProof;
    identityId: IdentifierLike;
    userFeeIncrease?: number;
}

/**
 * IdentityTopUpTransition serialized as a plain object.
 */
export interface IdentityTopUpTransitionObject {
    identityId: Uint8Array;
    assetLockProof: AssetLockProofObject;
    userFeeIncrease: number;
    signature?: Uint8Array;
}

/**
 * IdentityTopUpTransition serialized as JSON.
 */
export interface IdentityTopUpTransitionJSON {
    identityId: string;
    assetLockProof: AssetLockProofJSON;
    userFeeIncrease: number;
    signature?: string;
}



/**
 * Options for creating an identity funded from Platform addresses.
 */
export interface IdentityCreateFromAddressesOptions {
    /**
     * The identity to create (with public keys set up).
     * Use Identity.create() to build the identity structure first.
     */
    identity: Identity;

    /**
     * Array of input addresses with amounts to use for funding.
     * Use PlatformAddressInput for typed inputs (nonces fetched automatically).
     */
    inputs: PlatformAddressInput[];

    /**
     * Optional change output address and amount.
     * If provided, remaining credits will be sent to this address.
     */
    changeOutput?: PlatformAddressOutput;

    /**
     * Signer containing private keys for the identity's public keys.
     * Use IdentitySigner to add keys for signing identity key proofs.
     */
    identitySigner: IdentitySigner;

    /**
     * Signer containing private keys for all input addresses.
     * Use PlatformAddressSigner to add keys for signing address inputs.
     */
    addressSigner: PlatformAddressSigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for deleting a document from Dash Platform.
 */
export interface DocumentDeleteOptions {
    /**
     * The document to delete - either a Document instance or an object with identifiers.
     *
     * @example
     * // Using a Document instance
     * { document: myDocument, ... }
     *
     * // Using individual fields
     * { document: { id: "...", ownerId: "...", dataContractId: "...", documentTypeName: "note" }, ... }
     */
    document: Document | {
        id: IdentifierLike;
        ownerId: IdentifierLike;
        dataContractId: IdentifierLike;
        documentTypeName: string;
    };

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.delete.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for destroying a frozen identity's token balance.
 */
export interface TokenDestroyFrozenOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token authority performing the destruction.
     */
    authorityId: Identifier;

    /**
     * The frozen identity ID whose tokens will be destroyed.
     */
    frozenIdentityId: Identifier;

    /**
     * Optional public note for the destruction operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the authority's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed token destruction.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for directly purchasing tokens.
 */
export interface TokenDirectPurchaseOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID purchasing the tokens.
     */
    buyerId: Identifier;

    /**
     * The amount of tokens to purchase.
     */
    amount: bigint;

    /**
     * The maximum total credits the buyer is willing to pay.
     * The actual cost may be less if the token price is lower.
     */
    maxTotalCost: bigint;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the buyer's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for freezing an identity's token balance.
 */
export interface TokenFreezeOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token authority performing the freeze.
     */
    authorityId: Identifier;

    /**
     * The identity ID to freeze.
     */
    frozenIdentityId: Identifier;

    /**
     * Optional public note for the freeze operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the authority's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed token freezing.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for funding Platform addresses from an asset lock.
 */
export interface AddressFundingFromAssetLockOptions {
    /**
     * Asset lock proof from the Core chain.
     * Use AssetLockProof.createInstantAssetLockProof() or AssetLockProof.createChainAssetLockProof().
     */
    assetLockProof: AssetLockProof;

    /**
     * Private key for signing the asset lock proof.
     * This is the private key that controls the asset lock output.
     */
    assetLockPrivateKey: PrivateKey;

    /**
     * Array of output addresses with amounts to fund.
     * Use PlatformAddressOutput for typed outputs.
     */
    outputs: PlatformAddressOutput[];

    /**
     * Signer containing private keys for all output addresses.
     * Use PlatformAddressSigner to add keys before calling fund.
     */
    signer: PlatformAddressSigner;

    /**
     * Fee strategy defining how transaction fees are paid.
     * Array of FeeStrategyStep, each specifying to deduct from an input or reduce an output.
     * @default [FeeStrategyStep.deductFromInput(0)]
     */
    feeStrategy?: FeeStrategyStep[];

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for minting new tokens.
 */
export interface TokenMintOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The amount of tokens to mint.
     */
    amount: bigint;

    /**
     * The identity ID of the minter.
     */
    identityId: Identifier;

    /**
     * Optional recipient identity ID.
     * If not provided, mints to the minter's identity.
     */
    recipientId?: Identifier;

    /**
     * Optional public note for the mint operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the minter identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed token minting.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for moderating one identity on a moderated data contract (protocol version 14): all
 * an unban, an unsuspend and a clearWarnings take, and the base of the options of a ban, a
 * suspend and a warn. The signer must hold a CRITICAL authentication key without contract
 * bounds of the moderating identity: the contract owner, or a moderator the contract's config
 * names.
 */
export interface ContractModerationOptions {
    /** The moderating identity: the contract owner or a named moderator */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The identity to moderate */
    identityId: IdentifierLike;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/** Options for banning an identity: a ban needs a reason. */
export interface ContractBanOptions extends ContractModerationOptions {
    /** Why. Stored with the banlist entry, so anyone reading the list reads it. */
    reason: ContractModerationReason;
}

/** Options for suspending an identity: a suspension needs its end and a reason. */
export interface ContractSuspendOptions extends ContractModerationOptions {
    /** The block time, in milliseconds, at which the suspension lapses */
    until: bigint;
    /** Why. Stored with the suspension list entry, so anyone reading the list reads it. */
    reason: ContractModerationReason;
}

/** Options for warning an identity: a warning needs a reason. */
export interface ContractWarnOptions extends ContractModerationOptions {
    /** Why. Stored with the warning, so anyone reading the list reads it. */
    reason: ContractModerationReason;
}

/**
 * The moderated identity's status on the lists the moderation touched, as its proof shows it.
 * A ban proves every barring list the contract keeps (it removes a suspension too); an unban,
 * a suspend, an unsuspend, a warn and a clearWarnings prove the one list they edit and say
 * nothing about the others, so after an unsuspend `banned` is undefined (unknown), not false.
 * Use `getContractModerationStatus` for the identity's whole status.
 */
export interface ContractModerationResult {
    contractId: Identifier;
    identityId: Identifier;
    /** The lists the proof covers, the only ones this result describes */
    lists: ContractModerationListKind[];
    /** Set when `lists` includes `banlist`: the identity is on the banlist */
    banned?: boolean;
    /** When the identity is banned: why */
    banReason?: ContractModerationReason;
    /**
     * When `lists` includes `suspensions`: the block time, in milliseconds, until which the
     * identity is suspended; undefined when it is not suspended
     */
    suspendedUntil?: bigint;
    /** When the identity is suspended: why */
    suspensionReason?: ContractModerationReason;
    /**
     * When `lists` includes `warnings`: the identity's warnings, oldest first, an empty array
     * after a clearWarnings
     */
    warnings?: ContractWarning[];
}

/**
 * Options for deleting one document on a moderated data contract as a moderator (protocol
 * version 14), whoever owns it, except the contract owner and the moderators. The document
 * type must set `moderatorAbilities.delete`; when it also sets `moderatorAbilities.deleteWithin`,
 * the deletion passes up to and including that many seconds after the document's last
 * modification, and is refused (41116) once block time is later than that. The deletion
 * leaves a removal record unless the type sets `moderatorAbilities.deleteKeepsRecord: false`,
 * and refunds the document's owner only when it sets `moderatorAbilities.deleteRefundsOwner`.
 * As for the other moderations, the signer must hold a CRITICAL authentication key without
 * contract bounds of the moderating identity.
 */
export interface ContractDeleteDocumentOptions {
    /** The moderating identity: the contract owner or a named moderator */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The document type of the document */
    documentTypeName: string;
    /** The document to delete */
    documentId: IdentifierLike;
    /**
     * Why. Stored with the removal record, so anyone reading the records reads it. Both of its
     * parts are optional for a deletion: left out, no code and an empty text are stored.
     */
    reason?: ContractModerationReason;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/**
 * The record a document deletion left under the contract, as its proof shows it, or the same
 * record as a restore marked it. After a deletion the document is gone, its owner gets no
 * storage refund, and nothing ever deletes the record; the record holds a hash of the
 * document, so keep the document if the deletion may have to be undone. Use
 * `getContractDocumentRemovals` to read the records later.
 */
export interface ContractDocumentRemovalResult {
    contractId: Identifier;
    documentTypeName: string;
    documentId: Identifier;
    /** The identity that owned the document when it was removed */
    documentOwnerId: Identifier;
    /** The moderating identity */
    moderatorId: Identifier;
    /** Why, as it was stored */
    reason: ContractModerationReason;
    /** The time of the block that removed the document, in milliseconds */
    removedAt: bigint;
    /**
     * A double SHA-256 of the document as it was serialized under its type when it was removed,
     * as 64 hex characters: what a restore must bring back byte for byte
     */
    documentHash: string;
    /** The contract owner or moderator that restored the document; absent while the removal stands */
    restoredBy?: Identifier;
    /** The time of the block that restored it, in milliseconds; absent while the removal stands */
    restoredAt?: bigint;
    /**
     * The values the record keeps of the document, by the property path its type lists under
     * `moderatorAbilities.deleteKeepsFields`, shown as the document's `properties` show them:
     * what of it stays public once it is gone. Empty when the type keeps none; a path the
     * document held no value at is absent
     */
    keptFields: Record<string, unknown>;
}

/**
 * Options for proposing, as a member of an elected contract's seated moderation team, the
 * deletion of one settled document (protocol version 14): one last modified longer ago than
 * its type's `moderatorAbilities.deleteWithin` window, within which a moderator deletes it
 * alone. The type must say who of the team must approve (`moderatorAbilities.deleteSettled`,
 * else 41204), a team must be seated (41205), the signer must be on it (41101) with
 * `deleteDocuments` on the type (41201), and the document must be settled (41206). A member the
 * leader added proposes only the deletion of documents created after its addition (41212),
 * unless the type's rule sets `approversPredateDocument: false`. The proposal
 * is the proposer's own approval, kept under the contract as a team action with the document's
 * last modification and revision and the reason; the other members approve it by its
 * `actionId` with `contractApproveTeamAction` until the approvals meet the type's rule, the
 * leader among them if it says so, and the approval that meets it deletes the document as a
 * moderator's deletion does. A proposal never lapses, but an approval of a document changed
 * since the proposal is refused (41211). As for the other moderations, the signer must hold a
 * CRITICAL authentication key without contract bounds of the moderating identity.
 */
export interface ContractDeleteSettledDocumentOptions {
    /** The proposing identity: a member of the contract's seated moderation team */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The document type of the document */
    documentTypeName: string;
    /** The settled document to delete */
    documentId: IdentifierLike;
    /**
     * Why. Needed: it names a reason document the seated team's proposal lists (41203). Stored
     * with the team action and with the removal record the deletion leaves, so anyone reading
     * them reads it.
     */
    reason: ContractModerationReason;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/**
 * Options for approving, as a member of an elected contract's seated moderation team, a team
 * action another member proposed (protocol version 14): today the deletion of a settled
 * document, whose proposal (`contractDeleteSettledDocument`) returned the action's id, and
 * which `getContractTeamActions` lists. What the action does and why are the proposal's. An
 * action that does not exist (41207), one the signer already approved (41208), one already
 * closed (41210) or one whose document changed since the proposal (41211) is refused, and so is
 * a signer not on the seated team (41101) or without the authority the action needs (41201),
 * and a member the leader added no earlier than the document was created, unless the type's rule
 * sets `approversPredateDocument: false` (41212). The approvals of members who left the team
 * since no longer count, nor do those of members added again too late. As for the other
 * moderations, the signer must hold a CRITICAL authentication key without contract bounds of
 * the moderating identity.
 */
export interface ContractApproveTeamActionOptions {
    /** The approving identity: a member of the contract's seated moderation team */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The team action to approve, by the id its proposal returned */
    actionId: IdentifierLike;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/**
 * A team action as the proof of one member's proposal or approval of it shows it. `status` is
 * `active` while the approvals fall short of the rule, and `closed` once they met it and the
 * action ran: for the deletion of a settled document, the document is gone. Use
 * `getContractTeamActions` and `getContractTeamActionSigners` to read the action and its
 * approvals later.
 */
export interface ContractTeamActionSignatureResult {
    contractId: Identifier;
    /**
     * The action proposed or approved. For a proposal, the id the other members approve it by,
     * computed from the contract, the proposer, its contract nonce, the document and the reason,
     * so every proposal has its own
     */
    actionId: Identifier;
    status: ContractTeamActionStatus;
}

/**
 * Options for restoring, as a moderator, one document a moderator deleted (protocol version
 * 14): the document as it was, within a week of its deletion. Any current moderator or the
 * contract owner may restore, whoever deleted, except a deletion a seated team approved
 * together past the type's window (`deleteSettled`), which stands. The document goes back
 * through an ordinary insert, so a unique index value another document took meanwhile refuses
 * it (40105); a document with no removal record (41119), one restored already (41122), a
 * restore past the week (41120), a document that is not the one deleted (41121) or one the
 * seated team deleted together (41209) are refused too. The signer
 * pays for the document's storage; the refund of a later deletion stays its owner's. As for
 * the other moderations, the signer must hold a CRITICAL authentication key without contract
 * bounds of the moderating identity.
 */
export interface ContractRestoreDocumentOptions {
    /** The moderating identity: the contract owner or a named moderator */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The document type of the document */
    documentTypeName: string;
    /**
     * The document to bring back, as it was when it was deleted: the document as fetched before
     * the deletion. It is serialized under the contract's current document type and must hash
     * to what its removal record holds.
     */
    document: Document;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/**
 * Options for changing, as a moderator, the fields a document type keeps for its moderators
 * (`moderatorAbilities.changeFields`, protocol version 14) on one of its documents, whoever
 * owns it. Every other property, `$updatedAt` among them, stays as its owner wrote it, and
 * `$revision` goes up by one. A field the type does not keep for its moderators is refused
 * (41123), and so is a signer that does not moderate the contract (41101), a seated team
 * without `changeDocumentFields` on the type (41201), and a change that leaves the document
 * outside its schema, its `propertyConstraints` or its unique indexes. The signer pays for the
 * bytes the change adds. As for the other moderations, the signer must hold a CRITICAL
 * authentication key without contract bounds of the moderating identity.
 */
export interface ContractChangeDocumentFieldsOptions {
    /** The moderating identity: the contract owner, a named moderator or a seated team's member */
    identity: Identity;
    /** The moderated contract */
    contractId: IdentifierLike;
    /** The document type of the document */
    documentTypeName: string;
    /** The document to change */
    documentId: IdentifierLike;
    /**
     * Each field to set, by its top-level property name, `null` removing it. Values are read as
     * the document type's properties are: an identifier as a base58 string, bytes as base64.
     */
    fields: Record<string, unknown>;
    /**
     * Why. A seated team names a reason document its proposal lists; both parts are otherwise
     * optional, and left out, no code and an empty text are sent.
     */
    reason?: ContractModerationReason;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}



/**
 * Options for paying out a fee pot of a data contract (protocol version 14). The signer must
 * hold a CRITICAL authentication key without contract bounds of the claiming identity: the
 * contract owner for the owner pot, any member of the contract's moderation team for the
 * moderators pot.
 */
export interface ContractClaimFeesOptions {
    /** The claiming identity */
    identity: Identity;
    /** The contract whose pot is paid out */
    contractId: IdentifierLike;
    /** The pot to pay out */
    pot: ContractFeePotKind;
    /** Signer holding a CRITICAL authentication key without contract bounds of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}

/** A fee pot after a claim, as the proof of the claim shows it. */
export interface ContractClaimFeesResult {
    contractId: Identifier;
    pot: ContractFeePotKind;
    /** The epoch the pot was last paid out in: the epoch of this claim, unless it was claimed again since */
    lastClaimEpoch: number;
    /** The time, in milliseconds, of the block that last paid the pot out */
    lastClaimTimeMs: bigint;
    /** The identity that signed the last claim of the pot: the claiming identity, unless it was claimed again since */
    lastClaimantId: Identifier;
    /** The credits left in the pot: what the split left over, and any fee collected since */
    remainingCredits: bigint;
    /**
     * The balance, after the claim, of every identity the contract names as a recipient of the
     * pot, keyed by base58 identity id; for a claim by a member of an elected contract's seated
     * team, which the contract does not name, the claimant's balance alone
     */
    balances: Map<string, bigint>;
}



/**
 * Options for performing an emergency action (pause/resume) on a token.
 */
export interface TokenEmergencyActionOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token authority performing the action.
     */
    authorityId: Identifier;

    /**
     * The emergency action to perform: "pause" or "resume".
     */
    action: "pause" | "resume";

    /**
     * Optional public note for the emergency action.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the authority's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed emergency actions.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for publishing a new data contract on Dash Platform.
 */
export interface ContractPublishOptions {
    /**
     * The data contract to create.
     * Use `new DataContract(...)` or `DataContract.fromJSON(...)` to construct it.
     */
    dataContract: DataContract;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for purchasing a document that has a price set.
 */
export interface DocumentPurchaseOptions {
    /**
     * The document to purchase.
     * Must include id, ownerId, dataContractId, documentTypeName, and revision.
     */
    document: Document;

    /**
     * The buyer's identity ID.
     */
    buyerId: Identifier;

    /**
     * The purchase price in credits.
     * Must match the document's listed price.
     */
    price: bigint;

    /**
     * The public key to use for signing the transition.
     * Get this from the buyer identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.purchase.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for raising the limits of one of an identity's authentication keys
 * (protocol version 14). At least one of addBudget and expiresAt must be given.
 */
export interface IdentityKeyLimitsUpdateOptions {
    /** The identity holding the key: the new total is computed from the key as it holds it */
    identity: Identity;
    /** The key whose limits are raised */
    keyId: number;
    /** Credits added to the key's total budget, and to what is left of it */
    addBudget?: bigint;
    /** The new expiry of the key in milliseconds, later than its current one */
    expiresAt?: bigint;
    /** Signer holding a MASTER key, or a CRITICAL authentication key without limits and without contract bounds, of the identity */
    signer: IdentitySigner;
    /** Optional broadcast settings */
    settings?: PutSettings;
}



/**
 * Options for registering a DPNS username on Dash Platform.
 */
export interface DpnsRegisterNameOptions {
    /**
     * The username label to register (without the .dash suffix).
     * Must be a valid DPNS username (3-63 characters, alphanumeric and hyphens).
     */
    label: string;

    /**
     * The identity that will own the username.
     * Fetch the identity first using `getIdentity()`.
     */
    identity: Identity;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional callback called after the preorder document is submitted.
     * Receives the preorder Document object.
     */
    preorderCallback?: (preorderDocument: Document) => void;

    /**
     * The most, in credits, the registration pays into the contest a contested
     * name joins. From protocol version 14 it is charged the fund to join the
     * contest, which doubles once the contest holds 250 contenders and again
     * for every 50 more, and is refused, paid, when that is more than this.
     * The identity must hold what it states. Leave it out to state the fund to
     * join read just before the domain is submitted.
     */
    contestFund?: bigint;
}



/**
 * Options for replacing an existing document on Dash Platform.
 */
export interface DocumentReplaceOptions {
    /**
     * The document with updated data.
     * Must have the same ID as the existing document.
     * Revision should be set to current revision + 1.
     */
    document: Document;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.replace.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for setting a price on a document to enable purchases.
 */
export interface DocumentSetPriceOptions {
    /**
     * The document to set a price on.
     * Must include id, ownerId, dataContractId, documentTypeName, and revision.
     */
    document: Document;

    /**
     * The price in credits.
     * Set to 0 to remove the price and make the document not for sale.
     */
    price: bigint;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.update_price.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for setting the price of a token for direct purchase.
 */
export interface TokenSetPriceOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token authority setting the price.
     */
    authorityId: Identifier;

    /**
     * The flat price in credits for one token (SinglePrice schedule).
     * Set to null to disable direct purchases.
     * Mutually exclusive with `priceTiers`.
     */
    price?: bigint | null;

    /**
     * Tiered direct-purchase pricing (SetPrices schedule).
     *
     * Maps the minimum bulk-buy amount (token amount, as a string key)
     * to the per-token price in credits for that tier. Keys are unsigned
     * integers encoded as strings; values are credit amounts as bigint.
     *
     * Example: `{ "1": 1_000n, "100": 900n, "1000": 800n }` charges 1000
     * credits/token for purchases of 1+, 900 for purchases of 100+, and
     * 800 for purchases of 1000+.
     *
     * Mutually exclusive with `price`. Must contain at least one entry.
     */
    priceTiers?: Record<string, bigint>;

    /**
     * Optional public note for the price change.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the authority's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed price changes.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for submitting a masternode vote for a contested resource.
 */
export interface MasternodeVoteOptions {
    /**
     * The ProTxHash of the masternode: an Identifier, its 32 bytes, the hex Core's RPC shows,
     * or base58.
     */
    masternodeProTxHash: IdentifierLike;

    /**
     * The vote poll to vote on.
     * Use VotePoll.createContestedDocumentResourceVotePoll() to create.
     */
    votePoll: VotePoll;

    /**
     * The vote choice.
     * Use ResourceVoteChoice.towardsIdentity(), ResourceVoteChoice.abstain(), or ResourceVoteChoice.lock().
     */
    voteChoice: ResourceVoteChoice;

    /**
     * The masternode's voting public key.
     * This should be the voting key associated with the masternode.
     */
    votingKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the masternode's voting key.
     * Use IdentitySigner to add the voting key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for topping up an identity from Platform addresses.
 */
export interface IdentityTopUpFromAddressesOptions {
    /**
     * The identity to top up.
     */
    identity: Identity;

    /**
     * Array of input addresses with amounts to use for top up.
     * Use PlatformAddressInput for typed inputs (nonces fetched automatically).
     */
    inputs: PlatformAddressInput[];

    /**
     * Signer containing private keys for all input addresses.
     * Use PlatformAddressSigner to add keys before calling top up.
     */
    signer: PlatformAddressSigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for topping up an identity with additional credits.
 */
export interface IdentityTopUpOptions {
    /**
     * The identity to top up.
     */
    identity: Identity;

    /**
     * Asset lock proof from the Core chain.
     * Use AssetLockProof.createInstantAssetLockProof() or AssetLockProof.createChainAssetLockProof().
     */
    assetLockProof: AssetLockProof;

    /**
     * Private key for signing the asset lock proof.
     * This is the private key that controls the asset lock output.
     */
    assetLockPrivateKey: PrivateKey;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for transferring a document to another identity.
 */
export interface DocumentTransferOptions {
    /**
     * The document to transfer.
     * Must include id, ownerId, dataContractId, documentTypeName, and revision.
     */
    document: Document;

    /**
     * The new owner's identity ID.
     */
    recipientId: Identifier;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional token payment agreement for document types with tokenCost.transfer.
     */
    tokenPaymentInfo?: DocumentTokenPaymentInfo;

    /**
     * The action fee the signer agrees to pay, as the contract shown to the user
     * declares it. Required when the document type's `actionFees` charge for this
     * action (protocol version 14+). `DocumentActionFeeAgreement.forDocumentTypeAction`
     * builds it from that contract.
     */
    actionFeeAgreement?: DocumentActionFeeAgreement;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for transferring credits from an identity to Platform addresses.
 */
export interface IdentityTransferToAddressesOptions {
    /**
     * The identity to transfer credits from.
     */
    identity: Identity;

    /**
     * Array of output addresses with amounts to receive.
     * Use PlatformAddressOutput for typed outputs.
     */
    outputs: PlatformAddressOutput[];

    /**
     * Signer containing the private key(s) for signing with identity transfer key(s).
     * Use IdentitySigner to add keys before calling transfer.
     */
    signer: IdentitySigner;

    /**
     * Optional key ID to use for signing.
     * If not specified, will auto-select a matching transfer key.
     */
    signingTransferKeyId?: number;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for transferring credits from one identity to another.
 */
export interface IdentityCreditTransferOptions {
    /**
     * The sender identity.
     */
    identity: Identity;

    /**
     * The identity ID of the recipient.
     */
    recipientId: IdentifierLike;

    /**
     * The amount of credits to transfer.
     */
    amount: bigint;

    /**
     * Signer containing the private key for the sender's transfer key.
     * Use IdentitySigner to add the transfer key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional identity public key to use for signing.
     * If not provided, auto-selects an available transfer key.
     */
    signingKey?: IdentityPublicKey;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for transferring funds between Platform addresses.
 */
export interface AddressFundsTransferOptions {
    /**
     * Array of input addresses with amounts to spend.
     * Use PlatformAddressInput for typed inputs (nonces fetched automatically).
     */
    inputs: PlatformAddressInput[];

    /**
     * Array of output addresses with amounts to receive.
     * Use PlatformAddressOutput for typed outputs.
     */
    outputs: PlatformAddressOutput[];

    /**
     * Signer containing private keys for all input addresses.
     * Use PlatformAddressSigner to add keys before calling transfer.
     */
    signer: PlatformAddressSigner;

    /**
     * Fee strategy defining how transaction fees are paid.
     * Array of FeeStrategyStep, each specifying to deduct from an input or reduce an output.
     * @default [FeeStrategyStep.deductFromInput(0)]
     */
    feeStrategy?: FeeStrategyStep[];

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for transferring tokens between identities.
 */
export interface TokenTransferOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The amount of tokens to transfer.
     */
    amount: bigint;

    /**
     * The sender's identity ID.
     */
    senderId: Identifier;

    /**
     * The recipient's identity ID.
     */
    recipientId: Identifier;

    /**
     * Optional public note for the transfer.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the sender's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for unfreezing an identity's token balance.
 */
export interface TokenUnfreezeOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token authority performing the unfreeze.
     */
    authorityId: Identifier;

    /**
     * The identity ID to unfreeze.
     */
    frozenIdentityId: Identifier;

    /**
     * Optional public note for the unfreeze operation.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key for the authority's authentication key.
     * Use IdentitySigner to add the authentication key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed token unfreezing.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for updating a token's configuration.
 */
export interface TokenConfigUpdateOptions {
    /**
     * The ID of the data contract containing the token.
     */
    dataContractId: Identifier;

    /**
     * The position of the token in the contract (0-indexed).
     */
    tokenPosition: number;

    /**
     * The identity ID of the token owner performing the update.
     */
    identityId: Identifier;

    /**
     * The configuration change to apply.
     * Use TokenConfigurationChangeItem static methods to create this value.
     */
    configurationChangeItem: TokenConfigurationChangeItem;

    /**
     * Optional public note for the config update.
     */
    publicNote?: string;

    /**
     * The identity public key to use for signing the transition.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional group action info for group-managed config updates.
     * Use GroupStateTransitionInfoStatus.proposer() to propose a new group action,
     * or GroupStateTransitionInfoStatus.otherSigner() to vote on an existing action.
     */
    groupInfo?: GroupStateTransitionInfoStatus;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for updating an existing data contract on Dash Platform.
 */
export interface ContractUpdateOptions {
    /**
     * The updated data contract.
     * Use the existing contract and modify it, or create a new one with
     * `DataContract.fromJSON(...)`. Version must be incremented.
     */
    dataContract: DataContract;

    /**
     * The identity public key to use for signing the transition.
     * Get this from the owner identity's public keys.
     */
    identityKey: IdentityPublicKey;

    /**
     * Signer containing the private key that corresponds to the identity key.
     * Use IdentitySigner to add the private key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for updating an identity (adding or disabling public keys).
 */
export interface IdentityUpdateOptions {
    /**
     * The identity to update.
     */
    identity: Identity;

    /**
     * Array of public keys to add to the identity.
     * Use IdentityPublicKeyInCreation to create new keys. A key built with `totalBudget` or
     * `expiresAt` is registered with those limits (protocol version 14); the signer must hold
     * its private key as well as the master key, since a new key signs its own registration.
     */
    addPublicKeys?: IdentityPublicKeyInCreation[];

    /**
     * Array of key IDs to disable.
     * Cannot disable master, critical auth, or transfer keys.
     */
    disablePublicKeys?: number[];

    /**
     * Signer containing the private key for the identity's master key.
     * Use IdentitySigner to add the master key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for withdrawing Platform address credits to Core (L1).
 */
export interface AddressFundsWithdrawOptions {
    /**
     * Array of input addresses with amounts to withdraw.
     * Use PlatformAddressInput for typed inputs (nonces fetched automatically).
     */
    inputs: PlatformAddressInput[];

    /**
     * Optional change output address and amount.
     * If provided, specifies where to send any change from the withdrawal.
     */
    changeOutput?: PlatformAddressOutput;

    /**
     * Fee strategy defining how transaction fees are paid.
     * Array of FeeStrategyStep, each specifying to deduct from an input or reduce an output.
     * @default [FeeStrategyStep.deductFromInput(0)]
     */
    feeStrategy?: FeeStrategyStep[];

    /**
     * Core (L1) fee per byte for the withdrawal transaction.
     * This determines the mining fee for the Core blockchain transaction.
     */
    coreFeePerByte: number;

    /**
     * Pooling strategy for the withdrawal.
     * - Pooling.Never: Create individual withdrawal transaction
     * - Pooling.IfAvailable: Join pool if available, otherwise individual
     * - Pooling.Standard: Wait to join pool (may take longer)
     */
    pooling: Pooling;

    /**
     * Core output script specifying the L1 destination address.
     * Use CoreScript.newP2PKH() or CoreScript.newP2SH() to create.
     */
    outputScript: CoreScript;

    /**
     * Signer containing private keys for all input addresses.
     * Use PlatformAddressSigner to add keys before calling withdraw.
     */
    signer: PlatformAddressSigner;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * Options for withdrawing credits from an identity to a Dash address.
 */
export interface IdentityCreditWithdrawalOptions {
    /**
     * The identity to withdraw from.
     */
    identity: Identity;

    /**
     * The amount of credits to withdraw.
     */
    amount: bigint;

    /**
     * Optional Dash address to send the withdrawn credits to.
     */
    toAddress?: string;

    /**
     * Core (L1) fee per byte for the withdrawal transaction.
     * This determines the mining fee for the Core blockchain transaction.
     * @default 1
     */
    coreFeePerByte?: number;

    /**
     * Signer containing the private key for the identity's transfer/owner key.
     * Use IdentitySigner to add the key before calling.
     */
    signer: IdentitySigner;

    /**
     * Optional identity public key to use for signing.
     * If not provided, auto-selects a matching transfer or owner key.
     */
    signingKey?: IdentityPublicKey;

    /**
     * Optional settings for the broadcast operation.
     * Includes retries, timeouts, userFeeIncrease, etc.
     */
    settings?: PutSettings;
}



/**
 * OutPoint serialized as a plain object.
 */
export interface OutPointObject {
    txid: string;
    vout: number;
}

/**
 * OutPoint serialized as JSON.
 */
export interface OutPointJSON {
    txid: string;
    vout: number;
}



/**
 * Pays out one of the two fee pots a data contract's document action fees collect in (protocol
 * version 14). The owner pot goes to the contract owner, who alone may claim it; the moderators
 * pot is split equally between the contract's moderation team, and any member may claim it. A
 * pot is paid out at most once per epoch. Signed with a CRITICAL authentication key, under the
 * signer's contract-scoped nonce.
 */
export interface ContractFeeClaimTransitionOptions {
    /** The claimant that signs */
    ownerId: IdentifierLike;
    /** The contract whose pot is paid out */
    dataContractId: IdentifierLike;
    /** The signer's nonce for the contract */
    identityContractNonce: bigint;
    /** The pot that is paid out */
    pot: "owner" | "moderators";
    userFeeIncrease?: number;
}

/**
 * ContractFeeClaim serialized as a plain object.
 */
export interface ContractFeeClaimObject {
    $formatVersion: string;
    ownerId: Uint8Array;
    dataContractId: Uint8Array;
    identityContractNonce: bigint;
    pot: string;
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * ContractFeeClaim serialized as JSON.
 */
export interface ContractFeeClaimJSON {
    $formatVersion: string;
    ownerId: string;
    dataContractId: string;
    identityContractNonce: number | string;
    pot: string;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



/**
 * Query configuration for contested resource listings.
 */
export interface VotePollsByDocumentTypeQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Document type to query.
     */
    documentTypeName: string;

    /**
     * Index name to query.
     */
    indexName: string;

    /**
     * Optional lower bound for index range, commonly an array of composite values.
     * @default undefined
     */
    startIndexValues?: unknown[];

    /**
     * Optional upper bound for index range, commonly an array of composite values.
     * @default undefined
     */
    endIndexValues?: unknown[];

    /**
     * Cursor value to resume iteration from.
     * Provide a JS value matching the index schema (e.g., string, number, array).
     * @default undefined
     */
    startAtValue?: unknown;

    /**
     * Whether to include `startAtValue` in the result set.
     * @default true
     */
    startAtValueIncluded?: boolean;

    /**
     * Maximum number of records to return.
     * @default undefined (no explicit limit)
     */
    limit?: number;

    /**
     * Sort order. When omitted, the query defaults to ascending order.
     * @default true
     */
    orderAscending?: boolean;
}



/**
 * Query configuration for contested resource vote state.
 */
export interface ContestedResourceVoteStateQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Contested document type name.
     */
    documentTypeName: string;

    /**
     * Index name to query.
     */
    indexName: string;

    /**
     * Optional index values used as query parameters.
     * @default undefined
     */
    indexValues?: unknown[];

    /**
     * Result projection type.
     * @default 'documentsAndVoteTally'
     */
    resultType?: 'documents' | 'voteTally' | 'documentsAndVoteTally';

    /**
     * Maximum number of records to return.
     * @default undefined (no explicit limit)
     */
    limit?: number;

    /**
     * Contender identifier to resume from (exclusive by default).
     * @default undefined
     */
    startAtContenderId?: IdentifierLike

    /**
     * Include the start contender when true.
     * @default true
     */
    startAtIncluded?: boolean;

    /**
     * Include locked and abstaining tallies when true.
     * @default false
     */
    includeLockedAndAbstaining?: boolean;
}



/**
 * Query parameters for fetching contested resource votes cast by an identity.
 */
export interface ContestedResourceIdentityVotesQuery {
    /**
     * Identity identifier.
     */
    identityId: IdentifierLike

    /**
     * Maximum number of votes to return.
     * @default undefined (no explicit limit)
     */
    limit?: number;

    /**
     * Vote identifier to resume from (exclusive by default).
     * @default undefined
     */
    startAtVoteId?: IdentifierLike

    /**
     * Include the `startAtVoteId` when true.
     * @default true
     */
    startAtIncluded?: boolean;

    /**
     * Sort order. When omitted, defaults to ascending.
     * @default true
     */
    orderAscending?: boolean;
}



/**
 * Query parameters for fetching identities' public keys for a contract.
 */
export interface IdentitiesContractKeysQuery {
    /**
     * Identity identifiers to fetch keys for.
     */
    identityIds: Array<IdentifierLike>;

    /**
     * Data contract identifier (reserved for future filtering).
     */
    contractId: IdentifierLike;

    /**
     * Optional list of purposes to include.
     * @default undefined
     */
    purposes?: number[];
}



/**
 * Query parameters for fetching voters of a contested resource.
 */
export interface ContestedResourceVotersForIdentityQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Contested document type name.
     */
    documentTypeName: string;

    /**
     * Index name used to locate the contested resource.
     */
    indexName: string;

    /**
     * Optional index values used as query arguments.
     * @default undefined
     */
    indexValues?: unknown[];

    /**
     * Contested identity identifier.
     */
    contestantId: IdentifierLike

    /**
     * Maximum number of voters to return.
     * @default undefined (no explicit limit)
     */
    limit?: number;

    /**
     * Voter identifier to resume from (exclusive by default).
     * @default undefined
     */
    startAtVoterId?: IdentifierLike

    /**
     * Include the `startAtVoterId` when true.
     * @default true
     */
    startAtIncluded?: boolean;

    /**
     * Sort order. When omitted, defaults to ascending.
     * @default true
     */
    orderAscending?: boolean;
}



/**
 * Query parameters for one page of the contract enumeration (`getDataContractsByRange`).
 *
 * Pages are ordered by ascending contract id. Pass `{}` for the first page, then the last
 * key of each page as `startAfter` until a page comes back shorter than `limit`.
 */
export interface DataContractsByRangeQuery {
    /**
     * Maximum number of contracts in the page, 1..=100.
     * @default 100
     */
    limit?: number;

    /**
     * Contract id to resume after (exclusive). Mutually exclusive with `startAt`.
     * @default undefined
     */
    startAfter?: IdentifierLike;

    /**
     * Contract id to start at (inclusive). Mutually exclusive with `startAfter`.
     * @default undefined
     */
    startAt?: IdentifierLike;

    /**
     * Return contract ids only: every map value is `undefined` and the proof is much smaller.
     * @default false
     */
    idsOnly?: boolean;
}



/**
 * Query parameters for retrieving DPNS usernames.
 */
export interface DpnsUsernamesQuery {
    /**
     * Identity to fetch usernames for.
     */
    identityId: IdentifierLike;

    /**
     * Maximum number of usernames to return. Use 0 for default.
     * @default 10
     */
    limit?: number;
}



/**
 * Query parameters for retrieving data contract history.
 */
export interface DataContractHistoryQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Maximum number of entries to return.
     * @default undefined
     */
    limit?: number;

    /**
     * Millisecond timestamp (inclusive) to start from.
     * @default 0
     */
    startAtMs?: number;
}



/**
 * Query parameters for retrieving epoch information.
 */
export interface EpochsQuery {
    /**
     * Starting epoch index.
     * @default undefined (uses platform default)
     */
    startEpoch?: number;

    /**
     * Maximum number of epochs to return.
     * @default undefined
     */
    count?: number;

    /**
     * Sort order for returned epochs.
     * @default true
     */
    ascending?: boolean;
}



/**
 * Query parameters for retrieving finalized epoch information.
 */
export interface FinalizedEpochsQuery {
    /**
     * Starting epoch index (required).
     */
    startEpoch: number;

    /**
     * Maximum number of epochs to return.
     * @default 100
     */
    count?: number;

    /**
     * Sort order for returned epochs.
     * @default true
     */
    ascending?: boolean;
}



/**
 * Query parameters for retrieving group members.
 */
export interface GroupMembersQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Group position inside the contract.
     */
    groupContractPosition: number;

    /**
     * Optional list of member IDs to retrieve. When provided, pagination options are ignored.
     * @default undefined
     */
    memberIds?: Array<Identifier | Uint8Array | string>;

    /**
     * Member identifier to resume from.
     * @default undefined
     */
    startAtMemberId?: IdentifierLike

    /**
     * Maximum number of members to return when not requesting specific IDs.
     * @default undefined
     */
    limit?: number;
}



/**
 * Query parameters for retrieving groups that an identity participates in.
 */
export interface IdentityGroupsQuery {
    /**
     * Identity identifier.
     */
    identityId: IdentifierLike

    /**
     * Data contracts where the identity participates as a member.
     * @default undefined
     */
    memberDataContracts?: Array<Identifier | Uint8Array | string>;

    /**
     * Data contracts where the identity participates as an owner.
     * (Currently not implemented server-side.)
     * @default undefined
     */
    ownerDataContracts?: Array<Identifier | Uint8Array | string>;

    /**
     * Data contracts where the identity participates as a moderator.
     * (Currently not implemented server-side.)
     * @default undefined
     */
    moderatorDataContracts?: Array<Identifier | Uint8Array | string>;
}



/**
 * Query parameters for retrieving proposed block counts by range for an epoch.
 */
export interface EvonodeProposedBlocksRangeQuery {
    /**
     * Epoch index to query.
     */
    epoch: number;

    /**
     * Maximum number of items to return.
     * @default undefined
     */
    limit?: number;

    /**
     * ProTxHash to resume from (exclusive by default).
     * @default undefined
     */
    startAfter?: ProTxHashLike;
}



/**
 * Query parameters for retrieving signers of a group action.
 */
export interface GroupActionSignersQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Position of the group within the contract.
     */
    groupContractPosition: number;

    /**
     * Action status filter.
     */
    status: GroupActionStatusFilter;

    /**
     * Group action identifier.
     */
    actionId: IdentifierLike
}



/**
 * Query parameters for retrieving vote polls grouped by end date.
 */
export interface VotePollsByEndDateQuery {
    /**
     * Starting timestamp (milliseconds) to filter polls. Accepts the
     * `timestampMs` bigint of a returned entry, for paging.
     * @default undefined
     */
    startTimeMs?: number | bigint;

    /**
     * Include the `startTimeMs` boundary when true.
     * @default true
     */
    startTimeIncluded?: boolean;

    /**
     * Ending timestamp (milliseconds) to filter polls.
     * @default undefined
     */
    endTimeMs?: number | bigint;

    /**
     * Include the `endTimeMs` boundary when true.
     * @default true
     */
    endTimeIncluded?: boolean;

    /**
     * Maximum number of buckets to return.
     * @default undefined (no explicit limit)
     */
    limit?: number;

    /**
     * Offset into the paginated result set.
     * @default undefined
     */
    offset?: number;

    /**
     * Sort order for timestamps; ascending by default.
     * @default true
     */
    orderAscending?: boolean;
}



/**
 * Query parameters for the current versions of data contracts
 * (`getDataContractsLatestVersions`): the cheap check that contracts held locally are still
 * current.
 */
export interface DataContractsLatestVersionsQuery {
    /**
     * Data contract identifiers, at least one and at most 100.
     */
    contractIds: IdentifierLike[]

    /**
     * Also return the contracts. Off by default: the query exists to learn the versions without
     * transferring the contracts.
     * @default false
     */
    includeContracts?: boolean;
}



/**
 * Raises the limits of one of the identity's authentication keys: the new total budget and the
 * new expiry are absolute values, each greater than the one the key holds, and at least one of
 * them must be given. No identity revision is claimed.
 */
export interface IdentityKeyLimitsUpdateTransitionOptions {
    identityId: IdentifierLike;
    nonce: bigint;
    keyId: number;
    totalBudget?: bigint;
    expiresAt?: bigint;
    userFeeIncrease?: number;
}

/**
 * IdentityKeyLimitsUpdate serialized as a plain object.
 */
export interface IdentityKeyLimitsUpdateObject {
    identityId: Uint8Array;
    nonce: bigint;
    keyId: number;
    totalBudget?: bigint;
    expiresAt?: bigint;
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * IdentityKeyLimitsUpdate serialized as JSON.
 */
export interface IdentityKeyLimitsUpdateJSON {
    identityId: string;
    nonce: number | string;
    keyId: number;
    totalBudget?: number | string;
    expiresAt?: number | string;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



/**
 * Registration of a contract group, carried by a version 1 DataContractCreateTransition.
 * The owner is the transition's signer and is not part of the object; `admins` are the
 * identities that may add members alongside the owner.
 */
export interface ContractGroupRegistrationObject {
    admins?: Uint8Array[];
    name?: string;
    description?: string;
}

/**
 * ContractGroupRegistrationObject serialized as JSON (identifiers as base58 strings).
 */
export interface ContractGroupRegistrationJSON {
    admins?: string[];
    name?: string;
    description?: string;
}

/**
 * Which part of the created contract joins a contract group.
 */
export type ContractGroupMemberObject = "contract" | { documentType: string } | { token: number };

/**
 * A declaration that a part of the created contract joins a contract group.
 */
export interface ContractGroupMembershipObject {
    contractGroupId: Uint8Array;
    member: ContractGroupMemberObject;
}

/**
 * ContractGroupMembershipObject serialized as JSON (identifiers as base58 strings).
 */
export interface ContractGroupMembershipJSON {
    contractGroupId: string;
    member: ContractGroupMemberObject;
}

/**
 * DataContractCreateTransition serialized as a plain object. Version 1 (protocol version 14)
 * adds `contractGroup` and `contractGroupMemberships`; both are absent on version 0 and
 * optional on version 1.
 */
export interface DataContractCreateTransitionObject {
    $formatVersion?: string;
    dataContract: DataContractObject;
    identityNonce: bigint;
    contractGroup?: ContractGroupRegistrationObject | null;
    contractGroupMemberships?: ContractGroupMembershipObject[];
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature?: Uint8Array;
}

/**
 * DataContractCreateTransition serialized as JSON.
 */
export interface DataContractCreateTransitionJSON {
    $formatVersion?: string;
    dataContract: DataContractJSON;
    identityNonce: string;
    contractGroup?: ContractGroupRegistrationJSON | null;
    contractGroupMemberships?: ContractGroupMembershipJSON[];
    userFeeIncrease: number;
    signaturePublicKeyId: number;
    signature?: string;
}



/**
 * Requested key selection strategy.
 */
export type IdentityKeysRequest =
| {
    /**
     * Fetch all keys associated with the identity.
     */
    type: 'all';
}
| {
    /**
     * Fetch only the provided key identifiers.
     */
    type: 'specific';

    /**
     * Public key identifiers to return.
     */
    specificKeyIds: number[];
}
| {
    /**
     * Search keys by purpose and security level requirements.
     */
    type: 'search';

    /**
     * Purpose → security level selector map.
     */
    purposeMap: IdentityKeysPurposeMap;
};

/**
 * Purpose to security level search map.
 */
export type IdentityKeysPurposeMap = {
    [purpose: number]: {
        [securityLevel: number]: IdentityKeysSearchKind;
    };
};

/**
 * Which keys should be returned for a purpose/security level pairing.
 */
export type IdentityKeysSearchKind = 'current' | 'all';

/**
 * Query parameters for fetching identity public keys.
 */
export interface IdentityKeysQuery {
    /**
     * Identity identifier.
     */
    identityId: IdentifierLike

    /**
     * Requested key selection strategy.
     */
    request: IdentityKeysRequest;

    /**
     * Maximum number of keys to return after applying request filters.
     * @default undefined (no additional limit)
     */
    limit?: number;

    /**
     * Number of keys to skip from the beginning of the result set.
     * @default undefined
     */
    offset?: number;
}



/**
 * ResourceVote serialized as a plain object.
 */
export interface ResourceVoteObject {
    $formatVersion: string;
    votePoll: VotePollObject;
    resourceVoteChoice: ResourceVoteChoiceObject;
}

/**
 * ResourceVote serialized as JSON.
 */
export interface ResourceVoteJSON {
    $formatVersion: string;
    votePoll: VotePollJSON;
    resourceVoteChoice: ResourceVoteChoiceJSON;
}



/**
 * ResourceVoteChoice serialized as a plain object.
 *
 * Custom Serialize emits a flat `{type, identity?}` shape — `identity`
 * (synthesized name) carries the inner Identifier for the TowardsIdentity
 * variant.
 */
export type ResourceVoteChoiceObject =
| { $type: "towardsIdentity"; identity: Uint8Array }
| { $type: "abstain" }
| { $type: "lock" };

/**
 * ResourceVoteChoice serialized as JSON.
 */
export type ResourceVoteChoiceJSON =
| { $type: "towardsIdentity"; identity: string }
| { $type: "abstain" }
| { $type: "lock" };



/**
 * Settings for SDK query/request operations.
 */
export interface RequestSettings {
    /**
     * Number of retries for the request.
     * @default 5
     */
    retries?: number;

    /**
     * Request timeout in milliseconds.
     * @default 10000
     */
    timeoutMs?: number;

    /**
     * Connection timeout in milliseconds.
     */
    connectTimeoutMs?: number;

    /**
     * Whether to ban failed addresses.
     * @default true
     */
    banFailedAddress?: boolean;
}



/**
 * Settings for state transition broadcast operations.
 * Extends RequestSettings with additional options for waiting.
 */
export interface PutSettings {
    /**
     * Number of retries for the request.
     * @default 5
     */
    retries?: number;

    /**
     * Request timeout in milliseconds.
     * @default 10000
     */
    timeoutMs?: number;

    /**
     * Connection timeout in milliseconds.
     */
    connectTimeoutMs?: number;

    /**
     * Whether to ban failed addresses.
     * @default true
     */
    banFailedAddress?: boolean;

    /**
     * Timeout in milliseconds for waiting for the state transition result.
     * Only applies to broadcast and wait operations.
     */
    waitTimeoutMs?: number;

    /**
     * Fee increase multiplier (0-65535) to prioritize transaction processing.
     * Higher values result in higher fees and faster processing.
     * @default 0
     */
    userFeeIncrease?: number;

    /**
     * Time in seconds after which identity nonces are considered stale.
     * Used for nonce management in state transitions.
     */
    identityNonceStaleTimeS?: number;

    /**
     * Options for state transition creation (debugging).
     */
    stateTransitionCreationOptions?: {
        /**
         * Allow signing with any security level (debugging only).
         */
        allowSigningWithAnySecurityLevel?: boolean;
        /**
         * Allow signing with any purpose (debugging only).
         */
        allowSigningWithAnyPurpose?: boolean;
    };
}



/**
 * Supported operators for document query where clauses.
 */
export type DocumentWhereOperator =
| '=='
| '='
| '>'
| '>='
| '<'
| '<='
| 'Between'
| 'between'
| 'BetweenExcludeBounds'
| 'BetweenExcludeLeft'
| 'BetweenExcludeRight'
| 'in'
| 'In'
| 'startsWith'
| 'StartsWith'
| 'contains'
| 'Contains'
| 'containsAny'
| 'ContainsAny';

/**
 * Document query filtering clause represented as [field, operator, value].
 */
export type DocumentWhereClause = [string, DocumentWhereOperator, unknown];

/**
 * Document ordering clause represented as [field, direction].
 */
export type DocumentOrderByClause = [string, 'asc' | 'desc'];

/**
 * Query parameters for retrieving documents.
 */
export interface DocumentsQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Document type name.
     */
    documentTypeName: string;

    /**
     * Optional filter clauses expressed as [field, operator, value].
     * @default []
     */
    where?: DocumentWhereClause[];

    /**
     * Optional sorting clauses expressed as [field, direction].
     * @default []
     */
    orderBy?: DocumentOrderByClause[];

    /**
     * Maximum number of documents to return.
     * @default 100
     */
    limit?: number;

    /**
     * Exclusive document ID to resume from.
     * @default undefined
     */
    startAfter?: IdentifierLike

    /**
     * Inclusive document ID to start from.
     * @default undefined
     */
    startAt?: IdentifierLike

    /**
     * Aggregate-query option: SQL-shaped `GROUP BY` field list. Mirrors
     * the v1 wire's `group_by: repeated string` directly. Ignored by
     * the regular document-fetch path.
     *
     * - `[]` or omitted → one ungrouped result entry, keyed by the
     *   empty string. Its value is the total count for
     *   `getDocumentsCount`, total sum for `getDocumentsSum`, or
     *   `{count, sum}` for `getDocumentsAverage`.
     * - `["<in_field>"]` where `<in_field>` matches an `In`
     *   constraint → per-`In`-value entries (PerInValue).
     * - `["<range_field>"]` where `<range_field>` matches a range
     *   constraint → per-distinct-value entries within the range
     *   (RangeDistinct).
     * - `["<in_field>", "<range_field>"]` for compound `In + range`
     *   queries → compound distinct entries.
     *
     * Entry direction comes from the first `orderBy` clause's
     * direction (which also drives walk order on the materialize +
     * prove path); set `orderBy: [["<range_field>", "asc"|"desc"]]`
     * alongside `groupBy: ["<range_field>"]` to control sort.
     * @default []
     */
    groupBy?: string[];

    /**
     * Time-range bucket selections for "trending"-style queries. Each entry
     * picks a single bucket of a timestamp field covered by a `timeRange`
     * index. For the relative selectors the server resolves the bucket from
     * the current block time and the proof verifier re-derives it from the
     * signed response metadata; `"byStart"` names the bucket absolutely, so
     * both sides read it straight from the query. Provable either way.
     * Requires protocol version 14+ (the first version whose contract
     * grammar hosts `timeRange` indexes).
     *
     * - `selector: "oldest"` → the oldest still-active range (a near-full
     *   trailing window of ~`range`; best for "trending over the last window").
     * - `selector: "newest"` → the freshest started range (latest partial slice).
     * - `selector: "byStart"` → the range starting exactly at `startMs` — any
     *   window, current or historic. `startMs` is then required and must be a
     *   window start on the grid (`phase + k * step`, in milliseconds); an
     *   off-grid start is rejected rather than snapped, and an empty window
     *   is a provable empty answer. The relative selectors must not carry
     *   `startMs`.
     *
     * `grid` names one of the field's grids in the contract's own declared
     * seconds (`{ range, step, phase? }`) — required when the contract buckets
     * the field with more than one `timeRange` grid, where the bare selector
     * is ambiguous and rejected. A zero phase is spelled by omission.
     * @default []
     */
    timeRange?: {
        field: string;
        selector: "newest" | "oldest" | "byStart";
        startMs?: number;
        grid?: { range: number; step: number; phase?: number };
    }[];

    /**
     * Integer-range window selections. Each entry picks one window of an
     * integer field covered by an `integerRange` index, named by its start:
     * `start` must be a window start on the grid (`phase + k * step`, within
     * the field's integer type, or the type's minimum for a clamped bottom
     * window). An off-grid start is rejected rather than snapped, and an
     * empty window is a provable empty answer. The server and the proof
     * verifier resolve the same window from the query alone. Requires
     * protocol version 14+.
     *
     * `start` is a number, or a decimal string for values beyond
     * `Number.MAX_SAFE_INTEGER`. `grid` names one of the field's grids
     * verbatim (`{ range, step, phase? }`) and is required when the contract
     * buckets the field with more than one `integerRange` grid.
     * @default []
     */
    integerRange?: {
        field: string;
        start: number | string;
        grid?: { range: number; step: number; phase?: number };
    }[];
}

/**
 * Query parameters for retrieving document history.
 */
export interface DocumentHistoryQuery {
    /**
     * Data contract identifier.
     */
    dataContractId: IdentifierLike

    /**
     * Document type name.
     */
    documentTypeName: string;

    /**
     * Document identifier.
     */
    documentId: IdentifierLike

    /**
     * Millisecond timestamp (exclusive) to start after.
     * @default 0
     */
    startAtMs?: number;

    /**
     * Maximum number of entries to return.
     * @default undefined
     */
    limit?: number;

    /**
     * Offset for pagination through the document history.
     * @default undefined
     */
    offset?: number;
}



/**
 * The GroveDB layout of one document type: every tree and element Drive
 * writes under `[64, contract id, 1, document type name]`.
 */
export interface DocumentTypeLayout {
    documentType: string;
    root: DocumentTypeLayoutNode;
}

/** One layer of a document type's layout. */
export interface DocumentTypeLayoutNode {
    /** The key, or the family of keys this node stands for. */
    key:
    | { kind: 'fixed'; hex: string; label: string }
    | { kind: 'documentId' }
    | { kind: 'revisionTime' }
    | { kind: 'propertyValue'; property: string }
    | { kind: 'timeRangeBucket'; property: string; rangeSeconds: number; stepSeconds: number; phaseSeconds: number }
    | { kind: 'integerRangeBucket'; property: string; range: number; step: number; phase: number }
    | { kind: 'memberKey'; components: string[] };
    role:
    | 'documentType' | 'primaryKey' | 'document' | 'latestRevision' | 'revision'
    | 'indexProperty' | 'indexValue' | 'nextIndexProperty' | 'terminal' | 'member';
    /** The id of the node of Drive's structure description (grovedb-structure.json) this layer is an instance of. */
    structureNode: string;
    /** The element kind: 'Tree', 'CountTree', 'ProvableCountTree', …, 'Item', 'Reference', …. */
    element: string;
    /** The wrapper that makes the tree contribute nothing to the aggregating tree above it, when there is one. */
    wrapper?: 'NonCounted' | 'NotSummed' | 'NotCountedOrSummed';
    /** The ranking axes of an indexed tree. */
    rankedAxes: Array<'count' | 'sum' | 'avg'>;
    /** The indexes of the document type that use this layer. */
    indexes: string[];
    notes: Array<{ code: string; text: string }>;
    /** What Drive writes at this key instead in some cases, and when. */
    alternative?: { when: string; node: DocumentTypeLayoutNode };
    children: DocumentTypeLayoutNode[];
}



/**
 * The fee multiplier a transition's signer knew, and how far above it they accept to pay.
 */
export interface AgreedFeeMultiplierOptions {
    knownPermille: bigint;
    increaseTolerancePercent: number;
}

/**
 * Options for creating a DocumentActionFeeAgreement instance.
 *
 * `feeMultiplier` is named for a fee the document type prices by the fee multiplier and left
 * out for a fixed one.
 */
export interface DocumentActionFeeAgreementOptions {
    owner?: bigint;
    moderators?: bigint;
    feeMultiplier?: AgreedFeeMultiplierOptions;
}

/**
 * A document action a fee may be declared for.
 */
export type DocumentActionFeeAction =
| 'create'
| 'replace'
| 'delete'
| 'transfer'
| 'purchase'
| 'updatePrice'
| BatchType;

/**
 * AgreedFeeMultiplier serialized as a plain object.
 */
export interface AgreedFeeMultiplierObject {
    knownPermille: bigint;
    increaseTolerancePercent: number;
}

/**
 * AgreedFeeMultiplier serialized as JSON.
 */
export interface AgreedFeeMultiplierJSON {
    knownPermille: number | string;
    increaseTolerancePercent: number;
}

/**
 * DocumentActionFeeAgreement serialized as a plain object.
 */
export interface DocumentActionFeeAgreementObject {
    $formatVersion: string;
    owner: bigint;
    moderators: bigint;
    feeMultiplier: AgreedFeeMultiplierObject | null;
}

/**
 * DocumentActionFeeAgreement serialized as JSON.
 */
export interface DocumentActionFeeAgreementJSON {
    $formatVersion: string;
    owner: number | string;
    moderators: number | string;
    feeMultiplier: AgreedFeeMultiplierJSON | null;
}



/**
 * The immutability declarations of one document type.
 *
 * Mirrors the `immutable` keyword of the v3 document meta-schema, which is
 * active from protocol version 14: its entries naming a property, and its
 * `{ property, when }` entries. Both hold top-level property names only,
 * sorted: listing an object property freezes it whole, nested values
 * included.
 */
export type DocumentTypeImmutableProperties = {
    /**
     * Top-level properties frozen at document creation. A replace that
     * changes, adds or removes any of them is rejected with consensus code
     * 40128 (`DocumentImmutabilityErrorCode.DocumentImmutablePropertyChanged`).
     */
    immutable: string[];
    /**
     * Top-level properties frozen for any replace their condition holds for,
     * each with the condition as the contract declares it (the grammar of a
     * `propertyConstraints` rule). It is judged on the document the replace
     * writes, whose `$updatedAt` is the replace's block time, and reads the
     * stored document through `$old.` paths: `{ present: "$old.mood" }` lets an
     * absent `mood` be set once. A replace changing one while its condition
     * holds is rejected with code 40128 as well. No key is also in `immutable`.
     */
    immutableWhen: Record<string, unknown>;
};



/**
 * The kind of contract bounds: one contract, one document type of a contract, or every member
 * of a contract group (`contractGroup`, protocol version 14, authentication keys only).
 */
export type ContractBoundsType = "singleContract" | "documentType" | "contractGroup";

/**
 * ContractBounds serialized as a plain object. `id` is the contract id, or the contract group
 * id for `contractGroup` bounds.
 */
export interface ContractBoundsObject {
    $type: ContractBoundsType;
    id: Uint8Array;
    documentTypeName?: string;
}

/**
 * ContractBounds serialized as JSON. `id` is base58 encoded.
 */
export interface ContractBoundsJSON {
    $type: ContractBoundsType;
    id: string;
    documentTypeName?: string;
}



/**
 * The per-group aggregate a ranked / having-range query ranks and
 * filters on.
 *
 * `count` is `COUNT(*)` and takes no property — the count axis counts
 * documents per group. `COUNT(<property>)` is not a ranked axis and is
 * rejected. `sum` / `avg` name the covering index's `summable` property.
 *
 * The covering index must opt in with the matching contract keyword
 * (document meta-schema v3, protocol version 14+): `rankedCountable`,
 * `rankedSummable` or `rankedAverageable`. Without it the node refuses
 * the query and names the keyword the contract has to add.
 */
export type DocumentsAggregateSelect =
| { type: 'count' }
| { type: 'sum'; property: string }
| { type: 'avg'; property: string };

/**
 * One pin on a compound ranked index's leading property, spelled like a
 * `DocumentsQuery` where clause: `[property, '==', value]`,
 * `[property, 'contains', element]`, or `[property, 'in', values]`.
 *
 * A compound ranked index keeps one ordered secondary per prefix value,
 * with no global ordering across prefixes — so a ranked read has to name
 * the prefixes it descends into. `==` names exactly one; `in` names one
 * per element, each walked separately and merged into a single proved
 * page. That means: one pin per leading index property, each on a
 * distinct property, and none on the `groupBy` property itself. A
 * single-property ranked index takes no pins at all.
 *
 * At most **one** pin across the request may be a branching `in`, and it
 * carries 2..=`maxPrefixInBranches()` elements — several `in`s would
 * multiply into a cartesian product of prefix walks inside one proof. A
 * single-element `in` is normalized to `==` and never spends that
 * budget. Entries merged from an `in` carry `branchKeyHex` to say which
 * branch they came from.
 *
 * A branching `in` cannot combine with a non-zero `offset` — see
 * `DocumentsRankedQuery.offset`.
 *
 * A `null` value is legal and addresses the subtree the write path
 * creates for an *absent* optional value.
 *
 * `contains` pins a typed array property (protocol version 14+) whose
 * index keys each element: it names the one element's prefix, as `==`
 * names one value. `containsAny` is rejected: a ranking over several
 * elements would count a document once per element it holds.
 *
 * `>` / `<` / `between` / `startsWith` are all rejected: a range cannot
 * pin one prefix.
 */
export type DocumentsIndexPin =
| [string, '==' | '=', unknown]
| [string, 'contains' | 'Contains', unknown]
| [string, 'in' | 'In', unknown[]];

/** How a ranked / having-range walk runs along the aggregate axis. */
export type DocumentsRankDirection = 'asc' | 'desc';

/**
 * `SELECT <aggregate> GROUP BY <property> ORDER BY <that aggregate> LIMIT n [OFFSET m]`
 * — the ranked (top-K) surface, protocol version 14+.
 *
 * Answers "which n groups score highest (or lowest) on an aggregate?"
 * with a proof, by reading a pre-sorted per-axis secondary rather than
 * walking every group's value tree.
 *
 * There is deliberately no `orderBy` here: a ranked query takes exactly
 * one ordering clause and it is always "the selected aggregate", so
 * `direction` is the only free choice. There is no `startAt` /
 * `startAfter` either — a document id does not appear anywhere in a
 * keyspace sorted by aggregate, so a cursor is rejected rather than
 * ignored.
 *
 * @example
 * // The three best restaurants by average grade.
 * const page = await sdk.getDocumentsRanked({
 *   dataContractId: RESTAURANTS,
 *   documentTypeName: 'review',
 *   groupBy: 'restaurantId',
 *   aggregate: { type: 'avg', property: 'grade' },
 *   limit: 3,
 * });
 *
 * @example
 * // The 5th-best restaurant: skip the four above it, take one.
 * const fifth = await sdk.getDocumentsRanked({
 *   dataContractId: RESTAURANTS,
 *   documentTypeName: 'review',
 *   groupBy: 'restaurantId',
 *   aggregate: { type: 'avg', property: 'grade' },
 *   limit: 1,
 *   offset: 4,
 * });
 */
export interface DocumentsRankedQuery {
    /** Data contract identifier. */
    dataContractId: IdentifierLike;

    /** Document type name. */
    documentTypeName: string;

    /**
     * The single `GROUP BY` property — the covering ranked index's
     * *trailing* property, whose distinct values are the ranking's group
     * keys. A compound ranked index ranks each prefix separately: pin
     * every leading property through `where`, and group by the trailing
     * one.
     */
    groupBy: string;

    /** Which aggregate the groups are ranked by. */
    aggregate: DocumentsAggregateSelect;

    /**
     * The ranking's `n`. Required, and `1 <= limit <= 100`.
     *
     * This is a hard ceiling, not a clamp: the limit is echoed inside the
     * proof envelope and re-checked when the client reconstructs the page,
     * so an oversized request is rejected rather than truncated.
     */
    limit: number;

    /**
     * `'desc'` walks from the largest aggregate down — the "top n"
     * reading, where entry 0 is the highest-scoring group. `'asc'` is the
     * "bottom n" reading.
     * @default 'desc'
     */
    direction?: DocumentsRankDirection;

    /**
     * How many ranks to skip before the returned page. There is
     * deliberately no ceiling: the skipped region is attested from counted
     * subtree commitments rather than walked, so a deep offset costs what
     * a shallow one does.
     *
     * An offset past the end of the ranking is a legitimate answer rather
     * than an error — the page comes back empty and `startingRank` is the
     * ranking's whole attested population.
     *
     * Cannot combine with a branching `in` pin: that attestation is per
     * secondary, and an `in` merges several with no counted structure over
     * the union. Page one prefix at a time (`==` pin plus `offset`), or
     * drop the offset. `0` stays legal as the offset-free spelling.
     * @default undefined
     */
    offset?: number;

    /**
     * Pins on the covering compound index's leading properties — `==`
     * (`contains` on a typed array), or one bounded `in`. Omit entirely
     * for a single-property ranked index.
     * @default []
     */
    where?: DocumentsIndexPin[];

    /**
     * Optional time-range bucket selection — at most one entry, pinning the
     * covering bucketed index's window (same shape and semantics as
     * `DocumentsQuery.timeRange`). `"newest"`/`"oldest"` rank the current
     * window; `"byStart"` ranks any window, current or historic, named by
     * its grid-aligned start in milliseconds.
     * @default []
     */
    timeRange?: {
        field: string;
        selector: "newest" | "oldest" | "byStart";
        startMs?: number;
        grid?: { range: number; step: number; phase?: number };
    }[];

    /**
     * Optional integer-range window selection — at most one entry, pinning
     * the covering bucketed index's window (same shape and semantics as
     * `DocumentsQuery.integerRange`): the window starting at `start`.
     * @default []
     */
    integerRange?: {
        field: string;
        start: number | string;
        grid?: { range: number; step: number; phase?: number };
    }[];
}

/**
 * The `HAVING` bound: one contiguous range over the selected aggregate.
 *
 * The aggregate is not restated here. The grammar requires a having
 * clause to bound the same aggregate the query selects, so it is derived
 * from `aggregate` and there is no way to write the mismatch the server
 * would reject.
 *
 * `!=` and `in` describe non-contiguous ranges and are not expressible:
 * a having-range query *is* one contiguous slice of one axis secondary.
 *
 * Operand types follow the axis — `count` bounds are non-negative
 * integers, `sum` bounds are integers in `i64` range, `avg` bounds are
 * numbers in the natural (unscaled) domain of the averaged property.
 * Pass a `bigint` for magnitudes past `Number.MAX_SAFE_INTEGER`.
 *
 * A bound that resolves to an empty range (above the axis maximum, or a
 * `between` whose lower bound exceeds its upper) is rejected rather than
 * silently proving an empty page.
 */
export type DocumentsHavingBound =
| { operator: '==' | '=' | '>' | '>=' | '<' | '<='; value: number | bigint }
| {
    operator:
    | 'Between'
    | 'between'
    | 'BetweenExcludeBounds'
    | 'BetweenExcludeLeft'
    | 'BetweenExcludeRight';
    value: [number | bigint, number | bigint];
};

/**
 * `SELECT <aggregate> GROUP BY <property> HAVING <that aggregate> <op> <value> LIMIT n`
 * — the having-range surface, protocol version 14+.
 *
 * Answers "which groups' aggregate falls in this range?", served as a
 * value-bounded range read of the same axis secondary the ranked surface
 * reads. Verification covers completeness: an in-range group the node
 * omitted fails the proof.
 *
 * Pagination caveat — there is no offset and no cursor. Continuing a
 * page means re-issuing with a tightened bound, which advances past
 * *distinct* aggregate values only, so a page cut inside a tie cannot be
 * continued. Size `limit` above the widest tie you expect.
 *
 * @example
 * // Hashtags with more than 100 posts, biggest first.
 * const hot = await sdk.getDocumentsHaving({
 *   dataContractId: SOCIAL,
 *   documentTypeName: 'post',
 *   groupBy: 'hashtag',
 *   aggregate: { type: 'count' },
 *   having: { operator: '>', value: 100 },
 *   direction: 'desc',
 *   limit: 100,
 * });
 */
export interface DocumentsHavingQuery {
    /** Data contract identifier. */
    dataContractId: IdentifierLike;

    /** Document type name. */
    documentTypeName: string;

    /** The single `GROUP BY` property. Same contract as `DocumentsRankedQuery`. */
    groupBy: string;

    /** Which aggregate the bound applies to. */
    aggregate: DocumentsAggregateSelect;

    /** The one bound. Exactly one clause — multi-clause `AND` is rejected. */
    having: DocumentsHavingBound;

    /** Required, `1 <= limit <= 100`. Same hard-ceiling semantics as ranked. */
    limit: number;

    /**
     * Walk direction along the axis inside the bound. Optional here,
     * unlike ranked, where the ordering *is* the query.
     * @default 'asc'
     */
    direction?: DocumentsRankDirection;

    /**
     * Pins on the covering compound index's leading properties — `==`
     * (`contains` on a typed array), or one bounded `in`. A having-range
     * query has no `offset`, so the ranked surface's offset-versus-`in`
     * exclusion does not arise here.
     * @default []
     */
    where?: DocumentsIndexPin[];

    /**
     * Optional time-range bucket selection — at most one entry, pinning the
     * covering bucketed index's window (same shape and semantics as
     * `DocumentsQuery.timeRange`). `"newest"`/`"oldest"` rank the current
     * window; `"byStart"` ranks any window, current or historic, named by
     * its grid-aligned start in milliseconds.
     * @default []
     */
    timeRange?: {
        field: string;
        selector: "newest" | "oldest" | "byStart";
        startMs?: number;
        grid?: { range: number; step: number; phase?: number };
    }[];

    /**
     * Optional integer-range window selection — at most one entry, pinning
     * the covering bucketed index's window (same shape and semantics as
     * `DocumentsQuery.integerRange`): the window starting at `start`.
     * @default []
     */
    integerRange?: {
        field: string;
        start: number | string;
        grid?: { range: number; step: number; phase?: number };
    }[];
}

/** Which axis a returned aggregate value came from. */
export type DocumentsAggregateKind = 'count' | 'sum' | 'avg';

/** One group in a ranked / having-range result. */
export interface DocumentsGroupEntry {
    /**
     * Hex-encoded raw index-key bytes of the group's value — byte for byte
     * the same key `getDocumentsCount` / `getDocumentsSum` /
     * `getDocumentsAverage` use for the same grouping, so results
     * correlate across the surfaces. Always present, even when
     * `groupValue` could not be produced.
     */
    groupKeyHex: string;

    /**
     * The group key decoded back to its typed value using the contract's
     * document type. Identifiers arrive base58-encoded and byte
     * properties base64-encoded, matching the document JSON convention
     * used elsewhere in this SDK.
     *
     * `null` when the index key is empty — how the write path stores an
     * *absent* optional group-by value. `undefined` when the bytes exist
     * but do not decode as the group-by property's type. `groupKeyHex` is
     * always the lossless fallback.
     */
    groupValue: unknown;

    /**
     * The group's aggregate as an exact integer.
     *
     * - `count` — the document count.
     * - `sum` — the running sum, signed.
     * - `avg` — the *fixed-point* average. Divide by `valueScale` on the
     *   enclosing result; never by a hardcoded literal, because the scale
     *   is a build-time constant that has already changed once.
     *
     * A `bigint` because none of the three fit a JS `number` in general
     * and the average's fixed point is 128-bit. On a proved fetch this is
     * exactly the integer the proof commits to — keep it for comparing
     * groups, reproducing a ranking, or storing. On an unproved fetch the
     * average is reconstructed from the wire's `double`, so digits past
     * f64's ~15 significant decimals are noise. Ranking *order* is exact
     * either way.
     */
    value: bigint;

    /**
     * `value` rendered as a `number`, with the average axis already
     * divided by the scale. A display helper: lossy past 2^53 for counts
     * and sums, and for every average. Two groups whose exact aggregates
     * differ can round to the same `number`, so never compare with this.
     */
    valueAsNumber: number;

    /**
     * Hex-encoded index-key segment of the `in` branch this entry was
     * merged in from — the pinned value's own encoding, or empty bytes for
     * the `null` branch.
     *
     * Present only when the request carried a branching `in` pin, because
     * only then is the page a merge of several prefixes and only then can
     * one `groupKeyHex` legitimately appear twice. Absent — not
     * `undefined`-valued — on every single-prefix page.
     */
    branchKeyHex?: string;
}

/** One group in a ranked result, pinned to its absolute position. */
export interface DocumentsRankedEntry extends DocumentsGroupEntry {
    /**
     * The group's 0-based absolute rank, `startingRank + index`. This is
     * what makes `limit: 1, offset: 4` mean "the 5th best" rather than
     * "some entry".
     */
    rank: bigint;
}

/** Result of a ranked (top-K) query. */
export interface DocumentsRankedResult {
    /**
     * The 0-based rank of `entries[0]` — the query's offset as actually
     * honoured. On the proved path this is re-derived from the proof's
     * counted subtree commitments rather than trusted from the node.
     *
     * When `entries` is empty this is a proof that the ranking holds
     * exactly this many groups in total.
     */
    startingRank: bigint;

    /** The groups on this page, in ranking order. Do not re-sort. */
    entries: DocumentsRankedEntry[];

    /** Which axis `entry.value` came from; echoes the request's `aggregate.type`. */
    aggregate: DocumentsAggregateKind;

    /** The request's `groupBy` property, echoed so a result is self-describing. */
    groupBy: string;

    /**
     * Fixed-point divisor for `entry.value`: `1n` for `count` and `sum`,
     * and the build's average scale for `avg`. Returned rather than
     * documented precisely so callers never hardcode it.
     * `Number(e.value) / Number(scale)` is `e.valueAsNumber`; use a
     * decimal library on the two bigints when you need better.
     */
    valueScale: bigint;
}

/** Result of a having-range query. */
export interface DocumentsHavingResult {
    /**
     * The matching groups, in axis order along `direction`. Do not
     * re-sort. There is no rank: a having-range read bounds values, it
     * does not count positions.
     */
    entries: DocumentsGroupEntry[];

    /** Which axis `entry.value` came from. */
    aggregate: DocumentsAggregateKind;

    /** The request's `groupBy` property. */
    groupBy: string;

    /** Same contract as `DocumentsRankedResult.valueScale`. */
    valueScale: bigint;
}



/**
 * The scheme an `encryptedFor` property's bytes were produced under.
 *
 * `ecdh-secp256k1-aes256-cbc` is the scheme of the dashpay contact request:
 * the shared key is the libsecp256k1 ECDH of the sender's private key and
 * the recipient's public key (SHA256 of the product point's parity byte and
 * x coordinate), and the value is a random 16-byte IV followed by the
 * plaintext under AES-256-CBC with PKCS7 padding and that IV. A ciphertext
 * is therefore at least 32 bytes and always a multiple of 16.
 */
export type EncryptionScheme = 'ecdh-secp256k1-aes256-cbc';

/**
 * A single `encryptedFor` declaration on a document type.
 *
 * Mirrors the `encryptedFor` keyword of the v3 document meta-schema, which
 * is active from protocol version 14. The field names are the schema
 * keyword's own, so what `contract.toJSON()` shows under `encryptedFor` and
 * what these accessors return line up key for key.
 */
export type DocumentPropertyEncryption = {
    /**
     * Dotted path of the declaring byte array property within the document
     * type, for example `"encryptedMessage"`, or `"meta.blob"` for a nested
     * one. This is the string consensus reports in the `property` field of
     * the shape error (code 10420).
     */
    path: string;
    /**
     * Whose keys decrypt the bytes: the dotted path of an identifier property
     * of the same document type whose value is the recipient identity's id,
     * or `"$ownerId"` for a message the writer encrypts to themself.
     */
    recipient: string;
    /**
     * Dotted path of the integer property of the same document type carrying
     * the id of the recipient's key.
     */
    recipientKey: string;
    /**
     * Dotted path of the integer property of the same document type carrying
     * the id of the sender's key.
     */
    senderKey: string;
    /** How the bytes were produced. */
    scheme: EncryptionScheme;
};



/**
 * Token-based payment metadata for document actions that require token cost agreement.
 */
export interface DocumentTokenPaymentInfo {
    /**
     * Optional external token contract ID.
     * If omitted, the token is expected to come from the current document contract.
     */
    paymentTokenContractId?: IdentifierLike;

    /**
     * Token position within the token contract.
     */
    tokenContractPosition: number;

    /**
     * Optional minimum token amount the payer agrees to spend.
     */
    minimumTokenCost?: bigint;

    /**
     * Optional maximum token amount the payer agrees to spend.
     */
    maximumTokenCost?: bigint;

    /**
     * Which party covers gas fees for the document action.
     */
    gasFeesPaidBy?: GasFeesPaidByLike;
}



/**
 * TokenConfigurationLocalization serialized as a plain object.
 */
export interface TokenConfigurationLocalizationObject {
    $formatVersion: string;
    shouldCapitalize: boolean;
    singularForm: string;
    pluralForm: string;
}

/**
 * TokenConfigurationLocalization serialized as JSON.
 */
export interface TokenConfigurationLocalizationJSON {
    $formatVersion: string;
    shouldCapitalize: boolean;
    singularForm: string;
    pluralForm: string;
}



/**
 * TokenContractInfo serialized as a plain object.
 *
 * Versioned enum tagged with `$formatVersion`. V0 carries `contractId` and
 * `tokenContractPosition` flat at the top level via internal tagging.
 */
export interface TokenContractInfoObject {
    $formatVersion: "0";
    contractId: Uint8Array;
    tokenContractPosition: number;
}

/**
 * TokenContractInfo serialized as JSON (with string identifiers).
 */
export interface TokenContractInfoJSON {
    $formatVersion: "0";
    contractId: string;
    tokenContractPosition: number;
}



/**
 * TokenEvent serialized as a plain object.
 *
 * Custom Serialize emits an internally-tagged flat shape: `$type:` is the
 * variant discriminator, positional tuple fields are mapped to named JSON
 * keys per variant. No `data` wrapper.
 *
 * Common per-variant payloads:
 *   - Mint:    { $type: "mint",    amount, recipient, publicNote }
 *   - Burn:    { $type: "burn",    amount, burnFromIdentifier, publicNote }
 *   - Freeze:  { $type: "freeze",  frozenIdentifier, publicNote }
 *   - Unfreeze:{ $type: "unfreeze",frozenIdentifier, publicNote }
 *   - DestroyFrozenFunds:        { $type, frozenIdentifier, amount, publicNote }
 *   - Transfer:{ $type, recipient, publicNote, sharedEncryptedNote,
 *                privateEncryptedNote, amount }
 *   - Claim:   { $type, distributionType, amount, publicNote }
 *   - EmergencyAction:           { $type, action, publicNote }
 *   - ConfigUpdate:              { $type, configurationChange, publicNote }
 *   - ChangePriceForDirectPurchase: { $type, pricingSchedule, publicNote }
 *   - DirectPurchase: { $type, amount, credits }
 *   - Shield:  { $type: "shield", amount }
 *   - Unshield:{ $type: "unshield", recipient, amount }
 *   - ShieldedTransfer: { $type: "shieldedTransfer" }
 *   - MintToPool: { $type: "mintToPool", amount, actionsDigest, publicNote }
 *   - BurnFromPool: { $type: "burnFromPool", amount, actionsDigest, publicNote }
 *   - ClaimToPool: { $type: "claimToPool", amount }
 *   - DirectPurchaseToPool: { $type: "directPurchaseToPool", amount, credits }
 *
 * `amount`/`credits` are routed through json_safe_u64 — small numbers, JS
 * BigInt-safe stringification above 2^53. Identifier fields use base58 in
 * JSON, Uint8Array in toObject().
 */
export interface TokenEventObject {
    $type: string;
    [field: string]: unknown;
}

/**
 * TokenEvent serialized as JSON. Same shape as TokenEventObject with
 * Identifier fields rendered as base58 strings.
 */
export interface TokenEventJSON {
    $type: string;
    [field: string]: unknown;
}



/**
 * Union type for reward distribution variants.
 */
export type RewardDistributionValue =
| BlockBasedDistribution
| TimeBasedDistribution
| EpochBasedDistribution;



/**
 * Union type for token configuration change item values.
 * Use `itemName` getter to determine which variant it is.
 */
export type TokenConfigurationChangeItemValue =
| "TokenConfigurationNoChange"
| TokenConfigurationConvention
| AuthorizedActionTakers
| bigint
| TokenPerpetualDistribution
| Identifier
| boolean
| TokenTradeMode
| number
| null;



/**
 * Vote serialized as a plain object.
 *
 * Internally tagged with `$type` ($-prefix because the level also carries
 * the inner ResourceVote's `$formatVersion`). The single ResourceVote
 * variant flattens its V0 body — no `data` wrapper.
 */
export interface VoteObject {
    $type: "resourceVote";
    $formatVersion: string;
    votePoll: VotePollObject;
    resourceVoteChoice: ResourceVoteChoiceObject;
}

/**
 * Vote serialized as JSON.
 */
export interface VoteJSON {
    $type: "resourceVote";
    $formatVersion: string;
    votePoll: VotePollJSON;
    resourceVoteChoice: ResourceVoteChoiceJSON;
}



/**
 * What a `refersTo` declaration points at.
 *
 * Mirrors the `refersTo` keyword of the v3 document meta-schema, which is
 * active from protocol version 14. The field names are the schema keyword's
 * own, so what `contract.toJSON()` shows under `refersTo` and what these
 * accessors return line up key for key, with one addition: a reference
 * expression, which the schema declares by its `anyOf` or `allOf` key alone,
 * also carries `type: 'anyOf'` or `type: 'allOf'`, so every member of the
 * union is tagged by `type`.
 */
/**
 * What an `identityPublicKey` reference requires of the key it points at,
 * beyond its existence and its not being disabled.
 */
export type IdentityKeyReferenceRequirements = {
    purpose?: 'authentication' | 'encryption' | 'decryption' | 'transfer' | 'voting' | 'owner';
    boundTo?: string;
};

export type DocumentPropertyReferenceTarget =
| { type: 'identity' }
| {
    type: 'contract';
    /**
     * What the referenced contract must declare beyond existing, checked
     * by consensus when the referring document is written against the
     * contract fetched for the existence check and the block time:
     * `moderation: 'elected'` requires an elected moderation team and
     * `'electionOpen'` one whose own `electionDelay` has passed since the
     * contract's creation (or which declares none),
     * `minimumAgeSeconds` requires the contract's recorded creation time
     * to be at least that many seconds before the block time of the write,
     * and `minimumSecondsSinceUpdate` the same of the later of its creation
     * and last update times, and `owner: 'self'` requires the contract to
     * be owned by the writer of the referring document (its `$ownerId`),
     * `'other'` by anyone else; `readonly: true` requires a read-only
     * contract (one that can never be updated again), `keepsHistory: true`
     * one keeping its history, and `ownerProtected` an elected moderation
     * declaration whose owner protection flag has that value (code 40135
     * when any is unmet). Absent when the declaration carries no
     * requirement.
     */
    contractRequirements?: {
        moderation?: 'elected' | 'electionOpen';
        minimumAgeSeconds?: number;
        minimumSecondsSinceUpdate?: number;
        owner?: 'self' | 'other';
        readonly?: true;
        keepsHistory?: true;
        ownerProtected?: boolean;
    };
}
| { type: 'token' }
| {
    type: 'permanentDocument';
    /**
     * The contract the referenced document type lives in.
     *
     * Always present. When the schema omits `contractId` the declaration
     * targets the declaring contract itself, and this field reports the
     * declaring contract's own id — consensus resolves the two cases
     * identically, so a caller never has to special-case an absent value.
     * `ref.contractId.equals(contract.id)` is the self-reference test.
     */
    contractId: Identifier;
    /**
     * Name of the referenced document type. It must declare
     * `canBeDeleted: false`, which is what makes the reference
     * permanent — a target that could be deleted would leave the
     * reference dangling.
     */
    documentType: string;
    /**
     * How the referenced document is found when the property's value is
     * not its id. See {@link DocumentReferenceFindBy}. Absent when the
     * value is the referenced document's `$id`.
     */
    findBy?: DocumentReferenceFindBy;
    /**
     * What the referenced document must hold once found. See
     * {@link DocumentReferenceWhere}. Absent — not `{}`-valued — when the
     * declaration compares nothing.
     */
    where?: DocumentReferenceWhere;
    /**
     * Beside `findBy`: what the document `findBy` finds must meet when the
     * referring document is created. See {@link DocumentReferenceConstraints}.
     */
    constraints?: DocumentReferenceConstraints;
    /**
     * A list the value must be in: the value (on a typed array, every
     * element) must be one of the identifiers the typed array `inList`
     * holds, a dotted path on `documentType`, on the document `findBy`
     * names by `{ $id: <property> }`, the identifier property holding its
     * id. Consensus fetches that document, checks `where` against it, and
     * refuses a value its list does not hold, or one set while that
     * property is not (code 40120). The list's document can never be
     * deleted and the list never changes, so a value accepted once stays an
     * element. To resolve it yourself, fetch the document by that id and
     * look in `inList`.
     */
    inList?: string;
}
| {
    type: 'identityPublicKey';
    /**
     * Property of the same document type whose value carries the
     * referenced key id. The declaring property's own value carries the
     * identity id. A dotted path when the property is nested.
     */
    keyIdProperty: string;
    identityProperty?: never;
    /**
     * What the referenced key must be beyond existing and not being
     * disabled, checked by consensus when the referring document is
     * written against the key fetched for the existence check:
     * `purpose` requires the key's purpose to be the named one, and
     * `boundTo` requires the key's contract bounds to be exactly the
     * declaring contract and the named document type of it; a
     * whole-contract or contract group bound never meets it (code 40136
     * when either is unmet). Absent when the declaration carries no
     * requirement.
     */
    keyRequirements?: IdentityKeyReferenceRequirements;
}
| {
    /**
     * The inverse form, declared on the key id property itself: the
     * declaring property (an integer from 0 to 4294967295) carries the
     * key id, and `identityProperty` names whose key it is: `'$ownerId'`,
     * the document's owner, `'$creatorId'`, its creator (only on a
     * document type that records creator ids), or the dotted path of an
     * identifier property of the same document type. Consensus fetches
     * only the key (codes 40123 when it does not exist, 40124 when it is
     * disabled; 40125 when a key id is set while the named property is
     * not), and checks `keyRequirements` against it exactly as for the
     * identifier form.
     */
    type: 'identityPublicKey';
    identityProperty: '$ownerId' | '$creatorId' | (string & {});
    keyIdProperty?: never;
    /**
     * What the referenced key must be beyond existing and not being
     * disabled, checked by consensus when the referring document is
     * written against the key fetched for the existence check:
     * `purpose` requires the key's purpose to be the named one, and
     * `boundTo` requires the key's contract bounds to be exactly the
     * declaring contract and the named document type of it; a
     * whole-contract or contract group bound never meets it (code 40136
     * when either is unmet). Absent when the declaration carries no
     * requirement.
     */
    keyRequirements?: IdentityKeyReferenceRequirements;
}
| {
    /**
     * A document of a type whose documents CAN be deleted (the
     * counterpart of `permanentDocument`, disjoint from it). The
     * referenced document must exist, and every `where` entry must
     * hold, when the referring document is written; it may be
     * deleted afterwards, so a reader must expect the reference to
     * resolve to nothing. Every replace of the referring document
     * re-validates it: a dead reference has to be repointed at an
     * existing document or cleared.
     */
    type: 'deletableDocument';
    /**
     * The contract the referenced document type lives in. Always
     * present, resolved exactly as for `permanentDocument`.
     */
    contractId: Identifier;
    /** Name of the referenced document type; it must allow deletion. */
    documentType: string;
    /**
     * How the referenced document is found when the property's value is
     * not its id. See {@link DocumentReferenceFindBy}. Absent when the
     * value is the referenced document's `$id`. With `findBy` the
     * reference means "a document with this key exists now": once the one
     * it found is deleted the key may find another, and every replace
     * re-validates it, unless a `findBy` function computes the key: that
     * commitment is judged when the document is created only.
     */
    findBy?: DocumentReferenceFindBy;
    /**
     * What the referenced document must hold once found, exactly as for
     * `permanentDocument`. Absent — not `{}`-valued — when the declaration
     * compares nothing.
     */
    where?: DocumentReferenceWhere;
    /**
     * Beside `findBy`: what the document `findBy` finds must meet when the
     * referring document is created. See {@link DocumentReferenceConstraints}.
     */
    constraints?: DocumentReferenceConstraints;
    /**
     * Beside `findBy`, on a reference judged on the create alone (a `findBy`
     * function, or a document type whose documents are never replaced): the create deletes the document
     * `findBy` finds, the writer's own commitment, in the same state
     * transition.
     */
    consume?: true;
}
| {
    /**
     * A document of a type whose documents leave state only when the
     * contract's moderators remove them, each removal leaving a removal
     * record under the contract (`canBeDeleted: false`, no `ttl`, and
     * `moderatorAbilities.delete` keeping records). Between
     * `permanentDocument` and `deletableDocument`, disjoint from both. The
     * referenced document must exist, and every `where` entry must hold,
     * when the referring document is written; afterwards the reference
     * resolves to the document or, once a moderator removed it, to its
     * removal record, which a restore can bring the document back from. A
     * replace keeps it, re-validating it only when the value or a property
     * `where` reads changes, as for `permanentDocument`; on every replace
     * for a `where` value `$ownerId`, a `notEqual` bounded by `$ownerId`,
     * an ordering bounded by `$updatedAt` or `$transferredAt` (or their
     * heights), and a reference a `propertyConstraints` rule reads through,
     * which checks its whole `where`.
     */
    type: 'moderatedDocument';
    /**
     * The contract the referenced document type lives in. Always
     * present, resolved exactly as for `permanentDocument`.
     */
    contractId: Identifier;
    /**
     * Name of the referenced document type; its documents must leave
     * state only through a moderator's recorded removal.
     */
    documentType: string;
    /**
     * What the referenced document must hold, exactly as for
     * `permanentDocument`. Absent — not `{}`-valued — when the declaration
     * compares nothing.
     */
    where?: DocumentReferenceWhere;
}
| DocumentPropertyReferenceExpression;

/**
 * A reference expression, declared as `refersTo: { anyOf: [...] }` or
 * `refersTo: { allOf: [...] }`. The operands sit under the combinator's own
 * key, as in the schema, and `type` names the combinator, so the union stays
 * internally tagged like every other: `switch (reference.type)` sees
 * `'anyOf'` and `'allOf'` next to the target kinds. An `anyOf` holds when at
 * least one operand holds: consensus checks the operands in this order,
 * stops at the first that holds, and when none does refuses the write with
 * the error of the last. An `allOf` holds when every operand holds for the
 * same value: consensus stops at the first that fails and refuses the write
 * with its error. Operands nest, the other combinator inside, up to the
 * protocol's depth limit (4 from protocol version 14).
 */
export type DocumentPropertyReferenceExpression =
| { type: 'anyOf'; anyOf: Array<DocumentPropertyReferenceOperand> }
| { type: 'allOf'; allOf: Array<DocumentPropertyReferenceOperand> };

/**
 * One operand of a reference expression: a leaf, an `identity`, a
 * `permanentDocument` (by id, by `findBy` or with `inList`) or a
 * `deletableDocument` found by `findBy`, with its own fields, a `where`
 * belonging to its own leaf, or a nested expression.
 */
export type DocumentPropertyReferenceOperand =
| Extract<
DocumentPropertyReferenceTarget,
{ type: 'identity' | 'permanentDocument' | 'deletableDocument' }
>
| DocumentPropertyReferenceExpression;

/**
 * How a document reference finds the referenced document when the value is
 * not its id: every property of one unique index of the referenced document
 * type, by its name there (`$ownerId` among the system ones), mapped to where
 * its value comes from: a property path of the referring document type,
 * `'$ownerId'` for the referring document's owner, `'.'` for the value of the
 * property that carries the reference (exactly once; a string or byte array
 * property's value fills an index property of the same kind, byte for byte),
 * or a function computing it (see {@link DocumentReferenceFindByFunction}).
 * The index is the unique one
 * whose properties are exactly these, and the reference holds if the document
 * it finds exists (code 40120 when it does not). To resolve a reference
 * yourself, query the referenced type by those values: at most one document
 * matches. On a `permanentDocument` reference the key cannot move off the
 * document it found, so it keeps resolving; on a `deletableDocument` reference
 * it may find nothing, or a later document with the same key, once the one it
 * found is deleted. With `inList` it is `{ $id: <property> }`: the document
 * holding the list, by the id that property holds.
 */
export type DocumentReferenceFindBy = Record<string, string | DocumentReferenceFindByFunction>;

/**
 * What a referenced document must hold once found: `{ <referenced property>:
 * <referring value> }`, each an equality consensus enforces when the referring
 * document is written (code 40127 when it fails). The key is a property path
 * of the referenced document type, or its `$ownerId`, `$creatorId` or `$id`
 * (current owner, original creator, id) against an identifier on the
 * referring side. The value is a property path of the referring document
 * type, or `'$ownerId'`, the writer, which makes the entry a write gate: only
 * an identity equal to the referenced side may create the document, and every
 * replace re-checks it. Beside a `findBy` function the whole declaration is
 * judged when the document is created only, so no replace re-checks it.
 *
 * A value may instead be a condition ({@link DocumentReferenceWhereCondition}):
 * a literal the referenced side must equal, a value it must differ from,
 * literals it must be one of, or a bound it must compare with.
 */
export type DocumentReferenceWhere = Record<string, string | DocumentReferenceWhereCondition>;

/**
 * A `where` entry that is not an equality with a referring value, as the
 * schema writes it, one key:
 *
 * - `const`: a literal the referenced side must equal (a string is a base58
 *   identifier for an identifier, hex for a byte array); a side the document
 *   leaves out equals none;
 * - `notEqual`: a referring property path, `'$ownerId'` (the writer, checked on
 *   every replace) or a `{ const }` it must differ from; both sides absent are
 *   equal;
 * - `in`: two or more literals of one kind, one of which it must equal;
 * - `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`: an
 *   integer it must compare with, an integer property path of the referring
 *   type, an integer `{ const }`, or a time or height the referring type
 *   records (`'$createdAt'`; one of the update or transfer is checked on every
 *   replace); it holds only when both sides have a value;
 * - `contains`, of a typed array: a property path of the referring type
 *   holding one value of the element kind, or `'$ownerId'` (the writer, among
 *   identifiers, checked on every replace), that an element must equal; a list
 *   left out holds nothing, and a value left out is in no list;
 * - `containsAll`, of a typed array: a typed array property path of the
 *   referring type whose every element it must hold, in any order; every list
 *   holds all of an empty one.
 *
 * An equality between two typed arrays compares them as lists: the same
 * elements in the same order, a list left out the empty one.
 *
 * An entry that does not hold refuses the write with code 40127.
 */
export type DocumentReferenceWhereCondition =
| { const: string | number | bigint | boolean }
| { notEqual: string | { const: string | number | bigint | boolean } }
| { in: Array<string | number | bigint | boolean> }
| { greaterThan: string | { const: number | bigint } }
| { greaterThanOrEqual: string | { const: number | bigint } }
| { lessThan: string | { const: number | bigint } }
| { lessThanOrEqual: string | { const: number | bigint } }
| { contains: string }
| { containsAll: string };

/**
 * A `findBy` function, for a commit and reveal, keyed by the referenced
 * property: the document is found by that property holding the hash
 * `function` (`sys.hash.sha256d`, SHA-256 of SHA-256) of the `params`' bytes
 * joined in order with nothing between them. A param is a property path of the
 * document being created (a string's UTF-8, a byte array's bytes, an
 * identifier's 32 bytes), the property carrying the reference included,
 * `{ const }`, fixed UTF-8 text, `'.'`, the value carrying the reference
 * where it has no path (each element of a typed array, the writer or the
 * creator), or `'$ownerId'`, the 32 bytes of the writer's identity, the owner
 * of the document being created. The document it finds is a commitment made
 * earlier; the reference
 * is checked when the document is created only. To reveal one, compute the
 * same hash over the values you create the document with.
 */
export type DocumentReferenceFindByFunction = {
    function: 'sys.hash.sha256d';
    params: Array<string | { const: string }>;
};

/**
 * A `refersTo`'s `constraints`, beside `findBy`, on a reference judged on the
 * create alone (a `findBy` function, or a document type whose documents are
 * never replaced).
 *
 * - `minimumAgeBlocks`: how many blocks before the create the document `findBy`
 *   finds must have been created, from its `$createdAtBlockHeight`, so 1 means
 *   an earlier block (code 40142 when it was not).
 * - `chooseFirst`: on a `deletableDocument` reference only, see
 *   {@link DocumentReferenceChooseFirst}.
 */
export type DocumentReferenceConstraints = {
    minimumAgeBlocks?: number;
    chooseFirst?: DocumentReferenceChooseFirst;
};

/**
 * A `deletableDocument` reference's `constraints.chooseFirst`, beside a
 * `findBy` holding `$ownerId: '$ownerId'` and a function filling `among` (a
 * {@link DocumentReferenceFindByFunction} reading neither `'$ownerId'` nor
 * `'.'`): every commitment to the same values holds that hash, whoever made
 * it. The found document must be the first valid commitment among those
 * holding the same value. `validWhen` maps one property to a function reading
 * `'$ownerId'` (each commitment's owner) and exactly the properties the
 * `findBy` function reads: a commitment is valid when it holds that function
 * computed with its owner, which takes knowing the values, so a copied hash
 * does not count. The commitments are ordered by `by`, each entry one property
 * and its direction, a last `$id` breaking ties in the direction of the entry
 * before it (ascending alone). A create is refused when a
 * valid commitment before the found one is not past its `ttl` (code 40149);
 * two equal on every `by` property precede neither other. A found commitment
 * past its own `ttl`, or not valid itself, reveals nothing (code 40120).
 */
export type DocumentReferenceChooseFirst = {
    among: string;
    validWhen: Record<string, DocumentReferenceFindByFunction>;
    by: Array<Record<string, 'asc' | 'desc'>>;
};

/**
 * A single `refersTo` declaration on a document type.
 */
export type DocumentPropertyReference = {
    /**
     * Dotted path of the declaring property within the document type — for
     * example `"author"`, or `"meta.parentId"` for a nested one. A
     * declaration on the `items` of a typed array of identifiers, which every
     * element carries, is listed with the list path of its elements, for
     * example `"reasons[]"`; its `type` is never `identityPublicKey`, which
     * an element cannot declare.
     *
     * The document type's `ownerRefersTo` declaration, whose value is the
     * document's `$ownerId`, the writer, is listed first with the path
     * `"$ownerId"`, which is not a property path: the value it checks is the
     * document's owner. Consensus checks it with the writer's id when a
     * document is created, and when a replace changes a property its `findBy`
     * or `where` reads (every replace for a `deletableDocument` found by
     * `findBy`, which gates the writer on its document still existing); in its
     * `findBy`, `'.'` is the writer. Its `type` is `identity`, a
     * `permanentDocument` or `deletableDocument` with `findBy`, or a
     * `permanentDocument` with `inList`, the targets a writer can be, on a document type whose
     * documents can be neither transferred nor traded. On a type whose documents can, a
     * `creatorRefersTo` declaration takes its place, listed first with the
     * path `"$creatorId"`: the same, with the document's creator, who never
     * changes, as the value, and a `deletableDocument` only with a `findBy`
     * function (see {@link DocumentReferenceFindByFunction}).
     *
     * This is the same string consensus reports in the `path` field of the
     * document-write reference errors (codes 40120-40125, 40131, 40135,
     * 40136, 40142 and 40149), except that a write error names the failing element by its
     * index (`"reasons[2]"` for
     * the third). Note that contract *registration* errors prefix it with the
     * document type name (`"<documentType>.<path>"`, `"<documentType>.reasons[]"`)
     * and name one leaf of a reference expression by where it sits
     * (`"<documentType>.<path>.anyOf[1].allOf[0]"`), while document *write*
     * errors do neither.
     */
    path: string;
} & DocumentPropertyReferenceTarget;



/**
 * What every element of a typed array is, parsed from its `items` schema.
 *
 * `type` names the element kind as DPP parses it: `byteArray` is an
 * `items` schema with `byteArray: true`, and `identifier` one that also
 * carries the identifier `contentMediaType`. From protocol version 14 the
 * schema may write them as the shorthands `{ type: 'bytes', size }` (a
 * `byteArray` with `minItems` and `maxItems` both `size`) and
 * `{ type: 'identifier' }`, which parse to the same kinds. The bound
 * names are the schema keywords' own: `minLength` / `maxLength` count a
 * string element's characters, `minItems` / `maxItems` a byte array
 * element's bytes, `minimum` / `maximum` an integer or number element's
 * range, and `enum` the values an element must be one of, in declared
 * order. The bounds are read from the parsed element, so a `bytes`
 * shorthand reports its `size` as `minItems` and `maxItems`, and an
 * identifier, written either way, reports none. Any other bound is absent
 * when the schema omits it.
 */
export type DocumentTypedArrayItem =
| { type: 'integer'; minimum?: number; maximum?: number; enum?: number[] }
| { type: 'number'; minimum?: number; maximum?: number; enum?: number[] }
| { type: 'boolean'; enum?: boolean[] }
| { type: 'string'; minLength?: number; maxLength?: number; enum?: string[] }
| { type: 'byteArray'; minItems?: number; maxItems?: number }
| {
    type: 'identifier';
    /**
     * The `refersTo` declaration every element carries, when the `items`
     * schema declares one: consensus checks each element as a single
     * reference when a document is created or replaced, and a write error
     * names the failing element by its list path (`"reasons[2]"`). Never
     * `identityPublicKey`; a reference expression, which each element must
     * meet on its own. The same declaration is listed by
     * `documentTypeReferences` at the path `"<path>[]"`.
     */
    refersTo?: DocumentPropertyReferenceTarget;
};

/**
 * A single typed array property of a document type.
 *
 * Mirrors the typed array form of the v3 document meta-schema, which is
 * active from protocol version 14. The field names are the schema
 * keywords' own, but the values are the parsed property's: `contract.toJSON()`
 * shows the schema as the contract was sent, so an element written with a
 * shorthand (`{ type: 'bytes', size: 20 }`) or as a long-form identifier
 * appears there as written, while `items` here gives its parsed kind and
 * bounds.
 */
export type DocumentTypedArrayProperty = {
    /**
     * Dotted path of the property within the document type, for example
     * `"reasons"`, or `"team.members"` for one nested in an object.
     */
    path: string;
    /** What every element is. */
    items: DocumentTypedArrayItem;
    /** The fewest elements a document may hold; absent when not declared. */
    minItems?: number;
    /** The most elements a document may hold; every typed array declares it. */
    maxItems: number;
    /** Whether a document repeating an element is refused. */
    uniqueItems: boolean;
};



/**
 * Where a sub-query's derived values come from: `'page'` for the page's
 * proven documents, or the index of an earlier `documents` sub-query.
 */
export type CompositeBindSource = 'page' | number;

/**
 * The derived clause of a sub-query: `<field> IN <values>`, the values
 * read off the source's proven documents. The request never names them.
 */
export interface CompositeBind {
    /** Defaults to `'page'`. */
    source?: CompositeBindSource;
    /**
     * The source property read off each document: `$id`, `$ownerId`, or an
     * identifier-typed property (dotted paths reach nested properties).
     */
    sourceProperty: string;
    /**
     * The sub-query field receiving the `IN` clause. `$id` makes this a
     * by-id JOIN (the source property must declare `refersTo:
     * permanentDocument`, where a missing document is a verification
     * error, `refersTo: moderatedDocument`, where a document a moderator
     * removed is reported by its proven removal record, or `refersTo:
     * deletableDocument`, where a document deleted since is proven absent
     * and left out, targeting the sub-query's
     * document type, and whose `refersTo` carries no `lookup`: a reference
     * resolved through a unique index holds no document ids); otherwise
     * `$ownerId` or an indexed property (a LOOKUP, where absence is a proven
     * fact).
     */
    field: string;
}

/**
 * One sub-query of a composite request.
 */
export interface CompositeSubQuery {
    /** Defaults to the page's contract. Any contract works (profiles keyed by owner, names by identity). */
    dataContractId?: string | Uint8Array;
    documentType: string;
    /** `'documents'` (default) returns the matching documents; `'counts'` one count per derived value. */
    kind?: 'documents' | 'counts';
    /** The FIXED clauses, same shape as a documents query's `where`. Must not name the bound field. */
    where?: any[];
    /**
     * Ordering (documents only), same shape as a documents query's `orderBy`.
     * Every component walks in the page's direction: leave the bound field
     * unordered and it inherits that direction; an ordering that disagrees
     * with the page's direction is refused.
     */
    orderBy?: any[];
    /**
     * Required for a documents lookup on a non-unique index: caps the rows the
     * lookup returns in total, in walk order, like an ordinary query's limit
     * (at most 100). Forbidden for a lookup already bounded by its values, a
     * by-id join, and a count.
     */
    limit?: number;
    /** The derived clause. Omit for a SIBLING: an independent documents query proven under the same root. */
    bind?: CompositeBind;
}

/**
 * A composite document query: the page plus its sub-queries, in binding
 * order (a sub-query may bind only the page or an earlier `documents`
 * sub-query). Paginate with a range clause on the page's ordering
 * property; there is no cursor on this surface.
 */
export interface CompositeDocumentsQuery {
    dataContractId: string | Uint8Array;
    documentType: string;
    /** Page where clauses, same shape as a documents query's `where`. */
    where?: any[];
    /** Page ordering, same shape as a documents query's `orderBy`. */
    orderBy?: any[];
    /** REQUIRED page size — it bounds every derived clause, so there is no server-default fallback. */
    limit: number;
    /** Between 1 and 10. */
    subQueries: CompositeSubQuery[];
}

/**
 * A verified `documents` sub-result: a by-id join in first-appearance
 * order of the derived ids among the source documents; a lookup or
 * sibling in query order.
 */
export interface CompositeDocumentsSubResult {
    kind: 'documents';
    documents: Document[];
    /**
     * By-id joins only: the derived ids that have NO document, in
     * first-appearance order (referenced documents deleted since, each one
     * a proven absence). Empty for a lookup or sibling, and always empty
     * for a join off a `permanentDocument` or `moderatedDocument` property.
     */
    missingIds: Identifier[];
    /**
     * By-id joins off a `moderatedDocument` property only: the derived ids
     * whose document the contract's moderators removed, each with its
     * proven removal record, in first-appearance order. Empty for every
     * other sub-query.
     */
    removed: JoinedDocumentRemoval[];
}

/**
 * A verified `counts` sub-result: one entry per derived value that has a
 * count, keyed by the value's base58 identifier. A value with no entry
 * counts zero.
 */
export interface CompositeCountsSubResult {
    kind: 'counts';
    counts: Map<string, bigint>;
}

export type CompositeSubResult = CompositeDocumentsSubResult | CompositeCountsSubResult;

/**
 * A verified composite result.
 */
export interface CompositeDocumentsResult {
    /** The page, exactly as the page query alone would return it. */
    pageDocuments: Document[];
    /** One result per sub-query, in request order. */
    subResults: CompositeSubResult[];
}



/**
 * Which kind of member of a contract group to read: contracts that joined as a whole,
 * document types, or tokens.
 */
export type ContractGroupMemberKind = 'contracts' | 'documentTypes' | 'tokens';

/**
 * A members page cursor: the last entry of the page before. `documentTypeName` goes with
 * `kind: 'documentTypes'`, `tokenPosition` with `kind: 'tokens'`; neither with `'contracts'`.
 */
export interface ContractGroupMemberCursor {
    contractId: IdentifierLike;
    documentTypeName?: string;
    tokenPosition?: number;
}

/**
 * Query parameters for one page of a contract group's members (`getContractGroupMembers`).
 */
export interface ContractGroupMembersQuery {
    /** The contract group to read. */
    contractGroupId: IdentifierLike;
    /** Which kind of member to read. */
    kind: ContractGroupMemberKind;
    /** Continue after this entry; omit for the first page. Use the page's `nextStartAfter`. */
    startAfter?: ContractGroupMemberCursor;
    /**
     * Maximum number of members to return, 1 to 100.
     * @default 100
     */
    limit?: number;
}

/** A document type that belongs to a contract group. */
export interface ContractGroupDocumentTypeMember {
    contractId: string;
    documentTypeName: string;
}

/** A token that belongs to a contract group. */
export interface ContractGroupTokenMember {
    contractId: string;
    tokenPosition: number;
}

/**
 * One page of a contract group's members of one kind, in key order. Only the list named by
 * `kind` is set. `nextStartAfter` is the cursor of the next page and is absent when this
 * page is empty, which makes it the last one. An absent group and a group with no members
 * of that kind both answer with an empty page; use `getContractGroupInfo` to tell them apart.
 */
export interface ContractGroupMembersPage {
    kind: ContractGroupMemberKind;
    contracts?: string[];
    documentTypes?: ContractGroupDocumentTypeMember[];
    tokens?: ContractGroupTokenMember[];
    nextStartAfter?: {
        contractId: string;
        documentTypeName?: string;
        tokenPosition?: number;
    };
}

/**
 * The contract groups a contract belongs to (`getContractGroupsForContract`): as a whole,
 * through its document types (keyed by name) and through its tokens (keyed by position).
 * Every entry is empty when the contract belongs to no group.
 */
export interface ContractGroupMemberships {
    contract: string[];
    documentTypes: Record<string, string[]>;
    tokens: Record<string, string[]>;
}



/** A document a moderation reason is about. */
export interface ContractModerationDocument {
    /** The document type of the document, on the moderated contract. */
    documentTypeName: string;
    /** The document's id, as a base58 string. */
    documentId: string;
}

/**
 * Why a moderator banned, suspended or warned an identity, or deleted a document. Every ban,
 * every suspension, every warning, every document deletion and every proposal of a settled
 * document's deletion carries one, and it is stored with the entry, the removal record or the
 * team action. Nothing checks what a moderator writes, and the documents a reason cites are not
 * looked up, except the reason document a seated elected team names, which its proposal must
 * list.
 */
export interface ContractModerationReason {
    /**
     * Reserved for the ban codes a contract may declare in a later protocol version: a u16,
     * expected to be left out today. A value is stored as written and never checked. A reason
     * read back always carries it, `null` when there is none.
     */
    code?: number | null;
    /** Free text, at most 1024 bytes of UTF-8. May be empty. */
    text: string;
    /**
     * The documents the reason is about: the posts a warning or a ban is for. At most 16,
     * none twice. A reason read back carries it only when there are any.
     */
    documents?: ContractModerationDocument[];
    /**
     * The `reason` document of the moderation charters contract the action is taken on, as a
     * base58 string. A seated elected team's ban, suspension, warning, document deletion or
     * proposal of a settled document's deletion must name one its proposal lists; for every
     * other moderator it is stored as written. A reason read back carries it only when there
     * is one.
     */
    reasonDocumentId?: string;
}

/** One warning an identity carries on a contract's warning list. */
export interface ContractWarning {
    /** The time of the block that issued it, in milliseconds. */
    warnedAt: bigint;
    /** Why, as the moderator wrote it. */
    reason: ContractModerationReason;
}

/**
 * What a moderation transition does on a contract, to one identity or to one document. The
 * wire shape of the action, as the transition's `action` field carries it.
 */
export type ContractUserModerationActionJSON =
| { $type: "ban"; identityId: string; reason: ContractModerationReason }
| { $type: "unban"; identityId: string }
| { $type: "suspend"; identityId: string; until: number | string; reason: ContractModerationReason }
| { $type: "unsuspend"; identityId: string }
| { $type: "warn"; identityId: string; reason: ContractModerationReason }
| { $type: "clearWarnings"; identityId: string }
| { $type: "deleteDocument"; documentTypeName: string; documentId: string; reason: ContractModerationReason }
| { $type: "restoreDocument"; documentTypeName: string; document: string }
| { $type: "changeDocumentFields"; documentTypeName: string; documentId: string; fields: Record<string, unknown>; reason: ContractModerationReason }
| { $type: "deleteSettledDocument"; documentTypeName: string; documentId: string; reason: ContractModerationReason }
| { $type: "approveTeamAction"; actionId: string };

/**
 * Bans, unbans, suspends, unsuspends, warns or clears the warnings of one identity on a
 * moderated data contract, or deletes one document of a document type that sets
 * `moderatorAbilities.delete`, or restores one such document a moderator deleted, or sets the
 * fields a document type keeps for its moderators (`moderatorAbilities.changeFields`) on one of
 * its documents, or proposes, as a member of the contract's seated team, the deletion of a
 * settled document of a type that sets `moderatorAbilities.deleteSettled`, or approves a team
 * action another member proposed (protocol version 14).
 * Signed by the contract owner or a moderator its config names, with a CRITICAL
 * authentication key, under the signer's contract-scoped nonce.
 */
export interface ContractUserModerationTransitionOptions {
    /** The moderator that signs */
    ownerId: IdentifierLike;
    /** The moderated contract */
    dataContractId: IdentifierLike;
    /** The signer's nonce for the contract */
    identityContractNonce: bigint;
    /** What is done */
    action: "ban" | "unban" | "suspend" | "unsuspend" | "warn" | "clearWarnings" | "deleteDocument" | "restoreDocument" | "changeDocumentFields" | "deleteSettledDocument" | "approveTeamAction";
    /**
     * The identity the action targets. Needed by every action but a deleteDocument, a
     * restoreDocument, a changeDocumentFields and a deleteSettledDocument, which name a
     * document instead and refuse it, and an approveTeamAction, which names a team action.
     */
    identityId?: IdentifierLike;
    /**
     * For a deleteDocument, a restoreDocument, a changeDocumentFields or a
     * deleteSettledDocument, which need it: the document type of the document. Refused beside
     * another action.
     */
    documentTypeName?: string;
    /**
     * For a deleteDocument, a changeDocumentFields or a deleteSettledDocument, which need it:
     * the document. Refused beside another action.
     */
    documentId?: IdentifierLike;
    /**
     * For a changeDocumentFields, which needs it: each field the change sets, by its top-level
     * property name, `null` removing it. Every one must be a field the document type keeps for
     * its moderators (`moderatorAbilities.changeFields`). Refused beside another action.
     */
    fields?: Record<string, unknown>;
    /**
     * For a restoreDocument, which needs it: the document as it was serialized under its
     * document type when it was deleted (`Document.toBytes()` of the document as fetched
     * before the deletion), which must hash to what its removal record holds. Refused beside
     * another action.
     */
    document?: Uint8Array;
    /**
     * For an approveTeamAction, which needs it: the team action approved, by the id its
     * proposal returned (a deleteSettledDocument's `actionId`). Refused beside another action.
     */
    actionId?: IdentifierLike;
    /** For a suspend: the block time, in milliseconds, at which the suspension lapses */
    until?: bigint;
    /**
     * Why. A ban, a suspend, a warn and a deleteSettledDocument each need one: the proposal of
     * a settled document's deletion names a reason document the seated team's proposal lists,
     * and its approvals approve it for that reason. A deleteDocument and a changeDocumentFields
     * may leave it out, which stores no code and an empty text. Refused beside an unban, an
     * unsuspend, a clearWarnings, a restoreDocument or an approveTeamAction.
     */
    reason?: ContractModerationReason;
    userFeeIncrease?: number;
}

/**
 * ContractUserModeration serialized as a plain object.
 */
export interface ContractUserModerationObject {
    ownerId: Uint8Array;
    dataContractId: Uint8Array;
    identityContractNonce: bigint;
    action: {
        $type: string;
        identityId?: Uint8Array;
        documentTypeName?: string;
        documentId?: Uint8Array;
        document?: Uint8Array;
        fields?: Record<string, unknown>;
        actionId?: Uint8Array;
        until?: bigint;
        reason?: ContractModerationReason;
    };
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * ContractUserModeration serialized as JSON.
 */
export interface ContractUserModerationJSON {
    ownerId: string;
    dataContractId: string;
    identityContractNonce: number | string;
    action: ContractUserModerationActionJSON;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



/** One of the moderation lists a moderated contract may keep. */
export type ContractModerationListKind = 'banlist' | 'suspensions' | 'warnings';

/**
 * Query parameters for one identity's status on a moderated contract
 * (`getContractModerationStatus`).
 */
export interface ContractModerationStatusQuery {
    /** The moderated contract. */
    contractId: IdentifierLike;
    /** The identity. */
    identityId: IdentifierLike;
    /**
     * The lists to read; each must be one the contract keeps (see the contract's
     * `config.moderation`). Omit to read every list the contract keeps, which costs one
     * extra request for the contract.
     */
    lists?: ContractModerationListKind[];
}

/**
 * One identity's status on the lists of a moderated contract that were read. A list that was
 * not read says nothing: `banned` is undefined, not false, unless `lists` includes `banlist`.
 */
export interface ContractModerationStatus {
    /** The lists this status covers: the ones the query named, or every list the contract keeps. */
    lists: ContractModerationListKind[];
    /** Set when `lists` includes `banlist`: the identity is on the banlist. */
    banned?: boolean;
    /** When the identity is banned: why, as the moderator wrote it. */
    banReason?: ContractModerationReason;
    /**
     * When `lists` includes `suspensions`: the block time, in milliseconds, until which the
     * identity is suspended; undefined when it is not. A lapsed suspension stays until the
     * identity's next document transition sweeps it.
     */
    suspendedUntil?: bigint;
    /** When the identity is suspended: why, as the moderator wrote it. */
    suspensionReason?: ContractModerationReason;
    /**
     * When `lists` includes `warnings`: the identity's warnings, oldest first, an empty array
     * when it carries none. Warnings bar nothing and stay until a moderator clears them.
     */
    warnings?: ContractWarning[];
}

/**
 * Query parameters for one page of a moderated contract's banlist, suspension list or
 * warning list (`getContractModerationEntries`).
 */
export interface ContractModerationEntriesQuery {
    /** The moderated contract. */
    contractId: IdentifierLike;
    /** The list to read; the contract must keep it. */
    list: ContractModerationListKind;
    /** Continue after this identity; omit for the first page. Use the page's `nextStartAfter`. */
    startAfter?: IdentifierLike;
    /**
     * Maximum number of entries to return, 1 to 100.
     * @default 100
     */
    limit?: number;
}

/** One entry of a moderation list. */
export interface ContractModerationEntry {
    identityId: string;
    /** For a suspension list entry: the block time, in milliseconds, at which it lapses. */
    until?: bigint;
    /**
     * Why the identity is on the list, as the moderator wrote it: the ban's reason, the
     * suspension's, or for a warning list entry the latest warning's.
     */
    reason: ContractModerationReason;
    /** For a warning list entry: every warning the identity carries, oldest first. */
    warnings?: ContractWarning[];
}

/**
 * One page of a moderation list, in identity id order. `nextStartAfter` is the cursor of the
 * next page and is absent when this page holds fewer entries than the limit, which makes it
 * the last one.
 */
export interface ContractModerationEntriesPage {
    entries: ContractModerationEntry[];
    nextStartAfter?: string;
}

/**
 * Query parameters for the records of the documents a contract's moderators deleted within one
 * document type (`getContractDocumentRemovals`): the records of the documents `documentIds`
 * names, or else one page of them all.
 */
export interface ContractDocumentRemovalsQuery {
    /** The moderated contract. */
    contractId: IdentifierLike;
    /**
     * The document type; it must set `moderatorAbilities.delete` and not
     * `moderatorAbilities.deleteKeepsRecord: false`, as no other keeps records.
     */
    documentTypeName: string;
    /**
     * Read the records of these documents alone, 1 to 100 distinct ids. A document with no
     * record is left out of the answer. Refused beside `startAfter` or `limit`.
     */
    documentIds?: IdentifierLike[];
    /** Continue after this document; omit for the first page. Use the page's `nextStartAfter`. */
    startAfter?: IdentifierLike;
    /**
     * Maximum number of records to return, 1 to 100.
     * @default 100
     */
    limit?: number;
}

/**
 * The record a contract keeps of one document a moderator deleted. A document id is produced
 * at most once, so the removed id can not be created again; what can bring the document back
 * is a moderator's restore within a week of the deletion, which marks the record restored and
 * leaves it in place. A restored document deleted again gets a fresh record.
 */
export interface ContractDocumentRemovalEntry {
    documentId: string;
    /** The identity that owned the document when it was removed. */
    documentOwnerId: string;
    /** The contract owner or moderator that removed it. */
    moderatorId: string;
    /** Why, as the moderator wrote it: the text may be empty. */
    reason: ContractModerationReason;
    /** The time of the block that removed it, in milliseconds. */
    removedAt: bigint;
    /**
     * A double SHA-256 of the document as it was serialized under its type when it was
     * removed, as 64 hex characters: what a restore must bring back byte for byte.
     */
    documentHash: string;
    /** The contract owner or moderator that restored the document; absent while the removal stands. */
    restoredBy?: string;
    /** The time of the block that restored it, in milliseconds; absent while the removal stands. */
    restoredAt?: bigint;
    /**
     * The values the record keeps of the document, by the property path its type lists under
     * `moderatorAbilities.deleteKeepsFields` (`hashtag`, `meta.tags`, `$createdAt`), copied from
     * it as it was removed and shown as the document's `properties` show them: what of it stays
     * public once it is gone. Empty when the type keeps none; a path the document held no value
     * at is absent.
     */
    keptFields: Record<string, unknown>;
}

/**
 * Removal records in document id order. For a page, `nextStartAfter` is the cursor of the next
 * page and is absent when this page holds fewer records than the limit, which makes it the
 * last one. A read by `documentIds` never carries one.
 */
export interface ContractDocumentRemovalsPage {
    removals: ContractDocumentRemovalEntry[];
    nextStartAfter?: string;
}

/**
 * A team action's status: `active` while its approvals fall short of its rule, `closed` once
 * they met it and the action ran.
 */
export type ContractTeamActionStatus = 'active' | 'closed';

/**
 * Query parameters for one page of the actions an elected contract's seated moderation team
 * votes on (`getContractTeamActions`), active or closed, in action id order.
 */
export interface ContractTeamActionsQuery {
    /** The elected contract. */
    contractId: IdentifierLike;
    /** Which actions to read: those still gathering approvals, or those that ran. */
    status: ContractTeamActionStatus;
    /**
     * Start the page at this action; omit for the first page. Use the page's
     * `nextStartAtActionId`.
     */
    startAtActionId?: IdentifierLike;
    /**
     * Whether the page includes the `startAtActionId` action itself. Refused without
     * `startAtActionId`.
     * @default false
     */
    startAtActionIdIncluded?: boolean;
    /**
     * Maximum number of actions to return, 1 to 100.
     * @default 100
     */
    limit?: number | bigint;
}

/**
 * What a team action does once its approvals meet its rule: today the deletion of a settled
 * document, one last modified longer ago than its type's `moderatorAbilities.deleteWithin`
 * window, which the type's `moderatorAbilities.deleteSettled` lets the seated team delete
 * together.
 */
export interface ContractTeamActionDeleteSettledDocument {
    type: 'deleteSettledDocument';
    /** The document's type. */
    documentTypeName: string;
    /** The document. */
    documentId: string;
    /**
     * The document's `$updatedAt` (or `$createdAt`) when proposed, in milliseconds: the
     * approvals are of the document as it was then.
     */
    documentLastModifiedAt: bigint;
    /**
     * The document's `$revision` when proposed; absent on a type whose documents carry none.
     * An approval of a document changed since, a moderator's change of its fields included, is
     * refused.
     */
    documentRevision?: bigint;
    /** Why, as the proposer gave it: stored with the removal record the deletion leaves. */
    reason: ContractModerationReason;
}

/** What a team action does once approved. */
export type ContractTeamActionEvent = ContractTeamActionDeleteSettledDocument;

/**
 * One action an elected contract's seated moderation team votes on: one member proposes it,
 * which is its own approval, and the others approve it by its id until the approvals meet its
 * rule, when it runs and closes. A proposal never lapses. Use `getContractTeamActionSigners`
 * for who approved it.
 */
export interface ContractTeamActionEntry {
    /** The action's id: what the other members approve it by. */
    actionId: string;
    /** The member of the seated team that proposed it. */
    proposerId: string;
    /** The time of the block of the proposal, in milliseconds. */
    proposedAt: bigint;
    /** What it does once approved. */
    event: ContractTeamActionEvent;
    /**
     * How many approvals it holds, the proposer's among them: an active action's so far, a closed
     * one's that counted when it ran. An active action's is an upper bound: the approval of a
     * member who left the team is dropped only when a later approval reads the team, and is
     * counted here until then. For the exact figure, read the action's `signerIds`
     * (`getContractTeamActionSigners`) and keep those the team (`getModerationTeam`) `contains`:
     * worth it only for an action whose count could meet its rule.
     */
    approvalCount: number;
}

/**
 * One page of team actions, in action id order. `nextStartAtActionId` is the cursor of the
 * next page and is absent when this page holds fewer actions than the limit, which makes it the
 * last one.
 */
export interface ContractTeamActionsPage {
    actions: ContractTeamActionEntry[];
    nextStartAtActionId?: string;
}

/**
 * Query parameters for who approved one of the actions an elected contract's seated moderation
 * team votes on (`getContractTeamActionSigners`). The action is looked up among the actions of
 * `status` alone: one that closed is no longer among the active ones.
 */
export interface ContractTeamActionSignersQuery {
    /** The elected contract. */
    contractId: IdentifierLike;
    /** Whether the action is active or closed. */
    status: ContractTeamActionStatus;
    /** The action. */
    actionId: IdentifierLike;
}

/**
 * The members that approved a team action, the proposer among them unless it left the team
 * and its approval was dropped, in identity id order; none when the contract holds no action
 * of that id with the status asked. A closed action keeps the approvals that counted when it
 * ran.
 */
export interface ContractTeamActionSigners {
    signerIds: string[];
}

/** How many counted moderation actions one member of a seated team signed since the last payout. */
export interface ContractModerationActionCount {
    /** The member, base58. */
    identityId: string;
    /** How many bans, suspensions, warnings and document deletions it signed. */
    count: number;
}

/**
 * How many counted moderation actions (a ban, a suspension, a warning or a document deletion)
 * each member of an elected contract's seated team signed since the moderators pot was last
 * paid out, which resets every count, in identity id order. A member that did not act since
 * has no count. The action share of a claim splits by them; what a claim pays each member
 * also depends on the pot (`getContractFeePots`) and the team's `submittedCharter`
 * (`rewardSplit`), whose leader and equal shares are paid first.
 */
export interface ContractModerationActionCounts {
    counts: ContractModerationActionCount[];
}



/** One of the two pots the document action fees of a contract collect in. */
export type ContractFeePotKind = 'owner' | 'moderators';

/** What one fee pot of a contract holds. */
export interface ContractFeePotState {
    /** The credits in the pot: what a claim would pay out, less what an equal split leaves over. */
    credits: bigint;
    /**
     * The epoch the pot was last paid out in; undefined when it never was. A pot is paid out at
     * most once per epoch, so a claim in this epoch is refused.
     */
    lastClaimEpoch?: number;
    /** The time, in milliseconds, of the block that last paid the pot out; set with `lastClaimEpoch`. */
    lastClaimTimeMs?: bigint;
    /**
     * The identity that signed the last claim, base58; set with `lastClaimEpoch`. The contract
     * owner for the owner pot, and for the moderators pot the member of the moderation team
     * that claimed it for the team.
     */
    lastClaimantId?: string;
}

/**
 * The fee pots of a contract. A contract that charges no action fees, or whose fees nobody has
 * paid yet, has two empty pots.
 */
export interface ContractFeePots {
    /** The pot the contract owner claims. */
    owner: ContractFeePotState;
    /** The pot the contract's moderation team shares; any member claims it for all of them. */
    moderators: ContractFeePotState;
}



/** One page of the proposals for a contract (`getModerationSubmittedCharters`). */
export interface ModerationSubmittedChartersQuery {
    /** The contract the proposals are for. */
    targetContractId: IdentifierLike;
    /** Continue after this proposal; omit for the first page. */
    startAfter?: IdentifierLike;
    /**
     * Maximum number of proposals to return, 1 to 100.
     * @default 100
     */
    limit?: number;
}

/** One page of the join requests for a proposal (`getModerationJoinRequests`). */
export interface ModerationJoinRequestsQuery {
    /** The proposal, a `submittedCharter` document. */
    submittedCharterId: IdentifierLike;
    /** Continue after this join request; omit for the first page. */
    startAfter?: IdentifierLike;
    /**
     * Maximum number of join requests to return, 1 to 100.
     * @default 100
     */
    limit?: number;
}

/**
 * Options for `buildModerationJoinRequest`: an identity's offer to serve on the team of a
 * proposal, with a message only the proposal's leader can read.
 */
export interface ModerationJoinRequestOptions {
    /** The proposal, a `submittedCharter` document. */
    submittedCharterId: IdentifierLike;
    /** Why the writer wants to join, at most 1023 bytes. A string is encoded as UTF-8. */
    message: Uint8Array | string;
    /** The identity offering to serve, the request's owner: an `Identity`, or its id to fetch it. */
    writer: Identity | IdentifierLike;
    /** The private half of the writer's encryption key bound to `joinRequest`. */
    writerEncryptionKey: PrivateKey;
}

/**
 * Options for `buildModerationResignationRequest`: a member's request to leave a seated team,
 * with a message only the leader can read. The leader acts on it with a removal; deleting the
 * document withdraws it.
 */
export interface ModerationResignationRequestOptions {
    /** The seated charter, an `electedCharter` document. */
    electedCharterId: IdentifierLike;
    /** Why the member leaves, at most 1023 bytes. A string is encoded as UTF-8. */
    message: Uint8Array | string;
    /** The member, the request's owner: an `Identity`, or its id to fetch it. */
    writer: Identity | IdentifierLike;
    /** The private half of the writer's encryption key bound to `joinRequest`. */
    writerEncryptionKey: PrivateKey;
}



/** What to assume when pricing a document create. Every field is optional. */
export interface DocumentCreateCostOptions {
    /**
     * The document to price, by field (`a.b` for a property of an object):
     * whether an optional field is present (default: present), and the length
     * of a variable-size one, in characters, bytes or elements (default: the
     * middle between its bounds, the size Drive's own fee estimates assume).
     */
    fields?: Record<string, { present?: boolean; length?: number }>;
    /** Documents of the type already stored, for the processing estimate (default 1000). */
    existingDocuments?: number;
    /** The type of the key the transition is signed with (default ECDSA_SECP256K1). */
    signatureKeyType?: 'ECDSA_SECP256K1' | 'BLS12_381' | 'ECDSA_HASH160' | 'BIP13_SCRIPT_HASH' | 'EDDSA_25519_HASH160';
    /** The fee increase the transition asks for, in percent of the processing fee (default 0). */
    userFeeIncrease?: number;
    /** The epoch's fee multiplier in permille, for action fees priced by it (default 1000). */
    feeMultiplierPermille?: number;
    /** Contenders already in the contest, for a contested create (default 0). */
    contenders?: number;
}

/**
 * An amount under both storage scenarios: every index value new (the first
 * document with these values creates their trees), and every value an
 * earlier document can hold already stored.
 */
export interface DocumentCostScenarios {
    newValues: number;
    knownValues: number;
}

/** What creating one document of a type costs; amounts in credits (1 Dash = `creditsPerDash`). */
export interface DocumentCreateCost {
    documentType: string;
    assumptions: {
        existingDocuments: number;
        signatureKeyType: string;
        userFeeIncrease: number;
        feeMultiplierPermille: number;
        contenders: number;
    };
    /** The serialized document, in bytes. */
    documentBytes: number;
    /** What a stored byte costs: 27,000 credits, or a ttl type's price for its lifetime. */
    creditsPerByte: number;
    creditsPerDash: number;
    storage: {
        bytes: DocumentCostScenarios;
        credits: DocumentCostScenarios;
        /** The document by id. */
        primaryBytes: DocumentCostScenarios;
        /** Trees created for preallocated indexes of types that will reference the document. */
        preallocatedBytes: DocumentCostScenarios;
        /** A document with a ttl's entry in the documents expirations tree. */
        expirationBytes: DocumentCostScenarios;
    };
    /** Each index: the bytes of the layers it shares with other indexes (counted once) and of its own. */
    indexes: Array<{
        name: string;
        sharedWith: string[];
        sharedBytes: DocumentCostScenarios;
        ownBytes: DocumentCostScenarios;
    }>;
    /** Every element the insert writes. */
    elements: Array<{
        role: string;
        path: string[];
        bytes: number;
        indexes: string[];
        /** Written only when absent: a tree an earlier document with the same values created. */
        ifAbsent: boolean;
        writtenWhenValuesKnown: boolean;
        /** On a time window with a ttl: priced as processing. */
        ephemeral: boolean;
        /** In the documents expirations tree: a document with a ttl's entry. */
        expiration: boolean;
        /** The axis, when the element is a ranked tree's row for the value. */
        rankingAxis?: 'count' | 'sum' | 'avg';
        /** The type whose tree the element is in, when it is a preallocated index's. */
        referringType?: string;
    }>;
    /** The processing fee, part by part; `exact: false` parts are estimated from the assumptions. */
    processing: Array<{ code: string; text: string; credits: DocumentCostScenarios; exact: boolean }>;
    processingCredits: DocumentCostScenarios;
    contractCharges: Array<
    | { kind: 'actionFee'; pricing: 'feeMultiplier' | 'fixed'; declared: { owner: number; moderators: number }; charged: { owner: number; moderators: number } }
    | { kind: 'tokenCost'; tokenPosition: number; amount: number; effect: 'transferToContractOwner' | 'burn'; gasFeesPaidBy: string; optional: boolean; tokenContractId?: string }
    /** Paid when the value is contested; such a create is stored in the vote poll until the contest ends, and that storage is not priced here. */
    | { kind: 'contestFund'; index: string; credits: number }
    >;
    /** The storage fee a delete refunds, in the same epoch and a year later (nothing for a ttl type). */
    refund: { sameEpoch: DocumentCostScenarios; afterOneYear: DocumentCostScenarios };
    /** Storage, processing and action fees; not a token cost or a contest fund. */
    totalCredits: DocumentCostScenarios;
    /** How each field of the priced document was filled; a length only for a variable-size field. */
    fields: Array<{
        path: string;
        kind: string;
        optional: boolean;
        present: boolean;
        length?: number;
        minLength?: number;
        maxLength?: number;
    }>;
}



export interface AddressCreditWithdrawalTransitionOptions {
    inputs: PlatformAddressInput[];
    output?: PlatformAddressOutput;
    outputScript: CoreScript;
    pooling: CreditWithdrawalTransitionPoolingLike;
    coreFeePerByte: number;
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
}

export interface AddressCreditWithdrawalTransitionObject {
    inputs: PlatformAddressInputObject[];
    output?: PlatformAddressOutputObject;
    outputScript: Uint8Array;
    pooling: number;
    coreFeePerByte: number;
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
}

export interface AddressCreditWithdrawalTransitionJSON {
    inputs: PlatformAddressInputJSON[];
    output?: PlatformAddressOutputJSON;
    outputScript: string;
    pooling: string;
    coreFeePerByte: number;
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
}



export interface AddressFundingFromAssetLockTransitionOptions {
    assetLockProof: AssetLockProof;
    inputs: PlatformAddressInput[];
    outputs: PlatformAddressOutput[];
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
}

export interface AddressFundingFromAssetLockTransitionObject {
    assetLockProof: AssetLockProofObject;
    inputs: PlatformAddressInputObject[];
    outputs: PlatformAddressOutputObject[];
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
}

export interface AddressFundingFromAssetLockTransitionJSON {
    assetLockProof: AssetLockProofJSON;
    inputs: PlatformAddressInputJSON[];
    outputs: PlatformAddressOutputJSON[];
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
}



export interface AddressFundsTransferTransitionOptions {
    inputs: PlatformAddressInput[];
    outputs: PlatformAddressOutput[];
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
}

export interface AddressFundsTransferTransitionObject {
    inputs: PlatformAddressInputObject[];
    outputs: PlatformAddressOutputObject[];
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
}

export interface AddressFundsTransferTransitionJSON {
    inputs: PlatformAddressInputJSON[];
    outputs: PlatformAddressOutputJSON[];
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
}



export interface ChangeControlRulesOptions {
    authorizedToMakeChange: AuthorizedActionTakers;
    adminActionTakers: AuthorizedActionTakers;
    isChangingAuthorizedActionTakersToNoOneAllowed?: boolean;
    isChangingAdminActionTakersToNoOneAllowed?: boolean;
    isSelfChangingAdminActionTakersAllowed?: boolean;
}

export interface CanChangeAdminActionTakersOptions {
    adminActionTakers: AuthorizedActionTakers;
    contractOwnerId: IdentifierLike;
    mainGroup?: number;
    groups: Record<number, Group>;
    actionTaker: ActionTaker;
    goal: ActionGoalLike;
}



export interface DataContractOptions {
    ownerId: IdentifierLike;
    identityNonce: bigint;
    schemas: object;
    definitions?: object;
    tokens?: Record<number, TokenConfiguration>;
    fullValidation?: boolean;
    platformVersion?: PlatformVersionLike;
}

/**
 * DataContract serialized as a plain object.
 */
export interface DataContractObject {
    $formatVersion: string;
    id: Identifier;
    ownerId: Identifier;
    version: number;
    documentSchemas: Record<string, object>;
    config?: DataContractConfig;
    groups?: Record<number, Group>;
    tokens?: Record<number, TokenConfiguration>;
    [key: string]: unknown;
}

/**
 * DataContract serialized as JSON (with string identifiers).
 */
export interface DataContractJSON {
    $formatVersion: string;
    id: string;
    ownerId: string;
    version: number;
    documentSchemas: Record<string, object>;
    config?: DataContractConfig;
    groups?: Record<number, object>;
    tokens?: Record<number, object>;
    [key: string]: unknown;
}

/**
 * DataContract configuration.
 */
export interface DataContractConfig {
    canBeDeleted: boolean;
    readonly: boolean;
    keepsHistory: boolean;
    documentsKeepHistoryContractDefault: boolean;
    documentsMutableContractDefault: boolean;
    documentsCanBeDeletedContractDefault: boolean;
    requiresIdentityEncryptionBoundedKey?: number;
    requiresIdentityDecryptionBoundedKey?: number;
    /**
     * Contract moderation (protocol version 14): the banlist, suspension list and/or warning
     * list the contract keeps and who may edit them. Absent for an unmoderated contract.
     */
    moderation?: ContractModerationConfig;
}

/**
 * Who may ban, suspend and warn identities on a moderated contract: the owner alone, the owner
 * and a fixed set of identities (at most 16, each of which must exist; the owner always may
 * and need not be named, naming it counts toward the 16), or an elected team.
 *
 * An elected declaration is fixed when the contract is created and never changes. Until a
 * team is seated (no election exists yet) the contract is moderated by its `interim`
 * moderators, or by nobody: with the moderated document types not yet usable (every
 * document transition of one is refused) or used unmoderated meanwhile. Windows and the
 * cool-down are in seconds: the windows at most four weeks, at least one day on mainnet and
 * 0 on any other network (one week when left out), the cool-down of a contestable seat two
 * weeks to three years.
 */
export type ContractModerators =
| { $type: "contractOwner" }
| { $type: "appointedModerators"; identities: string[] }
| ({
    $type: "elected";
    joinWindow?: number;
    voteWindow?: number;
    /**
     * Seconds after the contract's creation before the first charter may be filed
     * against it, unbounded; the election may be called at once when left out. A
     * reference requiring `moderation: 'electionOpen'` reads it.
     */
    electionDelay?: number;
    /**
     * How many members a seated team's leader may add after the election, each one an
     * identity that asked to join the team's proposal; 0 when left out, at most 15.
     */
    maxAddedModerators?: number;
    /**
     * The moderated document types of the contract, each with the non-empty abilities a
     * charter may claim on it: `ban`, `suspend` and `warn` need the list the contract
     * keeps, `deleteDocuments` the type setting `moderatorAbilities.delete`,
     * `changeDocumentFields` the type listing `moderatorAbilities.changeFields`. The lists stay
     * contract-wide. A charter does not price actions: a type's `actionFees.moderators`
     * amount is the most a team may charge.
     */
    moderatedDocumentTypes: Record<string, ModerationAbility[]>;
    interim: InterimModerators;
    /** Whether the owner is protected from the team; false when left out. */
    ownerProtected?: boolean;
} & ElectedModerationSeat);

/**
 * Whether the seat of an elected contract can be contested again once a team is seated,
 * required with no default. A contestable seat declares its `challengeCoolDown`: how long a
 * seated team is safe from a challenge after a seat change. A seat that can not be contested
 * declares none, and its first team keeps it for good. Challenges come after protocol version
 * 14: until then a seat is never contested again, whatever this says.
 */
export type ElectedModerationSeat =
| { seatContestable: true; challengeCoolDown: number }
| { seatContestable: false; challengeCoolDown?: never };

/** What a charter may claim on an elected contract. */
export type ModerationAbility = "deleteDocuments" | "ban" | "suspend" | "warn" | "changeDocumentFields";

/** Who moderates an elected contract until its first team is seated. */
export type InterimModerators =
| { $type: "contractOwner" }
| { $type: "appointedModerators"; identities: string[] }
| { $type: "notYetUsable" }
| { $type: "noModeration" };

/**
 * The moderation a data contract declares. At least one list must be kept, unless a document
 * type gives its moderators an ability (`moderatorAbilities`): moderators that only delete
 * documents or change the fields kept for them need no list. A list that is kept can never be
 * turned off by a contract update.
 */
export interface ContractModerationConfig {
    banlist: boolean;
    suspensions: boolean;
    /** The contract keeps a warning list: warnings bar nothing and accumulate until cleared. */
    warnings: boolean;
    moderators: ContractModerators;
}



export interface DeriveDashpayContactKeyParams {
    mnemonic: string;
    passphrase?: string;
    senderIdentityId: IdentifierLike;
    receiverIdentityId: IdentifierLike;
    account: number;
    addressIndex: number;
    network: string;
}



export interface DeriveKeyFromSeedPhraseParams {
    mnemonic: string;
    passphrase?: string;
    network: string;
}



export interface DeriveKeyFromSeedWithExtendedPathParams {
    mnemonic: string;
    passphrase?: string;
    path: string;
    network: string;
}



export interface DeriveKeyFromSeedWithPathParams {
    mnemonic: string;
    passphrase?: string;
    path: string;
    network: string;
}



export interface DistributionFixedAmountOptions {
    amount: bigint;
}

export interface DistributionRandomOptions {
    min: bigint;
    max: bigint;
}

export interface DistributionStepDecreasingAmountOptions {
    stepCount: number;
    decreasePerIntervalNumerator: number;
    decreasePerIntervalDenominator: number;
    startDecreasingOffset?: bigint;
    maxIntervalCount?: number;
    distributionStartAmount: bigint;
    trailingDistributionIntervalAmount: bigint;
    minValue?: bigint;
}

export interface DistributionLinearOptions {
    a: bigint;
    d: bigint;
    startStep?: bigint;
    startingAmount: bigint;
    minValue?: bigint;
    maxValue?: bigint;
}

export interface DistributionPolynomialOptions {
    a: bigint;
    d: bigint;
    m: bigint;
    n: bigint;
    o: bigint;
    startMoment?: bigint;
    b: bigint;
    minValue?: bigint;
    maxValue?: bigint;
}

export interface DistributionExponentialOptions {
    a: bigint;
    d: bigint;
    m: bigint;
    n: bigint;
    o: bigint;
    startMoment?: bigint;
    b: bigint;
    minValue?: bigint;
    maxValue?: bigint;
}

export interface DistributionLogarithmicOptions {
    a: bigint;
    d: bigint;
    m: bigint;
    n: bigint;
    o: bigint;
    startMoment?: bigint;
    b: bigint;
    minValue?: bigint;
    maxValue?: bigint;
}

export interface DistributionInvertedLogarithmicOptions {
    a: bigint;
    d: bigint;
    m: bigint;
    n: bigint;
    o: bigint;
    startMoment?: bigint;
    b: bigint;
    minValue?: bigint;
    maxValue?: bigint;
}



export interface DocumentBaseTransitionOptions {
    documentId: IdentifierLike;
    identityContractNonce: bigint;
    documentTypeName: string;
    dataContractId: IdentifierLike;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface DocumentCreateTransitionOptions {
    /**
     * The document to create. Its id is derived here from its entropy and
     * `identityContractNonce` (from protocol version 14 the id of a new
     * document commits to that nonce), replacing whatever id the document
     * carried, and written back onto this object: after construction
     * `document.id` equals `transition.base.id`.
     */
    document: Document;
    identityContractNonce: bigint;
    /**
     * The contested index the document falls under and what it pays into that
     * contest. Required when the document enters a contest, or the create is
     * refused and still pays its fees. From protocol version 14 the amount is
     * the most it pays: it is charged the fund to join and refused when that is
     * more. Before 14 it must be exactly the contest's fund.
     * `sdk.documents.contestFundToJoin(document)` in the SDK returns the one to
     * state now.
     */
    prefundedVotingBalance?: PrefundedVotingBalance;
    /**
     * The contract of `document`. When given and `prefundedVotingBalance` is
     * not, a document that enters a contest states the contest's fund on its
     * contested index, as the Rust builder does: what joining costs while the
     * contest holds fewer than 250 contenders.
     */
    dataContract?: DataContract;
    /**
     * The most, in credits, a contested create pays into its contest (protocol
     * version 14), stated in place of the amount of its prefunded voting
     * balance. Needs `dataContract` or `prefundedVotingBalance` to name the
     * contested index. A document that joins no contest ignores it.
     */
    contestFund?: bigint;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
    /** Platform version the id is derived for (default: latest) */
    platformVersion?: PlatformVersionLike;
}



export interface DocumentDeleteTransitionOptions {
    document: Document;
    identityContractNonce: bigint;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface DocumentPurchaseTransitionOptions {
    document: Document;
    identityContractNonce: bigint;
    amount: bigint;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface DocumentReplaceTransitionOptions {
    document: Document;
    identityContractNonce: bigint;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface DocumentTransferTransitionOptions {
    document: Document;
    identityContractNonce: bigint;
    recipientOwnerId: IdentifierLike;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface DocumentUpdatePriceTransitionOptions {
    document: Document;
    identityContractNonce: bigint;
    price: bigint;
    tokenPaymentInfo?: TokenPaymentInfo;
    actionFeeAgreement?: DocumentActionFeeAgreement;
}



export interface ExtendedEpochInfoOptions {
    index: number;
    firstBlockTime: bigint;
    firstBlockHeight: bigint;
    firstCoreBlockHeight: number;
    feeMultiplierPermille: bigint;
    protocolVersion: number;
}

/**
 * ExtendedEpochInfo serialized as a plain object.
 */
export interface ExtendedEpochInfoObject {
    index: number;
    firstBlockTime: bigint;
    firstBlockHeight: bigint;
    firstCoreBlockHeight: number;
    feeMultiplierPermille: bigint;
    protocolVersion: number;
}

/**
 * ExtendedEpochInfo serialized as JSON.
 * u64 values within JS safe integer range are numbers, otherwise strings.
 */
export interface ExtendedEpochInfoJSON {
    index: number;
    firstBlockTime: number | string;
    firstBlockHeight: number | string;
    firstCoreBlockHeight: number;
    feeMultiplierPermille: number | string;
    protocolVersion: number;
}



export interface GenerateMnemonicParams {
    wordCount?: number;
    languageCode?: string;
}



export interface IdentityCreateFromAddressesTransitionOptions {
    publicKeys: IdentityPublicKeyInCreation[];
    inputs: PlatformAddressInput[];
    output?: PlatformAddressOutput;
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
}

export interface IdentityCreateFromAddressesTransitionObject {
    publicKeys: IdentityPublicKeyInCreationObject[];
    inputs: PlatformAddressInputObject[];
    output?: PlatformAddressOutputObject;
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
}

export interface IdentityCreateFromAddressesTransitionJSON {
    publicKeys: IdentityPublicKeyInCreationJSON[];
    inputs: PlatformAddressInputJSON[];
    output?: PlatformAddressOutputJSON;
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
}



export interface IdentityCreateTransitionOptions {
    publicKeys: IdentityPublicKeyInCreation[];
    assetLockProof: AssetLockProof;
    signature?: Uint8Array;
    userFeeIncrease?: number;
}

/**
 * IdentityCreateTransition serialized as a plain object.
 */
export interface IdentityCreateTransitionObject {
    publicKeys: IdentityPublicKeyInCreationObject[];
    assetLockProof: AssetLockProofObject;
    signature?: Uint8Array;
    userFeeIncrease: number;
}

/**
 * IdentityCreateTransition serialized as JSON.
 */
export interface IdentityCreateTransitionJSON {
    publicKeys: IdentityPublicKeyInCreationJSON[];
    assetLockProof: AssetLockProofJSON;
    signature?: string;
    userFeeIncrease: number;
}



export interface IdentityCreditTransferOptions {
    amount: bigint;
    senderId: IdentifierLike;
    recipientId: IdentifierLike;
    nonce: bigint;
    userFeeIncrease?: number;
}

/**
 * IdentityCreditTransfer serialized as a plain object.
 */
export interface IdentityCreditTransferObject {
    amount: bigint;
    senderId: Uint8Array;
    recipientId: Uint8Array;
    nonce: bigint;
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * IdentityCreditTransfer serialized as JSON.
 */
export interface IdentityCreditTransferJSON {
    amount: number | string;
    senderId: string;
    recipientId: string;
    nonce: number | string;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



export interface IdentityCreditTransferToAddressesOptions {
    recipientAddresses: PlatformAddressOutput[];
    senderId: IdentifierLike;
    nonce: bigint;
    userFeeIncrease?: number;
}

/**
 * IdentityCreditTransferToAddresses serialized as a plain object.
 */
export interface IdentityCreditTransferToAddressesObject {
    recipientAddresses: PlatformAddressOutputObject[];
    senderId: Uint8Array;
    nonce: bigint;
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * IdentityCreditTransferToAddresses serialized as JSON.
 */
export interface IdentityCreditTransferToAddressesJSON {
    recipientAddresses: PlatformAddressOutputJSON[];
    senderId: string;
    nonce: string;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



export interface IdentityTopUpFromAddressesTransitionOptions {
    identityId: IdentifierLike;
    inputs: PlatformAddressInput[];
    output?: PlatformAddressOutput;
    feeStrategy?: FeeStrategyStep[];
    userFeeIncrease?: number;
}

export interface IdentityTopUpFromAddressesTransitionObject {
    identityId: Uint8Array;
    inputs: PlatformAddressInputObject[];
    output?: PlatformAddressOutputObject;
    feeStrategy: FeeStrategyStepObject[];
    userFeeIncrease: number;
}

export interface IdentityTopUpFromAddressesTransitionJSON {
    identityId: string;
    inputs: PlatformAddressInputJSON[];
    output?: PlatformAddressOutputJSON;
    feeStrategy: FeeStrategyStepJSON[];
    userFeeIncrease: number;
}



export interface IdentityUpdateTransitionOptions {
    identityId: IdentifierLike;
    revision: bigint;
    nonce: bigint;
    addPublicKeys: IdentityPublicKeyInCreation[];
    disablePublicKeys: number[];
    userFeeIncrease?: number;
}

/**
 * IdentityUpdateTransition serialized as a plain object.
 */
export interface IdentityUpdateTransitionObject {
    identityId: Uint8Array;
    revision: bigint;
    nonce: bigint;
    addPublicKeys: IdentityPublicKeyInCreationObject[];
    disablePublicKeys: number[];
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * IdentityUpdateTransition serialized as JSON.
 */
export interface IdentityUpdateTransitionJSON {
    identityId: string;
    revision: number | string;
    nonce: number | string;
    addPublicKeys: IdentityPublicKeyInCreationJSON[];
    disablePublicKeys: number[];
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



export interface MasternodeVoteTransitionOptions {
    proTxHash: IdentifierLike;
    voterIdentityId: IdentifierLike;
    vote: Vote;
    nonce: bigint;
    signaturePublicKeyId?: number;
    signature?: Uint8Array;
}

/**
 * MasternodeVoteTransition serialized as a plain object.
 */
export interface MasternodeVoteTransitionObject {
    proTxHash: Uint8Array;
    voterIdentityId: Uint8Array;
    vote: VoteObject;
    nonce: bigint;
    signaturePublicKeyId?: number;
    signature?: Uint8Array;
}

/**
 * MasternodeVoteTransition serialized as JSON.
 */
export interface MasternodeVoteTransitionJSON {
    proTxHash: string;
    voterIdentityId: string;
    vote: VoteJSON;
    nonce: number | string;
    signaturePublicKeyId?: number;
    signature?: string;
}



export interface PartialIdentityOptions {
    id: IdentifierLike;
    loadedPublicKeys: Record<number, IdentityPublicKey>;
    balance?: bigint;
    revision?: bigint;
    notFoundPublicKeys?: number[];
}

/**
 * PartialIdentity serialized as a plain object.
 */
export interface PartialIdentityObject {
    id: Uint8Array;
    loadedPublicKeys: Record<string, IdentityPublicKeyObject>;
    balance?: bigint;
    revision?: bigint;
    notFoundPublicKeys: number[];
}

/**
 * PartialIdentity serialized as JSON.
 * Note: JSON uses null for missing optional fields (JSON standard).
 */
export interface PartialIdentityJSON {
    id: string;
    loadedPublicKeys: Record<string, IdentityPublicKeyJSON>;
    balance: number | string | null;
    revision: number | string | null;
    notFoundPublicKeys: number[];
}



export interface TokenBaseTransitionOptions {
    identityContractNonce: bigint;
    tokenContractPosition: number;
    dataContractId: IdentifierLike;
    tokenId: IdentifierLike;
    usingGroupInfo?: GroupStateTransitionInfo;
}



export interface TokenBurnTransitionOptions {
    base: TokenBaseTransition;
    burnAmount: bigint;
    publicNote?: string;
}



export interface TokenClaimTransitionOptions {
    base: TokenBaseTransition;
    distributionType?: TokenDistributionTypeLike;
    publicNote?: string;
}



export interface TokenConfigUpdateTransitionOptions {
    base: TokenBaseTransition;
    updateTokenConfigurationItem: TokenConfigurationChangeItem;
    publicNote?: string;
}



export interface TokenConfigurationOptions {
    conventions: TokenConfigurationConvention;
    conventionsChangeRules: ChangeControlRules;
    baseSupply: bigint;
    maxSupply?: bigint;
    keepsHistory: TokenKeepsHistoryRules;
    isStartedAsPaused?: boolean;
    isAllowedTransferToFrozenBalance?: boolean;
    maxSupplyChangeRules: ChangeControlRules;
    distributionRules: TokenDistributionRules;
    marketplaceRules: TokenMarketplaceRules;
    manualMintingRules: ChangeControlRules;
    manualBurningRules: ChangeControlRules;
    freezeRules: ChangeControlRules;
    unfreezeRules: ChangeControlRules;
    destroyFrozenFundsRules: ChangeControlRules;
    emergencyActionRules: ChangeControlRules;
    mainControlGroup?: number;
    mainControlGroupCanBeModified: AuthorizedActionTakers;
    description?: string;
    /**
     * Give the token its own shielded pool (protocol version 14+). Produces a
     * format-version-1 token configuration; the flag cannot change after creation, and
     * freezeRules, unfreezeRules and destroyFrozenFundsRules must then authorize no one
     * (no action takers and no admins): shielded notes cannot be frozen or destroyed.
     */
    hasShieldedPool?: boolean;
    /**
     * The fewest notes the token's shielded pool must hold before tokens may leave it for a
     * visible destination: unshielding to an identity, burning from the pool, or paying a
     * document's token cost out of the pool. Transfers that stay inside the pool are never
     * held back. Requires hasShieldedPool.
     *
     * What is counted is note commitments, not depositors, and one bundle carries several of
     * them, so a single depositor can reach a threshold alone: it says how busy the pool
     * should be before anyone leaves it, and guarantees no anonymity set. Omitted, or
     * undefined, means no threshold, which is the default because any threshold above 0 keeps
     * a new pool's first depositors from leaving until enough notes accumulate. A contract
     * create refuses a threshold above the protocol's maximum of 250. The issuer changes it
     * afterwards with a TokenConfigUpdate, under its own change control rules.
     */
    minimumPoolNotesForOutgoing?: bigint;
    /**
     * Whether holders may move the token to another identity (protocol version 14+).
     * Defaults to true. false produces a format-version-1 token configuration and cannot
     * change after creation: every TokenTransfer is refused, a document type may charge the
     * token only by burning it (so only its own contract's document types can use it), and
     * the token cannot have a shielded pool. Minting, claims, direct purchases, burns and
     * freezes work as configured.
     */
    transferable?: boolean;
}



export interface TokenDestroyFrozenFundsTransitionOptions {
    base: TokenBaseTransition;
    frozenIdentityId: IdentifierLike;
    publicNote?: string;
}



export interface TokenDirectPurchaseTransitionOptions {
    base: TokenBaseTransition;
    tokenCount: bigint;
    totalAgreedPrice: bigint;
}



export interface TokenDistributionRulesOptions {
    perpetualDistribution?: TokenPerpetualDistribution;
    perpetualDistributionRules: ChangeControlRules;
    preProgrammedDistribution?: TokenPreProgrammedDistribution;
    newTokensDestinationIdentity?: IdentifierLike;
    newTokensDestinationIdentityRules: ChangeControlRules;
    mintingAllowChoosingDestination: boolean;
    mintingAllowChoosingDestinationRules: ChangeControlRules;
    changeDirectPurchasePricingRules: ChangeControlRules;
    /**
     * A fixed amount every identity may claim exactly once. Setting it makes the rules
     * serialize as format version 1, which needs protocol version 14.
     */
    oncePerIdentityDistribution?: TokenOncePerIdentityDistribution;
}



export interface TokenEmergencyActionTransitionOptions {
    base: TokenBaseTransition;
    emergencyAction: TokenEmergencyActionLike;
    publicNote?: string;
}



export interface TokenFreezeTransitionOptions {
    base: TokenBaseTransition;
    identityToFreezeId: IdentifierLike;
    publicNote?: string;
}



export interface TokenKeepsHistoryRulesOptions {
    isKeepingTransferHistory?: boolean;
    isKeepingFreezingHistory?: boolean;
    isKeepingMintingHistory?: boolean;
    isKeepingBurningHistory?: boolean;
    isKeepingDirectPricingHistory?: boolean;
    isKeepingDirectPurchaseHistory?: boolean;
}



export interface TokenMintTransitionOptions {
    base: TokenBaseTransition;
    amount: bigint;
    issuedToIdentityId?: IdentifierLike;
    publicNote?: string;
}



export interface TokenPaymentInfoOptions {
    paymentTokenContractId?: IdentifierLike;
    tokenContractPosition: number;
    minimumTokenCost?: bigint;
    maximumTokenCost?: bigint;
    gasFeesPaidBy?: GasFeesPaidByLike;
    /**
     * Pay the token cost out of the token's shielded pool with this spend bundle instead of
     * the document owner's token balance (format version 1, protocol version 14+).
     */
    shieldedPayment?: TokenShieldedPayment;
}

/**
 * TokenPaymentInfo serialized as a plain object.
 */
export interface TokenPaymentInfoObject {
    $formatVersion: string;
    paymentTokenContractId: Uint8Array | null;
    tokenContractPosition: number;
    minimumTokenCost: bigint | null;
    maximumTokenCost: bigint | null;
    gasFeesPaidBy: string;
    shieldedPayment?: TokenShieldedPaymentObject;
}

/**
 * TokenPaymentInfo serialized as JSON.
 */
export interface TokenPaymentInfoJSON {
    $formatVersion: string;
    paymentTokenContractId: string | null;
    tokenContractPosition: number;
    minimumTokenCost: number | string | null;
    maximumTokenCost: number | string | null;
    gasFeesPaidBy: string;
    shieldedPayment?: TokenShieldedPaymentJSON;
}



export interface TokenSetPriceForDirectPurchaseTransitionOptions {
    base: TokenBaseTransition;
    price?: TokenPricingSchedule;
    publicNote?: string;
}



export interface TokenTransferTransitionOptions {
    base: TokenBaseTransition;
    recipientId: IdentifierLike;
    amount: bigint;
    publicNote?: string;
    sharedEncryptedNote?: SharedEncryptedNote;
    privateEncryptedNote?: PrivateEncryptedNote;
}



export interface TokenUnFreezeTransitionOptions {
    base: TokenBaseTransition;
    frozenIdentityId: IdentifierLike;
    publicNote?: string;
}



export interface VotePollOptions {
    contractId: IdentifierLike;
    documentTypeName: string;
    indexName: string;
    indexValues: any[];
}

/**
 * VotePoll serialized as a plain object.
 *
 * Internally tagged with `type` (plain — no `$`-prefixed neighbors at
 * this level). Inner ContestedDocumentResourceVotePoll fields flatten at
 * the same level — no `data` wrapper.
 */
export interface VotePollObject {
    $type: "contestedDocumentResourceVotePoll";
    contractId: Uint8Array;
    documentTypeName: string;
    indexName: string;
    indexValues: any[];
}

/**
 * VotePoll serialized as JSON.
 */
export interface VotePollJSON {
    $type: "contestedDocumentResourceVotePoll";
    contractId: string;
    documentTypeName: string;
    indexName: string;
    indexValues: any[];
}



export type ActionGoalLike = ActionGoal | string | number;



export type ActionTakerValue = IdentifierLike | IdentifierLike[];



export type BatchedTransitionLike = DocumentTransition | TokenTransition;



export type CreditWithdrawalTransitionPoolingLike = PoolingWasm | string | number;

export interface IdentityCreditWithdrawalTransitionOptions {
    identityId: IdentifierLike;
    amount: bigint;
    coreFeePerByte: number;
    pooling: CreditWithdrawalTransitionPoolingLike;
    outputScript?: CoreScript;
    nonce?: bigint;
    userFeeIncrease?: number;
}

/**
 * IdentityCreditWithdrawalTransition serialized as a plain object.
 */
export interface IdentityCreditWithdrawalTransitionObject {
    identityId: Uint8Array;
    amount: bigint;
    coreFeePerByte: number;
    pooling: PoolingWasm;
    outputScript?: Uint8Array;
    nonce: bigint;
    userFeeIncrease: number;
    signature?: Uint8Array;
    signaturePublicKeyId?: number;
}

/**
 * IdentityCreditWithdrawalTransition serialized as JSON.
 */
export interface IdentityCreditWithdrawalTransitionJSON {
    identityId: string;
    amount: number | string;
    coreFeePerByte: number;
    pooling: string;
    outputScript?: string;
    nonce: number | string;
    userFeeIncrease: number;
    signature?: string;
    signaturePublicKeyId?: number;
}



export type GasFeesPaidByLike = GasFeesPaidBy | "documentOwner" | "contractOwner" | "preferContractOwner" | 0 | 1 | 2;



export type GrovePathSegment = string | Uint8Array;

export type GroveElementType =
| "item"
| "reference"
| "tree"
| "sumItem"
| "sumTree"
| "bigSumTree"
| "countTree"
| "countSumTree"
| "provableCountTree"
| "itemWithSumItem"
| "referenceWithSumItem"
| "bidirectionalReference"
| "itemWithBackwardsReferences"
| "sumItemWithBackwardsReferences"
| "itemWithSumItemWithBackwardsReferences"
| "provableCountSumTree"
| "provableCountProvableSumTree"
| "provableSumTree"
| "provableSumIndexedTree"
| "provableCountIndexedTree"
| "provableCountProvableSumIndexedTree"
| "commitmentTree"
| "mmrTree"
| "bulkAppendTree"
| "denseAppendOnlyFixedSizeTree"
| "privateDocumentStore"
| "nonCountedItem"
| "nonCountedReference"
| "nonCountedTree"
| "nonCountedSumItem"
| "nonCountedSumTree"
| "nonCountedBigSumTree"
| "nonCountedCountTree"
| "nonCountedCountSumTree"
| "nonCountedProvableCountTree"
| "nonCountedItemWithSumItem"
| "nonCountedReferenceWithSumItem"
| "nonCountedProvableCountSumTree"
| "nonCountedProvableCountProvableSumTree"
| "nonCountedProvableSumTree"
| "nonCountedProvableSumIndexedTree"
| "nonCountedProvableCountIndexedTree"
| "nonCountedProvableCountProvableSumIndexedTree"
| "nonCountedCommitmentTree"
| "nonCountedMmrTree"
| "nonCountedBulkAppendTree"
| "nonCountedDenseAppendOnlyFixedSizeTree"
| "nonCountedPrivateDocumentStore"
| "notSummedSumTree"
| "notSummedBigSumTree"
| "notSummedCountSumTree"
| "notSummedProvableCountSumTree"
| "notSummedProvableCountProvableSumTree"
| "notSummedProvableSumTree"
| "notCountedOrSummedSumTree"
| "notCountedOrSummedBigSumTree"
| "notCountedOrSummedCountSumTree"
| "notCountedOrSummedProvableCountSumTree"
| "notCountedOrSummedProvableCountProvableSumTree"
| "notCountedOrSummedProvableSumTree";



export type IdentifierLike = Identifier | Uint8Array | string;
export type IdentifierLikeArray = Array<IdentifierLike>;
export type IdentifierLikeOrUndefined = Identifier | Uint8Array | string | undefined;



export type PlatformVersionLike = PlatformVersion | number;



export type ProofMetadataResponseTyped<T> = ProofMetadataResponse & { data: T };



export type PurposeLike = Purpose | string | number;
export type SecurityLevelLike = SecurityLevel | string | number;
export type KeyTypeLike = KeyType | string | number;

export interface IdentityPublicKeyOptions {
    keyId: number;
    purpose: PurposeLike;
    securityLevel: SecurityLevelLike;
    keyType: KeyTypeLike;
    isReadOnly?: boolean;
    data: Uint8Array;
    disabledAt?: number;
    contractBounds?: ContractBounds;
    /** Credits the key may spend over its lifetime (protocol version 14); makes it a version 1 key */
    totalBudget?: bigint;
    /** Block time in milliseconds from which the key can no longer sign; makes it a version 1 key */
    expiresAt?: bigint;
}

/**
 * IdentityPublicKey serialized as a plain object. `$formatVersion` is "0" for a key without
 * limits and "1" for a key that may carry them.
 */
export interface IdentityPublicKeyObject {
    $formatVersion: string;
    id: number;
    purpose: number;
    securityLevel: number;
    contractBounds?: ContractBounds;
    type: number;
    readOnly: boolean;
    data: Uint8Array;
    disabledAt?: bigint;
    totalBudget?: bigint;
    expiresAt?: bigint;
}

/**
 * IdentityPublicKey serialized as JSON.
 */
export interface IdentityPublicKeyJSON {
    $formatVersion: string;
    id: number;
    purpose: number;
    securityLevel: number;
    contractBounds?: ContractBoundsJSON;
    type: number;
    readOnly: boolean;
    data: string;
    disabledAt?: number;
    totalBudget?: number | string;
    expiresAt?: number | string;
}

/**
 * PublicKeyHash input type - accepts hex string or Uint8Array (20 bytes for HASH160)
 */
export type PublicKeyHashLike = string | Uint8Array;



export type StateTransitionProofResultType =
| VerifiedDataContract
| VerifiedIdentity
| VerifiedTokenBalanceAbsence
| VerifiedTokenBalance
| VerifiedTokenIdentityInfo
| VerifiedTokenPricingSchedule
| VerifiedTokenStatus
| VerifiedTokenIdentitiesBalances
| VerifiedPartialIdentity
| VerifiedBalanceTransfer
| VerifiedDocuments
| VerifiedTokenActionWithDocument
| VerifiedTokenGroupActionWithDocument
| VerifiedTokenGroupActionWithTokenBalance
| VerifiedTokenGroupActionWithTokenIdentityInfo
| VerifiedTokenGroupActionWithTokenPricingSchedule
| VerifiedMasternodeVote
| VerifiedNextDistribution
| VerifiedAddressInfos
| VerifiedIdentityFullWithAddressInfos
| VerifiedIdentityWithAddressInfos
| VerifiedAssetLockConsumed
| VerifiedAssetLockConsumedWithAddressInfos
| VerifiedShieldedNullifiers
| VerifiedTokenShieldedPoolBalance
| VerifiedShieldedNullifiersWithAddressInfos
| VerifiedShieldedNullifiersWithWithdrawalDocument
| VerifiedIdentityWithShieldedNullifiers
| VerifiedContractModerationListStatuses
| VerifiedContractFeeClaim
| VerifiedContractDocumentRemoval
| VerifiedTokenGroupActionWithShieldedPoolBalance
| VerifiedTokenGroupActionWithShieldedNullifiers
| VerifiedContractTeamActionSignature;



export type TokenDistributionTypeLike = TokenDistributionType | string | number;



export type TokenTransitionLike = TokenMintTransition | TokenBurnTransition | TokenTransferTransition | TokenFreezeTransition | TokenUnFreezeTransition | TokenDestroyFrozenFundsTransition | TokenClaimTransition | TokenEmergencyActionTransition | TokenConfigUpdateTransition | TokenDirectPurchaseTransition | TokenSetPriceForDirectPurchaseTransition | TokenShieldTransition | TokenUnshieldTransition | TokenShieldedTransferTransition | TokenMintToPoolTransition | TokenBurnFromPoolTransition | TokenClaimToPoolTransition | TokenDirectPurchaseToPoolTransition;



export enum ActionGoal {
    ActionCompletion = 0,
    ActionParticipation = 1,
}

export class ActionTaker {
    free(): void;
    [Symbol.dispose](): void;
    constructor(value: ActionTakerValue);
    value: ActionTakerValue;
    static readonly __struct: string;
    readonly takerType: string;
    readonly __type: string;
}

export class AddressCreditWithdrawalTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: AddressCreditWithdrawalTransitionOptions);
    static fromBase64(base64: string): AddressCreditWithdrawalTransition;
    static fromBytes(bytes: Uint8Array): AddressCreditWithdrawalTransition;
    static fromHex(hex: string): AddressCreditWithdrawalTransition;
    static fromJSON(js: AddressCreditWithdrawalTransitionJSON): AddressCreditWithdrawalTransition;
    static fromObject(obj: AddressCreditWithdrawalTransitionObject): AddressCreditWithdrawalTransition;
    static fromStateTransition(st: StateTransition): AddressCreditWithdrawalTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): AddressCreditWithdrawalTransitionJSON;
    toObject(): AddressCreditWithdrawalTransitionObject;
    toStateTransition(): StateTransition;
    coreFeePerByte: number;
    inputs: PlatformAddressInput[];
    get output(): PlatformAddressOutput | undefined;
    set output(value: PlatformAddressOutput | null | undefined);
    outputScript: CoreScript;
    get pooling(): string;
    set pooling(value: CreditWithdrawalTransitionPoolingLike);
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class AddressFundingFromAssetLockTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: AddressFundingFromAssetLockTransitionOptions);
    static fromBase64(base64: string): AddressFundingFromAssetLockTransition;
    static fromBytes(bytes: Uint8Array): AddressFundingFromAssetLockTransition;
    static fromHex(hex: string): AddressFundingFromAssetLockTransition;
    static fromJSON(js: AddressFundingFromAssetLockTransitionJSON): AddressFundingFromAssetLockTransition;
    static fromObject(obj: AddressFundingFromAssetLockTransitionObject): AddressFundingFromAssetLockTransition;
    static fromStateTransition(st: StateTransition): AddressFundingFromAssetLockTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): AddressFundingFromAssetLockTransitionJSON;
    toObject(): AddressFundingFromAssetLockTransitionObject;
    toStateTransition(): StateTransition;
    assetLockProof: AssetLockProof;
    inputs: PlatformAddressInput[];
    outputs: PlatformAddressOutput[];
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class AddressFundsTransferTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: AddressFundsTransferTransitionOptions);
    static fromBase64(base64: string): AddressFundsTransferTransition;
    static fromBytes(bytes: Uint8Array): AddressFundsTransferTransition;
    static fromHex(hex: string): AddressFundsTransferTransition;
    static fromJSON(js: AddressFundsTransferTransitionJSON): AddressFundsTransferTransition;
    static fromObject(obj: AddressFundsTransferTransitionObject): AddressFundsTransferTransition;
    static fromStateTransition(st: StateTransition): AddressFundsTransferTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): AddressFundsTransferTransitionJSON;
    toObject(): AddressFundsTransferTransitionObject;
    toStateTransition(): StateTransition;
    inputs: PlatformAddressInput[];
    outputs: PlatformAddressOutput[];
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * The input witness data required to spend from a PlatformAddress.
 *
 * Captures the different spending patterns for P2PKH (recoverable signature only)
 * and P2SH (signatures + redeem script) addresses.
 */
export class AddressWitness {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: AddressWitnessJSON): AddressWitness;
    static fromObject(obj: AddressWitnessObject): AddressWitness;
    /**
     * Creates a P2PKH witness from a recoverable ECDSA signature (typically 65 bytes
     * including the recovery byte prefix).
     */
    static p2pkh(signature: Uint8Array): AddressWitness;
    /**
     * Creates a P2SH witness from a list of signatures and the redeem script.
     *
     * For a 2-of-3 multisig, `signatures` would be `[OP_0, sig1, sig2]` and
     * `redeemScript` would be `OP_2 <pub1> <pub2> <pub3> OP_3 OP_CHECKMULTISIG`.
     *
     * Each entry in `signatures` must be a `Uint8Array`. The signature count is
     * validated by DPP (`MAX_P2SH_SIGNATURES = 17`) on serialization; this
     * constructor does not duplicate that check.
     */
    static p2sh(signatures: Uint8Array[], redeemScript: Uint8Array): AddressWitness;
    toJSON(): AddressWitnessJSON;
    toObject(): AddressWitnessObject;
    /**
     * Returns true if this is a P2PKH witness.
     */
    readonly isP2pkh: boolean;
    /**
     * Returns true if this is a P2SH witness.
     */
    readonly isP2sh: boolean;
    /**
     * Returns the witness kind: "p2pkh" or "p2sh".
     */
    readonly kind: string;
    /**
     * Returns the redeem script for a P2SH witness, or `null` for P2PKH.
     */
    readonly redeemScript: Uint8Array | undefined;
    /**
     * Returns the signature bytes for a P2PKH witness, or `null` for P2SH.
     */
    readonly signature: Uint8Array | undefined;
    /**
     * Returns the signatures for a P2SH witness, or `null` for P2PKH.
     */
    readonly signatures: Uint8Array[] | undefined;
    static readonly __struct: string;
    readonly __type: string;
}

export class AssetLockProof {
    free(): void;
    [Symbol.dispose](): void;
    constructor(assetLockProof: ChainAssetLockProof | InstantAssetLockProof);
    static createChainAssetLockProof(coreChainLockedHeight: number, outPoint: OutPoint): AssetLockProof;
    createIdentityId(): Identifier;
    static createInstantAssetLockProof(instantLock: Uint8Array, transaction: Uint8Array, outputIndex: number): AssetLockProof;
    static fromBytes(bytes: Uint8Array): AssetLockProof;
    static fromHex(assetLockProof: string): AssetLockProof;
    static fromJSON(js: AssetLockProofJSON): AssetLockProof;
    static fromObject(obj: AssetLockProofObject): AssetLockProof;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): AssetLockProofJSON;
    toObject(): AssetLockProofObject;
    readonly chainLockProof: ChainAssetLockProof;
    readonly instantLockProof: InstantAssetLockProof;
    /**
     * Returns the lock type as a lowercase wire-shape string ("instant" or
     * "chain") — matching the `$type` discriminator emitted by `toObject()` /
     * `toJSON()`.
     */
    readonly lockType: string;
    readonly outPoint: OutPoint | undefined;
    static readonly __struct: string;
    readonly __type: string;
}

export class AuthorizedActionTakers {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static ContractOwner(): AuthorizedActionTakers;
    static Group(group_contract_position: number): AuthorizedActionTakers;
    static Identity(identity_id: IdentifierLike): AuthorizedActionTakers;
    static MainGroup(): AuthorizedActionTakers;
    static NoOne(): AuthorizedActionTakers;
    static readonly __struct: string;
    readonly takerType: string;
    readonly __type: string;
    readonly value: Identifier | number | undefined;
}

export class BatchTransition {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): BatchTransition;
    static fromBatchedTransitions(batchedTransitions: Array<any>, ownerId: IdentifierLike, userFeeIncrease: number): BatchTransition;
    static fromBytes(bytes: Uint8Array): BatchTransition;
    static fromHex(hex: string): BatchTransition;
    static fromJSON(js: BatchTransitionJSON): BatchTransition;
    static fromObject(obj: BatchTransitionObject): BatchTransition;
    static fromStateTransition(state_transition: StateTransition): BatchTransition;
    setIdentityContractNonce(nonce: bigint): void;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): BatchTransitionJSON;
    toObject(): BatchTransitionObject;
    toStateTransition(): StateTransition;
    readonly allConflictingIndexCollateralVotingFunds: bigint | undefined;
    readonly allPurchasesAmount: bigint | undefined;
    get transitions(): BatchedTransition[];
    set transitions(value: Array<any>);
    readonly modifiedDataIds: Identifier[];
    readonly ownerId: Identifier;
    signature: Uint8Array;
    get signaturePublicKeyId(): number;
    set signaturePublicKeyId(value: any);
    static readonly __struct: string;
    readonly __type: string;
}

export enum BatchType {
    Create = 0,
    Replace = 1,
    Delete = 2,
    Transfer = 3,
    Purchase = 4,
    UpdatePrice = 5,
    IgnoreWhileBumpingRevision = 6,
    IndexOnlyDelete = 7,
}

export class BatchedTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(transition: BatchedTransitionLike);
    toTransition(): BatchedTransitionLike;
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    static readonly __struct: string;
    readonly __type: string;
}

export class BlockBasedDistribution {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    function: DistributionFunction;
    static readonly __struct: string;
    readonly __type: string;
    interval: bigint;
}

export class BlockInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: BlockInfoOptions);
    static fromJSON(js: BlockInfoJSON): BlockInfo;
    static fromObject(obj: BlockInfoObject): BlockInfo;
    toJSON(): BlockInfoJSON;
    toObject(): BlockInfoObject;
    readonly coreHeight: number;
    readonly epochIndex: number;
    readonly height: bigint;
    static readonly __struct: string;
    readonly timeMs: bigint;
    readonly __type: string;
}

export class ChainAssetLockProof {
    free(): void;
    [Symbol.dispose](): void;
    constructor(coreChainLockedHeight: number, outPoint: OutPoint);
    createIdentityId(): Identifier;
    static fromBytes(bytes: Uint8Array): ChainAssetLockProof;
    static fromJSON(js: ChainAssetLockProofJSON): ChainAssetLockProof;
    static fromObject(obj: ChainAssetLockProofObject): ChainAssetLockProof;
    toBytes(): Uint8Array;
    toJSON(): ChainAssetLockProofJSON;
    toObject(): ChainAssetLockProofObject;
    coreChainLockedHeight: number;
    outPoint: OutPoint;
    static readonly __struct: string;
    readonly __type: string;
}

export class ChangeControlRules {
    free(): void;
    [Symbol.dispose](): void;
    canChangeAdminActionTakers(options: CanChangeAdminActionTakersOptions): boolean;
    constructor(options: ChangeControlRulesOptions);
    adminActionTakers: AuthorizedActionTakers;
    authorizedToMakeChange: AuthorizedActionTakers;
    isChangingAdminActionTakersToNoOneAllowed: boolean;
    isChangingAuthorizedActionTakersToNoOneAllowed: boolean;
    isSelfChangingAdminActionTakersAllowed: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

export class ConsensusError {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static deserialize(error: Uint8Array): ConsensusError;
    /**
     * The consensus error code.
     *
     * This is the same number that reaches JS as `WasmSdkError.code` when
     * a state transition is rejected. See [`DocumentReferenceErrorCodeWasm`]
     * for the reference-validation range.
     */
    readonly code: number;
    /**
     * The distinctFrom error this is, or `undefined` when it is not code
     * 10419.
     */
    readonly documentDistinctFromErrorCode: DocumentDistinctFromErrorCode | undefined;
    /**
     * The encrypted-property error this is, or `undefined` when it is not
     * code 10420.
     */
    readonly documentEncryptionErrorCode: DocumentEncryptionErrorCode | undefined;
    /**
     * The generatedFrom error this is, or `undefined` when it is not code
     * 10424.
     */
    readonly documentGeneratedFromErrorCode: DocumentGeneratedFromErrorCode | undefined;
    /**
     * The immutable-property error this is, or `undefined` when it is not
     * code 40128.
     */
    readonly documentImmutabilityErrorCode: DocumentImmutabilityErrorCode | undefined;
    /**
     * The maxBytes error this is, or `undefined` when it is not code 10421.
     */
    readonly documentMaxBytesErrorCode: DocumentMaxBytesErrorCode | undefined;
    /**
     * The propertyConstraints error this is, or `undefined` when it is not
     * code 10422.
     */
    readonly documentPropertyConstraintErrorCode: DocumentPropertyConstraintErrorCode | undefined;
    /**
     * The reference-validation error this is, or `undefined` when it is
     * not one of codes 40120-40125, 40131, 40135-40138, 40142-40146, 40148,
     * 40149
     * and 10423.
     */
    readonly documentReferenceErrorCode: DocumentReferenceErrorCode | undefined;
    readonly message: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class ContenderWithSerializedDocument {
    free(): void;
    [Symbol.dispose](): void;
    constructor(identityId: IdentifierLike, serializedDocument?: Uint8Array | null, voteTally?: number | null);
    static fromJSON(js: ContenderWithSerializedDocumentJSON): ContenderWithSerializedDocument;
    static fromObject(obj: ContenderWithSerializedDocumentObject): ContenderWithSerializedDocument;
    toJSON(): ContenderWithSerializedDocumentJSON;
    toObject(): ContenderWithSerializedDocumentObject;
    readonly identityId: Identifier;
    readonly serializedDocument: Uint8Array | undefined;
    static readonly __struct: string;
    readonly __type: string;
    readonly voteTally: number | undefined;
}

export class ContestedDocumentVotePollWinnerInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(kind: string, identityId?: Identifier | null);
    static fromJSON(js: ContestedDocumentVotePollWinnerInfoJSON): ContestedDocumentVotePollWinnerInfo;
    static fromObject(obj: ContestedDocumentVotePollWinnerInfoObject): ContestedDocumentVotePollWinnerInfo;
    toJSON(): ContestedDocumentVotePollWinnerInfoJSON;
    toObject(): ContestedDocumentVotePollWinnerInfoObject;
    readonly identityId: Identifier | undefined;
    readonly isLocked: boolean;
    readonly isNoWinner: boolean;
    readonly isWonByIdentity: boolean;
    readonly kind: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class ContestedResourceContender {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly identityId: Identifier;
    readonly serializedDocument: Uint8Array | undefined;
    readonly voteTally: number | undefined;
    contender: ContenderWithSerializedDocument;
}

export class ContestedResourceVoteState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    get abstainVoteTally(): number | undefined;
    set abstainVoteTally(value: number | null | undefined);
    contenders: Array<any>;
    get lockVoteTally(): number | undefined;
    set lockVoteTally(value: number | null | undefined);
    get winner(): ContestedResourceVoteWinner | undefined;
    set winner(value: ContestedResourceVoteWinner | null | undefined);
}

export class ContestedResourceVoteWinner {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly identityId: Identifier | undefined;
    readonly kind: string;
    block: BlockInfo;
    info: ContestedDocumentVotePollWinnerInfo;
}

export class ContractBounds {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Bounds to every member of a contract group. Only authentication keys may carry them.
     */
    static ContractGroup(contractGroupId: IdentifierLike): ContractBounds;
    static SingleContract(contractId: IdentifierLike): ContractBounds;
    static SingleContractDocumentType(contractId: IdentifierLike, documentTypeName: string): ContractBounds;
    constructor(contractId: IdentifierLike, documentTypeName?: string | null);
    static fromJSON(js: ContractBoundsJSON): ContractBounds;
    static fromObject(obj: ContractBoundsObject): ContractBounds;
    toJSON(): ContractBoundsJSON;
    toObject(): ContractBoundsObject;
    readonly contractBoundsType: string;
    readonly contractBoundsTypeNumber: number;
    /**
     * The contract group id, for `contractGroup` bounds only.
     */
    readonly contractGroupId: Identifier | undefined;
    get documentTypeName(): string | undefined;
    set documentTypeName(value: string);
    /**
     * The contract id, or the contract group id for `contractGroup` bounds.
     */
    get identifier(): Identifier;
    set identifier(value: IdentifierLike);
    static readonly __struct: string;
    readonly __type: string;
}

export class ContractFeeClaim {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: ContractFeeClaimTransitionOptions);
    static fromBase64(base64: string): ContractFeeClaim;
    static fromBytes(bytes: Uint8Array): ContractFeeClaim;
    static fromHex(hex: string): ContractFeeClaim;
    static fromJSON(js: ContractFeeClaimJSON): ContractFeeClaim;
    static fromObject(obj: ContractFeeClaimObject): ContractFeeClaim;
    static fromStateTransition(st: StateTransition): ContractFeeClaim;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): ContractFeeClaimJSON;
    toObject(): ContractFeeClaimObject;
    toStateTransition(): StateTransition;
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    identityContractNonce: bigint;
    get ownerId(): Identifier;
    set ownerId(value: IdentifierLike);
    /**
     * The pot that is paid out: owner or moderators
     */
    pot: string;
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A contract group's stored information: who owns it and who may add members, and its
 * optional name and description.
 */
export class ContractGroupInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    toJSON(): any;
    /**
     * The identities that may add members besides the owner, as base58 strings. Empty for
     * a single owner.
     */
    readonly adminIds: string[];
    /**
     * The group's description, when it has one.
     */
    readonly description: string | undefined;
    /**
     * The group's name, when it has one.
     */
    readonly name: string | undefined;
    /**
     * The identity that registered the group and owns it, as a base58 string.
     */
    readonly ownerId: string;
}

export class ContractUserModeration {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: ContractUserModerationTransitionOptions);
    static fromBase64(base64: string): ContractUserModeration;
    static fromBytes(bytes: Uint8Array): ContractUserModeration;
    static fromHex(hex: string): ContractUserModeration;
    static fromJSON(js: ContractUserModerationJSON): ContractUserModeration;
    static fromObject(obj: ContractUserModerationObject): ContractUserModeration;
    static fromStateTransition(st: StateTransition): ContractUserModeration;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): ContractUserModerationJSON;
    toObject(): ContractUserModerationObject;
    toStateTransition(): StateTransition;
    /**
     * The action's name: ban, unban, suspend, unsuspend, warn, clearWarnings, deleteDocument,
     * restoreDocument, changeDocumentFields, deleteSettledDocument or approveTeamAction
     */
    readonly action: string;
    /**
     * The team action the transition proposes or approves: for a deleteSettledDocument, the
     * id of the action it opens, computed from its contract, its owner, its nonce and the
     * document, which the other members of the seated team approve; for an approveTeamAction,
     * the action it approves. Undefined for every other action.
     */
    readonly actionId: Identifier | undefined;
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    /**
     * For a restoreDocument, the document it brings back, as it was serialized when it was
     * deleted
     */
    readonly document: Uint8Array | undefined;
    /**
     * For a deleteDocument, the document it deletes, for a changeDocumentFields, the
     * document it changes, and for a deleteSettledDocument, the document whose deletion it
     * proposes
     */
    readonly documentId: Identifier | undefined;
    /**
     * For a deleteDocument, a restoreDocument, a changeDocumentFields or a
     * deleteSettledDocument, the document type of its document
     */
    readonly documentTypeName: string | undefined;
    /**
     * For a changeDocumentFields, the fields it sets, in the forms the constructor takes back:
     * integers as bigints, identifiers and bytes as Uint8Arrays, and `null` for a field it
     * removes
     */
    readonly fields: Record<string, unknown> | undefined;
    identityContractNonce: bigint;
    /**
     * The identity the action targets, undefined for a deleteDocument, a restoreDocument, a
     * changeDocumentFields and a deleteSettledDocument, which name a document whose owner is
     * only known once the document is read, and for an approveTeamAction, which names a team
     * action
     */
    readonly identityId: Identifier | undefined;
    get ownerId(): Identifier;
    set ownerId(value: IdentifierLike);
    /**
     * For a ban, a suspend, a warn, a deleteDocument, a changeDocumentFields and a
     * deleteSettledDocument, why
     */
    readonly reason: ContractModerationReason | undefined;
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
    /**
     * For a suspend, the block time in milliseconds at which the suspension lapses
     */
    readonly until: bigint | undefined;
}

export class CoreScript {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): CoreScript;
    static fromP2PKH(keyHash: Uint8Array): CoreScript;
    static fromP2SH(scriptHash: Uint8Array): CoreScript;
    toASMString(): string;
    toAddress(network: NetworkLike): string;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toString(): string;
    static readonly __struct: string;
    readonly __type: string;
}

export class CurrentQuorumsInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): CurrentQuorumsInfo;
    static fromObject(obj: object): CurrentQuorumsInfo;
    toJSON(): any;
    toObject(): any;
    readonly height: bigint;
    readonly quorums: Array<any>;
}

export class DashpayContactKeyInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): DashpayContactKeyInfo;
    static fromObject(obj: object): DashpayContactKeyInfo;
    toJSON(): any;
    toObject(): any;
    account: number;
    addressIndex: number;
    address: string;
    dipStandard: string;
    network: string;
    path: string;
    privateKeyHex: string;
    privateKeyWif: string;
    publicKey: string;
    purpose: string;
    receiverIdentity: string;
    senderIdentity: string;
    xprv: string;
    xpub: string;
}

export class DataContract {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The first `propertyConstraints` rule `document` breaks, in name order,
     * evaluated with the same code consensus runs on a create or replace: its
     * properties, its owner for `$ownerId`, the revision the write records for
     * `$revision` (below), and for the system times the device clock in place
     * of the block time the
     * write will record (the document's stored creation and transfer times
     * when it has them). A rule reading a block height the write records is
     * not judged, since the height is unknown until the block, a rule reading
     * a `countOf` or `sumOf` total, which only the platform reads from state
     * (a rule's `readsTotals` lists them), or a rule reading a value of the
     * document a reference points at, which the platform reads with the
     * reference (a rule's `readsReferenced` lists them).
     * `undefined` when it meets every rule of its document type.
     *
     * `storedDocument` is the stored version the write replaces, which a rule
     * reads through `$old.` (a rule's `readsStored` says it does): the stored
     * document for a replace, `null` for a create, which has none, so that
     * every `$old.` read is absent. Left `undefined`, a rule reading it is not
     * judged, and neither is one reading `$revision`, which depends on the
     * write: 1 on a create, one more than the stored on a replace. Given
     * either, `$revision`, `$ownerId` and the creation and
     * transfer times are what consensus judges, whatever `document` holds: on
     * a replace the stored document's owner, creation and transfer and the
     * revision after its own, the only one consensus accepts on a replace;
     * on a create revision 1 and the device clock.
     *
     * A pre-check, so an app can refuse a document before paying for a
     * transition consensus would refuse with
     * `DocumentPropertyConstraintViolatedError` (code 10422). It judges the
     * rules alone, not the document's JSON schema. Throws when the document
     * belongs to another contract or names a document type this one lacks,
     * and when the stored document is not the same document.
     */
    checkDocumentPropertyConstraints(document: Document, storedDocument: Document | null | undefined): DocumentPropertyConstraintViolation | undefined;
    constructor(options: DataContractOptions);
    /**
     * The `distinctFrom` declarations of one document type, in schema
     * property order: each `{ path, distinctFrom }` names an identifier
     * property and what its value must differ from, `"$ownerId"` or the
     * dotted path of another identifier property of the same type.
     *
     * Empty when the document type declares none (the normal case). Throws
     * when the contract has no document type by that name, so "no such
     * type" and "nothing declared" stay distinguishable.
     *
     * The keyword is only parsed from protocol version 14 onward. A
     * contract deserialized against an earlier platform version reports an
     * empty list, which is exactly what consensus enforced at that version,
     * while `toJSON()` still shows the raw keyword either way.
     */
    documentTypeDistinctFrom(documentTypeName: string): Array<DocumentPropertyDistinctFrom>;
    /**
     * All `encryptedFor` declarations of one document type, in schema
     * property order: which byte array properties are encrypted, for whom,
     * under which key ids and under which scheme.
     *
     * Returns an empty array when the document type declares none. Throws
     * when the contract has no document type by that name, so "no such
     * type" and "nothing encrypted" stay distinguishable.
     *
     * The keyword is only parsed from protocol version 14 onward. A
     * contract deserialized against an earlier platform version reports
     * none, which is exactly what consensus enforced at that version, while
     * `toJSON()` still shows the raw keyword either way.
     */
    documentTypeEncryptedProperties(documentTypeName: string): Array<DocumentPropertyEncryption>;
    /**
     * The `immutable` declarations of one document type: `{ immutable:
     * string[], immutableWhen: Record<string, condition> }`, the properties
     * frozen at creation and those frozen under a condition, each sorted by
     * property name.
     *
     * Both are empty when the document type declares nothing (the
     * normal case, and the only case for a type whose documents are not
     * mutable). Throws when the contract has no document type by that
     * name, so "no such type" and "nothing frozen" stay distinguishable.
     *
     * The keywords are only parsed from protocol version 14 onward. A
     * contract deserialized against an earlier platform version reports
     * empty lists, which is exactly what consensus enforced at that
     * version, while `toJSON()` still shows the raw keywords either way.
     */
    documentTypeImmutableProperties(documentTypeName: string): DocumentTypeImmutableProperties;
    /**
     * All `propertyConstraints` rules of one document type, in name order,
     * the order consensus checks them in: each rule's name, the rule as the
     * schema declares it, every property it reads and how, and whether it
     * reads `$ownerId` (then a transfer or a purchase is judged against it
     * too).
     *
     * Returns an empty array when the document type declares none. Throws
     * when the contract has no document type by that name, so "no such
     * type" and "no rules" stay distinguishable.
     *
     * The keyword is only parsed from protocol version 14 onward. A
     * contract deserialized against an earlier platform version reports
     * none, which is exactly what consensus enforced at that version, while
     * `toJSON()` still shows the raw keyword either way.
     */
    documentTypePropertyConstraints(documentTypeName: string): Array<DocumentPropertyConstraint>;
    /**
     * All `refersTo` declarations of one document type: its `ownerRefersTo`
     * or `creatorRefersTo` first, at the path `$ownerId` or `$creatorId`,
     * then the properties' own in schema property order.
     *
     * Returns an empty array when the document type declares none. Throws
     * when the contract has no document type by that name — an empty array
     * would conflate "no such type" with "no references".
     *
     * Reference declarations are only parsed from protocol version 14
     * onward. A contract deserialized against an earlier platform version
     * reports none, which is exactly what consensus enforced at that
     * version — but note the trap: `DataContract.fromBytes(bytes, false, 1)`
     * yields `[]` even for a contract whose raw schema does carry
     * `refersTo`, and `toJSON()` still shows the raw keyword either way.
     */
    documentTypeReferences(documentTypeName: string): Array<DocumentPropertyReference>;
    /**
     * Every typed array property of one document type (`type: "array"`
     * with an `items` element schema), in schema property order: `{ path,
     * items, minItems?, maxItems?, uniqueItems }`.
     *
     * Returns an empty array when the document type declares none. Throws
     * when the contract has no document type by that name, so "no such
     * type" and "no typed arrays" stay distinguishable.
     *
     * Typed arrays are only parsed from protocol version 14 onward. A
     * contract deserialized against an earlier platform version cannot
     * carry one: the parsers of those versions refuse an array that is not
     * a byte array.
     */
    documentTypeTypedArrays(documentTypeName: string): Array<DocumentTypedArrayProperty>;
    static fromBase64(base64: string, full_validation: boolean, platform_version: PlatformVersionLike): DataContract;
    static fromBytes(bytes: Uint8Array, full_validation: boolean, platform_version: PlatformVersionLike): DataContract;
    static fromHex(hex: string, full_validation: boolean, platform_version: PlatformVersionLike): DataContract;
    static fromJSON(value: DataContractJSON, full_validation: boolean, platform_version: PlatformVersionLike): DataContract;
    static fromObject(value: DataContractObject, full_validation: boolean, platform_version: PlatformVersionLike): DataContract;
    static generateId(owner_id: IdentifierLike, identity_nonce: bigint): Identifier;
    setConfig(config: DataContractConfig, platformVersion: PlatformVersionLike): void;
    setSchemas(schemas: Record<string, object>, definitions: object | null | undefined, full_validation: boolean, platform_version: PlatformVersionLike): void;
    toBase64(platformVersion: PlatformVersionLike): string;
    toBytes(platformVersion: PlatformVersionLike): Uint8Array;
    toHex(platformVersion: PlatformVersionLike): string;
    toJSON(platform_version: PlatformVersionLike): DataContractJSON;
    toObject(platformVersion: PlatformVersionLike): DataContractObject;
    readonly config: DataContractConfig;
    /**
     * Every document type that declares at least one `distinctFrom`, keyed
     * by document type name.
     *
     * Document types with no declarations are omitted, so an empty `Map`
     * means "this contract declares no distinctFrom at all".
     */
    readonly documentDistinctFrom: Map<string, Array<DocumentPropertyDistinctFrom>>;
    /**
     * Every document type that declares at least one encrypted property,
     * keyed by document type name.
     *
     * Document types with no declarations are omitted, so an empty `Map`
     * means "this contract declares no encrypted property at all".
     */
    readonly documentEncryptedProperties: Map<string, Array<DocumentPropertyEncryption>>;
    /**
     * Every document type that freezes at least one property, keyed by
     * document type name.
     *
     * Document types whose `immutable` keyword lists nothing are omitted, so
     * an empty `Map` means "nothing in this contract is frozen per
     * property".
     */
    readonly documentImmutableProperties: Map<string, DocumentTypeImmutableProperties>;
    /**
     * Every document type that declares `propertyConstraints`, keyed by
     * document type name.
     *
     * Document types with no rules are omitted, so an empty `Map` means
     * "this contract declares no propertyConstraints at all".
     */
    readonly documentPropertyConstraints: Map<string, Array<DocumentPropertyConstraint>>;
    /**
     * Every document type that declares at least one reference, keyed by
     * document type name.
     *
     * Document types with no declarations are omitted, so an empty `Map`
     * means "this contract declares no references at all".
     */
    readonly documentReferences: Map<string, Array<DocumentPropertyReference>>;
    /**
     * Every document type that declares at least one typed array property,
     * keyed by document type name.
     *
     * Document types with none are omitted, so an empty `Map` means "this
     * contract declares no typed arrays at all".
     */
    readonly documentTypedArrays: Map<string, Array<DocumentTypedArrayProperty>>;
    groups: Record<number, Group>;
    get id(): Identifier;
    set id(value: IdentifierLike);
    get ownerId(): Identifier;
    set ownerId(value: IdentifierLike);
    readonly schemas: Record<string, object>;
    get tokens(): object;
    set tokens(value: Record<number, TokenConfiguration>);
    version: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class DataContractCreateTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(dataContract: DataContract, identityNonce: bigint, platformVersion: PlatformVersionLike);
    static fromBase64(base64: string): DataContractCreateTransition;
    static fromBytes(bytes: Uint8Array): DataContractCreateTransition;
    static fromHex(hex: string): DataContractCreateTransition;
    static fromJSON(js: DataContractCreateTransitionJSON): DataContractCreateTransition;
    static fromObject(obj: DataContractCreateTransitionObject): DataContractCreateTransition;
    static fromStateTransition(stateTransition: StateTransition): DataContractCreateTransition;
    getDataContract(platformVersion: PlatformVersionLike, fullValidation?: boolean | null): DataContract;
    /**
     * Registers a contract group with this transition, or clears the registration with
     * `undefined`. Needs a version 1 transition (protocol version 14).
     */
    setContractGroup(registration: any): void;
    /**
     * Declares which contract groups the created contract, its document types or its tokens
     * join. Needs a version 1 transition (protocol version 14).
     */
    setContractGroupMemberships(memberships: any): void;
    setDataContract(dataContract: DataContract, platformVersion: PlatformVersionLike): void;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): DataContractCreateTransitionJSON;
    toObject(): DataContractCreateTransitionObject;
    toStateTransition(): StateTransition;
    verifyProtocolVersion(protocolVersion: number): boolean;
    /**
     * The contract group this transition registers, as a `ContractGroupRegistrationObject`,
     * or `undefined` when it registers none (a version 0 transition never does).
     */
    readonly contractGroup: any;
    /**
     * The contract group memberships the created contract declares, as
     * `ContractGroupMembershipObject[]`; empty on a version 0 transition.
     */
    readonly contractGroupMemberships: any;
    readonly featureVersion: number;
    readonly identityNonce: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * The current version of one data contract, with the contract only when the query asked
 * for it.
 */
export class DataContractLatestVersion {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The contract itself, only when the query set `includeContracts`.
     */
    readonly dataContract: DataContract | undefined;
    /**
     * The contract's current version number.
     */
    readonly version: number;
}

export class DataContractUpdateTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(dataContract: DataContract, identityNonce: bigint, platformVersion: PlatformVersionLike);
    static fromBase64(base64: string): DataContractUpdateTransition;
    static fromBytes(bytes: Uint8Array): DataContractUpdateTransition;
    static fromHex(hex: string): DataContractUpdateTransition;
    static fromJSON(js: DataContractUpdateTransitionJSON): DataContractUpdateTransition;
    static fromObject(obj: DataContractUpdateTransitionObject): DataContractUpdateTransition;
    static fromStateTransition(stateTransition: StateTransition): DataContractUpdateTransition;
    getDataContract(fullValidation: boolean | null | undefined, platformVersion: PlatformVersionLike): DataContract;
    setDataContract(dataContract: DataContract, platformVersion: PlatformVersionLike): void;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): DataContractUpdateTransitionJSON;
    toObject(): DataContractUpdateTransitionObject;
    toStateTransition(): StateTransition;
    verifyProtocolVersion(protocolVersion: number): boolean;
    readonly featureVersion: number;
    readonly identityContractNonce: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export class DerivationPathInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): DerivationPathInfo;
    static fromObject(obj: object): DerivationPathInfo;
    toJSON(): any;
    toObject(): any;
    account: number;
    change: number;
    coinType: number;
    index: number;
    path: string;
    purpose: number;
}

export class DerivedKeyInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): DerivedKeyInfo;
    static fromObject(obj: object): DerivedKeyInfo;
    toJSON(): any;
    toObject(): any;
    address: string;
    network: string;
    path: string;
    privateKeyHex: string;
    privateKeyWif: string;
    publicKey: string;
    xprv: string;
    xpub: string;
}

export class Dip13DerivationPathInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): Dip13DerivationPathInfo;
    static fromObject(obj: object): Dip13DerivationPathInfo;
    toJSON(): any;
    toObject(): any;
    account: number;
    coinType: number;
    description: string;
    path: string;
    purpose: number;
}

export class DistributionExponential {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionExponentialOptions);
    a: bigint;
    b: bigint;
    d: bigint;
    m: bigint;
    get maxValue(): bigint | undefined;
    set maxValue(value: bigint | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    n: bigint;
    o: bigint;
    get startMoment(): bigint | undefined;
    set startMoment(value: bigint | null | undefined);
}

export class DistributionFixedAmount {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionFixedAmountOptions);
    amount: bigint;
}

export class DistributionFunction {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static Exponential(opts: DistributionExponential): DistributionFunction;
    static FixedAmountDistribution(opts: DistributionFixedAmount): DistributionFunction;
    static InvertedLogarithmic(opts: DistributionInvertedLogarithmic): DistributionFunction;
    static Linear(opts: DistributionLinear): DistributionFunction;
    static Logarithmic(opts: DistributionLogarithmic): DistributionFunction;
    static Polynomial(opts: DistributionPolynomial): DistributionFunction;
    static Random(opts: DistributionRandom): DistributionFunction;
    static StepDecreasingAmount(opts: DistributionStepDecreasingAmount): DistributionFunction;
    static Stepwise(steps_with_amount: Record<string, bigint>): DistributionFunction;
    readonly functionName: string;
    readonly functionValue: DistributionFixedAmount | DistributionRandom | DistributionStepDecreasingAmount | Record<string, bigint> | DistributionLinear | DistributionPolynomial | DistributionExponential | DistributionLogarithmic | DistributionInvertedLogarithmic;
    static readonly __struct: string;
    readonly __type: string;
}

export class DistributionInvertedLogarithmic {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionInvertedLogarithmicOptions);
    a: bigint;
    b: bigint;
    d: bigint;
    m: bigint;
    get maxValue(): bigint | undefined;
    set maxValue(value: bigint | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    n: bigint;
    o: bigint;
    get startMoment(): bigint | undefined;
    set startMoment(value: bigint | null | undefined);
}

export class DistributionLinear {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionLinearOptions);
    a: bigint;
    d: bigint;
    get maxValue(): bigint | undefined;
    set maxValue(value: bigint | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    get startStep(): bigint | undefined;
    set startStep(value: bigint | null | undefined);
    startingAmount: bigint;
}

export class DistributionLogarithmic {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionLogarithmicOptions);
    a: bigint;
    b: bigint;
    d: bigint;
    m: bigint;
    get maxValue(): bigint | undefined;
    set maxValue(value: bigint | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    n: bigint;
    o: bigint;
    get startMoment(): bigint | undefined;
    set startMoment(value: bigint | null | undefined);
}

export class DistributionPolynomial {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionPolynomialOptions);
    a: bigint;
    b: bigint;
    d: bigint;
    m: bigint;
    get maxValue(): bigint | undefined;
    set maxValue(value: bigint | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    n: bigint;
    o: bigint;
    get startMoment(): bigint | undefined;
    set startMoment(value: bigint | null | undefined);
}

export class DistributionRandom {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionRandomOptions);
    max: bigint;
    min: bigint;
}

export class DistributionStepDecreasingAmount {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DistributionStepDecreasingAmountOptions);
    decreasePerIntervalDenominator: number;
    decreasePerIntervalNumerator: number;
    distributionStartAmount: bigint;
    get maxIntervalCount(): number | undefined;
    set maxIntervalCount(value: number | null | undefined);
    get minValue(): bigint | undefined;
    set minValue(value: bigint | null | undefined);
    get startDecreasingOffset(): bigint | undefined;
    set startDecreasingOffset(value: bigint | null | undefined);
    stepCount: number;
    trailingDistributionIntervalAmount: bigint;
}

/**
 * DocumentWasm wraps a Document and adds metadata fields that are not part of the core Document.
 */
export class Document {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentOptions);
    static fromBase64(base64: string, dataContract: DataContract, typeName: string, platformVersion: PlatformVersionLike): Document;
    static fromBytes(bytes: Uint8Array, dataContract: DataContract, typeName: string, platformVersion: PlatformVersionLike): Document;
    static fromHex(hex: string, dataContract: DataContract, typeName: string, platformVersion: PlatformVersionLike): Document;
    /**
     * Create a Document from a JSON object (canonical-tagged shape).
     * JSON format has identifiers as base58 strings.
     */
    static fromJSON(value: DocumentJSON, _platform_version: PlatformVersionLike): Document;
    /**
     * Create a Document from a JS object (canonical-tagged shape).
     */
    static fromObject(value: DocumentObject, _platform_version: PlatformVersionLike): Document;
    /**
     * Derives the id of a document that is about to be created, the way
     * consensus recomputes it for the create transition.
     *
     * From protocol version 14 the id commits to the identity contract
     * nonce of the create transition, so `identityContractNonce` is
     * required at that version (and ignored before it). The platform
     * version defaults to the latest.
     */
    static generateId(documentTypeName: string, ownerId: IdentifierLike, dataContractId: IdentifierLike, entropy?: Uint8Array | null, identityContractNonce?: bigint | null, platformVersion?: PlatformVersionLike | null): Uint8Array;
    /**
     * Gives the document the id its create transition will carry, derived
     * from its entropy and the identity contract nonce that transition is
     * going to use.
     *
     * `new DocumentCreateTransition(...)` does this on its own; call it
     * yourself to know the id before the transition exists (a document that
     * another document in the same batch references). The transition must
     * then be built with the same nonce.
     *
     * Throws when the document carries no entropy (one read back from
     * Platform), since only a new document can be created.
     */
    setIdForCreation(identityContractNonce: bigint, platformVersion?: PlatformVersionLike | null): void;
    toBase64(data_contract: DataContract, platform_version: PlatformVersionLike): string;
    toBytes(data_contract: DataContract, platform_version: PlatformVersionLike): Uint8Array;
    toHex(data_contract: DataContract, platform_version: PlatformVersionLike): string;
    /**
     * Convert to a JSON-compatible JS object with binary fields as strings.
     */
    toJSON(_platform_version: PlatformVersionLike): DocumentJSON;
    /**
     * Convert to a JS object with binary fields as Uint8Array.
     *
     * Wire shape (Phase D step 8 slice B):
     * - `$formatVersion: "0"` — canonical Document version tag
     * - `$dataContractId`, `$type`, `$entropy` — wasm-side metadata
     * - V0 Document fields (`$id`, `$ownerId`, `$revision`, …) flat
     *   alongside user-defined properties
     */
    toObject(): DocumentObject;
    get createdAt(): bigint | undefined;
    set createdAt(value: bigint | null | undefined);
    get createdAtBlockHeight(): bigint | undefined;
    set createdAtBlockHeight(value: bigint | null | undefined);
    get createdAtCoreBlockHeight(): number | undefined;
    set createdAtCoreBlockHeight(value: number | null | undefined);
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    documentTypeName: string;
    get entropy(): Uint8Array | undefined;
    set entropy(value: Uint8Array | null | undefined);
    get id(): Identifier;
    set id(value: IdentifierLike);
    /**
     * The block time at which a moderator of the contract last wrote the fields the document
     * type keeps for its moderators (`moderatorAbilities.changeFields`); `undefined` until one
     * does.
     */
    readonly moderatedAt: bigint | undefined;
    /**
     * The moderator who last wrote those fields; `undefined` until one does.
     */
    readonly moderatedBy: Identifier | undefined;
    get ownerId(): Identifier;
    set ownerId(value: IdentifierLike);
    properties: Record<string, unknown>;
    get revision(): bigint | undefined;
    set revision(value: bigint | null | undefined);
    get transferredAt(): bigint | undefined;
    set transferredAt(value: bigint | null | undefined);
    get transferredAtBlockHeight(): bigint | undefined;
    set transferredAtBlockHeight(value: bigint | null | undefined);
    get transferredAtCoreBlockHeight(): number | undefined;
    set transferredAtCoreBlockHeight(value: number | null | undefined);
    get updatedAt(): bigint | undefined;
    set updatedAt(value: bigint | null | undefined);
    get updatedAtBlockHeight(): bigint | undefined;
    set updatedAtBlockHeight(value: bigint | null | undefined);
    get updatedAtCoreBlockHeight(): number | undefined;
    set updatedAtCoreBlockHeight(value: number | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * What a document transition agrees to pay in document action fees. The amounts are the ones
 * the document type declares for the action, read off the contract by the signer.
 */
export class DocumentActionFeeAgreement {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentActionFeeAgreementOptions);
    /**
     * The agreement a transition performing `action` on a document of the type
     * `documentTypeName` of `dataContract` must carry, or `undefined` when the type charges
     * nothing for it. It names what the contract declares, so it is only as current as
     * `dataContract`: pass the contract the user was shown. `feeMultiplier` is required for a
     * fee priced by the fee multiplier; a fixed fee names none, so for one it is only
     * validated. The Rust SDK's `DocumentActionFeeAgreement::for_document_type_action`.
     */
    static forDocumentTypeAction(dataContract: DataContract, documentTypeName: string, action: DocumentActionFeeAction, feeMultiplier?: AgreedFeeMultiplierOptions | null): DocumentActionFeeAgreement | undefined;
    static fromJSON(js: DocumentActionFeeAgreementJSON): DocumentActionFeeAgreement;
    static fromObject(obj: DocumentActionFeeAgreementObject): DocumentActionFeeAgreement;
    toJSON(): DocumentActionFeeAgreementJSON;
    toObject(): DocumentActionFeeAgreementObject;
    readonly feeMultiplierIncreaseTolerancePercent: number | undefined;
    readonly knownFeeMultiplierPermille: bigint | undefined;
    readonly moderators: bigint;
    readonly owner: bigint;
    readonly pricing: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class DocumentBaseTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentBaseTransitionOptions);
    /**
     * The action fees this transition agrees to pay. A base older than version 2, which a
     * transition decoded from the wire can carry, has none.
     */
    get actionFeeAgreement(): DocumentActionFeeAgreement | undefined;
    /**
     * Sets the action fees this transition agrees to pay, `undefined` clears them.
     *
     * Only a base of version 2 carries an agreement, so an older base, which the constructor
     * builds when it is given none, is rebuilt as version 2 to take one.
     */
    set actionFeeAgreement(value: DocumentActionFeeAgreement | null | undefined);
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    documentTypeName: string;
    get id(): Identifier;
    set id(value: IdentifierLike);
    identityContractNonce: bigint;
    /**
     * The token payment info, cloned: the wrapper handed to JavaScript owns its copy, and the
     * payment info is no longer `Copy` now that a variant of it carries a shielded spend bundle.
     */
    get tokenPaymentInfo(): TokenPaymentInfo | undefined;
    set tokenPaymentInfo(value: TokenPaymentInfo | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class DocumentCreateTransition {
    free(): void;
    [Symbol.dispose](): void;
    clearPrefundedVotingBalance(): void;
    constructor(options: DocumentCreateTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentCreateTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    data: Record<string, unknown>;
    entropy: Uint8Array;
    get prefundedVotingBalance(): PrefundedVotingBalance | undefined;
    set prefundedVotingBalance(value: PrefundedVotingBalance);
    static readonly __struct: string;
    readonly __type: string;
}

export class DocumentDeleteTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentDeleteTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentDeleteTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Consensus error codes emitted by the `distinctFrom` check on document
 * creates and replaces (protocol version 14+).
 *
 * Branch on an error's `code` against this instead of matching its message:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentDistinctFromErrorCode.DocumentPropertyNotDistinct) {
 *     // an identifier property equals the value it must differ from
 *   }
 * }
 * ```
 */
export enum DocumentDistinctFromErrorCode {
    /**
     * A `distinctFrom` identifier property of the written document equals
     * the value it must differ from: the document's `$ownerId`, or the named
     * property of the same document.
     */
    DocumentPropertyNotDistinct = 10419,
}

/**
 * Consensus error codes emitted by `encryptedFor` validation, which runs
 * from protocol version 14 onward on every document create and replace.
 *
 * Branch on an error's `code` against these instead of matching its
 * message:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentEncryptionErrorCode.InvalidEncryptedPropertyShape) {
 *     // the bytes are not the shape the declared scheme produces
 *   }
 * }
 * ```
 */
export enum DocumentEncryptionErrorCode {
    /**
     * A property the document type declares `encryptedFor` was supplied
     * with bytes that are not a ciphertext of the declared scheme: shorter
     * than the IV plus one block, or not a multiple of the block length.
     * The shape is all consensus checks about a ciphertext.
     */
    InvalidEncryptedPropertyShape = 10420,
}

/**
 * Consensus error codes emitted by the `generatedFrom` check, which runs
 * from protocol version 14 onward wherever a document is validated, on every
 * create and replace included.
 *
 * Branch on an error's `code` against this instead of matching its message:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentGeneratedFromErrorCode.DocumentPropertyNotGenerated) {
 *     // a generated property was sent with a value other than what its
 *     // function generates, or without its params; leaving it out lets
 *     // the platform generate it
 *   }
 * }
 * ```
 */
export enum DocumentGeneratedFromErrorCode {
    /**
     * A `generatedFrom` string property holds a value other than what its
     * function generates from its params, or is present while a param is
     * absent.
     */
    DocumentPropertyNotGenerated = 10424,
}

/**
 * Consensus error codes emitted by the immutable-property check on document
 * replaces (`immutable`, protocol version 14+).
 *
 * Branch on an error's `code` against this instead of matching its message:
 *
 * ```js
 * try {
 *   await sdk.documents.replace({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentImmutabilityErrorCode.DocumentImmutablePropertyChanged) {
 *     // the replace touched a property the document type freezes
 *   }
 * }
 * ```
 */
export enum DocumentImmutabilityErrorCode {
    /**
     * The replace changed, added or removed a property the document type
     * lists under `immutable`: by name, or with a condition that held for
     * the replace.
     */
    DocumentImmutablePropertyChanged = 40128,
}

/**
 * Consensus error codes emitted by the `maxBytes` check, which runs from
 * protocol version 14 onward wherever a document is validated, on every
 * create and replace included.
 *
 * Branch on an error's `code` against these instead of matching its
 * message:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentMaxBytesErrorCode.MaxBytesExceeded) {
 *     // a string is longer in UTF-8 bytes than its property's maxBytes
 *   }
 * }
 * ```
 */
export enum DocumentMaxBytesErrorCode {
    /**
     * A string, or an element of a typed array of strings, is longer in
     * UTF-8 bytes than the `maxBytes` its property declares. `maxLength`
     * counts characters, which are up to four bytes each.
     */
    MaxBytesExceeded = 10421,
}

/**
 * Consensus error codes emitted by the `propertyConstraints` check, which
 * runs from protocol version 14 onward wherever a document is validated, on
 * every create and replace included.
 *
 * Branch on an error's `code` against this instead of matching its message:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentPropertyConstraintErrorCode.DocumentPropertyConstraintViolated) {
 *     // the document breaks one of its type's rules; the message names it
 *   }
 * }
 * ```
 */
export enum DocumentPropertyConstraintErrorCode {
    /**
     * The written document breaks a rule of its document type's
     * `propertyConstraints`: the rule does not hold, or evaluating it
     * overflowed, divided by zero, raised to a negative power or read a value
     * that is not an integer.
     */
    DocumentPropertyConstraintViolated = 10422,
}

export class DocumentPurchaseTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentPurchaseTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentPurchaseTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    price: bigint;
    revision: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Consensus error codes emitted by `refersTo` reference validation, which
 * runs from protocol version 14 onward.
 *
 * Branch on an error's `code` against these instead of matching its
 * message. Both directions work — `DocumentReferenceErrorCode[40123]` is
 * `"ReferencedIdentityKeyNotFound"`.
 *
 * These reach JS on the state-transition broadcast path, where the
 * consensus code is carried through to `WasmSdkError.code`:
 *
 * ```js
 * try {
 *   await sdk.documents.create({ document, identityKey, signer });
 * } catch (e) {
 *   if (e.code === DocumentReferenceErrorCode.ReferencedIdentityKeyDisabled) {
 *     // the referenced key exists but was disabled
 *   }
 * }
 * ```
 */
export enum DocumentReferenceErrorCode {
    /**
     * The referenced identity, contract, token or document (permanent or
     * deletable) does not exist, or a value with `inList` is not an element
     * of the list it must be in (or was set while the property finding the
     * list's document was not).
     */
    ReferencedEntityNotFound = 40120,
    /**
     * A `permanentDocument` or `deletableDocument` reference names a
     * document type the referenced contract does not define, or the
     * contract itself is missing.
     */
    ReferencedDocumentTypeNotFound = 40121,
    /**
     * The referenced document type allows deletion. Only types declaring
     * `canBeDeleted: false` may be the target of a `permanentDocument`
     * reference — otherwise the reference could be left dangling. A
     * `deletableDocument` reference is the one for such a type.
     */
    ReferencedDocumentTypeDeletable = 40122,
    /**
     * The referenced identity public key does not exist.
     */
    ReferencedIdentityKeyNotFound = 40123,
    /**
     * The referenced identity public key exists but is disabled.
     */
    ReferencedIdentityKeyDisabled = 40124,
    /**
     * The declaration's `keyIdProperty` is missing from the document type,
     * or names a property that is not an integer.
     */
    ReferencedKeyIdPropertyInvalid = 40125,
    /**
     * The referenced document type forbids deletion. Only types whose
     * documents can be deleted may be the target of a `deletableDocument`
     * reference; a `permanentDocument` reference is the one for a type
     * declaring `canBeDeleted: false`.
     */
    ReferencedDocumentTypeNotDeletable = 40131,
    /**
     * The referenced contract exists but does not meet what the reference's
     * `contractRequirements` require of it: elected moderation, its election
     * open, a minimum age or a minimum time since its last update at the block
     * time of the write, an owner relation to the writer of the referring
     * document, or a config flag (read-only, keeping history, the owner
     * protection of its elected moderation declaration).
     */
    ReferencedContractRequirementNotMet = 40135,
    /**
     * The referenced identity public key exists and is enabled but does not
     * meet what the reference's `keyRequirements` require of it: its
     * purpose, or a binding to a document type of the declaring contract.
     */
    ReferencedIdentityKeyRequirementNotMet = 40136,
    /**
     * A `refersTo` `findBy` into a document type of another contract cannot
     * resolve there, reported at contract registration: no unique index is
     * over exactly the properties it names, or a source holds a different
     * kind of value than the property it fills. (A `findBy` into the
     * declaring contract is refused by the contract parse instead.)
     */
    ReferencedDocumentLookupInvalid = 40137,
    /**
     * A `refersTo` with `inList` whose list lives in a document type of
     * another contract cannot be served by it, reported at contract
     * registration: that type's documents can be deleted, the list is not a
     * stored typed array of identifiers of it, or a replace could change the
     * list. (A list in the declaring contract is refused by the contract parse
     * instead.)
     */
    ReferencedDocumentListInvalid = 40138,
    /**
     * The document a `refersTo` `findBy` function found, the commitment the
     * create reveals, exists but does not meet the reference's
     * `minimumAgeBlocks`: it was created too recently, in the same block
     * with a minimum of 1. Retry in a later block.
     */
    ReferencedDocumentRequirementNotMet = 40142,
    /**
     * The referenced document type's documents can leave state otherwise
     * than through a moderator's recorded removal. Only types declaring
     * `canBeDeleted: false`, no `ttl`, and `moderatorAbilities.delete`
     * keeping removal records may be the target of a `moderatedDocument`
     * reference.
     */
    ReferencedDocumentTypeNotModerated = 40143,
    /**
     * The referenced document type's documents leave state only through a
     * moderator's recorded removal: a `moderatedDocument` reference is the
     * one for it, not a `deletableDocument` one.
     */
    ReferencedDocumentTypeModerated = 40144,
    /**
     * A replace kept a `moderatedDocument` reference whose document the
     * contract's moderators removed, and had to check a `where` entry
     * against a property its removal record does not keep (a record keeps
     * the document's id, its owner and the fields its type lists under
     * `moderatorAbilities.deleteKeepsFields`). Point the reference at a
     * document in state, or leave the properties `where` reads unchanged
     * until the document is restored.
     */
    ReferencedDocumentRemoved = 40145,
    /**
     * A reference that finds its document by the document's id (a
     * `permanentDocument`, `deletableDocument` or `moderatedDocument`
     * reference without `findBy`, or one with `inList`, whose list's
     * document is read by its id) names an `indexOnly` document type,
     * reported at contract registration. Such a type's documents exist only
     * as index entries and cannot be fetched by id, so no write could check
     * the reference.
     */
    ReferencedDocumentTypeIndexOnly = 40146,
    /**
     * A `propertyConstraints` rule reads, through a reference into a document
     * type of another contract (`{ "referenced": [reference, field] }`), a
     * field that type can not give it, reported at contract registration: one
     * it does not have, a transient one, one of another kind than the rule
     * reads, a time or height or a `$creatorId` it does not record, a constant
     * its `enum` does not list, or, through a `moderatedDocument` reference, a
     * field its removal record does not keep. (A rule reading a type of the
     * declaring contract is refused by the contract parse instead.)
     */
    ReferencedDocumentRuleReadInvalid = 40148,
    /**
     * The commitment a create's `refersTo` found, its writer's own, is
     * preceded by another identity's: a commitment to the same values (the
     * same value at the property the reference's `chooseFirst` groups by)
     * ordered before it by the `chooseFirst`'s `by`, not expired, and valid,
     * made by an identity that knew the values and not copied. The first
     * valid commitment in that order wins (the earliest block's, ordered by
     * `$createdAtBlockHeight` ascending).
     */
    ReferencedDocumentPreceded = 40149,
    /**
     * A create cannot reveal the preimage of a `refersTo` `findBy`
     * function: a value a param reads is absent, or a variable-length
     * value holds the one-byte separator that follows it in the preimage.
     */
    DocumentReferencePreimageInvalid = 10423,
}

export class DocumentReplaceTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentReplaceTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentReplaceTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    data: Record<string, unknown>;
    revision: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export class DocumentTransferTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentTransferTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentTransferTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    get recipientOwnerId(): Identifier;
    set recipientOwnerId(value: IdentifierLike);
    static readonly __struct: string;
    readonly __type: string;
}

export class DocumentTransition {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly actionType: string;
    readonly actionTypeNumber: number;
    readonly createTransition: DocumentCreateTransition;
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    readonly deleteTransition: DocumentDeleteTransition;
    readonly documentTypeName: string;
    readonly entropy: Uint8Array | undefined;
    readonly id: Identifier;
    identityContractNonce: bigint;
    readonly purchaseTransition: DocumentPurchaseTransition;
    readonly replaceTransition: DocumentReplaceTransition;
    get revision(): bigint | undefined;
    set revision(value: bigint);
    static readonly __struct: string;
    readonly transferTransition: DocumentTransferTransition;
    readonly __type: string;
    readonly updatePriceTransition: DocumentUpdatePriceTransition;
}

export class DocumentUpdatePriceTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: DocumentUpdatePriceTransitionOptions);
    static fromDocumentTransition(transition: DocumentTransition): DocumentUpdatePriceTransition;
    toDocumentTransition(): DocumentTransition;
    base: DocumentBaseTransition;
    price: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export class DpnsUsernameInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(username: string, identity_id: Identifier, document_id: Identifier);
    static fromJSON(js: object): DpnsUsernameInfo;
    static fromObject(obj: object): DpnsUsernameInfo;
    toJSON(): any;
    toObject(): any;
    documentId: Identifier;
    identityId: Identifier;
    username: string;
}

/**
 * Whose keys an encrypted property of a stored document is under: what a reader fetches to
 * decrypt it.
 */
export class EncryptedPropertyEnvelope {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The identity the bytes are encrypted for.
     */
    readonly recipientId: Identifier;
    /**
     * The id of the recipient's key, from the declaration's `recipientKey` property.
     */
    readonly recipientKeyId: number;
    /**
     * The identity whose key `senderKeyId` names: the document owner, the writer that
     * encrypted the bytes. A document whose owner may have changed since (transferred or
     * sold) is refused rather than given a sender that did not encrypt it.
     */
    readonly senderId: Identifier;
    /**
     * The id of the sender's key, from the declaration's `senderKey` property.
     */
    readonly senderKeyId: number;
}

export class EpochBasedDistribution {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    function: DistributionFunction;
    static readonly __struct: string;
    readonly __type: string;
    interval: number;
}

export class ExtendedEpochInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: ExtendedEpochInfoOptions);
    static fromJSON(js: ExtendedEpochInfoJSON): ExtendedEpochInfo;
    static fromObject(obj: ExtendedEpochInfoObject): ExtendedEpochInfo;
    toJSON(): ExtendedEpochInfoJSON;
    toObject(): ExtendedEpochInfoObject;
    readonly feeMultiplier: number;
    feeMultiplierPermille: bigint;
    firstBlockHeight: bigint;
    firstBlockTime: bigint;
    firstCoreBlockHeight: number;
    index: number;
    protocolVersion: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Defines how fees are paid in address-based state transitions.
 *
 * Fee strategy is a sequence of steps that determine which inputs or outputs
 * should be reduced to cover the transaction fee.
 *
 * `#[serde(transparent)]` delegates to the inner `AddressFundsFeeStrategyStep`'s
 * custom serde, which produces the `{ $type, index }` adjacent shape used by
 * every wasm-sdk consumer that round-trips a `Vec<FeeStrategyStepWasm>`.
 */
export class FeeStrategyStep {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates a step that deducts the fee from the input at the given index.
     *
     * The input must have remaining balance after its contribution to outputs.
     *
     * @param index - The index of the input address to deduct fee from
     */
    static deductFromInput(index: number): FeeStrategyStep;
    /**
     * Creates a step that reduces the output at the given index by the fee amount.
     *
     * The output amount will be reduced to cover the fee.
     *
     * @param index - The index of the output address to reduce
     */
    static reduceOutput(index: number): FeeStrategyStep;
    /**
     * Returns the index associated with this step.
     */
    readonly index: number;
    /**
     * Returns true if this step deducts from an input.
     */
    readonly isDeductFromInput: boolean;
    /**
     * Returns true if this step reduces an output.
     */
    readonly isReduceOutput: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

export class FinalizedEpochInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: FinalizedEpochInfoOptions);
    static fromJSON(js: FinalizedEpochInfoJSON): FinalizedEpochInfo;
    static fromObject(obj: FinalizedEpochInfoObject): FinalizedEpochInfo;
    toJSON(): FinalizedEpochInfoJSON;
    toObject(): FinalizedEpochInfoObject;
    blockProposers: BlockProposersMap;
    coreBlockRewards: bigint;
    readonly feeMultiplier: number;
    feeMultiplierPermille: bigint;
    firstBlockHeight: bigint;
    firstBlockTime: bigint;
    firstCoreBlockHeight: number;
    nextEpochStartCoreBlockHeight: number;
    protocolVersion: number;
    totalBlocksInEpoch: bigint;
    totalCreatedStorageFees: bigint;
    totalDistributedStorageFees: bigint;
    totalProcessingFees: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export enum GasFeesPaidBy {
    DocumentOwner = 0,
    ContractOwner = 1,
    PreferContractOwner = 2,
}

export class Group {
    free(): void;
    [Symbol.dispose](): void;
    constructor(members: GroupMembersMap, requiredPower: number);
    static fromJSON(js: GroupJSON): Group;
    static fromObject(obj: GroupObject): Group;
    setMemberRequiredPower(member: IdentifierLike, memberRequiredPower: number): void;
    toJSON(): GroupJSON;
    toObject(): GroupObject;
    members: GroupMembersMap;
    requiredPower: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class GroupAction {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: GroupActionJSON): GroupAction;
    static fromObject(obj: GroupActionObject): GroupAction;
    toJSON(): GroupActionJSON;
    toObject(): GroupActionObject;
    readonly contractId: Identifier;
    readonly event: GroupActionEvent;
    readonly proposerId: Identifier;
    static readonly __struct: string;
    readonly tokenContractPosition: number;
    readonly __type: string;
}

export class GroupActionEvent {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    eventName(): string;
    static fromJSON(js: GroupActionEventJSON): GroupActionEvent;
    static fromObject(obj: GroupActionEventObject): GroupActionEvent;
    publicNote(): string | undefined;
    toJSON(): GroupActionEventJSON;
    toObject(): GroupActionEventObject;
    tokenEvent(): TokenEvent;
    static readonly __struct: string;
    readonly __type: string;
    readonly variant: GroupActionEventVariant;
}

/**
 * TypeScript enum for GroupActionEvent variants
 */
export enum GroupActionEventVariant {
    TokenEvent = 0,
}

export class GroupStateTransitionInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: GroupStateTransitionInfoOptions);
    get actionId(): Identifier;
    set actionId(value: IdentifierLike);
    groupContractPosition: number;
    isActionProposer: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Wrapper for GroupStateTransitionInfoStatus enum.
 *
 * This represents the group action context for a state transition:
 * - Proposer: The identity proposing a new group action
 * - OtherSigner: The identity signing/voting on an existing group action
 */
export class GroupStateTransitionInfoStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a new other signer status for voting on an existing group action.
     *
     * Use this when the identity is signing/voting on an action proposed by someone else.
     *
     * @param groupContractPosition - The position of the group in the contract
     * @param actionId - The ID of the action being voted on
     * @returns GroupStateTransitionInfoStatus for an other signer
     */
    static otherSigner(groupContractPosition: number, actionId: IdentifierLike): GroupStateTransitionInfoStatus;
    /**
     * Create a new proposer status for initiating a group action.
     *
     * Use this when the identity is proposing a new group action.
     *
     * @param groupContractPosition - The position of the group in the contract
     * @returns GroupStateTransitionInfoStatus for a proposer
     */
    static proposer(groupContractPosition: number): GroupStateTransitionInfoStatus;
    /**
     * Convert to GroupStateTransitionInfo.
     */
    toInfo(): GroupStateTransitionInfo;
    /**
     * Get the action ID (only available for other signer status).
     * Returns null for proposer status.
     */
    readonly actionId: Identifier | undefined;
    /**
     * Get the group contract position.
     */
    readonly groupContractPosition: number;
    /**
     * Check if this is a proposer status.
     */
    readonly isProposer: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

export class Identifier {
    free(): void;
    [Symbol.dispose](): void;
    constructor(identifier: IdentifierLike);
    static fromBase58(base58: string): Identifier;
    static fromBase64(base64: string): Identifier;
    static fromBytes(bytes: Uint8Array): Identifier;
    static fromHex(hex: string): Identifier;
    toBase58(): string;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    /**
     * Returns the identifier as a Base58 string for JSON serialization.
     * This method is called automatically when the object is serialized to JSON.
     */
    toJSON(): string;
    /**
     * Returns the identifier as a Base58 string.
     * This is the default string representation for JavaScript.
     */
    toString(): string;
    static readonly __struct: string;
    readonly __type: string;
}

export class Identity {
    free(): void;
    [Symbol.dispose](): void;
    addPublicKey(publicKey: IdentityPublicKey): void;
    constructor(id: IdentifierLike);
    static fromBase64(base64: string): Identity;
    static fromBytes(bytes: Uint8Array): Identity;
    static fromHex(hex: string): Identity;
    static fromJSON(value: IdentityJSON): Identity;
    /**
     * `fromObject` keeps the manual path because the wasm API dispatches on
     * the `platform_version` arg (via `try_from_platform_versioned`) rather
     * than the value's embedded `$formatVersion` tag — explicit version
     * coupling is the wasm SDK convention. The canonical
     * `ValueConvertible::from_object` would dispatch on the tag.
     */
    static fromObject(value: IdentityObject, platform_version: PlatformVersionLike): Identity;
    getPublicKeyById(keyId: number): IdentityPublicKey | undefined;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityJSON;
    toObject(): IdentityObject;
    balance: bigint;
    get id(): Identifier;
    set id(value: IdentifierLike);
    readonly publicKeys: IdentityPublicKey[];
    revision: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityBalanceAndRevision {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): IdentityBalanceAndRevision;
    static fromObject(obj: object): IdentityBalanceAndRevision;
    toJSON(): any;
    toObject(): any;
    readonly balance: bigint;
    readonly revision: bigint;
}

export class IdentityContractKeys {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    identityId: Identifier;
    keys: IdentityPublicKey[];
}

/**
 * Result of creating an identity from Platform addresses.
 */
export class IdentityCreateFromAddressesResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Map of addresses to their updated info after the identity creation.
     */
    readonly addressInfos: Map<any, any>;
    /**
     * The newly created identity.
     */
    readonly identity: Identity;
}

export class IdentityCreateFromAddressesTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityCreateFromAddressesTransitionOptions);
    static fromBase64(base64: string): IdentityCreateFromAddressesTransition;
    static fromBytes(bytes: Uint8Array): IdentityCreateFromAddressesTransition;
    static fromHex(hex: string): IdentityCreateFromAddressesTransition;
    static fromJSON(js: IdentityCreateFromAddressesTransitionJSON): IdentityCreateFromAddressesTransition;
    static fromObject(obj: IdentityCreateFromAddressesTransitionObject): IdentityCreateFromAddressesTransition;
    static fromStateTransition(st: StateTransition): IdentityCreateFromAddressesTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityCreateFromAddressesTransitionJSON;
    toObject(): IdentityCreateFromAddressesTransitionObject;
    toStateTransition(): StateTransition;
    inputs: PlatformAddressInput[];
    get output(): PlatformAddressOutput | undefined;
    set output(value: PlatformAddressOutput | null | undefined);
    get publicKeys(): IdentityPublicKeyInCreation[];
    set publicKeys(value: Array<any>);
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityCreateFromShieldedPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): IdentityCreateFromShieldedPoolTransition;
    static fromJSON(js: IdentityCreateFromShieldedPoolTransitionJSON): IdentityCreateFromShieldedPoolTransition;
    static fromObject(obj: IdentityCreateFromShieldedPoolTransitionObject): IdentityCreateFromShieldedPoolTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: IdentityCreateFromShieldedPoolTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): IdentityCreateFromShieldedPoolTransitionJSON;
    toObject(): IdentityCreateFromShieldedPoolTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the fixed exit denomination (credits leaving the shielded pool).
     */
    readonly denomination: bigint;
    /**
     * Returns the new identity's id (derived from the spend nullifiers).
     */
    readonly identityId: Identifier;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    /**
     * Returns the public keys of the new identity.
     */
    readonly publicKeys: IdentityPublicKeyInCreation[];
    /**
     * Returns the fallback platform address credited if identity creation
     * fails a stateful check.
     */
    readonly sendToAddressOnCreationFailure: PlatformAddress;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityCreateTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityCreateTransitionOptions);
    static default(platformVersion: PlatformVersionLike): IdentityCreateTransition;
    static fromBase64(base64: string): IdentityCreateTransition;
    static fromBytes(bytes: Uint8Array): IdentityCreateTransition;
    static fromHex(hex: string): IdentityCreateTransition;
    static fromJSON(js: IdentityCreateTransitionJSON): IdentityCreateTransition;
    static fromObject(obj: IdentityCreateTransitionObject): IdentityCreateTransition;
    static fromStateTransition(st: StateTransition): IdentityCreateTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityCreateTransitionJSON;
    toObject(): IdentityCreateTransitionObject;
    toStateTransition(): StateTransition;
    assetLockProof: AssetLockProof;
    readonly identityId: Identifier;
    get publicKeys(): IdentityPublicKeyInCreation[];
    set publicKeys(value: Array<any>);
    signature: Uint8Array;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityCreditTransfer {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityCreditTransferOptions);
    static fromBase64(base64: string): IdentityCreditTransfer;
    static fromBytes(bytes: Uint8Array): IdentityCreditTransfer;
    static fromHex(hex: string): IdentityCreditTransfer;
    static fromJSON(js: IdentityCreditTransferJSON): IdentityCreditTransfer;
    static fromObject(obj: IdentityCreditTransferObject): IdentityCreditTransfer;
    static fromStateTransition(st: StateTransition): IdentityCreditTransfer;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityCreditTransferJSON;
    toObject(): IdentityCreditTransferObject;
    toStateTransition(): StateTransition;
    amount: bigint;
    nonce: bigint;
    get recipientId(): Identifier;
    set recipientId(value: IdentifierLike);
    get senderId(): Identifier;
    set senderId(value: IdentifierLike);
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of transferring credits between identities.
 */
export class IdentityCreditTransferResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Balance of the recipient identity after the transfer.
     */
    readonly recipientBalance: bigint;
    /**
     * Balance of the sender identity after the transfer.
     */
    readonly senderBalance: bigint;
}

export class IdentityCreditTransferToAddresses {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityCreditTransferToAddressesOptions);
    static fromBase64(base64: string): IdentityCreditTransferToAddresses;
    static fromBytes(bytes: Uint8Array): IdentityCreditTransferToAddresses;
    static fromHex(hex: string): IdentityCreditTransferToAddresses;
    static fromJSON(js: IdentityCreditTransferToAddressesJSON): IdentityCreditTransferToAddresses;
    static fromObject(obj: IdentityCreditTransferToAddressesObject): IdentityCreditTransferToAddresses;
    static fromStateTransition(st: StateTransition): IdentityCreditTransferToAddresses;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityCreditTransferToAddressesJSON;
    toObject(): IdentityCreditTransferToAddressesObject;
    toStateTransition(): StateTransition;
    nonce: bigint;
    recipientAddresses: PlatformAddressOutput[];
    get senderId(): Identifier;
    set senderId(value: IdentifierLike);
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityCreditWithdrawalTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityCreditWithdrawalTransitionOptions);
    static fromBase64(base64: string): IdentityCreditWithdrawalTransition;
    static fromBytes(bytes: Uint8Array): IdentityCreditWithdrawalTransition;
    static fromHex(hex: string): IdentityCreditWithdrawalTransition;
    static fromJSON(js: IdentityCreditWithdrawalTransitionJSON): IdentityCreditWithdrawalTransition;
    static fromObject(obj: IdentityCreditWithdrawalTransitionObject): IdentityCreditWithdrawalTransition;
    static fromStateTransition(st: StateTransition): IdentityCreditWithdrawalTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityCreditWithdrawalTransitionJSON;
    toObject(): IdentityCreditWithdrawalTransitionObject;
    toStateTransition(): StateTransition;
    amount: bigint;
    coreFeePerByte: number;
    get identityId(): Identifier;
    set identityId(value: IdentifierLike);
    readonly modifiedDataIds: Identifier[];
    nonce: bigint;
    readonly optionalAssetLockProof: AssetLockProof | undefined;
    outputScript: CoreScript | undefined;
    get pooling(): string;
    set pooling(value: CreditWithdrawalTransitionPoolingLike);
    readonly purposeRequirement: string[];
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityGroupInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    dataContractId: string;
    groupContractPosition: number;
    role: string;
    readonly power: bigint | undefined;
}

export class IdentityKeyLimitsUpdate {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityKeyLimitsUpdateTransitionOptions);
    static fromBase64(base64: string): IdentityKeyLimitsUpdate;
    static fromBytes(bytes: Uint8Array): IdentityKeyLimitsUpdate;
    static fromHex(hex: string): IdentityKeyLimitsUpdate;
    static fromJSON(js: IdentityKeyLimitsUpdateJSON): IdentityKeyLimitsUpdate;
    static fromObject(obj: IdentityKeyLimitsUpdateObject): IdentityKeyLimitsUpdate;
    static fromStateTransition(st: StateTransition): IdentityKeyLimitsUpdate;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityKeyLimitsUpdateJSON;
    toObject(): IdentityKeyLimitsUpdateObject;
    toStateTransition(): StateTransition;
    get expiresAt(): bigint | undefined;
    set expiresAt(value: bigint | null | undefined);
    get identityId(): Identifier;
    set identityId(value: IdentifierLike);
    keyId: number;
    nonce: bigint;
    signature: Uint8Array;
    signaturePublicKeyId: number;
    get totalBudget(): bigint | undefined;
    set totalBudget(value: bigint | null | undefined);
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityPublicKey {
    free(): void;
    [Symbol.dispose](): void;
    base64(): string;
    constructor(options: IdentityPublicKeyOptions);
    static fromBase64(hex: string): IdentityPublicKey;
    static fromBytes(bytes: Uint8Array): IdentityPublicKey;
    static fromHex(hex: string): IdentityPublicKey;
    /**
     * Deserialize from JSON-compatible JS object (canonical wire shape).
     *
     * Expects base64 strings for binary fields, base58 strings for
     * identifiers — the canonical shape produced by `toJSON`.
     * `platform_version` is accepted for SDK API consistency but not
     * load-bearing today (canonical tag-driven dispatch handles V0).
     */
    static fromJSON(value: IdentityPublicKeyJSON, _platform_version: PlatformVersionLike): IdentityPublicKey;
    /**
     * Deserialize from JS object (non-human-readable).
     *
     * Uses platform_value conversion which properly handles the tagged enum.
     * `platform_version` is accepted for SDK API consistency but not
     * load-bearing today — canonical `ValueConvertible::from_object`
     * dispatches on the value's `$formatVersion` tag, which produces
     * identical output for the only currently-defined V0.
     */
    static fromObject(value: IdentityPublicKeyObject, _platform_version: PlatformVersionLike): IdentityPublicKey;
    getPublicKeyHash(): string;
    hex(): string;
    toBytes(): Uint8Array;
    /**
     * Serialize to JSON-compatible JS object (canonical wire shape).
     *
     * Binary fields render as base64 strings. Identifier fields render
     * as base58 strings. This matches the canonical `JsonConvertible`
     * path used by every other rs-dpp type's JSON conversion in this
     * SDK — including `IdentityWasm.toJSON`'s embedded public keys.
     */
    toJSON(): IdentityPublicKeyJSON;
    /**
     * Serialize to JS object (non-human-readable).
     *
     * Uses platform_value conversion which properly handles the tagged enum.
     * `disabledAt: null` is stripped automatically by the
     * `skip_serializing_if` attribute on the rs-dpp side.
     */
    toObject(): IdentityPublicKeyObject;
    validatePrivateKey(private_key_bytes_input: Uint8Array, network: NetworkLike): boolean;
    readonly contractBounds: ContractBounds | undefined;
    data: string;
    get disabledAt(): bigint | undefined;
    set disabledAt(value: any);
    /**
     * The block time in milliseconds from which the key can no longer sign, `undefined` when
     * it does not expire
     */
    get expiresAt(): bigint | undefined;
    /**
     * Setting an expiry on a version 0 key makes it a version 1 key
     */
    set expiresAt(value: bigint | null | undefined);
    readonly isMaster: boolean;
    isReadOnly: boolean;
    get keyId(): number;
    set keyId(value: any);
    get keyType(): string;
    set keyType(value: KeyTypeLike);
    readonly keyTypeNumber: KeyType;
    get purpose(): string;
    set purpose(value: PurposeLike);
    readonly purposeNumber: Purpose;
    get securityLevel(): string;
    set securityLevel(value: SecurityLevelLike);
    readonly securityLevelNumber: SecurityLevel;
    /**
     * The total credits the key may spend over its lifetime, `undefined` when it has no budget
     */
    get totalBudget(): bigint | undefined;
    /**
     * Setting a budget on a version 0 key makes it a version 1 key
     */
    set totalBudget(value: bigint | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityPublicKeyInCreation {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityPublicKeyInCreationOptions);
    static fromJSON(js: IdentityPublicKeyInCreationJSON): IdentityPublicKeyInCreation;
    static fromObject(obj: IdentityPublicKeyInCreationObject): IdentityPublicKeyInCreation;
    getHash(): Uint8Array;
    toIdentityPublicKey(): IdentityPublicKey;
    toJSON(): IdentityPublicKeyInCreationJSON;
    toObject(): IdentityPublicKeyInCreationObject;
    get contractBounds(): ContractBounds | undefined;
    set contractBounds(value: ContractBounds | null | undefined);
    data: Uint8Array;
    /**
     * The block time in milliseconds from which the key can no longer sign, `undefined` when
     * it does not expire
     */
    get expiresAt(): bigint | undefined;
    /**
     * Setting an expiry on a version 0 key makes it a version 1 key. The key's own signature
     * no longer covers it afterwards: sign again.
     */
    set expiresAt(value: bigint | null | undefined);
    isReadOnly: boolean;
    get keyId(): number;
    set keyId(value: any);
    get keyType(): string;
    set keyType(value: KeyTypeLike);
    get purpose(): string;
    set purpose(value: PurposeLike);
    get securityLevel(): string;
    set securityLevel(value: SecurityLevelLike);
    signature: Uint8Array;
    /**
     * The credits the key may spend over its lifetime, `undefined` when it has no budget
     */
    get totalBudget(): bigint | undefined;
    /**
     * Setting a budget on a version 0 key makes it a version 1 key. The key's own signature
     * no longer covers it afterwards: sign again.
     */
    set totalBudget(value: bigint | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A signer for identity-based state transitions.
 *
 * Private keys are stored by their public key hash (20 bytes).
 * Both ECDSA_HASH160 and ECDSA_SECP256K1 keys are looked up by hash160.
 */
export class IdentitySigner {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Adds a private key to the signer.
     *
     * The key is stored by public key hash (20 bytes): Hash160(compressed_public_key)
     *
     * @param privateKey - The PrivateKey object
     */
    addKey(privateKey: PrivateKey): void;
    /**
     * Adds a private key from WIF format.
     *
     * @param wif - The private key in WIF format
     */
    addKeyFromWif(wif: string): void;
    /**
     * Creates a new empty IdentitySigner.
     */
    constructor();
    /**
     * Returns the number of keys in this signer.
     */
    readonly keyCount: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityTokenInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly isFrozen: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of topping up an identity from Platform addresses.
 */
export class IdentityTopUpFromAddressesResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Map of addresses to their updated info after the top up.
     */
    readonly addressInfos: Map<any, any>;
    /**
     * New balance of the identity after top up.
     */
    readonly newBalance: bigint;
}

export class IdentityTopUpFromAddressesTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityTopUpFromAddressesTransitionOptions);
    static fromBase64(base64: string): IdentityTopUpFromAddressesTransition;
    static fromBytes(bytes: Uint8Array): IdentityTopUpFromAddressesTransition;
    static fromHex(hex: string): IdentityTopUpFromAddressesTransition;
    static fromJSON(js: IdentityTopUpFromAddressesTransitionJSON): IdentityTopUpFromAddressesTransition;
    static fromObject(obj: IdentityTopUpFromAddressesTransitionObject): IdentityTopUpFromAddressesTransition;
    static fromStateTransition(st: StateTransition): IdentityTopUpFromAddressesTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityTopUpFromAddressesTransitionJSON;
    toObject(): IdentityTopUpFromAddressesTransitionObject;
    toStateTransition(): StateTransition;
    get identityId(): Identifier;
    set identityId(value: IdentifierLike);
    inputs: PlatformAddressInput[];
    get output(): PlatformAddressOutput | undefined;
    set output(value: PlatformAddressOutput | null | undefined);
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class IdentityTopUpFromShieldedPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): IdentityTopUpFromShieldedPoolTransition;
    static fromBytes(bytes: Uint8Array): IdentityTopUpFromShieldedPoolTransition;
    static fromHex(hex: string): IdentityTopUpFromShieldedPoolTransition;
    static fromJSON(js: IdentityTopUpFromShieldedPoolTransitionJSON): IdentityTopUpFromShieldedPoolTransition;
    static fromObject(obj: IdentityTopUpFromShieldedPoolTransitionObject): IdentityTopUpFromShieldedPoolTransition;
    static fromStateTransition(st: StateTransition): IdentityTopUpFromShieldedPoolTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: IdentityTopUpFromShieldedPoolTransitionOptions);
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityTopUpFromShieldedPoolTransitionJSON;
    toObject(): IdentityTopUpFromShieldedPoolTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    readonly anchor: Uint8Array;
    readonly bindingSignature: Uint8Array;
    /**
     * The identity whose balance receives the top-up. Read-only: the identity id
     * and the gross amount are committed into the Orchard binding signature, so a
     * wrapper that changed them would produce a transition consensus must reject.
     */
    readonly identityId: Identifier;
    readonly proof: Uint8Array;
    static readonly __struct: string;
    /**
     * Gross credits leaving the pool; the identity receives this minus the flat fee.
     */
    readonly topUpAmount: bigint;
    readonly __type: string;
}

export class IdentityTopUpTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityTopUpTransitionOptions);
    static fromBase64(base64: string): IdentityTopUpTransition;
    static fromBytes(bytes: Uint8Array): IdentityTopUpTransition;
    static fromHex(hex: string): IdentityTopUpTransition;
    static fromJSON(js: IdentityTopUpTransitionJSON): IdentityTopUpTransition;
    static fromObject(obj: IdentityTopUpTransitionObject): IdentityTopUpTransition;
    static fromStateTransition(st: StateTransition): IdentityTopUpTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityTopUpTransitionJSON;
    toObject(): IdentityTopUpTransitionObject;
    toStateTransition(): StateTransition;
    assetLockProof: AssetLockProof;
    get identityIdentifier(): Identifier;
    set identityIdentifier(value: IdentifierLike);
    readonly modifiedDataIds: Identifier[];
    readonly optionalAssetLockProof: AssetLockProof | undefined;
    signature: Uint8Array;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of transferring credits from an identity to Platform addresses.
 */
export class IdentityTransferToAddressesResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Map of addresses to their updated info after the transfer.
     */
    readonly addressInfos: Map<any, any>;
    /**
     * New balance of the identity after transfer.
     */
    readonly newBalance: bigint;
}

export class IdentityUpdateTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: IdentityUpdateTransitionOptions);
    static fromBase64(base64: string): IdentityUpdateTransition;
    static fromBytes(bytes: Uint8Array): IdentityUpdateTransition;
    static fromHex(hex: string): IdentityUpdateTransition;
    static fromJSON(js: IdentityUpdateTransitionJSON): IdentityUpdateTransition;
    static fromObject(obj: IdentityUpdateTransitionObject): IdentityUpdateTransition;
    static fromStateTransition(st: StateTransition): IdentityUpdateTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): IdentityUpdateTransitionJSON;
    toObject(): IdentityUpdateTransitionObject;
    toStateTransition(): StateTransition;
    get identityIdentifier(): Identifier;
    set identityIdentifier(value: IdentifierLike);
    readonly modifiedDataIds: Identifier[];
    nonce: bigint;
    readonly optionalAssetLockProof: AssetLockProof | undefined;
    get publicKeyIdsToAdd(): IdentityPublicKeyInCreation[];
    set publicKeyIdsToAdd(value: Array<any>);
    publicKeyIdsToDisable: Uint32Array;
    readonly purposeRequirement: string[];
    revision: bigint;
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class InstantAssetLockProof {
    free(): void;
    [Symbol.dispose](): void;
    constructor(instantLock: Uint8Array, transaction: Uint8Array, outputIndex: number);
    createIdentityId(): Identifier;
    static fromJSON(js: InstantAssetLockProofJSON): InstantAssetLockProof;
    static fromObject(obj: InstantAssetLockProofObject): InstantAssetLockProof;
    toJSON(): InstantAssetLockProofJSON;
    toObject(): InstantAssetLockProofObject;
    instantLock: Uint8Array;
    readonly outPoint: OutPoint | undefined;
    readonly output: Uint8Array | undefined;
    outputIndex: number;
    static readonly __struct: string;
    readonly transaction: Uint8Array;
    readonly __type: string;
}

export class IntoUnderlyingByteSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableByteStreamController): Promise<any>;
    start(controller: ReadableByteStreamController): void;
    readonly autoAllocateChunkSize: number;
    readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    abort(reason: any): Promise<any>;
    close(): Promise<any>;
    write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableStreamDefaultController): Promise<any>;
}

export class KeyPair {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): KeyPair;
    static fromObject(obj: object): KeyPair;
    toJSON(): any;
    toObject(): any;
    address: string;
    network: string;
    privateKeyHex: string;
    privateKeyWif: string;
    publicKey: string;
}

export enum KeyType {
    ECDSA_SECP256K1 = 0,
    BLS12_381 = 1,
    ECDSA_HASH160 = 2,
    BIP13_SCRIPT_HASH = 3,
    EDDSA_25519_HASH160 = 4,
}

export class MasternodeVoteTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: MasternodeVoteTransitionOptions);
    static fromBase64(base64: string): MasternodeVoteTransition;
    static fromBytes(bytes: Uint8Array): MasternodeVoteTransition;
    static fromHex(hex: string): MasternodeVoteTransition;
    static fromJSON(js: MasternodeVoteTransitionJSON): MasternodeVoteTransition;
    static fromObject(obj: MasternodeVoteTransitionObject): MasternodeVoteTransition;
    static fromStateTransition(st: StateTransition): MasternodeVoteTransition;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): MasternodeVoteTransitionJSON;
    toObject(): MasternodeVoteTransitionObject;
    toStateTransition(): StateTransition;
    readonly assetLockProof: AssetLockProof | undefined;
    readonly modifiedDataIds: Identifier[];
    nonce: bigint;
    get proTxHash(): Identifier;
    set proTxHash(value: IdentifierLike);
    signature: Uint8Array;
    get signaturePublicKeyId(): number;
    set signaturePublicKeyId(value: any);
    userFeeIncrease: number;
    vote: Vote;
    get voterIdentityId(): Identifier;
    set voterIdentityId(value: IdentifierLike);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * The team that moderates a contract: the seated charter's leader and its active members.
 */
export class ModerationTeam {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Whether `identityId` is on the team: the leader or an active member.
     */
    contains(identityId: IdentifierLike): boolean;
    /**
     * The most members the team can hold, given the target contract's elected declaration's
     * `maxAddedModerators`: the leader, the members the charter elected (a removed one keeps
     * its seat) and the additions allowed, filled or not, as consensus counts them. A
     * `moderatorAbilities.deleteSettled` rule asking for more approvals needs every seat's, so
     * a settled deletion needs `Math.min(approvals, seats)`. An active team action's
     * `approvalCount` is an upper bound: its `signerIds` that `contains` accepts are the
     * approvals that count.
     * A `maxAddedModerators` that is not an integer from 0 to 65535 is refused.
     */
    seats(maxAddedModerators: number): number;
    /**
     * The seated `electedCharter` document.
     */
    readonly electedCharterId: Identifier;
    /**
     * The members the charter's election seated, in declared order, removed since or not: each
     * holds a seat. Compare with `members`, the team as it is now.
     */
    readonly electedMembers: Identifier[];
    /**
     * The leader, the owner of the elected charter.
     */
    readonly leaderId: Identifier;
    /**
     * The members besides the leader, in id order: the elected members and those the leader
     * added, less those the leader removed.
     */
    readonly members: Identifier[];
    /**
     * The proposal the team runs on.
     */
    readonly submittedCharterId: Identifier;
}

export enum Network {
    Mainnet = 0,
    Testnet = 1,
    Devnet = 2,
    Regtest = 3,
}

export class OutPoint {
    free(): void;
    [Symbol.dispose](): void;
    constructor(txidHex: string, vout: number);
    static fromBase64(base64: string): OutPoint;
    static fromBytes(buffer: Uint8Array): OutPoint;
    static fromHex(hex: string): OutPoint;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    static readonly __struct: string;
    readonly txid: string;
    readonly __type: string;
    readonly vout: number;
}

export class PartialIdentity {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: PartialIdentityOptions);
    static fromJSON(json: PartialIdentityJSON, platform_version: PlatformVersionLike): PartialIdentity;
    static fromObject(obj: PartialIdentityObject, platform_version: PlatformVersionLike): PartialIdentity;
    toJSON(): PartialIdentityJSON;
    toObject(): PartialIdentityObject;
    get balance(): bigint | undefined;
    set balance(value: bigint | null | undefined);
    get id(): Identifier;
    set id(value: IdentifierLike);
    get loadedPublicKeys(): object;
    set loadedPublicKeys(value: Record<number, IdentityPublicKey>);
    get notFoundPublicKeys(): Array<any>;
    set notFoundPublicKeys(value: Array<any> | null | undefined);
    get revision(): bigint | undefined;
    set revision(value: bigint | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class PathDerivedKeyInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): PathDerivedKeyInfo;
    static fromObject(obj: object): PathDerivedKeyInfo;
    toJSON(): any;
    toObject(): any;
    address: string;
    network: string;
    path: string;
    privateKeyHex: string;
    privateKeyWif: string;
    publicKey: string;
}

export class PathElement {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): PathElement;
    static fromObject(obj: object): PathElement;
    toJSON(): any;
    toObject(): any;
    get value(): string | undefined;
    set value(value: string | null | undefined);
    readonly elementType: GroveElementType | undefined;
    readonly key: Uint8Array;
    readonly path: Array<any>;
    readonly pathBytes: Uint8Array[];
    readonly referenceTarget: Uint8Array[] | undefined;
    readonly referenceTargetError: string | undefined;
    readonly sum: bigint | undefined;
    readonly valueBytes: Uint8Array | undefined;
}

export class PlatformAddress {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates a new PlatformAddress from various input types.
     *
     * Accepts:
     * - A bech32m string (e.g., "dash1..." or "tdash1...")
     * - A Uint8Array (21 bytes: type byte + 20-byte hash)
     * - An existing PlatformAddress object
     */
    constructor(address: PlatformAddressLike);
    /**
     * Creates a PlatformAddress from a bech32m-encoded string.
     *
     * Accepts addresses with either mainnet ("dash") or testnet ("tdash") HRP.
     */
    static fromBech32m(address: string): PlatformAddress;
    /**
     * Creates a PlatformAddress from raw bytes (21 bytes: type byte + 20-byte hash).
     */
    static fromBytes(bytes: Uint8Array): PlatformAddress;
    /**
     * Creates a PlatformAddress from a hex-encoded string.
     */
    static fromHex(hexString: string): PlatformAddress;
    /**
     * Creates a P2PKH address from a 20-byte public key hash.
     */
    static fromP2pkhHash(hash: Uint8Array): PlatformAddress;
    /**
     * Creates a P2SH address from a 20-byte script hash.
     */
    static fromP2shHash(hash: Uint8Array): PlatformAddress;
    /**
     * Returns the 20-byte hash portion of the address.
     */
    hash(): Uint8Array;
    /**
     * Returns the hash as a hex string.
     */
    hashToHex(): string;
    /**
     * Returns the bech32m-encoded address string for the specified network.
     */
    toBech32m(network: NetworkLike): string;
    /**
     * Returns the raw bytes of the address (21 bytes: type byte + 20-byte hash).
     */
    toBytes(): Uint8Array;
    /**
     * Returns the hex-encoded address bytes.
     */
    toHex(): string;
    /**
     * Returns the address type: "P2PKH" or "P2SH".
     */
    readonly addressType: string;
    /**
     * Returns true if this is a P2PKH address.
     */
    readonly isP2pkh: boolean;
    /**
     * Returns true if this is a P2SH address.
     */
    readonly isP2sh: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Information about a Platform address including its nonce and balance.
 */
export class PlatformAddressInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): PlatformAddressInfo;
    static fromObject(obj: object): PlatformAddressInfo;
    toJSON(): any;
    toObject(): any;
    /**
     * Returns the platform address.
     */
    readonly address: PlatformAddress;
    /**
     * Returns the balance stored for the address in credits.
     */
    readonly balance: bigint;
    /**
     * Returns the nonce associated with the address.
     */
    readonly nonce: bigint;
}

/**
 * Represents an input address for address-based state transitions.
 *
 * An input specifies a Platform address that will spend credits,
 * along with its current nonce and the amount to spend.
 */
export class PlatformAddressInput {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates a new PlatformAddressInput.
     *
     * @param address - The Platform address (PlatformAddress, Uint8Array, or bech32m string)
     * @param nonce - The current nonce of the address (will be incremented for the transaction)
     * @param amount - The amount of credits to spend from this address
     */
    constructor(address: PlatformAddressLike, nonce: number, amount: bigint);
    /**
     * Returns the Platform address.
     */
    readonly address: PlatformAddress;
    /**
     * Returns the amount.
     */
    readonly amount: bigint;
    /**
     * Returns the nonce.
     */
    readonly nonce: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Represents an output address for address-based state transitions.
 *
 * An output specifies a Platform address that will receive credits,
 * along with an optional amount to receive. When amount is None,
 * the system distributes funds automatically (used for asset lock funding).
 */
export class PlatformAddressOutput {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates a new PlatformAddressOutput with a specific amount.
     *
     * @param address - The Platform address (PlatformAddress, Uint8Array, or bech32m string)
     * @param amount - The amount of credits to send to this address (optional for asset lock funding)
     */
    constructor(address: PlatformAddressLike, amount?: bigint | null);
    /**
     * Returns the Platform address.
     */
    readonly address: PlatformAddress;
    /**
     * Returns the amount, or undefined if not specified.
     */
    readonly amount: bigint | undefined;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A signer for Platform address-based state transitions.
 *
 * This signer holds private keys for Platform addresses and can sign
 * state transitions that spend from those addresses.
 */
export class PlatformAddressSigner {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Adds a private key and derives the Platform address from it.
     *
     * The address is derived as: P2PKH(Hash160(compressed_public_key))
     *
     * @param privateKey - The PrivateKey object
     * @returns The derived Platform address
     */
    addKey(privateKey: PrivateKey): PlatformAddress;
    /**
     * Creates a new empty PlatformAddressSigner.
     */
    constructor();
    /**
     * Returns all private keys as an array of {addressHash: Uint8Array, privateKey: Uint8Array}.
     * This is used internally for cross-package access.
     */
    getPrivateKeysBytes(): Array<any>;
    /**
     * Returns true if this signer has a key for the given address.
     */
    hasKey(address: PlatformAddressLike): boolean;
    /**
     * Returns the number of keys in this signer.
     */
    readonly keyCount: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class PlatformVersion {
    free(): void;
    [Symbol.dispose](): void;
    static current(): PlatformVersion;
    static first(): PlatformVersion;
    static latest(): PlatformVersion;
    constructor(version: number);
    static readonly __struct: string;
    readonly __type: string;
    readonly version: number;
}

export enum PoolingWasm {
    Never = 0,
    IfAvailable = 1,
    Standard = 2,
}

export class PrefundedSpecializedBalance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): PrefundedSpecializedBalance;
    static fromObject(obj: object): PrefundedSpecializedBalance;
    toJSON(): any;
    toObject(): any;
    readonly balance: bigint;
    readonly identityId: Identifier;
}

export class PrefundedVotingBalance {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: PrefundedVotingBalanceOptions);
    readonly credits: bigint;
    readonly indexName: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class PrivateEncryptedNote {
    free(): void;
    [Symbol.dispose](): void;
    constructor(rootEncryptionKeyIndex: number, derivationEncryptionKeyIndex: number, value: Uint8Array);
    derivationEncryptionKeyIndex: number;
    rootEncryptionKeyIndex: number;
    value: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export class PrivateKey {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array, network: NetworkLike): PrivateKey;
    static fromHex(hexKey: string, network: NetworkLike): PrivateKey;
    static fromWIF(wif: string): PrivateKey;
    getPublicKey(): PublicKey;
    getPublicKeyHash(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toWIF(): string;
    static readonly __struct: string;
    readonly __type: string;
}

export class ProTxHash {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static readonly __struct: string;
    readonly __type: string;
}

export class ProofInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(grovedbProof: Uint8Array, quorumHash: Uint8Array, signature: Uint8Array, round: number, blockIdHash: Uint8Array, quorumType: number);
    static fromJSON(js: object): ProofInfo;
    static fromObject(obj: object): ProofInfo;
    setBlockIdHash(blockIdHash: Uint8Array): void;
    setGrovedbProof(grovedbProof: Uint8Array): void;
    setQuorumHash(quorumHash: Uint8Array): void;
    setSignature(signature: Uint8Array): void;
    toJSON(): any;
    toObject(): any;
    readonly blockIdHash: Uint8Array;
    readonly grovedbProof: Uint8Array;
    readonly quorumHash: Uint8Array;
    readonly quorumType: number;
    readonly round: number;
    readonly signature: Uint8Array;
}

export class ProofMetadataResponse {
    free(): void;
    [Symbol.dispose](): void;
    constructor(data: any, metadata: ResponseMetadata, proof: ProofInfo);
    static fromJSON(js: object): ProofMetadataResponse;
    static fromObject(obj: object): ProofMetadataResponse;
    setData(data: any): void;
    setMetadata(metadata: ResponseMetadata): void;
    setProof(proof: ProofInfo): void;
    toJSON(): any;
    toObject(): any;
    readonly data: any;
    readonly metadata: ResponseMetadata;
    readonly proof: ProofInfo;
}

export class ProtocolVersionUpgradeState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): ProtocolVersionUpgradeState;
    static fromObject(obj: object): ProtocolVersionUpgradeState;
    toJSON(): any;
    toObject(): any;
    /**
     * Protocol version the chain was running when this response was produced.
     */
    readonly currentProtocolVersion: number;
    /**
     * Candidate upgrade version: the version above the current one with the
     * most evonode votes, if any votes exist.
     */
    readonly nextProtocolVersion: number | undefined;
    /**
     * Number of evonode votes cast for `nextProtocolVersion`.
     */
    readonly voteCount: bigint | undefined;
}

export class ProtocolVersionUpgradeVoteStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly proTxHash: ProTxHash;
    readonly version: number;
}

export class PublicKey {
    free(): void;
    [Symbol.dispose](): void;
    constructor(compressed: boolean, publicKeyBytes: Uint8Array);
    static fromBytes(bytes: Uint8Array): PublicKey;
    getPublicKeyHash(): string;
    toBytes(): Uint8Array;
    compressed: boolean;
    inner: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export enum Purpose {
    AUTHENTICATION = 0,
    ENCRYPTION = 1,
    DECRYPTION = 2,
    TRANSFER = 3,
    SYSTEM = 4,
    VOTING = 5,
    OWNER = 6,
}

export class QuorumInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): QuorumInfo;
    static fromObject(obj: object): QuorumInfo;
    toJSON(): any;
    toObject(): any;
    isVerified: boolean;
    memberCount: number;
    quorumHash: string;
    quorumType: string;
    threshold: number;
}

export class RegisterDpnsNameResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): RegisterDpnsNameResult;
    static fromObject(obj: object): RegisterDpnsNameResult;
    toJSON(): any;
    toObject(): any;
    domainDocumentId: Identifier;
    fullDomainName: string;
    preorderDocumentId: Identifier;
}

export class ResourceVote {
    free(): void;
    [Symbol.dispose](): void;
    constructor(poll: VotePoll, choice: ResourceVoteChoice);
    static fromJSON(js: ResourceVoteJSON): ResourceVote;
    static fromObject(obj: ResourceVoteObject): ResourceVote;
    toJSON(): ResourceVoteJSON;
    toObject(): ResourceVoteObject;
    choice: ResourceVoteChoice;
    poll: VotePoll;
    static readonly __struct: string;
    readonly __type: string;
}

export class ResourceVoteChoice {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static Abstain(): ResourceVoteChoice;
    static Lock(): ResourceVoteChoice;
    static TowardsIdentity(id: IdentifierLike): ResourceVoteChoice;
    static fromJSON(js: ResourceVoteChoiceJSON): ResourceVoteChoice;
    static fromObject(obj: ResourceVoteChoiceObject): ResourceVoteChoice;
    toJSON(): ResourceVoteChoiceJSON;
    toObject(): ResourceVoteChoiceObject;
    static readonly __struct: string;
    readonly __type: string;
    readonly value: Identifier | undefined;
    readonly voteType: string;
}

export class ResponseMetadata {
    free(): void;
    [Symbol.dispose](): void;
    constructor(height: bigint, coreChainLockedHeight: number, epoch: number, timeMs: bigint, protocolVersion: number, chainId: Uint8Array);
    static fromJSON(js: object): ResponseMetadata;
    static fromObject(obj: object): ResponseMetadata;
    setChainId(chainId: Uint8Array): void;
    toJSON(): any;
    toObject(): any;
    readonly chainId: Uint8Array;
    readonly coreChainLockedHeight: number;
    readonly epoch: number;
    readonly height: bigint;
    readonly protocolVersion: number;
    readonly timeMs: bigint;
}

export class RewardDistributionMoment {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns the block height (only valid when type is "block")
     */
    readonly blockHeight: bigint | undefined;
    /**
     * Returns the epoch index (only valid when type is "epoch")
     */
    readonly epochIndex: number | undefined;
    /**
     * Returns the type: "block", "time", or "epoch"
     */
    readonly type: string;
    /**
     * Returns the timestamp in ms (only valid when type is "time")
     */
    readonly timestampMs: bigint | undefined;
}

export class RewardDistributionType {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static BlockBasedDistribution(interval: bigint, _function: DistributionFunction): RewardDistributionType;
    static EpochBasedDistribution(interval: number, _function: DistributionFunction): RewardDistributionType;
    static TimeBasedDistribution(interval: bigint, _function: DistributionFunction): RewardDistributionType;
    readonly distribution: RewardDistributionValue;
    static readonly __struct: string;
    readonly __type: string;
}

export enum SecurityLevel {
    MASTER = 0,
    CRITICAL = 1,
    HIGH = 2,
    MEDIUM = 3,
}

export class SeedPhraseKeyInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): SeedPhraseKeyInfo;
    static fromObject(obj: object): SeedPhraseKeyInfo;
    toJSON(): any;
    toObject(): any;
    address: string;
    network: string;
    privateKeyHex: string;
    privateKeyWif: string;
    publicKey: string;
}

/**
 * A serialized Orchard action: the on-chain representation of a spend-output pair.
 *
 * Each action consumes a previously created note (revealing its `nullifier`) while
 * creating a new note (publishing its commitment `cmx`). Privacy is preserved by
 * the zero-knowledge proof; observers cannot link spent notes to their commitments.
 */
export class SerializedOrchardAction {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: SerializedOrchardActionOptions);
    static fromJSON(js: SerializedOrchardActionJSON): SerializedOrchardAction;
    static fromObject(obj: SerializedOrchardActionObject): SerializedOrchardAction;
    toJSON(): SerializedOrchardActionJSON;
    toObject(): SerializedOrchardActionObject;
    /**
     * Returns the 32-byte note commitment for the new output note.
     */
    readonly cmx: Uint8Array;
    /**
     * Returns the 32-byte value commitment.
     */
    readonly cvNet: Uint8Array;
    /**
     * Returns the 216-byte encrypted note ciphertext.
     */
    readonly encryptedNote: Uint8Array;
    /**
     * Returns the 32-byte nullifier (note-spend tag).
     */
    readonly nullifier: Uint8Array;
    /**
     * Returns the 32-byte randomized spend validating key.
     */
    readonly rk: Uint8Array;
    /**
     * Returns the 64-byte RedPallas spend authorization signature.
     */
    readonly spendAuthSig: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export class SharedEncryptedNote {
    free(): void;
    [Symbol.dispose](): void;
    constructor(senderKeyIndex: number, recipientKeyIndex: number, value: Uint8Array);
    recipientKeyIndex: number;
    senderKeyIndex: number;
    value: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export class ShieldFromAssetLockTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): ShieldFromAssetLockTransition;
    static fromJSON(js: ShieldFromAssetLockTransitionJSON): ShieldFromAssetLockTransition;
    static fromObject(obj: ShieldFromAssetLockTransitionObject): ShieldFromAssetLockTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: ShieldFromAssetLockTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): ShieldFromAssetLockTransitionJSON;
    toObject(): ShieldFromAssetLockTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the asset lock proof.
     */
    readonly assetLockProof: AssetLockProof;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    /**
     * Returns the ECDSA signature.
     */
    readonly signature: Uint8Array;
    static readonly __struct: string;
    /**
     * Returns the optional surplus-output platform address, or
     * `undefined` when the surplus folds into the fee pools.
     */
    readonly surplusOutput: PlatformAddress | undefined;
    readonly __type: string;
    /**
     * Returns the net value balance.
     */
    readonly valueBalance: bigint;
}

export class ShieldFromIdentityTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): ShieldFromIdentityTransition;
    static fromBytes(bytes: Uint8Array): ShieldFromIdentityTransition;
    static fromHex(hex: string): ShieldFromIdentityTransition;
    static fromJSON(js: ShieldFromIdentityTransitionJSON): ShieldFromIdentityTransition;
    static fromObject(obj: ShieldFromIdentityTransitionObject): ShieldFromIdentityTransition;
    static fromStateTransition(st: StateTransition): ShieldFromIdentityTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: ShieldFromIdentityTransitionOptions);
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): ShieldFromIdentityTransitionJSON;
    toObject(): ShieldFromIdentityTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Credits leaving the identity balance and entering the pool.
     */
    readonly amount: bigint;
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The identity whose balance funds the shield.
     */
    get identityId(): Identifier;
    set identityId(value: IdentifierLike);
    nonce: bigint;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    signature: Uint8Array;
    signaturePublicKeyId: number;
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class ShieldTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): ShieldTransition;
    static fromJSON(js: ShieldTransitionJSON): ShieldTransition;
    static fromObject(obj: ShieldTransitionObject): ShieldTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: ShieldTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): ShieldTransitionJSON;
    toObject(): ShieldTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the shield amount (credits entering the pool).
     */
    readonly amount: bigint;
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the fee strategy steps.
     */
    readonly feeStrategy: FeeStrategyStep[];
    /**
     * Returns the input witnesses (signatures authorising each input).
     */
    readonly inputWitnesses: AddressWitness[];
    /**
     * Returns the input addresses funding the shield (with their nonces and amounts).
     */
    readonly inputs: PlatformAddressInput[];
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
    /**
     * Returns the user fee increase multiplier.
     */
    readonly userFeeIncrease: number;
}

export class ShieldedEncryptedNote {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): ShieldedEncryptedNote;
    static fromObject(obj: object): ShieldedEncryptedNote;
    toJSON(): any;
    toObject(): any;
    readonly cmx: Uint8Array;
    readonly cvNet: Uint8Array;
    readonly encryptedNote: Uint8Array;
    readonly nullifier: Uint8Array;
}

export class ShieldedNullifierStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): ShieldedNullifierStatus;
    static fromObject(obj: object): ShieldedNullifierStatus;
    toJSON(): any;
    toObject(): any;
    readonly isSpent: boolean;
    readonly nullifier: Uint8Array;
}

export class ShieldedTransferTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): ShieldedTransferTransition;
    static fromJSON(js: ShieldedTransferTransitionJSON): ShieldedTransferTransition;
    static fromObject(obj: ShieldedTransferTransitionObject): ShieldedTransferTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: ShieldedTransferTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): ShieldedTransferTransitionJSON;
    toObject(): ShieldedTransferTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
    /**
     * Returns the value balance (fee amount leaving the pool).
     */
    readonly valueBalance: bigint;
}

export class ShieldedWithdrawalTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): ShieldedWithdrawalTransition;
    static fromJSON(js: ShieldedWithdrawalTransitionJSON): ShieldedWithdrawalTransition;
    static fromObject(obj: ShieldedWithdrawalTransitionObject): ShieldedWithdrawalTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: ShieldedWithdrawalTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): ShieldedWithdrawalTransitionJSON;
    toObject(): ShieldedWithdrawalTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the core fee per byte.
     */
    readonly coreFeePerByte: number;
    /**
     * Returns the output script (core address).
     */
    readonly outputScript: CoreScript;
    /**
     * Returns the pooling strategy as a name string ("never" / "ifavailable" / "standard").
     * Matches the shape of `IdentityCreditWithdrawalTransition.pooling`.
     */
    readonly pooling: string;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
    /**
     * Returns the unshielding amount.
     */
    readonly unshieldingAmount: bigint;
}

export class StateTransition {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): StateTransition;
    static fromBytes(bytes: Uint8Array): StateTransition;
    static fromHex(hex: string): StateTransition;
    getKeyLevelRequirement(purpose: any): string[] | undefined;
    getSignableBytes(): Uint8Array;
    hash(skipSignature: boolean): string;
    setIdentityContractNonce(nonce: bigint): void;
    setIdentityNonce(nonce: bigint): void;
    setOwnerId(ownerId: IdentifierLike): void;
    sign(privateKey: PrivateKey, publicKey: IdentityPublicKey): Uint8Array;
    signByPrivateKey(privateKey: PrivateKey, keyId: number | null | undefined, keyType: any): Uint8Array;
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    verifyPublicKey(publicKey: IdentityPublicKey, allowSigningWithAnySecurityLevel?: boolean | null, allowSigningWithAnyPurpose?: boolean | null): void;
    readonly actionType: string;
    readonly actionTypeNumber: number;
    readonly identityContractNonce: bigint | undefined;
    readonly identityNonce: bigint | undefined;
    readonly ownerId: Identifier | undefined;
    readonly purposeRequirement: string[] | undefined;
    get signature(): Uint8Array | undefined;
    set signature(value: Uint8Array);
    get signaturePublicKeyId(): number | undefined;
    set signaturePublicKeyId(value: number);
    userFeeIncrease: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class StateTransitionResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StateTransitionResult;
    static fromObject(obj: object): StateTransitionResult;
    toJSON(): any;
    toObject(): any;
    get error(): string | undefined;
    set error(value: string | null | undefined);
    state_transition_hash: string;
    status: string;
    /**
     * The credit balance of the transition's owner after it executed, when DAPI reported it.
     */
    readonly ownerBalance: bigint | undefined;
}

export class StatusChain {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusChain;
    static fromObject(obj: object): StatusChain;
    toJSON(): any;
    toObject(): any;
    get core_chain_locked_height(): number | undefined;
    set core_chain_locked_height(value: number | null | undefined);
    earliest_app_hash: string;
    earliest_block_hash: string;
    earliest_block_height: string;
    isCatchingUp: boolean;
    latest_app_hash: string;
    latest_block_hash: string;
    latest_block_height: string;
    max_peer_block_height: string;
}

export class StatusDriveProtocol {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusDriveProtocol;
    static fromObject(obj: object): StatusDriveProtocol;
    toJSON(): any;
    toObject(): any;
    current: number;
    latest: number;
}

export class StatusNetwork {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusNetwork;
    static fromObject(obj: object): StatusNetwork;
    toJSON(): any;
    toObject(): any;
    chain_id: string;
    isListening: boolean;
    peers_count: number;
}

export class StatusNode {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusNode;
    static fromObject(obj: object): StatusNode;
    toJSON(): any;
    toObject(): any;
    readonly id: string;
    readonly proTxHash: ProTxHash | undefined;
}

export class StatusProtocol {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusProtocol;
    static fromObject(obj: object): StatusProtocol;
    toJSON(): any;
    toObject(): any;
    drive: StatusDriveProtocol;
    tenderdash: StatusTenderdashProtocol;
}

export class StatusResponse {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusResponse;
    static fromObject(obj: object): StatusResponse;
    toJSON(): any;
    toObject(): any;
    chain: StatusChain;
    network: StatusNetwork;
    node: StatusNode;
    state_sync: StatusStateSync;
    time: StatusTime;
    version: StatusVersion;
}

export class StatusSoftware {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusSoftware;
    static fromObject(obj: object): StatusSoftware;
    toJSON(): any;
    toObject(): any;
    dapi: string;
    get drive(): string | undefined;
    set drive(value: string | null | undefined);
    get tenderdash(): string | undefined;
    set tenderdash(value: string | null | undefined);
}

export class StatusStateSync {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusStateSync;
    static fromObject(obj: object): StatusStateSync;
    toJSON(): any;
    toObject(): any;
    backfill_blocks_total: string;
    backfilled_blocks: string;
    chunk_process_avg_time: string;
    remaining_time: string;
    snapshot_chunks_count: string;
    snapshot_height: string;
    total_snapshots: number;
    total_synced_time: string;
}

export class StatusTenderdashProtocol {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusTenderdashProtocol;
    static fromObject(obj: object): StatusTenderdashProtocol;
    toJSON(): any;
    toObject(): any;
    block: number;
    p2p: number;
}

export class StatusTime {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusTime;
    static fromObject(obj: object): StatusTime;
    toJSON(): any;
    toObject(): any;
    get block(): string | undefined;
    set block(value: string | null | undefined);
    get epoch(): number | undefined;
    set epoch(value: number | null | undefined);
    get genesis(): string | undefined;
    set genesis(value: string | null | undefined);
    local: string;
}

export class StatusVersion {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): StatusVersion;
    static fromObject(obj: object): StatusVersion;
    toJSON(): any;
    toObject(): any;
    protocol: StatusProtocol;
    software: StatusSoftware;
}

export class TimeBasedDistribution {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    interval: bigint;
    function: DistributionFunction;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenBaseTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenBaseTransitionOptions);
    get dataContractId(): Identifier;
    set dataContractId(value: IdentifierLike);
    identityContractNonce: bigint;
    tokenContractPosition: number;
    get tokenId(): Identifier;
    set tokenId(value: IdentifierLike);
    usingGroupInfo: GroupStateTransitionInfo | undefined;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenBurnFromPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenBurnFromPoolTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Tokens crossing the pool boundary.
     */
    amount: bigint;
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of burning tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns owner ID and remaining balance
 * - Tokens with history: returns a document
 * - Group-managed tokens: returns group power and action status
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenBurnResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenBurnResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenBurnResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    get groupActionStatus(): string | undefined;
    set groupActionStatus(value: string | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
    /**
     * For TokenBalance result
     */
    get ownerId(): Identifier | undefined;
    /**
     * For TokenBalance result
     */
    set ownerId(value: Identifier | null | undefined);
    /**
     * The remaining token balance when supplied by the proof.
     * Group burn co-signers receive `undefined`, including after the action closes.
     */
    readonly remainingBalance: bigint | undefined;
}

export class TokenBurnTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenBurnTransitionOptions);
    base: TokenBaseTransition;
    burnAmount: bigint;
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of claiming tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenClaimResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenClaimResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenClaimResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * The document
     */
    get document(): Document | undefined;
    /**
     * The document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
}

export class TokenClaimToPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenClaimToPoolTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The moment a perpetual claim pays out to, in the distribution's own unit.
     */
    readonly claimUpTo: bigint | undefined;
    readonly distributionType: string;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenClaimTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenClaimTransitionOptions);
    base: TokenBaseTransition;
    get distributionType(): string;
    set distributionType(value: TokenDistributionTypeLike | undefined);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of updating token configuration.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns a document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenConfigUpdateResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenConfigUpdateResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenConfigUpdateResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * The document
     */
    get document(): Document | undefined;
    /**
     * The document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
}

export class TokenConfigUpdateTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenConfigUpdateTransitionOptions);
    base: TokenBaseTransition;
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    updateTokenConfigurationItem: TokenConfigurationChangeItem;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenConfiguration {
    free(): void;
    [Symbol.dispose](): void;
    static calculateTokenId(contractId: IdentifierLike, tokenPos: number): Identifier;
    constructor(options: TokenConfigurationOptions);
    baseSupply: bigint;
    conventions: TokenConfigurationConvention;
    conventionsChangeRules: ChangeControlRules;
    get description(): string | undefined;
    set description(value: string | null | undefined);
    destroyFrozenFundsRules: ChangeControlRules;
    distributionRules: TokenDistributionRules;
    emergencyActionRules: ChangeControlRules;
    /**
     * The token configuration format version: 0 for a transferable token without a shielded
     * pool, 1 for one with a pool or a non-transferable token.
     */
    readonly formatVersion: number;
    freezeRules: ChangeControlRules;
    /**
     * Whether the token has its own shielded pool (format version 1 configurations only).
     */
    hasShieldedPool: boolean;
    isAllowedTransferToFrozenBalance: boolean;
    isStartedAsPaused: boolean;
    keepsHistory: TokenKeepsHistoryRules;
    get mainControlGroup(): number | undefined;
    set mainControlGroup(value: number | null | undefined);
    mainControlGroupCanBeModified: AuthorizedActionTakers;
    manualBurningRules: ChangeControlRules;
    manualMintingRules: ChangeControlRules;
    marketplaceRules: TokenMarketplaceRules;
    get maxSupply(): bigint | undefined;
    set maxSupply(value: any);
    maxSupplyChangeRules: ChangeControlRules;
    /**
     * The fewest notes the shielded pool must hold before tokens may leave it. 0 means no
     * threshold, which is also what every token without a pool reports.
     */
    get minimumPoolNotesForOutgoing(): bigint;
    /**
     * `undefined` or `null` removes the threshold. Throws for a token that has no shielded
     * pool, which has no threshold to hold.
     */
    set minimumPoolNotesForOutgoing(value: any);
    /**
     * Whether holders may move the token to another identity. Always true for format
     * version 0 configurations.
     */
    transferable: boolean;
    unfreezeRules: ChangeControlRules;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenConfigurationChangeItem {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static ConventionsAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static ConventionsControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static DestroyFrozenFundsAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static DestroyFrozenFundsItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static EmergencyActionAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static EmergencyActionItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static FreezeAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static FreezeItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MainControlGroupItem(group_contract_position?: number | null): TokenConfigurationChangeItem;
    static ManualBurningAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static ManualBurningItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static ManualMintingAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static ManualMintingItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MarketplaceTradeModeAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MarketplaceTradeModeControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MarketplaceTradeModeItem(trade_mode: TokenTradeMode): TokenConfigurationChangeItem;
    static MaxSupplyAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MaxSupplyControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MaxSupplyItem(supply?: bigint | null): TokenConfigurationChangeItem;
    static MintingAllowChoosingDestinationAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MintingAllowChoosingDestinationControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static MintingAllowChoosingDestinationItem(flag: boolean): TokenConfigurationChangeItem;
    static NewTokensDestinationIdentityAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static NewTokensDestinationIdentityControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static NewTokensDestinationIdentityItem(identity_id: IdentifierLikeOrUndefined): TokenConfigurationChangeItem;
    static PerpetualDistributionAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static PerpetualDistributionConfigurationItem(perpetual_distribution?: TokenPerpetualDistribution | null): TokenConfigurationChangeItem;
    static PerpetualDistributionControlGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static UnfreezeAdminGroupItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static UnfreezeItem(action_taker: AuthorizedActionTakers): TokenConfigurationChangeItem;
    static conventionsItem(convention: TokenConfigurationConvention): TokenConfigurationChangeItem;
    static noChangeItem(): TokenConfigurationChangeItem;
    readonly item: TokenConfigurationChangeItemValue;
    readonly itemName: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenConfigurationConvention {
    free(): void;
    [Symbol.dispose](): void;
    constructor(localizations: any, decimals: number);
    decimals: number;
    localizations: Record<string, TokenConfigurationLocalization>;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenConfigurationLocalization {
    free(): void;
    [Symbol.dispose](): void;
    constructor(shouldCapitalize: boolean, singularForm: string, pluralForm: string);
    static fromJSON(js: TokenConfigurationLocalizationJSON): TokenConfigurationLocalization;
    static fromObject(obj: TokenConfigurationLocalizationObject): TokenConfigurationLocalization;
    toJSON(): TokenConfigurationLocalizationJSON;
    toObject(): TokenConfigurationLocalizationObject;
    pluralForm: string;
    shouldCapitalize: boolean;
    singularForm: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenContractInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: TokenContractInfoJSON): TokenContractInfo;
    static fromObject(obj: TokenContractInfoObject): TokenContractInfo;
    toJSON(): TokenContractInfoJSON;
    toObject(): TokenContractInfoObject;
    readonly contractId: Identifier;
    static readonly __struct: string;
    readonly tokenContractPosition: number;
    readonly __type: string;
}

export class TokenDestroyFrozenFundsTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenDestroyFrozenFundsTransitionOptions);
    base: TokenBaseTransition;
    get frozenIdentityId(): Identifier;
    set frozenIdentityId(value: IdentifierLike);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of destroying frozen tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns historical document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenDestroyFrozenResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenDestroyFrozenResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenDestroyFrozenResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
}

/**
 * Result of a direct token purchase.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns balance
 * - Tokens with history: returns document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenDirectPurchaseResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenDirectPurchaseResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenDirectPurchaseResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For TokenBalance result
     */
    get buyerId(): Identifier | undefined;
    /**
     * For TokenBalance result
     */
    set buyerId(value: Identifier | null | undefined);
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
    /**
     * The buyer's new balance after purchase.
     */
    readonly newBalance: bigint | undefined;
}

export class TokenDirectPurchaseToPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenDirectPurchaseToPoolTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly tokenCount: bigint;
    readonly totalAgreedPrice: bigint;
    readonly __type: string;
}

export class TokenDirectPurchaseTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenDirectPurchaseTransitionOptions);
    base: TokenBaseTransition;
    tokenCount: bigint;
    totalAgreedPrice: bigint;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenDistributionRecipient {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static ContractOwner(): TokenDistributionRecipient;
    static EvonodesByParticipation(): TokenDistributionRecipient;
    static Identity(identityId: IdentifierLike): TokenDistributionRecipient;
    readonly recipientType: string;
    static readonly __struct: string;
    readonly __type: string;
    readonly value: Identifier | undefined;
}

export class TokenDistributionRules {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenDistributionRulesOptions);
    changeDirectPurchasePricingRules: ChangeControlRules;
    mintingAllowChoosingDestination: boolean;
    mintingAllowChoosingDestinationRules: ChangeControlRules;
    get newTokensDestinationIdentity(): Identifier | undefined;
    set newTokensDestinationIdentity(value: IdentifierLikeOrUndefined);
    newTokensDestinationIdentityRules: ChangeControlRules;
    get oncePerIdentityDistribution(): TokenOncePerIdentityDistribution | undefined;
    set oncePerIdentityDistribution(value: any);
    get perpetualDistribution(): TokenPerpetualDistribution | undefined;
    set perpetualDistribution(value: any);
    perpetualDistributionRules: ChangeControlRules;
    get preProgrammedDistribution(): TokenPreProgrammedDistribution | undefined;
    set preProgrammedDistribution(value: any);
    static readonly __struct: string;
    readonly __type: string;
}

export enum TokenDistributionType {
    PreProgrammed = 0,
    Perpetual = 1,
    OncePerIdentity = 2,
}

export enum TokenEmergencyAction {
    Pause = 0,
    Resume = 1,
}

/**
 * Result of an emergency action.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenEmergencyActionResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenEmergencyActionResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenEmergencyActionResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * The document
     */
    get document(): Document | undefined;
    /**
     * The document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
}

export class TokenEmergencyActionTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenEmergencyActionTransitionOptions);
    base: TokenBaseTransition;
    get emergencyAction(): string;
    set emergencyAction(value: TokenEmergencyAction);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenEvent {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: TokenEventJSON): TokenEvent;
    static fromObject(obj: TokenEventObject): TokenEvent;
    toJSON(): TokenEventJSON;
    toObject(): TokenEventObject;
    static readonly __struct: string;
    readonly __type: string;
    readonly variant: TokenEventVariant;
}

/**
 * TypeScript enum for TokenEvent variants
 */
export enum TokenEventVariant {
    Mint = 0,
    Burn = 1,
    Freeze = 2,
    Unfreeze = 3,
    DestroyFrozenFunds = 4,
    Transfer = 5,
    Claim = 6,
    EmergencyAction = 7,
    ConfigUpdate = 8,
    ChangePriceForDirectPurchase = 9,
    DirectPurchase = 10,
    Shield = 11,
    Unshield = 12,
    ShieldedTransfer = 13,
    MintToPool = 14,
    BurnFromPool = 15,
    ClaimToPool = 16,
    DirectPurchaseToPool = 17,
}

/**
 * Result of freezing tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns frozen identity ID
 * - Tokens with history: returns a document
 * - Group-managed tokens: returns group power and status
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenFreezeResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenFreezeResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenFreezeResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For IdentityInfo result
     */
    get frozenIdentityId(): Identifier | undefined;
    /**
     * For IdentityInfo result
     */
    set frozenIdentityId(value: Identifier | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
}

export class TokenFreezeTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenFreezeTransitionOptions);
    base: TokenBaseTransition;
    get frozenIdentityId(): Identifier;
    set frozenIdentityId(value: IdentifierLike);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenKeepsHistoryRules {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenKeepsHistoryRulesOptions);
    isKeepingBurningHistory: boolean;
    isKeepingDirectPricingHistory: boolean;
    isKeepingDirectPurchaseHistory: boolean;
    isKeepingFreezingHistory: boolean;
    isKeepingMintingHistory: boolean;
    isKeepingTransferHistory: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenMarketplaceRules {
    free(): void;
    [Symbol.dispose](): void;
    constructor(tradeMode: TokenTradeMode, tradeModeChangeRules: ChangeControlRules);
    tradeMode: TokenTradeMode;
    tradeModeChangeRules: ChangeControlRules;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of minting tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns recipient ID and new balance
 * - Tokens with history: returns a document
 * - Group-managed tokens: returns group power and action status
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenMintResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenMintResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenMintResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For GroupActionWithBalance - action status
     */
    get groupActionStatus(): string | undefined;
    /**
     * For GroupActionWithBalance - action status
     */
    set groupActionStatus(value: string | null | undefined);
    /**
     * For group actions - accumulated group power
     */
    get groupPower(): number | undefined;
    /**
     * For group actions - accumulated group power
     */
    set groupPower(value: number | null | undefined);
    /**
     * For TokenBalance result - recipient identity ID
     */
    get recipientId(): Identifier | undefined;
    /**
     * For TokenBalance result - recipient identity ID
     */
    set recipientId(value: Identifier | null | undefined);
    /**
     * The new token balance after minting.
     */
    readonly newBalance: bigint | undefined;
}

export class TokenMintToPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenMintToPoolTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Tokens crossing the pool boundary.
     */
    amount: bigint;
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenMintTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenMintTransitionOptions);
    getRecipientId(config: TokenConfiguration): Identifier;
    amount: bigint;
    base: TokenBaseTransition;
    get issuedToIdentityId(): Identifier | undefined;
    set issuedToIdentityId(value: IdentifierLikeOrUndefined);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A distribution every identity may claim exactly once: a fixed `amount` minted to the claimant
 * on its first claim of type `OncePerIdentity`. Bounded only by the token's max supply.
 */
export class TokenOncePerIdentityDistribution {
    free(): void;
    [Symbol.dispose](): void;
    constructor(amount: any);
    get amount(): bigint;
    set amount(value: any);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenPaymentInfo {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenPaymentInfoOptions);
    static fromJSON(js: TokenPaymentInfoJSON): TokenPaymentInfo;
    static fromObject(obj: TokenPaymentInfoObject): TokenPaymentInfo;
    toJSON(): TokenPaymentInfoJSON;
    toObject(): TokenPaymentInfoObject;
    get gasFeesPaidBy(): string;
    set gasFeesPaidBy(value: GasFeesPaidByLike);
    get maximumTokenCost(): bigint | undefined;
    set maximumTokenCost(value: bigint | null | undefined);
    get minimumTokenCost(): bigint | undefined;
    set minimumTokenCost(value: bigint | null | undefined);
    get paymentTokenContractId(): Identifier | undefined;
    set paymentTokenContractId(value: IdentifierLikeOrUndefined);
    /**
     * The spend bundle paying the token cost from the token's shielded pool, when the
     * payment is shielded (format version 1).
     */
    get shieldedPayment(): TokenShieldedPayment | undefined;
    /**
     * Sets (format version 1) or clears (format version 0) the shielded payment.
     */
    set shieldedPayment(value: TokenShieldedPayment | null | undefined);
    tokenContractPosition: number;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenPerpetualDistribution {
    free(): void;
    [Symbol.dispose](): void;
    constructor(distributionType: RewardDistributionType, recipient: TokenDistributionRecipient);
    distributionType: RewardDistributionType;
    distributionRecipient: TokenDistributionRecipient;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenPreProgrammedDistribution {
    free(): void;
    [Symbol.dispose](): void;
    constructor(distributions: PreProgrammedDistributionsMap);
    distributions: PreProgrammedDistributionsMap;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenPriceInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): TokenPriceInfo;
    static fromObject(obj: object): TokenPriceInfo;
    toJSON(): any;
    toObject(): any;
    basePrice: string;
    currentPrice: string;
    tokenId: Identifier;
}

export class TokenPricingSchedule {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static SetPrices(prices: Record<string, bigint>): TokenPricingSchedule;
    static SinglePrice(credits: bigint): TokenPricingSchedule;
    static fromJSON(js: any): TokenPricingSchedule;
    static fromObject(obj: any): TokenPricingSchedule;
    toJSON(): any;
    toObject(): any;
    readonly scheduleType: string;
    static readonly __struct: string;
    readonly __type: string;
    readonly value: bigint | Record<string, bigint>;
}

export class TokenPurchaseFromShieldedPoolTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): TokenPurchaseFromShieldedPoolTransition;
    static fromBytes(bytes: Uint8Array): TokenPurchaseFromShieldedPoolTransition;
    static fromHex(hex: string): TokenPurchaseFromShieldedPoolTransition;
    static fromJSON(js: TokenPurchaseFromShieldedPoolTransitionJSON): TokenPurchaseFromShieldedPoolTransition;
    static fromObject(obj: TokenPurchaseFromShieldedPoolTransitionObject): TokenPurchaseFromShieldedPoolTransition;
    static fromStateTransition(st: StateTransition): TokenPurchaseFromShieldedPoolTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: TokenPurchaseFromShieldedPoolTransitionOptions);
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): TokenPurchaseFromShieldedPoolTransitionJSON;
    toObject(): TokenPurchaseFromShieldedPoolTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Credits leaving the credit pool: the fee bundle's value balance.
     */
    readonly creditAmount: bigint;
    readonly dataContractId: Identifier;
    /**
     * The serialized Orchard actions of the credit pool fee bundle.
     */
    readonly feeActions: SerializedOrchardAction[];
    readonly feeAnchor: Uint8Array;
    readonly feeBindingSignature: Uint8Array;
    readonly feeProof: Uint8Array;
    static readonly __struct: string;
    /**
     * The serialized Orchard actions of the token pool bundle.
     */
    readonly tokenActions: SerializedOrchardAction[];
    readonly tokenAnchor: Uint8Array;
    readonly tokenBindingSignature: Uint8Array;
    readonly tokenContractPosition: number;
    readonly tokenCount: bigint;
    readonly tokenId: Identifier;
    readonly tokenProof: Uint8Array;
    readonly totalAgreedPrice: bigint;
    readonly __type: string;
}

export class TokenSetPriceForDirectPurchaseTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenSetPriceForDirectPurchaseTransitionOptions);
    base: TokenBaseTransition;
    get price(): TokenPricingSchedule | undefined;
    set price(value: TokenPricingSchedule | null | undefined);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of setting the token price.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns pricing schedule and owner ID
 * - Tokens with history: returns document
 * - Group-managed tokens: returns group power and status
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenSetPriceResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenSetPriceResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenSetPriceResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * Group action status
     */
    get groupActionStatus(): string | undefined;
    /**
     * Group action status
     */
    set groupActionStatus(value: string | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
    /**
     * For PricingSchedule - the identity that set the price
     */
    get ownerId(): Identifier | undefined;
    /**
     * For PricingSchedule - the identity that set the price
     */
    set ownerId(value: Identifier | null | undefined);
    /**
     * For PricingSchedule or GroupActionWithPricingSchedule - the pricing schedule
     */
    get pricingSchedule(): TokenPricingSchedule | undefined;
    /**
     * For PricingSchedule or GroupActionWithPricingSchedule - the pricing schedule
     */
    set pricingSchedule(value: TokenPricingSchedule | null | undefined);
}

export class TokenShieldTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenShieldTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Tokens crossing the pool boundary.
     */
    amount: bigint;
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A spend bundle in a token's shielded pool paying a document action's token cost.
 */
export class TokenShieldedPayment {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenShieldedPaymentOptions);
    static fromJSON(js: TokenShieldedPaymentJSON): TokenShieldedPayment;
    static fromObject(obj: TokenShieldedPaymentObject): TokenShieldedPayment;
    toJSON(): TokenShieldedPaymentJSON;
    toObject(): TokenShieldedPaymentObject;
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * The tokens the bundle pays (its value balance): the document action's token cost.
     */
    amount: bigint;
    /**
     * The 32-byte Orchard anchor the bundle was built against.
     */
    readonly anchor: Uint8Array;
    /**
     * The 64-byte RedPallas binding signature.
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenShieldedTransferTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenShieldedTransferTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenShieldedTransferWithShieldedFeeTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): TokenShieldedTransferWithShieldedFeeTransition;
    static fromBytes(bytes: Uint8Array): TokenShieldedTransferWithShieldedFeeTransition;
    static fromHex(hex: string): TokenShieldedTransferWithShieldedFeeTransition;
    static fromJSON(js: TokenShieldedTransferWithShieldedFeeTransitionJSON): TokenShieldedTransferWithShieldedFeeTransition;
    static fromObject(obj: TokenShieldedTransferWithShieldedFeeTransitionObject): TokenShieldedTransferWithShieldedFeeTransition;
    static fromStateTransition(st: StateTransition): TokenShieldedTransferWithShieldedFeeTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: TokenShieldedTransferWithShieldedFeeTransitionOptions);
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): TokenShieldedTransferWithShieldedFeeTransitionJSON;
    toObject(): TokenShieldedTransferWithShieldedFeeTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Credits leaving the credit pool: the fee bundle's value balance.
     */
    readonly creditAmount: bigint;
    readonly dataContractId: Identifier;
    /**
     * The serialized Orchard actions of the credit pool fee bundle.
     */
    readonly feeActions: SerializedOrchardAction[];
    readonly feeAnchor: Uint8Array;
    readonly feeBindingSignature: Uint8Array;
    readonly feeProof: Uint8Array;
    static readonly __struct: string;
    /**
     * The serialized Orchard actions of the token pool bundle.
     */
    readonly tokenActions: SerializedOrchardAction[];
    readonly tokenAnchor: Uint8Array;
    readonly tokenBindingSignature: Uint8Array;
    readonly tokenContractPosition: number;
    readonly tokenId: Identifier;
    readonly tokenProof: Uint8Array;
    readonly __type: string;
}

export class TokenStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly isPaused: boolean;
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenTotalSupply {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object): TokenTotalSupply;
    static fromObject(obj: object): TokenTotalSupply;
    toJSON(): any;
    toObject(): any;
    readonly totalSupply: bigint;
}

export class TokenTradeMode {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static NotTradeable(): TokenTradeMode;
    static readonly __struct: string;
    readonly __type: string;
    readonly value: string;
}

/**
 * Result of transferring tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns identities balances
 * - Tokens with history: returns a document
 * - Group-managed tokens: returns group power and document
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenTransferResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenTransferResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenTransferResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
    /**
     * The recipient's new balance after transfer.
     */
    readonly recipientBalance: bigint | undefined;
    /**
     * The sender's new balance after transfer.
     */
    readonly senderBalance: bigint | undefined;
}

export class TokenTransferTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenTransferTransitionOptions);
    amount: bigint;
    base: TokenBaseTransition;
    get privateEncryptedNote(): PrivateEncryptedNote | undefined;
    set privateEncryptedNote(value: any);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    get recipientId(): Identifier;
    set recipientId(value: IdentifierLike);
    get sharedEncryptedNote(): SharedEncryptedNote | undefined;
    set sharedEncryptedNote(value: any);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(transition: TokenTransitionLike);
    getHistoricalDocumentId(owner: IdentifierLike): Identifier;
    get contractId(): Identifier;
    set contractId(value: IdentifierLike);
    readonly historicalDocumentTypeName: string;
    identityContractNonce: bigint;
    get tokenId(): Identifier;
    set tokenId(value: IdentifierLike);
    static readonly __struct: string;
    readonly transition: TokenTransitionLike;
    readonly transitionType: string;
    readonly transitionTypeNumber: number;
    readonly __type: string;
}

export class TokenUnFreezeTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenUnFreezeTransitionOptions);
    base: TokenBaseTransition;
    get frozenIdentityId(): Identifier;
    set frozenIdentityId(value: IdentifierLike);
    get publicNote(): string | undefined;
    set publicNote(value: string | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Result of unfreezing tokens.
 *
 * The result type depends on token configuration:
 * - Standard tokens: returns unfrozen identity ID
 * - Tokens with history: returns a document
 * - Group-managed tokens: returns group power and status
 *
 * Check which optional fields are present to determine the result type.
 */
export class TokenUnfreezeResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: object, platform_version: PlatformVersionLike): TokenUnfreezeResult;
    static fromObject(obj: object, platform_version: PlatformVersionLike): TokenUnfreezeResult;
    toJSON(platform_version: PlatformVersionLike): any;
    toObject(): any;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    get document(): Document | undefined;
    /**
     * For HistoricalDocument or GroupActionWithDocument - the document
     */
    set document(value: Document | null | undefined);
    /**
     * For group actions
     */
    get groupPower(): number | undefined;
    /**
     * For group actions
     */
    set groupPower(value: number | null | undefined);
    /**
     * For IdentityInfo result
     */
    get unfrozenIdentityId(): Identifier | undefined;
    /**
     * For IdentityInfo result
     */
    set unfrozenIdentityId(value: Identifier | null | undefined);
}

export class TokenUnshieldTransition {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: TokenUnshieldTransitionOptions);
    /**
     * The serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Tokens crossing the pool boundary.
     */
    amount: bigint;
    /**
     * The Orchard anchor (32-byte note commitment tree root) the bundle was built against.
     */
    readonly anchor: Uint8Array;
    base: TokenBaseTransition;
    /**
     * The RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * The Halo 2 proof bytes.
     */
    readonly proof: Uint8Array;
    /**
     * Identity credited with the unshielded tokens.
     */
    get recipientId(): Identifier;
    set recipientId(value: IdentifierLike);
    static readonly __struct: string;
    readonly __type: string;
}

export class TokenUnshieldWithShieldedFeeTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBase64(base64: string): TokenUnshieldWithShieldedFeeTransition;
    static fromBytes(bytes: Uint8Array): TokenUnshieldWithShieldedFeeTransition;
    static fromHex(hex: string): TokenUnshieldWithShieldedFeeTransition;
    static fromJSON(js: TokenUnshieldWithShieldedFeeTransitionJSON): TokenUnshieldWithShieldedFeeTransition;
    static fromObject(obj: TokenUnshieldWithShieldedFeeTransitionObject): TokenUnshieldWithShieldedFeeTransition;
    static fromStateTransition(st: StateTransition): TokenUnshieldWithShieldedFeeTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: TokenUnshieldWithShieldedFeeTransitionOptions);
    toBase64(): string;
    toBytes(): Uint8Array;
    toHex(): string;
    toJSON(): TokenUnshieldWithShieldedFeeTransitionJSON;
    toObject(): TokenUnshieldWithShieldedFeeTransitionObject;
    toStateTransition(): StateTransition;
    readonly amount: bigint;
    /**
     * Credits leaving the credit pool: the fee bundle's value balance.
     */
    readonly creditAmount: bigint;
    readonly dataContractId: Identifier;
    /**
     * The serialized Orchard actions of the credit pool fee bundle.
     */
    readonly feeActions: SerializedOrchardAction[];
    readonly feeAnchor: Uint8Array;
    readonly feeBindingSignature: Uint8Array;
    readonly feeProof: Uint8Array;
    readonly recipientId: Identifier;
    static readonly __struct: string;
    /**
     * The serialized Orchard actions of the token pool bundle.
     */
    readonly tokenActions: SerializedOrchardAction[];
    readonly tokenAnchor: Uint8Array;
    readonly tokenBindingSignature: Uint8Array;
    readonly tokenContractPosition: number;
    readonly tokenId: Identifier;
    readonly tokenProof: Uint8Array;
    readonly __type: string;
}

export class UnshieldTransition {
    free(): void;
    [Symbol.dispose](): void;
    static fromBytes(bytes: Uint8Array): UnshieldTransition;
    static fromJSON(js: UnshieldTransitionJSON): UnshieldTransition;
    static fromObject(obj: UnshieldTransitionObject): UnshieldTransition;
    getModifiedDataIds(): Identifier[];
    constructor(options: UnshieldTransitionOptions);
    toBytes(): Uint8Array;
    toJSON(): UnshieldTransitionJSON;
    toObject(): UnshieldTransitionObject;
    toStateTransition(): StateTransition;
    /**
     * Returns the serialized Orchard actions.
     */
    readonly actions: SerializedOrchardAction[];
    /**
     * Returns the anchor (32-byte Merkle root).
     */
    readonly anchor: Uint8Array;
    /**
     * Returns the RedPallas binding signature (64 bytes).
     */
    readonly bindingSignature: Uint8Array;
    /**
     * Returns the output address receiving the unshielded funds.
     */
    readonly outputAddress: PlatformAddress;
    /**
     * Returns the Halo2 proof bytes.
     */
    readonly proof: Uint8Array;
    static readonly __struct: string;
    readonly __type: string;
    /**
     * Returns the unshielding amount.
     */
    readonly unshieldingAmount: bigint;
}

export class VerifiedAddressInfos {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedAddressInfos;
    static fromObject(value: any): VerifiedAddressInfos;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation (otherwise
     * `JSON.stringify({addressInfos: <Map>})` produces `{"addressInfos":{}}`).
     */
    toJSON(): any;
    toObject(): any;
    readonly addressInfos: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedAssetLockConsumed {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedAssetLockConsumed;
    static fromObject(obj: any): VerifiedAssetLockConsumed;
    toJSON(): any;
    toObject(): any;
    status: string;
    readonly initialCreditValue: any;
    readonly remainingCreditValue: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedAssetLockConsumedWithAddressInfos {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedAssetLockConsumedWithAddressInfos;
    static fromObject(value: any): VerifiedAssetLockConsumedWithAddressInfos;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    readonly addressInfos: Map<any, any>;
    readonly initialCreditValue: any;
    readonly remainingCreditValue: any;
    readonly status: string;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedBalanceTransfer {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedBalanceTransfer;
    static fromObject(obj: any): VerifiedBalanceTransfer;
    toJSON(): any;
    toObject(): any;
    recipient: PartialIdentity;
    sender: PartialIdentity;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * `VerifiedContractDocumentRemoval` proof-result wrapper: the record a moderator's document
 * deletion left under the contract, as a deletion or a restore leaves it. After a deletion
 * the document is gone and the record says whose it was, who removed it, why, when and what
 * it was (its hash), with the values of the fields its type keeps public; after a restore the
 * document is live again and the record also says who brought it back and when.
 */
export class VerifiedContractDocumentRemoval {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The values the record keeps of the document, read under `dataContract`'s document type:
     * each path the type lists under `moderatorAbilities.deleteKeepsFields` to its value, as
     * the document's `properties` show them, a path the document held no value at absent.
     * What of it stays public once it is gone
     */
    keptFields(data_contract: DataContract): Record<string, unknown>;
    toJSON(): any;
    toObject(): any;
    contractId: Identifier;
    documentId: Identifier;
    /**
     * The identity that owned the document when it was removed
     */
    documentOwnerId: Identifier;
    documentTypeName: string;
    /**
     * The contract owner or moderator that removed it
     */
    moderatorId: Identifier;
    /**
     * The time of the block that removed it, in milliseconds
     */
    removedAt: bigint;
    /**
     * The time of the block that restored it, in milliseconds, undefined while the removal
     * stands
     */
    get restoredAt(): bigint | undefined;
    /**
     * The time of the block that restored it, in milliseconds, undefined while the removal
     * stands
     */
    set restoredAt(value: bigint | null | undefined);
    /**
     * The contract owner or moderator that restored the document, undefined while the
     * removal stands
     */
    get restoredBy(): Identifier | undefined;
    /**
     * The contract owner or moderator that restored the document, undefined while the
     * removal stands
     */
    set restoredBy(value: Identifier | null | undefined);
    /**
     * A double SHA-256 of the document as it was serialized under its type when it was
     * removed: what a restore must bring back byte for byte, as 64 hex characters
     */
    readonly documentHash: string;
    /**
     * The values the record keeps of the document, as it stores them: encoded as the
     * document encoded its properties, so read under the contract's document type, as the
     * document is (see `keptFields`). Empty when the type keeps none
     */
    readonly keptFieldsBytes: Uint8Array;
    /**
     * Why the moderator removed the document: the text may be empty
     */
    readonly reason: ContractModerationReason;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * `VerifiedContractFeeClaim` proof-result wrapper: the pot a contract fee claim paid out (the
 * contract, the pot, its last claim, the credits left in it) and the balance of every identity
 * the claim paid, after the claim. A pot is paid out at most once per epoch, so while
 * `lastClaimEpoch` is the epoch of the claim the proof is of that claim, and `lastClaimantId`
 * and `lastClaimTimeMs` are its own.
 */
export class VerifiedContractFeeClaim {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns a `JSON.stringify`-friendly form: the `balances` `Map` is normalised to a plain
     * object so its entries survive serialisation (otherwise `JSON.stringify({balances: <Map>})`
     * produces `{"balances":{}}`).
     */
    toJSON(): any;
    toObject(): any;
    contractId: Identifier;
    /**
     * The epoch the pot was last claimed in: this claim's own, unless the pot was claimed
     * again since
     */
    lastClaimEpoch: number;
    /**
     * The identity that signed the last claim of the pot
     */
    lastClaimantId: Identifier;
    /**
     * The pot that was paid out: `owner` or `moderators`
     */
    pot: string;
    /**
     * The balance of every identity the claim paid, after the claim
     */
    readonly balances: Map<any, any>;
    /**
     * The time, in milliseconds, of the block the pot was last paid out in
     */
    readonly lastClaimTimeMs: any;
    /**
     * The credits left in the pot after the claim
     */
    readonly remainingCredits: any;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * `VerifiedContractModerationListStatuses` proof-result wrapper: the target identity's status
 * on the lists a moderation transition touched (every barring list for a ban, the edited one
 * otherwise). A list the proof does not cover is unknown: `banned` is undefined unless
 * `lists` includes `banlist`, and `warnings` unless it includes `warnings`.
 */
export class VerifiedContractModerationListStatuses {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    toJSON(): any;
    toObject(): any;
    /**
     * When `lists` includes `banlist`: the identity is on the banlist
     */
    get banned(): boolean | undefined;
    /**
     * When `lists` includes `banlist`: the identity is on the banlist
     */
    set banned(value: boolean | null | undefined);
    contractId: Identifier;
    identityId: Identifier;
    /**
     * The lists the proof covers: `banlist` and `suspensions` for a ban, else the one edited
     */
    lists: string[];
    /**
     * When `lists` includes `suspensions`: the block time, in milliseconds, until which the
     * identity is suspended
     */
    get suspendedUntil(): bigint | undefined;
    /**
     * When `lists` includes `suspensions`: the block time, in milliseconds, until which the
     * identity is suspended
     */
    set suspendedUntil(value: bigint | null | undefined);
    /**
     * When the identity is banned: why
     */
    readonly banReason: ContractModerationReason | undefined;
    static readonly __struct: string;
    /**
     * When the identity is suspended: why
     */
    readonly suspensionReason: ContractModerationReason | undefined;
    readonly __type: string;
    /**
     * When `lists` includes `warnings`: the identity's warnings, oldest first
     */
    readonly warnings: ContractWarning[] | undefined;
}

/**
 * `VerifiedContractTeamActionSignature` proof-result wrapper: a team action of an elected
 * contract's seated moderation team, as the proof of one member's proposal or approval of it
 * shows it. The proof finds the signer's approval under the action, whose id the verifier
 * rebuilds from the transition: for the proposal of a settled document's deletion, the id
 * computed from its contract, signer, nonce, document and reason, which the other members
 * approve; for an approval, the id it carries. `status` is `'active'` while the approvals fall
 * short of the rule, and `'closed'` once they met it and the action ran, by this approval or a
 * later one: the document is deleted.
 */
export class VerifiedContractTeamActionSignature {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    toJSON(): any;
    toObject(): any;
    /**
     * The team action proposed or approved
     */
    actionId: Identifier;
    contractId: Identifier;
    /**
     * `'active'` while the approvals fall short of the rule, `'closed'` once they met it and
     * the action ran
     */
    readonly status: 'active' | 'closed';
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedDataContract {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any, platformVersion: PlatformVersionLike): VerifiedDataContract;
    static fromObject(value: any, platformVersion: PlatformVersionLike): VerifiedDataContract;
    toJSON(platformVersion: PlatformVersionLike): any;
    toObject(platformVersion: PlatformVersionLike): any;
    dataContract: DataContract;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedDocuments {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedDocuments;
    static fromObject(value: any): VerifiedDocuments;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation (otherwise
     * `JSON.stringify({documents: <Map>})` produces `{"documents":{}}`).
     */
    toJSON(): any;
    toObject(): any;
    readonly documents: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedIdentity {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedIdentity;
    static fromObject(obj: any): VerifiedIdentity;
    toJSON(): any;
    toObject(): any;
    identity: Identity;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedIdentityFullWithAddressInfos {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedIdentityFullWithAddressInfos;
    static fromObject(value: any): VerifiedIdentityFullWithAddressInfos;
    /**
     * Returns a `JSON.stringify`-friendly form: the embedded `Map` is
     * normalised to a plain object so its entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    identity: Identity;
    readonly addressInfos: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedIdentityWithAddressInfos {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedIdentityWithAddressInfos;
    static fromObject(value: any): VerifiedIdentityWithAddressInfos;
    /**
     * Returns a `JSON.stringify`-friendly form: the embedded `Map` is
     * normalised to a plain object so its entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    partialIdentity: PartialIdentity;
    readonly addressInfos: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * Returned by `IdentityCreateFromShieldedPool`: the newly-created identity plus the presence of
 * each spent funding nullifier, proven together in a single STRICT merged GroveDB proof.
 */
export class VerifiedIdentityWithShieldedNullifiers {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedIdentityWithShieldedNullifiers;
    static fromObject(value: any): VerifiedIdentityWithShieldedNullifiers;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a plain object so its
     * entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    identity: Identity;
    readonly nullifiers: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedMasternodeVote {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedMasternodeVote;
    static fromObject(obj: any): VerifiedMasternodeVote;
    toJSON(): any;
    toObject(): any;
    vote: Vote;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedNextDistribution {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedNextDistribution;
    static fromObject(obj: any): VerifiedNextDistribution;
    toJSON(): any;
    toObject(): any;
    vote: Vote;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedPartialIdentity {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedPartialIdentity;
    static fromObject(obj: any): VerifiedPartialIdentity;
    toJSON(): any;
    toObject(): any;
    partialIdentity: PartialIdentity;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedShieldedNullifiers {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedShieldedNullifiers;
    static fromObject(value: any): VerifiedShieldedNullifiers;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation (otherwise
     * `JSON.stringify({nullifiers: <Map>})` produces `{"nullifiers":{}}`).
     */
    toJSON(): any;
    toObject(): any;
    readonly nullifiers: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedShieldedNullifiersWithAddressInfos {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedShieldedNullifiersWithAddressInfos;
    static fromObject(value: any): VerifiedShieldedNullifiersWithAddressInfos;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` instances are
     * normalised to plain objects so their entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    readonly addressInfos: Map<any, any>;
    readonly nullifiers: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedShieldedNullifiersWithWithdrawalDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedShieldedNullifiersWithWithdrawalDocument;
    static fromObject(value: any): VerifiedShieldedNullifiersWithWithdrawalDocument;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` instances are
     * normalised to plain objects so their entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    readonly documents: Map<any, any>;
    readonly nullifiers: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedShieldedPoolState {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedShieldedPoolState;
    static fromObject(obj: any): VerifiedShieldedPoolState;
    toJSON(): any;
    toObject(): any;
    readonly poolBalance: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenActionWithDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenActionWithDocument;
    static fromObject(obj: any): VerifiedTokenActionWithDocument;
    toJSON(): any;
    toObject(): any;
    document: Document;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenBalance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenBalance;
    static fromObject(obj: any): VerifiedTokenBalance;
    toJSON(): any;
    toObject(): any;
    tokenId: Identifier;
    readonly balance: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenBalanceAbsence {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenBalanceAbsence;
    static fromObject(obj: any): VerifiedTokenBalanceAbsence;
    toJSON(): any;
    toObject(): any;
    tokenId: Identifier;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenGroupActionWithDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenGroupActionWithDocument;
    static fromObject(obj: any): VerifiedTokenGroupActionWithDocument;
    toJSON(): any;
    toObject(): any;
    get document(): Document | undefined;
    set document(value: Document | null | undefined);
    groupPower: number;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A burn out of a token's shielded pool submitted as a group action: the signer's recorded
 * power, the action's status, and the spend status of every nullifier the burn names. The burn
 * runs only once the last required signature arrives, so while the action is active every
 * nullifier reads unspent.
 */
export class VerifiedTokenGroupActionWithShieldedNullifiers {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedTokenGroupActionWithShieldedNullifiers;
    static fromObject(value: any): VerifiedTokenGroupActionWithShieldedNullifiers;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation.
     */
    toJSON(): any;
    toObject(): any;
    readonly actionStatus: string;
    readonly groupPower: number;
    readonly nullifiers: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * A mint into a token's shielded pool submitted as a group action: the signer's recorded power,
 * the action's status, and the pool's total balance. The mint runs only once the last required
 * signature arrives, so an active action's balance is the one the pool already held, and is
 * absent for a pool that has never held a note.
 */
export class VerifiedTokenGroupActionWithShieldedPoolBalance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenGroupActionWithShieldedPoolBalance;
    static fromObject(obj: any): VerifiedTokenGroupActionWithShieldedPoolBalance;
    toJSON(): any;
    toObject(): any;
    actionStatus: string;
    groupPower: number;
    readonly balance: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenGroupActionWithTokenBalance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenGroupActionWithTokenBalance;
    static fromObject(obj: any): VerifiedTokenGroupActionWithTokenBalance;
    toJSON(): any;
    toObject(): any;
    actionStatus: string;
    groupPower: number;
    readonly balance: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenGroupActionWithTokenIdentityInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenGroupActionWithTokenIdentityInfo;
    static fromObject(obj: any): VerifiedTokenGroupActionWithTokenIdentityInfo;
    toJSON(): any;
    toObject(): any;
    actionStatus: string;
    groupPower: number;
    get tokenInfo(): IdentityTokenInfo | undefined;
    set tokenInfo(value: IdentityTokenInfo | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenGroupActionWithTokenPricingSchedule {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenGroupActionWithTokenPricingSchedule;
    static fromObject(obj: any): VerifiedTokenGroupActionWithTokenPricingSchedule;
    toJSON(): any;
    toObject(): any;
    actionStatus: string;
    groupPower: number;
    get pricingSchedule(): TokenPricingSchedule | undefined;
    set pricingSchedule(value: TokenPricingSchedule | null | undefined);
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenIdentitiesBalances {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(value: any): VerifiedTokenIdentitiesBalances;
    static fromObject(value: any): VerifiedTokenIdentitiesBalances;
    /**
     * Returns a `JSON.stringify`-friendly form: the `Map` is normalised to a
     * plain object so its entries survive serialisation (otherwise
     * `JSON.stringify({balances: <Map>})` produces `{"balances":{}}`).
     */
    toJSON(): any;
    toObject(): any;
    readonly balances: Map<any, any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenIdentityInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenIdentityInfo;
    static fromObject(obj: any): VerifiedTokenIdentityInfo;
    toJSON(): any;
    toObject(): any;
    tokenId: Identifier;
    tokenInfo: IdentityTokenInfo;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenPricingSchedule {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenPricingSchedule;
    static fromObject(obj: any): VerifiedTokenPricingSchedule;
    toJSON(): any;
    toObject(): any;
    get pricingSchedule(): TokenPricingSchedule | undefined;
    set pricingSchedule(value: TokenPricingSchedule | null | undefined);
    tokenId: Identifier;
    static readonly __struct: string;
    readonly __type: string;
}

/**
 * The proven total balance of a token's shielded pool, returned by the pool transitions that
 * only create notes (mint, claim and purchase into the pool).
 */
export class VerifiedTokenShieldedPoolBalance {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenShieldedPoolBalance;
    static fromObject(obj: any): VerifiedTokenShieldedPoolBalance;
    toJSON(): any;
    toObject(): any;
    tokenId: Identifier;
    readonly balance: any;
    static readonly __struct: string;
    readonly __type: string;
}

export class VerifiedTokenStatus {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static fromJSON(js: any): VerifiedTokenStatus;
    static fromObject(obj: any): VerifiedTokenStatus;
    toJSON(): any;
    toObject(): any;
    tokenStatus: TokenStatus;
    static readonly __struct: string;
    readonly __type: string;
}

export class Vote {
    free(): void;
    [Symbol.dispose](): void;
    constructor(votePoll: VotePoll, resourceVoteChoice: ResourceVoteChoice);
    static fromJSON(js: VoteJSON): Vote;
    static fromObject(obj: VoteObject): Vote;
    toJSON(): VoteJSON;
    toObject(): VoteObject;
    choice: ResourceVoteChoice;
    poll: VotePoll;
    static readonly __struct: string;
    readonly __type: string;
}

export class VotePoll {
    free(): void;
    [Symbol.dispose](): void;
    constructor(options: VotePollOptions);
    static fromJSON(js: VotePollJSON): VotePoll;
    static fromObject(obj: VotePollObject): VotePoll;
    toJSON(): VotePollJSON;
    toObject(): VotePollObject;
    toString(): string;
    get contractId(): Identifier;
    set contractId(value: IdentifierLike);
    documentTypeName: string;
    indexName: string;
    indexValues: Array<any>;
    static readonly __struct: string;
    readonly __type: string;
}

export class VotePollsByEndDateEntry {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly timestampMs: bigint;
    readonly votePolls: Array<any>;
}

export enum VoteStateResultType {
    Documents = 0,
    VoteTally = 1,
    DocumentsAndVoteTally = 2,
}

export class WasmContext {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

/**
 * Structured error returned by wasm-dpp2 APIs.
 */
export class WasmDppError {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Optional numeric code. `-1` means absent.
     */
    readonly code: number;
    /**
     * Returns the structured error kind.
     */
    readonly kind: WasmDppErrorKind;
    /**
     * Human-readable error message.
     */
    readonly message: string;
    /**
     * Backwards-compatible string representation of the kind.
     */
    readonly name: string;
}

/**
 * Structured error returned by wasm-dpp2 APIs.
 */
export enum WasmDppErrorKind {
    /**
     * Error raised by Dash Platform Protocol.
     */
    Protocol = 0,
    /**
     * Invalid argument provided by the caller.
     */
    InvalidArgument = 1,
    /**
     * Serialization or deserialization failure.
     */
    Serialization = 2,
    /**
     * Type conversion failure.
     */
    Conversion = 3,
    /**
     * Catch-all for other failure modes.
     */
    Generic = 4,
}

export class WasmSdk {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Seed the contract cache with a contract the caller already holds: a
     * snapshot bundled with the app, or one it just published. Queries against
     * it then need no contract fetch, and it is persisted like a fetched one.
     * Pair with `getDataContractsLatestVersions` (off the critical path) to
     * learn whether the held contract is still the network's current version.
     *
     * Returns false when the SDK has no trusted context to cache into.
     */
    addKnownContract(contract: DataContract): boolean;
    /**
     * Fund Platform addresses from an asset lock.
     *
     * This method handles the complete funding flow:
     * 1. Validates the asset lock proof
     * 2. Builds and signs the address funding transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Funding options including asset lock, outputs, and signer
     * @returns Promise resolving to Map of PlatformAddress to PlatformAddressInfo
     */
    addressFundingFromAssetLock(options: AddressFundingFromAssetLockOptions): Promise<Map<string, PlatformAddressInfo>>;
    /**
     * Transfers credits between Platform addresses.
     *
     * This method handles the complete transfer flow:
     * 1. Fetches current nonces for all input addresses
     * 2. Builds and signs the transfer transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Transfer options including inputs, outputs, and private keys
     * @returns Promise resolving to Map of PlatformAddress to PlatformAddressInfo
     */
    addressFundsTransfer(options: AddressFundsTransferOptions): Promise<Map<string, PlatformAddressInfo>>;
    /**
     * Withdraws Platform address credits to Core (L1).
     *
     * This method handles the complete withdrawal flow:
     * 1. Fetches current nonces for all input addresses
     * 2. Builds and signs the withdrawal transition
     * 3. Broadcasts and waits for confirmation
     * 4. The withdrawal may be pooled with others depending on the pooling strategy
     *
     * @param options - Withdrawal options including inputs, output script, and private keys
     * @returns Promise resolving to Map of PlatformAddress to PlatformAddressInfo
     */
    addressFundsWithdraw(options: AddressFundsWithdrawOptions): Promise<Map<string, PlatformAddressInfo>>;
    /**
     * Broadcasts a state transition and waits for the result.
     *
     * This method prepares proof context before broadcasting, then waits for
     * proof that this specific transition executed. `ExecutionNotProved` means
     * the accepted broadcast was followed by an authenticated affected-state
     * snapshot; it establishes neither execution nor failure of this transition.
     * To wait for an authenticated snapshot, call `waitForAffectedState` on
     * the submitted transition without broadcasting it again; the new wait
     * may observe a later block.
     *
     * @param stateTransition - The state transition to broadcast
     * @param settings - Optional put settings (retries, timeout, waitTimeoutMs)
     * @returns The execution-proved state transition result
     */
    broadcastAndWait(stateTransition: StateTransition, settings?: PutSettings | null): Promise<StateTransitionProofResultType>;
    /**
     * Broadcasts a state transition and waits for the result, accepting
     * proofs that only authenticate the affected state (see
     * `waitForAffectedState` for the semantics).
     *
     * @param stateTransition - The state transition to broadcast
     * @param settings - Optional put settings (retries, timeout, waitTimeoutMs)
     * @returns The verified affected-state result
     */
    broadcastAndWaitForAffectedState(stateTransition: StateTransition, settings?: PutSettings | null): Promise<StateTransitionProofResultType>;
    /**
     * Broadcasts a state transition to the network.
     *
     * This method only broadcasts but does not wait for the result.
     * Use `waitForResponse` to wait for confirmation after broadcasting,
     * or use `broadcastAndWait` to do both in one call.
     *
     * @param stateTransition - The state transition to broadcast
     * @param settings - Optional put settings (retries, timeout)
     */
    broadcastStateTransition(stateTransition: StateTransition, settings?: PutSettings | null): Promise<void>;
    /**
     * Builds a join request: the message encrypted to the proposal leader's decryption key
     * bound to `submittedCharter`, from the writer's encryption key bound to `joinRequest`,
     * with `recipientId`, `recipientKeyId` and `senderKeyId` set to match. Fetches the
     * proposal and the leader.
     *
     * @returns The document, with its entropy set, to pass to `documentCreate`.
     */
    buildModerationJoinRequest(options: ModerationJoinRequestOptions): Promise<Document>;
    /**
     * Builds a resignation request from a seated charter, encrypted to its leader as a join
     * request is. Fetches the charter and the leader.
     *
     * @returns The document, with its entropy set, to pass to `documentCreate`.
     */
    buildModerationResignationRequest(options: ModerationResignationRequestOptions): Promise<Document>;
    /**
     * Calculate token ID from contract ID and token position
     *
     * This function calculates the unique token ID based on a data contract ID
     * and the position of the token within that contract.
     *
     * # Arguments
     * * `contract_id` - The data contract ID in base58 format
     * * `token_position` - The position of the token in the contract (0-indexed)
     *
     * # Returns
     * The calculated token ID in base58 format
     *
     * # Example
     * ```javascript
     * const tokenId = await sdk.calculateTokenId("Hqyu8WcRwXCTwbNxdga4CN5gsVEGc67wng4TFzceyLUv", 0);
     * ```
     */
    static calculateTokenIdFromContract(contractId: IdentifierLike, tokenPosition: number): string;
    /**
     * Approves, as a member of an elected contract's seated moderation team, a team action
     * another member proposed, by its id: today the deletion of a settled document, which
     * `contractDeleteSettledDocument` proposes. What the action does and why are the
     * proposal's. The approval that meets the rule runs the action and closes it.
     *
     * @param options - The approving identity, the contract, the `actionId` and the signer
     * @returns The team action and its status, proved: `closed` once the action ran, by this approval or a later one before the proof was taken
     */
    contractApproveTeamAction(options: ContractApproveTeamActionOptions): Promise<ContractTeamActionSignatureResult>;
    /**
     * Puts an identity on a moderated contract's banlist. A banned identity cannot act on the
     * contract at the document level until it is unbanned.
     *
     * @param options - The moderating identity, the contract, the target, the `reason` and the signer
     * @returns The target's status on the contract, proved
     */
    contractBanUser(options: ContractBanOptions): Promise<ContractModerationResult>;
    /**
     * Changes, as a moderator, the fields a document type keeps for its moderators on one of
     * its documents, whoever owns it: each field set to its value, a `null` removing it. Every
     * other property stays as its owner wrote it, `$updatedAt` among them, and `$revision`
     * goes up by one, so a replace its owner built on the earlier revision is refused.
     *
     * @param options - The moderating identity, the contract, the document type, the document, the `fields`, an optional `reason` and the signer
     * @returns The document as it now stands, proved
     */
    contractChangeDocumentFields(options: ContractChangeDocumentFieldsOptions): Promise<Document>;
    /**
     * Pays out a fee pot of a data contract: the owner pot whole to the contract owner, the
     * moderators pot in equal shares to the contract's moderation team, or for an elected
     * contract with a seated team by its proposal's reward split, whichever member claims it.
     * A pot is paid out at most once per epoch; `getContractFeePots` tells what a claim would
     * pay and when the pot was last paid out.
     *
     * @param options - The claiming identity, the contract, the `pot` and the signer
     * @returns The pot and the balances it proved: of every recipient the contract names, or
     * of the claimant alone for a seated elected team
     */
    contractClaimFees(options: ContractClaimFeesOptions): Promise<ContractClaimFeesResult>;
    /**
     * Takes an identity off a moderated contract's warning list: every warning it carries
     * goes.
     *
     * @param options - The moderating identity, the contract, the target and the signer
     * @returns The target's status on the contract, proved: no warnings
     */
    contractClearUserWarnings(options: ContractModerationOptions): Promise<ContractModerationResult>;
    /**
     * Deletes one document on a moderated contract as a moderator, whoever owns it, except
     * the contract owner and the moderators. The document type must set
     * `moderatorAbilities.delete`. The document's owner gets no storage refund unless the type
     * sets `moderatorAbilities.deleteRefundsOwner`, and a record of the deletion stays under
     * the contract, which `getContractDocumentRemovals` reads, unless the type sets
     * `moderatorAbilities.deleteKeepsRecord: false`.
     *
     * @param options - The moderating identity, the contract, the document type, the document, an optional `reason` and the signer
     * @returns The record the deletion left under the contract, proved, or undefined on a type that keeps none, whose proof shows the document gone
     */
    contractDeleteDocument(options: ContractDeleteDocumentOptions): Promise<ContractDocumentRemovalResult | undefined>;
    /**
     * Proposes, as a member of an elected contract's seated moderation team, the deletion of
     * one settled document: one last modified longer ago than its type's
     * `moderatorAbilities.deleteWithin` window. The type must say who of the team must approve
     * (`moderatorAbilities.deleteSettled`). The proposal is the proposer's own approval, kept
     * under the contract as a team action, which `getContractTeamActions` reads; the other
     * members approve it by its `actionId` with `contractApproveTeamAction`, and the approval
     * that meets the rule deletes the document as a moderator's deletion does.
     *
     * @param options - The proposing identity, the contract, the document type, the document, the `reason` and the signer
     * @returns The team action the proposal opened and its status, proved: `actionId` is what the other members approve, and `status` is `closed` once the action ran and deleted the document, by this proposal alone or by a later approval before the proof was taken
     */
    contractDeleteSettledDocument(options: ContractDeleteSettledDocumentOptions): Promise<ContractTeamActionSignatureResult>;
    /**
     * Publish a new data contract on Dash Platform.
     *
     * This method handles the complete contract publishing flow:
     * 1. Validates the contract
     * 2. Creates and signs the contract create transition
     * 3. Broadcasts and waits for confirmation
     *
     * Note: The contract ID is generated by the platform using the identity nonce
     * at the time of publishing. The returned contract contains the actual ID.
     *
     * @param options - Options including the data contract, public key, and signer
     * @returns Promise that resolves to the published DataContract with the actual ID
     */
    contractPublish(options: ContractPublishOptions): Promise<DataContract>;
    /**
     * Restores, as a moderator, one document a moderator deleted: the document as it was,
     * within a week of its deletion. The document goes back through an ordinary insert, and
     * its removal record stays, marked restored. The signer pays for the document's storage;
     * the refund of a later deletion stays its owner's.
     *
     * @param options - The moderating identity, the contract, the document type, the document as it was, and the signer
     * @returns The record of the deletion, now marked restored, proved
     */
    contractRestoreDocument(options: ContractRestoreDocumentOptions): Promise<ContractDocumentRemovalResult>;
    /**
     * Suspends an identity on a moderated contract until the block time `until`, in
     * milliseconds, replacing a suspension it already carries. The first document transition
     * of the identity after the suspension lapses sweeps it.
     *
     * @param options - The moderating identity, the contract, the target, `until`, the `reason` and the signer
     * @returns The target's status on the contract, proved
     */
    contractSuspendUser(options: ContractSuspendOptions): Promise<ContractModerationResult>;
    /**
     * Takes an identity off a moderated contract's banlist.
     *
     * @param options - The moderating identity, the contract, the target and the signer
     * @returns The target's status on the contract, proved
     */
    contractUnbanUser(options: ContractModerationOptions): Promise<ContractModerationResult>;
    /**
     * Takes an identity off a moderated contract's suspension list, lapsed or not.
     *
     * @param options - The moderating identity, the contract, the target and the signer
     * @returns The target's status on the contract, proved
     */
    contractUnsuspendUser(options: ContractModerationOptions): Promise<ContractModerationResult>;
    /**
     * Update an existing data contract on Dash Platform.
     *
     * This method handles the complete contract update flow:
     * 1. Creates and signs the contract update transition
     * 2. Broadcasts and waits for confirmation
     *
     * @param options - Update options including the updated data contract, public key, and signer
     * @returns Promise that resolves when the contract is updated
     */
    contractUpdate(options: ContractUpdateOptions): Promise<void>;
    /**
     * Warns an identity on a moderated contract: adds a warning, stamped with the block
     * time, to the warnings it carries. A warning bars nothing; the warnings accumulate, at
     * most 16 at a time, until they are cleared.
     *
     * @param options - The moderating identity, the contract, the target, the `reason` and the signer
     * @returns The target's warnings on the contract, proved
     */
    contractWarnUser(options: ContractWarnOptions): Promise<ContractModerationResult>;
    /**
     * Decrypts a byte property whose schema declares `encryptedFor`.
     *
     * The scheme carries no authentication tag: a wrong key is caught only by the padding
     * check, which it passes about once in 256 attempts, returning garbage.
     *
     * @returns The message.
     */
    static decryptDocumentProperty(options: DecryptDocumentPropertyOptions): Uint8Array;
    /**
     * Create a BIP44 mainnet derivation path
     */
    static derivationPathBip44Mainnet(account: number, change: number, index: number): DerivationPathInfo;
    /**
     * Create a BIP44 testnet derivation path
     */
    static derivationPathBip44Testnet(account: number, change: number, index: number): DerivationPathInfo;
    /**
     * Create a DIP13 mainnet derivation path (for HD masternode keys)
     */
    static derivationPathDip13Mainnet(account: number): Dip13DerivationPathInfo;
    /**
     * Create a DIP13 testnet derivation path (for HD masternode keys)
     */
    static derivationPathDip13Testnet(account: number): Dip13DerivationPathInfo;
    /**
     * Create a DIP9 mainnet derivation path
     */
    static derivationPathDip9Mainnet(featureType: number, account: number, index: number): DerivationPathInfo;
    /**
     * Create a DIP9 testnet derivation path
     */
    static derivationPathDip9Testnet(featureType: number, account: number, index: number): DerivationPathInfo;
    /**
     * Get child public key from extended public key
     */
    static deriveChildPublicKey(xpub: string, index: number, hardened: boolean): string;
    /**
     * Derive a DashPay contact key using DIP15 with full identity IDs
     */
    static deriveDashpayContactKey(params: DeriveDashpayContactKeyParams): DashpayContactKeyInfo;
    /**
     * Derive a key from mnemonic phrase using BIP39/BIP44
     */
    static deriveKeyFromSeedPhrase(params: DeriveKeyFromSeedPhraseParams): SeedPhraseKeyInfo;
    /**
     * Derive a key from seed phrase with extended path supporting 256-bit indices
     * This supports DIP14/DIP15 paths with identity IDs
     */
    static deriveKeyFromSeedWithExtendedPath(params: DeriveKeyFromSeedWithExtendedPathParams): DerivedKeyInfo;
    /**
     * Derive a key from seed phrase with arbitrary path
     */
    static deriveKeyFromSeedWithPath(params: DeriveKeyFromSeedWithPathParams): PathDerivedKeyInfo;
    /**
     * Create a new document on Dash Platform.
     *
     * This method handles the complete document creation flow:
     * 1. Fetches the data contract from Platform
     * 2. Validates the document data against the document type schema
     * 3. Creates and signs the document create transition
     * 4. Broadcasts and waits for confirmation
     *
     * @param options - Creation options including document, identity key, and signer
     * The id of a new document commits to the identity contract nonce of its
     * create transition (protocol version 14), so it only exists once the
     * document is put: the `id` of the document passed in is a placeholder
     * until then, and is updated to the final id when this resolves.
     *
     * @returns Promise resolving to the confirmed Document as Platform
     *          committed it — its final `id` and the consensus-populated system fields
     *          (`$createdAt` and friends) included. For an indexOnly document type
     *          the proof shows the document's entry at the proof's block, not that
     *          this create wrote it: no stronger proof exists for such a document.
     *          Keep THIS instance
     *          when you later intend to delete an indexOnly document
     *          whose type requires `$createdAt`: the delete carries the
     *          document's values, and the pre-broadcast wrapper never
     *          learns the block timestamp Platform assigned.
     */
    documentCreate(options: DocumentCreateOptions): Promise<Document>;
    /**
     * Delete a document from Dash Platform.
     *
     * This method handles the complete document deletion flow:
     * 1. Fetches the data contract from Platform
     * 2. Creates and signs the document delete transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Delete options including document (or document identifiers), identity key, and signer
     * @returns Promise that resolves when the document is deleted. For an indexOnly
     *          document type the proof shows the document's entry gone at the proof's
     *          block, not that this delete removed it: no stronger proof exists for
     *          such a document.
     */
    documentDelete(options: DocumentDeleteOptions): Promise<void>;
    /**
     * Purchase a document that has a price set.
     *
     * This method handles the complete document purchase flow:
     * 1. Fetches the data contract from Platform
     * 2. Creates and signs the document purchase transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Purchase options including document, buyer ID, price, and signer
     * @returns Promise that resolves when the purchase is complete
     */
    documentPurchase(options: DocumentPurchaseOptions): Promise<void>;
    /**
     * Replace an existing document on Dash Platform.
     *
     * This method handles the complete document replacement flow:
     * 1. Fetches the data contract from Platform
     * 2. Validates the new document data against the document type schema
     * 3. Creates and signs the document replace transition
     * 4. Broadcasts and waits for confirmation
     *
     * @param options - Replace options including document, identity key, and signer
     * @returns Promise that resolves when the document is replaced
     */
    documentReplace(options: DocumentReplaceOptions): Promise<void>;
    /**
     * Set a price on a document to enable purchases.
     *
     * This method handles the complete price setting flow:
     * 1. Fetches the data contract from Platform
     * 2. Creates and signs the price update transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Set price options including document, price, and signer
     * @returns Promise that resolves when the price is set
     */
    documentSetPrice(options: DocumentSetPriceOptions): Promise<void>;
    /**
     * Transfer a document to another identity.
     *
     * This method handles the complete document transfer flow:
     * 1. Fetches the data contract from Platform
     * 2. Creates and signs the document transfer transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Transfer options including document, recipient, and signer
     * @returns Promise that resolves when the document is transferred
     */
    documentTransfer(options: DocumentTransferOptions): Promise<void>;
    static dpnsConvertToHomographSafe(input: string): string;
    static dpnsIsContestedUsername(label: string): boolean;
    dpnsIsNameAvailable(label: string): Promise<boolean>;
    static dpnsIsValidUsername(label: string): boolean;
    /**
     * Register a DPNS username on Dash Platform.
     *
     * This method handles the complete DPNS registration flow:
     * 1. Creates and submits a preorder document
     * 2. Waits for preorder confirmation
     * 3. Creates and submits the domain document
     * 4. Returns the result with both document IDs
     *
     * @param options - Registration options including label, identity, key, and signer
     * @returns Promise that resolves to the registration result
     */
    dpnsRegisterName(options: DpnsRegisterNameOptions): Promise<RegisterDpnsNameResult>;
    dpnsResolveName(name: string): Promise<string | undefined>;
    /**
     * Encrypts a message into a byte property whose schema declares `encryptedFor`, the way
     * the declaration says (the scheme dashpay contact requests use: ECDH on secp256k1, a
     * random 16-byte IV, AES-256-CBC).
     *
     * @returns The properties to set on the document: the ciphertext at `property` and the
     * two key ids at the declaration's `recipientKey` and `senderKey` paths, nested like the
     * paths. The recipient property is the caller's to set.
     */
    static encryptDocumentProperty(options: EncryptDocumentPropertyOptions): Record<string, unknown>;
    /**
     * Reads whose keys an encrypted property of a document is under: the recipient and the
     * sender identities and the ids of their keys, which a reader fetches to decrypt it. A
     * document whose owner may have changed since it was written is refused: its sender key
     * id may name a previous owner's key.
     */
    static encryptedPropertyEnvelope(options: EncryptedPropertyEnvelopeOptions): EncryptedPropertyEnvelope;
    /**
     * Generate a new random key pair
     */
    static generateKeyPair(network: NetworkLike): KeyPair;
    /**
     * Generate multiple key pairs
     */
    static generateKeyPairs(network: NetworkLike, count: number): KeyPair[];
    /**
     * Generate a new mnemonic phrase
     */
    static generateMnemonic(params?: GenerateMnemonicParams | null): string;
    /**
     * Generate deterministic test identity keys for SDK functional tests.
     *
     * This generates the same keys that are created in the genesis state when
     * SDK_TEST_DATA=true is set. The seed should match the first byte of the
     * identity ID (1, 2, or 3 for the test identities).
     *
     * Returns an array of objects containing:
     * - keyId: The identity key ID
     * - privateKeyHex: The 32-byte private key in hex format
     * - publicKeyData: The public key data in hex (33 bytes for ECDSA_SECP256K1, 20 bytes for ECDSA_HASH160)
     * - keyType: The key type (e.g., "ECDSA_SECP256K1", "ECDSA_HASH160")
     * - purpose: The key purpose (e.g., "AUTHENTICATION", "TRANSFER")
     * - securityLevel: The security level (e.g., "MASTER", "CRITICAL", "HIGH")
     *
     * Key indices:
     * - 0: MASTER level AUTHENTICATION key (ECDSA_SECP256K1)
     * - 1: CRITICAL level AUTHENTICATION key (ECDSA_SECP256K1)
     * - 2: HIGH level AUTHENTICATION key (ECDSA_SECP256K1)
     * - 3: CRITICAL level TRANSFER key (ECDSA_HASH160) - for credit transfers
     */
    static generateTestIdentityKeys(seed: bigint): any;
    /**
     * Fetches information about a Platform address including its nonce and balance.
     *
     * @param address - The platform address to query (PlatformAddress, Uint8Array, or bech32m string)
     * @returns PlatformAddressInfo containing address, nonce, and balance
     */
    getAddressInfo(address: PlatformAddressLike): Promise<PlatformAddressInfo | undefined>;
    /**
     * Fetches information about a Platform address including its nonce and balance, with proof.
     *
     * @param address - The platform address to query (PlatformAddress, Uint8Array, or bech32m string)
     * @returns ProofMetadataResponse containing PlatformAddressInfo with proof information
     */
    getAddressInfoWithProofInfo(address: PlatformAddressLike): Promise<ProofMetadataResponseTyped<PlatformAddressInfo | undefined>>;
    /**
     * Fetches information about multiple Platform addresses.
     *
     * @param addresses - Array of platform addresses to query
     * @returns Map of PlatformAddress to PlatformAddressInfo (or undefined for unfunded addresses)
     */
    getAddressesInfos(addresses: PlatformAddressLikeArray): Promise<Map<string, PlatformAddressInfo | undefined>>;
    /**
     * Fetches information about multiple Platform addresses with proof.
     *
     * @param addresses - Array of platform addresses to query
     * @returns ProofMetadataResponse containing Map of PlatformAddress to PlatformAddressInfo
     */
    getAddressesInfosWithProofInfo(addresses: PlatformAddressLikeArray): Promise<ProofMetadataResponseTyped<Map<string, PlatformAddressInfo | undefined>>>;
    /**
     * Run a chained document query (provable semi-join) and return
     * both verified halves.
     *
     * The composition is always proof-verified: one merged grovedb
     * proof commits to one quorum-signed root, and the proven outer
     * documents must match the proven inner join values: exactly for a
     * `permanentDocument` join property (a missing referenced document
     * is a verification error), for a `moderatedDocument` one a document
     * a moderator removed is reported by its proven removal record, and
     * for a `deletableDocument` one a document deleted since is proven
     * absent and left out.
     */
    getChainedDocuments(query: ChainedDocumentsQuery): Promise<ChainedDocumentsResult>;
    /**
     * [`Self::get_chained_documents`] with the response metadata and
     * proof envelope attached.
     */
    getChainedDocumentsWithProofInfo(query: ChainedDocumentsQuery): Promise<ProofMetadataResponseTyped<ChainedDocumentsResult>>;
    /**
     * Run a composite document query (a page plus the sub-queries
     * derived from it) and return the verified page and every
     * sub-result.
     *
     * The composition is always proof-verified: one merged grovedb
     * proof commits to one quorum-signed root, every sub-query is
     * re-derived from the proven page, and a by-id join off a
     * `permanentDocument` property whose referenced document is missing
     * is a verification error, not an absence (off a `deletableDocument`
     * property it is a proven absence, left out).
     */
    getCompositeDocuments(query: CompositeDocumentsQuery): Promise<CompositeDocumentsResult>;
    /**
     * [`Self::get_composite_documents`] with the response metadata and
     * proof envelope attached.
     */
    getCompositeDocumentsWithProofInfo(query: CompositeDocumentsQuery): Promise<ProofMetadataResponseTyped<CompositeDocumentsResult>>;
    /**
     * The prefunded voting balance a create of `document` states to join the
     * contest it enters: the contested index the document falls under and the
     * fund to join that contest now, or `undefined` when the document joins no
     * contest (its type has no contested index, or its values do not match one).
     *
     * `documentCreate` states this itself. A create transition built by hand
     * passes it as `prefundedVotingBalance` to `new DocumentCreateTransition`:
     * from protocol version 14 a contested create that states less than the
     * fund to join is refused and still pays its fees. The fund doubles once the
     * contest holds 250 contenders and again for every 50 more, so this reads
     * the contenders with proved queries, one per 100 of them. From protocol
     * version 14 a create may state more than this, as headroom against
     * contenders joining before it lands: Platform charges it only the fund to
     * join, but the identity must hold what it states. Before 14 it must state
     * exactly this.
     *
     * @param document - The document to create; its contract is fetched (or
     *                   read from the cache) to find the contested index
     * @returns The index name and credits to state, or undefined
     */
    getContestFundToJoin(document: Document): Promise<PrefundedVotingBalance | undefined>;
    getContestedResourceIdentityVotes(query: ContestedResourceIdentityVotesQuery): Promise<Map<string, ResourceVote>>;
    getContestedResourceIdentityVotesWithProofInfo(query: ContestedResourceIdentityVotesQuery): Promise<ProofMetadataResponseTyped<Map<string, ResourceVote>>>;
    getContestedResourceVoteState(query: ContestedResourceVoteStateQuery): Promise<ContestedResourceVoteState>;
    getContestedResourceVoteStateWithProofInfo(query: ContestedResourceVoteStateQuery): Promise<ProofMetadataResponseTyped<ContestedResourceVoteState>>;
    getContestedResourceVotersForIdentity(query: ContestedResourceVotersForIdentityQuery): Promise<Array<Identifier>>;
    getContestedResourceVotersForIdentityWithProofInfo(query: ContestedResourceVotersForIdentityQuery): Promise<ProofMetadataResponseTyped<Array<Identifier>>>;
    getContestedResources(query: VotePollsByDocumentTypeQuery): Promise<Array<any>>;
    getContestedResourcesWithProofInfo(query: VotePollsByDocumentTypeQuery): Promise<ProofMetadataResponseTyped<Array<any>>>;
    /**
     * The records of the documents a contract's moderators deleted within one document type,
     * in document id order: the records of the `documentIds` named, where a document with no
     * record is left out, or else one page of them all. Pass a page's `nextStartAfter` as the
     * next query's `startAfter`; a page without one is the last. The document type must set
     * `moderatorAbilities.delete` without `deleteKeepsRecord: false`: no other keeps records,
     * and the node refuses the query.
     *
     * # Example
     * ```javascript
     * const { removals } = await sdk.getContractDocumentRemovals({ contractId, documentTypeName: 'post', documentIds: [documentId] });
     * if (removals.length) console.log('removed by', removals[0].moderatorId);
     * ```
     */
    getContractDocumentRemovals(query: ContractDocumentRemovalsQuery): Promise<ContractDocumentRemovalsPage>;
    /**
     * The removal records of a document type together with their proof and metadata.
     */
    getContractDocumentRemovalsWithProofInfo(query: ContractDocumentRemovalsQuery): Promise<ProofMetadataResponseTyped<ContractDocumentRemovalsPage>>;
    /**
     * What the document action fees of a contract have collected for its owner and for its
     * moderation team, and the last claim of each pot: its epoch, its block time and who
     * claimed. Use it to decide whether a `contractClaimFees` is worth sending.
     *
     * # Example
     * ```javascript
     * const pots = await sdk.getContractFeePots(contractId);
     * if (pots.moderators.credits > 0n) console.log('there are fees to claim');
     * ```
     */
    getContractFeePots(contractId: IdentifierLike): Promise<ContractFeePots>;
    /**
     * The fee pots of a contract together with their proof and metadata.
     */
    getContractFeePotsWithProofInfo(contractId: IdentifierLike): Promise<ProofMetadataResponseTyped<ContractFeePots>>;
    /**
     * A contract group's stored information: owner, admins, name and description, or
     * `undefined` when no group has the id.
     *
     * # Example
     * ```javascript
     * const info = await sdk.getContractGroupInfo(contractGroupId);
     * if (info) console.log(info.ownerId, info.adminIds, info.name);
     * ```
     */
    getContractGroupInfo(contractGroupId: IdentifierLike): Promise<ContractGroupInfo | undefined>;
    /**
     * A contract group's stored information together with its proof and metadata.
     */
    getContractGroupInfoWithProofInfo(contractGroupId: IdentifierLike): Promise<ProofMetadataResponseTyped<ContractGroupInfo | undefined>>;
    /**
     * One page of a contract group's members of one kind, in key order. Pass the page's
     * `nextStartAfter` as the next query's `startAfter` to read the following page; a page
     * without one is the last.
     *
     * # Example
     * ```javascript
     * let page = await sdk.getContractGroupMembers({ contractGroupId, kind: 'contracts', limit: 50 });
     * while (page.nextStartAfter) {
     *   page = await sdk.getContractGroupMembers({ contractGroupId, kind: 'contracts', limit: 50, startAfter: page.nextStartAfter });
     * }
     * ```
     */
    getContractGroupMembers(query: ContractGroupMembersQuery): Promise<ContractGroupMembersPage>;
    /**
     * One page of a contract group's members together with its proof and metadata.
     */
    getContractGroupMembersWithProofInfo(query: ContractGroupMembersQuery): Promise<ProofMetadataResponseTyped<ContractGroupMembersPage>>;
    /**
     * The contract groups a contract belongs to: as a whole, through its document types and
     * through its tokens. Every entry is empty when it belongs to no group.
     *
     * # Example
     * ```javascript
     * const memberships = await sdk.getContractGroupsForContract(contractId);
     * console.log(memberships.contract, memberships.documentTypes, memberships.tokens);
     * ```
     */
    getContractGroupsForContract(contractId: IdentifierLike): Promise<ContractGroupMemberships>;
    /**
     * The contract groups a contract belongs to together with their proof and metadata.
     */
    getContractGroupsForContractWithProofInfo(contractId: IdentifierLike): Promise<ProofMetadataResponseTyped<ContractGroupMemberships>>;
    /**
     * How many counted moderation actions (bans, suspensions, warnings and document deletions)
     * each member of an elected contract's seated team signed since the moderators pot was last
     * paid out, in identity id order: what a payout by actions shares that part of the pot by.
     * Only an elected contract keeps counts; the node refuses any other.
     *
     * # Example
     * ```javascript
     * const { counts } = await sdk.getContractModerationActionCounts(contractId);
     * ```
     */
    getContractModerationActionCounts(contractId: IdentifierLike): Promise<ContractModerationActionCounts>;
    /**
     * The moderation action counts of an elected contract together with their proof and
     * metadata.
     */
    getContractModerationActionCountsWithProofInfo(contractId: IdentifierLike): Promise<ProofMetadataResponseTyped<ContractModerationActionCounts>>;
    /**
     * One page of a moderated contract's banlist, suspension list or warning list, in
     * identity id order. Pass the page's `nextStartAfter` as the next query's `startAfter`;
     * a page without one is the last.
     *
     * # Example
     * ```javascript
     * let page = await sdk.getContractModerationEntries({ contractId, list: 'banlist', limit: 50 });
     * while (page.nextStartAfter) {
     *   page = await sdk.getContractModerationEntries({ contractId, list: 'banlist', limit: 50, startAfter: page.nextStartAfter });
     * }
     * ```
     */
    getContractModerationEntries(query: ContractModerationEntriesQuery): Promise<ContractModerationEntriesPage>;
    /**
     * One page of a moderation list together with its proof and metadata.
     */
    getContractModerationEntriesWithProofInfo(query: ContractModerationEntriesQuery): Promise<ProofMetadataResponseTyped<ContractModerationEntriesPage>>;
    /**
     * One identity's status on a moderated contract: whether it is banned, until when it is
     * suspended, and the warnings it carries, on the lists read. Every list the query names must be one the contract
     * keeps; without `lists`, every list the contract keeps is read.
     *
     * # Example
     * ```javascript
     * const status = await sdk.getContractModerationStatus({ contractId, identityId });
     * if (status.banned) console.log('banned');
     * ```
     */
    getContractModerationStatus(query: ContractModerationStatusQuery): Promise<ContractModerationStatus>;
    /**
     * One identity's status on a moderated contract together with its proof and metadata.
     */
    getContractModerationStatusWithProofInfo(query: ContractModerationStatusQuery): Promise<ProofMetadataResponseTyped<ContractModerationStatus>>;
    /**
     * Who approved one of the actions an elected contract's seated moderation team votes on,
     * the proposer among them unless it left the team and its approval was dropped, in identity
     * id order: none when the contract holds no action of that id with the status asked. An
     * action that closed is read with `status: 'closed'`.
     *
     * # Example
     * ```javascript
     * const { signerIds } = await sdk.getContractTeamActionSigners({ contractId, status: 'active', actionId });
     * ```
     */
    getContractTeamActionSigners(query: ContractTeamActionSignersQuery): Promise<ContractTeamActionSigners>;
    /**
     * The approvals of a team action together with their proof and metadata.
     */
    getContractTeamActionSignersWithProofInfo(query: ContractTeamActionSignersQuery): Promise<ProofMetadataResponseTyped<ContractTeamActionSigners>>;
    /**
     * One page of the actions an elected contract's seated moderation team votes on, active
     * (still gathering approvals) or closed (their approvals met the rule and they ran), in
     * action id order. Today every action is the deletion of a settled document
     * (`moderatorAbilities.deleteSettled`): a member proposes it with
     * `contractDeleteSettledDocument`, and the others approve it by its `actionId` with
     * `contractApproveTeamAction`. Pass a page's `nextStartAtActionId` as the next query's
     * `startAtActionId`; a page without one is the last.
     *
     * # Example
     * ```javascript
     * const { actions } = await sdk.getContractTeamActions({ contractId, status: 'active' });
     * for (const { actionId, event } of actions) console.log(actionId, event.documentId);
     * ```
     */
    getContractTeamActions(query: ContractTeamActionsQuery): Promise<ContractTeamActionsPage>;
    /**
     * One page of team actions together with its proof and metadata.
     */
    getContractTeamActionsWithProofInfo(query: ContractTeamActionsQuery): Promise<ProofMetadataResponseTyped<ContractTeamActionsPage>>;
    getCurrentEpoch(): Promise<ExtendedEpochInfo>;
    getCurrentEpochWithProofInfo(): Promise<ProofMetadataResponseTyped<ExtendedEpochInfo>>;
    getCurrentQuorumsInfo(): Promise<CurrentQuorumsInfo>;
    getDataContract(contractId: IdentifierLike): Promise<DataContract | undefined>;
    getDataContractHistory(query: DataContractHistoryQuery): Promise<Map<bigint, DataContract>>;
    getDataContractHistoryWithProofInfo(query: DataContractHistoryQuery): Promise<ProofMetadataResponseTyped<Map<bigint, DataContract>>>;
    getDataContractWithProofInfo(contractId: IdentifierLike): Promise<ProofMetadataResponseTyped<DataContract>>;
    getDataContracts(ids: IdentifierLikeArray): Promise<Map<string, DataContract | undefined>>;
    /**
     * One page of the contract enumeration, ordered by ascending contract id.
     * Pass `{}` for the first page; the last key of a page is the next `startAfter`.
     */
    getDataContractsByRange(query: DataContractsByRangeQuery): Promise<Map<string, DataContract | undefined>>;
    /**
     * One page of the contract enumeration together with its proof and metadata.
     */
    getDataContractsByRangeWithProofInfo(query: DataContractsByRangeQuery): Promise<ProofMetadataResponseTyped<Map<string, DataContract | undefined>>>;
    /**
     * The current versions of data contracts: the cheap check that contracts held locally
     * are still current. One map entry per requested id, `undefined` for an id no contract
     * has; contracts come back only with `includeContracts`.
     *
     * This SDK verifies the answer. From protocol version 14, without `includeContracts`,
     * the proof covers the four-byte version item each contract carries in state, a few
     * hundred bytes of hash path per contract. With `includeContracts`, and on earlier
     * protocol versions, the proof is the multi-contract proof, so the call costs as much
     * as `getDataContracts`.
     */
    getDataContractsLatestVersions(query: DataContractsLatestVersionsQuery): Promise<Map<string, DataContractLatestVersion | undefined>>;
    /**
     * The current versions of data contracts together with their proof and metadata.
     */
    getDataContractsLatestVersionsWithProofInfo(query: DataContractsLatestVersionsQuery): Promise<ProofMetadataResponseTyped<Map<string, DataContractLatestVersion | undefined>>>;
    getDataContractsWithProofInfo(ids: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, DataContract | undefined>>>;
    getDocument(dataContractId: IdentifierLike, documentType: string, documentId: IdentifierLike): Promise<Document | undefined>;
    getDocumentHistory(query: DocumentHistoryQuery): Promise<Map<bigint, Document>>;
    getDocumentHistoryWithProofInfo(query: DocumentHistoryQuery): Promise<ProofMetadataResponseTyped<Map<bigint, Document>>>;
    getDocumentWithProofInfo(dataContractId: IdentifierLike, documentType: string, documentId: IdentifierLike): Promise<ProofMetadataResponseTyped<Document | undefined>>;
    getDocuments(query: DocumentsQuery): Promise<Map<string, Document | undefined>>;
    /**
     * Get the `(count, sum)` pair for the documents matching a query,
     * optionally grouped by an index field. Client computes
     * `avg = sum / count`.
     *
     * Average-side analog of [`Self::get_documents_sum`]. Returned
     * map values are `{count: bigint, sum: bigint}` per entry; the
     * `Aggregate` mode emits a single entry with empty-string key
     * carrying the totals. JS callers can divide with whichever
     * representation they want (`Number(sum) / Number(count)`,
     * BigInt division for integer-truncated, etc.) — the server
     * intentionally doesn't pre-divide.
     *
     * `sumProperty` names the integer document property to
     * average. AVG reuses the same `documentsSummable` /
     * `documentsAverageable` index machinery as SUM — no separate
     * `averageable` flag exists; the server pairs the named
     * property's `summable` index with a countable terminator to
     * produce the `(count, sum)` shape.
     */
    getDocumentsAverage(query: DocumentsQuery, sum_property: string): Promise<Map<string, {count: bigint, sum: bigint}>>;
    getDocumentsAverageWithProofInfo(query: DocumentsQuery, sum_property: string): Promise<ProofMetadataResponseTyped<Map<string, {count: bigint, sum: bigint}>>>;
    /**
     * Count documents matching a query.
     *
     * Returns a `Map<string, bigint>` keyed by the platform-value-
     * encoded property value (hex-encoded). For simple total counts
     * (empty / omitted `groupBy`) the map has a single entry with
     * empty-string key — `result.get("")` is the total. For
     * per-group modes (non-empty `groupBy`), each key maps to its
     * count.
     *
     * Query-object knobs (all camelCase on the JS side):
     * - `where: [[field, op, value], ...]`
     * - `orderBy?: [[field, "asc"|"desc"], ...]` — first clause's
     *   direction controls per-key entry ordering. On the
     *   `RangeDistinctProof` prove path the direction is part of
     *   the path-query bytes the SDK reconstructs to verify the
     *   proof; empty `orderBy` defaults to ascending on both
     *   sides. The `PointLookupProof` path (`In` + `prove`, no
     *   range) doesn't read `orderBy` — its builder sorts In keys
     *   lex-ascending unconditionally for prove/no-proof parity.
     * - `limit?: number` — caps the number of entries returned in
     *   per-group modes. On no-proof paths the server clamps to
     *   its `max_query_limit`. On the prove-distinct path the
     *   server rejects oversized requests with `InvalidLimit`
     *   rather than silently clamping (silent clamping would break
     *   proof verification); unset falls back to a compile-time
     *   constant the SDK verifier reads, so proof bytes are
     *   deterministic across operators regardless of their runtime
     *   config.
     * - `groupBy?: string[]` — SQL-shaped GROUP BY, mirroring the
     *   wire `group_by` field one-to-one. See the `DocumentsQuery`
     *   TypeScript declaration for the supported shapes (aggregate
     *   / per-`In`-value / per-distinct-range / compound). The
     *   server rejects unsupported `(select, group_by, where)`
     *   combinations with `QuerySyntaxError::Unsupported`.
     *
     * One entry point per `[plain | withProofInfo]` variant covers
     * every count mode because `DocumentSplitCounts::fetch` (which
     * this wraps) dispatches on the request shape internally. For
     * compound `In + range` queries with a 2-field `groupBy` the
     * per-`(in_key, key)` entries are summed by `key` into the flat
     * map; callers needing the unmerged compound shape should use a
     * richer binding (not yet exposed here).
     */
    getDocumentsCount(query: DocumentsQuery): Promise<Map<string, bigint>>;
    getDocumentsCountWithProofInfo(query: DocumentsQuery): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    /**
     * Return the groups whose aggregate falls inside a bound.
     *
     * `SELECT <aggregate> GROUP BY <property> HAVING <that aggregate>
     * <op> <value> LIMIT n`, served from protocol version 14 against
     * the same ranked indexes [`Self::get_documents_ranked`] reads.
     * Verification covers completeness — an in-range group the node
     * omitted fails the proof.
     *
     * There is no offset and no cursor: continue a page by tightening
     * the bound, and size `limit` above the widest expected tie, since
     * a page cut inside a tie cannot be continued.
     */
    getDocumentsHaving(query: DocumentsHavingQuery): Promise<DocumentsHavingResult>;
    /**
     * [`Self::get_documents_having`] with the proof and block metadata
     * the answer was verified against.
     */
    getDocumentsHavingWithProofInfo(query: DocumentsHavingQuery): Promise<ProofMetadataResponseTyped<DocumentsHavingResult>>;
    /**
     * Rank groups by an aggregate and return the top (or bottom) `n`.
     *
     * `SELECT <aggregate> GROUP BY <property> ORDER BY <that aggregate>
     * LIMIT n [OFFSET m]`, served from protocol version 14 against a
     * contract index that declares the matching `rankedCountable` /
     * `rankedSummable` / `rankedAverageable` keyword. A node on an
     * earlier protocol version, or a contract whose index does not opt
     * in, rejects the query and names what is missing.
     *
     * Entries come back in ranking order and must not be re-sorted;
     * `startingRank` plus the entry's position is its absolute rank.
     */
    getDocumentsRanked(query: DocumentsRankedQuery): Promise<DocumentsRankedResult>;
    /**
     * [`Self::get_documents_ranked`] with the proof and block metadata
     * the answer was verified against.
     */
    getDocumentsRankedWithProofInfo(query: DocumentsRankedQuery): Promise<ProofMetadataResponseTyped<DocumentsRankedResult>>;
    /**
     * Get aggregated sums of an integer property across documents
     * matching a query, optionally grouped by an index field.
     *
     * Sum-side analog of [`Self::get_documents_count`]. One entry
     * point per `[plain | withProofInfo]` variant covers every sum
     * mode (`Aggregate` / `GroupByIn` / `GroupByRange` /
     * `GroupByCompound`); `DocumentSplitSums::fetch` dispatches
     * internally on the request shape.
     *
     * The map values are `bigint` (signed `i64` on the wire); the
     * `Aggregate` mode emits a single entry with empty-string key
     * carrying the total. `GroupByIn` / `GroupByRange` emit one
     * entry per matched group keyed by the hex-encoded canonical
     * bytes of the splitting property's value (same convention as
     * count's per-In / per-distinct-range maps).
     *
     * `sumProperty` names the integer document property to
     * aggregate. Must match the doctype's `documentsSummable` OR a
     * covering index's `summable: "<prop>"` declaration — the
     * server's index picker rejects mismatches with a typed
     * request error.
     */
    getDocumentsSum(query: DocumentsQuery, sum_property: string): Promise<Map<string, bigint>>;
    getDocumentsSumWithProofInfo(query: DocumentsQuery, sum_property: string): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getDocumentsWithProofInfo(query: DocumentsQuery): Promise<ProofMetadataResponseTyped<Map<string, Document | undefined>>>;
    getDpnsUsername(identityId: IdentifierLike): Promise<string | undefined>;
    getDpnsUsernameByName(username: string): Promise<DpnsUsernameInfo | undefined>;
    getDpnsUsernameByNameWithProofInfo(username: string): Promise<ProofMetadataResponseTyped<DpnsUsernameInfo | undefined>>;
    getDpnsUsernameWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<string | undefined>>;
    getDpnsUsernames(query: DpnsUsernamesQuery): Promise<Array<string>>;
    getDpnsUsernamesWithProofInfo(query: DpnsUsernamesQuery): Promise<ProofMetadataResponseTyped<Array<string>>>;
    getEpochsInfo(query: EpochsQuery): Promise<Map<number, ExtendedEpochInfo | undefined>>;
    getEpochsInfoWithProofInfo(query: EpochsQuery): Promise<ProofMetadataResponseTyped<Map<number, ExtendedEpochInfo | undefined>>>;
    getEvonodesProposedEpochBlocksByIds(epoch: number, ids: ProTxHashLikeArray): Promise<Map<string, bigint>>;
    getEvonodesProposedEpochBlocksByIdsWithProofInfo(epoch: number, proTxHashes: ProTxHashLikeArray): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getEvonodesProposedEpochBlocksByRange(query: EvonodeProposedBlocksRangeQuery): Promise<Map<string, bigint>>;
    getEvonodesProposedEpochBlocksByRangeWithProofInfo(query: EvonodeProposedBlocksRangeQuery): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getFinalizedEpochInfos(query: FinalizedEpochsQuery): Promise<Map<number, FinalizedEpochInfo | undefined>>;
    getFinalizedEpochInfosWithProofInfo(query: FinalizedEpochsQuery): Promise<ProofMetadataResponseTyped<Map<number, FinalizedEpochInfo | undefined>>>;
    getGroupActionSigners(query: GroupActionSignersQuery): Promise<Map<string, bigint>>;
    getGroupActionSignersWithProofInfo(query: GroupActionSignersQuery): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getGroupActions(query: GroupActionsQuery): Promise<Map<string, GroupAction | undefined>>;
    getGroupActionsWithProofInfo(query: GroupActionsQuery): Promise<ProofMetadataResponseTyped<Map<string, GroupAction | undefined>>>;
    getGroupInfo(dataContractId: IdentifierLike, groupContractPosition: number): Promise<Group | undefined>;
    getGroupInfoWithProofInfo(dataContractId: IdentifierLike, groupContractPosition: number): Promise<ProofMetadataResponseTyped<Group | undefined>>;
    getGroupInfos(query: GroupInfosQuery): Promise<Map<number, Group | undefined>>;
    getGroupInfosWithProofInfo(query: GroupInfosQuery): Promise<ProofMetadataResponseTyped<Map<number, Group | undefined>>>;
    getGroupMembers(query: GroupMembersQuery): Promise<Map<string, bigint>>;
    getGroupMembersWithProofInfo(query: GroupMembersQuery): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getGroupsDataContracts(dataContractIds: IdentifierLikeArray): Promise<Map<string, Map<number, Group | undefined>>>;
    getGroupsDataContractsWithProofInfo(dataContractIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, Map<number, Group | undefined>>>>;
    getIdentitiesBalances(identityIds: IdentifierLikeArray): Promise<Map<string, bigint | undefined>>;
    getIdentitiesBalancesWithProofInfo(identityIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, bigint | undefined>>>;
    getIdentitiesContractKeys(query: IdentitiesContractKeysQuery): Promise<Array<IdentityContractKeys>>;
    getIdentitiesContractKeysWithProofInfo(query: IdentitiesContractKeysQuery): Promise<ProofMetadataResponseTyped<Array<IdentityContractKeys>>>;
    getIdentitiesTokenBalances(identityIds: IdentifierLikeArray, tokenId: IdentifierLike): Promise<Map<string, bigint>>;
    getIdentitiesTokenBalancesWithProofInfo(identityIds: IdentifierLikeArray, tokenId: IdentifierLike): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getIdentitiesTokenInfos(identityIds: IdentifierLikeArray, tokenId: IdentifierLike): Promise<Map<string, IdentityTokenInfo>>;
    getIdentitiesTokenInfosWithProofInfo(identityIds: IdentifierLikeArray, tokenId: IdentifierLike): Promise<ProofMetadataResponseTyped<Map<string, IdentityTokenInfo>>>;
    getIdentity(identityId: IdentifierLike): Promise<Identity | undefined>;
    getIdentityBalance(identityId: IdentifierLike): Promise<bigint | undefined>;
    getIdentityBalanceAndRevision(identityId: IdentifierLike): Promise<IdentityBalanceAndRevision | undefined>;
    getIdentityBalanceAndRevisionWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<IdentityBalanceAndRevision | undefined>>;
    getIdentityBalanceWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<bigint | undefined>>;
    getIdentityByNonUniquePublicKeyHash(publicKeyHash: PublicKeyHashLike, startAfterId: IdentifierLikeOrUndefined): Promise<Array<Identity>>;
    getIdentityByNonUniquePublicKeyHashWithProofInfo(publicKeyHash: PublicKeyHashLike, startAfterId: IdentifierLikeOrUndefined): Promise<ProofMetadataResponseTyped<Array<Identity>>>;
    getIdentityByPublicKeyHash(publicKeyHash: PublicKeyHashLike): Promise<Identity | undefined>;
    getIdentityByPublicKeyHashWithProofInfo(publicKeyHash: PublicKeyHashLike): Promise<ProofMetadataResponseTyped<Identity | undefined>>;
    getIdentityContractNonce(identityId: IdentifierLike, contractId: IdentifierLike): Promise<bigint | undefined>;
    getIdentityContractNonceWithProofInfo(identityId: IdentifierLike, contractId: IdentifierLike): Promise<ProofMetadataResponseTyped<bigint | undefined>>;
    getIdentityGroups(query: IdentityGroupsQuery): Promise<Array<IdentityGroupInfo>>;
    getIdentityGroupsWithProofInfo(query: IdentityGroupsQuery): Promise<ProofMetadataResponseTyped<Array<IdentityGroupInfo>>>;
    getIdentityKeys(query: IdentityKeysQuery): Promise<Array<IdentityPublicKey>>;
    /**
     * What is left of the budgets of several keys of one identity (protocol version 14).
     *
     * Every requested key id is in the returned map: a `bigint` for a key with a budget (`0n`
     * means the key can no longer sign), `null` for a key without a budget or a key that does
     * not exist.
     */
    getIdentityKeysRemainingBudgets(identityId: IdentifierLike, keyIds: number[]): Promise<Map<number, bigint | null>>;
    /**
     * [`Self::get_identity_keys_remaining_budgets`] with the proof and the response metadata.
     */
    getIdentityKeysRemainingBudgetsWithProofInfo(identityId: IdentifierLike, keyIds: number[]): Promise<ProofMetadataResponseTyped<Map<number, bigint | null>>>;
    getIdentityKeysWithProofInfo(query: IdentityKeysQuery): Promise<ProofMetadataResponseTyped<Array<IdentityPublicKey>>>;
    getIdentityNonce(identityId: IdentifierLike): Promise<bigint | undefined>;
    getIdentityNonceWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<bigint | undefined>>;
    getIdentityTokenBalances(identityId: IdentifierLike, tokenIds: IdentifierLikeArray): Promise<Map<string, bigint>>;
    getIdentityTokenBalancesWithProofInfo(identityId: IdentifierLike, tokenIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, bigint>>>;
    getIdentityTokenInfos(identityId: IdentifierLike, tokenIds: IdentifierLikeArray): Promise<Map<string, IdentityTokenInfo>>;
    getIdentityTokenInfosWithProofInfo(identityId: IdentifierLike, tokenIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, IdentityTokenInfo>>>;
    getIdentityUnproved(identityId: IdentifierLike): Promise<Identity>;
    getIdentityWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<Identity | undefined>>;
    /**
     * One page of the join requests for a proposal, in the order of their owners' ids.
     *
     * @returns The `joinRequest` documents by id; pass the last id as `startAfter` for the
     * next page.
     */
    getModerationJoinRequests(query: ModerationJoinRequestsQuery): Promise<Map<string, Document | undefined>>;
    /**
     * The resignation requests for a seated charter the leader has not acted on: those whose
     * writer is still on the team (an added member is taken off by deleting its addition, an
     * elected one by a removal). A withdrawn request is deleted, so it is not among them
     * either.
     *
     * @param electedCharterId - The seated charter, an `electedCharter` document.
     */
    getModerationPendingResignationRequests(electedCharterId: IdentifierLike): Promise<Document[]>;
    /**
     * The seated charter of a contract: the `electedCharter` whose `targetContractId` is it.
     * Only a contest's winner is ever stored, so there is at most one.
     *
     * @param targetContractId - The moderated contract.
     * @returns The `electedCharter` document, or undefined when the contract has none.
     */
    getModerationSeatedCharter(targetContractId: IdentifierLike): Promise<Document | undefined>;
    /**
     * A proposal by id, such as a seated charter's `submittedCharterId`.
     *
     * @param submittedCharterId - The `submittedCharter` document.
     * @returns The proposal, or undefined when there is none.
     */
    getModerationSubmittedCharter(submittedCharterId: IdentifierLike): Promise<Document | undefined>;
    /**
     * One page of the proposals for a contract, in filing order.
     *
     * @returns The `submittedCharter` documents by id; pass the last id as `startAfter` for
     * the next page.
     */
    getModerationSubmittedCharters(query: ModerationSubmittedChartersQuery): Promise<Map<string, Document | undefined>>;
    /**
     * The team that moderates a contract: the seated charter's leader plus its elected
     * members and the members the leader added, less those the leader removed.
     *
     * @param targetContractId - The moderated contract.
     * @returns The team, or undefined when the contract has no seated charter.
     */
    getModerationTeam(targetContractId: IdentifierLike): Promise<ModerationTeam | undefined>;
    /**
     * Returns the most recent shielded anchor (32 bytes), or undefined if none exists.
     */
    getMostRecentShieldedAnchor(): Promise<Uint8Array | undefined>;
    getMostRecentShieldedAnchorWithProofInfo(): Promise<ProofMetadataResponseTyped<Uint8Array | null>>;
    getPathElements(path: GrovePathSegment[], keys: GrovePathSegment[]): Promise<Array<PathElement>>;
    getPathElementsWithProofInfo(path: GrovePathSegment[], keys: GrovePathSegment[]): Promise<ProofMetadataResponseTyped<Array<PathElement>>>;
    getPrefundedSpecializedBalance(identityId: IdentifierLike): Promise<PrefundedSpecializedBalance>;
    getPrefundedSpecializedBalanceWithProofInfo(identityId: IdentifierLike): Promise<ProofMetadataResponseTyped<PrefundedSpecializedBalance | undefined>>;
    getProtocolVersionUpgradeState(): Promise<ProtocolVersionUpgradeState>;
    getProtocolVersionUpgradeStateWithProofInfo(): Promise<ProofMetadataResponseTyped<ProtocolVersionUpgradeState>>;
    getProtocolVersionUpgradeVoteStatus(startProTxHash: ProTxHashLike | undefined, count: number): Promise<Map<string, ProtocolVersionUpgradeVoteStatus>>;
    getProtocolVersionUpgradeVoteStatusWithProofInfo(startProTxHash: ProTxHashLike | undefined, count: number): Promise<ProofMetadataResponseTyped<Map<string, ProtocolVersionUpgradeVoteStatus>>>;
    /**
     * Returns all valid anchors for building Orchard spend proofs.
     */
    getShieldedAnchors(): Promise<Uint8Array[]>;
    getShieldedAnchorsWithProofInfo(): Promise<ProofMetadataResponseTyped<Uint8Array[]>>;
    /**
     * Fetches encrypted notes from the shielded pool, paginated.
     */
    getShieldedEncryptedNotes(startIndex: bigint, count: number): Promise<ShieldedEncryptedNote[]>;
    getShieldedEncryptedNotesWithProofInfo(startIndex: bigint, count: number): Promise<ProofMetadataResponseTyped<ShieldedEncryptedNote[]>>;
    /**
     * Checks the spent/unspent status of one or more nullifiers.
     */
    getShieldedNullifiers(nullifiers: Uint8Array[]): Promise<ShieldedNullifierStatus[]>;
    getShieldedNullifiersWithProofInfo(nullifiers: Uint8Array[]): Promise<ProofMetadataResponseTyped<ShieldedNullifierStatus[]>>;
    /**
     * Returns the total shielded pool balance as a BigInt, or undefined if not available.
     */
    getShieldedPoolState(): Promise<bigint | undefined>;
    getShieldedPoolStateWithProofInfo(): Promise<ProofMetadataResponseTyped<bigint | null>>;
    getStatus(): Promise<StatusResponse>;
    /**
     * Fetches the contract info for a token (the data contract that defines it
     * and the token's position within that contract).
     *
     * This query is keyed by **token ID**, not by data contract ID. A token ID
     * is derived from a data contract ID and the token's position via
     * `calculateTokenIdFromContract`. Passing a data contract ID here will not
     * match any record and resolves to `undefined`.
     *
     * # Arguments
     * * `token_id` - The token ID in base58 format
     *
     * # Returns
     * The token's contract info, or `undefined` if no token with that ID exists.
     *
     * # Example
     * ```javascript
     * const tokenId = WasmSdk.calculateTokenIdFromContract("Hqyu8WcRwXCTwbNxdga4CN5gsVEGc67wng4TFzceyLUv", 0);
     * const info = await sdk.getTokenContractInfo(tokenId);
     * ```
     */
    getTokenContractInfo(tokenId: IdentifierLike): Promise<TokenContractInfo | undefined>;
    /**
     * Fetches the contract info for a token, with cryptographic proof.
     *
     * This query is keyed by **token ID**, not by data contract ID. A token ID
     * is derived from a data contract ID and the token's position via
     * `calculateTokenIdFromContract`. Passing a data contract ID here will not
     * match any record and resolves to `undefined`.
     *
     * # Arguments
     * * `token_id` - The token ID in base58 format
     *
     * # Returns
     * The token's contract info (or `undefined`) along with proof metadata.
     */
    getTokenContractInfoWithProofInfo(tokenId: IdentifierLike): Promise<ProofMetadataResponseTyped<TokenContractInfo | undefined>>;
    getTokenDirectPurchasePrices(tokenIds: IdentifierLikeArray): Promise<Map<string, TokenPriceInfo>>;
    getTokenDirectPurchasePricesWithProofInfo(tokenIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, TokenPriceInfo>>>;
    getTokenPerpetualDistributionLastClaim(identityId: IdentifierLike, tokenId: IdentifierLike): Promise<RewardDistributionMoment | undefined>;
    getTokenPerpetualDistributionLastClaimWithProofInfo(identityId: IdentifierLike, tokenId: IdentifierLike): Promise<ProofMetadataResponseTyped<RewardDistributionMoment | undefined>>;
    /**
     * Get the current price of a token by contract ID and position
     *
     * This is a convenience function that calculates the token ID from the contract ID
     * and position, then fetches the current pricing schedule for that token.
     *
     * # Arguments
     * * `sdk` - The WasmSdk instance
     * * `contract_id` - The data contract ID in base58 format
     * * `token_position` - The position of the token in the contract (0-indexed)
     *
     * # Returns
     * An object containing:
     * - `tokenId`: The calculated token ID
     * - `currentPrice`: The current price of the token
     * - `basePrice`: The base price of the token (may be same as current for single price)
     *
     * # Example
     * ```javascript
     * const priceInfo = await sdk.getTokenPriceByContract(
     *     sdk,
     *     "Hqyu8WcRwXCTwbNxdga4CN5gsVEGc67wng4TFzceyLUv",
     *     0
     * );
     * console.log(`Token ${priceInfo.tokenId.toBase58()} current price: ${priceInfo.currentPrice}`);
     * ```
     */
    getTokenPriceByContract(contractId: IdentifierLike, tokenPosition: number): Promise<TokenPriceInfo>;
    getTokenStatuses(tokenIds: IdentifierLikeArray): Promise<Map<string, TokenStatus>>;
    getTokenStatusesWithProofInfo(tokenIds: IdentifierLikeArray): Promise<ProofMetadataResponseTyped<Map<string, TokenStatus>>>;
    getTokenTotalSupply(tokenId: IdentifierLike): Promise<TokenTotalSupply | undefined>;
    getTokenTotalSupplyWithProofInfo(tokenId: IdentifierLike): Promise<ProofMetadataResponseTyped<TokenTotalSupply | undefined>>;
    getTotalCreditsInPlatform(): Promise<bigint>;
    getTotalCreditsInPlatformWithProofInfo(): Promise<ProofMetadataResponseTyped<bigint | undefined>>;
    getVotePollsByEndDate(query?: VotePollsByEndDateQuery | null): Promise<Array<VotePollsByEndDateEntry>>;
    getVotePollsByEndDateWithProofInfo(query?: VotePollsByEndDateQuery | null): Promise<ProofMetadataResponseTyped<Array<VotePollsByEndDateEntry>>>;
    /**
     * Create a new identity on Dash Platform.
     *
     * This method handles the complete identity creation flow:
     * 1. Validates the asset lock proof
     * 2. Signs each public key with the corresponding private key
     * 3. Builds and signs the identity create transition
     * 4. Broadcasts and waits for confirmation
     *
     * @param options - Creation options including identity, asset lock, and signer
     * @returns Promise that resolves when the identity is created
     */
    identityCreate(options: IdentityCreateOptions): Promise<void>;
    /**
     * Create an identity funded from Platform addresses.
     *
     * This method handles the complete identity creation flow:
     * 1. Fetches current nonces for all input addresses
     * 2. Builds and signs the identity create from addresses transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Creation options including identity, inputs, and signers
     * @returns Promise resolving to result with created identity and updated address infos
     *
     * ## Unstable
     *
     * This function is planned to be changed to require address nonces in the options to avoid potential privacy leaks.
     */
    identityCreateFromAddresses(options: IdentityCreateFromAddressesOptions): Promise<IdentityCreateFromAddressesResult>;
    /**
     * Transfer credits from one identity to another.
     *
     * This method handles the complete transfer flow:
     * 1. Finds the appropriate transfer key to use for signing (or uses the provided one)
     * 2. Builds and signs the credit transfer transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Transfer options including identity, recipient, amount, and signer
     * @returns Promise resolving to IdentityCreditTransferResult with both balances
     */
    identityCreditTransfer(options: IdentityCreditTransferOptions): Promise<IdentityCreditTransferResult>;
    /**
     * Withdraw credits from an identity to a Dash address.
     *
     * This method handles the complete withdrawal flow:
     * 1. Finds the appropriate transfer/owner key to use for signing (or uses the provided one)
     * 2. Builds and signs the withdrawal transition
     * 3. Broadcasts and waits for confirmation
     * 4. The withdrawal may be pooled with others depending on the pooling strategy
     *
     * @param options - Withdrawal options including identity, amount, destination, and signer
     * @returns Promise resolving to the remaining balance after withdrawal
     */
    identityCreditWithdrawal(options: IdentityCreditWithdrawalOptions): Promise<bigint>;
    /**
     * Top up an existing identity with additional credits.
     *
     * This method handles the complete top up flow:
     * 1. Validates the asset lock proof
     * 2. Builds and signs the identity top up transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Top up options including identity, asset lock, and private key
     * @returns Promise resolving to the new balance after top up
     */
    identityTopUp(options: IdentityTopUpOptions): Promise<bigint>;
    /**
     * Top up an identity from Platform addresses.
     *
     * This method handles the complete top up flow:
     * 1. Fetches current nonces for all input addresses
     * 2. Builds and signs the identity top up transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Top up options including identity, inputs, and signer
     * @returns Promise resolving to result with updated address infos and new identity balance
     */
    identityTopUpFromAddresses(options: IdentityTopUpFromAddressesOptions): Promise<IdentityTopUpFromAddressesResult>;
    /**
     * Transfer credits from an identity to Platform addresses.
     *
     * This method handles the complete transfer flow:
     * 1. Finds the appropriate transfer key to use for signing (if signingTransferKeyId specified)
     * 2. Builds and signs the identity credit transfer to addresses transition
     * 3. Broadcasts and waits for confirmation
     *
     * @param options - Transfer options including identity, outputs, and signer
     * @returns Promise resolving to result with updated address infos and new identity balance
     */
    identityTransferToAddresses(options: IdentityTransferToAddressesOptions): Promise<IdentityTransferToAddressesResult>;
    /**
     * Update an identity by adding or disabling public keys.
     *
     * This method handles the complete update flow:
     * 1. Validates the master key for signing
     * 2. Validates keys to add/disable
     * 3. Builds and signs the identity update transition
     * 4. Broadcasts and waits for confirmation
     *
     * @param options - Update options including identity, keys to add/disable, and signer
     * @returns Promise that resolves when the update is complete
     */
    identityUpdate(options: IdentityUpdateOptions): Promise<void>;
    /**
     * Raises the limits of one of the identity's authentication keys: adds credits to its
     * total budget (and to what is left of it), or moves its expiry later. An update only
     * ever loosens limits, and what consensus would refuse and charge for (a limit the key
     * does not have, a value that does not raise it) is refused here before anything is
     * signed. Signed by a MASTER key, or a CRITICAL authentication key without limits and
     * without contract bounds, that the signer holds.
     *
     * @param options - The identity, the key, what to raise, and the signer
     * @returns The key as it is stored after the update
     */
    identityUpdateKeyLimits(options: IdentityKeyLimitsUpdateOptions): Promise<IdentityPublicKey>;
    /**
     * Create key pair from private key hex
     */
    static keyPairFromHex(privateKeyHex: string, network: NetworkLike): KeyPair;
    /**
     * Create key pair from private key WIF
     */
    static keyPairFromWif(privateKeyWif: string): KeyPair;
    /**
     * Submit a masternode vote for a contested resource.
     *
     * This method handles the complete voting flow:
     * 1. Builds and signs the vote transition with the voting key
     * 2. Broadcasts it and waits for the block that records it
     * 3. Verifies the proof of the recorded vote
     *
     * @param options - Vote options including masternode ProTxHash, vote poll, choice, and signer
     * @returns The vote as Platform recorded it
     */
    masternodeVote(options: MasternodeVoteOptions): Promise<Vote>;
    /**
     * Hard ceiling on the element count of a branching `in` prefix pin.
     *
     * Each element is its own secondary walk and its own branch of the
     * proof, so this bounds the fan-out a single request can ask for.
     * A pin above it is rejected, not truncated — split the request.
     */
    static maxPrefixInBranches(): number;
    /**
     * Hard ceiling on a ranked / having-range `limit`. A request above
     * it is rejected, not truncated.
     */
    static maxRankedLimit(): number;
    /**
     * Derive a seed from a mnemonic phrase
     */
    static mnemonicToSeed(mnemonic: string, passphrase?: string | null): Uint8Array;
    /**
     * Get address from public key
     */
    static pubkeyToAddress(pubkeyHex: string, network: NetworkLike): string;
    /**
     * The fixed-point divisor the `avg` axis sorts by.
     *
     * Exposed so a caller who persisted a `DocumentsGroupEntry.value`
     * can re-render it later without holding on to the result object
     * that produced it. Never hardcode the number — it is a build-time
     * constant that has already changed once.
     */
    static rankedAverageScale(): bigint;
    /**
     * Forces reload of the identity nonce from Platform on the next state transition.
     */
    refreshIdentityNonce(identity_id: Identifier): Promise<void>;
    /**
     * Remove a data contract from the cache.
     * Returns true if the contract was in the cache and was removed.
     */
    removeCachedContract(contractId: Identifier): boolean;
    /**
     * Configure tracing/logging level or filter (static, global)
     *
     * Accepts simple levels: "off", "error", "warn", "info", "debug", "trace"
     * or a full EnvFilter string like: "wasm_sdk=debug,rs_dapi_client=warn"
     */
    static setLogLevel(levelOrFilter: string): void;
    /**
     * Sign a message with a private key
     */
    static signMessage(message: string, privateKeyWif: string): string;
    /**
     * Burn tokens from an identity's balance.
     *
     * @param options - Burn options including contract ID, token position, amount, and signer
     * @returns Promise resolving to TokenBurnResult with the remaining balance
     */
    tokenBurn(options: TokenBurnOptions): Promise<TokenBurnResult>;
    /**
     * Claim tokens from a distribution.
     *
     * @param options - Claim options including contract ID, token position, distribution type, and signer
     * @returns Promise resolving to TokenClaimResult
     */
    tokenClaim(options: TokenClaimOptions): Promise<TokenClaimResult>;
    /**
     * Update a token's configuration.
     *
     * @param options - Config update options including contract ID, token position, change item, and signer
     * @returns Promise resolving to TokenConfigUpdateResult
     */
    tokenConfigUpdate(options: TokenConfigUpdateOptions): Promise<TokenConfigUpdateResult>;
    /**
     * Destroy a frozen identity's token balance.
     *
     * @param options - Destroy frozen options including contract ID, token position, authority, frozen identity, and signer
     * @returns Promise resolving to TokenDestroyFrozenResult
     */
    tokenDestroyFrozen(options: TokenDestroyFrozenOptions): Promise<TokenDestroyFrozenResult>;
    /**
     * Directly purchase tokens using credits.
     *
     * @param options - Purchase options including contract ID, token position, amount, max cost, and signer
     * @returns Promise resolving to TokenDirectPurchaseResult
     */
    tokenDirectPurchase(options: TokenDirectPurchaseOptions): Promise<TokenDirectPurchaseResult>;
    /**
     * Perform an emergency action (pause or resume) on a token.
     *
     * @param options - Emergency action options including contract ID, token position, action type, and signer
     * @returns Promise resolving to TokenEmergencyActionResult
     */
    tokenEmergencyAction(options: TokenEmergencyActionOptions): Promise<TokenEmergencyActionResult>;
    /**
     * Freeze an identity's token balance.
     *
     * @param options - Freeze options including contract ID, token position, authority, frozen identity, and signer
     * @returns Promise resolving to TokenFreezeResult
     */
    tokenFreeze(options: TokenFreezeOptions): Promise<TokenFreezeResult>;
    /**
     * Mint new tokens according to the token's configuration.
     *
     * @param options - Mint options including contract ID, token position, amount, and signer
     * @returns Promise resolving to TokenMintResult with the new balance
     */
    tokenMint(options: TokenMintOptions): Promise<TokenMintResult>;
    /**
     * Set the price of a token for direct purchase.
     *
     * @param options - Price options including contract ID, token position, price, and signer
     * @returns Promise resolving to TokenSetPriceResult
     */
    tokenSetPrice(options: TokenSetPriceOptions): Promise<TokenSetPriceResult>;
    /**
     * Transfer tokens from one identity to another.
     *
     * @param options - Transfer options including contract ID, token position, amount, sender, recipient, and signer
     * @returns Promise resolving to TokenTransferResult with transfer info
     */
    tokenTransfer(options: TokenTransferOptions): Promise<TokenTransferResult>;
    /**
     * Unfreeze an identity's token balance.
     *
     * @param options - Unfreeze options including contract ID, token position, authority, frozen identity, and signer
     * @returns Promise resolving to TokenUnfreezeResult
     */
    tokenUnfreeze(options: TokenUnfreezeOptions): Promise<TokenUnfreezeResult>;
    /**
     * Validate a Dash address
     */
    static validateAddress(address: string, network: NetworkLike): boolean;
    /**
     * Validate a mnemonic phrase
     */
    static validateMnemonic(mnemonic: string, languageCode?: string | null): boolean;
    version(): number;
    /**
     * Waits for a state transition response, accepting proofs that only
     * authenticate the state the transition affects.
     *
     * `waitForResponse` is strict: it fails for the transition families
     * whose proofs cannot be bound to the execution of one specific
     * transition (balance top-ups, credit transfers and withdrawals,
     * address funds movements, shields, no-history token operations, key
     * limits updates, contract updates, contract moderation and fee claims,
     * and creates and deletes of indexOnly documents). This method accepts
     * those outcomes, as well as execution-proved outcomes. A snapshot
     * authenticates state at the proof's block; it does not prove this specific
     * transition executed. The generic JavaScript result does not expose the
     * proof height.
     *
     * @param stateTransition - The state transition that was broadcast
     * @param settings - Optional put settings (retries, timeout, waitTimeoutMs)
     * @returns The verified affected-state result
     */
    waitForAffectedState(stateTransition: StateTransition, settings?: PutSettings | null): Promise<StateTransitionProofResultType>;
    /**
     * Waits for a state transition response after it has been broadcast.
     *
     * Use this after calling `broadcastStateTransition` to wait for the transition
     * to be processed by the network. This is useful when you want to broadcast
     * and wait separately (e.g., for monitoring or progress tracking).
     *
     * Note: This differs from `waitForStateTransitionResult` which takes a hash string.
     * This method takes the full state transition object and performs proof verification.
     * It succeeds only when the proof establishes execution of this specific transition.
     * An authenticated affected-state snapshot returns `ExecutionNotProved`; use
     * `waitForAffectedState` when a snapshot is the intended result.
     *
     * @param stateTransition - The state transition that was broadcast
     * @param settings - Optional put settings (retries, timeout, waitTimeoutMs)
     * @returns The execution-proved state transition result
     */
    waitForResponse(stateTransition: StateTransition, settings?: PutSettings | null): Promise<StateTransitionProofResultType>;
    waitForStateTransitionResult(stateTransitionHash: string): Promise<StateTransitionResult>;
    /**
     * Convert extended private key to extended public key
     */
    static xprvToXpub(xprv: string): string;
}

export class WasmSdkBuilder {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    build(): WasmSdk;
    /**
     * Get the latest platform version number
     */
    static getLatestVersionNumber(): number;
    /**
     * Create a new SdkBuilder preconfigured for a local network using default dashmate gateway.
     */
    static local(): WasmSdkBuilder;
    static mainnet(): WasmSdkBuilder;
    /**
     * Create a new SdkBuilder preconfigured for a devnet.
     *
     * Devnets have no built-in default address list. The returned builder
     * is expected to be paired with either explicit addresses (via the
     * `withAddresses` variant) or a `WasmTrustedContext` from
     * `WasmTrustedContext.prefetchDevnet(name)`, whose discovered addresses
     * will be substituted via `withTrustedContext`.
     */
    static newDevnet(): WasmSdkBuilder;
    static testnet(): WasmSdkBuilder;
    /**
     * Create a new SdkBuilder with specific addresses and network.
     *
     * # Arguments
     * * `addresses` - Array of HTTPS URLs (e.g., ["https://127.0.0.1:1443"])
     * * `network` - Network identifier: "mainnet", "testnet", "devnet", or "local"
     */
    static withAddresses(addresses: string[], network: string): WasmSdkBuilder;
    withContextProvider(contextProvider: WasmContext): WasmSdkBuilder;
    /**
     * Configure tracing/logging via the builder
     * Returns a new builder with logging configured
     */
    withLogs(levelOrFilter: string): WasmSdkBuilder;
    withProofs(enableProofs: boolean): WasmSdkBuilder;
    /**
     * Configure request settings for the SDK.
     *
     * Settings include:
     * - connect_timeout_ms: Timeout for establishing connection (in milliseconds)
     * - timeout_ms: Timeout for single request (in milliseconds)
     * - retries: Number of retries in case of failed requests
     * - ban_failed_address: Whether to ban DAPI address if node not responded or responded with error
     */
    withSettings(connectTimeoutMs?: number | null, timeoutMs?: number | null, retries?: number | null, banFailedAddress?: boolean | null): WasmSdkBuilder;
    /**
     * Attach a pre-fetched trusted context to this builder.
     *
     * The context provides quorum keys for proof verification and
     * discovered masternode addresses for network connectivity.
     *
     * Address-list behavior:
     * - If the builder was created via a preset (`mainnet`, `testnet`,
     *   `local`, `newDevnet`) and the context has discovered addresses,
     *   those discovered addresses replace the preset's default list.
     * - If the builder was created via `withAddresses(...)`, the
     *   user-provided addresses are preserved and discovered addresses
     *   from the context are ignored. The context is still attached for
     *   proof verification. Prefetch such a context with
     *   `discoverAddresses: false` to skip the discovery request outright.
     *
     * # Example
     * ```javascript
     * const context = await WasmTrustedContext.prefetchTestnet();
     * const builder = WasmSdkBuilder.testnet().withTrustedContext(context);
     * const sdk = builder.build();
     * ```
     */
    withTrustedContext(context: WasmTrustedContext): WasmSdkBuilder;
    /**
     * Configure platform version to use.
     *
     * Available versions:
     * - 1: Platform version 1
     * - 2: Platform version 2
     * - ... up to latest version
     *
     * Defaults to latest version if not specified.
     */
    withVersion(versionNumber: number): WasmSdkBuilder;
}

/**
 * Structured error surfaced to JS consumers
 */
export class WasmSdkError {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The consensus error code when the error is a consensus error (compare it with
     * `DocumentPropertyConstraintErrorCode` and the other code enums); -1 otherwise.
     */
    readonly code: number;
    /**
     * Whether the error is retryable
     */
    readonly isRetriable: boolean;
    /**
     * Error kind (enum)
     */
    readonly kind: WasmSdkErrorKind;
    /**
     * Human-readable message
     */
    readonly message: string;
    /**
     * Backwards-compatible name string for the kind
     */
    readonly name: string;
}

/**
 * Structured error surfaced to JS consumers
 */
export enum WasmSdkErrorKind {
    Config = 0,
    Drive = 1,
    DriveProofError = 2,
    Protocol = 3,
    Proof = 4,
    InvalidProvedResponse = 5,
    ExecutionNotProved = 6,
    DapiClientError = 7,
    DapiMocksError = 8,
    CoreError = 9,
    MerkleBlockError = 10,
    CoreClientError = 11,
    MissingDependency = 12,
    TotalCreditsNotFound = 13,
    EpochNotFound = 14,
    TimeoutReached = 15,
    AlreadyExists = 16,
    InvalidCreditTransfer = 17,
    Generic = 18,
    ContextProviderError = 19,
    Cancelled = 20,
    StaleNode = 21,
    StateTransitionBroadcastError = 22,
    NonceOverflow = 23,
    IdentityNonceNotFound = 24,
    DriveInternalError = 25,
    InvalidArgument = 26,
    SerializationError = 27,
    NotFound = 28,
    /**
     * Surface-stable scaffolded API that hasn't been wired through
     * the wasm-sdk layer yet. JS callers can branch on this kind
     * (vs `Generic`) to detect "the API exists but execution waits
     * on a follow-up" without parsing the message.
     */
    NotImplemented = 29,
    /**
     * An `encryptedFor` property did not decrypt: the keys are not the ones it was encrypted
     * with, or the bytes are corrupt.
     */
    DecryptionFailed = 30,
    /**
     * No key of an identity can serve as the recipient or sender key of an `encryptedFor`
     * property: none meets the schema's `keyRequirements`, or the private key given is not
     * one of the identity's keys.
     */
    EncryptionKeyNotFound = 31,
}

/**
 * A wrapper for TrustedHttpContextProvider that works in WASM.
 *
 * Holds pre-fetched quorum keys for proof verification and, unless discovery
 * was skipped, the masternode addresses the quorum service advertises. Create
 * one via the async `prefetchMainnet()`, `prefetchTestnet()`,
 * `prefetchDevnet()`, or `prefetchLocal()` factory methods, then pass it to a
 * builder via `withTrustedContext()`.
 *
 * Every factory takes an optional trailing `discoverAddresses` flag. The
 * current and previous quorum lists are always fetched, concurrently; the
 * masternode list is fetched alongside them unless the flag is `false`. A
 * builder created with `WasmSdkBuilder.withAddresses(...)` ignores discovered
 * addresses, so callers with explicit addresses should pass `false` and save
 * the round trip.
 */
export class WasmTrustedContext {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Pre-fetch quorum keys and masternode addresses for a devnet.
     *
     * `devnet_name` is the short name of the devnet (e.g. `"paloma"`). The
     * quorum base URL is derived as `https://quorums.<devnet_name>.networks.dash.org`.
     *
     * Returns a ready-to-use `WasmTrustedContext` that can be passed to
     * `WasmSdkBuilder.newDevnet().withTrustedContext(context)`.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchDevnet(devnet_name: string, discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for a devnet using a
     * fully-specified quorum base URL.
     *
     * Use this when the default
     * `https://quorums.<devnet_name>.networks.dash.org` URL produced by
     * `prefetchDevnet` is not yet deployed for a devnet, or when pointing
     * at a non-standard quorums endpoint.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchDevnetWithUrl(base_url: string, discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for a local network.
     *
     * Uses the default local quorum sidecar URL (`http://127.0.0.1:22444`).
     *
     * Returns a ready-to-use `WasmTrustedContext` that can be passed to
     * `WasmSdkBuilder.local().withTrustedContext(context)`.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchLocal(discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for a local network
     * using a custom quorum sidecar URL.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchLocalWithUrl(base_url: string, discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for mainnet.
     *
     * Returns a ready-to-use `WasmTrustedContext` that can be passed to
     * `WasmSdkBuilder.mainnet().withTrustedContext(context)`.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchMainnet(discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for mainnet using a
     * fully-specified quorum base URL (useful for testing against a staging
     * or self-hosted quorums endpoint).
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchMainnetWithUrl(base_url: string, discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for testnet.
     *
     * Returns a ready-to-use `WasmTrustedContext` that can be passed to
     * `WasmSdkBuilder.testnet().withTrustedContext(context)`.
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchTestnet(discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
    /**
     * Pre-fetch quorum keys and masternode addresses for testnet using a
     * fully-specified quorum base URL (useful for testing against a staging
     * or self-hosted quorums endpoint).
     *
     * Pass `discoverAddresses: false` to skip the masternode discovery request
     * when the SDK is built with `WasmSdkBuilder.withAddresses(...)`, which
     * ignores discovered addresses anyway. Defaults to `true`.
     */
    static prefetchTestnetWithUrl(base_url: string, discoverAddresses?: boolean | null): Promise<WasmTrustedContext>;
}

/**
 * Compute the platform sighash from an Orchard bundle commitment and extra data.
 *
 * `sighash = SHA-256("DashPlatformSighash" || bundleCommitment || extraData)`
 *
 * `extraData` is the exact preimage the transition's own layout defines; consensus rebuilds
 * it and compares, so a byte out of place rejects an otherwise valid bundle. Integers are
 * little endian.
 *
 * - Credit pool `ShieldedTransfer`: empty.
 * - Credit pool transitions that only create notes — shield, shield from identity and shield
 *   from asset lock: `kind tag (1 byte) || owner (32 bytes)`, with the tag `0x84`, `0x85` and
 *   `0x86` in that order. The owner is what funds the bundle: for shield, the SHA-256 of its
 *   input addresses, each as `type byte (0x00 P2PKH, 0x01 P2SH) || 20-byte hash` (not the
 *   bech32m type byte), sorted by type byte then hash, nonces and amounts excluded; for shield
 *   from identity, the identity id; for shield from asset lock, the double SHA-256 of the
 *   locked 36-byte outpoint. Before protocol version 14 shield and shield from asset lock bind
 *   nothing, so build for the network's protocol version. Such a bundle carries no anchor of
 *   its own, so this data is what ties it to the transition that carries it.
 * - `Unshield`: `outputAddress || amount (u64)`.
 * - Shielded withdrawal: `outputScript || amount (u64) || coreFeePerByte (u32) ||
 *   pooling (1 byte)`.
 * - Token pool transitions that only create notes — token shield, and mint, claim or direct
 *   purchase into the pool: `kind tag (1 byte) || tokenId (32 bytes) || ownerId (32 bytes)`,
 *   with the tag `0x80`, `0x81`, `0x82` and `0x83` in that order. `ownerId` is the batch
 *   owner; for a group action mint it is the proposer, and every other signer submits the
 *   proposer's bundle unchanged. Empty is rejected: such a bundle carries no anchor, every
 *   token pool shares the empty-tree anchor it proves against, and nothing else in the bundle
 *   says which pool, which kind or which owner it was built for.
 * - Other token pool transitions bind their own fields; see the `extra_sighash_data`
 *   builders in `dpp::shielded`.
 */
export function computePlatformSighash(bundle_commitment: Uint8Array, extra_data: Uint8Array): Uint8Array;

/**
 * What creating a document of the type `documentTypeName` of `contract`
 * costs: the storage every element it writes adds (exact, split by index
 * into the layers an index shares with others and its own), the processing
 * (the fixed charges of a signed batch, exact, and the writes' work,
 * estimated), what the contract adds (action fees, a token cost, a
 * contest's vote fund) and what a delete refunds.
 *
 * The document is built from sizes, not values: each variable-size field
 * at its middle size and each optional field present, unless `options`
 * says otherwise. Computed by Drive from the contract alone, so it needs no
 * network. Follows protocol version 14 on; an earlier `platformVersion` is
 * refused.
 */
export function documentCreateCost(contract: DataContract, documentTypeName: string, options: DocumentCreateCostOptions | undefined, platformVersion: PlatformVersionLike): DocumentCreateCost;

/**
 * The GroveDB layout of the document type `documentTypeName` of `contract`:
 * the document type tree, the documents by id and, for each index, the
 * property and value trees down to where the index ends, with the element
 * or tree type Drive writes at each (a count or sum tree, a ranked indexed
 * tree, a zero-contribution wrapper, a reference or an indexOnly item).
 *
 * Computed from the contract alone, with the functions Drive's index walkers
 * use, so it needs no network. Those are the walkers of protocol version 14
 * on; an earlier `platformVersion` is refused. Each node names the node of Drive's structure
 * description it is an instance of (`structureNode`), for linking to the
 * GroveDB structure viewer.
 */
export function documentTypeLayout(contract: DataContract, documentTypeName: string, platformVersion: PlatformVersionLike): DocumentTypeLayout;

export function start(): Promise<void>;

/**
 * Test helper: Convert a JsValue to a JSON-compatible JsValue.
 *
 * This function is exposed for testing purposes to validate the Map normalization
 * and BigInt handling logic in unit tests. It calls `js_value_to_json` internally
 * and converts the result back to a JsValue.
 *
 * # Example (JavaScript)
 * ```javascript
 * const map = new Map([['key', 'value']]);
 * const json = testJsValueToJson(map);
 * console.log(json); // { key: 'value' }
 * ```
 */
export function testJsValueToJson(value: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_datacontractlatestversion_free: (a: number, b: number) => void;
    readonly __wbg_get_tokenburnresult_document: (a: number) => number;
    readonly __wbg_get_tokenburnresult_groupActionStatus: (a: number) => [number, number];
    readonly __wbg_get_tokenburnresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenburnresult_ownerId: (a: number) => number;
    readonly __wbg_get_tokenclaimresult_document: (a: number) => number;
    readonly __wbg_get_tokenclaimresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenconfigupdateresult_document: (a: number) => number;
    readonly __wbg_get_tokenconfigupdateresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokendestroyfrozenresult_document: (a: number) => number;
    readonly __wbg_get_tokendestroyfrozenresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokendirectpurchaseresult_buyerId: (a: number) => number;
    readonly __wbg_get_tokendirectpurchaseresult_document: (a: number) => number;
    readonly __wbg_get_tokendirectpurchaseresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenemergencyactionresult_document: (a: number) => number;
    readonly __wbg_get_tokenemergencyactionresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenfreezeresult_document: (a: number) => number;
    readonly __wbg_get_tokenfreezeresult_frozenIdentityId: (a: number) => number;
    readonly __wbg_get_tokenfreezeresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenmintresult_document: (a: number) => number;
    readonly __wbg_get_tokenmintresult_groupActionStatus: (a: number) => [number, number];
    readonly __wbg_get_tokenmintresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenmintresult_recipientId: (a: number) => number;
    readonly __wbg_get_tokensetpriceresult_document: (a: number) => number;
    readonly __wbg_get_tokensetpriceresult_groupActionStatus: (a: number) => [number, number];
    readonly __wbg_get_tokensetpriceresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokensetpriceresult_ownerId: (a: number) => number;
    readonly __wbg_get_tokensetpriceresult_pricingSchedule: (a: number) => number;
    readonly __wbg_get_tokentransferresult_document: (a: number) => number;
    readonly __wbg_get_tokentransferresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenunfreezeresult_document: (a: number) => number;
    readonly __wbg_get_tokenunfreezeresult_groupPower: (a: number) => number;
    readonly __wbg_get_tokenunfreezeresult_unfrozenIdentityId: (a: number) => number;
    readonly __wbg_set_tokenburnresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenburnresult_groupActionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_set_tokenburnresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenburnresult_ownerId: (a: number, b: number) => void;
    readonly __wbg_set_tokenclaimresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenclaimresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokendirectpurchaseresult_buyerId: (a: number, b: number) => void;
    readonly __wbg_set_tokenfreezeresult_frozenIdentityId: (a: number, b: number) => void;
    readonly __wbg_set_tokensetpriceresult_pricingSchedule: (a: number, b: number) => void;
    readonly __wbg_set_tokentransferresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokentransferresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_tokenburnresult_free: (a: number, b: number) => void;
    readonly __wbg_tokenclaimresult_free: (a: number, b: number) => void;
    readonly __wbg_tokendirectpurchaseresult_free: (a: number, b: number) => void;
    readonly __wbg_tokenfreezeresult_free: (a: number, b: number) => void;
    readonly __wbg_tokensetpriceresult_free: (a: number, b: number) => void;
    readonly __wbg_tokentransferresult_free: (a: number, b: number) => void;
    readonly datacontractlatestversion_data_contract: (a: number) => number;
    readonly datacontractlatestversion_version: (a: number) => number;
    readonly tokenburnresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenburnresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenburnresult_remaining_balance: (a: number) => any;
    readonly tokenburnresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenburnresult_toObject: (a: number) => [number, number, number];
    readonly tokenclaimresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenclaimresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenclaimresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenclaimresult_toObject: (a: number) => [number, number, number];
    readonly tokenconfigupdateresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenconfigupdateresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenconfigupdateresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenconfigupdateresult_toObject: (a: number) => [number, number, number];
    readonly tokendestroyfrozenresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokendestroyfrozenresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokendestroyfrozenresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokendestroyfrozenresult_toObject: (a: number) => [number, number, number];
    readonly tokendirectpurchaseresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokendirectpurchaseresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokendirectpurchaseresult_new_balance: (a: number) => any;
    readonly tokendirectpurchaseresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokendirectpurchaseresult_toObject: (a: number) => [number, number, number];
    readonly tokenemergencyactionresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenemergencyactionresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenemergencyactionresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenemergencyactionresult_toObject: (a: number) => [number, number, number];
    readonly tokenfreezeresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenfreezeresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenfreezeresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenfreezeresult_toObject: (a: number) => [number, number, number];
    readonly tokenmintresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenmintresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenmintresult_new_balance: (a: number) => any;
    readonly tokenmintresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenmintresult_toObject: (a: number) => [number, number, number];
    readonly tokensetpriceresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokensetpriceresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokensetpriceresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokensetpriceresult_toObject: (a: number) => [number, number, number];
    readonly tokentransferresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokentransferresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokentransferresult_recipient_balance: (a: number) => any;
    readonly tokentransferresult_sender_balance: (a: number) => any;
    readonly tokentransferresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokentransferresult_toObject: (a: number) => [number, number, number];
    readonly tokenunfreezeresult_fromJSON: (a: any, b: any) => [number, number, number];
    readonly tokenunfreezeresult_fromObject: (a: any, b: any) => [number, number, number];
    readonly tokenunfreezeresult_toJSON: (a: number, b: any) => [number, number, number];
    readonly tokenunfreezeresult_toObject: (a: number) => [number, number, number];
    readonly wasmsdk_getDataContract: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractHistory: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractHistoryWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDataContracts: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractsByRange: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractsByRangeWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractsLatestVersions: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractsLatestVersionsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDataContractsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_tokenBurn: (a: number, b: any) => any;
    readonly wasmsdk_tokenClaim: (a: number, b: any) => any;
    readonly wasmsdk_tokenConfigUpdate: (a: number, b: any) => any;
    readonly wasmsdk_tokenDestroyFrozen: (a: number, b: any) => any;
    readonly wasmsdk_tokenDirectPurchase: (a: number, b: any) => any;
    readonly wasmsdk_tokenEmergencyAction: (a: number, b: any) => any;
    readonly wasmsdk_tokenFreeze: (a: number, b: any) => any;
    readonly wasmsdk_tokenMint: (a: number, b: any) => any;
    readonly wasmsdk_tokenSetPrice: (a: number, b: any) => any;
    readonly wasmsdk_tokenTransfer: (a: number, b: any) => any;
    readonly wasmsdk_tokenUnfreeze: (a: number, b: any) => any;
    readonly __wbg_set_tokenmintresult_groupActionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_set_tokensetpriceresult_groupActionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_tokenconfigupdateresult_free: (a: number, b: number) => void;
    readonly __wbg_tokendestroyfrozenresult_free: (a: number, b: number) => void;
    readonly __wbg_tokenemergencyactionresult_free: (a: number, b: number) => void;
    readonly __wbg_tokenunfreezeresult_free: (a: number, b: number) => void;
    readonly __wbg_set_tokenmintresult_recipientId: (a: number, b: number) => void;
    readonly __wbg_set_tokensetpriceresult_ownerId: (a: number, b: number) => void;
    readonly __wbg_set_tokenunfreezeresult_unfrozenIdentityId: (a: number, b: number) => void;
    readonly __wbg_set_tokenconfigupdateresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokendestroyfrozenresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokendirectpurchaseresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenemergencyactionresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenfreezeresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenmintresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokensetpriceresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenunfreezeresult_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_tokenconfigupdateresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokendestroyfrozenresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokendirectpurchaseresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenemergencyactionresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenfreezeresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenmintresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokensetpriceresult_document: (a: number, b: number) => void;
    readonly __wbg_set_tokenunfreezeresult_document: (a: number, b: number) => void;
    readonly __wbg_tokenmintresult_free: (a: number, b: number) => void;
    readonly __wbg_dpnsusernameinfo_free: (a: number, b: number) => void;
    readonly __wbg_get_dpnsusernameinfo_documentId: (a: number) => number;
    readonly __wbg_get_dpnsusernameinfo_identityId: (a: number) => number;
    readonly __wbg_get_dpnsusernameinfo_username: (a: number) => [number, number];
    readonly __wbg_get_registerdpnsnameresult_domainDocumentId: (a: number) => number;
    readonly __wbg_get_registerdpnsnameresult_fullDomainName: (a: number) => [number, number];
    readonly __wbg_get_registerdpnsnameresult_preorderDocumentId: (a: number) => number;
    readonly __wbg_proofinfo_free: (a: number, b: number) => void;
    readonly __wbg_proofmetadataresponse_free: (a: number, b: number) => void;
    readonly __wbg_registerdpnsnameresult_free: (a: number, b: number) => void;
    readonly __wbg_responsemetadata_free: (a: number, b: number) => void;
    readonly __wbg_set_dpnsusernameinfo_documentId: (a: number, b: number) => void;
    readonly __wbg_set_dpnsusernameinfo_identityId: (a: number, b: number) => void;
    readonly __wbg_set_dpnsusernameinfo_username: (a: number, b: number, c: number) => void;
    readonly dpnsusernameinfo_constructor: (a: number, b: number, c: number, d: number) => number;
    readonly dpnsusernameinfo_fromJSON: (a: any) => [number, number, number];
    readonly dpnsusernameinfo_fromObject: (a: any) => [number, number, number];
    readonly dpnsusernameinfo_toJSON: (a: number) => [number, number, number];
    readonly dpnsusernameinfo_toObject: (a: number) => [number, number, number];
    readonly proofinfo_block_id_hash: (a: number) => any;
    readonly proofinfo_constructor: (a: any, b: any, c: any, d: number, e: any, f: number) => number;
    readonly proofinfo_fromJSON: (a: any) => [number, number, number];
    readonly proofinfo_fromObject: (a: any) => [number, number, number];
    readonly proofinfo_grovedb_proof: (a: number) => any;
    readonly proofinfo_quorum_hash: (a: number) => any;
    readonly proofinfo_quorum_type: (a: number) => number;
    readonly proofinfo_round: (a: number) => number;
    readonly proofinfo_setBlockIdHash: (a: number, b: any) => void;
    readonly proofinfo_setGrovedbProof: (a: number, b: any) => void;
    readonly proofinfo_setQuorumHash: (a: number, b: any) => void;
    readonly proofinfo_setSignature: (a: number, b: any) => void;
    readonly proofinfo_signature: (a: number) => any;
    readonly proofinfo_toJSON: (a: number) => [number, number, number];
    readonly proofinfo_toObject: (a: number) => [number, number, number];
    readonly proofmetadataresponse_constructor: (a: any, b: number, c: number) => number;
    readonly proofmetadataresponse_data: (a: number) => any;
    readonly proofmetadataresponse_fromJSON: (a: any) => [number, number, number];
    readonly proofmetadataresponse_fromObject: (a: any) => [number, number, number];
    readonly proofmetadataresponse_metadata: (a: number) => number;
    readonly proofmetadataresponse_proof: (a: number) => number;
    readonly proofmetadataresponse_setData: (a: number, b: any) => void;
    readonly proofmetadataresponse_setMetadata: (a: number, b: number) => void;
    readonly proofmetadataresponse_setProof: (a: number, b: number) => void;
    readonly proofmetadataresponse_toJSON: (a: number) => [number, number, number];
    readonly proofmetadataresponse_toObject: (a: number) => [number, number, number];
    readonly registerdpnsnameresult_fromJSON: (a: any) => [number, number, number];
    readonly registerdpnsnameresult_fromObject: (a: any) => [number, number, number];
    readonly registerdpnsnameresult_toJSON: (a: number) => [number, number, number];
    readonly registerdpnsnameresult_toObject: (a: number) => [number, number, number];
    readonly responsemetadata_chain_id: (a: number) => any;
    readonly responsemetadata_constructor: (a: bigint, b: number, c: number, d: bigint, e: number, f: any) => number;
    readonly responsemetadata_core_chain_locked_height: (a: number) => number;
    readonly responsemetadata_epoch: (a: number) => number;
    readonly responsemetadata_fromJSON: (a: any) => [number, number, number];
    readonly responsemetadata_fromObject: (a: any) => [number, number, number];
    readonly responsemetadata_height: (a: number) => bigint;
    readonly responsemetadata_protocol_version: (a: number) => number;
    readonly responsemetadata_setChainId: (a: number, b: any) => void;
    readonly responsemetadata_time_ms: (a: number) => bigint;
    readonly responsemetadata_toJSON: (a: number) => [number, number, number];
    readonly responsemetadata_toObject: (a: number) => [number, number, number];
    readonly wasmsdk_dpnsConvertToHomographSafe: (a: number, b: number) => [number, number];
    readonly wasmsdk_dpnsIsContestedUsername: (a: number, b: number) => number;
    readonly wasmsdk_dpnsIsNameAvailable: (a: number, b: number, c: number) => any;
    readonly wasmsdk_dpnsIsValidUsername: (a: number, b: number) => number;
    readonly wasmsdk_dpnsRegisterName: (a: number, b: any) => any;
    readonly wasmsdk_dpnsResolveName: (a: number, b: number, c: number) => any;
    readonly wasmsdk_getDpnsUsername: (a: number, b: any) => any;
    readonly wasmsdk_getDpnsUsernameByName: (a: number, b: number, c: number) => any;
    readonly wasmsdk_getDpnsUsernameByNameWithProofInfo: (a: number, b: number, c: number) => any;
    readonly wasmsdk_getDpnsUsernameWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDpnsUsernames: (a: number, b: any) => any;
    readonly wasmsdk_getDpnsUsernamesWithProofInfo: (a: number, b: any) => any;
    readonly __wbg_set_registerdpnsnameresult_fullDomainName: (a: number, b: number, c: number) => void;
    readonly __wbg_set_registerdpnsnameresult_domainDocumentId: (a: number, b: number) => void;
    readonly __wbg_set_registerdpnsnameresult_preorderDocumentId: (a: number, b: number) => void;
    readonly __wbg_identitycredittransferresult_free: (a: number, b: number) => void;
    readonly __wbg_votepollsbyenddateentry_free: (a: number, b: number) => void;
    readonly identitycredittransferresult_recipient_balance: (a: number) => any;
    readonly identitycredittransferresult_sender_balance: (a: number) => any;
    readonly votepollsbyenddateentry_timestamp_ms: (a: number) => any;
    readonly votepollsbyenddateentry_vote_polls: (a: number) => any;
    readonly wasmsdk_getCurrentEpoch: (a: number) => any;
    readonly wasmsdk_getCurrentEpochWithProofInfo: (a: number) => any;
    readonly wasmsdk_getEpochsInfo: (a: number, b: any) => any;
    readonly wasmsdk_getEpochsInfoWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getEvonodesProposedEpochBlocksByIds: (a: number, b: number, c: any) => any;
    readonly wasmsdk_getEvonodesProposedEpochBlocksByIdsWithProofInfo: (a: number, b: number, c: any) => any;
    readonly wasmsdk_getEvonodesProposedEpochBlocksByRange: (a: number, b: any) => any;
    readonly wasmsdk_getEvonodesProposedEpochBlocksByRangeWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getFinalizedEpochInfos: (a: number, b: any) => any;
    readonly wasmsdk_getFinalizedEpochInfosWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getVotePollsByEndDate: (a: number, b: number) => any;
    readonly wasmsdk_getVotePollsByEndDateWithProofInfo: (a: number, b: number) => any;
    readonly wasmsdk_identityCreate: (a: number, b: any) => any;
    readonly wasmsdk_identityCreditTransfer: (a: number, b: any) => any;
    readonly wasmsdk_identityCreditWithdrawal: (a: number, b: any) => any;
    readonly wasmsdk_identityTopUp: (a: number, b: any) => any;
    readonly wasmsdk_identityUpdate: (a: number, b: any) => any;
    readonly wasmsdk_identityUpdateKeyLimits: (a: number, b: any) => any;
    readonly wasmsdk_masternodeVote: (a: number, b: any) => any;
    readonly __wbg_currentquorumsinfo_free: (a: number, b: number) => void;
    readonly __wbg_get_identitycontractkeys_identityId: (a: number) => number;
    readonly __wbg_get_identitycontractkeys_keys: (a: number) => [number, number];
    readonly __wbg_get_pathelement_value: (a: number) => [number, number];
    readonly __wbg_get_quoruminfo_isVerified: (a: number) => number;
    readonly __wbg_get_quoruminfo_memberCount: (a: number) => number;
    readonly __wbg_get_quoruminfo_quorumHash: (a: number) => [number, number];
    readonly __wbg_get_quoruminfo_quorumType: (a: number) => [number, number];
    readonly __wbg_get_quoruminfo_threshold: (a: number) => number;
    readonly __wbg_get_statetransitionresult_error: (a: number) => [number, number];
    readonly __wbg_get_statetransitionresult_state_transition_hash: (a: number) => [number, number];
    readonly __wbg_get_statetransitionresult_status: (a: number) => [number, number];
    readonly __wbg_get_statuschain_core_chain_locked_height: (a: number) => number;
    readonly __wbg_get_statuschain_earliest_app_hash: (a: number) => [number, number];
    readonly __wbg_get_statuschain_earliest_block_hash: (a: number) => [number, number];
    readonly __wbg_get_statuschain_earliest_block_height: (a: number) => [number, number];
    readonly __wbg_get_statuschain_isCatchingUp: (a: number) => number;
    readonly __wbg_get_statuschain_latest_app_hash: (a: number) => [number, number];
    readonly __wbg_get_statuschain_latest_block_hash: (a: number) => [number, number];
    readonly __wbg_get_statuschain_latest_block_height: (a: number) => [number, number];
    readonly __wbg_get_statuschain_max_peer_block_height: (a: number) => [number, number];
    readonly __wbg_get_statusdriveprotocol_current: (a: number) => number;
    readonly __wbg_get_statusdriveprotocol_latest: (a: number) => number;
    readonly __wbg_get_statusnetwork_chain_id: (a: number) => [number, number];
    readonly __wbg_get_statusnetwork_isListening: (a: number) => number;
    readonly __wbg_get_statusnetwork_peers_count: (a: number) => number;
    readonly __wbg_get_statusprotocol_drive: (a: number) => number;
    readonly __wbg_get_statusprotocol_tenderdash: (a: number) => number;
    readonly __wbg_get_statusresponse_chain: (a: number) => number;
    readonly __wbg_get_statusresponse_network: (a: number) => number;
    readonly __wbg_get_statusresponse_node: (a: number) => number;
    readonly __wbg_get_statusresponse_state_sync: (a: number) => number;
    readonly __wbg_get_statusresponse_time: (a: number) => number;
    readonly __wbg_get_statusresponse_version: (a: number) => number;
    readonly __wbg_get_statussoftware_dapi: (a: number) => [number, number];
    readonly __wbg_get_statussoftware_drive: (a: number) => [number, number];
    readonly __wbg_get_statussoftware_tenderdash: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_backfill_blocks_total: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_backfilled_blocks: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_chunk_process_avg_time: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_remaining_time: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_snapshot_chunks_count: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_snapshot_height: (a: number) => [number, number];
    readonly __wbg_get_statusstatesync_total_snapshots: (a: number) => number;
    readonly __wbg_get_statusstatesync_total_synced_time: (a: number) => [number, number];
    readonly __wbg_get_statustenderdashprotocol_block: (a: number) => number;
    readonly __wbg_get_statustenderdashprotocol_p2p: (a: number) => number;
    readonly __wbg_get_statustime_block: (a: number) => [number, number];
    readonly __wbg_get_statustime_epoch: (a: number) => number;
    readonly __wbg_get_statustime_genesis: (a: number) => [number, number];
    readonly __wbg_get_statustime_local: (a: number) => [number, number];
    readonly __wbg_get_statusversion_protocol: (a: number) => number;
    readonly __wbg_get_statusversion_software: (a: number) => number;
    readonly __wbg_identitybalanceandrevision_free: (a: number, b: number) => void;
    readonly __wbg_identitycontractkeys_free: (a: number, b: number) => void;
    readonly __wbg_pathelement_free: (a: number, b: number) => void;
    readonly __wbg_prefundedspecializedbalance_free: (a: number, b: number) => void;
    readonly __wbg_quoruminfo_free: (a: number, b: number) => void;
    readonly __wbg_set_identitycontractkeys_identityId: (a: number, b: number) => void;
    readonly __wbg_set_identitycontractkeys_keys: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathelement_value: (a: number, b: number, c: number) => void;
    readonly __wbg_set_quoruminfo_isVerified: (a: number, b: number) => void;
    readonly __wbg_set_quoruminfo_memberCount: (a: number, b: number) => void;
    readonly __wbg_set_quoruminfo_quorumHash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_quoruminfo_quorumType: (a: number, b: number, c: number) => void;
    readonly __wbg_set_quoruminfo_threshold: (a: number, b: number) => void;
    readonly __wbg_set_statetransitionresult_error: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statetransitionresult_state_transition_hash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statetransitionresult_status: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_core_chain_locked_height: (a: number, b: number) => void;
    readonly __wbg_set_statuschain_earliest_app_hash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_earliest_block_hash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_earliest_block_height: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_isCatchingUp: (a: number, b: number) => void;
    readonly __wbg_set_statuschain_latest_app_hash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_latest_block_hash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statuschain_max_peer_block_height: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusdriveprotocol_current: (a: number, b: number) => void;
    readonly __wbg_set_statusdriveprotocol_latest: (a: number, b: number) => void;
    readonly __wbg_set_statusnetwork_isListening: (a: number, b: number) => void;
    readonly __wbg_set_statusnetwork_peers_count: (a: number, b: number) => void;
    readonly __wbg_set_statusprotocol_drive: (a: number, b: number) => void;
    readonly __wbg_set_statusprotocol_tenderdash: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_chain: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_network: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_node: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_state_sync: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_time: (a: number, b: number) => void;
    readonly __wbg_set_statusresponse_version: (a: number, b: number) => void;
    readonly __wbg_set_statussoftware_drive: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statussoftware_tenderdash: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_backfill_blocks_total: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_backfilled_blocks: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_chunk_process_avg_time: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_snapshot_chunks_count: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_snapshot_height: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_total_snapshots: (a: number, b: number) => void;
    readonly __wbg_set_statustime_block: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statustime_genesis: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusversion_protocol: (a: number, b: number) => void;
    readonly __wbg_set_statusversion_software: (a: number, b: number) => void;
    readonly __wbg_statetransitionresult_free: (a: number, b: number) => void;
    readonly __wbg_statuschain_free: (a: number, b: number) => void;
    readonly __wbg_statusdriveprotocol_free: (a: number, b: number) => void;
    readonly __wbg_statusnetwork_free: (a: number, b: number) => void;
    readonly __wbg_statusnode_free: (a: number, b: number) => void;
    readonly __wbg_statusprotocol_free: (a: number, b: number) => void;
    readonly __wbg_statusresponse_free: (a: number, b: number) => void;
    readonly __wbg_statussoftware_free: (a: number, b: number) => void;
    readonly __wbg_statusstatesync_free: (a: number, b: number) => void;
    readonly __wbg_statustenderdashprotocol_free: (a: number, b: number) => void;
    readonly __wbg_statustime_free: (a: number, b: number) => void;
    readonly __wbg_statusversion_free: (a: number, b: number) => void;
    readonly currentquorumsinfo_fromJSON: (a: any) => [number, number, number];
    readonly currentquorumsinfo_fromObject: (a: any) => [number, number, number];
    readonly currentquorumsinfo_height: (a: number) => bigint;
    readonly currentquorumsinfo_quorums: (a: number) => any;
    readonly currentquorumsinfo_toJSON: (a: number) => [number, number, number];
    readonly currentquorumsinfo_toObject: (a: number) => [number, number, number];
    readonly documentTypeLayout: (a: number, b: number, c: number, d: any) => [number, number, number];
    readonly identitybalanceandrevision_balance: (a: number) => any;
    readonly identitybalanceandrevision_fromJSON: (a: any) => [number, number, number];
    readonly identitybalanceandrevision_fromObject: (a: any) => [number, number, number];
    readonly identitybalanceandrevision_revision: (a: number) => bigint;
    readonly identitybalanceandrevision_toJSON: (a: number) => [number, number, number];
    readonly identitybalanceandrevision_toObject: (a: number) => [number, number, number];
    readonly pathelement_element_type: (a: number) => [number, number];
    readonly pathelement_fromJSON: (a: any) => [number, number, number];
    readonly pathelement_fromObject: (a: any) => [number, number, number];
    readonly pathelement_key: (a: number) => any;
    readonly pathelement_path: (a: number) => any;
    readonly pathelement_path_bytes: (a: number) => any;
    readonly pathelement_reference_target: (a: number) => any;
    readonly pathelement_reference_target_error: (a: number) => [number, number];
    readonly pathelement_sum: (a: number) => any;
    readonly pathelement_toJSON: (a: number) => [number, number, number];
    readonly pathelement_toObject: (a: number) => [number, number, number];
    readonly pathelement_value_bytes: (a: number) => any;
    readonly prefundedspecializedbalance_balance: (a: number) => any;
    readonly prefundedspecializedbalance_fromJSON: (a: any) => [number, number, number];
    readonly prefundedspecializedbalance_fromObject: (a: any) => [number, number, number];
    readonly prefundedspecializedbalance_identity_id: (a: number) => number;
    readonly prefundedspecializedbalance_toJSON: (a: number) => [number, number, number];
    readonly prefundedspecializedbalance_toObject: (a: number) => [number, number, number];
    readonly quoruminfo_fromJSON: (a: any) => [number, number, number];
    readonly quoruminfo_fromObject: (a: any) => [number, number, number];
    readonly quoruminfo_toJSON: (a: number) => [number, number, number];
    readonly quoruminfo_toObject: (a: number) => [number, number, number];
    readonly statetransitionresult_fromJSON: (a: any) => [number, number, number];
    readonly statetransitionresult_fromObject: (a: any) => [number, number, number];
    readonly statetransitionresult_owner_balance: (a: number) => [number, bigint];
    readonly statetransitionresult_toJSON: (a: number) => [number, number, number];
    readonly statetransitionresult_toObject: (a: number) => [number, number, number];
    readonly statuschain_fromJSON: (a: any) => [number, number, number];
    readonly statuschain_fromObject: (a: any) => [number, number, number];
    readonly statuschain_toJSON: (a: number) => [number, number, number];
    readonly statuschain_toObject: (a: number) => [number, number, number];
    readonly statusdriveprotocol_fromJSON: (a: any) => [number, number, number];
    readonly statusdriveprotocol_fromObject: (a: any) => [number, number, number];
    readonly statusdriveprotocol_toJSON: (a: number) => [number, number, number];
    readonly statusdriveprotocol_toObject: (a: number) => [number, number, number];
    readonly statusnetwork_fromJSON: (a: any) => [number, number, number];
    readonly statusnetwork_fromObject: (a: any) => [number, number, number];
    readonly statusnetwork_toJSON: (a: number) => [number, number, number];
    readonly statusnetwork_toObject: (a: number) => [number, number, number];
    readonly statusnode_fromJSON: (a: any) => [number, number, number];
    readonly statusnode_fromObject: (a: any) => [number, number, number];
    readonly statusnode_id: (a: number) => [number, number];
    readonly statusnode_pro_tx_hash: (a: number) => number;
    readonly statusnode_toJSON: (a: number) => [number, number, number];
    readonly statusnode_toObject: (a: number) => [number, number, number];
    readonly statusprotocol_fromJSON: (a: any) => [number, number, number];
    readonly statusprotocol_fromObject: (a: any) => [number, number, number];
    readonly statusprotocol_toJSON: (a: number) => [number, number, number];
    readonly statusprotocol_toObject: (a: number) => [number, number, number];
    readonly statusresponse_fromJSON: (a: any) => [number, number, number];
    readonly statusresponse_fromObject: (a: any) => [number, number, number];
    readonly statusresponse_toJSON: (a: number) => [number, number, number];
    readonly statusresponse_toObject: (a: number) => [number, number, number];
    readonly statussoftware_fromJSON: (a: any) => [number, number, number];
    readonly statussoftware_fromObject: (a: any) => [number, number, number];
    readonly statussoftware_toJSON: (a: number) => [number, number, number];
    readonly statussoftware_toObject: (a: number) => [number, number, number];
    readonly statusstatesync_fromJSON: (a: any) => [number, number, number];
    readonly statusstatesync_fromObject: (a: any) => [number, number, number];
    readonly statusstatesync_toJSON: (a: number) => [number, number, number];
    readonly statusstatesync_toObject: (a: number) => [number, number, number];
    readonly statustenderdashprotocol_fromJSON: (a: any) => [number, number, number];
    readonly statustenderdashprotocol_fromObject: (a: any) => [number, number, number];
    readonly statustenderdashprotocol_toJSON: (a: number) => [number, number, number];
    readonly statustenderdashprotocol_toObject: (a: number) => [number, number, number];
    readonly statustime_fromJSON: (a: any) => [number, number, number];
    readonly statustime_fromObject: (a: any) => [number, number, number];
    readonly statustime_toJSON: (a: number) => [number, number, number];
    readonly statustime_toObject: (a: number) => [number, number, number];
    readonly statusversion_fromJSON: (a: any) => [number, number, number];
    readonly statusversion_fromObject: (a: any) => [number, number, number];
    readonly statusversion_toJSON: (a: number) => [number, number, number];
    readonly statusversion_toObject: (a: number) => [number, number, number];
    readonly wasmsdk_documentCreate: (a: number, b: any) => any;
    readonly wasmsdk_documentDelete: (a: number, b: any) => any;
    readonly wasmsdk_documentPurchase: (a: number, b: any) => any;
    readonly wasmsdk_documentReplace: (a: number, b: any) => any;
    readonly wasmsdk_documentSetPrice: (a: number, b: any) => any;
    readonly wasmsdk_documentTransfer: (a: number, b: any) => any;
    readonly wasmsdk_getContestFundToJoin: (a: number, b: any) => any;
    readonly wasmsdk_getCurrentQuorumsInfo: (a: number) => any;
    readonly wasmsdk_getIdentitiesBalances: (a: number, b: any) => any;
    readonly wasmsdk_getIdentitiesBalancesWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentitiesContractKeys: (a: number, b: any) => any;
    readonly wasmsdk_getIdentitiesContractKeysWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentity: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityBalance: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityBalanceAndRevision: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityBalanceAndRevisionWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityBalanceWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityByNonUniquePublicKeyHash: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityByNonUniquePublicKeyHashWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityByPublicKeyHash: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityByPublicKeyHashWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityContractNonce: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityContractNonceWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityKeys: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityKeysRemainingBudgets: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityKeysRemainingBudgetsWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityKeysWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityNonce: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityNonceWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityTokenBalances: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityTokenBalancesWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityUnproved: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getPathElements: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getPathElementsWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getPrefundedSpecializedBalance: (a: number, b: any) => any;
    readonly wasmsdk_getPrefundedSpecializedBalanceWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getStatus: (a: number) => any;
    readonly wasmsdk_getTotalCreditsInPlatform: (a: number) => any;
    readonly wasmsdk_getTotalCreditsInPlatformWithProofInfo: (a: number) => any;
    readonly wasmsdk_waitForStateTransitionResult: (a: number, b: number, c: number) => any;
    readonly __wbg_set_statuschain_latest_block_height: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusnetwork_chain_id: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statussoftware_dapi: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_remaining_time: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statusstatesync_total_synced_time: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statustime_local: (a: number, b: number, c: number) => void;
    readonly __wbg_set_statustenderdashprotocol_block: (a: number, b: number) => void;
    readonly __wbg_set_statustenderdashprotocol_p2p: (a: number, b: number) => void;
    readonly __wbg_set_statustime_epoch: (a: number, b: number) => void;
    readonly __wbg_protocolversionupgradestate_free: (a: number, b: number) => void;
    readonly __wbg_protocolversionupgradevotestatus_free: (a: number, b: number) => void;
    readonly __wbg_wasmsdkerror_free: (a: number, b: number) => void;
    readonly protocolversionupgradestate_current_protocol_version: (a: number) => number;
    readonly protocolversionupgradestate_fromJSON: (a: any) => [number, number, number];
    readonly protocolversionupgradestate_fromObject: (a: any) => [number, number, number];
    readonly protocolversionupgradestate_next_protocol_version: (a: number) => number;
    readonly protocolversionupgradestate_toJSON: (a: number) => [number, number, number];
    readonly protocolversionupgradestate_toObject: (a: number) => [number, number, number];
    readonly protocolversionupgradestate_vote_count: (a: number) => [number, bigint];
    readonly protocolversionupgradevotestatus_pro_tx_hash: (a: number) => number;
    readonly protocolversionupgradevotestatus_version: (a: number) => number;
    readonly wasmsdk_getContestedResources: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourcesWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getProtocolVersionUpgradeState: (a: number) => any;
    readonly wasmsdk_getProtocolVersionUpgradeStateWithProofInfo: (a: number) => any;
    readonly wasmsdk_getProtocolVersionUpgradeVoteStatus: (a: number, b: any, c: number) => any;
    readonly wasmsdk_getProtocolVersionUpgradeVoteStatusWithProofInfo: (a: number, b: any, c: number) => any;
    readonly wasmsdkerror_code: (a: number) => number;
    readonly wasmsdkerror_is_retriable: (a: number) => number;
    readonly wasmsdkerror_kind: (a: number) => number;
    readonly wasmsdkerror_message: (a: number) => [number, number];
    readonly wasmsdkerror_name: (a: number) => [number, number];
    readonly wasmsdk_contractApproveTeamAction: (a: number, b: any) => any;
    readonly wasmsdk_contractBanUser: (a: number, b: any) => any;
    readonly wasmsdk_contractChangeDocumentFields: (a: number, b: any) => any;
    readonly wasmsdk_contractClaimFees: (a: number, b: any) => any;
    readonly wasmsdk_contractClearUserWarnings: (a: number, b: any) => any;
    readonly wasmsdk_contractDeleteDocument: (a: number, b: any) => any;
    readonly wasmsdk_contractDeleteSettledDocument: (a: number, b: any) => any;
    readonly wasmsdk_contractPublish: (a: number, b: any) => any;
    readonly wasmsdk_contractRestoreDocument: (a: number, b: any) => any;
    readonly wasmsdk_contractSuspendUser: (a: number, b: any) => any;
    readonly wasmsdk_contractUnbanUser: (a: number, b: any) => any;
    readonly wasmsdk_contractUnsuspendUser: (a: number, b: any) => any;
    readonly wasmsdk_contractUpdate: (a: number, b: any) => any;
    readonly wasmsdk_contractWarnUser: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsHaving: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsHavingWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsRanked: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsRankedWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_maxPrefixInBranches: () => number;
    readonly wasmsdk_maxRankedLimit: () => number;
    readonly wasmsdk_rankedAverageScale: () => any;
    readonly wasmsdk_getChainedDocuments: (a: number, b: any) => any;
    readonly wasmsdk_getChainedDocumentsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getCompositeDocuments: (a: number, b: any) => any;
    readonly wasmsdk_getCompositeDocumentsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceIdentityVotes: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceIdentityVotesWithProofInfo: (a: number, b: any) => any;
    readonly __wbg_contractgroupinfo_free: (a: number, b: number) => void;
    readonly __wbg_encryptedpropertyenvelope_free: (a: number, b: number) => void;
    readonly __wbg_get_keypair_address: (a: number) => [number, number];
    readonly __wbg_get_keypair_network: (a: number) => [number, number];
    readonly __wbg_get_keypair_privateKeyHex: (a: number) => [number, number];
    readonly __wbg_get_keypair_privateKeyWif: (a: number) => [number, number];
    readonly __wbg_get_keypair_publicKey: (a: number) => [number, number];
    readonly __wbg_get_tokenpriceinfo_basePrice: (a: number) => [number, number];
    readonly __wbg_get_tokenpriceinfo_currentPrice: (a: number) => [number, number];
    readonly __wbg_get_tokenpriceinfo_tokenId: (a: number) => number;
    readonly __wbg_keypair_free: (a: number, b: number) => void;
    readonly __wbg_rewarddistributionmoment_free: (a: number, b: number) => void;
    readonly __wbg_set_keypair_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_keypair_network: (a: number, b: number, c: number) => void;
    readonly __wbg_set_keypair_privateKeyHex: (a: number, b: number, c: number) => void;
    readonly __wbg_set_keypair_privateKeyWif: (a: number, b: number, c: number) => void;
    readonly __wbg_set_keypair_publicKey: (a: number, b: number, c: number) => void;
    readonly __wbg_set_tokenpriceinfo_tokenId: (a: number, b: number) => void;
    readonly __wbg_tokenpriceinfo_free: (a: number, b: number) => void;
    readonly __wbg_tokentotalsupply_free: (a: number, b: number) => void;
    readonly __wbg_wasmsdk_free: (a: number, b: number) => void;
    readonly __wbg_wasmsdkbuilder_free: (a: number, b: number) => void;
    readonly contractgroupinfo_admin_ids: (a: number) => any;
    readonly contractgroupinfo_description: (a: number) => [number, number];
    readonly contractgroupinfo_name: (a: number) => [number, number];
    readonly contractgroupinfo_owner_id: (a: number) => [number, number];
    readonly contractgroupinfo_toJSON: (a: number) => [number, number, number];
    readonly encryptedpropertyenvelope_recipient_id: (a: number) => number;
    readonly encryptedpropertyenvelope_recipient_key_id: (a: number) => number;
    readonly encryptedpropertyenvelope_sender_id: (a: number) => number;
    readonly encryptedpropertyenvelope_sender_key_id: (a: number) => number;
    readonly keypair_fromJSON: (a: any) => [number, number, number];
    readonly keypair_fromObject: (a: any) => [number, number, number];
    readonly keypair_toJSON: (a: number) => [number, number, number];
    readonly keypair_toObject: (a: number) => [number, number, number];
    readonly rewarddistributionmoment_block_height: (a: number) => [number, bigint];
    readonly rewarddistributionmoment_epoch_index: (a: number) => number;
    readonly rewarddistributionmoment_moment_type: (a: number) => [number, number];
    readonly rewarddistributionmoment_timestamp_ms: (a: number) => [number, bigint];
    readonly tokenpriceinfo_fromJSON: (a: any) => [number, number, number];
    readonly tokenpriceinfo_fromObject: (a: any) => [number, number, number];
    readonly tokenpriceinfo_toJSON: (a: number) => [number, number, number];
    readonly tokenpriceinfo_toObject: (a: number) => [number, number, number];
    readonly tokentotalsupply_fromJSON: (a: any) => [number, number, number];
    readonly tokentotalsupply_fromObject: (a: any) => [number, number, number];
    readonly tokentotalsupply_toJSON: (a: number) => [number, number, number];
    readonly tokentotalsupply_toObject: (a: number) => [number, number, number];
    readonly tokentotalsupply_total_supply: (a: number) => any;
    readonly wasmsdk_addKnownContract: (a: number, b: number) => number;
    readonly wasmsdk_broadcastAndWait: (a: number, b: number, c: number) => any;
    readonly wasmsdk_broadcastAndWaitForAffectedState: (a: number, b: number, c: number) => any;
    readonly wasmsdk_broadcastStateTransition: (a: number, b: number, c: number) => any;
    readonly wasmsdk_calculateTokenIdFromContract: (a: any, b: number) => [number, number, number, number];
    readonly wasmsdk_decryptDocumentProperty: (a: any) => [number, number, number, number];
    readonly wasmsdk_encryptDocumentProperty: (a: any) => [number, number, number];
    readonly wasmsdk_encryptedPropertyEnvelope: (a: any) => [number, number, number];
    readonly wasmsdk_generateKeyPair: (a: any) => [number, number, number];
    readonly wasmsdk_generateKeyPairs: (a: any, b: number) => [number, number, number, number];
    readonly wasmsdk_generateTestIdentityKeys: (a: bigint) => [number, number, number];
    readonly wasmsdk_getContractGroupInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractGroupInfoWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractGroupMembers: (a: number, b: any) => any;
    readonly wasmsdk_getContractGroupMembersWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractGroupsForContract: (a: number, b: any) => any;
    readonly wasmsdk_getContractGroupsForContractWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentitiesTokenBalances: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentitiesTokenBalancesWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentitiesTokenInfos: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentitiesTokenInfosWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityTokenInfos: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getIdentityTokenInfosWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getTokenContractInfo: (a: number, b: any) => any;
    readonly wasmsdk_getTokenContractInfoWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getTokenDirectPurchasePrices: (a: number, b: any) => any;
    readonly wasmsdk_getTokenDirectPurchasePricesWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getTokenPerpetualDistributionLastClaim: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getTokenPerpetualDistributionLastClaimWithProofInfo: (a: number, b: any, c: any) => any;
    readonly wasmsdk_getTokenPriceByContract: (a: number, b: any, c: number) => any;
    readonly wasmsdk_getTokenStatuses: (a: number, b: any) => any;
    readonly wasmsdk_getTokenStatusesWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getTokenTotalSupply: (a: number, b: any) => any;
    readonly wasmsdk_getTokenTotalSupplyWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_keyPairFromHex: (a: number, b: number, c: any) => [number, number, number];
    readonly wasmsdk_keyPairFromWif: (a: number, b: number) => [number, number, number];
    readonly wasmsdk_pubkeyToAddress: (a: number, b: number, c: any) => [number, number, number, number];
    readonly wasmsdk_refreshIdentityNonce: (a: number, b: number) => any;
    readonly wasmsdk_removeCachedContract: (a: number, b: number) => number;
    readonly wasmsdk_setLogLevel: (a: number, b: number) => [number, number];
    readonly wasmsdk_signMessage: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasmsdk_validateAddress: (a: number, b: number, c: any) => number;
    readonly wasmsdk_version: (a: number) => number;
    readonly wasmsdk_waitForAffectedState: (a: number, b: number, c: number) => any;
    readonly wasmsdk_waitForResponse: (a: number, b: number, c: number) => any;
    readonly wasmsdkbuilder_build: (a: number) => [number, number, number];
    readonly wasmsdkbuilder_getLatestVersionNumber: () => number;
    readonly wasmsdkbuilder_local: () => number;
    readonly wasmsdkbuilder_mainnet: () => number;
    readonly wasmsdkbuilder_newDevnet: () => number;
    readonly wasmsdkbuilder_testnet: () => number;
    readonly wasmsdkbuilder_withAddresses: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasmsdkbuilder_withContextProvider: (a: number, b: number) => number;
    readonly wasmsdkbuilder_withLogs: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmsdkbuilder_withProofs: (a: number, b: number) => number;
    readonly wasmsdkbuilder_withSettings: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly wasmsdkbuilder_withTrustedContext: (a: number, b: number) => number;
    readonly wasmsdkbuilder_withVersion: (a: number, b: number) => [number, number, number];
    readonly __wbg_set_tokenpriceinfo_basePrice: (a: number, b: number, c: number) => void;
    readonly __wbg_set_tokenpriceinfo_currentPrice: (a: number, b: number, c: number) => void;
    readonly wasmsdk_getContractFeePots: (a: number, b: any) => any;
    readonly wasmsdk_getContractFeePotsWithProofInfo: (a: number, b: any) => any;
    readonly __wbg_contestedresourcecontender_free: (a: number, b: number) => void;
    readonly __wbg_contestedresourcevotestate_free: (a: number, b: number) => void;
    readonly __wbg_contestedresourcevotewinner_free: (a: number, b: number) => void;
    readonly __wbg_get_contestedresourcecontender_contender: (a: number) => number;
    readonly __wbg_get_contestedresourcevotestate_abstainVoteTally: (a: number) => number;
    readonly __wbg_get_contestedresourcevotestate_contenders: (a: number) => any;
    readonly __wbg_get_contestedresourcevotestate_lockVoteTally: (a: number) => number;
    readonly __wbg_get_contestedresourcevotestate_winner: (a: number) => number;
    readonly __wbg_get_contestedresourcevotewinner_block: (a: number) => number;
    readonly __wbg_get_contestedresourcevotewinner_info: (a: number) => number;
    readonly __wbg_identitycreatefromaddressesresult_free: (a: number, b: number) => void;
    readonly __wbg_identitytopupfromaddressesresult_free: (a: number, b: number) => void;
    readonly __wbg_identitytransfertoaddressesresult_free: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcecontender_contender: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcevotestate_abstainVoteTally: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcevotestate_contenders: (a: number, b: any) => void;
    readonly __wbg_set_contestedresourcevotestate_lockVoteTally: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcevotestate_winner: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcevotewinner_block: (a: number, b: number) => void;
    readonly __wbg_set_contestedresourcevotewinner_info: (a: number, b: number) => void;
    readonly __wbg_wasmcontext_free: (a: number, b: number) => void;
    readonly __wbg_wasmtrustedcontext_free: (a: number, b: number) => void;
    readonly contestedresourcecontender_identity_id: (a: number) => number;
    readonly contestedresourcecontender_serialized_document: (a: number) => any;
    readonly contestedresourcecontender_vote_tally: (a: number) => number;
    readonly contestedresourcevotewinner_identity_id: (a: number) => number;
    readonly contestedresourcevotewinner_kind: (a: number) => [number, number];
    readonly identitycreatefromaddressesresult_address_infos: (a: number) => any;
    readonly identitycreatefromaddressesresult_identity: (a: number) => number;
    readonly identitytopupfromaddressesresult_address_infos: (a: number) => any;
    readonly identitytopupfromaddressesresult_new_balance: (a: number) => any;
    readonly identitytransfertoaddressesresult_address_infos: (a: number) => any;
    readonly identitytransfertoaddressesresult_new_balance: (a: number) => any;
    readonly start: () => void;
    readonly wasmsdk_addressFundingFromAssetLock: (a: number, b: any) => any;
    readonly wasmsdk_addressFundsTransfer: (a: number, b: any) => any;
    readonly wasmsdk_addressFundsWithdraw: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceVoteState: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceVoteStateWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceVotersForIdentity: (a: number, b: any) => any;
    readonly wasmsdk_getContestedResourceVotersForIdentityWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_identityCreateFromAddresses: (a: number, b: any) => any;
    readonly wasmsdk_identityTopUpFromAddresses: (a: number, b: any) => any;
    readonly wasmsdk_identityTransferToAddresses: (a: number, b: any) => any;
    readonly wasmtrustedcontext_prefetchDevnet: (a: number, b: number, c: number) => any;
    readonly wasmtrustedcontext_prefetchDevnetWithUrl: (a: number, b: number, c: number) => any;
    readonly wasmtrustedcontext_prefetchLocal: (a: number) => any;
    readonly wasmtrustedcontext_prefetchLocalWithUrl: (a: number, b: number, c: number) => any;
    readonly wasmtrustedcontext_prefetchMainnet: (a: number) => any;
    readonly wasmtrustedcontext_prefetchMainnetWithUrl: (a: number, b: number, c: number) => any;
    readonly wasmtrustedcontext_prefetchTestnet: (a: number) => any;
    readonly wasmtrustedcontext_prefetchTestnetWithUrl: (a: number, b: number, c: number) => any;
    readonly wasmsdk_getDocument: (a: number, b: any, c: number, d: number, e: any) => any;
    readonly wasmsdk_getDocumentHistory: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentHistoryWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentWithProofInfo: (a: number, b: any, c: number, d: number, e: any) => any;
    readonly wasmsdk_getDocuments: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsAverage: (a: number, b: any, c: number, d: number) => any;
    readonly wasmsdk_getDocumentsAverageWithProofInfo: (a: number, b: any, c: number, d: number) => any;
    readonly wasmsdk_getDocumentsCount: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsCountWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getDocumentsSum: (a: number, b: any, c: number, d: number) => any;
    readonly wasmsdk_getDocumentsSumWithProofInfo: (a: number, b: any, c: number, d: number) => any;
    readonly wasmsdk_getDocumentsWithProofInfo: (a: number, b: any) => any;
    readonly __wbg_dashpaycontactkeyinfo_free: (a: number, b: number) => void;
    readonly __wbg_derivationpathinfo_free: (a: number, b: number) => void;
    readonly __wbg_derivedkeyinfo_free: (a: number, b: number) => void;
    readonly __wbg_dip13derivationpathinfo_free: (a: number, b: number) => void;
    readonly __wbg_get_dashpaycontactkeyinfo_account: (a: number) => number;
    readonly __wbg_get_dashpaycontactkeyinfo_address: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_addressIndex: (a: number) => number;
    readonly __wbg_get_dashpaycontactkeyinfo_dipStandard: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_network: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_path: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_privateKeyHex: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_privateKeyWif: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_publicKey: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_purpose: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_receiverIdentity: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_senderIdentity: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_xprv: (a: number) => [number, number];
    readonly __wbg_get_dashpaycontactkeyinfo_xpub: (a: number) => [number, number];
    readonly __wbg_get_derivationpathinfo_account: (a: number) => number;
    readonly __wbg_get_derivationpathinfo_change: (a: number) => number;
    readonly __wbg_get_derivationpathinfo_coinType: (a: number) => number;
    readonly __wbg_get_derivationpathinfo_index: (a: number) => number;
    readonly __wbg_get_derivationpathinfo_purpose: (a: number) => number;
    readonly __wbg_get_dip13derivationpathinfo_account: (a: number) => number;
    readonly __wbg_get_identitygroupinfo_dataContractId: (a: number) => [number, number];
    readonly __wbg_get_identitygroupinfo_role: (a: number) => [number, number];
    readonly __wbg_identitygroupinfo_free: (a: number, b: number) => void;
    readonly __wbg_moderationteam_free: (a: number, b: number) => void;
    readonly __wbg_pathderivedkeyinfo_free: (a: number, b: number) => void;
    readonly __wbg_platformaddressinfo_free: (a: number, b: number) => void;
    readonly __wbg_seedphrasekeyinfo_free: (a: number, b: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_account: (a: number, b: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_addressIndex: (a: number, b: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_dipStandard: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_network: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_path: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_privateKeyHex: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_privateKeyWif: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_publicKey: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_purpose: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_receiverIdentity: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_senderIdentity: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_xprv: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dashpaycontactkeyinfo_xpub: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivationpathinfo_account: (a: number, b: number) => void;
    readonly __wbg_set_derivationpathinfo_change: (a: number, b: number) => void;
    readonly __wbg_set_derivationpathinfo_coinType: (a: number, b: number) => void;
    readonly __wbg_set_derivationpathinfo_index: (a: number, b: number) => void;
    readonly __wbg_set_derivationpathinfo_purpose: (a: number, b: number) => void;
    readonly __wbg_set_dip13derivationpathinfo_account: (a: number, b: number) => void;
    readonly __wbg_set_identitygroupinfo_dataContractId: (a: number, b: number, c: number) => void;
    readonly __wbg_set_identitygroupinfo_role: (a: number, b: number, c: number) => void;
    readonly __wbg_shieldedencryptednote_free: (a: number, b: number) => void;
    readonly __wbg_shieldednullifierstatus_free: (a: number, b: number) => void;
    readonly dashpaycontactkeyinfo_fromJSON: (a: any) => [number, number, number];
    readonly dashpaycontactkeyinfo_fromObject: (a: any) => [number, number, number];
    readonly dashpaycontactkeyinfo_toJSON: (a: number) => [number, number, number];
    readonly dashpaycontactkeyinfo_toObject: (a: number) => [number, number, number];
    readonly derivationpathinfo_fromJSON: (a: any) => [number, number, number];
    readonly derivationpathinfo_fromObject: (a: any) => [number, number, number];
    readonly derivationpathinfo_toJSON: (a: number) => [number, number, number];
    readonly derivationpathinfo_toObject: (a: number) => [number, number, number];
    readonly derivedkeyinfo_fromJSON: (a: any) => [number, number, number];
    readonly derivedkeyinfo_fromObject: (a: any) => [number, number, number];
    readonly derivedkeyinfo_toJSON: (a: number) => [number, number, number];
    readonly derivedkeyinfo_toObject: (a: number) => [number, number, number];
    readonly dip13derivationpathinfo_fromJSON: (a: any) => [number, number, number];
    readonly dip13derivationpathinfo_fromObject: (a: any) => [number, number, number];
    readonly dip13derivationpathinfo_toJSON: (a: number) => [number, number, number];
    readonly dip13derivationpathinfo_toObject: (a: number) => [number, number, number];
    readonly documentCreateCost: (a: number, b: number, c: number, d: any, e: any) => [number, number, number];
    readonly identitygroupinfo_power: (a: number) => any;
    readonly moderationteam_contains: (a: number, b: any) => [number, number, number];
    readonly moderationteam_elected_charter_id: (a: number) => number;
    readonly moderationteam_elected_members: (a: number) => any;
    readonly moderationteam_leader_id: (a: number) => number;
    readonly moderationteam_members: (a: number) => any;
    readonly moderationteam_seats: (a: number, b: number) => [number, number, number];
    readonly moderationteam_submitted_charter_id: (a: number) => number;
    readonly pathderivedkeyinfo_fromJSON: (a: any) => [number, number, number];
    readonly pathderivedkeyinfo_fromObject: (a: any) => [number, number, number];
    readonly pathderivedkeyinfo_toJSON: (a: number) => [number, number, number];
    readonly pathderivedkeyinfo_toObject: (a: number) => [number, number, number];
    readonly platformaddressinfo_address: (a: number) => number;
    readonly platformaddressinfo_balance: (a: number) => any;
    readonly platformaddressinfo_fromJSON: (a: any) => [number, number, number];
    readonly platformaddressinfo_fromObject: (a: any) => [number, number, number];
    readonly platformaddressinfo_nonce: (a: number) => any;
    readonly platformaddressinfo_toJSON: (a: number) => [number, number, number];
    readonly platformaddressinfo_toObject: (a: number) => [number, number, number];
    readonly seedphrasekeyinfo_fromJSON: (a: any) => [number, number, number];
    readonly seedphrasekeyinfo_fromObject: (a: any) => [number, number, number];
    readonly seedphrasekeyinfo_toJSON: (a: number) => [number, number, number];
    readonly seedphrasekeyinfo_toObject: (a: number) => [number, number, number];
    readonly shieldedencryptednote_cmx: (a: number) => any;
    readonly shieldedencryptednote_cv_net: (a: number) => any;
    readonly shieldedencryptednote_encrypted_note: (a: number) => any;
    readonly shieldedencryptednote_fromJSON: (a: any) => [number, number, number];
    readonly shieldedencryptednote_fromObject: (a: any) => [number, number, number];
    readonly shieldedencryptednote_nullifier: (a: number) => any;
    readonly shieldedencryptednote_toJSON: (a: number) => [number, number, number];
    readonly shieldedencryptednote_toObject: (a: number) => [number, number, number];
    readonly shieldednullifierstatus_fromJSON: (a: any) => [number, number, number];
    readonly shieldednullifierstatus_fromObject: (a: any) => [number, number, number];
    readonly shieldednullifierstatus_is_spent: (a: number) => number;
    readonly shieldednullifierstatus_nullifier: (a: number) => any;
    readonly shieldednullifierstatus_toJSON: (a: number) => [number, number, number];
    readonly shieldednullifierstatus_toObject: (a: number) => [number, number, number];
    readonly wasmsdk_buildModerationJoinRequest: (a: number, b: any) => any;
    readonly wasmsdk_buildModerationResignationRequest: (a: number, b: any) => any;
    readonly wasmsdk_derivationPathBip44Mainnet: (a: number, b: number, c: number) => number;
    readonly wasmsdk_derivationPathBip44Testnet: (a: number, b: number, c: number) => number;
    readonly wasmsdk_derivationPathDip13Mainnet: (a: number) => number;
    readonly wasmsdk_derivationPathDip13Testnet: (a: number) => number;
    readonly wasmsdk_derivationPathDip9Mainnet: (a: number, b: number, c: number) => number;
    readonly wasmsdk_derivationPathDip9Testnet: (a: number, b: number, c: number) => number;
    readonly wasmsdk_deriveChildPublicKey: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasmsdk_deriveDashpayContactKey: (a: any) => [number, number, number];
    readonly wasmsdk_deriveKeyFromSeedPhrase: (a: any) => [number, number, number];
    readonly wasmsdk_deriveKeyFromSeedWithExtendedPath: (a: any) => [number, number, number];
    readonly wasmsdk_deriveKeyFromSeedWithPath: (a: any) => [number, number, number];
    readonly wasmsdk_generateMnemonic: (a: number) => [number, number, number, number];
    readonly wasmsdk_getAddressInfo: (a: number, b: any) => any;
    readonly wasmsdk_getAddressInfoWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getAddressesInfos: (a: number, b: any) => any;
    readonly wasmsdk_getAddressesInfosWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractDocumentRemovals: (a: number, b: any) => any;
    readonly wasmsdk_getContractDocumentRemovalsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationActionCounts: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationActionCountsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationEntries: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationEntriesWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationStatus: (a: number, b: any) => any;
    readonly wasmsdk_getContractModerationStatusWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractTeamActionSigners: (a: number, b: any) => any;
    readonly wasmsdk_getContractTeamActionSignersWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getContractTeamActions: (a: number, b: any) => any;
    readonly wasmsdk_getContractTeamActionsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getGroupActionSigners: (a: number, b: any) => any;
    readonly wasmsdk_getGroupActionSignersWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getGroupActions: (a: number, b: any) => any;
    readonly wasmsdk_getGroupActionsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getGroupInfo: (a: number, b: any, c: number) => any;
    readonly wasmsdk_getGroupInfoWithProofInfo: (a: number, b: any, c: number) => any;
    readonly wasmsdk_getGroupInfos: (a: number, b: any) => any;
    readonly wasmsdk_getGroupInfosWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getGroupMembers: (a: number, b: any) => any;
    readonly wasmsdk_getGroupMembersWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getGroupsDataContracts: (a: number, b: any) => any;
    readonly wasmsdk_getGroupsDataContractsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityGroups: (a: number, b: any) => any;
    readonly wasmsdk_getIdentityGroupsWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getModerationJoinRequests: (a: number, b: any) => any;
    readonly wasmsdk_getModerationPendingResignationRequests: (a: number, b: any) => any;
    readonly wasmsdk_getModerationSeatedCharter: (a: number, b: any) => any;
    readonly wasmsdk_getModerationSubmittedCharter: (a: number, b: any) => any;
    readonly wasmsdk_getModerationSubmittedCharters: (a: number, b: any) => any;
    readonly wasmsdk_getModerationTeam: (a: number, b: any) => any;
    readonly wasmsdk_getMostRecentShieldedAnchor: (a: number) => any;
    readonly wasmsdk_getMostRecentShieldedAnchorWithProofInfo: (a: number) => any;
    readonly wasmsdk_getShieldedAnchors: (a: number) => any;
    readonly wasmsdk_getShieldedAnchorsWithProofInfo: (a: number) => any;
    readonly wasmsdk_getShieldedEncryptedNotes: (a: number, b: bigint, c: number) => any;
    readonly wasmsdk_getShieldedEncryptedNotesWithProofInfo: (a: number, b: bigint, c: number) => any;
    readonly wasmsdk_getShieldedNullifiers: (a: number, b: any) => any;
    readonly wasmsdk_getShieldedNullifiersWithProofInfo: (a: number, b: any) => any;
    readonly wasmsdk_getShieldedPoolState: (a: number) => any;
    readonly wasmsdk_getShieldedPoolStateWithProofInfo: (a: number) => any;
    readonly wasmsdk_mnemonicToSeed: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasmsdk_validateMnemonic: (a: number, b: number, c: number, d: number) => number;
    readonly wasmsdk_xprvToXpub: (a: number, b: number) => [number, number, number, number];
    readonly __wbg_set_derivationpathinfo_path: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_network: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_path: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_privateKeyHex: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_privateKeyWif: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_publicKey: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_xprv: (a: number, b: number, c: number) => void;
    readonly __wbg_set_derivedkeyinfo_xpub: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dip13derivationpathinfo_description: (a: number, b: number, c: number) => void;
    readonly __wbg_set_dip13derivationpathinfo_path: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_network: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_path: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_privateKeyHex: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_privateKeyWif: (a: number, b: number, c: number) => void;
    readonly __wbg_set_pathderivedkeyinfo_publicKey: (a: number, b: number, c: number) => void;
    readonly __wbg_set_seedphrasekeyinfo_address: (a: number, b: number, c: number) => void;
    readonly __wbg_set_seedphrasekeyinfo_network: (a: number, b: number, c: number) => void;
    readonly __wbg_set_seedphrasekeyinfo_privateKeyHex: (a: number, b: number, c: number) => void;
    readonly __wbg_set_seedphrasekeyinfo_privateKeyWif: (a: number, b: number, c: number) => void;
    readonly __wbg_set_seedphrasekeyinfo_publicKey: (a: number, b: number, c: number) => void;
    readonly __wbg_get_derivationpathinfo_path: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_address: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_network: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_path: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_privateKeyHex: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_privateKeyWif: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_publicKey: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_xprv: (a: number) => [number, number];
    readonly __wbg_get_derivedkeyinfo_xpub: (a: number) => [number, number];
    readonly __wbg_get_dip13derivationpathinfo_description: (a: number) => [number, number];
    readonly __wbg_get_dip13derivationpathinfo_path: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_address: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_network: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_path: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_privateKeyHex: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_privateKeyWif: (a: number) => [number, number];
    readonly __wbg_get_pathderivedkeyinfo_publicKey: (a: number) => [number, number];
    readonly __wbg_get_seedphrasekeyinfo_address: (a: number) => [number, number];
    readonly __wbg_get_seedphrasekeyinfo_network: (a: number) => [number, number];
    readonly __wbg_get_seedphrasekeyinfo_privateKeyHex: (a: number) => [number, number];
    readonly __wbg_get_seedphrasekeyinfo_privateKeyWif: (a: number) => [number, number];
    readonly __wbg_get_seedphrasekeyinfo_publicKey: (a: number) => [number, number];
    readonly __wbg_set_dip13derivationpathinfo_coinType: (a: number, b: number) => void;
    readonly __wbg_set_dip13derivationpathinfo_purpose: (a: number, b: number) => void;
    readonly __wbg_set_identitygroupinfo_groupContractPosition: (a: number, b: number) => void;
    readonly __wbg_get_dip13derivationpathinfo_coinType: (a: number) => number;
    readonly __wbg_get_dip13derivationpathinfo_purpose: (a: number) => number;
    readonly __wbg_get_identitygroupinfo_groupContractPosition: (a: number) => number;
    readonly __wbg_contesteddocumentvotepollwinnerinfo_free: (a: number, b: number) => void;
    readonly __wbg_document_free: (a: number, b: number) => void;
    readonly __wbg_documentactionfeeagreement_free: (a: number, b: number) => void;
    readonly __wbg_get_verifiedtokenactionwithdocument_document: (a: number) => number;
    readonly __wbg_get_verifiedtokenbalance_tokenId: (a: number) => number;
    readonly __wbg_get_verifiedtokenbalanceabsence_tokenId: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithdocument_document: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithdocument_groupPower: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithshieldedpoolbalance_actionStatus: (a: number) => [number, number];
    readonly __wbg_get_verifiedtokengroupactionwithshieldedpoolbalance_groupPower: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithtokenidentityinfo_actionStatus: (a: number) => [number, number];
    readonly __wbg_get_verifiedtokengroupactionwithtokenidentityinfo_groupPower: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithtokenidentityinfo_tokenInfo: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithtokenpricingschedule_pricingSchedule: (a: number) => number;
    readonly __wbg_get_verifiedtokenidentityinfo_tokenId: (a: number) => number;
    readonly __wbg_get_verifiedtokenidentityinfo_tokenInfo: (a: number) => number;
    readonly __wbg_get_verifiedtokenpricingschedule_tokenId: (a: number) => number;
    readonly __wbg_get_verifiedtokenstatus_tokenStatus: (a: number) => number;
    readonly __wbg_set_verifiedtokenactionwithdocument_document: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenbalance_tokenId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenbalanceabsence_tokenId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithdocument_document: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithdocument_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithshieldedpoolbalance_actionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithshieldedpoolbalance_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenidentityinfo_actionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenidentityinfo_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenidentityinfo_tokenInfo: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenpricingschedule_pricingSchedule: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenidentityinfo_tokenId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenidentityinfo_tokenInfo: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenpricingschedule_tokenId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenstatus_tokenStatus: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenactionwithdocument_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenbalance_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenbalanceabsence_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithdocument_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithshieldedpoolbalance_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithtokenbalance_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithtokenidentityinfo_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithtokenpricingschedule_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenidentitiesbalances_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenidentityinfo_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenpricingschedule_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenshieldedpoolbalance_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokenstatus_free: (a: number, b: number) => void;
    readonly computePlatformSighash: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_constructor: (a: number, b: number, c: number) => [number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_fromJSON: (a: any) => [number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_fromObject: (a: any) => [number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_identity_id: (a: number) => number;
    readonly contesteddocumentvotepollwinnerinfo_is_locked: (a: number) => number;
    readonly contesteddocumentvotepollwinnerinfo_is_no_winner: (a: number) => number;
    readonly contesteddocumentvotepollwinnerinfo_is_won_by_identity: (a: number) => number;
    readonly contesteddocumentvotepollwinnerinfo_kind: (a: number) => [number, number];
    readonly contesteddocumentvotepollwinnerinfo_struct_name: () => [number, number];
    readonly contesteddocumentvotepollwinnerinfo_toJSON: (a: number) => [number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_toObject: (a: number) => [number, number, number];
    readonly contesteddocumentvotepollwinnerinfo_type_name: (a: number) => [number, number];
    readonly document_constructor: (a: any) => [number, number, number];
    readonly document_created_at: (a: number) => [number, bigint];
    readonly document_created_at_block_height: (a: number) => [number, bigint];
    readonly document_created_at_core_block_height: (a: number) => number;
    readonly document_data_contract_id: (a: number) => number;
    readonly document_document_type_name: (a: number) => [number, number];
    readonly document_entropy: (a: number) => [number, number];
    readonly document_fromBase64: (a: number, b: number, c: number, d: number, e: number, f: any) => [number, number, number];
    readonly document_fromBytes: (a: number, b: number, c: number, d: number, e: number, f: any) => [number, number, number];
    readonly document_fromHex: (a: number, b: number, c: number, d: number, e: number, f: any) => [number, number, number];
    readonly document_fromJSON: (a: any, b: any) => [number, number, number];
    readonly document_fromObject: (a: any, b: any) => [number, number, number];
    readonly document_generateId: (a: number, b: number, c: any, d: any, e: number, f: number, g: number, h: bigint, i: number) => [number, number, number, number];
    readonly document_id: (a: number) => number;
    readonly document_moderated_at: (a: number) => [number, bigint];
    readonly document_moderated_by: (a: number) => number;
    readonly document_owner_id: (a: number) => number;
    readonly document_properties: (a: number) => [number, number, number];
    readonly document_revision: (a: number) => [number, bigint];
    readonly document_setIdForCreation: (a: number, b: bigint, c: number) => [number, number];
    readonly document_set_created_at: (a: number, b: number, c: bigint) => void;
    readonly document_set_created_at_block_height: (a: number, b: number, c: bigint) => void;
    readonly document_set_created_at_core_block_height: (a: number, b: number) => void;
    readonly document_set_data_contract_id_js: (a: number, b: any) => [number, number];
    readonly document_set_document_type_name: (a: number, b: number, c: number) => void;
    readonly document_set_entropy: (a: number, b: number, c: number) => [number, number];
    readonly document_set_id: (a: number, b: any) => [number, number];
    readonly document_set_owner_id: (a: number, b: any) => [number, number];
    readonly document_set_properties: (a: number, b: any) => [number, number];
    readonly document_set_revision: (a: number, b: number, c: bigint) => void;
    readonly document_set_transferred_at: (a: number, b: number, c: bigint) => void;
    readonly document_set_transferred_at_block_height: (a: number, b: number, c: bigint) => void;
    readonly document_set_transferred_at_core_block_height: (a: number, b: number) => void;
    readonly document_set_updated_at: (a: number, b: number, c: bigint) => void;
    readonly document_set_updated_at_block_height: (a: number, b: number, c: bigint) => void;
    readonly document_set_updated_at_core_block_height: (a: number, b: number) => void;
    readonly document_struct_name: () => [number, number];
    readonly document_toBase64: (a: number, b: number, c: any) => [number, number, number, number];
    readonly document_toBytes: (a: number, b: number, c: any) => [number, number, number, number];
    readonly document_toHex: (a: number, b: number, c: any) => [number, number, number, number];
    readonly document_toJSON: (a: number, b: any) => [number, number, number];
    readonly document_toObject: (a: number) => [number, number, number];
    readonly document_transferred_at: (a: number) => [number, bigint];
    readonly document_transferred_at_block_height: (a: number) => [number, bigint];
    readonly document_transferred_at_core_block_height: (a: number) => number;
    readonly document_type_name: (a: number) => [number, number];
    readonly document_updated_at: (a: number) => [number, bigint];
    readonly document_updated_at_block_height: (a: number) => [number, bigint];
    readonly document_updated_at_core_block_height: (a: number) => number;
    readonly documentactionfeeagreement_constructor: (a: any) => [number, number, number];
    readonly documentactionfeeagreement_fee_multiplier_increase_tolerance_percent: (a: number) => number;
    readonly documentactionfeeagreement_forDocumentTypeAction: (a: number, b: number, c: number, d: any, e: number) => [number, number, number];
    readonly documentactionfeeagreement_fromJSON: (a: any) => [number, number, number];
    readonly documentactionfeeagreement_fromObject: (a: any) => [number, number, number];
    readonly documentactionfeeagreement_known_fee_multiplier_permille: (a: number) => [number, bigint];
    readonly documentactionfeeagreement_moderators: (a: number) => bigint;
    readonly documentactionfeeagreement_owner: (a: number) => bigint;
    readonly documentactionfeeagreement_pricing: (a: number) => [number, number];
    readonly documentactionfeeagreement_struct_name: () => [number, number];
    readonly documentactionfeeagreement_toJSON: (a: number) => [number, number, number];
    readonly documentactionfeeagreement_toObject: (a: number) => [number, number, number];
    readonly documentactionfeeagreement_type_name: (a: number) => [number, number];
    readonly verifiedtokenactionwithdocument_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenactionwithdocument_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenactionwithdocument_struct_name: () => [number, number];
    readonly verifiedtokenactionwithdocument_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenactionwithdocument_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenactionwithdocument_type_name: (a: number) => [number, number];
    readonly verifiedtokenbalance_balance: (a: number) => any;
    readonly verifiedtokenbalance_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenbalance_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenbalance_struct_name: () => [number, number];
    readonly verifiedtokenbalance_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenbalance_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenbalance_type_name: (a: number) => [number, number];
    readonly verifiedtokenbalanceabsence_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenbalanceabsence_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenbalanceabsence_struct_name: () => [number, number];
    readonly verifiedtokenbalanceabsence_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenbalanceabsence_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenbalanceabsence_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithdocument_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithdocument_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithdocument_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithdocument_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithdocument_toObject: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithdocument_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_balance: (a: number) => any;
    readonly verifiedtokengroupactionwithshieldedpoolbalance_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_toObject: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldedpoolbalance_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithtokenbalance_balance: (a: number) => any;
    readonly verifiedtokengroupactionwithtokenbalance_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenbalance_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenbalance_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithtokenbalance_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenbalance_toObject: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenbalance_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_toObject: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenidentityinfo_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_toObject: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithtokenpricingschedule_type_name: (a: number) => [number, number];
    readonly verifiedtokenidentitiesbalances_balances: (a: number) => any;
    readonly verifiedtokenidentitiesbalances_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenidentitiesbalances_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenidentitiesbalances_struct_name: () => [number, number];
    readonly verifiedtokenidentitiesbalances_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenidentitiesbalances_toObject: (a: number) => any;
    readonly verifiedtokenidentitiesbalances_type_name: (a: number) => [number, number];
    readonly verifiedtokenidentityinfo_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenidentityinfo_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenidentityinfo_struct_name: () => [number, number];
    readonly verifiedtokenidentityinfo_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenidentityinfo_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenidentityinfo_type_name: (a: number) => [number, number];
    readonly verifiedtokenpricingschedule_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenpricingschedule_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenpricingschedule_struct_name: () => [number, number];
    readonly verifiedtokenpricingschedule_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenpricingschedule_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenpricingschedule_type_name: (a: number) => [number, number];
    readonly verifiedtokenshieldedpoolbalance_balance: (a: number) => any;
    readonly verifiedtokenshieldedpoolbalance_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenshieldedpoolbalance_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenshieldedpoolbalance_struct_name: () => [number, number];
    readonly verifiedtokenshieldedpoolbalance_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenshieldedpoolbalance_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenshieldedpoolbalance_type_name: (a: number) => [number, number];
    readonly verifiedtokenstatus_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokenstatus_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokenstatus_struct_name: () => [number, number];
    readonly verifiedtokenstatus_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokenstatus_toObject: (a: number) => [number, number, number];
    readonly verifiedtokenstatus_type_name: (a: number) => [number, number];
    readonly __wbg_get_verifiedtokenpricingschedule_pricingSchedule: (a: number) => number;
    readonly __wbg_get_verifiedtokenshieldedpoolbalance_tokenId: (a: number) => number;
    readonly __wbg_set_verifiedtokengroupactionwithtokenbalance_actionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenpricingschedule_actionStatus: (a: number, b: number, c: number) => void;
    readonly __wbg_get_verifiedtokengroupactionwithtokenbalance_actionStatus: (a: number) => [number, number];
    readonly __wbg_get_verifiedtokengroupactionwithtokenpricingschedule_actionStatus: (a: number) => [number, number];
    readonly __wbg_set_verifiedtokenshieldedpoolbalance_tokenId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokenpricingschedule_pricingSchedule: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenbalance_groupPower: (a: number, b: number) => void;
    readonly __wbg_set_verifiedtokengroupactionwithtokenpricingschedule_groupPower: (a: number, b: number) => void;
    readonly __wbg_get_verifiedtokengroupactionwithtokenbalance_groupPower: (a: number) => number;
    readonly __wbg_get_verifiedtokengroupactionwithtokenpricingschedule_groupPower: (a: number) => number;
    readonly contesteddocumentvotepollwinnerinfo_module_brand: () => any;
    readonly document_module_brand: () => any;
    readonly documentactionfeeagreement_module_brand: () => any;
    readonly verifiedtokenactionwithdocument_module_brand: () => any;
    readonly verifiedtokenbalance_module_brand: () => any;
    readonly verifiedtokenbalanceabsence_module_brand: () => any;
    readonly verifiedtokengroupactionwithdocument_module_brand: () => any;
    readonly verifiedtokengroupactionwithshieldedpoolbalance_module_brand: () => any;
    readonly verifiedtokengroupactionwithtokenbalance_module_brand: () => any;
    readonly verifiedtokengroupactionwithtokenidentityinfo_module_brand: () => any;
    readonly verifiedtokengroupactionwithtokenpricingschedule_module_brand: () => any;
    readonly verifiedtokenidentitiesbalances_module_brand: () => any;
    readonly verifiedtokenidentityinfo_module_brand: () => any;
    readonly verifiedtokenpricingschedule_module_brand: () => any;
    readonly verifiedtokenshieldedpoolbalance_module_brand: () => any;
    readonly verifiedtokenstatus_module_brand: () => any;
    readonly __wbg_documentbasetransition_free: (a: number, b: number) => void;
    readonly __wbg_groupstatetransitioninfo_free: (a: number, b: number) => void;
    readonly __wbg_groupstatetransitioninfostatus_free: (a: number, b: number) => void;
    readonly __wbg_identitycreatefromshieldedpooltransition_free: (a: number, b: number) => void;
    readonly __wbg_identitypublickeyincreation_free: (a: number, b: number) => void;
    readonly __wbg_partialidentity_free: (a: number, b: number) => void;
    readonly __wbg_privateencryptednote_free: (a: number, b: number) => void;
    readonly __wbg_shieldedtransfertransition_free: (a: number, b: number) => void;
    readonly __wbg_shieldtransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenbasetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenburnfrompooltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenconfigurationconvention_free: (a: number, b: number) => void;
    readonly __wbg_tokenkeepshistoryrules_free: (a: number, b: number) => void;
    readonly __wbg_tokenstatus_free: (a: number, b: number) => void;
    readonly documentbasetransition_action_fee_agreement: (a: number) => number;
    readonly documentbasetransition_constructor: (a: any) => [number, number, number];
    readonly documentbasetransition_data_contract_id: (a: number) => number;
    readonly documentbasetransition_document_type_name: (a: number) => [number, number];
    readonly documentbasetransition_id: (a: number) => number;
    readonly documentbasetransition_identity_contract_nonce: (a: number) => bigint;
    readonly documentbasetransition_set_action_fee_agreement: (a: number, b: number) => void;
    readonly documentbasetransition_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly documentbasetransition_set_document_type_name: (a: number, b: number, c: number) => void;
    readonly documentbasetransition_set_id: (a: number, b: any) => [number, number];
    readonly documentbasetransition_set_identity_contract_nonce: (a: number, b: any) => [number, number];
    readonly documentbasetransition_set_token_payment_info: (a: number, b: number) => void;
    readonly documentbasetransition_struct_name: () => [number, number];
    readonly documentbasetransition_token_payment_info: (a: number) => number;
    readonly documentbasetransition_type_name: (a: number) => [number, number];
    readonly groupstatetransitioninfo_action_id: (a: number) => number;
    readonly groupstatetransitioninfo_constructor: (a: any) => [number, number, number];
    readonly groupstatetransitioninfo_group_contract_position: (a: number) => number;
    readonly groupstatetransitioninfo_is_action_proposer: (a: number) => number;
    readonly groupstatetransitioninfo_set_action_id: (a: number, b: any) => [number, number];
    readonly groupstatetransitioninfo_set_group_contract_position: (a: number, b: number) => void;
    readonly groupstatetransitioninfo_set_is_action_proposer: (a: number, b: number) => void;
    readonly groupstatetransitioninfo_struct_name: () => [number, number];
    readonly groupstatetransitioninfo_type_name: (a: number) => [number, number];
    readonly groupstatetransitioninfostatus_action_id: (a: number) => number;
    readonly groupstatetransitioninfostatus_group_contract_position: (a: number) => number;
    readonly groupstatetransitioninfostatus_is_proposer: (a: number) => number;
    readonly groupstatetransitioninfostatus_otherSigner: (a: number, b: any) => [number, number, number];
    readonly groupstatetransitioninfostatus_proposer: (a: number) => number;
    readonly groupstatetransitioninfostatus_struct_name: () => [number, number];
    readonly groupstatetransitioninfostatus_toInfo: (a: number) => number;
    readonly groupstatetransitioninfostatus_type_name: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_actions: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_anchor: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_binding_signature: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_denomination: (a: number) => bigint;
    readonly identitycreatefromshieldedpooltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_fromJSON: (a: any) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_fromObject: (a: any) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_getModifiedDataIds: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_identity_id: (a: number) => number;
    readonly identitycreatefromshieldedpooltransition_new: (a: any) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_proof: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_public_keys: (a: number) => [number, number];
    readonly identitycreatefromshieldedpooltransition_send_to_address_on_creation_failure: (a: number) => number;
    readonly identitycreatefromshieldedpooltransition_struct_name: () => [number, number];
    readonly identitycreatefromshieldedpooltransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitycreatefromshieldedpooltransition_toJSON: (a: number) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_toObject: (a: number) => [number, number, number];
    readonly identitycreatefromshieldedpooltransition_toStateTransition: (a: number) => number;
    readonly identitycreatefromshieldedpooltransition_type_name: (a: number) => [number, number];
    readonly identitypublickeyincreation_constructor: (a: any) => [number, number, number];
    readonly identitypublickeyincreation_contract_bounds: (a: number) => number;
    readonly identitypublickeyincreation_data: (a: number) => [number, number];
    readonly identitypublickeyincreation_expires_at: (a: number) => [number, bigint];
    readonly identitypublickeyincreation_fromJSON: (a: any) => [number, number, number];
    readonly identitypublickeyincreation_fromObject: (a: any) => [number, number, number];
    readonly identitypublickeyincreation_getHash: (a: number) => [number, number, number, number];
    readonly identitypublickeyincreation_is_read_only: (a: number) => number;
    readonly identitypublickeyincreation_key_id: (a: number) => number;
    readonly identitypublickeyincreation_key_type: (a: number) => [number, number];
    readonly identitypublickeyincreation_purpose: (a: number) => [number, number];
    readonly identitypublickeyincreation_security_level: (a: number) => [number, number];
    readonly identitypublickeyincreation_set_contract_bounds: (a: number, b: number) => void;
    readonly identitypublickeyincreation_set_data: (a: number, b: number, c: number) => void;
    readonly identitypublickeyincreation_set_expires_at: (a: number, b: number) => [number, number];
    readonly identitypublickeyincreation_set_is_read_only: (a: number, b: number) => void;
    readonly identitypublickeyincreation_set_key_id: (a: number, b: any) => [number, number];
    readonly identitypublickeyincreation_set_key_type: (a: number, b: any) => [number, number];
    readonly identitypublickeyincreation_set_purpose: (a: number, b: any) => [number, number];
    readonly identitypublickeyincreation_set_security_level: (a: number, b: any) => [number, number];
    readonly identitypublickeyincreation_set_signature: (a: number, b: number, c: number) => void;
    readonly identitypublickeyincreation_set_total_budget: (a: number, b: number) => [number, number];
    readonly identitypublickeyincreation_signature: (a: number) => [number, number];
    readonly identitypublickeyincreation_struct_name: () => [number, number];
    readonly identitypublickeyincreation_toIdentityPublicKey: (a: number) => number;
    readonly identitypublickeyincreation_toJSON: (a: number) => [number, number, number];
    readonly identitypublickeyincreation_toObject: (a: number) => [number, number, number];
    readonly identitypublickeyincreation_total_budget: (a: number) => [number, bigint];
    readonly identitypublickeyincreation_type_name: (a: number) => [number, number];
    readonly partialidentity_balance: (a: number) => [number, bigint];
    readonly partialidentity_constructor: (a: any) => [number, number, number];
    readonly partialidentity_fromJSON: (a: any, b: any) => [number, number, number];
    readonly partialidentity_fromObject: (a: any, b: any) => [number, number, number];
    readonly partialidentity_id: (a: number) => number;
    readonly partialidentity_loaded_public_keys: (a: number) => [number, number, number];
    readonly partialidentity_not_found_public_keys: (a: number) => any;
    readonly partialidentity_revision: (a: number) => [number, bigint];
    readonly partialidentity_set_balance: (a: number, b: number, c: bigint) => void;
    readonly partialidentity_set_id: (a: number, b: any) => [number, number];
    readonly partialidentity_set_loaded_public_keys: (a: number, b: any) => [number, number];
    readonly partialidentity_set_not_found_public_keys: (a: number, b: number) => [number, number];
    readonly partialidentity_set_revision: (a: number, b: number, c: bigint) => void;
    readonly partialidentity_struct_name: () => [number, number];
    readonly partialidentity_toJSON: (a: number) => [number, number, number];
    readonly partialidentity_toObject: (a: number) => [number, number, number];
    readonly partialidentity_type_name: (a: number) => [number, number];
    readonly privateencryptednote_constructor: (a: number, b: number, c: number, d: number) => number;
    readonly privateencryptednote_derivation_encryption_key_index: (a: number) => number;
    readonly privateencryptednote_root_encryption_key_index: (a: number) => number;
    readonly privateencryptednote_set_derivation_encryption_key_index: (a: number, b: number) => void;
    readonly privateencryptednote_set_root_encryption_key_index: (a: number, b: number) => void;
    readonly privateencryptednote_set_value: (a: number, b: number, c: number) => void;
    readonly privateencryptednote_struct_name: () => [number, number];
    readonly privateencryptednote_type_name: (a: number) => [number, number];
    readonly privateencryptednote_value: (a: number) => [number, number];
    readonly shieldedtransfertransition_actions: (a: number) => [number, number];
    readonly shieldedtransfertransition_anchor: (a: number) => [number, number];
    readonly shieldedtransfertransition_binding_signature: (a: number) => [number, number];
    readonly shieldedtransfertransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly shieldedtransfertransition_fromJSON: (a: any) => [number, number, number];
    readonly shieldedtransfertransition_fromObject: (a: any) => [number, number, number];
    readonly shieldedtransfertransition_getModifiedDataIds: (a: number) => [number, number];
    readonly shieldedtransfertransition_new: (a: any) => [number, number, number];
    readonly shieldedtransfertransition_proof: (a: number) => [number, number];
    readonly shieldedtransfertransition_struct_name: () => [number, number];
    readonly shieldedtransfertransition_toBytes: (a: number) => [number, number, number, number];
    readonly shieldedtransfertransition_toJSON: (a: number) => [number, number, number];
    readonly shieldedtransfertransition_toObject: (a: number) => [number, number, number];
    readonly shieldedtransfertransition_toStateTransition: (a: number) => number;
    readonly shieldedtransfertransition_type_name: (a: number) => [number, number];
    readonly shieldedtransfertransition_value_balance: (a: number) => bigint;
    readonly shieldtransition_actions: (a: number) => [number, number];
    readonly shieldtransition_amount: (a: number) => bigint;
    readonly shieldtransition_anchor: (a: number) => [number, number];
    readonly shieldtransition_binding_signature: (a: number) => [number, number];
    readonly shieldtransition_fee_strategy: (a: number) => [number, number];
    readonly shieldtransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly shieldtransition_fromJSON: (a: any) => [number, number, number];
    readonly shieldtransition_fromObject: (a: any) => [number, number, number];
    readonly shieldtransition_getModifiedDataIds: (a: number) => [number, number];
    readonly shieldtransition_input_witnesses: (a: number) => [number, number];
    readonly shieldtransition_inputs: (a: number) => [number, number];
    readonly shieldtransition_new: (a: any) => [number, number, number];
    readonly shieldtransition_proof: (a: number) => [number, number];
    readonly shieldtransition_struct_name: () => [number, number];
    readonly shieldtransition_toBytes: (a: number) => [number, number, number, number];
    readonly shieldtransition_toJSON: (a: number) => [number, number, number];
    readonly shieldtransition_toObject: (a: number) => [number, number, number];
    readonly shieldtransition_toStateTransition: (a: number) => number;
    readonly shieldtransition_type_name: (a: number) => [number, number];
    readonly shieldtransition_user_fee_increase: (a: number) => number;
    readonly tokenbasetransition_constructor: (a: any) => [number, number, number];
    readonly tokenbasetransition_data_contract_id: (a: number) => number;
    readonly tokenbasetransition_identity_contract_nonce: (a: number) => bigint;
    readonly tokenbasetransition_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly tokenbasetransition_set_identity_contract_nonce: (a: number, b: bigint) => void;
    readonly tokenbasetransition_set_token_contract_position: (a: number, b: any) => [number, number];
    readonly tokenbasetransition_set_token_id: (a: number, b: any) => [number, number];
    readonly tokenbasetransition_set_using_group_info: (a: number, b: any) => [number, number];
    readonly tokenbasetransition_struct_name: () => [number, number];
    readonly tokenbasetransition_token_contract_position: (a: number) => number;
    readonly tokenbasetransition_token_id: (a: number) => number;
    readonly tokenbasetransition_type_name: (a: number) => [number, number];
    readonly tokenbasetransition_using_group_info: (a: number) => number;
    readonly tokenburnfrompooltransition_actions: (a: number) => [number, number];
    readonly tokenburnfrompooltransition_amount: (a: number) => bigint;
    readonly tokenburnfrompooltransition_anchor: (a: number) => [number, number];
    readonly tokenburnfrompooltransition_base: (a: number) => number;
    readonly tokenburnfrompooltransition_binding_signature: (a: number) => [number, number];
    readonly tokenburnfrompooltransition_constructor: (a: any) => [number, number, number];
    readonly tokenburnfrompooltransition_proof: (a: number) => [number, number];
    readonly tokenburnfrompooltransition_public_note: (a: number) => [number, number];
    readonly tokenburnfrompooltransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokenburnfrompooltransition_set_base: (a: number, b: number) => void;
    readonly tokenburnfrompooltransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenburnfrompooltransition_struct_name: () => [number, number];
    readonly tokenburnfrompooltransition_type_name: (a: number) => [number, number];
    readonly tokenconfigurationconvention_constructor: (a: any, b: number) => [number, number, number];
    readonly tokenconfigurationconvention_decimals: (a: number) => number;
    readonly tokenconfigurationconvention_localizations: (a: number) => [number, number, number];
    readonly tokenconfigurationconvention_set_decimals: (a: number, b: any) => [number, number];
    readonly tokenconfigurationconvention_set_localizations: (a: number, b: any) => [number, number];
    readonly tokenconfigurationconvention_struct_name: () => [number, number];
    readonly tokenconfigurationconvention_type_name: (a: number) => [number, number];
    readonly tokenkeepshistoryrules_constructor: (a: any) => [number, number, number];
    readonly tokenkeepshistoryrules_is_keeping_burning_history: (a: number) => number;
    readonly tokenkeepshistoryrules_is_keeping_direct_pricing_history: (a: number) => number;
    readonly tokenkeepshistoryrules_is_keeping_direct_purchase_history: (a: number) => number;
    readonly tokenkeepshistoryrules_is_keeping_freezing_history: (a: number) => number;
    readonly tokenkeepshistoryrules_is_keeping_minting_history: (a: number) => number;
    readonly tokenkeepshistoryrules_is_keeping_transfer_history: (a: number) => number;
    readonly tokenkeepshistoryrules_set_is_keeping_burning_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_set_is_keeping_direct_pricing_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_set_is_keeping_direct_purchase_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_set_is_keeping_freezing_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_set_is_keeping_minting_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_set_is_keeping_transfer_history: (a: number, b: number) => void;
    readonly tokenkeepshistoryrules_struct_name: () => [number, number];
    readonly tokenkeepshistoryrules_type_name: (a: number) => [number, number];
    readonly tokenstatus_is_paused: (a: number) => number;
    readonly tokenstatus_struct_name: () => [number, number];
    readonly tokenstatus_type_name: (a: number) => [number, number];
    readonly documentbasetransition_module_brand: () => any;
    readonly groupstatetransitioninfo_module_brand: () => any;
    readonly groupstatetransitioninfostatus_module_brand: () => any;
    readonly identitycreatefromshieldedpooltransition_module_brand: () => any;
    readonly identitypublickeyincreation_module_brand: () => any;
    readonly partialidentity_module_brand: () => any;
    readonly privateencryptednote_module_brand: () => any;
    readonly shieldedtransfertransition_module_brand: () => any;
    readonly shieldtransition_module_brand: () => any;
    readonly tokenbasetransition_module_brand: () => any;
    readonly tokenburnfrompooltransition_module_brand: () => any;
    readonly tokenconfigurationconvention_module_brand: () => any;
    readonly tokenkeepshistoryrules_module_brand: () => any;
    readonly tokenstatus_module_brand: () => any;
    readonly __wbg_blockinfo_free: (a: number, b: number) => void;
    readonly __wbg_identifier_free: (a: number, b: number) => void;
    readonly blockinfo_constructor: (a: any) => [number, number, number];
    readonly blockinfo_core_height: (a: number) => number;
    readonly blockinfo_epoch_index: (a: number) => number;
    readonly blockinfo_fromJSON: (a: any) => [number, number, number];
    readonly blockinfo_fromObject: (a: any) => [number, number, number];
    readonly blockinfo_height: (a: number) => bigint;
    readonly blockinfo_struct_name: () => [number, number];
    readonly blockinfo_time_ms: (a: number) => bigint;
    readonly blockinfo_toJSON: (a: number) => [number, number, number];
    readonly blockinfo_toObject: (a: number) => [number, number, number];
    readonly blockinfo_type_name: (a: number) => [number, number];
    readonly identifier_constructor: (a: any) => [number, number, number];
    readonly identifier_fromBase58: (a: number, b: number) => [number, number, number];
    readonly identifier_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identifier_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identifier_fromHex: (a: number, b: number) => [number, number, number];
    readonly identifier_struct_name: () => [number, number];
    readonly identifier_toBase58: (a: number) => [number, number];
    readonly identifier_toBase64: (a: number) => [number, number];
    readonly identifier_toBytes: (a: number) => [number, number];
    readonly identifier_toHex: (a: number) => [number, number];
    readonly identifier_type_name: (a: number) => [number, number];
    readonly testJsValueToJson: (a: any) => [number, number, number];
    readonly identifier_toJSON: (a: number) => [number, number];
    readonly identifier_toString: (a: number) => [number, number];
    readonly blockinfo_module_brand: () => any;
    readonly identifier_module_brand: () => any;
    readonly __wbg_addressfundstransfertransition_free: (a: number, b: number) => void;
    readonly __wbg_addresswitness_free: (a: number, b: number) => void;
    readonly __wbg_chainassetlockproof_free: (a: number, b: number) => void;
    readonly __wbg_changecontrolrules_free: (a: number, b: number) => void;
    readonly __wbg_datacontract_free: (a: number, b: number) => void;
    readonly __wbg_datacontractcreatetransition_free: (a: number, b: number) => void;
    readonly __wbg_datacontractupdatetransition_free: (a: number, b: number) => void;
    readonly __wbg_feestrategystep_free: (a: number, b: number) => void;
    readonly __wbg_identitycreatetransition_free: (a: number, b: number) => void;
    readonly __wbg_identitytopuptransition_free: (a: number, b: number) => void;
    readonly __wbg_platformaddressinput_free: (a: number, b: number) => void;
    readonly __wbg_platformaddressoutput_free: (a: number, b: number) => void;
    readonly __wbg_tokenconfiguration_free: (a: number, b: number) => void;
    readonly __wbg_tokencontractinfo_free: (a: number, b: number) => void;
    readonly __wbg_tokendistributionrecipient_free: (a: number, b: number) => void;
    readonly __wbg_tokendistributionrules_free: (a: number, b: number) => void;
    readonly __wbg_tokenmarketplacerules_free: (a: number, b: number) => void;
    readonly __wbg_tokenperpetualdistribution_free: (a: number, b: number) => void;
    readonly __wbg_tokenpurchasefromshieldedpooltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokentrademode_free: (a: number, b: number) => void;
    readonly addressfundstransfertransition_constructor: (a: any) => [number, number, number];
    readonly addressfundstransfertransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly addressfundstransfertransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly addressfundstransfertransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly addressfundstransfertransition_fromJSON: (a: any) => [number, number, number];
    readonly addressfundstransfertransition_fromObject: (a: any) => [number, number, number];
    readonly addressfundstransfertransition_fromStateTransition: (a: number) => [number, number, number];
    readonly addressfundstransfertransition_inputs: (a: number) => [number, number];
    readonly addressfundstransfertransition_outputs: (a: number) => [number, number];
    readonly addressfundstransfertransition_set_inputs: (a: number, b: number, c: number) => [number, number];
    readonly addressfundstransfertransition_set_outputs: (a: number, b: number, c: number) => [number, number];
    readonly addressfundstransfertransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly addressfundstransfertransition_struct_name: () => [number, number];
    readonly addressfundstransfertransition_toBase64: (a: number) => [number, number, number, number];
    readonly addressfundstransfertransition_toBytes: (a: number) => [number, number, number, number];
    readonly addressfundstransfertransition_toHex: (a: number) => [number, number, number, number];
    readonly addressfundstransfertransition_toJSON: (a: number) => [number, number, number];
    readonly addressfundstransfertransition_toObject: (a: number) => [number, number, number];
    readonly addressfundstransfertransition_toStateTransition: (a: number) => number;
    readonly addressfundstransfertransition_type_name: (a: number) => [number, number];
    readonly addressfundstransfertransition_user_fee_increase: (a: number) => number;
    readonly addresswitness_fromJSON: (a: any) => [number, number, number];
    readonly addresswitness_fromObject: (a: any) => [number, number, number];
    readonly addresswitness_isP2pkh: (a: number) => number;
    readonly addresswitness_isP2sh: (a: number) => number;
    readonly addresswitness_kind: (a: number) => [number, number];
    readonly addresswitness_p2pkh: (a: number, b: number) => number;
    readonly addresswitness_p2sh: (a: any, b: number, c: number) => [number, number, number];
    readonly addresswitness_redeemScript: (a: number) => [number, number];
    readonly addresswitness_signature: (a: number) => [number, number];
    readonly addresswitness_signatures: (a: number) => [number, number];
    readonly addresswitness_struct_name: () => [number, number];
    readonly addresswitness_toJSON: (a: number) => [number, number, number];
    readonly addresswitness_toObject: (a: number) => [number, number, number];
    readonly addresswitness_type_name: (a: number) => [number, number];
    readonly chainassetlockproof_constructor: (a: number, b: number) => [number, number, number];
    readonly chainassetlockproof_core_chain_locked_height: (a: number) => number;
    readonly chainassetlockproof_createIdentityId: (a: number) => number;
    readonly chainassetlockproof_fromBytes: (a: number, b: number) => [number, number, number];
    readonly chainassetlockproof_fromJSON: (a: any) => [number, number, number];
    readonly chainassetlockproof_fromObject: (a: any) => [number, number, number];
    readonly chainassetlockproof_out_point: (a: number) => number;
    readonly chainassetlockproof_set_core_chain_locked_height: (a: number, b: number) => void;
    readonly chainassetlockproof_set_out_point: (a: number, b: number) => void;
    readonly chainassetlockproof_struct_name: () => [number, number];
    readonly chainassetlockproof_toBytes: (a: number) => [number, number, number, number];
    readonly chainassetlockproof_toJSON: (a: number) => [number, number, number];
    readonly chainassetlockproof_toObject: (a: number) => [number, number, number];
    readonly chainassetlockproof_type_name: (a: number) => [number, number];
    readonly changecontrolrules_admin_action_takers: (a: number) => number;
    readonly changecontrolrules_authorized_to_make_change: (a: number) => number;
    readonly changecontrolrules_canChangeAdminActionTakers: (a: number, b: any) => [number, number, number];
    readonly changecontrolrules_constructor: (a: any) => [number, number, number];
    readonly changecontrolrules_is_changing_admin_action_takers_to_no_one_allowed: (a: number) => number;
    readonly changecontrolrules_is_changing_authorized_action_takers_to_no_one_allowed: (a: number) => number;
    readonly changecontrolrules_is_self_changing_admin_action_takers_allowed: (a: number) => number;
    readonly changecontrolrules_set_admin_action_takers: (a: number, b: number) => void;
    readonly changecontrolrules_set_authorized_to_make_change: (a: number, b: number) => void;
    readonly changecontrolrules_set_is_changing_admin_action_takers_to_no_one_allowed: (a: number, b: number) => void;
    readonly changecontrolrules_set_is_changing_authorized_action_takers_to_no_one_allowed: (a: number, b: number) => void;
    readonly changecontrolrules_set_is_self_changing_admin_action_takers_allowed: (a: number, b: number) => void;
    readonly changecontrolrules_struct_name: () => [number, number];
    readonly changecontrolrules_type_name: (a: number) => [number, number];
    readonly datacontract_checkDocumentPropertyConstraints: (a: number, b: number, c: any) => [number, number, number];
    readonly datacontract_config: (a: number) => [number, number, number];
    readonly datacontract_constructor: (a: any) => [number, number, number];
    readonly datacontract_documentTypeDistinctFrom: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_documentTypeEncryptedProperties: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_documentTypeImmutableProperties: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_documentTypePropertyConstraints: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_documentTypeReferences: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_documentTypeTypedArrays: (a: number, b: number, c: number) => [number, number, number];
    readonly datacontract_document_distinct_from: (a: number) => [number, number, number];
    readonly datacontract_document_encrypted_properties: (a: number) => [number, number, number];
    readonly datacontract_document_immutable_properties: (a: number) => [number, number, number];
    readonly datacontract_document_property_constraints: (a: number) => [number, number, number];
    readonly datacontract_document_references: (a: number) => [number, number, number];
    readonly datacontract_document_typed_arrays: (a: number) => [number, number, number];
    readonly datacontract_fromBase64: (a: number, b: number, c: number, d: any) => [number, number, number];
    readonly datacontract_fromBytes: (a: number, b: number, c: number, d: any) => [number, number, number];
    readonly datacontract_fromHex: (a: number, b: number, c: number, d: any) => [number, number, number];
    readonly datacontract_fromJSON: (a: any, b: number, c: any) => [number, number, number];
    readonly datacontract_fromObject: (a: any, b: number, c: any) => [number, number, number];
    readonly datacontract_generateId: (a: any, b: bigint) => [number, number, number];
    readonly datacontract_groups: (a: number) => [number, number, number];
    readonly datacontract_id: (a: number) => number;
    readonly datacontract_owner_id: (a: number) => number;
    readonly datacontract_schemas: (a: number) => [number, number, number];
    readonly datacontract_setConfig: (a: number, b: any, c: any) => [number, number];
    readonly datacontract_setSchemas: (a: number, b: any, c: number, d: number, e: any) => [number, number];
    readonly datacontract_set_groups: (a: number, b: any) => [number, number];
    readonly datacontract_set_id: (a: number, b: any) => [number, number];
    readonly datacontract_set_owner_id: (a: number, b: any) => [number, number];
    readonly datacontract_set_tokens: (a: number, b: any) => [number, number];
    readonly datacontract_set_version: (a: number, b: any) => [number, number];
    readonly datacontract_struct_name: () => [number, number];
    readonly datacontract_toBase64: (a: number, b: any) => [number, number, number, number];
    readonly datacontract_toBytes: (a: number, b: any) => [number, number, number, number];
    readonly datacontract_toHex: (a: number, b: any) => [number, number, number, number];
    readonly datacontract_toJSON: (a: number, b: any) => [number, number, number];
    readonly datacontract_toObject: (a: number, b: any) => [number, number, number];
    readonly datacontract_tokens: (a: number) => [number, number, number];
    readonly datacontract_type_name: (a: number) => [number, number];
    readonly datacontract_version: (a: number) => number;
    readonly datacontractcreatetransition_constructor: (a: number, b: bigint, c: any) => [number, number, number];
    readonly datacontractcreatetransition_contract_group: (a: number) => [number, number, number];
    readonly datacontractcreatetransition_contract_group_memberships: (a: number) => [number, number, number];
    readonly datacontractcreatetransition_feature_version: (a: number) => number;
    readonly datacontractcreatetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly datacontractcreatetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly datacontractcreatetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly datacontractcreatetransition_fromJSON: (a: any) => [number, number, number];
    readonly datacontractcreatetransition_fromObject: (a: any) => [number, number, number];
    readonly datacontractcreatetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly datacontractcreatetransition_getDataContract: (a: number, b: any, c: number) => [number, number, number];
    readonly datacontractcreatetransition_identity_nonce: (a: number) => bigint;
    readonly datacontractcreatetransition_setContractGroup: (a: number, b: any) => [number, number];
    readonly datacontractcreatetransition_setContractGroupMemberships: (a: number, b: any) => [number, number];
    readonly datacontractcreatetransition_setDataContract: (a: number, b: number, c: any) => [number, number];
    readonly datacontractcreatetransition_struct_name: () => [number, number];
    readonly datacontractcreatetransition_toBase64: (a: number) => [number, number, number, number];
    readonly datacontractcreatetransition_toBytes: (a: number) => [number, number, number, number];
    readonly datacontractcreatetransition_toHex: (a: number) => [number, number, number, number];
    readonly datacontractcreatetransition_toJSON: (a: number) => [number, number, number];
    readonly datacontractcreatetransition_toObject: (a: number) => [number, number, number];
    readonly datacontractcreatetransition_toStateTransition: (a: number) => number;
    readonly datacontractcreatetransition_type_name: (a: number) => [number, number];
    readonly datacontractcreatetransition_verifyProtocolVersion: (a: number, b: number) => [number, number, number];
    readonly datacontractupdatetransition_constructor: (a: number, b: bigint, c: any) => [number, number, number];
    readonly datacontractupdatetransition_feature_version: (a: number) => number;
    readonly datacontractupdatetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly datacontractupdatetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly datacontractupdatetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly datacontractupdatetransition_fromJSON: (a: any) => [number, number, number];
    readonly datacontractupdatetransition_fromObject: (a: any) => [number, number, number];
    readonly datacontractupdatetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly datacontractupdatetransition_getDataContract: (a: number, b: number, c: any) => [number, number, number];
    readonly datacontractupdatetransition_identity_contract_nonce: (a: number) => bigint;
    readonly datacontractupdatetransition_setDataContract: (a: number, b: number, c: any) => [number, number];
    readonly datacontractupdatetransition_struct_name: () => [number, number];
    readonly datacontractupdatetransition_toBase64: (a: number) => [number, number, number, number];
    readonly datacontractupdatetransition_toBytes: (a: number) => [number, number, number, number];
    readonly datacontractupdatetransition_toHex: (a: number) => [number, number, number, number];
    readonly datacontractupdatetransition_toJSON: (a: number) => [number, number, number];
    readonly datacontractupdatetransition_toObject: (a: number) => [number, number, number];
    readonly datacontractupdatetransition_toStateTransition: (a: number) => number;
    readonly datacontractupdatetransition_type_name: (a: number) => [number, number];
    readonly datacontractupdatetransition_verifyProtocolVersion: (a: number, b: number) => [number, number, number];
    readonly feestrategystep_deductFromInput: (a: number) => number;
    readonly feestrategystep_index: (a: number) => number;
    readonly feestrategystep_isDeductFromInput: (a: number) => number;
    readonly feestrategystep_isReduceOutput: (a: number) => number;
    readonly feestrategystep_reduceOutput: (a: number) => number;
    readonly feestrategystep_struct_name: () => [number, number];
    readonly feestrategystep_type_name: (a: number) => [number, number];
    readonly identitycreatetransition_asset_lock_proof: (a: number) => number;
    readonly identitycreatetransition_constructor: (a: any) => [number, number, number];
    readonly identitycreatetransition_default: (a: any) => [number, number, number];
    readonly identitycreatetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitycreatetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycreatetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitycreatetransition_fromJSON: (a: any) => [number, number, number];
    readonly identitycreatetransition_fromObject: (a: any) => [number, number, number];
    readonly identitycreatetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitycreatetransition_identity_id: (a: number) => number;
    readonly identitycreatetransition_public_keys: (a: number) => [number, number];
    readonly identitycreatetransition_set_asset_lock_proof: (a: number, b: number) => [number, number];
    readonly identitycreatetransition_set_public_keys: (a: number, b: any) => [number, number];
    readonly identitycreatetransition_set_signature: (a: number, b: number, c: number) => void;
    readonly identitycreatetransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitycreatetransition_signature: (a: number) => [number, number];
    readonly identitycreatetransition_struct_name: () => [number, number];
    readonly identitycreatetransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitycreatetransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitycreatetransition_toHex: (a: number) => [number, number, number, number];
    readonly identitycreatetransition_toJSON: (a: number) => [number, number, number];
    readonly identitycreatetransition_toObject: (a: number) => [number, number, number];
    readonly identitycreatetransition_toStateTransition: (a: number) => number;
    readonly identitycreatetransition_type_name: (a: number) => [number, number];
    readonly identitycreatetransition_user_fee_increase: (a: number) => number;
    readonly identitytopuptransition_asset_lock_proof: (a: number) => number;
    readonly identitytopuptransition_constructor: (a: any) => [number, number, number];
    readonly identitytopuptransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitytopuptransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitytopuptransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitytopuptransition_fromJSON: (a: any) => [number, number, number];
    readonly identitytopuptransition_fromObject: (a: any) => [number, number, number];
    readonly identitytopuptransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitytopuptransition_identity_identifier: (a: number) => number;
    readonly identitytopuptransition_modified_data_ids: (a: number) => [number, number];
    readonly identitytopuptransition_optional_asset_lock_proof: (a: number) => number;
    readonly identitytopuptransition_set_asset_lock_proof: (a: number, b: number) => [number, number];
    readonly identitytopuptransition_set_identity_identifier: (a: number, b: any) => [number, number];
    readonly identitytopuptransition_set_signature: (a: number, b: number, c: number) => void;
    readonly identitytopuptransition_set_user_fee_increase: (a: number, b: number) => void;
    readonly identitytopuptransition_signature: (a: number) => [number, number];
    readonly identitytopuptransition_struct_name: () => [number, number];
    readonly identitytopuptransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitytopuptransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitytopuptransition_toHex: (a: number) => [number, number, number, number];
    readonly identitytopuptransition_toJSON: (a: number) => [number, number, number];
    readonly identitytopuptransition_toObject: (a: number) => [number, number, number];
    readonly identitytopuptransition_toStateTransition: (a: number) => number;
    readonly identitytopuptransition_type_name: (a: number) => [number, number];
    readonly identitytopuptransition_user_fee_increase: (a: number) => number;
    readonly platformaddressinput_address: (a: number) => number;
    readonly platformaddressinput_amount: (a: number) => any;
    readonly platformaddressinput_constructor: (a: any, b: number, c: any) => [number, number, number];
    readonly platformaddressinput_nonce: (a: number) => number;
    readonly platformaddressinput_struct_name: () => [number, number];
    readonly platformaddressinput_type_name: (a: number) => [number, number];
    readonly platformaddressoutput_address: (a: number) => number;
    readonly platformaddressoutput_amount: (a: number) => any;
    readonly platformaddressoutput_constructor: (a: any, b: number) => [number, number, number];
    readonly platformaddressoutput_struct_name: () => [number, number];
    readonly platformaddressoutput_type_name: (a: number) => [number, number];
    readonly tokenconfiguration_base_supply: (a: number) => bigint;
    readonly tokenconfiguration_calculateTokenId: (a: any, b: number) => [number, number, number];
    readonly tokenconfiguration_constructor: (a: any) => [number, number, number];
    readonly tokenconfiguration_conventions: (a: number) => number;
    readonly tokenconfiguration_conventions_change_rules: (a: number) => number;
    readonly tokenconfiguration_description: (a: number) => [number, number];
    readonly tokenconfiguration_destroy_frozen_funds_rules: (a: number) => number;
    readonly tokenconfiguration_distribution_rules: (a: number) => number;
    readonly tokenconfiguration_emergency_action_rules: (a: number) => number;
    readonly tokenconfiguration_format_version: (a: number) => number;
    readonly tokenconfiguration_freeze_rules: (a: number) => number;
    readonly tokenconfiguration_has_shielded_pool: (a: number) => number;
    readonly tokenconfiguration_is_allowed_transfer_to_frozen_balance: (a: number) => number;
    readonly tokenconfiguration_is_started_as_paused: (a: number) => number;
    readonly tokenconfiguration_keeps_history: (a: number) => number;
    readonly tokenconfiguration_main_control_group: (a: number) => number;
    readonly tokenconfiguration_main_control_group_can_be_modified: (a: number) => number;
    readonly tokenconfiguration_manual_burning_rules: (a: number) => number;
    readonly tokenconfiguration_manual_minting_rules: (a: number) => number;
    readonly tokenconfiguration_marketplace_rules: (a: number) => number;
    readonly tokenconfiguration_max_supply: (a: number) => [number, bigint];
    readonly tokenconfiguration_max_supply_change_rules: (a: number) => number;
    readonly tokenconfiguration_minimum_pool_notes_for_outgoing: (a: number) => bigint;
    readonly tokenconfiguration_set_base_supply: (a: number, b: any) => [number, number];
    readonly tokenconfiguration_set_conventions: (a: number, b: number) => void;
    readonly tokenconfiguration_set_conventions_change_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_description: (a: number, b: number, c: number) => void;
    readonly tokenconfiguration_set_destroy_frozen_funds_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_distribution_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_emergency_action_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_freeze_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_has_shielded_pool: (a: number, b: number) => void;
    readonly tokenconfiguration_set_is_allowed_transfer_to_frozen_balance: (a: number, b: number) => void;
    readonly tokenconfiguration_set_is_started_as_paused: (a: number, b: number) => void;
    readonly tokenconfiguration_set_keeps_history: (a: number, b: number) => void;
    readonly tokenconfiguration_set_main_control_group: (a: number, b: number) => void;
    readonly tokenconfiguration_set_main_control_group_can_be_modified: (a: number, b: number) => void;
    readonly tokenconfiguration_set_manual_burning_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_manual_minting_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_marketplace_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_max_supply: (a: number, b: any) => [number, number];
    readonly tokenconfiguration_set_max_supply_change_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_set_minimum_pool_notes_for_outgoing: (a: number, b: any) => [number, number];
    readonly tokenconfiguration_set_transferable: (a: number, b: number) => void;
    readonly tokenconfiguration_set_unfreeze_rules: (a: number, b: number) => void;
    readonly tokenconfiguration_struct_name: () => [number, number];
    readonly tokenconfiguration_transferable: (a: number) => number;
    readonly tokenconfiguration_type_name: (a: number) => [number, number];
    readonly tokenconfiguration_unfreeze_rules: (a: number) => number;
    readonly tokenconfigurationchangeitem_ConventionsAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_ConventionsControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_DestroyFrozenFundsAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_DestroyFrozenFundsItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_FreezeAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_FreezeItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_ManualBurningAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_ManualBurningItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MarketplaceTradeModeAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MarketplaceTradeModeControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MarketplaceTradeModeItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MaxSupplyAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MaxSupplyControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MaxSupplyItem: (a: number, b: bigint) => number;
    readonly tokenconfigurationchangeitem_MintingAllowChoosingDestinationAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MintingAllowChoosingDestinationControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_MintingAllowChoosingDestinationItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_PerpetualDistributionAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_PerpetualDistributionConfigurationItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_PerpetualDistributionControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_conventionsItem: (a: number) => number;
    readonly tokencontractinfo_contract_id: (a: number) => number;
    readonly tokencontractinfo_fromJSON: (a: any) => [number, number, number];
    readonly tokencontractinfo_fromObject: (a: any) => [number, number, number];
    readonly tokencontractinfo_struct_name: () => [number, number];
    readonly tokencontractinfo_toJSON: (a: number) => [number, number, number];
    readonly tokencontractinfo_toObject: (a: number) => [number, number, number];
    readonly tokencontractinfo_token_contract_position: (a: number) => number;
    readonly tokencontractinfo_type_name: (a: number) => [number, number];
    readonly tokendistributionrecipient_ContractOwner: () => number;
    readonly tokendistributionrecipient_EvonodesByParticipation: () => number;
    readonly tokendistributionrecipient_Identity: (a: any) => [number, number, number];
    readonly tokendistributionrecipient_recipient_type: (a: number) => [number, number];
    readonly tokendistributionrecipient_struct_name: () => [number, number];
    readonly tokendistributionrecipient_type_name: (a: number) => [number, number];
    readonly tokendistributionrecipient_value: (a: number) => any;
    readonly tokendistributionrules_change_direct_purchase_pricing_rules: (a: number) => number;
    readonly tokendistributionrules_constructor: (a: any) => [number, number, number];
    readonly tokendistributionrules_is_minting_allowing_choosing_destination: (a: number) => number;
    readonly tokendistributionrules_minting_allow_choosing_destination_rules: (a: number) => number;
    readonly tokendistributionrules_new_tokens_destination_identity: (a: number) => number;
    readonly tokendistributionrules_new_tokens_destination_identity_rules: (a: number) => number;
    readonly tokendistributionrules_once_per_identity_distribution: (a: number) => number;
    readonly tokendistributionrules_perpetual_distribution: (a: number) => number;
    readonly tokendistributionrules_perpetual_distribution_rules: (a: number) => number;
    readonly tokendistributionrules_pre_programmed_distribution: (a: number) => number;
    readonly tokendistributionrules_set_change_direct_purchase_pricing_rules: (a: number, b: number) => void;
    readonly tokendistributionrules_set_is_minting_allowing_choosing_destination: (a: number, b: number) => void;
    readonly tokendistributionrules_set_minting_allow_choosing_destination_rules: (a: number, b: number) => void;
    readonly tokendistributionrules_set_new_tokens_destination_identity: (a: number, b: any) => [number, number];
    readonly tokendistributionrules_set_new_tokens_destination_identity_rules: (a: number, b: number) => void;
    readonly tokendistributionrules_set_once_per_identity_distribution: (a: number, b: any) => [number, number];
    readonly tokendistributionrules_set_perpetual_distribution: (a: number, b: any) => [number, number];
    readonly tokendistributionrules_set_perpetual_distribution_rules: (a: number, b: number) => void;
    readonly tokendistributionrules_set_pre_programmed_distribution: (a: number, b: any) => [number, number];
    readonly tokendistributionrules_struct_name: () => [number, number];
    readonly tokendistributionrules_type_name: (a: number) => [number, number];
    readonly tokenmarketplacerules_constructor: (a: number, b: number) => number;
    readonly tokenmarketplacerules_set_trade_mode: (a: number, b: number) => void;
    readonly tokenmarketplacerules_set_trade_mode_change_rules: (a: number, b: number) => void;
    readonly tokenmarketplacerules_struct_name: () => [number, number];
    readonly tokenmarketplacerules_trade_mode: (a: number) => number;
    readonly tokenmarketplacerules_trade_mode_change_rules: (a: number) => number;
    readonly tokenmarketplacerules_type_name: (a: number) => [number, number];
    readonly tokenperpetualdistribution_constructor: (a: number, b: number) => number;
    readonly tokenperpetualdistribution_distribution_type: (a: number) => number;
    readonly tokenperpetualdistribution_recipient: (a: number) => number;
    readonly tokenperpetualdistribution_set_distribution_type: (a: number, b: number) => void;
    readonly tokenperpetualdistribution_set_recipient: (a: number, b: number) => void;
    readonly tokenperpetualdistribution_struct_name: () => [number, number];
    readonly tokenperpetualdistribution_type_name: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_credit_amount: (a: number) => bigint;
    readonly tokenpurchasefromshieldedpooltransition_data_contract_id: (a: number) => number;
    readonly tokenpurchasefromshieldedpooltransition_fee_actions: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_fee_anchor: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_fee_binding_signature: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_fee_proof: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromJSON: (a: any) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromObject: (a: any) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_fromStateTransition: (a: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_getModifiedDataIds: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_new: (a: any) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_struct_name: () => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_toBase64: (a: number) => [number, number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_toBytes: (a: number) => [number, number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_toHex: (a: number) => [number, number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_toJSON: (a: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_toObject: (a: number) => [number, number, number];
    readonly tokenpurchasefromshieldedpooltransition_toStateTransition: (a: number) => number;
    readonly tokenpurchasefromshieldedpooltransition_token_actions: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_token_anchor: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_token_binding_signature: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_token_contract_position: (a: number) => number;
    readonly tokenpurchasefromshieldedpooltransition_token_count: (a: number) => bigint;
    readonly tokenpurchasefromshieldedpooltransition_token_id: (a: number) => number;
    readonly tokenpurchasefromshieldedpooltransition_token_proof: (a: number) => [number, number];
    readonly tokenpurchasefromshieldedpooltransition_total_agreed_price: (a: number) => bigint;
    readonly tokenpurchasefromshieldedpooltransition_type_name: (a: number) => [number, number];
    readonly tokentrademode_struct_name: () => [number, number];
    readonly tokentrademode_type_name: (a: number) => [number, number];
    readonly tokentrademode_value: (a: number) => [number, number];
    readonly tokentrademode_NotTradeable: () => number;
    readonly addressfundstransfertransition_module_brand: () => any;
    readonly addresswitness_module_brand: () => any;
    readonly chainassetlockproof_module_brand: () => any;
    readonly changecontrolrules_module_brand: () => any;
    readonly datacontract_module_brand: () => any;
    readonly datacontractcreatetransition_module_brand: () => any;
    readonly datacontractupdatetransition_module_brand: () => any;
    readonly feestrategystep_module_brand: () => any;
    readonly identitycreatetransition_module_brand: () => any;
    readonly identitytopuptransition_module_brand: () => any;
    readonly platformaddressinput_module_brand: () => any;
    readonly platformaddressoutput_module_brand: () => any;
    readonly tokenconfiguration_module_brand: () => any;
    readonly tokencontractinfo_module_brand: () => any;
    readonly tokendistributionrecipient_module_brand: () => any;
    readonly tokendistributionrules_module_brand: () => any;
    readonly tokenmarketplacerules_module_brand: () => any;
    readonly tokenperpetualdistribution_module_brand: () => any;
    readonly tokenpurchasefromshieldedpooltransition_module_brand: () => any;
    readonly tokentrademode_module_brand: () => any;
    readonly __wbg_actiontaker_free: (a: number, b: number) => void;
    readonly __wbg_contractbounds_free: (a: number, b: number) => void;
    readonly __wbg_documentcreatetransition_free: (a: number, b: number) => void;
    readonly __wbg_documentpurchasetransition_free: (a: number, b: number) => void;
    readonly __wbg_documentreplacetransition_free: (a: number, b: number) => void;
    readonly __wbg_documenttransfertransition_free: (a: number, b: number) => void;
    readonly __wbg_documenttransition_free: (a: number, b: number) => void;
    readonly __wbg_documentupdatepricetransition_free: (a: number, b: number) => void;
    readonly __wbg_extendedepochinfo_free: (a: number, b: number) => void;
    readonly __wbg_group_free: (a: number, b: number) => void;
    readonly __wbg_platformversion_free: (a: number, b: number) => void;
    readonly __wbg_tokenshieldedpayment_free: (a: number, b: number) => void;
    readonly __wbg_unshieldtransition_free: (a: number, b: number) => void;
    readonly actiontaker_constructor: (a: any) => [number, number, number];
    readonly actiontaker_set_value: (a: number, b: any) => [number, number];
    readonly actiontaker_struct_name: () => [number, number];
    readonly actiontaker_taker_type: (a: number) => [number, number];
    readonly actiontaker_type_name: (a: number) => [number, number];
    readonly actiontaker_value: (a: number) => any;
    readonly contractbounds_ContractGroup: (a: any) => [number, number, number];
    readonly contractbounds_SingleContract: (a: any) => [number, number, number];
    readonly contractbounds_SingleContractDocumentType: (a: any, b: number, c: number) => [number, number, number];
    readonly contractbounds_constructor: (a: any, b: number, c: number) => [number, number, number];
    readonly contractbounds_contract_bounds_type: (a: number) => [number, number];
    readonly contractbounds_contract_bounds_type_number: (a: number) => number;
    readonly contractbounds_contract_group_id: (a: number) => number;
    readonly contractbounds_document_type_name: (a: number) => [number, number];
    readonly contractbounds_fromJSON: (a: any) => [number, number, number];
    readonly contractbounds_fromObject: (a: any) => [number, number, number];
    readonly contractbounds_id: (a: number) => number;
    readonly contractbounds_set_document_type_name: (a: number, b: number, c: number) => void;
    readonly contractbounds_set_id: (a: number, b: any) => [number, number];
    readonly contractbounds_struct_name: () => [number, number];
    readonly contractbounds_toJSON: (a: number) => [number, number, number];
    readonly contractbounds_toObject: (a: number) => [number, number, number];
    readonly contractbounds_type_name: (a: number) => [number, number];
    readonly documentcreatetransition_base: (a: number) => number;
    readonly documentcreatetransition_clearPrefundedVotingBalance: (a: number) => void;
    readonly documentcreatetransition_constructor: (a: any) => [number, number, number];
    readonly documentcreatetransition_data: (a: number) => [number, number, number];
    readonly documentcreatetransition_entropy: (a: number) => [number, number];
    readonly documentcreatetransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documentcreatetransition_prefunded_voting_balance: (a: number) => number;
    readonly documentcreatetransition_set_base: (a: number, b: number) => void;
    readonly documentcreatetransition_set_data: (a: number, b: any) => [number, number];
    readonly documentcreatetransition_set_entropy: (a: number, b: number, c: number) => [number, number];
    readonly documentcreatetransition_set_prefunded_voting_balance: (a: number, b: number) => void;
    readonly documentcreatetransition_struct_name: () => [number, number];
    readonly documentcreatetransition_toDocumentTransition: (a: number) => number;
    readonly documentcreatetransition_type_name: (a: number) => [number, number];
    readonly documentpurchasetransition_base: (a: number) => number;
    readonly documentpurchasetransition_constructor: (a: any) => [number, number, number];
    readonly documentpurchasetransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documentpurchasetransition_price: (a: number) => bigint;
    readonly documentpurchasetransition_revision: (a: number) => bigint;
    readonly documentpurchasetransition_set_base: (a: number, b: number) => void;
    readonly documentpurchasetransition_set_price: (a: number, b: any) => [number, number];
    readonly documentpurchasetransition_set_revision: (a: number, b: any) => [number, number];
    readonly documentpurchasetransition_struct_name: () => [number, number];
    readonly documentpurchasetransition_toDocumentTransition: (a: number) => number;
    readonly documentpurchasetransition_type_name: (a: number) => [number, number];
    readonly documentreplacetransition_base: (a: number) => number;
    readonly documentreplacetransition_constructor: (a: any) => [number, number, number];
    readonly documentreplacetransition_data: (a: number) => [number, number, number];
    readonly documentreplacetransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documentreplacetransition_revision: (a: number) => bigint;
    readonly documentreplacetransition_set_base: (a: number, b: number) => void;
    readonly documentreplacetransition_set_data: (a: number, b: any) => [number, number];
    readonly documentreplacetransition_set_revision: (a: number, b: any) => [number, number];
    readonly documentreplacetransition_struct_name: () => [number, number];
    readonly documentreplacetransition_toDocumentTransition: (a: number) => number;
    readonly documentreplacetransition_type_name: (a: number) => [number, number];
    readonly documenttransfertransition_base: (a: number) => number;
    readonly documenttransfertransition_constructor: (a: any) => [number, number, number];
    readonly documenttransfertransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documenttransfertransition_recipient_owner_id: (a: number) => number;
    readonly documenttransfertransition_set_base: (a: number, b: number) => void;
    readonly documenttransfertransition_set_recipient_owner_id: (a: number, b: any) => [number, number];
    readonly documenttransfertransition_struct_name: () => [number, number];
    readonly documenttransfertransition_toDocumentTransition: (a: number) => number;
    readonly documenttransfertransition_type_name: (a: number) => [number, number];
    readonly documenttransition_action_type: (a: number) => [number, number];
    readonly documenttransition_action_type_number: (a: number) => number;
    readonly documenttransition_create_transition: (a: number) => [number, number, number];
    readonly documenttransition_data_contract_id: (a: number) => number;
    readonly documenttransition_delete_transition: (a: number) => [number, number, number];
    readonly documenttransition_document_type_name: (a: number) => [number, number];
    readonly documenttransition_entropy: (a: number) => [number, number];
    readonly documenttransition_id: (a: number) => number;
    readonly documenttransition_identity_contract_nonce: (a: number) => bigint;
    readonly documenttransition_purchase_transition: (a: number) => [number, number, number];
    readonly documenttransition_replace_transition: (a: number) => [number, number, number];
    readonly documenttransition_revision: (a: number) => [number, bigint];
    readonly documenttransition_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly documenttransition_set_identity_contract_nonce: (a: number, b: any) => [number, number];
    readonly documenttransition_set_revision: (a: number, b: any) => [number, number];
    readonly documenttransition_struct_name: () => [number, number];
    readonly documenttransition_transfer_transition: (a: number) => [number, number, number];
    readonly documenttransition_type_name: (a: number) => [number, number];
    readonly documenttransition_update_price_transition: (a: number) => [number, number, number];
    readonly documentupdatepricetransition_base: (a: number) => number;
    readonly documentupdatepricetransition_constructor: (a: any) => [number, number, number];
    readonly documentupdatepricetransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documentupdatepricetransition_price: (a: number) => bigint;
    readonly documentupdatepricetransition_set_base: (a: number, b: number) => void;
    readonly documentupdatepricetransition_set_price: (a: number, b: any) => [number, number];
    readonly documentupdatepricetransition_struct_name: () => [number, number];
    readonly documentupdatepricetransition_toDocumentTransition: (a: number) => number;
    readonly documentupdatepricetransition_type_name: (a: number) => [number, number];
    readonly extendedepochinfo_constructor: (a: any) => [number, number, number];
    readonly extendedepochinfo_fee_multiplier: (a: number) => number;
    readonly extendedepochinfo_fee_multiplier_permille: (a: number) => bigint;
    readonly extendedepochinfo_first_block_height: (a: number) => any;
    readonly extendedepochinfo_first_block_time: (a: number) => any;
    readonly extendedepochinfo_first_core_block_height: (a: number) => number;
    readonly extendedepochinfo_fromJSON: (a: any) => [number, number, number];
    readonly extendedepochinfo_fromObject: (a: any) => [number, number, number];
    readonly extendedepochinfo_index: (a: number) => number;
    readonly extendedepochinfo_protocol_version: (a: number) => number;
    readonly extendedepochinfo_set_fee_multiplier_permille: (a: number, b: bigint) => void;
    readonly extendedepochinfo_set_first_block_height: (a: number, b: any) => [number, number];
    readonly extendedepochinfo_set_first_block_time: (a: number, b: any) => [number, number];
    readonly extendedepochinfo_set_first_core_block_height: (a: number, b: any) => [number, number];
    readonly extendedepochinfo_set_index: (a: number, b: any) => [number, number];
    readonly extendedepochinfo_set_protocol_version: (a: number, b: number) => void;
    readonly extendedepochinfo_struct_name: () => [number, number];
    readonly extendedepochinfo_toJSON: (a: number) => [number, number, number];
    readonly extendedepochinfo_toObject: (a: number) => [number, number, number];
    readonly extendedepochinfo_type_name: (a: number) => [number, number];
    readonly group_constructor: (a: any, b: number) => [number, number, number];
    readonly group_fromJSON: (a: any) => [number, number, number];
    readonly group_fromObject: (a: any) => [number, number, number];
    readonly group_members: (a: number) => [number, number, number];
    readonly group_required_power: (a: number) => number;
    readonly group_setMemberRequiredPower: (a: number, b: any, c: number) => [number, number];
    readonly group_set_members: (a: number, b: any) => [number, number];
    readonly group_set_required_power: (a: number, b: number) => void;
    readonly group_struct_name: () => [number, number];
    readonly group_toJSON: (a: number) => [number, number, number];
    readonly group_toObject: (a: number) => [number, number, number];
    readonly group_type_name: (a: number) => [number, number];
    readonly platformversion_current: () => number;
    readonly platformversion_first: () => number;
    readonly platformversion_new: (a: number) => [number, number, number];
    readonly platformversion_struct_name: () => [number, number];
    readonly platformversion_type_name: (a: number) => [number, number];
    readonly platformversion_version: (a: number) => number;
    readonly tokenshieldedpayment_actions: (a: number) => [number, number];
    readonly tokenshieldedpayment_amount: (a: number) => bigint;
    readonly tokenshieldedpayment_anchor: (a: number) => [number, number];
    readonly tokenshieldedpayment_binding_signature: (a: number) => [number, number];
    readonly tokenshieldedpayment_constructor: (a: any) => [number, number, number];
    readonly tokenshieldedpayment_fromJSON: (a: any) => [number, number, number];
    readonly tokenshieldedpayment_fromObject: (a: any) => [number, number, number];
    readonly tokenshieldedpayment_proof: (a: number) => [number, number];
    readonly tokenshieldedpayment_set_amount: (a: number, b: any) => [number, number];
    readonly tokenshieldedpayment_struct_name: () => [number, number];
    readonly tokenshieldedpayment_toJSON: (a: number) => [number, number, number];
    readonly tokenshieldedpayment_toObject: (a: number) => [number, number, number];
    readonly tokenshieldedpayment_type_name: (a: number) => [number, number];
    readonly unshieldtransition_actions: (a: number) => [number, number];
    readonly unshieldtransition_anchor: (a: number) => [number, number];
    readonly unshieldtransition_binding_signature: (a: number) => [number, number];
    readonly unshieldtransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly unshieldtransition_fromJSON: (a: any) => [number, number, number];
    readonly unshieldtransition_fromObject: (a: any) => [number, number, number];
    readonly unshieldtransition_getModifiedDataIds: (a: number) => [number, number];
    readonly unshieldtransition_new: (a: any) => [number, number, number];
    readonly unshieldtransition_output_address: (a: number) => number;
    readonly unshieldtransition_proof: (a: number) => [number, number];
    readonly unshieldtransition_struct_name: () => [number, number];
    readonly unshieldtransition_toBytes: (a: number) => [number, number, number, number];
    readonly unshieldtransition_toJSON: (a: number) => [number, number, number];
    readonly unshieldtransition_toObject: (a: number) => [number, number, number];
    readonly unshieldtransition_toStateTransition: (a: number) => number;
    readonly unshieldtransition_type_name: (a: number) => [number, number];
    readonly unshieldtransition_unshielding_amount: (a: number) => bigint;
    readonly platformversion_latest: () => number;
    readonly actiontaker_module_brand: () => any;
    readonly contractbounds_module_brand: () => any;
    readonly documentcreatetransition_module_brand: () => any;
    readonly documentpurchasetransition_module_brand: () => any;
    readonly documentreplacetransition_module_brand: () => any;
    readonly documenttransfertransition_module_brand: () => any;
    readonly documenttransition_module_brand: () => any;
    readonly documentupdatepricetransition_module_brand: () => any;
    readonly extendedepochinfo_module_brand: () => any;
    readonly group_module_brand: () => any;
    readonly platformversion_module_brand: () => any;
    readonly tokenshieldedpayment_module_brand: () => any;
    readonly unshieldtransition_module_brand: () => any;
    readonly __wbg_contenderwithserializeddocument_free: (a: number, b: number) => void;
    readonly __wbg_contractfeeclaim_free: (a: number, b: number) => void;
    readonly __wbg_contractusermoderation_free: (a: number, b: number) => void;
    readonly __wbg_get_verifiedcontractdocumentremoval_contractId: (a: number) => number;
    readonly __wbg_get_verifiedcontractdocumentremoval_documentId: (a: number) => number;
    readonly __wbg_get_verifiedcontractdocumentremoval_documentOwnerId: (a: number) => number;
    readonly __wbg_get_verifiedcontractdocumentremoval_documentTypeName: (a: number) => [number, number];
    readonly __wbg_get_verifiedcontractdocumentremoval_moderatorId: (a: number) => number;
    readonly __wbg_get_verifiedcontractdocumentremoval_removedAt: (a: number) => bigint;
    readonly __wbg_get_verifiedcontractdocumentremoval_restoredAt: (a: number) => [number, bigint];
    readonly __wbg_get_verifiedcontractdocumentremoval_restoredBy: (a: number) => number;
    readonly __wbg_get_verifiedcontractfeeclaim_contractId: (a: number) => number;
    readonly __wbg_get_verifiedcontractfeeclaim_lastClaimEpoch: (a: number) => number;
    readonly __wbg_get_verifiedcontractfeeclaim_lastClaimantId: (a: number) => number;
    readonly __wbg_get_verifiedcontractfeeclaim_pot: (a: number) => [number, number];
    readonly __wbg_get_verifiedcontractmoderationliststatuses_banned: (a: number) => number;
    readonly __wbg_get_verifiedcontractmoderationliststatuses_contractId: (a: number) => number;
    readonly __wbg_get_verifiedcontractmoderationliststatuses_identityId: (a: number) => number;
    readonly __wbg_get_verifiedcontractmoderationliststatuses_lists: (a: number) => [number, number];
    readonly __wbg_get_verifiedcontractmoderationliststatuses_suspendedUntil: (a: number) => [number, bigint];
    readonly __wbg_get_verifiedcontractteamactionsignature_actionId: (a: number) => number;
    readonly __wbg_get_verifiedcontractteamactionsignature_contractId: (a: number) => number;
    readonly __wbg_get_verifieddatacontract_dataContract: (a: number) => number;
    readonly __wbg_platformaddress_free: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_contractId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_documentId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_documentOwnerId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_documentTypeName: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_moderatorId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_removedAt: (a: number, b: bigint) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_restoredAt: (a: number, b: number, c: bigint) => void;
    readonly __wbg_set_verifiedcontractdocumentremoval_restoredBy: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractfeeclaim_contractId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractfeeclaim_lastClaimEpoch: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractfeeclaim_lastClaimantId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractfeeclaim_pot: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedcontractmoderationliststatuses_banned: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractmoderationliststatuses_lists: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedcontractteamactionsignature_actionId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractteamactionsignature_contractId: (a: number, b: number) => void;
    readonly __wbg_set_verifieddatacontract_dataContract: (a: number, b: number) => void;
    readonly __wbg_shieldfromassetlocktransition_free: (a: number, b: number) => void;
    readonly __wbg_shieldfromidentitytransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenshieldedtransferwithshieldedfeetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenunshieldtransition_free: (a: number, b: number) => void;
    readonly __wbg_verifiedcontractdocumentremoval_free: (a: number, b: number) => void;
    readonly __wbg_verifiedcontractfeeclaim_free: (a: number, b: number) => void;
    readonly __wbg_verifiedcontractmoderationliststatuses_free: (a: number, b: number) => void;
    readonly __wbg_verifiedcontractteamactionsignature_free: (a: number, b: number) => void;
    readonly __wbg_verifieddatacontract_free: (a: number, b: number) => void;
    readonly __wbg_verifieddocuments_free: (a: number, b: number) => void;
    readonly contenderwithserializeddocument_constructor: (a: any, b: number, c: number, d: number) => [number, number, number];
    readonly contenderwithserializeddocument_fromJSON: (a: any) => [number, number, number];
    readonly contenderwithserializeddocument_fromObject: (a: any) => [number, number, number];
    readonly contenderwithserializeddocument_identity_id: (a: number) => number;
    readonly contenderwithserializeddocument_serialized_document: (a: number) => any;
    readonly contenderwithserializeddocument_struct_name: () => [number, number];
    readonly contenderwithserializeddocument_toJSON: (a: number) => [number, number, number];
    readonly contenderwithserializeddocument_toObject: (a: number) => [number, number, number];
    readonly contenderwithserializeddocument_type_name: (a: number) => [number, number];
    readonly contenderwithserializeddocument_vote_tally: (a: number) => number;
    readonly contractfeeclaim_constructor: (a: any) => [number, number, number];
    readonly contractfeeclaim_data_contract_id: (a: number) => number;
    readonly contractfeeclaim_fromBase64: (a: number, b: number) => [number, number, number];
    readonly contractfeeclaim_fromBytes: (a: number, b: number) => [number, number, number];
    readonly contractfeeclaim_fromHex: (a: number, b: number) => [number, number, number];
    readonly contractfeeclaim_fromJSON: (a: any) => [number, number, number];
    readonly contractfeeclaim_fromObject: (a: any) => [number, number, number];
    readonly contractfeeclaim_fromStateTransition: (a: number) => [number, number, number];
    readonly contractfeeclaim_identity_contract_nonce: (a: number) => bigint;
    readonly contractfeeclaim_owner_id: (a: number) => number;
    readonly contractfeeclaim_pot: (a: number) => [number, number];
    readonly contractfeeclaim_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly contractfeeclaim_set_identity_contract_nonce: (a: number, b: any) => [number, number];
    readonly contractfeeclaim_set_owner_id: (a: number, b: any) => [number, number];
    readonly contractfeeclaim_set_pot: (a: number, b: number, c: number) => [number, number];
    readonly contractfeeclaim_set_signature: (a: number, b: number, c: number) => void;
    readonly contractfeeclaim_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly contractfeeclaim_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly contractfeeclaim_signature: (a: number) => [number, number];
    readonly contractfeeclaim_signature_public_key_id: (a: number) => number;
    readonly contractfeeclaim_struct_name: () => [number, number];
    readonly contractfeeclaim_toBase64: (a: number) => [number, number, number, number];
    readonly contractfeeclaim_toBytes: (a: number) => [number, number, number, number];
    readonly contractfeeclaim_toHex: (a: number) => [number, number, number, number];
    readonly contractfeeclaim_toJSON: (a: number) => [number, number, number];
    readonly contractfeeclaim_toObject: (a: number) => [number, number, number];
    readonly contractfeeclaim_toStateTransition: (a: number) => number;
    readonly contractfeeclaim_type_name: (a: number) => [number, number];
    readonly contractfeeclaim_user_fee_increase: (a: number) => number;
    readonly contractusermoderation_action: (a: number) => [number, number];
    readonly contractusermoderation_action_id: (a: number) => number;
    readonly contractusermoderation_constructor: (a: any) => [number, number, number];
    readonly contractusermoderation_data_contract_id: (a: number) => number;
    readonly contractusermoderation_document: (a: number) => [number, number];
    readonly contractusermoderation_document_id: (a: number) => number;
    readonly contractusermoderation_document_type_name: (a: number) => [number, number];
    readonly contractusermoderation_fields: (a: number) => [number, number, number];
    readonly contractusermoderation_fromBase64: (a: number, b: number) => [number, number, number];
    readonly contractusermoderation_fromBytes: (a: number, b: number) => [number, number, number];
    readonly contractusermoderation_fromHex: (a: number, b: number) => [number, number, number];
    readonly contractusermoderation_fromJSON: (a: any) => [number, number, number];
    readonly contractusermoderation_fromObject: (a: any) => [number, number, number];
    readonly contractusermoderation_fromStateTransition: (a: number) => [number, number, number];
    readonly contractusermoderation_identity_contract_nonce: (a: number) => bigint;
    readonly contractusermoderation_identity_id: (a: number) => number;
    readonly contractusermoderation_owner_id: (a: number) => number;
    readonly contractusermoderation_reason: (a: number) => any;
    readonly contractusermoderation_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly contractusermoderation_set_identity_contract_nonce: (a: number, b: any) => [number, number];
    readonly contractusermoderation_set_owner_id: (a: number, b: any) => [number, number];
    readonly contractusermoderation_set_signature: (a: number, b: number, c: number) => void;
    readonly contractusermoderation_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly contractusermoderation_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly contractusermoderation_signature: (a: number) => [number, number];
    readonly contractusermoderation_signature_public_key_id: (a: number) => number;
    readonly contractusermoderation_struct_name: () => [number, number];
    readonly contractusermoderation_toBase64: (a: number) => [number, number, number, number];
    readonly contractusermoderation_toBytes: (a: number) => [number, number, number, number];
    readonly contractusermoderation_toHex: (a: number) => [number, number, number, number];
    readonly contractusermoderation_toJSON: (a: number) => [number, number, number];
    readonly contractusermoderation_toObject: (a: number) => [number, number, number];
    readonly contractusermoderation_toStateTransition: (a: number) => number;
    readonly contractusermoderation_type_name: (a: number) => [number, number];
    readonly contractusermoderation_until: (a: number) => [number, bigint];
    readonly contractusermoderation_user_fee_increase: (a: number) => number;
    readonly platformaddress_addressType: (a: number) => [number, number];
    readonly platformaddress_constructor: (a: any) => [number, number, number];
    readonly platformaddress_fromBech32m: (a: number, b: number) => [number, number, number];
    readonly platformaddress_fromBytes: (a: number, b: number) => [number, number, number];
    readonly platformaddress_fromHex: (a: number, b: number) => [number, number, number];
    readonly platformaddress_fromP2pkhHash: (a: number, b: number) => [number, number, number];
    readonly platformaddress_fromP2shHash: (a: number, b: number) => [number, number, number];
    readonly platformaddress_hash: (a: number) => [number, number];
    readonly platformaddress_hashToHex: (a: number) => [number, number];
    readonly platformaddress_isP2pkh: (a: number) => number;
    readonly platformaddress_isP2sh: (a: number) => number;
    readonly platformaddress_struct_name: () => [number, number];
    readonly platformaddress_toBech32m: (a: number, b: any) => [number, number, number, number];
    readonly platformaddress_toBytes: (a: number) => [number, number];
    readonly platformaddress_toHex: (a: number) => [number, number];
    readonly platformaddress_type_name: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_actions: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_anchor: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_asset_lock_proof: (a: number) => number;
    readonly shieldfromassetlocktransition_binding_signature: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly shieldfromassetlocktransition_fromJSON: (a: any) => [number, number, number];
    readonly shieldfromassetlocktransition_fromObject: (a: any) => [number, number, number];
    readonly shieldfromassetlocktransition_getModifiedDataIds: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_new: (a: any) => [number, number, number];
    readonly shieldfromassetlocktransition_proof: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_signature: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_struct_name: () => [number, number];
    readonly shieldfromassetlocktransition_surplus_output: (a: number) => number;
    readonly shieldfromassetlocktransition_toBytes: (a: number) => [number, number, number, number];
    readonly shieldfromassetlocktransition_toJSON: (a: number) => [number, number, number];
    readonly shieldfromassetlocktransition_toObject: (a: number) => [number, number, number];
    readonly shieldfromassetlocktransition_toStateTransition: (a: number) => number;
    readonly shieldfromassetlocktransition_type_name: (a: number) => [number, number];
    readonly shieldfromassetlocktransition_value_balance: (a: number) => bigint;
    readonly shieldfromidentitytransition_actions: (a: number) => [number, number];
    readonly shieldfromidentitytransition_amount: (a: number) => bigint;
    readonly shieldfromidentitytransition_anchor: (a: number) => [number, number];
    readonly shieldfromidentitytransition_binding_signature: (a: number) => [number, number];
    readonly shieldfromidentitytransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly shieldfromidentitytransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly shieldfromidentitytransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly shieldfromidentitytransition_fromJSON: (a: any) => [number, number, number];
    readonly shieldfromidentitytransition_fromObject: (a: any) => [number, number, number];
    readonly shieldfromidentitytransition_fromStateTransition: (a: number) => [number, number, number];
    readonly shieldfromidentitytransition_getModifiedDataIds: (a: number) => [number, number];
    readonly shieldfromidentitytransition_identity_id: (a: number) => number;
    readonly shieldfromidentitytransition_new: (a: any) => [number, number, number];
    readonly shieldfromidentitytransition_nonce: (a: number) => bigint;
    readonly shieldfromidentitytransition_proof: (a: number) => [number, number];
    readonly shieldfromidentitytransition_set_identity_id: (a: number, b: any) => [number, number];
    readonly shieldfromidentitytransition_set_nonce: (a: number, b: any) => [number, number];
    readonly shieldfromidentitytransition_set_signature: (a: number, b: number, c: number) => void;
    readonly shieldfromidentitytransition_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly shieldfromidentitytransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly shieldfromidentitytransition_signature: (a: number) => [number, number];
    readonly shieldfromidentitytransition_signature_public_key_id: (a: number) => number;
    readonly shieldfromidentitytransition_struct_name: () => [number, number];
    readonly shieldfromidentitytransition_toBase64: (a: number) => [number, number, number, number];
    readonly shieldfromidentitytransition_toBytes: (a: number) => [number, number, number, number];
    readonly shieldfromidentitytransition_toHex: (a: number) => [number, number, number, number];
    readonly shieldfromidentitytransition_toJSON: (a: number) => [number, number, number];
    readonly shieldfromidentitytransition_toObject: (a: number) => [number, number, number];
    readonly shieldfromidentitytransition_toStateTransition: (a: number) => number;
    readonly shieldfromidentitytransition_type_name: (a: number) => [number, number];
    readonly shieldfromidentitytransition_user_fee_increase: (a: number) => number;
    readonly tokenshieldedtransferwithshieldedfeetransition_credit_amount: (a: number) => bigint;
    readonly tokenshieldedtransferwithshieldedfeetransition_data_contract_id: (a: number) => number;
    readonly tokenshieldedtransferwithshieldedfeetransition_fee_actions: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fee_anchor: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fee_binding_signature: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fee_proof: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromJSON: (a: any) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromObject: (a: any) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_getModifiedDataIds: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_new: (a: any) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_struct_name: () => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toBase64: (a: number) => [number, number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toBytes: (a: number) => [number, number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toHex: (a: number) => [number, number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toJSON: (a: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toObject: (a: number) => [number, number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_toStateTransition: (a: number) => number;
    readonly tokenshieldedtransferwithshieldedfeetransition_token_actions: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_token_anchor: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_token_binding_signature: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_token_contract_position: (a: number) => number;
    readonly tokenshieldedtransferwithshieldedfeetransition_token_id: (a: number) => number;
    readonly tokenshieldedtransferwithshieldedfeetransition_token_proof: (a: number) => [number, number];
    readonly tokenshieldedtransferwithshieldedfeetransition_type_name: (a: number) => [number, number];
    readonly tokenunshieldtransition_actions: (a: number) => [number, number];
    readonly tokenunshieldtransition_amount: (a: number) => bigint;
    readonly tokenunshieldtransition_anchor: (a: number) => [number, number];
    readonly tokenunshieldtransition_base: (a: number) => number;
    readonly tokenunshieldtransition_binding_signature: (a: number) => [number, number];
    readonly tokenunshieldtransition_constructor: (a: any) => [number, number, number];
    readonly tokenunshieldtransition_proof: (a: number) => [number, number];
    readonly tokenunshieldtransition_recipient_id: (a: number) => number;
    readonly tokenunshieldtransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokenunshieldtransition_set_base: (a: number, b: number) => void;
    readonly tokenunshieldtransition_set_recipient_id: (a: number, b: any) => [number, number];
    readonly tokenunshieldtransition_struct_name: () => [number, number];
    readonly tokenunshieldtransition_type_name: (a: number) => [number, number];
    readonly verifiedcontractdocumentremoval_document_hash: (a: number) => [number, number];
    readonly verifiedcontractdocumentremoval_keptFields: (a: number, b: number) => [number, number, number];
    readonly verifiedcontractdocumentremoval_kept_fields_bytes: (a: number) => [number, number];
    readonly verifiedcontractdocumentremoval_reason: (a: number) => any;
    readonly verifiedcontractdocumentremoval_struct_name: () => [number, number];
    readonly verifiedcontractdocumentremoval_toJSON: (a: number) => [number, number, number];
    readonly verifiedcontractdocumentremoval_toObject: (a: number) => [number, number, number];
    readonly verifiedcontractdocumentremoval_type_name: (a: number) => [number, number];
    readonly verifiedcontractfeeclaim_balances: (a: number) => any;
    readonly verifiedcontractfeeclaim_last_claim_time_ms: (a: number) => any;
    readonly verifiedcontractfeeclaim_remaining_credits: (a: number) => any;
    readonly verifiedcontractfeeclaim_struct_name: () => [number, number];
    readonly verifiedcontractfeeclaim_toJSON: (a: number) => [number, number, number];
    readonly verifiedcontractfeeclaim_toObject: (a: number) => [number, number, number];
    readonly verifiedcontractfeeclaim_type_name: (a: number) => [number, number];
    readonly verifiedcontractmoderationliststatuses_ban_reason: (a: number) => any;
    readonly verifiedcontractmoderationliststatuses_struct_name: () => [number, number];
    readonly verifiedcontractmoderationliststatuses_suspension_reason: (a: number) => any;
    readonly verifiedcontractmoderationliststatuses_toJSON: (a: number) => [number, number, number];
    readonly verifiedcontractmoderationliststatuses_toObject: (a: number) => [number, number, number];
    readonly verifiedcontractmoderationliststatuses_type_name: (a: number) => [number, number];
    readonly verifiedcontractmoderationliststatuses_warnings: (a: number) => any;
    readonly verifiedcontractteamactionsignature_status: (a: number) => [number, number];
    readonly verifiedcontractteamactionsignature_struct_name: () => [number, number];
    readonly verifiedcontractteamactionsignature_toJSON: (a: number) => [number, number, number];
    readonly verifiedcontractteamactionsignature_toObject: (a: number) => [number, number, number];
    readonly verifiedcontractteamactionsignature_type_name: (a: number) => [number, number];
    readonly verifieddatacontract_fromJSON: (a: any, b: any) => [number, number, number];
    readonly verifieddatacontract_fromObject: (a: any, b: any) => [number, number, number];
    readonly verifieddatacontract_struct_name: () => [number, number];
    readonly verifieddatacontract_toJSON: (a: number, b: any) => [number, number, number];
    readonly verifieddatacontract_toObject: (a: number, b: any) => [number, number, number];
    readonly verifieddatacontract_type_name: (a: number) => [number, number];
    readonly verifieddocuments_documents: (a: number) => any;
    readonly verifieddocuments_fromJSON: (a: any) => [number, number, number];
    readonly verifieddocuments_fromObject: (a: any) => [number, number, number];
    readonly verifieddocuments_struct_name: () => [number, number];
    readonly verifieddocuments_toJSON: (a: number) => [number, number, number];
    readonly verifieddocuments_toObject: (a: number) => any;
    readonly verifieddocuments_type_name: (a: number) => [number, number];
    readonly __wbg_set_verifiedcontractmoderationliststatuses_contractId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractmoderationliststatuses_identityId: (a: number, b: number) => void;
    readonly __wbg_set_verifiedcontractmoderationliststatuses_suspendedUntil: (a: number, b: number, c: bigint) => void;
    readonly contenderwithserializeddocument_module_brand: () => any;
    readonly contractfeeclaim_module_brand: () => any;
    readonly contractusermoderation_module_brand: () => any;
    readonly platformaddress_module_brand: () => any;
    readonly shieldfromassetlocktransition_module_brand: () => any;
    readonly shieldfromidentitytransition_module_brand: () => any;
    readonly tokenshieldedtransferwithshieldedfeetransition_module_brand: () => any;
    readonly tokenunshieldtransition_module_brand: () => any;
    readonly verifiedcontractdocumentremoval_module_brand: () => any;
    readonly verifiedcontractfeeclaim_module_brand: () => any;
    readonly verifiedcontractmoderationliststatuses_module_brand: () => any;
    readonly verifiedcontractteamactionsignature_module_brand: () => any;
    readonly verifieddatacontract_module_brand: () => any;
    readonly verifieddocuments_module_brand: () => any;
    readonly __wbg_addressfundingfromassetlocktransition_free: (a: number, b: number) => void;
    readonly __wbg_batchedtransition_free: (a: number, b: number) => void;
    readonly __wbg_blockbaseddistribution_free: (a: number, b: number) => void;
    readonly __wbg_distributionfunction_free: (a: number, b: number) => void;
    readonly __wbg_finalizedepochinfo_free: (a: number, b: number) => void;
    readonly __wbg_get_blockbaseddistribution_interval: (a: number) => bigint;
    readonly __wbg_get_epochbaseddistribution_interval: (a: number) => number;
    readonly __wbg_get_timebaseddistribution_interval: (a: number) => bigint;
    readonly __wbg_resourcevotechoice_free: (a: number, b: number) => void;
    readonly __wbg_rewarddistributiontype_free: (a: number, b: number) => void;
    readonly __wbg_set_blockbaseddistribution_interval: (a: number, b: bigint) => void;
    readonly __wbg_set_epochbaseddistribution_interval: (a: number, b: number) => void;
    readonly __wbg_tokenconfigupdatetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenemergencyactiontransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenpaymentinfo_free: (a: number, b: number) => void;
    readonly __wbg_tokenpreprogrammeddistribution_free: (a: number, b: number) => void;
    readonly __wbg_vote_free: (a: number, b: number) => void;
    readonly __wbg_votepoll_free: (a: number, b: number) => void;
    readonly addressfundingfromassetlocktransition_asset_lock_proof: (a: number) => number;
    readonly addressfundingfromassetlocktransition_constructor: (a: any) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromJSON: (a: any) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromObject: (a: any) => [number, number, number];
    readonly addressfundingfromassetlocktransition_fromStateTransition: (a: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_inputs: (a: number) => [number, number];
    readonly addressfundingfromassetlocktransition_outputs: (a: number) => [number, number];
    readonly addressfundingfromassetlocktransition_set_asset_lock_proof: (a: number, b: number) => void;
    readonly addressfundingfromassetlocktransition_set_inputs: (a: number, b: number, c: number) => [number, number];
    readonly addressfundingfromassetlocktransition_set_outputs: (a: number, b: number, c: number) => [number, number];
    readonly addressfundingfromassetlocktransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly addressfundingfromassetlocktransition_struct_name: () => [number, number];
    readonly addressfundingfromassetlocktransition_toBase64: (a: number) => [number, number, number, number];
    readonly addressfundingfromassetlocktransition_toBytes: (a: number) => [number, number, number, number];
    readonly addressfundingfromassetlocktransition_toHex: (a: number) => [number, number, number, number];
    readonly addressfundingfromassetlocktransition_toJSON: (a: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_toObject: (a: number) => [number, number, number];
    readonly addressfundingfromassetlocktransition_toStateTransition: (a: number) => number;
    readonly addressfundingfromassetlocktransition_type_name: (a: number) => [number, number];
    readonly addressfundingfromassetlocktransition_user_fee_increase: (a: number) => number;
    readonly batchedtransition_constructor: (a: any) => [number, number, number];
    readonly batchedtransition_data_contract_id: (a: number) => number;
    readonly batchedtransition_set_data_contract_id: (a: number, b: any) => [number, number];
    readonly batchedtransition_struct_name: () => [number, number];
    readonly batchedtransition_toTransition: (a: number) => any;
    readonly batchedtransition_type_name: (a: number) => [number, number];
    readonly blockbaseddistribution_function: (a: number) => number;
    readonly blockbaseddistribution_set_function: (a: number, b: number) => void;
    readonly blockbaseddistribution_struct_name: () => [number, number];
    readonly blockbaseddistribution_type_name: (a: number) => [number, number];
    readonly distributionfunction_Exponential: (a: number) => number;
    readonly distributionfunction_FixedAmountDistribution: (a: number) => number;
    readonly distributionfunction_InvertedLogarithmic: (a: number) => number;
    readonly distributionfunction_Linear: (a: number) => number;
    readonly distributionfunction_Logarithmic: (a: number) => number;
    readonly distributionfunction_Polynomial: (a: number) => number;
    readonly distributionfunction_Random: (a: number) => number;
    readonly distributionfunction_StepDecreasingAmount: (a: number) => number;
    readonly distributionfunction_Stepwise: (a: any) => [number, number, number];
    readonly distributionfunction_function_name: (a: number) => [number, number];
    readonly distributionfunction_function_value: (a: number) => [number, number, number];
    readonly distributionfunction_struct_name: () => [number, number];
    readonly distributionfunction_type_name: (a: number) => [number, number];
    readonly epochbaseddistribution_function: (a: number) => number;
    readonly epochbaseddistribution_set_function: (a: number, b: number) => void;
    readonly epochbaseddistribution_struct_name: () => [number, number];
    readonly epochbaseddistribution_type_name: (a: number) => [number, number];
    readonly finalizedepochinfo_block_proposers: (a: number) => any;
    readonly finalizedepochinfo_constructor: (a: any) => [number, number, number];
    readonly finalizedepochinfo_core_block_rewards: (a: number) => any;
    readonly finalizedepochinfo_fee_multiplier: (a: number) => number;
    readonly finalizedepochinfo_fee_multiplier_permille: (a: number) => bigint;
    readonly finalizedepochinfo_first_block_height: (a: number) => any;
    readonly finalizedepochinfo_first_block_time: (a: number) => any;
    readonly finalizedepochinfo_first_core_block_height: (a: number) => number;
    readonly finalizedepochinfo_fromJSON: (a: any) => [number, number, number];
    readonly finalizedepochinfo_fromObject: (a: any) => [number, number, number];
    readonly finalizedepochinfo_next_epoch_start_core_block_height: (a: number) => number;
    readonly finalizedepochinfo_protocol_version: (a: number) => number;
    readonly finalizedepochinfo_set_block_proposers: (a: number, b: any) => [number, number];
    readonly finalizedepochinfo_set_core_block_rewards: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_fee_multiplier_permille: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_first_block_height: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_first_block_time: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_first_core_block_height: (a: number, b: number) => void;
    readonly finalizedepochinfo_set_next_epoch_start_core_block_height: (a: number, b: number) => void;
    readonly finalizedepochinfo_set_protocol_version: (a: number, b: number) => void;
    readonly finalizedepochinfo_set_total_blocks_in_epoch: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_total_created_storage_fees: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_total_distributed_storage_fees: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_set_total_processing_fees: (a: number, b: bigint) => void;
    readonly finalizedepochinfo_struct_name: () => [number, number];
    readonly finalizedepochinfo_toJSON: (a: number) => [number, number, number];
    readonly finalizedepochinfo_toObject: (a: number) => [number, number, number];
    readonly finalizedepochinfo_total_blocks_in_epoch: (a: number) => any;
    readonly finalizedepochinfo_total_created_storage_fees: (a: number) => any;
    readonly finalizedepochinfo_total_distributed_storage_fees: (a: number) => any;
    readonly finalizedepochinfo_total_processing_fees: (a: number) => any;
    readonly finalizedepochinfo_type_name: (a: number) => [number, number];
    readonly resourcevotechoice_Abstain: () => number;
    readonly resourcevotechoice_Lock: () => number;
    readonly resourcevotechoice_TowardsIdentity: (a: any) => [number, number, number];
    readonly resourcevotechoice_fromJSON: (a: any) => [number, number, number];
    readonly resourcevotechoice_fromObject: (a: any) => [number, number, number];
    readonly resourcevotechoice_struct_name: () => [number, number];
    readonly resourcevotechoice_toJSON: (a: number) => [number, number, number];
    readonly resourcevotechoice_toObject: (a: number) => [number, number, number];
    readonly resourcevotechoice_type_name: (a: number) => [number, number];
    readonly resourcevotechoice_value: (a: number) => number;
    readonly resourcevotechoice_vote_type: (a: number) => [number, number];
    readonly rewarddistributiontype_BlockBasedDistribution: (a: bigint, b: number) => number;
    readonly rewarddistributiontype_EpochBasedDistribution: (a: number, b: number) => number;
    readonly rewarddistributiontype_TimeBasedDistribution: (a: bigint, b: number) => number;
    readonly rewarddistributiontype_distribution: (a: number) => any;
    readonly rewarddistributiontype_struct_name: () => [number, number];
    readonly rewarddistributiontype_type_name: (a: number) => [number, number];
    readonly timebaseddistribution_function: (a: number) => number;
    readonly timebaseddistribution_set_function: (a: number, b: number) => void;
    readonly timebaseddistribution_struct_name: () => [number, number];
    readonly timebaseddistribution_type_name: (a: number) => [number, number];
    readonly tokenconfigupdatetransition_base: (a: number) => number;
    readonly tokenconfigupdatetransition_constructor: (a: any) => [number, number, number];
    readonly tokenconfigupdatetransition_public_note: (a: number) => [number, number];
    readonly tokenconfigupdatetransition_set_base: (a: number, b: number) => void;
    readonly tokenconfigupdatetransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenconfigupdatetransition_set_update_token_configuration_item: (a: number, b: number) => void;
    readonly tokenconfigupdatetransition_struct_name: () => [number, number];
    readonly tokenconfigupdatetransition_type_name: (a: number) => [number, number];
    readonly tokenconfigupdatetransition_update_token_configuration_item: (a: number) => number;
    readonly tokenemergencyactiontransition_base: (a: number) => number;
    readonly tokenemergencyactiontransition_constructor: (a: any) => [number, number, number];
    readonly tokenemergencyactiontransition_emergency_action: (a: number) => [number, number];
    readonly tokenemergencyactiontransition_public_note: (a: number) => [number, number];
    readonly tokenemergencyactiontransition_set_base: (a: number, b: number) => void;
    readonly tokenemergencyactiontransition_set_emergency_action: (a: number, b: number) => void;
    readonly tokenemergencyactiontransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenemergencyactiontransition_struct_name: () => [number, number];
    readonly tokenemergencyactiontransition_type_name: (a: number) => [number, number];
    readonly tokenpaymentinfo_constructor: (a: any) => [number, number, number];
    readonly tokenpaymentinfo_fromJSON: (a: any) => [number, number, number];
    readonly tokenpaymentinfo_fromObject: (a: any) => [number, number, number];
    readonly tokenpaymentinfo_gas_fees_paid_by: (a: number) => [number, number];
    readonly tokenpaymentinfo_maximum_token_cost: (a: number) => [number, bigint];
    readonly tokenpaymentinfo_minimum_token_cost: (a: number) => [number, bigint];
    readonly tokenpaymentinfo_payment_token_contract_id: (a: number) => number;
    readonly tokenpaymentinfo_set_gas_fees_paid_by: (a: number, b: any) => [number, number];
    readonly tokenpaymentinfo_set_maximum_token_cost: (a: number, b: number, c: bigint) => void;
    readonly tokenpaymentinfo_set_minimum_token_cost: (a: number, b: number, c: bigint) => void;
    readonly tokenpaymentinfo_set_payment_token_contract_id: (a: number, b: any) => [number, number];
    readonly tokenpaymentinfo_set_shielded_payment: (a: number, b: number) => void;
    readonly tokenpaymentinfo_set_token_contract_position: (a: number, b: number) => void;
    readonly tokenpaymentinfo_shielded_payment: (a: number) => number;
    readonly tokenpaymentinfo_struct_name: () => [number, number];
    readonly tokenpaymentinfo_toJSON: (a: number) => [number, number, number];
    readonly tokenpaymentinfo_toObject: (a: number) => [number, number, number];
    readonly tokenpaymentinfo_token_contract_position: (a: number) => number;
    readonly tokenpaymentinfo_type_name: (a: number) => [number, number];
    readonly tokenpreprogrammeddistribution_constructor: (a: any) => [number, number, number];
    readonly tokenpreprogrammeddistribution_distributions: (a: number) => any;
    readonly tokenpreprogrammeddistribution_set_distributions: (a: number, b: any) => [number, number];
    readonly tokenpreprogrammeddistribution_struct_name: () => [number, number];
    readonly tokenpreprogrammeddistribution_type_name: (a: number) => [number, number];
    readonly vote_choice: (a: number) => number;
    readonly vote_constructor: (a: number, b: number) => number;
    readonly vote_fromJSON: (a: any) => [number, number, number];
    readonly vote_fromObject: (a: any) => [number, number, number];
    readonly vote_poll: (a: number) => number;
    readonly vote_set_choice: (a: number, b: number) => void;
    readonly vote_set_poll: (a: number, b: number) => void;
    readonly vote_struct_name: () => [number, number];
    readonly vote_toJSON: (a: number) => [number, number, number];
    readonly vote_toObject: (a: number) => [number, number, number];
    readonly vote_type_name: (a: number) => [number, number];
    readonly votepoll_constructor: (a: any) => [number, number, number];
    readonly votepoll_contract_id: (a: number) => number;
    readonly votepoll_document_type_name: (a: number) => [number, number];
    readonly votepoll_fromJSON: (a: any) => [number, number, number];
    readonly votepoll_fromObject: (a: any) => [number, number, number];
    readonly votepoll_index_name: (a: number) => [number, number];
    readonly votepoll_index_values: (a: number) => [number, number, number];
    readonly votepoll_set_contract_id: (a: number, b: any) => [number, number];
    readonly votepoll_set_document_type_name: (a: number, b: number, c: number) => void;
    readonly votepoll_set_index_name: (a: number, b: number, c: number) => void;
    readonly votepoll_set_index_values: (a: number, b: any) => [number, number];
    readonly votepoll_struct_name: () => [number, number];
    readonly votepoll_toJSON: (a: number) => [number, number, number];
    readonly votepoll_toObject: (a: number) => [number, number, number];
    readonly votepoll_toString: (a: number) => [number, number];
    readonly votepoll_type_name: (a: number) => [number, number];
    readonly __wbg_set_timebaseddistribution_interval: (a: number, b: bigint) => void;
    readonly addressfundingfromassetlocktransition_module_brand: () => any;
    readonly batchedtransition_module_brand: () => any;
    readonly blockbaseddistribution_module_brand: () => any;
    readonly distributionfunction_module_brand: () => any;
    readonly epochbaseddistribution_module_brand: () => any;
    readonly finalizedepochinfo_module_brand: () => any;
    readonly resourcevotechoice_module_brand: () => any;
    readonly rewarddistributiontype_module_brand: () => any;
    readonly timebaseddistribution_module_brand: () => any;
    readonly tokenconfigupdatetransition_module_brand: () => any;
    readonly tokenemergencyactiontransition_module_brand: () => any;
    readonly tokenpaymentinfo_module_brand: () => any;
    readonly tokenpreprogrammeddistribution_module_brand: () => any;
    readonly vote_module_brand: () => any;
    readonly votepoll_module_brand: () => any;
    readonly __wbg_timebaseddistribution_free: (a: number, b: number) => void;
    readonly __wbg_epochbaseddistribution_free: (a: number, b: number) => void;
    readonly __wbg_get_verifiedmasternodevote_vote: (a: number) => number;
    readonly __wbg_get_verifiednextdistribution_vote: (a: number) => number;
    readonly __wbg_identity_free: (a: number, b: number) => void;
    readonly __wbg_identitytopupfromaddressestransition_free: (a: number, b: number) => void;
    readonly __wbg_masternodevotetransition_free: (a: number, b: number) => void;
    readonly __wbg_set_verifiedmasternodevote_vote: (a: number, b: number) => void;
    readonly __wbg_statetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenminttopooltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenshieldedtransfertransition_free: (a: number, b: number) => void;
    readonly __wbg_verifiedmasternodevote_free: (a: number, b: number) => void;
    readonly __wbg_verifiednextdistribution_free: (a: number, b: number) => void;
    readonly identity_addPublicKey: (a: number, b: number) => void;
    readonly identity_balance: (a: number) => bigint;
    readonly identity_constructor: (a: any) => [number, number, number];
    readonly identity_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identity_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identity_fromHex: (a: number, b: number) => [number, number, number];
    readonly identity_fromJSON: (a: any) => [number, number, number];
    readonly identity_fromObject: (a: any, b: any) => [number, number, number];
    readonly identity_getPublicKeyById: (a: number, b: number) => number;
    readonly identity_id: (a: number) => number;
    readonly identity_public_keys: (a: number) => [number, number];
    readonly identity_revision: (a: number) => bigint;
    readonly identity_set_balance: (a: number, b: any) => [number, number];
    readonly identity_set_id: (a: number, b: any) => [number, number];
    readonly identity_set_revision: (a: number, b: any) => [number, number];
    readonly identity_struct_name: () => [number, number];
    readonly identity_toBase64: (a: number) => [number, number, number, number];
    readonly identity_toBytes: (a: number) => [number, number, number, number];
    readonly identity_toHex: (a: number) => [number, number, number, number];
    readonly identity_toJSON: (a: number) => [number, number, number];
    readonly identity_toObject: (a: number) => [number, number, number];
    readonly identity_type_name: (a: number) => [number, number];
    readonly identitytopupfromaddressestransition_constructor: (a: any) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromJSON: (a: any) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromObject: (a: any) => [number, number, number];
    readonly identitytopupfromaddressestransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_identity_id: (a: number) => number;
    readonly identitytopupfromaddressestransition_inputs: (a: number) => [number, number];
    readonly identitytopupfromaddressestransition_output: (a: number) => number;
    readonly identitytopupfromaddressestransition_set_identity_id: (a: number, b: any) => [number, number];
    readonly identitytopupfromaddressestransition_set_inputs: (a: number, b: number, c: number) => [number, number];
    readonly identitytopupfromaddressestransition_set_output: (a: number, b: number) => [number, number];
    readonly identitytopupfromaddressestransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitytopupfromaddressestransition_struct_name: () => [number, number];
    readonly identitytopupfromaddressestransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitytopupfromaddressestransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitytopupfromaddressestransition_toHex: (a: number) => [number, number, number, number];
    readonly identitytopupfromaddressestransition_toJSON: (a: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_toObject: (a: number) => [number, number, number];
    readonly identitytopupfromaddressestransition_toStateTransition: (a: number) => number;
    readonly identitytopupfromaddressestransition_type_name: (a: number) => [number, number];
    readonly identitytopupfromaddressestransition_user_fee_increase: (a: number) => number;
    readonly masternodevotetransition_asset_lock_proof: (a: number) => number;
    readonly masternodevotetransition_constructor: (a: any) => [number, number, number];
    readonly masternodevotetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly masternodevotetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly masternodevotetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly masternodevotetransition_fromJSON: (a: any) => [number, number, number];
    readonly masternodevotetransition_fromObject: (a: any) => [number, number, number];
    readonly masternodevotetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly masternodevotetransition_modified_data_ids: (a: number) => [number, number];
    readonly masternodevotetransition_nonce: (a: number) => bigint;
    readonly masternodevotetransition_pro_tx_hash: (a: number) => number;
    readonly masternodevotetransition_set_nonce: (a: number, b: any) => [number, number];
    readonly masternodevotetransition_set_pro_tx_hash: (a: number, b: any) => [number, number];
    readonly masternodevotetransition_set_signature: (a: number, b: number, c: number) => void;
    readonly masternodevotetransition_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly masternodevotetransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly masternodevotetransition_set_vote: (a: number, b: number) => void;
    readonly masternodevotetransition_set_voter_identity_id: (a: number, b: any) => [number, number];
    readonly masternodevotetransition_signature: (a: number) => [number, number];
    readonly masternodevotetransition_signature_public_key_id: (a: number) => number;
    readonly masternodevotetransition_struct_name: () => [number, number];
    readonly masternodevotetransition_toBase64: (a: number) => [number, number, number, number];
    readonly masternodevotetransition_toBytes: (a: number) => [number, number, number, number];
    readonly masternodevotetransition_toHex: (a: number) => [number, number, number, number];
    readonly masternodevotetransition_toJSON: (a: number) => [number, number, number];
    readonly masternodevotetransition_toObject: (a: number) => [number, number, number];
    readonly masternodevotetransition_toStateTransition: (a: number) => number;
    readonly masternodevotetransition_type_name: (a: number) => [number, number];
    readonly masternodevotetransition_vote: (a: number) => number;
    readonly masternodevotetransition_voter_identity_id: (a: number) => number;
    readonly statetransition_action_type: (a: number) => [number, number];
    readonly statetransition_action_type_number: (a: number) => number;
    readonly statetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly statetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly statetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly statetransition_getKeyLevelRequirement: (a: number, b: any) => [number, number, number, number];
    readonly statetransition_getSignableBytes: (a: number) => [number, number, number, number];
    readonly statetransition_hash: (a: number, b: number) => [number, number, number, number];
    readonly statetransition_identity_contract_nonce: (a: number) => [number, bigint];
    readonly statetransition_identity_nonce: (a: number) => [number, bigint];
    readonly statetransition_owner_id: (a: number) => number;
    readonly statetransition_purpose_requirement: (a: number) => [number, number];
    readonly statetransition_setIdentityContractNonce: (a: number, b: any) => [number, number];
    readonly statetransition_setIdentityNonce: (a: number, b: any) => [number, number];
    readonly statetransition_setOwnerId: (a: number, b: any) => [number, number];
    readonly statetransition_set_signature: (a: number, b: number, c: number) => number;
    readonly statetransition_set_signature_public_key_id: (a: number, b: number) => void;
    readonly statetransition_set_user_fee_increase: (a: number, b: number) => void;
    readonly statetransition_sign: (a: number, b: number, c: number) => [number, number, number, number];
    readonly statetransition_signByPrivateKey: (a: number, b: number, c: number, d: any) => [number, number, number, number];
    readonly statetransition_signature: (a: number) => [number, number];
    readonly statetransition_signature_public_key_id: (a: number) => number;
    readonly statetransition_struct_name: () => [number, number];
    readonly statetransition_toBase64: (a: number) => [number, number, number, number];
    readonly statetransition_toBytes: (a: number) => [number, number, number, number];
    readonly statetransition_toHex: (a: number) => [number, number, number, number];
    readonly statetransition_type_name: (a: number) => [number, number];
    readonly statetransition_user_fee_increase: (a: number) => number;
    readonly statetransition_verifyPublicKey: (a: number, b: number, c: number, d: number) => [number, number];
    readonly tokenminttopooltransition_actions: (a: number) => [number, number];
    readonly tokenminttopooltransition_amount: (a: number) => bigint;
    readonly tokenminttopooltransition_anchor: (a: number) => [number, number];
    readonly tokenminttopooltransition_base: (a: number) => number;
    readonly tokenminttopooltransition_binding_signature: (a: number) => [number, number];
    readonly tokenminttopooltransition_constructor: (a: any) => [number, number, number];
    readonly tokenminttopooltransition_proof: (a: number) => [number, number];
    readonly tokenminttopooltransition_public_note: (a: number) => [number, number];
    readonly tokenminttopooltransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokenminttopooltransition_set_base: (a: number, b: number) => void;
    readonly tokenminttopooltransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenminttopooltransition_struct_name: () => [number, number];
    readonly tokenminttopooltransition_type_name: (a: number) => [number, number];
    readonly tokenshieldedtransfertransition_actions: (a: number) => [number, number];
    readonly tokenshieldedtransfertransition_anchor: (a: number) => [number, number];
    readonly tokenshieldedtransfertransition_base: (a: number) => number;
    readonly tokenshieldedtransfertransition_binding_signature: (a: number) => [number, number];
    readonly tokenshieldedtransfertransition_constructor: (a: any) => [number, number, number];
    readonly tokenshieldedtransfertransition_proof: (a: number) => [number, number];
    readonly tokenshieldedtransfertransition_set_base: (a: number, b: number) => void;
    readonly tokenshieldedtransfertransition_struct_name: () => [number, number];
    readonly tokenshieldedtransfertransition_type_name: (a: number) => [number, number];
    readonly verifiedmasternodevote_fromJSON: (a: any) => [number, number, number];
    readonly verifiedmasternodevote_fromObject: (a: any) => [number, number, number];
    readonly verifiedmasternodevote_struct_name: () => [number, number];
    readonly verifiedmasternodevote_toJSON: (a: number) => [number, number, number];
    readonly verifiedmasternodevote_toObject: (a: number) => [number, number, number];
    readonly verifiedmasternodevote_type_name: (a: number) => [number, number];
    readonly verifiednextdistribution_fromJSON: (a: any) => [number, number, number];
    readonly verifiednextdistribution_fromObject: (a: any) => [number, number, number];
    readonly verifiednextdistribution_struct_name: () => [number, number];
    readonly verifiednextdistribution_toJSON: (a: number) => [number, number, number];
    readonly verifiednextdistribution_toObject: (a: number) => [number, number, number];
    readonly verifiednextdistribution_type_name: (a: number) => [number, number];
    readonly masternodevotetransition_user_fee_increase: (a: number) => number;
    readonly __wbg_set_verifiednextdistribution_vote: (a: number, b: number) => void;
    readonly identity_module_brand: () => any;
    readonly identitytopupfromaddressestransition_module_brand: () => any;
    readonly masternodevotetransition_module_brand: () => any;
    readonly statetransition_module_brand: () => any;
    readonly tokenminttopooltransition_module_brand: () => any;
    readonly tokenshieldedtransfertransition_module_brand: () => any;
    readonly verifiedmasternodevote_module_brand: () => any;
    readonly verifiednextdistribution_module_brand: () => any;
    readonly __wbg_consensuserror_free: (a: number, b: number) => void;
    readonly __wbg_get_verifiedbalancetransfer_recipient: (a: number) => number;
    readonly __wbg_get_verifiedbalancetransfer_sender: (a: number) => number;
    readonly __wbg_get_verifiedidentity_identity: (a: number) => number;
    readonly __wbg_get_verifiedidentityfullwithaddressinfos_identity: (a: number) => number;
    readonly __wbg_get_verifiedidentitywithaddressinfos_partialIdentity: (a: number) => number;
    readonly __wbg_get_verifiedpartialidentity_partialIdentity: (a: number) => number;
    readonly __wbg_identitycredittransfertoaddresses_free: (a: number, b: number) => void;
    readonly __wbg_prefundedvotingbalance_free: (a: number, b: number) => void;
    readonly __wbg_set_verifiedbalancetransfer_recipient: (a: number, b: number) => void;
    readonly __wbg_set_verifiedbalancetransfer_sender: (a: number, b: number) => void;
    readonly __wbg_set_verifiedidentity_identity: (a: number, b: number) => void;
    readonly __wbg_tokenshieldtransition_free: (a: number, b: number) => void;
    readonly __wbg_verifiedaddressinfos_free: (a: number, b: number) => void;
    readonly __wbg_verifiedbalancetransfer_free: (a: number, b: number) => void;
    readonly __wbg_verifiedidentity_free: (a: number, b: number) => void;
    readonly __wbg_verifiedidentityfullwithaddressinfos_free: (a: number, b: number) => void;
    readonly __wbg_verifiedidentitywithaddressinfos_free: (a: number, b: number) => void;
    readonly __wbg_verifiedpartialidentity_free: (a: number, b: number) => void;
    readonly consensuserror_code: (a: number) => number;
    readonly consensuserror_deserialize: (a: number, b: number) => [number, number, number];
    readonly consensuserror_document_distinct_from_error_code: (a: number) => number;
    readonly consensuserror_document_encryption_error_code: (a: number) => number;
    readonly consensuserror_document_generated_from_error_code: (a: number) => number;
    readonly consensuserror_document_immutability_error_code: (a: number) => number;
    readonly consensuserror_document_max_bytes_error_code: (a: number) => number;
    readonly consensuserror_document_property_constraint_error_code: (a: number) => number;
    readonly consensuserror_document_reference_error_code: (a: number) => number;
    readonly consensuserror_message: (a: number) => [number, number];
    readonly consensuserror_struct_name: () => [number, number];
    readonly consensuserror_type_name: (a: number) => [number, number];
    readonly identitycredittransfertoaddresses_constructor: (a: any) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromJSON: (a: any) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromObject: (a: any) => [number, number, number];
    readonly identitycredittransfertoaddresses_fromStateTransition: (a: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_nonce: (a: number) => bigint;
    readonly identitycredittransfertoaddresses_recipient_addresses: (a: number) => [number, number];
    readonly identitycredittransfertoaddresses_sender_id: (a: number) => number;
    readonly identitycredittransfertoaddresses_set_nonce: (a: number, b: any) => [number, number];
    readonly identitycredittransfertoaddresses_set_recipient_addresses: (a: number, b: number, c: number) => [number, number];
    readonly identitycredittransfertoaddresses_set_sender_id: (a: number, b: any) => [number, number];
    readonly identitycredittransfertoaddresses_set_signature: (a: number, b: number, c: number) => void;
    readonly identitycredittransfertoaddresses_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly identitycredittransfertoaddresses_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitycredittransfertoaddresses_signature: (a: number) => [number, number];
    readonly identitycredittransfertoaddresses_signature_public_key_id: (a: number) => number;
    readonly identitycredittransfertoaddresses_struct_name: () => [number, number];
    readonly identitycredittransfertoaddresses_toBase64: (a: number) => [number, number, number, number];
    readonly identitycredittransfertoaddresses_toBytes: (a: number) => [number, number, number, number];
    readonly identitycredittransfertoaddresses_toHex: (a: number) => [number, number, number, number];
    readonly identitycredittransfertoaddresses_toJSON: (a: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_toObject: (a: number) => [number, number, number];
    readonly identitycredittransfertoaddresses_toStateTransition: (a: number) => number;
    readonly identitycredittransfertoaddresses_type_name: (a: number) => [number, number];
    readonly identitycredittransfertoaddresses_user_fee_increase: (a: number) => number;
    readonly prefundedvotingbalance_constructor: (a: any) => [number, number, number];
    readonly prefundedvotingbalance_credits: (a: number) => bigint;
    readonly prefundedvotingbalance_indexName: (a: number) => [number, number];
    readonly prefundedvotingbalance_struct_name: () => [number, number];
    readonly prefundedvotingbalance_type_name: (a: number) => [number, number];
    readonly tokenshieldtransition_actions: (a: number) => [number, number];
    readonly tokenshieldtransition_amount: (a: number) => bigint;
    readonly tokenshieldtransition_anchor: (a: number) => [number, number];
    readonly tokenshieldtransition_base: (a: number) => number;
    readonly tokenshieldtransition_binding_signature: (a: number) => [number, number];
    readonly tokenshieldtransition_constructor: (a: any) => [number, number, number];
    readonly tokenshieldtransition_proof: (a: number) => [number, number];
    readonly tokenshieldtransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokenshieldtransition_set_base: (a: number, b: number) => void;
    readonly tokenshieldtransition_struct_name: () => [number, number];
    readonly tokenshieldtransition_type_name: (a: number) => [number, number];
    readonly verifiedaddressinfos_address_infos: (a: number) => any;
    readonly verifiedaddressinfos_fromJSON: (a: any) => [number, number, number];
    readonly verifiedaddressinfos_fromObject: (a: any) => [number, number, number];
    readonly verifiedaddressinfos_struct_name: () => [number, number];
    readonly verifiedaddressinfos_toJSON: (a: number) => [number, number, number];
    readonly verifiedaddressinfos_toObject: (a: number) => any;
    readonly verifiedaddressinfos_type_name: (a: number) => [number, number];
    readonly verifiedbalancetransfer_fromJSON: (a: any) => [number, number, number];
    readonly verifiedbalancetransfer_fromObject: (a: any) => [number, number, number];
    readonly verifiedbalancetransfer_struct_name: () => [number, number];
    readonly verifiedbalancetransfer_toJSON: (a: number) => [number, number, number];
    readonly verifiedbalancetransfer_toObject: (a: number) => [number, number, number];
    readonly verifiedbalancetransfer_type_name: (a: number) => [number, number];
    readonly verifiedidentity_fromJSON: (a: any) => [number, number, number];
    readonly verifiedidentity_fromObject: (a: any) => [number, number, number];
    readonly verifiedidentity_struct_name: () => [number, number];
    readonly verifiedidentity_toJSON: (a: number) => [number, number, number];
    readonly verifiedidentity_toObject: (a: number) => [number, number, number];
    readonly verifiedidentity_type_name: (a: number) => [number, number];
    readonly verifiedidentityfullwithaddressinfos_address_infos: (a: number) => any;
    readonly verifiedidentityfullwithaddressinfos_fromJSON: (a: any) => [number, number, number];
    readonly verifiedidentityfullwithaddressinfos_fromObject: (a: any) => [number, number, number];
    readonly verifiedidentityfullwithaddressinfos_struct_name: () => [number, number];
    readonly verifiedidentityfullwithaddressinfos_toJSON: (a: number) => [number, number, number];
    readonly verifiedidentityfullwithaddressinfos_toObject: (a: number) => [number, number, number];
    readonly verifiedidentityfullwithaddressinfos_type_name: (a: number) => [number, number];
    readonly verifiedidentitywithaddressinfos_address_infos: (a: number) => any;
    readonly verifiedidentitywithaddressinfos_fromJSON: (a: any) => [number, number, number];
    readonly verifiedidentitywithaddressinfos_fromObject: (a: any) => [number, number, number];
    readonly verifiedidentitywithaddressinfos_struct_name: () => [number, number];
    readonly verifiedidentitywithaddressinfos_toJSON: (a: number) => [number, number, number];
    readonly verifiedidentitywithaddressinfos_toObject: (a: number) => [number, number, number];
    readonly verifiedidentitywithaddressinfos_type_name: (a: number) => [number, number];
    readonly verifiedpartialidentity_fromJSON: (a: any) => [number, number, number];
    readonly verifiedpartialidentity_fromObject: (a: any) => [number, number, number];
    readonly verifiedpartialidentity_struct_name: () => [number, number];
    readonly verifiedpartialidentity_toJSON: (a: number) => [number, number, number];
    readonly verifiedpartialidentity_toObject: (a: number) => [number, number, number];
    readonly verifiedpartialidentity_type_name: (a: number) => [number, number];
    readonly __wbg_set_verifiedidentityfullwithaddressinfos_identity: (a: number, b: number) => void;
    readonly __wbg_set_verifiedidentitywithaddressinfos_partialIdentity: (a: number, b: number) => void;
    readonly __wbg_set_verifiedpartialidentity_partialIdentity: (a: number, b: number) => void;
    readonly consensuserror_module_brand: () => any;
    readonly identitycredittransfertoaddresses_module_brand: () => any;
    readonly prefundedvotingbalance_module_brand: () => any;
    readonly tokenshieldtransition_module_brand: () => any;
    readonly verifiedaddressinfos_module_brand: () => any;
    readonly verifiedbalancetransfer_module_brand: () => any;
    readonly verifiedidentity_module_brand: () => any;
    readonly verifiedidentityfullwithaddressinfos_module_brand: () => any;
    readonly verifiedidentitywithaddressinfos_module_brand: () => any;
    readonly verifiedpartialidentity_module_brand: () => any;
    readonly __wbg_addresscreditwithdrawaltransition_free: (a: number, b: number) => void;
    readonly __wbg_assetlockproof_free: (a: number, b: number) => void;
    readonly __wbg_batchtransition_free: (a: number, b: number) => void;
    readonly __wbg_corescript_free: (a: number, b: number) => void;
    readonly __wbg_documentdeletetransition_free: (a: number, b: number) => void;
    readonly __wbg_identitycredittransfer_free: (a: number, b: number) => void;
    readonly __wbg_identitycreditwithdrawaltransition_free: (a: number, b: number) => void;
    readonly __wbg_identitykeylimitsupdate_free: (a: number, b: number) => void;
    readonly __wbg_identitytokeninfo_free: (a: number, b: number) => void;
    readonly __wbg_outpoint_free: (a: number, b: number) => void;
    readonly __wbg_resourcevote_free: (a: number, b: number) => void;
    readonly __wbg_tokenconfigurationchangeitem_free: (a: number, b: number) => void;
    readonly __wbg_tokenfreezetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenminttransition_free: (a: number, b: number) => void;
    readonly __wbg_tokentransfertransition_free: (a: number, b: number) => void;
    readonly __wbg_wasmdpperror_free: (a: number, b: number) => void;
    readonly addresscreditwithdrawaltransition_constructor: (a: any) => [number, number, number];
    readonly addresscreditwithdrawaltransition_core_fee_per_byte: (a: number) => number;
    readonly addresscreditwithdrawaltransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_fromJSON: (a: any) => [number, number, number];
    readonly addresscreditwithdrawaltransition_fromObject: (a: any) => [number, number, number];
    readonly addresscreditwithdrawaltransition_fromStateTransition: (a: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_inputs: (a: number) => [number, number];
    readonly addresscreditwithdrawaltransition_output: (a: number) => number;
    readonly addresscreditwithdrawaltransition_output_script: (a: number) => number;
    readonly addresscreditwithdrawaltransition_pooling: (a: number) => [number, number];
    readonly addresscreditwithdrawaltransition_set_core_fee_per_byte: (a: number, b: any) => [number, number];
    readonly addresscreditwithdrawaltransition_set_inputs: (a: number, b: number, c: number) => [number, number];
    readonly addresscreditwithdrawaltransition_set_output: (a: number, b: number) => [number, number];
    readonly addresscreditwithdrawaltransition_set_output_script: (a: number, b: number) => void;
    readonly addresscreditwithdrawaltransition_set_pooling: (a: number, b: any) => [number, number];
    readonly addresscreditwithdrawaltransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly addresscreditwithdrawaltransition_struct_name: () => [number, number];
    readonly addresscreditwithdrawaltransition_toBase64: (a: number) => [number, number, number, number];
    readonly addresscreditwithdrawaltransition_toBytes: (a: number) => [number, number, number, number];
    readonly addresscreditwithdrawaltransition_toHex: (a: number) => [number, number, number, number];
    readonly addresscreditwithdrawaltransition_toJSON: (a: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_toObject: (a: number) => [number, number, number];
    readonly addresscreditwithdrawaltransition_toStateTransition: (a: number) => number;
    readonly addresscreditwithdrawaltransition_type_name: (a: number) => [number, number];
    readonly addresscreditwithdrawaltransition_user_fee_increase: (a: number) => number;
    readonly assetlockproof_chain_lock_proof: (a: number) => number;
    readonly assetlockproof_constructor: (a: any) => [number, number, number];
    readonly assetlockproof_createChainAssetLockProof: (a: number, b: number) => [number, number, number];
    readonly assetlockproof_createIdentityId: (a: number) => [number, number, number];
    readonly assetlockproof_createInstantAssetLockProof: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly assetlockproof_fromBytes: (a: number, b: number) => [number, number, number];
    readonly assetlockproof_fromHex: (a: number, b: number) => [number, number, number];
    readonly assetlockproof_fromJSON: (a: any) => [number, number, number];
    readonly assetlockproof_fromObject: (a: any) => [number, number, number];
    readonly assetlockproof_instant_lock_proof: (a: number) => number;
    readonly assetlockproof_lock_type: (a: number) => [number, number];
    readonly assetlockproof_out_point: (a: number) => number;
    readonly assetlockproof_struct_name: () => [number, number];
    readonly assetlockproof_toBytes: (a: number) => [number, number, number, number];
    readonly assetlockproof_toHex: (a: number) => [number, number, number, number];
    readonly assetlockproof_toJSON: (a: number) => [number, number, number];
    readonly assetlockproof_toObject: (a: number) => [number, number, number];
    readonly assetlockproof_type_name: (a: number) => [number, number];
    readonly batchtransition_all_conflicting_index_collateral_voting_funds: (a: number) => [number, bigint, number, number];
    readonly batchtransition_all_purchases_amount: (a: number) => [number, bigint, number, number];
    readonly batchtransition_batched_transitions: (a: number) => [number, number];
    readonly batchtransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly batchtransition_fromBatchedTransitions: (a: any, b: any, c: number) => [number, number, number];
    readonly batchtransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly batchtransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly batchtransition_fromJSON: (a: any) => [number, number, number];
    readonly batchtransition_fromObject: (a: any) => [number, number, number];
    readonly batchtransition_fromStateTransition: (a: number) => [number, number, number];
    readonly batchtransition_modified_data_ids: (a: number) => [number, number];
    readonly batchtransition_owner_id: (a: number) => number;
    readonly batchtransition_setIdentityContractNonce: (a: number, b: any) => [number, number];
    readonly batchtransition_set_signature: (a: number, b: number, c: number) => void;
    readonly batchtransition_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly batchtransition_set_transitions: (a: number, b: any) => [number, number];
    readonly batchtransition_signature: (a: number) => [number, number];
    readonly batchtransition_signature_public_key_id: (a: number) => number;
    readonly batchtransition_struct_name: () => [number, number];
    readonly batchtransition_toBase64: (a: number) => [number, number, number, number];
    readonly batchtransition_toBytes: (a: number) => [number, number, number, number];
    readonly batchtransition_toHex: (a: number) => [number, number, number, number];
    readonly batchtransition_toJSON: (a: number) => [number, number, number];
    readonly batchtransition_toObject: (a: number) => [number, number, number];
    readonly batchtransition_toStateTransition: (a: number) => number;
    readonly batchtransition_type_name: (a: number) => [number, number];
    readonly corescript_fromBytes: (a: number, b: number) => number;
    readonly corescript_fromP2PKH: (a: number, b: number) => [number, number, number];
    readonly corescript_fromP2SH: (a: number, b: number) => [number, number, number];
    readonly corescript_struct_name: () => [number, number];
    readonly corescript_toASMString: (a: number) => [number, number];
    readonly corescript_toAddress: (a: number, b: any) => [number, number, number, number];
    readonly corescript_toBase64: (a: number) => [number, number];
    readonly corescript_toBytes: (a: number) => [number, number];
    readonly corescript_toHex: (a: number) => [number, number];
    readonly corescript_toString: (a: number) => [number, number];
    readonly corescript_type_name: (a: number) => [number, number];
    readonly documentdeletetransition_base: (a: number) => number;
    readonly documentdeletetransition_constructor: (a: any) => [number, number, number];
    readonly documentdeletetransition_fromDocumentTransition: (a: number) => [number, number, number];
    readonly documentdeletetransition_set_base: (a: number, b: number) => void;
    readonly documentdeletetransition_struct_name: () => [number, number];
    readonly documentdeletetransition_toDocumentTransition: (a: number) => number;
    readonly documentdeletetransition_type_name: (a: number) => [number, number];
    readonly identitycredittransfer_amount: (a: number) => bigint;
    readonly identitycredittransfer_constructor: (a: any) => [number, number, number];
    readonly identitycredittransfer_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfer_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfer_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitycredittransfer_fromJSON: (a: any) => [number, number, number];
    readonly identitycredittransfer_fromObject: (a: any) => [number, number, number];
    readonly identitycredittransfer_fromStateTransition: (a: number) => [number, number, number];
    readonly identitycredittransfer_nonce: (a: number) => bigint;
    readonly identitycredittransfer_recipient_id: (a: number) => number;
    readonly identitycredittransfer_sender_id: (a: number) => number;
    readonly identitycredittransfer_set_amount: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_set_nonce: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_set_recipient_id: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_set_sender_id: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_set_signature: (a: number, b: number, c: number) => void;
    readonly identitycredittransfer_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitycredittransfer_signature: (a: number) => [number, number];
    readonly identitycredittransfer_signature_public_key_id: (a: number) => number;
    readonly identitycredittransfer_struct_name: () => [number, number];
    readonly identitycredittransfer_toBase64: (a: number) => [number, number, number, number];
    readonly identitycredittransfer_toBytes: (a: number) => [number, number, number, number];
    readonly identitycredittransfer_toHex: (a: number) => [number, number, number, number];
    readonly identitycredittransfer_toJSON: (a: number) => [number, number, number];
    readonly identitycredittransfer_toObject: (a: number) => [number, number, number];
    readonly identitycredittransfer_toStateTransition: (a: number) => number;
    readonly identitycredittransfer_type_name: (a: number) => [number, number];
    readonly identitycredittransfer_user_fee_increase: (a: number) => number;
    readonly identitycreditwithdrawaltransition_amount: (a: number) => bigint;
    readonly identitycreditwithdrawaltransition_constructor: (a: any) => [number, number, number];
    readonly identitycreditwithdrawaltransition_core_fee_per_byte: (a: number) => number;
    readonly identitycreditwithdrawaltransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_fromJSON: (a: any) => [number, number, number];
    readonly identitycreditwithdrawaltransition_fromObject: (a: any) => [number, number, number];
    readonly identitycreditwithdrawaltransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_identity_id: (a: number) => number;
    readonly identitycreditwithdrawaltransition_modified_data_ids: (a: number) => [number, number];
    readonly identitycreditwithdrawaltransition_nonce: (a: number) => bigint;
    readonly identitycreditwithdrawaltransition_optional_asset_lock_proof: (a: number) => number;
    readonly identitycreditwithdrawaltransition_output_script: (a: number) => number;
    readonly identitycreditwithdrawaltransition_pooling: (a: number) => [number, number];
    readonly identitycreditwithdrawaltransition_purpose_requirement: (a: number) => [number, number];
    readonly identitycreditwithdrawaltransition_set_amount: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_core_fee_per_byte: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_identity_id: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_nonce: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_output_script: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_pooling: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_set_signature: (a: number, b: number, c: number) => void;
    readonly identitycreditwithdrawaltransition_set_signature_public_key_id: (a: number, b: number) => void;
    readonly identitycreditwithdrawaltransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitycreditwithdrawaltransition_signature: (a: number) => [number, number];
    readonly identitycreditwithdrawaltransition_signature_public_key_id: (a: number) => number;
    readonly identitycreditwithdrawaltransition_struct_name: () => [number, number];
    readonly identitycreditwithdrawaltransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitycreditwithdrawaltransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitycreditwithdrawaltransition_toHex: (a: number) => [number, number, number, number];
    readonly identitycreditwithdrawaltransition_toJSON: (a: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_toObject: (a: number) => [number, number, number];
    readonly identitycreditwithdrawaltransition_toStateTransition: (a: number) => number;
    readonly identitycreditwithdrawaltransition_type_name: (a: number) => [number, number];
    readonly identitycreditwithdrawaltransition_user_fee_increase: (a: number) => number;
    readonly identitykeylimitsupdate_constructor: (a: any) => [number, number, number];
    readonly identitykeylimitsupdate_expires_at: (a: number) => [number, bigint];
    readonly identitykeylimitsupdate_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitykeylimitsupdate_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitykeylimitsupdate_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitykeylimitsupdate_fromJSON: (a: any) => [number, number, number];
    readonly identitykeylimitsupdate_fromObject: (a: any) => [number, number, number];
    readonly identitykeylimitsupdate_fromStateTransition: (a: number) => [number, number, number];
    readonly identitykeylimitsupdate_identity_id: (a: number) => number;
    readonly identitykeylimitsupdate_key_id: (a: number) => number;
    readonly identitykeylimitsupdate_nonce: (a: number) => bigint;
    readonly identitykeylimitsupdate_set_expires_at: (a: number, b: number) => [number, number];
    readonly identitykeylimitsupdate_set_identity_id: (a: number, b: any) => [number, number];
    readonly identitykeylimitsupdate_set_key_id: (a: number, b: any) => [number, number];
    readonly identitykeylimitsupdate_set_nonce: (a: number, b: any) => [number, number];
    readonly identitykeylimitsupdate_set_signature: (a: number, b: number, c: number) => void;
    readonly identitykeylimitsupdate_set_signature_public_key_id: (a: number, b: any) => [number, number];
    readonly identitykeylimitsupdate_set_total_budget: (a: number, b: number) => [number, number];
    readonly identitykeylimitsupdate_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitykeylimitsupdate_signature: (a: number) => [number, number];
    readonly identitykeylimitsupdate_signature_public_key_id: (a: number) => number;
    readonly identitykeylimitsupdate_struct_name: () => [number, number];
    readonly identitykeylimitsupdate_toBase64: (a: number) => [number, number, number, number];
    readonly identitykeylimitsupdate_toBytes: (a: number) => [number, number, number, number];
    readonly identitykeylimitsupdate_toHex: (a: number) => [number, number, number, number];
    readonly identitykeylimitsupdate_toJSON: (a: number) => [number, number, number];
    readonly identitykeylimitsupdate_toObject: (a: number) => [number, number, number];
    readonly identitykeylimitsupdate_toStateTransition: (a: number) => number;
    readonly identitykeylimitsupdate_total_budget: (a: number) => [number, bigint];
    readonly identitykeylimitsupdate_type_name: (a: number) => [number, number];
    readonly identitykeylimitsupdate_user_fee_increase: (a: number) => number;
    readonly identitytokeninfo_is_frozen: (a: number) => number;
    readonly identitytokeninfo_struct_name: () => [number, number];
    readonly identitytokeninfo_type_name: (a: number) => [number, number];
    readonly outpoint_constructor: (a: number, b: number, c: number) => [number, number, number];
    readonly outpoint_fromBase64: (a: number, b: number) => [number, number, number];
    readonly outpoint_fromBytes: (a: number, b: number) => [number, number, number];
    readonly outpoint_fromHex: (a: number, b: number) => [number, number, number];
    readonly outpoint_struct_name: () => [number, number];
    readonly outpoint_toBase64: (a: number) => [number, number];
    readonly outpoint_toBytes: (a: number) => [number, number];
    readonly outpoint_toHex: (a: number) => [number, number];
    readonly outpoint_txid: (a: number) => [number, number];
    readonly outpoint_type_name: (a: number) => [number, number];
    readonly outpoint_vout: (a: number) => number;
    readonly resourcevote_choice: (a: number) => number;
    readonly resourcevote_constructor: (a: number, b: number) => number;
    readonly resourcevote_fromJSON: (a: any) => [number, number, number];
    readonly resourcevote_fromObject: (a: any) => [number, number, number];
    readonly resourcevote_poll: (a: number) => number;
    readonly resourcevote_set_choice: (a: number, b: number) => void;
    readonly resourcevote_set_poll: (a: number, b: number) => void;
    readonly resourcevote_struct_name: () => [number, number];
    readonly resourcevote_toJSON: (a: number) => [number, number, number];
    readonly resourcevote_toObject: (a: number) => [number, number, number];
    readonly resourcevote_type_name: (a: number) => [number, number];
    readonly tokenconfigurationchangeitem_item: (a: number) => any;
    readonly tokenconfigurationchangeitem_item_name: (a: number) => [number, number];
    readonly tokenconfigurationchangeitem_struct_name: () => [number, number];
    readonly tokenconfigurationchangeitem_type_name: (a: number) => [number, number];
    readonly tokenfreezetransition_base: (a: number) => number;
    readonly tokenfreezetransition_constructor: (a: any) => [number, number, number];
    readonly tokenfreezetransition_frozen_identity_id: (a: number) => number;
    readonly tokenfreezetransition_public_note: (a: number) => [number, number];
    readonly tokenfreezetransition_set_base: (a: number, b: number) => void;
    readonly tokenfreezetransition_set_frozen_identity_id: (a: number, b: any) => [number, number];
    readonly tokenfreezetransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenfreezetransition_struct_name: () => [number, number];
    readonly tokenfreezetransition_type_name: (a: number) => [number, number];
    readonly tokenminttransition_amount: (a: number) => bigint;
    readonly tokenminttransition_base: (a: number) => number;
    readonly tokenminttransition_constructor: (a: any) => [number, number, number];
    readonly tokenminttransition_getRecipientId: (a: number, b: number) => [number, number, number];
    readonly tokenminttransition_issued_to_identity_id: (a: number) => number;
    readonly tokenminttransition_public_note: (a: number) => [number, number];
    readonly tokenminttransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokenminttransition_set_base: (a: number, b: number) => void;
    readonly tokenminttransition_set_issued_to_identity_id: (a: number, b: any) => [number, number];
    readonly tokenminttransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenminttransition_struct_name: () => [number, number];
    readonly tokenminttransition_type_name: (a: number) => [number, number];
    readonly tokentransfertransition_amount: (a: number) => bigint;
    readonly tokentransfertransition_base: (a: number) => number;
    readonly tokentransfertransition_constructor: (a: any) => [number, number, number];
    readonly tokentransfertransition_private_encrypted_note: (a: number) => number;
    readonly tokentransfertransition_public_note: (a: number) => [number, number];
    readonly tokentransfertransition_recipient_id: (a: number) => number;
    readonly tokentransfertransition_set_amount: (a: number, b: any) => [number, number];
    readonly tokentransfertransition_set_base: (a: number, b: number) => void;
    readonly tokentransfertransition_set_private_encrypted_note: (a: number, b: any) => [number, number];
    readonly tokentransfertransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokentransfertransition_set_recipient_id: (a: number, b: any) => [number, number];
    readonly tokentransfertransition_set_shared_encrypted_note: (a: number, b: any) => [number, number];
    readonly tokentransfertransition_shared_encrypted_note: (a: number) => number;
    readonly tokentransfertransition_struct_name: () => [number, number];
    readonly tokentransfertransition_type_name: (a: number) => [number, number];
    readonly wasmdpperror_code: (a: number) => number;
    readonly wasmdpperror_kind: (a: number) => number;
    readonly wasmdpperror_message: (a: number) => [number, number];
    readonly wasmdpperror_name: (a: number) => [number, number];
    readonly addresscreditwithdrawaltransition_module_brand: () => any;
    readonly assetlockproof_module_brand: () => any;
    readonly batchtransition_module_brand: () => any;
    readonly corescript_module_brand: () => any;
    readonly documentdeletetransition_module_brand: () => any;
    readonly identitycredittransfer_module_brand: () => any;
    readonly identitycreditwithdrawaltransition_module_brand: () => any;
    readonly identitykeylimitsupdate_module_brand: () => any;
    readonly identitytokeninfo_module_brand: () => any;
    readonly outpoint_module_brand: () => any;
    readonly resourcevote_module_brand: () => any;
    readonly tokenconfigurationchangeitem_module_brand: () => any;
    readonly tokenfreezetransition_module_brand: () => any;
    readonly tokenminttransition_module_brand: () => any;
    readonly tokentransfertransition_module_brand: () => any;
    readonly __wbg_authorizedactiontakers_free: (a: number, b: number) => void;
    readonly __wbg_get_verifiedassetlockconsumed_status: (a: number) => [number, number];
    readonly __wbg_get_verifiedidentitywithshieldednullifiers_identity: (a: number) => number;
    readonly __wbg_groupaction_free: (a: number, b: number) => void;
    readonly __wbg_groupactionevent_free: (a: number, b: number) => void;
    readonly __wbg_identitytopupfromshieldedpooltransition_free: (a: number, b: number) => void;
    readonly __wbg_identityupdatetransition_free: (a: number, b: number) => void;
    readonly __wbg_set_verifiedassetlockconsumed_status: (a: number, b: number, c: number) => void;
    readonly __wbg_set_verifiedidentitywithshieldednullifiers_identity: (a: number, b: number) => void;
    readonly __wbg_shieldedwithdrawaltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenburntransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenconfigurationlocalization_free: (a: number, b: number) => void;
    readonly __wbg_tokenevent_free: (a: number, b: number) => void;
    readonly __wbg_tokenpricingschedule_free: (a: number, b: number) => void;
    readonly __wbg_tokensetpricefordirectpurchasetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokentransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenunshieldwithshieldedfeetransition_free: (a: number, b: number) => void;
    readonly __wbg_verifiedassetlockconsumed_free: (a: number, b: number) => void;
    readonly __wbg_verifiedassetlockconsumedwithaddressinfos_free: (a: number, b: number) => void;
    readonly __wbg_verifiedidentitywithshieldednullifiers_free: (a: number, b: number) => void;
    readonly __wbg_verifiedshieldednullifiers_free: (a: number, b: number) => void;
    readonly __wbg_verifiedshieldednullifierswithaddressinfos_free: (a: number, b: number) => void;
    readonly __wbg_verifiedshieldednullifierswithwithdrawaldocument_free: (a: number, b: number) => void;
    readonly __wbg_verifiedshieldedpoolstate_free: (a: number, b: number) => void;
    readonly __wbg_verifiedtokengroupactionwithshieldednullifiers_free: (a: number, b: number) => void;
    readonly authorizedactiontakers_ContractOwner: () => number;
    readonly authorizedactiontakers_Group: (a: number) => number;
    readonly authorizedactiontakers_Identity: (a: any) => [number, number, number];
    readonly authorizedactiontakers_MainGroup: () => number;
    readonly authorizedactiontakers_NoOne: () => number;
    readonly authorizedactiontakers_struct_name: () => [number, number];
    readonly authorizedactiontakers_taker_type: (a: number) => [number, number];
    readonly authorizedactiontakers_type_name: (a: number) => [number, number];
    readonly authorizedactiontakers_value: (a: number) => any;
    readonly groupaction_contract_id: (a: number) => number;
    readonly groupaction_event: (a: number) => number;
    readonly groupaction_fromJSON: (a: any) => [number, number, number];
    readonly groupaction_fromObject: (a: any) => [number, number, number];
    readonly groupaction_proposer_id: (a: number) => number;
    readonly groupaction_struct_name: () => [number, number];
    readonly groupaction_toJSON: (a: number) => [number, number, number];
    readonly groupaction_toObject: (a: number) => [number, number, number];
    readonly groupaction_token_contract_position: (a: number) => number;
    readonly groupaction_type_name: (a: number) => [number, number];
    readonly groupactionevent_eventName: (a: number) => [number, number];
    readonly groupactionevent_fromJSON: (a: any) => [number, number, number];
    readonly groupactionevent_fromObject: (a: any) => [number, number, number];
    readonly groupactionevent_publicNote: (a: number) => [number, number];
    readonly groupactionevent_struct_name: () => [number, number];
    readonly groupactionevent_toJSON: (a: number) => [number, number, number];
    readonly groupactionevent_toObject: (a: number) => [number, number, number];
    readonly groupactionevent_tokenEvent: (a: number) => number;
    readonly groupactionevent_type_name: (a: number) => [number, number];
    readonly groupactionevent_variant: (a: number) => number;
    readonly identitytopupfromshieldedpooltransition_actions: (a: number) => [number, number];
    readonly identitytopupfromshieldedpooltransition_anchor: (a: number) => [number, number];
    readonly identitytopupfromshieldedpooltransition_binding_signature: (a: number) => [number, number];
    readonly identitytopupfromshieldedpooltransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_fromJSON: (a: any) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_fromObject: (a: any) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_getModifiedDataIds: (a: number) => [number, number];
    readonly identitytopupfromshieldedpooltransition_identity_id: (a: number) => number;
    readonly identitytopupfromshieldedpooltransition_new: (a: any) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_proof: (a: number) => [number, number];
    readonly identitytopupfromshieldedpooltransition_struct_name: () => [number, number];
    readonly identitytopupfromshieldedpooltransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitytopupfromshieldedpooltransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitytopupfromshieldedpooltransition_toHex: (a: number) => [number, number, number, number];
    readonly identitytopupfromshieldedpooltransition_toJSON: (a: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_toObject: (a: number) => [number, number, number];
    readonly identitytopupfromshieldedpooltransition_toStateTransition: (a: number) => number;
    readonly identitytopupfromshieldedpooltransition_top_up_amount: (a: number) => bigint;
    readonly identitytopupfromshieldedpooltransition_type_name: (a: number) => [number, number];
    readonly identityupdatetransition_constructor: (a: any) => [number, number, number];
    readonly identityupdatetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identityupdatetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identityupdatetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identityupdatetransition_fromJSON: (a: any) => [number, number, number];
    readonly identityupdatetransition_fromObject: (a: any) => [number, number, number];
    readonly identityupdatetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identityupdatetransition_identity_identifier: (a: number) => number;
    readonly identityupdatetransition_modified_data_ids: (a: number) => [number, number];
    readonly identityupdatetransition_nonce: (a: number) => bigint;
    readonly identityupdatetransition_optional_asset_lock_proof: (a: number) => number;
    readonly identityupdatetransition_public_key_ids_to_add: (a: number) => [number, number];
    readonly identityupdatetransition_public_key_ids_to_disable: (a: number) => [number, number];
    readonly identityupdatetransition_purpose_requirement: (a: number) => [number, number];
    readonly identityupdatetransition_revision: (a: number) => bigint;
    readonly identityupdatetransition_set_identity_identifier: (a: number, b: any) => [number, number];
    readonly identityupdatetransition_set_nonce: (a: number, b: any) => [number, number];
    readonly identityupdatetransition_set_public_key_ids_to_add: (a: number, b: any) => [number, number];
    readonly identityupdatetransition_set_public_key_ids_to_disable: (a: number, b: number, c: number) => void;
    readonly identityupdatetransition_set_revision: (a: number, b: any) => [number, number];
    readonly identityupdatetransition_set_signature: (a: number, b: number, c: number) => void;
    readonly identityupdatetransition_set_signature_public_key_id: (a: number, b: number) => void;
    readonly identityupdatetransition_set_user_fee_increase: (a: number, b: number) => void;
    readonly identityupdatetransition_signature: (a: number) => [number, number];
    readonly identityupdatetransition_signature_public_key_id: (a: number) => number;
    readonly identityupdatetransition_struct_name: () => [number, number];
    readonly identityupdatetransition_toBase64: (a: number) => [number, number, number, number];
    readonly identityupdatetransition_toBytes: (a: number) => [number, number, number, number];
    readonly identityupdatetransition_toHex: (a: number) => [number, number, number, number];
    readonly identityupdatetransition_toJSON: (a: number) => [number, number, number];
    readonly identityupdatetransition_toObject: (a: number) => [number, number, number];
    readonly identityupdatetransition_toStateTransition: (a: number) => number;
    readonly identityupdatetransition_type_name: (a: number) => [number, number];
    readonly identityupdatetransition_user_fee_increase: (a: number) => number;
    readonly shieldedwithdrawaltransition_actions: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_anchor: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_binding_signature: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_core_fee_per_byte: (a: number) => number;
    readonly shieldedwithdrawaltransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly shieldedwithdrawaltransition_fromJSON: (a: any) => [number, number, number];
    readonly shieldedwithdrawaltransition_fromObject: (a: any) => [number, number, number];
    readonly shieldedwithdrawaltransition_getModifiedDataIds: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_new: (a: any) => [number, number, number];
    readonly shieldedwithdrawaltransition_output_script: (a: number) => number;
    readonly shieldedwithdrawaltransition_pooling: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_proof: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_struct_name: () => [number, number];
    readonly shieldedwithdrawaltransition_toBytes: (a: number) => [number, number, number, number];
    readonly shieldedwithdrawaltransition_toJSON: (a: number) => [number, number, number];
    readonly shieldedwithdrawaltransition_toObject: (a: number) => [number, number, number];
    readonly shieldedwithdrawaltransition_toStateTransition: (a: number) => number;
    readonly shieldedwithdrawaltransition_type_name: (a: number) => [number, number];
    readonly shieldedwithdrawaltransition_unshielding_amount: (a: number) => bigint;
    readonly tokenburntransition_base: (a: number) => number;
    readonly tokenburntransition_burn_amount: (a: number) => bigint;
    readonly tokenburntransition_constructor: (a: any) => [number, number, number];
    readonly tokenburntransition_public_note: (a: number) => [number, number];
    readonly tokenburntransition_set_base: (a: number, b: number) => void;
    readonly tokenburntransition_set_burn_amount: (a: number, b: any) => [number, number];
    readonly tokenburntransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenburntransition_struct_name: () => [number, number];
    readonly tokenburntransition_type_name: (a: number) => [number, number];
    readonly tokenconfigurationchangeitem_EmergencyActionAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_EmergencyActionItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_ManualMintingAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_ManualMintingItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_NewTokensDestinationIdentityAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_NewTokensDestinationIdentityControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_NewTokensDestinationIdentityItem: (a: any) => [number, number, number];
    readonly tokenconfigurationchangeitem_UnfreezeAdminGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_UnfreezeItem: (a: number) => number;
    readonly tokenconfigurationlocalization_constructor: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly tokenconfigurationlocalization_fromJSON: (a: any) => [number, number, number];
    readonly tokenconfigurationlocalization_fromObject: (a: any) => [number, number, number];
    readonly tokenconfigurationlocalization_plural_form: (a: number) => [number, number];
    readonly tokenconfigurationlocalization_set_plural_form: (a: number, b: number, c: number) => void;
    readonly tokenconfigurationlocalization_set_should_capitalize: (a: number, b: number) => void;
    readonly tokenconfigurationlocalization_set_singular_form: (a: number, b: number, c: number) => void;
    readonly tokenconfigurationlocalization_should_capitalize: (a: number) => number;
    readonly tokenconfigurationlocalization_singular_form: (a: number) => [number, number];
    readonly tokenconfigurationlocalization_struct_name: () => [number, number];
    readonly tokenconfigurationlocalization_toJSON: (a: number) => [number, number, number];
    readonly tokenconfigurationlocalization_toObject: (a: number) => [number, number, number];
    readonly tokenconfigurationlocalization_type_name: (a: number) => [number, number];
    readonly tokenevent_fromJSON: (a: any) => [number, number, number];
    readonly tokenevent_fromObject: (a: any) => [number, number, number];
    readonly tokenevent_struct_name: () => [number, number];
    readonly tokenevent_toJSON: (a: number) => [number, number, number];
    readonly tokenevent_toObject: (a: number) => [number, number, number];
    readonly tokenevent_type_name: (a: number) => [number, number];
    readonly tokenevent_variant: (a: number) => number;
    readonly tokenpricingschedule_SetPrices: (a: any) => [number, number, number];
    readonly tokenpricingschedule_SinglePrice: (a: bigint) => number;
    readonly tokenpricingschedule_fromJSON: (a: any) => [number, number, number];
    readonly tokenpricingschedule_fromObject: (a: any) => [number, number, number];
    readonly tokenpricingschedule_schedule_type: (a: number) => [number, number];
    readonly tokenpricingschedule_struct_name: () => [number, number];
    readonly tokenpricingschedule_toJSON: (a: number) => [number, number, number];
    readonly tokenpricingschedule_toObject: (a: number) => [number, number, number];
    readonly tokenpricingschedule_type_name: (a: number) => [number, number];
    readonly tokenpricingschedule_value: (a: number) => [number, number, number];
    readonly tokensetpricefordirectpurchasetransition_base: (a: number) => number;
    readonly tokensetpricefordirectpurchasetransition_constructor: (a: any) => [number, number, number];
    readonly tokensetpricefordirectpurchasetransition_price: (a: number) => number;
    readonly tokensetpricefordirectpurchasetransition_public_note: (a: number) => [number, number];
    readonly tokensetpricefordirectpurchasetransition_set_base: (a: number, b: number) => void;
    readonly tokensetpricefordirectpurchasetransition_set_price: (a: number, b: number) => void;
    readonly tokensetpricefordirectpurchasetransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokensetpricefordirectpurchasetransition_struct_name: () => [number, number];
    readonly tokensetpricefordirectpurchasetransition_type_name: (a: number) => [number, number];
    readonly tokentransition_constructor: (a: any) => [number, number, number];
    readonly tokentransition_contract_id: (a: number) => number;
    readonly tokentransition_getHistoricalDocumentId: (a: number, b: any) => [number, number, number];
    readonly tokentransition_historical_document_type_name: (a: number) => [number, number];
    readonly tokentransition_identity_contract_nonce: (a: number) => bigint;
    readonly tokentransition_set_contract_id: (a: number, b: any) => [number, number];
    readonly tokentransition_set_identity_contract_nonce: (a: number, b: any) => [number, number];
    readonly tokentransition_set_token_id: (a: number, b: any) => [number, number];
    readonly tokentransition_struct_name: () => [number, number];
    readonly tokentransition_token_id: (a: number) => number;
    readonly tokentransition_transition: (a: number) => any;
    readonly tokentransition_transition_type: (a: number) => [number, number];
    readonly tokentransition_transition_type_number: (a: number) => number;
    readonly tokentransition_type_name: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_amount: (a: number) => bigint;
    readonly tokenunshieldwithshieldedfeetransition_credit_amount: (a: number) => bigint;
    readonly tokenunshieldwithshieldedfeetransition_data_contract_id: (a: number) => number;
    readonly tokenunshieldwithshieldedfeetransition_fee_actions: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_fee_anchor: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_fee_binding_signature: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_fee_proof: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromJSON: (a: any) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromObject: (a: any) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_fromStateTransition: (a: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_getModifiedDataIds: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_new: (a: any) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_recipient_id: (a: number) => number;
    readonly tokenunshieldwithshieldedfeetransition_struct_name: () => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_toBase64: (a: number) => [number, number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_toBytes: (a: number) => [number, number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_toHex: (a: number) => [number, number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_toJSON: (a: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_toObject: (a: number) => [number, number, number];
    readonly tokenunshieldwithshieldedfeetransition_toStateTransition: (a: number) => number;
    readonly tokenunshieldwithshieldedfeetransition_token_actions: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_token_anchor: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_token_binding_signature: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_token_contract_position: (a: number) => number;
    readonly tokenunshieldwithshieldedfeetransition_token_id: (a: number) => number;
    readonly tokenunshieldwithshieldedfeetransition_token_proof: (a: number) => [number, number];
    readonly tokenunshieldwithshieldedfeetransition_type_name: (a: number) => [number, number];
    readonly verifiedassetlockconsumed_fromJSON: (a: any) => [number, number, number];
    readonly verifiedassetlockconsumed_fromObject: (a: any) => [number, number, number];
    readonly verifiedassetlockconsumed_initialCreditValue: (a: number) => any;
    readonly verifiedassetlockconsumed_remainingCreditValue: (a: number) => any;
    readonly verifiedassetlockconsumed_struct_name: () => [number, number];
    readonly verifiedassetlockconsumed_toJSON: (a: number) => [number, number, number];
    readonly verifiedassetlockconsumed_toObject: (a: number) => [number, number, number];
    readonly verifiedassetlockconsumed_type_name: (a: number) => [number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_address_infos: (a: number) => any;
    readonly verifiedassetlockconsumedwithaddressinfos_fromJSON: (a: any) => [number, number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_initialCreditValue: (a: number) => any;
    readonly verifiedassetlockconsumedwithaddressinfos_remainingCreditValue: (a: number) => any;
    readonly verifiedassetlockconsumedwithaddressinfos_status: (a: number) => [number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_struct_name: () => [number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_toJSON: (a: number) => [number, number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_toObject: (a: number) => any;
    readonly verifiedassetlockconsumedwithaddressinfos_type_name: (a: number) => [number, number];
    readonly verifiedidentitywithshieldednullifiers_fromJSON: (a: any) => [number, number, number];
    readonly verifiedidentitywithshieldednullifiers_fromObject: (a: any) => [number, number, number];
    readonly verifiedidentitywithshieldednullifiers_nullifiers: (a: number) => any;
    readonly verifiedidentitywithshieldednullifiers_struct_name: () => [number, number];
    readonly verifiedidentitywithshieldednullifiers_toJSON: (a: number) => [number, number, number];
    readonly verifiedidentitywithshieldednullifiers_toObject: (a: number) => [number, number, number];
    readonly verifiedidentitywithshieldednullifiers_type_name: (a: number) => [number, number];
    readonly verifiedshieldednullifiers_fromJSON: (a: any) => [number, number, number];
    readonly verifiedshieldednullifiers_fromObject: (a: any) => [number, number, number];
    readonly verifiedshieldednullifiers_nullifiers: (a: number) => any;
    readonly verifiedshieldednullifiers_struct_name: () => [number, number];
    readonly verifiedshieldednullifiers_toJSON: (a: number) => [number, number, number];
    readonly verifiedshieldednullifiers_toObject: (a: number) => any;
    readonly verifiedshieldednullifiers_type_name: (a: number) => [number, number];
    readonly verifiedshieldednullifierswithaddressinfos_address_infos: (a: number) => any;
    readonly verifiedshieldednullifierswithaddressinfos_fromJSON: (a: any) => [number, number, number];
    readonly verifiedshieldednullifierswithaddressinfos_nullifiers: (a: number) => any;
    readonly verifiedshieldednullifierswithaddressinfos_struct_name: () => [number, number];
    readonly verifiedshieldednullifierswithaddressinfos_toJSON: (a: number) => [number, number, number];
    readonly verifiedshieldednullifierswithaddressinfos_toObject: (a: number) => any;
    readonly verifiedshieldednullifierswithaddressinfos_type_name: (a: number) => [number, number];
    readonly verifiedshieldednullifierswithwithdrawaldocument_documents: (a: number) => any;
    readonly verifiedshieldednullifierswithwithdrawaldocument_fromJSON: (a: any) => [number, number, number];
    readonly verifiedshieldednullifierswithwithdrawaldocument_nullifiers: (a: number) => any;
    readonly verifiedshieldednullifierswithwithdrawaldocument_struct_name: () => [number, number];
    readonly verifiedshieldednullifierswithwithdrawaldocument_toJSON: (a: number) => [number, number, number];
    readonly verifiedshieldednullifierswithwithdrawaldocument_toObject: (a: number) => any;
    readonly verifiedshieldednullifierswithwithdrawaldocument_type_name: (a: number) => [number, number];
    readonly verifiedshieldedpoolstate_fromJSON: (a: any) => [number, number, number];
    readonly verifiedshieldedpoolstate_fromObject: (a: any) => [number, number, number];
    readonly verifiedshieldedpoolstate_poolBalance: (a: number) => any;
    readonly verifiedshieldedpoolstate_struct_name: () => [number, number];
    readonly verifiedshieldedpoolstate_toJSON: (a: number) => [number, number, number];
    readonly verifiedshieldedpoolstate_toObject: (a: number) => [number, number, number];
    readonly verifiedshieldedpoolstate_type_name: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_action_status: (a: number) => [number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_fromJSON: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_group_power: (a: number) => number;
    readonly verifiedtokengroupactionwithshieldednullifiers_nullifiers: (a: number) => any;
    readonly verifiedtokengroupactionwithshieldednullifiers_struct_name: () => [number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_toJSON: (a: number) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_toObject: (a: number) => any;
    readonly verifiedtokengroupactionwithshieldednullifiers_type_name: (a: number) => [number, number];
    readonly verifiedshieldednullifierswithaddressinfos_fromObject: (a: any) => [number, number, number];
    readonly verifiedshieldednullifierswithwithdrawaldocument_fromObject: (a: any) => [number, number, number];
    readonly verifiedassetlockconsumedwithaddressinfos_fromObject: (a: any) => [number, number, number];
    readonly verifiedtokengroupactionwithshieldednullifiers_fromObject: (a: any) => [number, number, number];
    readonly authorizedactiontakers_module_brand: () => any;
    readonly groupaction_module_brand: () => any;
    readonly groupactionevent_module_brand: () => any;
    readonly identitytopupfromshieldedpooltransition_module_brand: () => any;
    readonly identityupdatetransition_module_brand: () => any;
    readonly shieldedwithdrawaltransition_module_brand: () => any;
    readonly tokenburntransition_module_brand: () => any;
    readonly tokenconfigurationlocalization_module_brand: () => any;
    readonly tokenevent_module_brand: () => any;
    readonly tokenpricingschedule_module_brand: () => any;
    readonly tokensetpricefordirectpurchasetransition_module_brand: () => any;
    readonly tokentransition_module_brand: () => any;
    readonly tokenunshieldwithshieldedfeetransition_module_brand: () => any;
    readonly verifiedassetlockconsumed_module_brand: () => any;
    readonly verifiedassetlockconsumedwithaddressinfos_module_brand: () => any;
    readonly verifiedidentitywithshieldednullifiers_module_brand: () => any;
    readonly verifiedshieldednullifiers_module_brand: () => any;
    readonly verifiedshieldednullifierswithaddressinfos_module_brand: () => any;
    readonly verifiedshieldednullifierswithwithdrawaldocument_module_brand: () => any;
    readonly verifiedshieldedpoolstate_module_brand: () => any;
    readonly verifiedtokengroupactionwithshieldednullifiers_module_brand: () => any;
    readonly __wbg_identitysigner_free: (a: number, b: number) => void;
    readonly __wbg_platformaddresssigner_free: (a: number, b: number) => void;
    readonly __wbg_privatekey_free: (a: number, b: number) => void;
    readonly __wbg_publickey_free: (a: number, b: number) => void;
    readonly __wbg_tokendestroyfrozenfundstransition_free: (a: number, b: number) => void;
    readonly __wbg_tokendirectpurchasetopooltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenonceperidentitydistribution_free: (a: number, b: number) => void;
    readonly identitysigner_addKey: (a: number, b: number) => [number, number];
    readonly identitysigner_addKeyFromWif: (a: number, b: number, c: number) => [number, number];
    readonly identitysigner_constructor: () => number;
    readonly identitysigner_key_count: (a: number) => number;
    readonly identitysigner_struct_name: () => [number, number];
    readonly identitysigner_type_name: (a: number) => [number, number];
    readonly platformaddresssigner_addKey: (a: number, b: number) => [number, number, number];
    readonly platformaddresssigner_getPrivateKeysBytes: (a: number) => [number, number, number];
    readonly platformaddresssigner_hasKey: (a: number, b: any) => [number, number, number];
    readonly platformaddresssigner_key_count: (a: number) => number;
    readonly platformaddresssigner_struct_name: () => [number, number];
    readonly platformaddresssigner_type_name: (a: number) => [number, number];
    readonly privatekey_fromBytes: (a: number, b: number, c: any) => [number, number, number];
    readonly privatekey_fromHex: (a: number, b: number, c: any) => [number, number, number];
    readonly privatekey_fromWIF: (a: number, b: number) => [number, number, number];
    readonly privatekey_getPublicKey: (a: number) => number;
    readonly privatekey_getPublicKeyHash: (a: number) => [number, number];
    readonly privatekey_struct_name: () => [number, number];
    readonly privatekey_toBytes: (a: number) => [number, number];
    readonly privatekey_toHex: (a: number) => [number, number];
    readonly privatekey_toWIF: (a: number) => [number, number];
    readonly privatekey_type_name: (a: number) => [number, number];
    readonly publickey_compressed: (a: number) => number;
    readonly publickey_constructor: (a: number, b: number, c: number) => [number, number, number];
    readonly publickey_fromBytes: (a: number, b: number) => [number, number, number];
    readonly publickey_getPublicKeyHash: (a: number) => [number, number];
    readonly publickey_inner: (a: number) => [number, number];
    readonly publickey_set_compressed: (a: number, b: number) => void;
    readonly publickey_set_inner: (a: number, b: number, c: number) => [number, number];
    readonly publickey_struct_name: () => [number, number];
    readonly publickey_toBytes: (a: number) => [number, number];
    readonly publickey_type_name: (a: number) => [number, number];
    readonly tokenconfigurationchangeitem_MainControlGroupItem: (a: number) => number;
    readonly tokenconfigurationchangeitem_noChangeItem: () => number;
    readonly tokendestroyfrozenfundstransition_base: (a: number) => number;
    readonly tokendestroyfrozenfundstransition_constructor: (a: any) => [number, number, number];
    readonly tokendestroyfrozenfundstransition_frozen_identity_id: (a: number) => number;
    readonly tokendestroyfrozenfundstransition_public_note: (a: number) => [number, number];
    readonly tokendestroyfrozenfundstransition_set_base: (a: number, b: number) => void;
    readonly tokendestroyfrozenfundstransition_set_frozen_identity_id: (a: number, b: any) => [number, number];
    readonly tokendestroyfrozenfundstransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokendestroyfrozenfundstransition_struct_name: () => [number, number];
    readonly tokendestroyfrozenfundstransition_type_name: (a: number) => [number, number];
    readonly tokendirectpurchasetopooltransition_actions: (a: number) => [number, number];
    readonly tokendirectpurchasetopooltransition_anchor: (a: number) => [number, number];
    readonly tokendirectpurchasetopooltransition_base: (a: number) => number;
    readonly tokendirectpurchasetopooltransition_binding_signature: (a: number) => [number, number];
    readonly tokendirectpurchasetopooltransition_constructor: (a: any) => [number, number, number];
    readonly tokendirectpurchasetopooltransition_proof: (a: number) => [number, number];
    readonly tokendirectpurchasetopooltransition_set_base: (a: number, b: number) => void;
    readonly tokendirectpurchasetopooltransition_struct_name: () => [number, number];
    readonly tokendirectpurchasetopooltransition_token_count: (a: number) => bigint;
    readonly tokendirectpurchasetopooltransition_total_agreed_price: (a: number) => bigint;
    readonly tokendirectpurchasetopooltransition_type_name: (a: number) => [number, number];
    readonly tokenonceperidentitydistribution_amount: (a: number) => bigint;
    readonly tokenonceperidentitydistribution_constructor: (a: any) => [number, number, number];
    readonly tokenonceperidentitydistribution_set_amount: (a: number, b: any) => [number, number];
    readonly tokenonceperidentitydistribution_struct_name: () => [number, number];
    readonly tokenonceperidentitydistribution_type_name: (a: number) => [number, number];
    readonly platformaddresssigner_constructor: () => number;
    readonly identitysigner_module_brand: () => any;
    readonly platformaddresssigner_module_brand: () => any;
    readonly privatekey_module_brand: () => any;
    readonly publickey_module_brand: () => any;
    readonly tokendestroyfrozenfundstransition_module_brand: () => any;
    readonly tokendirectpurchasetopooltransition_module_brand: () => any;
    readonly tokenonceperidentitydistribution_module_brand: () => any;
    readonly __wbg_distributionexponential_free: (a: number, b: number) => void;
    readonly __wbg_distributionfixedamount_free: (a: number, b: number) => void;
    readonly __wbg_distributioninvertedlogarithmic_free: (a: number, b: number) => void;
    readonly __wbg_distributionlinear_free: (a: number, b: number) => void;
    readonly __wbg_distributionlogarithmic_free: (a: number, b: number) => void;
    readonly __wbg_distributionpolynomial_free: (a: number, b: number) => void;
    readonly __wbg_distributionrandom_free: (a: number, b: number) => void;
    readonly __wbg_distributionstepdecreasingamount_free: (a: number, b: number) => void;
    readonly __wbg_identitycreatefromaddressestransition_free: (a: number, b: number) => void;
    readonly __wbg_identitypublickey_free: (a: number, b: number) => void;
    readonly __wbg_instantassetlockproof_free: (a: number, b: number) => void;
    readonly __wbg_protxhash_free: (a: number, b: number) => void;
    readonly __wbg_serializedorchardaction_free: (a: number, b: number) => void;
    readonly __wbg_sharedencryptednote_free: (a: number, b: number) => void;
    readonly __wbg_tokenclaimtopooltransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenclaimtransition_free: (a: number, b: number) => void;
    readonly __wbg_tokendirectpurchasetransition_free: (a: number, b: number) => void;
    readonly __wbg_tokenunfreezetransition_free: (a: number, b: number) => void;
    readonly distributionexponential_a: (a: number) => bigint;
    readonly distributionexponential_b: (a: number) => bigint;
    readonly distributionexponential_d: (a: number) => bigint;
    readonly distributionexponential_m: (a: number) => bigint;
    readonly distributionexponential_max_value: (a: number) => [number, bigint];
    readonly distributionexponential_min_value: (a: number) => [number, bigint];
    readonly distributionexponential_n: (a: number) => bigint;
    readonly distributionexponential_new: (a: any) => [number, number, number];
    readonly distributionexponential_o: (a: number) => bigint;
    readonly distributionexponential_set_a: (a: number, b: bigint) => void;
    readonly distributionexponential_set_b: (a: number, b: bigint) => void;
    readonly distributionexponential_set_d: (a: number, b: bigint) => void;
    readonly distributionexponential_set_m: (a: number, b: bigint) => void;
    readonly distributionexponential_set_max_value: (a: number, b: number, c: bigint) => void;
    readonly distributionexponential_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributionexponential_set_n: (a: number, b: bigint) => void;
    readonly distributionexponential_set_o: (a: number, b: bigint) => void;
    readonly distributionexponential_set_start_moment: (a: number, b: number, c: bigint) => void;
    readonly distributionexponential_start_moment: (a: number) => [number, bigint];
    readonly distributionfixedamount_amount: (a: number) => bigint;
    readonly distributionfixedamount_new: (a: any) => [number, number, number];
    readonly distributionfixedamount_set_amount: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_a: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_b: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_d: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_m: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_max_value: (a: number) => [number, bigint];
    readonly distributioninvertedlogarithmic_min_value: (a: number) => [number, bigint];
    readonly distributioninvertedlogarithmic_n: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_new: (a: any) => [number, number, number];
    readonly distributioninvertedlogarithmic_o: (a: number) => bigint;
    readonly distributioninvertedlogarithmic_set_a: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_b: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_d: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_m: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_max_value: (a: number, b: number, c: bigint) => void;
    readonly distributioninvertedlogarithmic_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributioninvertedlogarithmic_set_n: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_o: (a: number, b: bigint) => void;
    readonly distributioninvertedlogarithmic_set_start_moment: (a: number, b: number, c: bigint) => void;
    readonly distributioninvertedlogarithmic_start_moment: (a: number) => [number, bigint];
    readonly distributionlinear_a: (a: number) => bigint;
    readonly distributionlinear_d: (a: number) => bigint;
    readonly distributionlinear_max_value: (a: number) => [number, bigint];
    readonly distributionlinear_min_value: (a: number) => [number, bigint];
    readonly distributionlinear_new: (a: any) => [number, number, number];
    readonly distributionlinear_set_a: (a: number, b: bigint) => void;
    readonly distributionlinear_set_d: (a: number, b: bigint) => void;
    readonly distributionlinear_set_max_value: (a: number, b: number, c: bigint) => void;
    readonly distributionlinear_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributionlinear_set_start_step: (a: number, b: number, c: bigint) => void;
    readonly distributionlinear_set_starting_amount: (a: number, b: bigint) => void;
    readonly distributionlinear_start_step: (a: number) => [number, bigint];
    readonly distributionlinear_starting_amount: (a: number) => bigint;
    readonly distributionlogarithmic_a: (a: number) => bigint;
    readonly distributionlogarithmic_b: (a: number) => bigint;
    readonly distributionlogarithmic_d: (a: number) => bigint;
    readonly distributionlogarithmic_m: (a: number) => bigint;
    readonly distributionlogarithmic_max_value: (a: number) => [number, bigint];
    readonly distributionlogarithmic_min_value: (a: number) => [number, bigint];
    readonly distributionlogarithmic_n: (a: number) => bigint;
    readonly distributionlogarithmic_new: (a: any) => [number, number, number];
    readonly distributionlogarithmic_o: (a: number) => bigint;
    readonly distributionlogarithmic_set_a: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_b: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_d: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_m: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_max_value: (a: number, b: number, c: bigint) => void;
    readonly distributionlogarithmic_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributionlogarithmic_set_n: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_o: (a: number, b: bigint) => void;
    readonly distributionlogarithmic_set_start_moment: (a: number, b: number, c: bigint) => void;
    readonly distributionlogarithmic_start_moment: (a: number) => [number, bigint];
    readonly distributionpolynomial_a: (a: number) => bigint;
    readonly distributionpolynomial_b: (a: number) => bigint;
    readonly distributionpolynomial_d: (a: number) => bigint;
    readonly distributionpolynomial_m: (a: number) => bigint;
    readonly distributionpolynomial_max_value: (a: number) => [number, bigint];
    readonly distributionpolynomial_min_value: (a: number) => [number, bigint];
    readonly distributionpolynomial_n: (a: number) => bigint;
    readonly distributionpolynomial_new: (a: any) => [number, number, number];
    readonly distributionpolynomial_o: (a: number) => bigint;
    readonly distributionpolynomial_set_a: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_b: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_d: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_m: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_max_value: (a: number, b: number, c: bigint) => void;
    readonly distributionpolynomial_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributionpolynomial_set_n: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_o: (a: number, b: bigint) => void;
    readonly distributionpolynomial_set_start_moment: (a: number, b: number, c: bigint) => void;
    readonly distributionpolynomial_start_moment: (a: number) => [number, bigint];
    readonly distributionrandom_max: (a: number) => bigint;
    readonly distributionrandom_min: (a: number) => bigint;
    readonly distributionrandom_new: (a: any) => [number, number, number];
    readonly distributionrandom_set_max: (a: number, b: bigint) => void;
    readonly distributionrandom_set_min: (a: number, b: bigint) => void;
    readonly distributionstepdecreasingamount_decrease_per_interval_denominator: (a: number) => number;
    readonly distributionstepdecreasingamount_decrease_per_interval_numerator: (a: number) => number;
    readonly distributionstepdecreasingamount_distribution_start_amount: (a: number) => bigint;
    readonly distributionstepdecreasingamount_max_interval_count: (a: number) => number;
    readonly distributionstepdecreasingamount_min_value: (a: number) => [number, bigint];
    readonly distributionstepdecreasingamount_new: (a: any) => [number, number, number];
    readonly distributionstepdecreasingamount_set_decrease_per_interval_denominator: (a: number, b: number) => void;
    readonly distributionstepdecreasingamount_set_decrease_per_interval_numerator: (a: number, b: number) => void;
    readonly distributionstepdecreasingamount_set_distribution_start_amount: (a: number, b: bigint) => void;
    readonly distributionstepdecreasingamount_set_max_interval_count: (a: number, b: number) => void;
    readonly distributionstepdecreasingamount_set_min_value: (a: number, b: number, c: bigint) => void;
    readonly distributionstepdecreasingamount_set_start_decreasing_offset: (a: number, b: number, c: bigint) => void;
    readonly distributionstepdecreasingamount_set_step_count: (a: number, b: number) => void;
    readonly distributionstepdecreasingamount_set_trailing_distribution_interval_amount: (a: number, b: bigint) => void;
    readonly distributionstepdecreasingamount_start_decreasing_offset: (a: number) => [number, bigint];
    readonly distributionstepdecreasingamount_step_count: (a: number) => number;
    readonly distributionstepdecreasingamount_trailing_distribution_interval_amount: (a: number) => bigint;
    readonly identitycreatefromaddressestransition_constructor: (a: any) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromJSON: (a: any) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromObject: (a: any) => [number, number, number];
    readonly identitycreatefromaddressestransition_fromStateTransition: (a: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_inputs: (a: number) => [number, number];
    readonly identitycreatefromaddressestransition_output: (a: number) => number;
    readonly identitycreatefromaddressestransition_public_keys: (a: number) => [number, number];
    readonly identitycreatefromaddressestransition_set_inputs: (a: number, b: number, c: number) => [number, number];
    readonly identitycreatefromaddressestransition_set_output: (a: number, b: number) => [number, number];
    readonly identitycreatefromaddressestransition_set_public_keys: (a: number, b: any) => [number, number];
    readonly identitycreatefromaddressestransition_set_user_fee_increase: (a: number, b: any) => [number, number];
    readonly identitycreatefromaddressestransition_struct_name: () => [number, number];
    readonly identitycreatefromaddressestransition_toBase64: (a: number) => [number, number, number, number];
    readonly identitycreatefromaddressestransition_toBytes: (a: number) => [number, number, number, number];
    readonly identitycreatefromaddressestransition_toHex: (a: number) => [number, number, number, number];
    readonly identitycreatefromaddressestransition_toJSON: (a: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_toObject: (a: number) => [number, number, number];
    readonly identitycreatefromaddressestransition_toStateTransition: (a: number) => number;
    readonly identitycreatefromaddressestransition_type_name: (a: number) => [number, number];
    readonly identitycreatefromaddressestransition_user_fee_increase: (a: number) => number;
    readonly identitypublickey_base64: (a: number) => [number, number, number, number];
    readonly identitypublickey_constructor: (a: any) => [number, number, number];
    readonly identitypublickey_contract_bounds: (a: number) => number;
    readonly identitypublickey_data: (a: number) => [number, number];
    readonly identitypublickey_disabled_at: (a: number) => [number, bigint];
    readonly identitypublickey_expires_at: (a: number) => [number, bigint];
    readonly identitypublickey_fromBase64: (a: number, b: number) => [number, number, number];
    readonly identitypublickey_fromBytes: (a: number, b: number) => [number, number, number];
    readonly identitypublickey_fromHex: (a: number, b: number) => [number, number, number];
    readonly identitypublickey_fromJSON: (a: any, b: any) => [number, number, number];
    readonly identitypublickey_fromObject: (a: any, b: any) => [number, number, number];
    readonly identitypublickey_getPublicKeyHash: (a: number) => [number, number, number, number];
    readonly identitypublickey_hex: (a: number) => [number, number, number, number];
    readonly identitypublickey_is_master: (a: number) => number;
    readonly identitypublickey_is_read_only: (a: number) => number;
    readonly identitypublickey_key_id: (a: number) => number;
    readonly identitypublickey_key_type: (a: number) => [number, number];
    readonly identitypublickey_key_type_number: (a: number) => number;
    readonly identitypublickey_purpose: (a: number) => [number, number];
    readonly identitypublickey_purpose_number: (a: number) => number;
    readonly identitypublickey_security_level: (a: number) => [number, number];
    readonly identitypublickey_security_level_number: (a: number) => number;
    readonly identitypublickey_set_data: (a: number, b: number, c: number) => [number, number];
    readonly identitypublickey_set_disabled_at: (a: number, b: any) => [number, number];
    readonly identitypublickey_set_expires_at: (a: number, b: number) => [number, number];
    readonly identitypublickey_set_is_read_only: (a: number, b: number) => void;
    readonly identitypublickey_set_key_id: (a: number, b: any) => [number, number];
    readonly identitypublickey_set_key_type: (a: number, b: any) => [number, number];
    readonly identitypublickey_set_purpose: (a: number, b: any) => [number, number];
    readonly identitypublickey_set_security_level: (a: number, b: any) => [number, number];
    readonly identitypublickey_set_total_budget: (a: number, b: number) => [number, number];
    readonly identitypublickey_struct_name: () => [number, number];
    readonly identitypublickey_toBytes: (a: number) => [number, number, number, number];
    readonly identitypublickey_toJSON: (a: number) => [number, number, number];
    readonly identitypublickey_toObject: (a: number) => [number, number, number];
    readonly identitypublickey_total_budget: (a: number) => [number, bigint];
    readonly identitypublickey_type_name: (a: number) => [number, number];
    readonly identitypublickey_validatePrivateKey: (a: number, b: number, c: number, d: any) => [number, number, number];
    readonly instantassetlockproof_constructor: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly instantassetlockproof_createIdentityId: (a: number) => [number, number, number];
    readonly instantassetlockproof_fromJSON: (a: any) => [number, number, number];
    readonly instantassetlockproof_fromObject: (a: any) => [number, number, number];
    readonly instantassetlockproof_instant_lock: (a: number) => [number, number];
    readonly instantassetlockproof_out_point: (a: number) => number;
    readonly instantassetlockproof_output: (a: number) => [number, number];
    readonly instantassetlockproof_output_index: (a: number) => number;
    readonly instantassetlockproof_set_instant_lock: (a: number, b: number, c: number) => [number, number];
    readonly instantassetlockproof_set_output_index: (a: number, b: any) => [number, number];
    readonly instantassetlockproof_struct_name: () => [number, number];
    readonly instantassetlockproof_toJSON: (a: number) => [number, number, number];
    readonly instantassetlockproof_toObject: (a: number) => [number, number, number];
    readonly instantassetlockproof_transaction: (a: number) => [number, number];
    readonly instantassetlockproof_type_name: (a: number) => [number, number];
    readonly protxhash_struct_name: () => [number, number];
    readonly protxhash_type_name: (a: number) => [number, number];
    readonly serializedorchardaction_cmx: (a: number) => [number, number];
    readonly serializedorchardaction_constructor: (a: any) => [number, number, number];
    readonly serializedorchardaction_cv_net: (a: number) => [number, number];
    readonly serializedorchardaction_encrypted_note: (a: number) => [number, number];
    readonly serializedorchardaction_fromJSON: (a: any) => [number, number, number];
    readonly serializedorchardaction_fromObject: (a: any) => [number, number, number];
    readonly serializedorchardaction_nullifier: (a: number) => [number, number];
    readonly serializedorchardaction_rk: (a: number) => [number, number];
    readonly serializedorchardaction_spend_auth_sig: (a: number) => [number, number];
    readonly serializedorchardaction_struct_name: () => [number, number];
    readonly serializedorchardaction_toJSON: (a: number) => [number, number, number];
    readonly serializedorchardaction_toObject: (a: number) => [number, number, number];
    readonly serializedorchardaction_type_name: (a: number) => [number, number];
    readonly sharedencryptednote_constructor: (a: number, b: number, c: number, d: number) => number;
    readonly sharedencryptednote_recipient_key_index: (a: number) => number;
    readonly sharedencryptednote_sender_key_index: (a: number) => number;
    readonly sharedencryptednote_set_recipient_key_index: (a: number, b: number) => void;
    readonly sharedencryptednote_set_sender_key_index: (a: number, b: number) => void;
    readonly sharedencryptednote_set_value: (a: number, b: number, c: number) => void;
    readonly sharedencryptednote_struct_name: () => [number, number];
    readonly sharedencryptednote_type_name: (a: number) => [number, number];
    readonly sharedencryptednote_value: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_actions: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_anchor: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_base: (a: number) => number;
    readonly tokenclaimtopooltransition_binding_signature: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_claim_up_to: (a: number) => [number, bigint];
    readonly tokenclaimtopooltransition_constructor: (a: any) => [number, number, number];
    readonly tokenclaimtopooltransition_distribution_type: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_proof: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_public_note: (a: number) => [number, number];
    readonly tokenclaimtopooltransition_set_base: (a: number, b: number) => void;
    readonly tokenclaimtopooltransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenclaimtopooltransition_struct_name: () => [number, number];
    readonly tokenclaimtopooltransition_type_name: (a: number) => [number, number];
    readonly tokenclaimtransition_base: (a: number) => number;
    readonly tokenclaimtransition_constructor: (a: any) => [number, number, number];
    readonly tokenclaimtransition_distribution_type: (a: number) => [number, number];
    readonly tokenclaimtransition_public_note: (a: number) => [number, number];
    readonly tokenclaimtransition_set_base: (a: number, b: number) => void;
    readonly tokenclaimtransition_set_distribution_type: (a: number, b: any) => [number, number];
    readonly tokenclaimtransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenclaimtransition_struct_name: () => [number, number];
    readonly tokenclaimtransition_type_name: (a: number) => [number, number];
    readonly tokendirectpurchasetransition_base: (a: number) => number;
    readonly tokendirectpurchasetransition_constructor: (a: any) => [number, number, number];
    readonly tokendirectpurchasetransition_set_base: (a: number, b: number) => void;
    readonly tokendirectpurchasetransition_set_token_count: (a: number, b: bigint) => void;
    readonly tokendirectpurchasetransition_set_total_agreed_price: (a: number, b: bigint) => void;
    readonly tokendirectpurchasetransition_struct_name: () => [number, number];
    readonly tokendirectpurchasetransition_token_count: (a: number) => bigint;
    readonly tokendirectpurchasetransition_total_agreed_price: (a: number) => bigint;
    readonly tokendirectpurchasetransition_type_name: (a: number) => [number, number];
    readonly tokenunfreezetransition_base: (a: number) => number;
    readonly tokenunfreezetransition_constructor: (a: any) => [number, number, number];
    readonly tokenunfreezetransition_frozen_identity_id: (a: number) => number;
    readonly tokenunfreezetransition_public_note: (a: number) => [number, number];
    readonly tokenunfreezetransition_set_base: (a: number, b: number) => void;
    readonly tokenunfreezetransition_set_frozen_identity_id: (a: number, b: any) => [number, number];
    readonly tokenunfreezetransition_set_public_note: (a: number, b: number, c: number) => void;
    readonly tokenunfreezetransition_struct_name: () => [number, number];
    readonly tokenunfreezetransition_type_name: (a: number) => [number, number];
    readonly identitycreatefromaddressestransition_module_brand: () => any;
    readonly identitypublickey_module_brand: () => any;
    readonly instantassetlockproof_module_brand: () => any;
    readonly protxhash_module_brand: () => any;
    readonly serializedorchardaction_module_brand: () => any;
    readonly sharedencryptednote_module_brand: () => any;
    readonly tokenclaimtopooltransition_module_brand: () => any;
    readonly tokenclaimtransition_module_brand: () => any;
    readonly tokendirectpurchasetransition_module_brand: () => any;
    readonly tokenunfreezetransition_module_brand: () => any;
    readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
    readonly intounderlyingsink_abort: (a: number, b: any) => any;
    readonly intounderlyingsink_close: (a: number) => any;
    readonly intounderlyingsink_write: (a: number, b: any) => any;
    readonly intounderlyingsource_cancel: (a: number) => void;
    readonly intounderlyingsource_pull: (a: number, b: any) => any;
    readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
    readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
    readonly intounderlyingbytesource_cancel: (a: number) => void;
    readonly intounderlyingbytesource_pull: (a: number, b: any) => any;
    readonly intounderlyingbytesource_start: (a: number, b: any) => void;
    readonly intounderlyingbytesource_type: (a: number) => number;
    readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
    readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
    readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
    readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
    readonly wasm_bindgen_c852ead5a0b0629___closure__destroy___dyn_core_ed718c3d60ebd546___ops__function__FnMut_____Output_______: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___closure__destroy___dyn_core_ed718c3d60ebd546___ops__function__FnMut_____Output________1_: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___closure__destroy___dyn_core_ed718c3d60ebd546___ops__function__FnMut_____Output________2_: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___closure__destroy___dyn_core_ed718c3d60ebd546___ops__function__FnMut__wasm_bindgen_c852ead5a0b0629___JsValue____Output_______: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___convert__closures_____invoke___wasm_bindgen_c852ead5a0b0629___JsValue__wasm_bindgen_c852ead5a0b0629___JsValue_____: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_c852ead5a0b0629___convert__closures_____invoke___wasm_bindgen_c852ead5a0b0629___JsValue_____: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_c852ead5a0b0629___convert__closures_____invoke______: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___convert__closures_____invoke_______1_: (a: number, b: number) => void;
    readonly wasm_bindgen_c852ead5a0b0629___convert__closures_____invoke_______2_: (a: number, b: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
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
