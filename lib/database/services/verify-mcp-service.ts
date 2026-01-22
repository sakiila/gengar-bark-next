/**
 * Verification script for MCPConfigurationService
 * This script verifies that the service is properly initialized
 */

import { MCPConfigurationService } from './mcp-configuration.service';

async function verifyService() {
  console.log('🔍 Verifying MCPConfigurationService...\n');

  try {
    // Test 1: Get instance
    console.log('Test 1: Getting service instance...');
    const instance1 = await MCPConfigurationService.getInstance();
    console.log('✅ Service instance created successfully');

    // Test 2: Verify singleton pattern
    console.log('\nTest 2: Verifying singleton pattern...');
    const instance2 = await MCPConfigurationService.getInstance();
    if (instance1 === instance2) {
      console.log('✅ Singleton pattern working correctly (same instance returned)');
    } else {
      console.log('❌ Singleton pattern failed (different instances returned)');
    }

    // Test 3: Check repository
    console.log('\nTest 3: Checking repository initialization...');
    const repository = instance1.getRepository();
    if (repository) {
      console.log('✅ Repository initialized successfully');
      console.log(`   Target: ${repository.target}`);
    } else {
      console.log('❌ Repository not initialized');
    }

    // Test 4: Check encryption key
    console.log('\nTest 4: Checking encryption key...');
    const encryptionKey = instance1.getEncryptionKey();
    if (encryptionKey) {
      console.log('✅ Encryption key loaded from environment');
      console.log(`   Key length: ${encryptionKey.length} characters`);
    } else {
      console.log('⚠️  Encryption key not set (MCP_ENCRYPTION_KEY environment variable)');
    }

    console.log('\n✨ All verification tests completed!');
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyService()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { verifyService };
