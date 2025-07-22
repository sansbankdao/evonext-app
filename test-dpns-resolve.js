// Test DPNS resolution for the identity
import { dpnsService } from './lib/services/dpns-service.js';

async function testResolve() {
  const identityId = '5DbLwAxGBzUzo81VewMUwn4b5P4bpv9FNFybi25XB5Bk';
  
  console.log(`Testing DPNS resolution for identity: ${identityId}`);
  
  try {
    // Try to resolve username
    const username = await dpnsService.resolveUsername(identityId);
    console.log('Username found:', username);
    
    // Also try the native resolve
    if (username) {
      const resolvedId = await dpnsService.resolveNameNative(username);
      console.log('Native resolve returned:', resolvedId);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testResolve();