/* Import modules. */
// MINIMAL L1 (Core chain) support.
//
// Scope is deliberately narrow: the ONLY reason this module exists is to
// accept coins on the L1 for asset locks and identity creation. Nothing
// here is general-purpose wallet functionality.
//
// Flow (verified end-to-end on testnet, see AGENTS.md F24):
//   1. derive a funding key/address from the user's own mnemonic
//   2. user sends DASH to it (any wallet on mainnet; faucet on testnet)
//   3. build + sign an asset-lock transaction locally (Dash Core v23 format)
//   4. broadcast via the public Insight API
//   5. wait for confirmation, then hand the txid to the registrar manager,
//      which builds the ChainAssetLockProof and creates the identity
// NOTE: dashcore-lib ships TypeScript definitions that do not match its
//       runtime API (verified at runtime), so the library surface is
//       accessed through an untyped namespace, consistent with how the
//       repo already treats @nexajs.
import * as dashcore from '@dashevo/dashcore-lib'
import { getMnemonic } from './secure-storage'

/* The shipped typings do not match the runtime API (verified), so the
 * library is accessed untyped. */
const d: any = dashcore

/* Initialize constants. */

// Public Insight API endpoints (CORS-enabled, verified).
const INSIGHT_URLS = {
    mainnet: 'https://insight.dash.org/insight-api',
    testnet: 'https://insight.testnet.networks.dash.org/insight-api',
} as const

// Amount LOCKED into the identity (credits). The on-chain cost is DOUBLE
// this: the OP_RETURN output burns this value into the credit pool AND an
// equal P2PKH credit output is paid back to the funding key (Dash Core v23
// requires creditOutputs sum == OP_RETURN value).
export const ASSET_LOCK_SATOSHIS = 100_000_000 // 0.1 DASH locked

// Fee rate used for the asset-lock transaction (sats per kB). Kept well
// below the network's maxfeerate (verified relay min is 1000 sats/kB).
const FEE_PER_KB = 3000

// The minimum deposit the funding address needs before we can proceed:
// locked (burn) + locked (credit output) + fee margin.
export const MINIMUM_DEPOSIT_SATOSHIS = ASSET_LOCK_SATOSHIS * 2 + 5_000

// Map app network names to dashcore-lib network names.
const toCoreNetwork = (_network: string) =>
    _network === 'mainnet' ? 'livenet' : 'testnet'

const getInsightUrl = (_network: string) => {
    return _network === 'mainnet'
        ? INSIGHT_URLS.mainnet
        : INSIGHT_URLS.testnet
}

/**
 * Derive Funding Key
 *
 * Derives the L1 funding keypair from the user's OWN mnemonic using the
 * standard BIP-44 Dash path (coin type 5). The key never leaves the client.
 */
export const deriveFundingKey = (
    _network: string,
    _index: number,
) => {
    /* Request mnemonic. */
    const mnemonic = getMnemonic()

    /* Validate mnemonic. */
    if (!mnemonic) {
        throw new Error('Mnemonic not found')
    }

    /* Derive the BIP-44 root for Dash. */
    const root = d.HDPrivateKey.fromSeed(
        (new d.Mnemonic(mnemonic)).toSeed(),
        toCoreNetwork(_network),
    )

    /* Derive the funding key: m/44'/5'/0'/0/{index}. */
    const derived = root.derive(`m/44'/5'/0'/0/${_index}`)

    /* Build private key + address.
     * NOTE: pass the network explicitly so the WIF carries the correct
     * prefix (dashcore-lib defaults to livenet). */
    const privateKey = new d.PrivateKey(
        derived.privateKey, toCoreNetwork(_network))
    const address = privateKey.toAddress(toCoreNetwork(_network))

    /* Return funding info. */
    return {
        path: `m/44'/5'/0'/0/${_index}`,
        privateKeyWif: privateKey.toWIF(),
        publicKeyHex: privateKey.publicKey.toString(),
        address: address.toString(),
    }
}

/**
 * Get Funding UTXOs
 *
 * Queries the public Insight API for unspent outputs at the funding
 * address. Returns an empty array while the deposit has not arrived.
 */
export const getFundingUtxos = async (
    _network: string,
    _address: string,
): Promise<any[]> => {
    /* Request UTXOs. */
    const response = await fetch(
        `${getInsightUrl(_network)}/addr/${_address}/utxo`,
    ).catch(err => {
        console.error('Insight UTXO request failed:', err)
        return null
    })

    /* Validate response. */
    if (response === null || !response.ok) {
        return []
    }

    /* Return (parsed) UTXOs. */
    return response.json()
}

/**
 * Create Asset Lock Transaction
 *
 * Builds and signs a DIP-2 asset-lock special transaction in the Dash Core
 * v23 format (verified against src/evo/assetlocktx.cpp and accepted by
 * testnet):
 *   - exactly one OP_RETURN output with a 2-byte script (6a00) whose value
 *     equals the locked amount (this is what enters the credit pool),
 *   - P2PKH credit output(s) in the extra payload summing to the SAME value
 *     (paid back to the funding key),
 *   - change back to the funding address.
 *
 * The transaction is signed with the funding key. Returns the raw hex and
 * txid; broadcasting is a separate step so the UI can sequence it.
 */
export const createAssetLockTransaction = (
    _network: string,
    _fundingWif: string,
    _utxos: any[],
    _lockedSatoshis: number = ASSET_LOCK_SATOSHIS,
) => {
    /* Build the credit output script (P2PKH to the funding address). */
    const fundingAddress = d.Address.fromString(
        _utxos[0].address,
        toCoreNetwork(_network),
    )
    const creditScript = d.Script.buildPublicKeyHashOut(fundingAddress)

    /* Initialize the transaction. */
    const tx = new d.Transaction()
        .from(_utxos)
        .feePerKb(FEE_PER_KB)

    /* Mark as a DIP-2 asset-lock special transaction (version 3, type 8). */
    tx.setType(d.Transaction.TYPES.TRANSACTION_ASSET_LOCK)

    /* OP_RETURN marker output (index 0): 2-byte script (OP_RETURN OP_0),
     * carries the locked value into the credit pool. */
    const returnOutput = new d.Transaction.Output({
        satoshis: _lockedSatoshis,
        script: d.Script.empty()
            .add(d.Opcode.OP_RETURN)
            .add(d.Opcode(0)),
    })

    /* Credit output (index 1): P2PKH to the funding key, value MUST equal
     * the OP_RETURN value (Dash Core validation). */
    const creditOutput = new d.Transaction.Output({
        satoshis: _lockedSatoshis,
        script: creditScript,
    })

    /* Credit output first (after the marker), then change. */
    tx.outputs = [returnOutput, creditOutput]
    tx.change(fundingAddress)

    /* Attach the asset-lock payload: version 1 + the credit output(s). */
    tx.extraPayload.creditOutputs = [creditOutput]

    /* Sign with the funding key. */
    tx.sign(_fundingWif)

    /* Serialize (with validation). */
    const hex = tx.checkedSerialize()

    /* Return transaction details. */
    return {
        txid: tx.id,
        hex,
        lockedSatoshis: _lockedSatoshis,
        creditIndex: 1,
    }
}

/**
 * Broadcast Transaction
 *
 * Broadcasts a raw transaction hex via the public Insight API.
 */
export const broadcastTransaction = async (
    _network: string,
    _hex: string,
): Promise<string> => {
    /* Broadcast. */
    const response = await fetch(`${getInsightUrl(_network)}/tx/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawtx: _hex }),
    })

    /* Handle (insight) error body (plain text). */
    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Broadcast failed: ${errorText}`)
    }

    /* Parse response. */
    const json = await response.json()

    /* Return txid. */
    return json.txid
}

/**
 * Get Best Height
 */
export const getBestHeight = async (
    _network: string,
): Promise<number> => {
    /* Request status. */
    const response = await fetch(
        `${getInsightUrl(_network)}/status?q=getInfo`,
    )
    const json = await response.json()

    /* Return best block height. */
    return json.info.blocks
}

/**
 * Wait For Confirmation
 *
 * Polls the Insight API until the transaction has at least one
 * confirmation, then returns the current best height (used as the
 * chain-lock height in the ChainAssetLockProof).
 */
export const waitForConfirmation = async (
    _network: string,
    _txid: string,
    _intervalMs: number = 15_000,
    _maxAttempts: number = 60,
): Promise<{ blockheight: number, bestHeight: number }> => {
    /* Poll for confirmation. */
    for (let i = 0; i < _maxAttempts; i++) {
        /* Request transaction. */
        const response = await fetch(
            `${getInsightUrl(_network)}/tx/${_txid}`,
        )
        const json = await response.json()

        /* Validate confirmation. */
        if (json.confirmations > 0) {
            const bestHeight = await getBestHeight(_network)

            /* Return confirmation info. */
            return { blockheight: json.blockheight, bestHeight }
        }

        /* Wait before the next attempt. */
        await new Promise(resolve => setTimeout(resolve, _intervalMs))
    }

    /* Timeout. */
    throw new Error('Transaction was not confirmed in time')
}
