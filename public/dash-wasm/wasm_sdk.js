let wasm;

let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_4.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_6.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_6.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}
/**
 * @returns {Promise<IdentityWasm | undefined>}
 */
export function verify_identity_response() {
    const ret = wasm.verify_identity_response();
    return ret;
}

/**
 * @returns {Promise<DataContractWasm | undefined>}
 */
export function verify_data_contract() {
    const ret = wasm.verify_data_contract();
    return ret;
}

/**
 * @returns {Promise<DocumentWasm[]>}
 */
export function verify_documents() {
    const ret = wasm.verify_documents();
    return ret;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}
/**
 * @param {WasmSdk} sdk
 * @param {string} username
 * @returns {Promise<any>}
 */
export function get_dpns_username_by_name(sdk, username) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(username, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_username_by_name(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} username
 * @returns {Promise<any>}
 */
export function get_dpns_username_by_name_with_proof_info(sdk, username) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(username, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_username_by_name_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * Convert a string to homograph-safe characters
 * @param {string} input
 * @returns {string}
 */
export function dpns_convert_to_homograph_safe(input) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.dpns_convert_to_homograph_safe(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Check if a username is valid according to DPNS rules
 * @param {string} label
 * @returns {boolean}
 */
export function dpns_is_valid_username(label) {
    const ptr0 = passStringToWasm0(label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.dpns_is_valid_username(ptr0, len0);
    return ret !== 0;
}

/**
 * Check if a username is contested (requires masternode voting)
 * @param {string} label
 * @returns {boolean}
 */
export function dpns_is_contested_username(label) {
    const ptr0 = passStringToWasm0(label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.dpns_is_contested_username(ptr0, len0);
    return ret !== 0;
}

/**
 * Register a DPNS username
 * @param {WasmSdk} sdk
 * @param {string} label
 * @param {string} identity_id
 * @param {number} public_key_id
 * @param {string} private_key_wif
 * @param {Function | null} [preorder_callback]
 * @returns {Promise<any>}
 */
export function dpns_register_name(sdk, label, identity_id, public_key_id, private_key_wif, preorder_callback) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.dpns_register_name(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, public_key_id, ptr2, len2, isLikeNone(preorder_callback) ? 0 : addToExternrefTable0(preorder_callback));
    return ret;
}

/**
 * Check if a DPNS name is available
 * @param {WasmSdk} sdk
 * @param {string} label
 * @returns {Promise<boolean>}
 */
export function dpns_is_name_available(sdk, label) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.dpns_is_name_available(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * Resolve a DPNS name to an identity ID
 * @param {WasmSdk} sdk
 * @param {string} name
 * @returns {Promise<any>}
 */
export function dpns_resolve_name(sdk, name) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.dpns_resolve_name(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_protocol_version_upgrade_state(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_protocol_version_upgrade_state(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} start_pro_tx_hash
 * @param {number} count
 * @returns {Promise<any>}
 */
export function get_protocol_version_upgrade_vote_status(sdk, start_pro_tx_hash, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(start_pro_tx_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_protocol_version_upgrade_vote_status(sdk.__wbg_ptr, ptr0, len0, count);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_protocol_version_upgrade_state_with_proof_info(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_protocol_version_upgrade_state_with_proof_info(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} start_pro_tx_hash
 * @param {number} count
 * @returns {Promise<any>}
 */
export function get_protocol_version_upgrade_vote_status_with_proof_info(sdk, start_pro_tx_hash, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(start_pro_tx_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_protocol_version_upgrade_vote_status_with_proof_info(sdk.__wbg_ptr, ptr0, len0, count);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} base58_id
 * @returns {Promise<IdentityWasm>}
 */
export function identity_fetch(sdk, base58_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(base58_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.identity_fetch(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} base58_id
 * @returns {Promise<any>}
 */
export function identity_fetch_with_proof_info(sdk, base58_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(base58_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.identity_fetch_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} base58_id
 * @returns {Promise<IdentityWasm>}
 */
export function identity_fetch_unproved(sdk, base58_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(base58_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.identity_fetch_unproved(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} key_request_type
 * @param {Uint32Array | null} [specific_key_ids]
 * @param {string | null} [search_purpose_map]
 * @param {number | null} [limit]
 * @param {number | null} [offset]
 * @returns {Promise<any>}
 */
export function get_identity_keys(sdk, identity_id, key_request_type, specific_key_ids, search_purpose_map, limit, offset) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(key_request_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(specific_key_ids) ? 0 : passArray32ToWasm0(specific_key_ids, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(search_purpose_map) ? 0 : passStringToWasm0(search_purpose_map, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_keys(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(offset) ? 0x100000001 : (offset) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_identity_nonce(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_nonce(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_identity_nonce_with_proof_info(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_nonce_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} contract_id
 * @returns {Promise<any>}
 */
export function get_identity_contract_nonce(sdk, identity_id, contract_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_contract_nonce(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} contract_id
 * @returns {Promise<any>}
 */
export function get_identity_contract_nonce_with_proof_info(sdk, identity_id, contract_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_contract_nonce_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} id
 * @returns {Promise<any>}
 */
export function get_identity_balance(sdk, id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_balance(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}
/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @returns {Promise<any>}
 */
export function get_identities_balances(sdk, identity_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_balances(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_identity_balance_and_revision(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_balance_and_revision(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} public_key_hash
 * @returns {Promise<IdentityWasm>}
 */
export function get_identity_by_public_key_hash(sdk, public_key_hash) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(public_key_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_by_public_key_hash(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identities_ids
 * @param {string} contract_id
 * @param {Uint32Array | null} [purposes]
 * @returns {Promise<any>}
 */
export function get_identities_contract_keys(sdk, identities_ids, contract_id, purposes) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identities_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(purposes) ? 0 : passArray32ToWasm0(purposes, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_contract_keys(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} public_key_hash
 * @param {string | null} [start_after]
 * @returns {Promise<any>}
 */
export function get_identity_by_non_unique_public_key_hash(sdk, public_key_hash, start_after) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(public_key_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_by_non_unique_public_key_hash(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_identity_token_balances(sdk, identity_id, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_token_balances(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} key_request_type
 * @param {Uint32Array | null} [specific_key_ids]
 * @param {number | null} [limit]
 * @param {number | null} [offset]
 * @returns {Promise<any>}
 */
export function get_identity_keys_with_proof_info(sdk, identity_id, key_request_type, specific_key_ids, limit, offset) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(key_request_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(specific_key_ids) ? 0 : passArray32ToWasm0(specific_key_ids, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_keys_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(offset) ? 0x100000001 : (offset) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} id
 * @returns {Promise<any>}
 */
export function get_identity_balance_with_proof_info(sdk, id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_balance_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @returns {Promise<any>}
 */
export function get_identities_balances_with_proof_info(sdk, identity_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_balances_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_identity_balance_and_revision_with_proof_info(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_balance_and_revision_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} public_key_hash
 * @returns {Promise<any>}
 */
export function get_identity_by_public_key_hash_with_proof_info(sdk, public_key_hash) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(public_key_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_by_public_key_hash_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} public_key_hash
 * @param {string | null} [start_after]
 * @returns {Promise<any>}
 */
export function get_identity_by_non_unique_public_key_hash_with_proof_info(sdk, public_key_hash, start_after) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(public_key_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_by_non_unique_public_key_hash_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identities_ids
 * @param {string} contract_id
 * @param {Uint32Array | null} [purposes]
 * @returns {Promise<any>}
 */
export function get_identities_contract_keys_with_proof_info(sdk, identities_ids, contract_id, purposes) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identities_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(purposes) ? 0 : passArray32ToWasm0(purposes, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_contract_keys_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_identity_token_balances_with_proof_info(sdk, identity_id, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_token_balances_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type
 * @param {string | null} [where_clause]
 * @param {string | null} [order_by]
 * @param {number | null} [limit]
 * @param {string | null} [start_after]
 * @param {string | null} [start_at]
 * @returns {Promise<any>}
 */
export function get_documents(sdk, data_contract_id, document_type, where_clause, order_by, limit, start_after, start_at) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(where_clause) ? 0 : passStringToWasm0(where_clause, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(order_by) ? 0 : passStringToWasm0(order_by, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    var ptr4 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at) ? 0 : passStringToWasm0(start_at, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_documents(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, ptr4, len4, ptr5, len5);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type
 * @param {string | null} [where_clause]
 * @param {string | null} [order_by]
 * @param {number | null} [limit]
 * @param {string | null} [start_after]
 * @param {string | null} [start_at]
 * @returns {Promise<any>}
 */
export function get_documents_with_proof_info(sdk, data_contract_id, document_type, where_clause, order_by, limit, start_after, start_at) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(where_clause) ? 0 : passStringToWasm0(where_clause, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(order_by) ? 0 : passStringToWasm0(order_by, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len3 = WASM_VECTOR_LEN;
    var ptr4 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at) ? 0 : passStringToWasm0(start_at, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_documents_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, ptr4, len4, ptr5, len5);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type
 * @param {string} document_id
 * @returns {Promise<any>}
 */
export function get_document(sdk, data_contract_id, document_type, document_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_document(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type
 * @param {string} document_id
 * @returns {Promise<any>}
 */
export function get_document_with_proof_info(sdk, data_contract_id, document_type, document_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_document_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {number | null} [limit]
 * @returns {Promise<any>}
 */
export function get_dpns_usernames(sdk, identity_id, limit) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_usernames(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_dpns_username(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_username(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {number | null} [limit]
 * @returns {Promise<any>}
 */
export function get_dpns_usernames_with_proof_info(sdk, identity_id, limit) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_usernames_with_proof_info(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_dpns_username_with_proof_info(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_dpns_username_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_status(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_status(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_current_quorums_info(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_current_quorums_info(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_total_credits_in_platform(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_total_credits_in_platform(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_prefunded_specialized_balance(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_prefunded_specialized_balance(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} state_transition_hash
 * @returns {Promise<any>}
 */
export function wait_for_state_transition_result(sdk, state_transition_hash) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(state_transition_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.wait_for_state_transition_result(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} path
 * @param {string[]} keys
 * @returns {Promise<any>}
 */
export function get_path_elements(sdk, path, keys) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(path, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(keys, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_path_elements(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_total_credits_in_platform_with_proof_info(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_total_credits_in_platform_with_proof_info(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @returns {Promise<any>}
 */
export function get_prefunded_specialized_balance_with_proof_info(sdk, identity_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_prefunded_specialized_balance_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} path
 * @param {string[]} keys
 * @returns {Promise<any>}
 */
export function get_path_elements_with_proof_info(sdk, path, keys) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(path, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayJsValueToWasm0(keys, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_path_elements_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_4.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {WasmSdk} sdk
 * @param {number | null} [start_epoch]
 * @param {number | null} [count]
 * @param {boolean | null} [ascending]
 * @returns {Promise<any>}
 */
export function get_epochs_info(sdk, start_epoch, count, ascending) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_epochs_info(sdk.__wbg_ptr, isLikeNone(start_epoch) ? 0xFFFFFF : start_epoch, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(ascending) ? 0xFFFFFF : ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number | null} [start_epoch]
 * @param {number | null} [count]
 * @param {boolean | null} [ascending]
 * @returns {Promise<any>}
 */
export function get_finalized_epoch_infos(sdk, start_epoch, count, ascending) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_finalized_epoch_infos(sdk.__wbg_ptr, isLikeNone(start_epoch) ? 0xFFFFFF : start_epoch, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(ascending) ? 0xFFFFFF : ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number} epoch
 * @param {string[]} ids
 * @returns {Promise<any>}
 */
export function get_evonodes_proposed_epoch_blocks_by_ids(sdk, epoch, ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_evonodes_proposed_epoch_blocks_by_ids(sdk.__wbg_ptr, epoch, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number} epoch
 * @param {number | null} [limit]
 * @param {string | null} [start_after]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_evonodes_proposed_epoch_blocks_by_range(sdk, epoch, limit, start_after, order_ascending) {
    _assertClass(sdk, WasmSdk);
    var ptr0 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_evonodes_proposed_epoch_blocks_by_range(sdk.__wbg_ptr, epoch, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, ptr0, len0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_current_epoch(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_current_epoch(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number | null} [start_epoch]
 * @param {number | null} [count]
 * @param {boolean | null} [ascending]
 * @returns {Promise<any>}
 */
export function get_epochs_info_with_proof_info(sdk, start_epoch, count, ascending) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_epochs_info_with_proof_info(sdk.__wbg_ptr, isLikeNone(start_epoch) ? 0xFFFFFF : start_epoch, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(ascending) ? 0xFFFFFF : ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<any>}
 */
export function get_current_epoch_with_proof_info(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_current_epoch_with_proof_info(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number | null} [start_epoch]
 * @param {number | null} [count]
 * @param {boolean | null} [ascending]
 * @returns {Promise<any>}
 */
export function get_finalized_epoch_infos_with_proof_info(sdk, start_epoch, count, ascending) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_finalized_epoch_infos_with_proof_info(sdk.__wbg_ptr, isLikeNone(start_epoch) ? 0xFFFFFF : start_epoch, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(ascending) ? 0xFFFFFF : ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number} epoch
 * @param {string[]} pro_tx_hashes
 * @returns {Promise<any>}
 */
export function get_evonodes_proposed_epoch_blocks_by_ids_with_proof_info(sdk, epoch, pro_tx_hashes) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(pro_tx_hashes, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_evonodes_proposed_epoch_blocks_by_ids_with_proof_info(sdk.__wbg_ptr, epoch, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {number} epoch
 * @param {number | null} [limit]
 * @param {string | null} [start_after]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_evonodes_proposed_epoch_blocks_by_range_with_proof_info(sdk, epoch, limit, start_after, order_ascending) {
    _assertClass(sdk, WasmSdk);
    var ptr0 = isLikeNone(start_after) ? 0 : passStringToWasm0(start_after, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_evonodes_proposed_epoch_blocks_by_range_with_proof_info(sdk.__wbg_ptr, epoch, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, ptr0, len0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

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
 * @param {string} contract_id
 * @param {number} token_position
 * @returns {string}
 */
export function calculate_token_id_from_contract(contract_id, token_position) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.calculate_token_id_from_contract(ptr0, len0, token_position);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

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
 * console.log(`Token ${priceInfo.tokenId} current price: ${priceInfo.currentPrice}`);
 * ```
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {number} token_position
 * @returns {Promise<any>}
 */
export function get_token_price_by_contract(sdk, contract_id, token_position) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_price_by_contract(sdk.__wbg_ptr, ptr0, len0, token_position);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_identities_token_balances(sdk, identity_ids, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_token_balances(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[] | null} [token_ids]
 * @param {number | null} [_limit]
 * @param {number | null} [_offset]
 * @returns {Promise<any>}
 */
export function get_identity_token_infos(sdk, identity_id, token_ids, _limit, _offset) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(token_ids) ? 0 : passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_token_infos(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, isLikeNone(_limit) ? 0x100000001 : (_limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_identities_token_infos(sdk, identity_ids, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_token_infos(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_token_statuses(sdk, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_statuses(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_token_direct_purchase_prices(sdk, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_direct_purchase_prices(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @returns {Promise<any>}
 */
export function get_token_contract_info(sdk, data_contract_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_contract_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_token_perpetual_distribution_last_claim(sdk, identity_id, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_perpetual_distribution_last_claim(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_token_total_supply(sdk, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_total_supply(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_identities_token_balances_with_proof_info(sdk, identity_ids, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_token_balances_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_token_statuses_with_proof_info(sdk, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_statuses_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_token_total_supply_with_proof_info(sdk, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_total_supply_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[] | null} [token_ids]
 * @param {number | null} [_limit]
 * @param {number | null} [_offset]
 * @returns {Promise<any>}
 */
export function get_identity_token_infos_with_proof_info(sdk, identity_id, token_ids, _limit, _offset) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(token_ids) ? 0 : passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_token_infos_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, isLikeNone(_limit) ? 0x100000001 : (_limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} identity_ids
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_identities_token_infos_with_proof_info(sdk, identity_ids, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(identity_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_identities_token_infos_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} token_ids
 * @returns {Promise<any>}
 */
export function get_token_direct_purchase_prices_with_proof_info(sdk, token_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(token_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_direct_purchase_prices_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @returns {Promise<any>}
 */
export function get_token_contract_info_with_proof_info(sdk, data_contract_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_contract_info_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string} token_id
 * @returns {Promise<any>}
 */
export function get_token_perpetual_distribution_last_claim_with_proof_info(sdk, identity_id, token_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(token_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_token_perpetual_distribution_last_claim_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} document_type_name
 * @param {string} data_contract_id
 * @param {string} index_name
 * @param {Uint8Array | null} [start_at_value]
 * @param {number | null} [limit]
 * @param {number | null} [_offset]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resources(sdk, document_type_name, data_contract_id, index_name, start_at_value, limit, _offset, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(start_at_value) ? 0 : passArray8ToWasm0(start_at_value, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resources(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {string} document_type_name
 * @param {string} index_name
 * @param {any[]} index_values
 * @param {string} contestant_id
 * @param {string | null} [start_at_voter_info]
 * @param {number | null} [limit]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_voters_for_identity(sdk, contract_id, document_type_name, index_name, index_values, contestant_id, start_at_voter_info, limit, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(index_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passStringToWasm0(contestant_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at_voter_info) ? 0 : passStringToWasm0(start_at_voter_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_voters_for_identity(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {number | null} [limit]
 * @param {string | null} [start_at_vote_poll_id_info]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_identity_votes(sdk, identity_id, limit, start_at_vote_poll_id_info, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(start_at_vote_poll_id_info) ? 0 : passStringToWasm0(start_at_vote_poll_id_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_identity_votes(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, ptr1, len1, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string | null} [start_time_info]
 * @param {string | null} [end_time_info]
 * @param {number | null} [limit]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_vote_polls_by_end_date(sdk, start_time_info, end_time_info, limit, order_ascending) {
    _assertClass(sdk, WasmSdk);
    var ptr0 = isLikeNone(start_time_info) ? 0 : passStringToWasm0(start_time_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(end_time_info) ? 0 : passStringToWasm0(end_time_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_vote_polls_by_end_date(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} document_type_name
 * @param {string} data_contract_id
 * @param {string} index_name
 * @param {Uint8Array | null} [start_at_value]
 * @param {number | null} [limit]
 * @param {number | null} [_offset]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resources_with_proof_info(sdk, document_type_name, data_contract_id, index_name, start_at_value, limit, _offset, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(start_at_value) ? 0 : passArray8ToWasm0(start_at_value, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resources_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type_name
 * @param {string} index_name
 * @param {any[]} index_values
 * @param {string} _result_type
 * @param {boolean | null} [allow_include_locked_and_abstaining_vote_tally]
 * @param {string | null} [start_at_identifier_info]
 * @param {number | null} [count]
 * @param {boolean | null} [_order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_vote_state_with_proof_info(sdk, data_contract_id, document_type_name, index_name, index_values, _result_type, allow_include_locked_and_abstaining_vote_tally, start_at_identifier_info, count, _order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(index_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passStringToWasm0(_result_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at_identifier_info) ? 0 : passStringToWasm0(start_at_identifier_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_vote_state_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, isLikeNone(allow_include_locked_and_abstaining_vote_tally) ? 0xFFFFFF : allow_include_locked_and_abstaining_vote_tally ? 1 : 0, ptr5, len5, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(_order_ascending) ? 0xFFFFFF : _order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type_name
 * @param {string} index_name
 * @param {any[]} index_values
 * @param {string} contestant_id
 * @param {string | null} [start_at_identifier_info]
 * @param {number | null} [count]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_voters_for_identity_with_proof_info(sdk, data_contract_id, document_type_name, index_name, index_values, contestant_id, start_at_identifier_info, count, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(index_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passStringToWasm0(contestant_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at_identifier_info) ? 0 : passStringToWasm0(start_at_identifier_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_voters_for_identity_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {number | null} [limit]
 * @param {number | null} [offset]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_identity_votes_with_proof_info(sdk, identity_id, limit, offset, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_identity_votes_with_proof_info(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(offset) ? 0x100000001 : (offset) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {bigint | null} [start_time_ms]
 * @param {bigint | null} [end_time_ms]
 * @param {number | null} [limit]
 * @param {number | null} [offset]
 * @param {boolean | null} [order_ascending]
 * @returns {Promise<any>}
 */
export function get_vote_polls_by_end_date_with_proof_info(sdk, start_time_ms, end_time_ms, limit, offset, order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.get_vote_polls_by_end_date_with_proof_info(sdk.__wbg_ptr, !isLikeNone(start_time_ms), isLikeNone(start_time_ms) ? BigInt(0) : start_time_ms, !isLikeNone(end_time_ms), isLikeNone(end_time_ms) ? BigInt(0) : end_time_ms, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(offset) ? 0x100000001 : (offset) >>> 0, isLikeNone(order_ascending) ? 0xFFFFFF : order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {string} document_type_name
 * @param {string} index_name
 * @param {any[]} index_values
 * @param {string} _result_type
 * @param {boolean | null} [allow_include_locked_and_abstaining_vote_tally]
 * @param {string | null} [start_at_identifier_info]
 * @param {number | null} [count]
 * @param {boolean | null} [_order_ascending]
 * @returns {Promise<any>}
 */
export function get_contested_resource_vote_state(sdk, data_contract_id, document_type_name, index_name, index_values, _result_type, allow_include_locked_and_abstaining_vote_tally, start_at_identifier_info, count, _order_ascending) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayJsValueToWasm0(index_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passStringToWasm0(_result_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len4 = WASM_VECTOR_LEN;
    var ptr5 = isLikeNone(start_at_identifier_info) ? 0 : passStringToWasm0(start_at_identifier_info, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len5 = WASM_VECTOR_LEN;
    const ret = wasm.get_contested_resource_vote_state(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, isLikeNone(allow_include_locked_and_abstaining_vote_tally) ? 0xFFFFFF : allow_include_locked_and_abstaining_vote_tally ? 1 : 0, ptr5, len5, isLikeNone(count) ? 0x100000001 : (count) >>> 0, isLikeNone(_order_ascending) ? 0xFFFFFF : _order_ascending ? 1 : 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {number} group_contract_position
 * @returns {Promise<any>}
 */
export function get_group_info(sdk, data_contract_id, group_contract_position) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_info(sdk.__wbg_ptr, ptr0, len0, group_contract_position);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {number} group_contract_position
 * @param {string[] | null} [member_ids]
 * @param {string | null} [start_at]
 * @param {number | null} [limit]
 * @returns {Promise<any>}
 */
export function get_group_members(sdk, data_contract_id, group_contract_position, member_ids, start_at, limit) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(member_ids) ? 0 : passArrayJsValueToWasm0(member_ids, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(start_at) ? 0 : passStringToWasm0(start_at, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_members(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, ptr2, len2, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[] | null} [member_data_contracts]
 * @param {string[] | null} [owner_data_contracts]
 * @param {string[] | null} [moderator_data_contracts]
 * @returns {Promise<any>}
 */
export function get_identity_groups(sdk, identity_id, member_data_contracts, owner_data_contracts, moderator_data_contracts) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(member_data_contracts) ? 0 : passArrayJsValueToWasm0(member_data_contracts, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(owner_data_contracts) ? 0 : passArrayJsValueToWasm0(owner_data_contracts, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(moderator_data_contracts) ? 0 : passArrayJsValueToWasm0(moderator_data_contracts, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_groups(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {any} start_at_info
 * @param {number | null} [count]
 * @returns {Promise<any>}
 */
export function get_group_infos(sdk, contract_id, start_at_info, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_infos(sdk.__wbg_ptr, ptr0, len0, start_at_info, isLikeNone(count) ? 0x100000001 : (count) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {number} group_contract_position
 * @param {string} status
 * @param {any} start_at_info
 * @param {number | null} [count]
 * @returns {Promise<any>}
 */
export function get_group_actions(sdk, contract_id, group_contract_position, status, start_at_info, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(status, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_actions(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, start_at_info, isLikeNone(count) ? 0x100000001 : (count) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {number} group_contract_position
 * @param {string} status
 * @param {string} action_id
 * @returns {Promise<any>}
 */
export function get_group_action_signers(sdk, contract_id, group_contract_position, status, action_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(status, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(action_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_action_signers(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} data_contract_ids
 * @returns {Promise<any>}
 */
export function get_groups_data_contracts(sdk, data_contract_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(data_contract_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_groups_data_contracts(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {number} group_contract_position
 * @returns {Promise<any>}
 */
export function get_group_info_with_proof_info(sdk, data_contract_id, group_contract_position) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_info_with_proof_info(sdk.__wbg_ptr, ptr0, len0, group_contract_position);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {any} start_at_info
 * @param {number | null} [count]
 * @returns {Promise<any>}
 */
export function get_group_infos_with_proof_info(sdk, contract_id, start_at_info, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_infos_with_proof_info(sdk.__wbg_ptr, ptr0, len0, start_at_info, isLikeNone(count) ? 0x100000001 : (count) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} data_contract_id
 * @param {number} group_contract_position
 * @param {string[] | null} [member_ids]
 * @param {string | null} [start_at]
 * @param {number | null} [limit]
 * @returns {Promise<any>}
 */
export function get_group_members_with_proof_info(sdk, data_contract_id, group_contract_position, member_ids, start_at, limit) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(member_ids) ? 0 : passArrayJsValueToWasm0(member_ids, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(start_at) ? 0 : passStringToWasm0(start_at, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_members_with_proof_info(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, ptr2, len2, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} identity_id
 * @param {string[] | null} [member_data_contracts]
 * @param {string[] | null} [owner_data_contracts]
 * @param {string[] | null} [moderator_data_contracts]
 * @returns {Promise<any>}
 */
export function get_identity_groups_with_proof_info(sdk, identity_id, member_data_contracts, owner_data_contracts, moderator_data_contracts) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(member_data_contracts) ? 0 : passArrayJsValueToWasm0(member_data_contracts, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    var ptr2 = isLikeNone(owner_data_contracts) ? 0 : passArrayJsValueToWasm0(owner_data_contracts, wasm.__wbindgen_malloc);
    var len2 = WASM_VECTOR_LEN;
    var ptr3 = isLikeNone(moderator_data_contracts) ? 0 : passArrayJsValueToWasm0(moderator_data_contracts, wasm.__wbindgen_malloc);
    var len3 = WASM_VECTOR_LEN;
    const ret = wasm.get_identity_groups_with_proof_info(sdk.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {number} group_contract_position
 * @param {string} status
 * @param {any} start_at_info
 * @param {number | null} [count]
 * @returns {Promise<any>}
 */
export function get_group_actions_with_proof_info(sdk, contract_id, group_contract_position, status, start_at_info, count) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(status, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_actions_with_proof_info(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, start_at_info, isLikeNone(count) ? 0x100000001 : (count) >>> 0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} contract_id
 * @param {number} group_contract_position
 * @param {string} status
 * @param {string} action_id
 * @returns {Promise<any>}
 */
export function get_group_action_signers_with_proof_info(sdk, contract_id, group_contract_position, status, action_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(status, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(action_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.get_group_action_signers_with_proof_info(sdk.__wbg_ptr, ptr0, len0, group_contract_position, ptr1, len1, ptr2, len2);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} data_contract_ids
 * @returns {Promise<any>}
 */
export function get_groups_data_contracts_with_proof_info(sdk, data_contract_ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(data_contract_ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_groups_data_contracts_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @returns {Promise<void>}
 */
export function start() {
    wasm.start();
}

/**
 * @returns {Promise<void>}
 */
export function prefetch_trusted_quorums_mainnet() {
    const ret = wasm.prefetch_trusted_quorums_mainnet();
    return ret;
}

/**
 * @returns {Promise<void>}
 */
export function prefetch_trusted_quorums_testnet() {
    const ret = wasm.prefetch_trusted_quorums_testnet();
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<void>}
 */
export function identity_put(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.identity_put(sdk.__wbg_ptr);
    return ret;
}

/**
 * @returns {Promise<void>}
 */
export function epoch_testing() {
    const ret = wasm.epoch_testing();
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @returns {Promise<void>}
 */
export function docs_testing(sdk) {
    _assertClass(sdk, WasmSdk);
    const ret = wasm.docs_testing(sdk.__wbg_ptr);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} base58_id
 * @returns {Promise<DataContractWasm>}
 */
export function data_contract_fetch(sdk, base58_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(base58_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.data_contract_fetch(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} base58_id
 * @returns {Promise<any>}
 */
export function data_contract_fetch_with_proof_info(sdk, base58_id) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(base58_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.data_contract_fetch_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} id
 * @param {number | null} [limit]
 * @param {number | null} [_offset]
 * @param {bigint | null} [start_at_ms]
 * @returns {Promise<any>}
 */
export function get_data_contract_history(sdk, id, limit, _offset, start_at_ms) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_data_contract_history(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0, !isLikeNone(start_at_ms), isLikeNone(start_at_ms) ? BigInt(0) : start_at_ms);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} ids
 * @returns {Promise<any>}
 */
export function get_data_contracts(sdk, ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_data_contracts(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string} id
 * @param {number | null} [limit]
 * @param {number | null} [_offset]
 * @param {bigint | null} [start_at_ms]
 * @returns {Promise<any>}
 */
export function get_data_contract_history_with_proof_info(sdk, id, limit, _offset, start_at_ms) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_data_contract_history_with_proof_info(sdk.__wbg_ptr, ptr0, len0, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0, isLikeNone(_offset) ? 0x100000001 : (_offset) >>> 0, !isLikeNone(start_at_ms), isLikeNone(start_at_ms) ? BigInt(0) : start_at_ms);
    return ret;
}

/**
 * @param {WasmSdk} sdk
 * @param {string[]} ids
 * @returns {Promise<any>}
 */
export function get_data_contracts_with_proof_info(sdk, ids) {
    _assertClass(sdk, WasmSdk);
    const ptr0 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_data_contracts_with_proof_info(sdk.__wbg_ptr, ptr0, len0);
    return ret;
}

/**
 * Generate a new mnemonic phrase
 * @param {number | null} [word_count]
 * @param {string | null} [language_code]
 * @returns {string}
 */
export function generate_mnemonic(word_count, language_code) {
    let deferred3_0;
    let deferred3_1;
    try {
        var ptr0 = isLikeNone(language_code) ? 0 : passStringToWasm0(language_code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.generate_mnemonic(isLikeNone(word_count) ? 0x100000001 : (word_count) >>> 0, ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Validate a mnemonic phrase
 * @param {string} mnemonic
 * @param {string | null} [language_code]
 * @returns {boolean}
 */
export function validate_mnemonic(mnemonic, language_code) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(language_code) ? 0 : passStringToWasm0(language_code, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.validate_mnemonic(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * Derive a seed from a mnemonic phrase
 * @param {string} mnemonic
 * @param {string | null} [passphrase]
 * @returns {Uint8Array}
 */
export function mnemonic_to_seed(mnemonic, passphrase) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(passphrase) ? 0 : passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ret = wasm.mnemonic_to_seed(ptr0, len0, ptr1, len1);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Derive a key from mnemonic phrase using BIP39/BIP44
 * @param {string} mnemonic
 * @param {string | null | undefined} passphrase
 * @param {string} network
 * @returns {any}
 */
export function derive_key_from_seed_phrase(mnemonic, passphrase, network) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(passphrase) ? 0 : passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.derive_key_from_seed_phrase(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Derive a key from seed phrase with arbitrary path
 * @param {string} mnemonic
 * @param {string | null | undefined} passphrase
 * @param {string} path
 * @param {string} network
 * @returns {any}
 */
export function derive_key_from_seed_with_path(mnemonic, passphrase, path, network) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(passphrase) ? 0 : passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.derive_key_from_seed_with_path(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Create a BIP44 mainnet derivation path
 * @param {number} account
 * @param {number} change
 * @param {number} index
 * @returns {any}
 */
export function derivation_path_bip44_mainnet(account, change, index) {
    const ret = wasm.derivation_path_bip44_mainnet(account, change, index);
    return ret;
}

/**
 * Create a BIP44 testnet derivation path
 * @param {number} account
 * @param {number} change
 * @param {number} index
 * @returns {any}
 */
export function derivation_path_bip44_testnet(account, change, index) {
    const ret = wasm.derivation_path_bip44_testnet(account, change, index);
    return ret;
}

/**
 * Create a DIP9 mainnet derivation path
 * @param {number} feature_type
 * @param {number} account
 * @param {number} index
 * @returns {any}
 */
export function derivation_path_dip9_mainnet(feature_type, account, index) {
    const ret = wasm.derivation_path_dip9_mainnet(feature_type, account, index);
    return ret;
}

/**
 * Create a DIP9 testnet derivation path
 * @param {number} feature_type
 * @param {number} account
 * @param {number} index
 * @returns {any}
 */
export function derivation_path_dip9_testnet(feature_type, account, index) {
    const ret = wasm.derivation_path_dip9_testnet(feature_type, account, index);
    return ret;
}

/**
 * Create a DIP13 mainnet derivation path (for HD masternode keys)
 * @param {number} account
 * @returns {any}
 */
export function derivation_path_dip13_mainnet(account) {
    const ret = wasm.derivation_path_dip13_mainnet(account);
    return ret;
}

/**
 * Create a DIP13 testnet derivation path (for HD masternode keys)
 * @param {number} account
 * @returns {any}
 */
export function derivation_path_dip13_testnet(account) {
    const ret = wasm.derivation_path_dip13_testnet(account);
    return ret;
}

/**
 * Get child public key from extended public key
 * @param {string} xpub
 * @param {number} index
 * @param {boolean} hardened
 * @returns {string}
 */
export function derive_child_public_key(xpub, index, hardened) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(xpub, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.derive_child_public_key(ptr0, len0, index, hardened);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Convert extended private key to extended public key
 * @param {string} xprv
 * @returns {string}
 */
export function xprv_to_xpub(xprv) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(xprv, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.xprv_to_xpub(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Generate a new random key pair
 * @param {string} network
 * @returns {any}
 */
export function generate_key_pair(network) {
    const ptr0 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_key_pair(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_4.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}
/**
 * Generate multiple key pairs
 * @param {string} network
 * @param {number} count
 * @returns {any[]}
 */
export function generate_key_pairs(network, count) {
    const ptr0 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_key_pairs(ptr0, len0, count);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Create key pair from private key WIF
 * @param {string} private_key_wif
 * @returns {any}
 */
export function key_pair_from_wif(private_key_wif) {
    const ptr0 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.key_pair_from_wif(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Create key pair from private key hex
 * @param {string} private_key_hex
 * @param {string} network
 * @returns {any}
 */
export function key_pair_from_hex(private_key_hex, network) {
    const ptr0 = passStringToWasm0(private_key_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.key_pair_from_hex(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Get address from public key
 * @param {string} pubkey_hex
 * @param {string} network
 * @returns {string}
 */
export function pubkey_to_address(pubkey_hex, network) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(pubkey_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.pubkey_to_address(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Validate a Dash address
 * @param {string} address
 * @param {string} network
 * @returns {boolean}
 */
export function validate_address(address, network) {
    const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.validate_address(ptr0, len0, ptr1, len1);
    return ret !== 0;
}

/**
 * Sign a message with a private key
 * @param {string} message
 * @param {string} private_key_wif
 * @returns {string}
 */
export function sign_message(message, private_key_wif) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(message, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.sign_message(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Derive a key from seed phrase with extended path supporting 256-bit indices
 * This supports DIP14/DIP15 paths with identity IDs
 * @param {string} mnemonic
 * @param {string | null | undefined} passphrase
 * @param {string} path
 * @param {string} network
 * @returns {any}
 */
export function derive_key_from_seed_with_extended_path(mnemonic, passphrase, path, network) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(passphrase) ? 0 : passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.derive_key_from_seed_with_extended_path(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Derive a DashPay contact key using DIP15 with full identity IDs
 * @param {string} mnemonic
 * @param {string | null | undefined} passphrase
 * @param {string} sender_identity_id
 * @param {string} receiver_identity_id
 * @param {number} account
 * @param {number} address_index
 * @param {string} network
 * @returns {any}
 */
export function derive_dashpay_contact_key(mnemonic, passphrase, sender_identity_id, receiver_identity_id, account, address_index, network) {
    const ptr0 = passStringToWasm0(mnemonic, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = isLikeNone(passphrase) ? 0 : passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(sender_identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passStringToWasm0(receiver_identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passStringToWasm0(network, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.derive_dashpay_contact_key(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, account, address_index, ptr4, len4);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

function __wbg_adapter_56(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hc8e8c6d17a2beddc(arg0, arg1);
}

function __wbg_adapter_59(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h7cea2d9b3d9395f8(arg0, arg1);
}

function __wbg_adapter_62(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__hb74bf275a592f386(arg0, arg1);
}

function __wbg_adapter_65(arg0, arg1, arg2) {
    wasm.closure2704_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_470(arg0, arg1, arg2, arg3) {
    wasm.closure4518_externref_shim(arg0, arg1, arg2, arg3);
}

const __wbindgen_enum_ReadableStreamType = ["bytes"];

const __wbindgen_enum_ReferrerPolicy = ["", "no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "unsafe-url", "same-origin", "strict-origin", "strict-origin-when-cross-origin"];

const __wbindgen_enum_RequestCache = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"];

const __wbindgen_enum_RequestCredentials = ["omit", "same-origin", "include"];

const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];

const __wbindgen_enum_RequestRedirect = ["follow", "error", "manual"];

const DataContractWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_datacontractwasm_free(ptr >>> 0, 1));

export class DataContractWasm {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DataContractWasm.prototype);
        obj.__wbg_ptr = ptr;
        DataContractWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DataContractWasmFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_datacontractwasm_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.datacontractwasm_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {any}
     */
    toJSON() {
        const ret = wasm.datacontractwasm_toJSON(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}

const DocumentWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_documentwasm_free(ptr >>> 0, 1));

export class DocumentWasm {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DocumentWasm.prototype);
        obj.__wbg_ptr = ptr;
        DocumentWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DocumentWasmFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_documentwasm_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.documentwasm_id(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}

const IdentityWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_identitywasm_free(ptr >>> 0, 1));

export class IdentityWasm {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IdentityWasm.prototype);
        obj.__wbg_ptr = ptr;
        IdentityWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IdentityWasmFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_identitywasm_free(ptr, 0);
    }
    /**
     * @param {number} platform_version
     */
    constructor(platform_version) {
        const ret = wasm.identitywasm_new(platform_version);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        IdentityWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Array<any>} public_keys
     * @returns {number}
     */
    setPublicKeys(public_keys) {
        const ret = wasm.identitywasm_setPublicKeys(this.__wbg_ptr, public_keys);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * @returns {number}
     */
    get balance() {
        const ret = wasm.identitywasm_balance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getBalance() {
        const ret = wasm.identitywasm_balance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} balance
     */
    setBalance(balance) {
        wasm.identitywasm_setBalance(this.__wbg_ptr, balance);
    }
    /**
     * @param {number} amount
     * @returns {number}
     */
    increaseBalance(amount) {
        const ret = wasm.identitywasm_increaseBalance(this.__wbg_ptr, amount);
        return ret;
    }
    /**
     * @param {number} amount
     * @returns {number}
     */
    reduceBalance(amount) {
        const ret = wasm.identitywasm_reduceBalance(this.__wbg_ptr, amount);
        return ret;
    }
    /**
     * @param {number} revision
     */
    setRevision(revision) {
        wasm.identitywasm_setRevision(this.__wbg_ptr, revision);
    }
    /**
     * @returns {number}
     */
    getRevision() {
        const ret = wasm.identitywasm_getRevision(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {any}
     */
    toJSON() {
        const ret = wasm.identitywasm_toJSON(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    hash() {
        const ret = wasm.identitywasm_hash(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    getPublicKeyMaxId() {
        const ret = wasm.identitywasm_getPublicKeyMaxId(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} buffer
     * @returns {IdentityWasm}
     */
    static fromBuffer(buffer) {
        const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.identitywasm_fromBuffer(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return IdentityWasm.__wrap(ret[0]);
    }
}

const IntoUnderlyingByteSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingbytesource_free(ptr >>> 0, 1));

export class IntoUnderlyingByteSource {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingByteSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
    }
    /**
     * @returns {ReadableStreamType}
     */
    get type() {
        const ret = wasm.intounderlyingbytesource_type(this.__wbg_ptr);
        return __wbindgen_enum_ReadableStreamType[ret];
    }
    /**
     * @returns {number}
     */
    get autoAllocateChunkSize() {
        const ret = wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {ReadableByteStreamController} controller
     */
    start(controller) {
        wasm.intounderlyingbytesource_start(this.__wbg_ptr, controller);
    }
    /**
     * @param {ReadableByteStreamController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingbytesource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingbytesource_cancel(ptr);
    }
}

const IntoUnderlyingSinkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));

export class IntoUnderlyingSink {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSinkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsink_free(ptr, 0);
    }
    /**
     * @param {any} chunk
     * @returns {Promise<any>}
     */
    write(chunk) {
        const ret = wasm.intounderlyingsink_write(this.__wbg_ptr, chunk);
        return ret;
    }
    /**
     * @returns {Promise<any>}
     */
    close() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_close(ptr);
        return ret;
    }
    /**
     * @param {any} reason
     * @returns {Promise<any>}
     */
    abort(reason) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_abort(ptr, reason);
        return ret;
    }
}

const IntoUnderlyingSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));

export class IntoUnderlyingSource {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsource_free(ptr, 0);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingsource_cancel(ptr);
    }
}

const WasmContextFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmcontext_free(ptr >>> 0, 1));

export class WasmContext {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmContextFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmcontext_free(ptr, 0);
    }
}

const WasmErrorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmerror_free(ptr >>> 0, 1));

export class WasmError {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmErrorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmerror_free(ptr, 0);
    }
}

const WasmSdkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsdk_free(ptr >>> 0, 1));

export class WasmSdk {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmSdk.prototype);
        obj.__wbg_ptr = ptr;
        WasmSdkFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSdkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsdk_free(ptr, 0);
    }
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
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} owner_id
     * @param {string} document_data
     * @param {string} entropy
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentCreate(data_contract_id, document_type, owner_id, document_data, entropy, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(document_data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(entropy, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentCreate(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
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
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the replaced document
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} document_id
     * @param {string} owner_id
     * @param {string} document_data
     * @param {bigint} revision
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentReplace(data_contract_id, document_type, document_id, owner_id, document_data, revision, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(document_data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentReplace(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, revision, ptr5, len5);
        return ret;
    }
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
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue confirming deletion
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} document_id
     * @param {string} owner_id
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentDelete(data_contract_id, document_type, document_id, owner_id, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentDelete(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
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
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the transfer result
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} document_id
     * @param {string} owner_id
     * @param {string} recipient_id
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentTransfer(data_contract_id, document_type, document_id, owner_id, recipient_id, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(recipient_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentTransfer(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
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
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the purchase result
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} document_id
     * @param {string} buyer_id
     * @param {bigint} price
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentPurchase(data_contract_id, document_type, document_id, buyer_id, price, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(buyer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentPurchase(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, price, ptr4, len4);
        return ret;
    }
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
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the result
     * @param {string} data_contract_id
     * @param {string} document_type
     * @param {string} document_id
     * @param {string} owner_id
     * @param {bigint} price
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    documentSetPrice(data_contract_id, document_type, document_id, owner_id, price, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(document_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_documentSetPrice(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, price, ptr4, len4);
        return ret;
    }
    /**
     * Create a new identity on Dash Platform.
     *
     * # Arguments
     *
     * * `asset_lock_proof` - The asset lock proof (transaction hex)
     * * `asset_lock_proof_private_key` - The private key that controls the asset lock
     * * `public_keys` - JSON array of public keys to add to the identity. Each key object requirements:
     *   - ECDSA_SECP256K1: Requires `privateKeyHex` or `privateKeyWif` for signing
     *   - BLS12_381: Requires `privateKeyHex` for signing (WIF format not supported)
     *   - ECDSA_HASH160: Accepts either `privateKeyHex` (to derive hash) or `data` field (base64-encoded 20-byte hash)
     *
     * # Implementation Notes
     *
     * This function uses SimpleSigner to provide individual signatures for each public key as required.
     * Each ECDSA_SECP256K1 key will be signed with its corresponding private key (from privateKeyHex or privateKeyWif),
     * and each BLS12_381 key will be signed with its corresponding private key (from privateKeyHex only),
     * ensuring unique signatures per key as required by DPP validation.
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the new identity
     * @param {string} asset_lock_proof
     * @param {string} asset_lock_proof_private_key
     * @param {string} public_keys
     * @returns {Promise<any>}
     */
    identityCreate(asset_lock_proof, asset_lock_proof_private_key, public_keys) {
        const ptr0 = passStringToWasm0(asset_lock_proof, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(asset_lock_proof_private_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(public_keys, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_identityCreate(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        return ret;
    }
    /**
     * Top up an existing identity with additional credits.
     *
     * # Arguments
     *
     * * `identity_id` - The identity ID to top up
     * * `asset_lock_proof` - The asset lock proof (transaction hex)
     * * `asset_lock_proof_private_key` - The private key that controls the asset lock
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the new balance
     * @param {string} identity_id
     * @param {string} asset_lock_proof
     * @param {string} asset_lock_proof_private_key
     * @returns {Promise<any>}
     */
    identityTopUp(identity_id, asset_lock_proof, asset_lock_proof_private_key) {
        const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(asset_lock_proof, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(asset_lock_proof_private_key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_identityTopUp(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        return ret;
    }
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
     * @param {string} sender_id
     * @param {string} recipient_id
     * @param {bigint} amount
     * @param {string} private_key_wif
     * @param {number | null} [key_id]
     * @returns {Promise<any>}
     */
    identityCreditTransfer(sender_id, recipient_id, amount, private_key_wif, key_id) {
        const ptr0 = passStringToWasm0(sender_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(recipient_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_identityCreditTransfer(this.__wbg_ptr, ptr0, len0, ptr1, len1, amount, ptr2, len2, isLikeNone(key_id) ? 0x100000001 : (key_id) >>> 0);
        return ret;
    }
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
     * @param {string} identity_id
     * @param {string} to_address
     * @param {bigint} amount
     * @param {number | null | undefined} core_fee_per_byte
     * @param {string} private_key_wif
     * @param {number | null} [key_id]
     * @returns {Promise<any>}
     */
    identityCreditWithdrawal(identity_id, to_address, amount, core_fee_per_byte, private_key_wif, key_id) {
        const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(to_address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_identityCreditWithdrawal(this.__wbg_ptr, ptr0, len0, ptr1, len1, amount, isLikeNone(core_fee_per_byte) ? 0x100000001 : (core_fee_per_byte) >>> 0, ptr2, len2, isLikeNone(key_id) ? 0x100000001 : (key_id) >>> 0);
        return ret;
    }
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
     * @param {string} identity_id
     * @param {string | null | undefined} add_public_keys
     * @param {Uint32Array | null | undefined} disable_public_keys
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    identityUpdate(identity_id, add_public_keys, disable_public_keys, private_key_wif) {
        const ptr0 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(add_public_keys) ? 0 : passStringToWasm0(add_public_keys, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(disable_public_keys) ? 0 : passArray32ToWasm0(disable_public_keys, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_identityUpdate(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        return ret;
    }
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
     * @param {string} masternode_pro_tx_hash
     * @param {string} contract_id
     * @param {string} document_type_name
     * @param {string} index_name
     * @param {string} index_values
     * @param {string} vote_choice
     * @param {string} voting_key_wif
     * @returns {Promise<any>}
     */
    masternodeVote(masternode_pro_tx_hash, contract_id, document_type_name, index_name, index_values, vote_choice, voting_key_wif) {
        const ptr0 = passStringToWasm0(masternode_pro_tx_hash, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(document_type_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(index_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(index_values, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(vote_choice, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ptr6 = passStringToWasm0(voting_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len6 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_masternodeVote(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6);
        return ret;
    }
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
     * @param {string} owner_id
     * @param {string} contract_definition
     * @param {string} private_key_wif
     * @param {number | null} [key_id]
     * @returns {Promise<any>}
     */
    contractCreate(owner_id, contract_definition, private_key_wif, key_id) {
        const ptr0 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(contract_definition, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_contractCreate(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, isLikeNone(key_id) ? 0x100000001 : (key_id) >>> 0);
        return ret;
    }
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
     * @param {string} contract_id
     * @param {string} owner_id
     * @param {string} contract_updates
     * @param {string} private_key_wif
     * @param {number | null} [key_id]
     * @returns {Promise<any>}
     */
    contractUpdate(contract_id, owner_id, contract_updates, private_key_wif, key_id) {
        const ptr0 = passStringToWasm0(contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(owner_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(contract_updates, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_contractUpdate(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, isLikeNone(key_id) ? 0x100000001 : (key_id) >>> 0);
        return ret;
    }
    /**
     * @returns {number}
     */
    version() {
        const ret = wasm.wasmsdk_version(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Test serialization of different object types
     * @param {string} test_type
     * @returns {any}
     */
    testSerialization(test_type) {
        const ptr0 = passStringToWasm0(test_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_testSerialization(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * * `recipient_id` - Optional recipient identity ID (if None, mints to issuer)
     * * `public_note` - Optional public note for the mint operation
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} amount
     * @param {string} identity_id
     * @param {string} private_key_wif
     * @param {string | null} [recipient_id]
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenMint(data_contract_id, token_position, amount, identity_id, private_key_wif, recipient_id, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(amount, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(recipient_id) ? 0 : passStringToWasm0(recipient_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        var ptr5 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenMint(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
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
     * * `public_note` - Optional public note for the burn operation
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} amount
     * @param {string} identity_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenBurn(data_contract_id, token_position, amount, identity_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(amount, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenBurn(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
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
     * * `public_note` - Optional public note for the transfer
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} amount
     * @param {string} sender_id
     * @param {string} recipient_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenTransfer(data_contract_id, token_position, amount, sender_id, recipient_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(amount, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(sender_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(recipient_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        var ptr5 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenTransfer(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
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
     * * `public_note` - Optional public note for the freeze operation
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} identity_to_freeze
     * @param {string} freezer_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenFreeze(data_contract_id, token_position, identity_to_freeze, freezer_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(identity_to_freeze, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(freezer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenFreeze(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
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
     * * `public_note` - Optional public note for the unfreeze operation
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} identity_to_unfreeze
     * @param {string} unfreezer_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenUnfreeze(data_contract_id, token_position, identity_to_unfreeze, unfreezer_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(identity_to_unfreeze, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(unfreezer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenUnfreeze(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
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
     * * `public_note` - Optional public note for the destroy operation
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} identity_id
     * @param {string} destroyer_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenDestroyFrozen(data_contract_id, token_position, identity_id, destroyer_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(destroyer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenDestroyFrozen(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
    /**
     * Set or update the price for direct token purchases.
     *
     * # Arguments
     *
     * * `data_contract_id` - The ID of the data contract containing the token
     * * `token_position` - The position of the token in the contract (0-indexed)
     * * `identity_id` - The identity ID of the actor setting the price
     * * `price_type` - The pricing type: "single" or "tiered"
     * * `price_data` - JSON string with pricing data (single price or tiered pricing map)
     * * `private_key_wif` - The private key in WIF format for signing
     * * `key_id` - The key ID to use for signing
     * * `public_note` - Optional public note for the price change
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} identity_id
     * @param {string} price_type
     * @param {string} price_data
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenSetPriceForDirectPurchase(data_contract_id, token_position, identity_id, price_type, price_data, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(price_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(price_data, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        var ptr5 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenSetPriceForDirectPurchase(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
    /**
     * Purchase tokens directly at the configured price.
     *
     * # Arguments
     *
     * * `data_contract_id` - The ID of the data contract containing the token
     * * `token_position` - The position of the token in the contract (0-indexed)
     * * `amount` - The amount of tokens to purchase
     * * `identity_id` - The identity ID of the purchaser
     * * `total_agreed_price` - The total price in credits for the purchase
     * * `private_key_wif` - The private key in WIF format for signing
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} amount
     * @param {string} identity_id
     * @param {string | null | undefined} total_agreed_price
     * @param {string} private_key_wif
     * @returns {Promise<any>}
     */
    tokenDirectPurchase(data_contract_id, token_position, amount, identity_id, total_agreed_price, private_key_wif) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(amount, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(total_agreed_price) ? 0 : passStringToWasm0(total_agreed_price, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenDirectPurchase(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
    /**
     * Claim tokens from a distribution
     *
     * # Arguments
     *
     * * `data_contract_id` - ID of the data contract containing the token
     * * `token_position` - Position of the token within the contract
     * * `distribution_type` - Type of distribution: "perpetual" or "preprogrammed"
     * * `identity_id` - Identity ID of the claimant
     * * `private_key_wif` - Private key in WIF format
     * * `public_note` - Optional public note
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} distribution_type
     * @param {string} identity_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenClaim(data_contract_id, token_position, distribution_type, identity_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(distribution_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenClaim(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        return ret;
    }
    /**
     * Update token configuration settings.
     *
     * # Arguments
     *
     * * `data_contract_id` - The ID of the data contract containing the token
     * * `token_position` - The position of the token in the contract (0-indexed)
     * * `config_item_type` - The type of configuration to update
     * * `config_value` - The new configuration value (JSON string)
     * * `identity_id` - The identity ID of the owner/admin
     * * `private_key_wif` - The private key in WIF format for signing
     * * `public_note` - Optional public note for the configuration change
     *
     * # Returns
     *
     * Returns a Promise that resolves to a JsValue containing the state transition result
     * @param {string} data_contract_id
     * @param {number} token_position
     * @param {string} config_item_type
     * @param {string} config_value
     * @param {string} identity_id
     * @param {string} private_key_wif
     * @param {string | null} [public_note]
     * @returns {Promise<any>}
     */
    tokenConfigUpdate(data_contract_id, token_position, config_item_type, config_value, identity_id, private_key_wif, public_note) {
        const ptr0 = passStringToWasm0(data_contract_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(config_item_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(config_value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(identity_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(private_key_wif, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        var ptr5 = isLikeNone(public_note) ? 0 : passStringToWasm0(public_note, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len5 = WASM_VECTOR_LEN;
        const ret = wasm.wasmsdk_tokenConfigUpdate(this.__wbg_ptr, ptr0, len0, token_position, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        return ret;
    }
}

const WasmSdkBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmsdkbuilder_free(ptr >>> 0, 1));

export class WasmSdkBuilder {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmSdkBuilder.prototype);
        obj.__wbg_ptr = ptr;
        WasmSdkBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmSdkBuilderFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmsdkbuilder_free(ptr, 0);
    }
    /**
     * Get the latest platform version number
     * @returns {number}
     */
    static getLatestVersionNumber() {
        const ret = wasm.wasmsdkbuilder_getLatestVersionNumber();
        return ret >>> 0;
    }
    /**
     * @returns {WasmSdkBuilder}
     */
    static new_mainnet() {
        const ret = wasm.wasmsdkbuilder_new_mainnet();
        return WasmSdkBuilder.__wrap(ret);
    }
    /**
     * @returns {WasmSdkBuilder}
     */
    static new_mainnet_trusted() {
        const ret = wasm.wasmsdkbuilder_new_mainnet_trusted();
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmSdkBuilder.__wrap(ret[0]);
    }
    /**
     * @returns {WasmSdkBuilder}
     */
    static new_testnet() {
        const ret = wasm.wasmsdkbuilder_new_testnet();
        return WasmSdkBuilder.__wrap(ret);
    }
    /**
     * @returns {WasmSdkBuilder}
     */
    static new_testnet_trusted() {
        const ret = wasm.wasmsdkbuilder_new_testnet_trusted();
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmSdkBuilder.__wrap(ret[0]);
    }
    /**
     * @returns {WasmSdk}
     */
    build() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.wasmsdkbuilder_build(ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmSdk.__wrap(ret[0]);
    }
    /**
     * @param {WasmContext} context_provider
     * @returns {WasmSdkBuilder}
     */
    with_context_provider(context_provider) {
        const ptr = this.__destroy_into_raw();
        _assertClass(context_provider, WasmContext);
        var ptr0 = context_provider.__destroy_into_raw();
        const ret = wasm.wasmsdkbuilder_with_context_provider(ptr, ptr0);
        return WasmSdkBuilder.__wrap(ret);
    }
    /**
     * Configure platform version to use.
     *
     * Available versions:
     * - 1: Platform version 1
     * - 2: Platform version 2
     * - ... up to latest version
     *
     * Defaults to latest version if not specified.
     * @param {number} version_number
     * @returns {WasmSdkBuilder}
     */
    with_version(version_number) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.wasmsdkbuilder_with_version(ptr, version_number);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return WasmSdkBuilder.__wrap(ret[0]);
    }
    /**
     * Configure request settings for the SDK.
     *
     * Settings include:
     * - connect_timeout_ms: Timeout for establishing connection (in milliseconds)
     * - timeout_ms: Timeout for single request (in milliseconds)
     * - retries: Number of retries in case of failed requests
     * - ban_failed_address: Whether to ban DAPI address if node not responded or responded with error
     * @param {number | null} [connect_timeout_ms]
     * @param {number | null} [timeout_ms]
     * @param {number | null} [retries]
     * @param {boolean | null} [ban_failed_address]
     * @returns {WasmSdkBuilder}
     */
    with_settings(connect_timeout_ms, timeout_ms, retries, ban_failed_address) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.wasmsdkbuilder_with_settings(ptr, isLikeNone(connect_timeout_ms) ? 0x100000001 : (connect_timeout_ms) >>> 0, isLikeNone(timeout_ms) ? 0x100000001 : (timeout_ms) >>> 0, isLikeNone(retries) ? 0x100000001 : (retries) >>> 0, isLikeNone(ban_failed_address) ? 0xFFFFFF : ban_failed_address ? 1 : 0);
        return WasmSdkBuilder.__wrap(ret);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(arg0, arg1) {
        const ret = String(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_abort_410ec47a64ac6117 = function(arg0, arg1) {
        arg0.abort(arg1);
    };
    imports.wbg.__wbg_abort_775ef1d17fc65868 = function(arg0) {
        arg0.abort();
    };
    imports.wbg.__wbg_append_8c7dd8d641a5f01b = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        arg0.append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    }, arguments) };
    imports.wbg.__wbg_arrayBuffer_d1b44c4390db422f = function() { return handleError(function (arg0) {
        const ret = arg0.arrayBuffer();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_body_0b8fd1fe671660df = function(arg0) {
        const ret = arg0.body;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_buffer_09165b52af8c5237 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_byobRequest_77d9adf63337edfb = function(arg0) {
        const ret = arg0.byobRequest;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_byteLength_e674b853d9c77e1d = function(arg0) {
        const ret = arg0.byteLength;
        return ret;
    };
    imports.wbg.__wbg_byteOffset_fd862df290ef848d = function(arg0) {
        const ret = arg0.byteOffset;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_cancel_8a308660caa6cadf = function(arg0) {
        const ret = arg0.cancel();
        return ret;
    };
    imports.wbg.__wbg_catch_a6e601879b2610e9 = function(arg0, arg1) {
        const ret = arg0.catch(arg1);
        return ret;
    };
    imports.wbg.__wbg_clearTimeout_2e2c4939388cdfbb = function(arg0) {
        const ret = clearTimeout(arg0);
        return ret;
    };
    imports.wbg.__wbg_clearTimeout_5a54f8841c30079a = function(arg0) {
        const ret = clearTimeout(arg0);
        return ret;
    };
    imports.wbg.__wbg_clearTimeout_6222fede17abcb1a = function(arg0) {
        const ret = clearTimeout(arg0);
        return ret;
    };
    imports.wbg.__wbg_close_304cc1fef3466669 = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_5ce03e29be453811 = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_crypto_574e78ad8b13b65f = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_datacontractwasm_new = function(arg0) {
        const ret = DataContractWasm.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_documentwasm_new = function(arg0) {
        const ret = DocumentWasm.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_done_769e5ede4b31c67b = function(arg0) {
        const ret = arg0.done;
        return ret;
    };
    imports.wbg.__wbg_enqueue_bb16ba72f537dc9e = function() { return handleError(function (arg0, arg1) {
        arg0.enqueue(arg1);
    }, arguments) };
    imports.wbg.__wbg_entries_3265d4158b33e5dc = function(arg0) {
        const ret = Object.entries(arg0);
        return ret;
    };
    imports.wbg.__wbg_error_524f506f44df1645 = function(arg0) {
        console.error(arg0);
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_fetch_07cd86dd296a5a63 = function(arg0, arg1, arg2) {
        const ret = arg0.fetch(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_fetch_509096533071c657 = function(arg0, arg1) {
        const ret = arg0.fetch(arg1);
        return ret;
    };
    imports.wbg.__wbg_fetch_53eef7df7b439a49 = function(arg0, arg1) {
        const ret = fetch(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbg_fetch_f156d10be9a5c88a = function(arg0) {
        const ret = fetch(arg0);
        return ret;
    };
    imports.wbg.__wbg_from_2a5d3e218e67aa85 = function(arg0) {
        const ret = Array.from(arg0);
        return ret;
    };
    imports.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_getReader_48e00749fe3f6089 = function() { return handleError(function (arg0) {
        const ret = arg0.getReader();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_getTime_46267b1c24877e30 = function(arg0) {
        const ret = arg0.getTime();
        return ret;
    };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_b9b93047fe3cf45b = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_getdone_d47073731acd3e74 = function(arg0) {
        const ret = arg0.done;
        return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
    };
    imports.wbg.__wbg_getvalue_009dcd63692bee1f = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_has_a5ea9117f258a0ec = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.has(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_headers_9cb51cfd2ac780a4 = function(arg0) {
        const ret = arg0.headers;
        return ret;
    };
    imports.wbg.__wbg_identitywasm_new = function(arg0) {
        const ret = IdentityWasm.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_e14585432e3737fc = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Map_f3469ce2244d2430 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Map;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Object_7f2dcef8f78644a4 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Object;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Response_f2cc20d9f7dfd644 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Response;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_17156bcf118086a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_a1eab7e0d067391b = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbg_isSafeInteger_343e2beeeece1bb0 = function(arg0) {
        const ret = Number.isSafeInteger(arg0);
        return ret;
    };
    imports.wbg.__wbg_iterator_9a24c88df860dc65 = function() {
        const ret = Symbol.iterator;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_e2d2a49132c1b256 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_log_0cc1b7768397bcfe = function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.log(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3), getStringFromWasm0(arg4, arg5), getStringFromWasm0(arg6, arg7));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_log_c222819a41e063d3 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbg_log_cb9e190acc5753fb = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.log(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_mark_7438147ce31e9d4b = function(arg0, arg1) {
        performance.mark(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_measure_fb7825c11612c823 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        let deferred0_0;
        let deferred0_1;
        let deferred1_0;
        let deferred1_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            deferred1_0 = arg2;
            deferred1_1 = arg3;
            performance.measure(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }, arguments) };
    imports.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new0_f788a2397c7ca929 = function() {
        const ret = new Date();
        return ret;
    };
    imports.wbg.__wbg_new_018dcc2d6c8c2f6a = function() { return handleError(function () {
        const ret = new Headers();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_23a2665fac83c611 = function(arg0, arg1) {
        try {
            var state0 = {a: arg0, b: arg1};
            var cb0 = (arg0, arg1) => {
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_470(a, state0.b, arg0, arg1);
                } finally {
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return ret;
        } finally {
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_new_405e22f390576ce2 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_5e0be73521bc8c17 = function() {
        const ret = new Map();
        return ret;
    };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_c68d7209be747379 = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_new_e25e5aab09ff45db = function() { return handleError(function () {
        const ret = new AbortController();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithstrandinit_06c535e0a867c635 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_next_25feadfc0913fea9 = function(arg0) {
        const ret = arg0.next;
        return ret;
    };
    imports.wbg.__wbg_next_6574e1a8a62d1055 = function() { return handleError(function (arg0) {
        const ret = arg0.next();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_node_905d3e251edff8a2 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_now_807e54c39636c349 = function() {
        const ret = Date.now();
        return ret;
    };
    imports.wbg.__wbg_parse_def2e24ef1252aff = function() { return handleError(function (arg0, arg1) {
        const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
        return ret;
    }, arguments) };
    imports.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_push_737cfc8c1432c2c6 = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function(arg0) {
        queueMicrotask(arg0);
    };
    imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function(arg0) {
        const ret = arg0.queueMicrotask;
        return ret;
    };
    imports.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_read_a2434af1186cb56c = function(arg0) {
        const ret = arg0.read();
        return ret;
    };
    imports.wbg.__wbg_releaseLock_091899af97991d2e = function(arg0) {
        arg0.releaseLock();
    };
    imports.wbg.__wbg_require_60cc747a6bc5215a = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_resolve_4851785c9c5f573d = function(arg0) {
        const ret = Promise.resolve(arg0);
        return ret;
    };
    imports.wbg.__wbg_respond_1f279fa9f8edcb1c = function() { return handleError(function (arg0, arg1) {
        arg0.respond(arg1 >>> 0);
    }, arguments) };
    imports.wbg.__wbg_setTimeout_2b339866a2aa3789 = function(arg0, arg1) {
        const ret = setTimeout(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbg_setTimeout_929c97a7c0f23d36 = function(arg0, arg1) {
        const ret = setTimeout(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbg_setTimeout_db2dbaeefb6f39c7 = function() { return handleError(function (arg0, arg1) {
        const ret = setTimeout(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_11cd83f45504cedf = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        arg0.set(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    }, arguments) };
    imports.wbg.__wbg_set_37837023f3d740e8 = function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_set_3f1d0b984ed272ed = function(arg0, arg1, arg2) {
        arg0[arg1] = arg2;
    };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_8fc6bf8a5b1071d1 = function(arg0, arg1, arg2) {
        const ret = arg0.set(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_set_bb8cecf6a62b9f46 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_setbody_5923b78a95eedf29 = function(arg0, arg1) {
        arg0.body = arg1;
    };
    imports.wbg.__wbg_setcache_12f17c3a980650e4 = function(arg0, arg1) {
        arg0.cache = __wbindgen_enum_RequestCache[arg1];
    };
    imports.wbg.__wbg_setcredentials_c3a22f1cd105a2c6 = function(arg0, arg1) {
        arg0.credentials = __wbindgen_enum_RequestCredentials[arg1];
    };
    imports.wbg.__wbg_setheaders_834c0bdb6a8949ad = function(arg0, arg1) {
        arg0.headers = arg1;
    };
    imports.wbg.__wbg_setintegrity_564a2397cf837760 = function(arg0, arg1, arg2) {
        arg0.integrity = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setmethod_3c5280fe5d890842 = function(arg0, arg1, arg2) {
        arg0.method = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setmode_5dc300b865044b65 = function(arg0, arg1) {
        arg0.mode = __wbindgen_enum_RequestMode[arg1];
    };
    imports.wbg.__wbg_setredirect_40e6a7f717a2f86a = function(arg0, arg1) {
        arg0.redirect = __wbindgen_enum_RequestRedirect[arg1];
    };
    imports.wbg.__wbg_setreferrer_fea46c1230e5e29a = function(arg0, arg1, arg2) {
        arg0.referrer = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setreferrerpolicy_b73612479f761b6f = function(arg0, arg1) {
        arg0.referrerPolicy = __wbindgen_enum_ReferrerPolicy[arg1];
    };
    imports.wbg.__wbg_setsignal_75b21ef3a81de905 = function(arg0, arg1) {
        arg0.signal = arg1;
    };
    imports.wbg.__wbg_signal_aaf9ad74119f20a4 = function(arg0) {
        const ret = arg0.signal;
        return ret;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_status_f6360336ca686bf0 = function(arg0) {
        const ret = arg0.status;
        return ret;
    };
    imports.wbg.__wbg_stringify_f7ed6987935b4a24 = function() { return handleError(function (arg0) {
        const ret = JSON.stringify(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_then_44b73946d2fb3e7d = function(arg0, arg1) {
        const ret = arg0.then(arg1);
        return ret;
    };
    imports.wbg.__wbg_then_48b406749878a531 = function(arg0, arg1, arg2) {
        const ret = arg0.then(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_toString_5285597960676b7b = function(arg0) {
        const ret = arg0.toString();
        return ret;
    };
    imports.wbg.__wbg_toString_b46b28b849433558 = function(arg0) {
        const ret = arg0.toString();
        return ret;
    };
    imports.wbg.__wbg_url_ae10c34ca209681d = function(arg0, arg1) {
        const ret = arg1.url;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_value_cd1ffa7b1ab794f1 = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_versions_c01dfd4722a88165 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbg_view_fd8a56e8983f448d = function(arg0) {
        const ret = arg0.view;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_warn_4ca3906c248c47c4 = function(arg0) {
        console.warn(arg0);
    };
    imports.wbg.__wbindgen_array_new = function() {
        const ret = [];
        return ret;
    };
    imports.wbg.__wbindgen_array_push = function(arg0, arg1) {
        arg0.push(arg1);
    };
    imports.wbg.__wbindgen_bigint_from_i64 = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_bigint_from_u64 = function(arg0) {
        const ret = BigInt.asUintN(64, arg0);
        return ret;
    };
    imports.wbg.__wbindgen_bigint_get_as_i64 = function(arg0, arg1) {
        const v = arg1;
        const ret = typeof(v) === 'bigint' ? v : undefined;
        getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = arg0.original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper16943 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 2610, __wbg_adapter_59);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper17013 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 2658, __wbg_adapter_62);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper17436 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 2705, __wbg_adapter_65);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper6994 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 1564, __wbg_adapter_56);
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_in = function(arg0, arg1) {
        const ret = arg0 in arg1;
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_4;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_bigint = function(arg0) {
        const ret = typeof(arg0) === 'bigint';
        return ret;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_null = function(arg0) {
        const ret = arg0 === null;
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_jsval_eq = function(arg0, arg1) {
        const ret = arg0 === arg1;
        return ret;
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = arg0 == arg1;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('wasm_sdk_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
