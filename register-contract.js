#!/usr/bin/env node

const fs = require('fs');
const Dash = require('dash');

// Configuration
const IDENTITY_ID = '5DbLwAxGBzUzo81VewMUwn4b5P4bpv9FNFybi25XB5Bk';
const PRIVATE_KEY = 'XK6CFyvYUMvY9FVQLeYBZBFDbC4QuBLiqWMAFxBVZcMHJ5eARJtf';
const CONTRACT_PATH = './contracts/yappr-minimal.json';

async function registerContract() {
    try {
        console.log('🚀 Yappr Contract Registration');
        console.log('==============================');
        console.log('Identity:', IDENTITY_ID);
        console.log('Contract:', CONTRACT_PATH);
        console.log();

        // Read and prepare contract
        const contractJSON = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
        contractJSON.ownerId = IDENTITY_ID;

        // Initialize client
        const client = new Dash.Client({
            network: 'testnet',
            wallet: {
                mnemonic: null,
                privateKey: PRIVATE_KEY
            }
        });

        // Get identity
        console.log('📡 Fetching identity...');
        const identity = await client.platform.identities.get(IDENTITY_ID);
        console.log('✅ Identity balance:', identity.balance);

        // Create and publish contract
        console.log('\n📝 Creating contract...');
        const contract = await client.platform.contracts.create(contractJSON, identity);
        
        console.log('📤 Publishing contract to testnet...');
        const result = await client.platform.contracts.publish(contract, identity);
        
        const contractId = result.toJSON().$id;
        console.log('\n✨ Contract registered successfully!');
        console.log('   Contract ID:', contractId);
        
        // Save contract ID
        fs.writeFileSync('./.env.contract', `NEXT_PUBLIC_CONTRACT_ID=${contractId}\n`);
        console.log('\n💾 Contract ID saved to .env.contract');
        
        // Update .env if it exists
        if (fs.existsSync('./.env')) {
            let envContent = fs.readFileSync('./.env', 'utf8');
            if (envContent.includes('NEXT_PUBLIC_CONTRACT_ID=')) {
                envContent = envContent.replace(/NEXT_PUBLIC_CONTRACT_ID=.*/, `NEXT_PUBLIC_CONTRACT_ID=${contractId}`);
            } else {
                envContent += `\nNEXT_PUBLIC_CONTRACT_ID=${contractId}\n`;
            }
            fs.writeFileSync('./.env', envContent);
            console.log('   Updated .env file');
        }
        
        console.log('\n💡 Next steps:');
        console.log('   1. Wait ~30 seconds for contract propagation');
        console.log('   2. Update your app to use the new contract ID');
        console.log('   3. Test the integration!');
        
        await client.disconnect();
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.metadata) {
            console.error('Metadata:', error.metadata);
        }
        process.exit(1);
    }
}

registerContract();