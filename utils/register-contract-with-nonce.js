const {
    WasmSdkBuilder,
    prefetch_trusted_quorums_testnet,
    get_identity_nonce
} = require('./lib/dash-wasm/wasm_sdk')

const fs = require('fs')

async function registerContract() {
    try {
        console.log('Initializing WASM SDK...')

        // Initialize WASM module
        const wasmPath = './lib/dash-wasm/wasm_sdk_bg.wasm'
        const wasmBytes = fs.readFileSync(wasmPath)
        const { default: init } = require('./lib/dash-wasm/wasm_sdk')
        await init(wasmBytes)

        // Prefetch trusted quorums and build SDK
        console.log('Prefetching testnet quorum information...')
        await prefetch_trusted_quorums_testnet()

        console.log('Building testnet SDK...')
        const builder = WasmSdkBuilder.new_testnet_trusted()
        const sdk = builder.build()

        const identityId = '5DbLwAxGBzUzo81VewMUwn4b5P4bpv9FNFybi25XB5Bk'
        const privateKey = 'XJ1CkT9xEz4Q471Rs8efttjo7kx7MfAz46Pn9GQWQJFK1oKkW84K'
        const contractPath = '../dash-contract-cli/contracts/evonext-contract.json'

        console.log('Fetching current identity nonce...')
        const nonceResult = await get_identity_nonce(sdk, identityId)
        console.log('Current nonce result:', nonceResult)

        // Extract nonce value and add 1
        const currentNonce = BigInt(nonceResult.nonce || nonceResult || 0)
        const nextNonce = currentNonce + 1n

        // Keep only the right 48 bits as you mentioned
        const maskedNonce = nextNonce & 0xFFFFFFFFFFFFn; // 48 bits mask

        console.log('Current nonce:', currentNonce.toString())
        console.log('Next nonce:', nextNonce.toString())
        console.log('Masked nonce (48 bits):', maskedNonce.toString())

        // Read contract
        const contractJSON = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
        contractJSON.ownerId = identityId

        // Generate entropy
        const entropy = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        console.log('Creating contract...')

        // Create contract with proper nonce
        const result = await sdk.contractCreate(
            JSON.stringify(contractJSON),
            identityId,
            entropy,
            privateKey,
            maskedNonce // Pass the masked nonce
        )

        console.log('Contract created successfully!')
        console.log('Contract ID:', result.contractId || result.id || result)

        // Save contract ID
        const contractId = result.contractId || result.id;
        if (contractId) {
            fs.writeFileSync('../dash-contract-cli/contracts/evonext-contract.contract-id', contractId)
            console.log('Contract ID saved!')

            // Update .env file
            const envPath = './.env';
            let envContent = fs.readFileSync(envPath, 'utf8')
            envContent = envContent.replace(
                /NEXT_PUBLIC_CONTRACT_ID=.*/,
                `NEXT_PUBLIC_CONTRACT_ID=${contractId}`
            )
            fs.writeFileSync(envPath, envContent);
            console.log('Updated .env file with new contract ID')
        }
    } catch (error) {
        console.error('Error:', error)
        console.error('Error details:', error.message)

        if (error.stack) {
            console.error('Stack:', error.stack)
        }
    }
}

registerContract()
