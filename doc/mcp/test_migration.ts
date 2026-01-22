/**
 * Test script for user_mcp_configurations migration
 * 
 * This script tests the migration by:
 * 1. Running the migration (up)
 * 2. Inserting test data
 * 3. Verifying constraints and indexes
 * 4. Rolling back the migration (down)
 * 
 * Usage:
 *   npx ts-node doc/mcp/test_migration.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function testMigration() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Read migration files
    const upSql = fs.readFileSync(
      path.join(__dirname, 'user_mcp_configurations.sql'),
      'utf8'
    );
    const downSql = fs.readFileSync(
      path.join(__dirname, 'user_mcp_configurations_down.sql'),
      'utf8'
    );

    // Test 1: Run migration up
    console.log('\n--- Test 1: Running migration up ---');
    await client.query(upSql);
    console.log('✓ Migration up completed');

    // Test 2: Verify table exists
    console.log('\n--- Test 2: Verifying table exists ---');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_mcp_configurations'
      );
    `);
    if (tableCheck.rows[0].exists) {
      console.log('✓ Table user_mcp_configurations exists');
    } else {
      throw new Error('Table was not created');
    }

    // Test 3: Verify indexes exist
    console.log('\n--- Test 3: Verifying indexes ---');
    const indexCheck = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'user_mcp_configurations';
    `);
    const expectedIndexes = [
      'idx_user_mcp_configs_user_id',
      'idx_user_mcp_configs_enabled',
      'idx_user_mcp_configs_server_name',
    ];
    const actualIndexes = indexCheck.rows.map(row => row.indexname);
    
    for (const expectedIndex of expectedIndexes) {
      if (actualIndexes.includes(expectedIndex)) {
        console.log(`✓ Index ${expectedIndex} exists`);
      } else {
        throw new Error(`Index ${expectedIndex} not found`);
      }
    }

    // Test 4: Insert test data
    console.log('\n--- Test 4: Inserting test data ---');
    await client.query(`
      INSERT INTO user_mcp_configurations 
        (user_id, server_name, transport_type, url, verification_status)
      VALUES 
        ('U12345', 'test-server', 'sse', 'https://example.com/mcp', 'verified');
    `);
    console.log('✓ Test data inserted');

    // Test 5: Verify unique constraint
    console.log('\n--- Test 5: Testing unique constraint ---');
    try {
      await client.query(`
        INSERT INTO user_mcp_configurations 
          (user_id, server_name, transport_type, url, verification_status)
        VALUES 
          ('U12345', 'test-server', 'sse', 'https://example.com/mcp2', 'verified');
      `);
      throw new Error('Unique constraint did not work');
    } catch (error: any) {
      if (error.code === '23505') {
        console.log('✓ Unique constraint working (duplicate rejected)');
      } else {
        throw error;
      }
    }

    // Test 6: Verify transport_type check constraint
    console.log('\n--- Test 6: Testing transport_type check constraint ---');
    try {
      await client.query(`
        INSERT INTO user_mcp_configurations 
          (user_id, server_name, transport_type, url, verification_status)
        VALUES 
          ('U12345', 'test-server-2', 'invalid', 'https://example.com/mcp', 'verified');
      `);
      throw new Error('Transport type check constraint did not work');
    } catch (error: any) {
      if (error.code === '23514') {
        console.log('✓ Transport type check constraint working');
      } else {
        throw error;
      }
    }

    // Test 7: Verify verification_status check constraint
    console.log('\n--- Test 7: Testing verification_status check constraint ---');
    try {
      await client.query(`
        INSERT INTO user_mcp_configurations 
          (user_id, server_name, transport_type, url, verification_status)
        VALUES 
          ('U12345', 'test-server-3', 'sse', 'https://example.com/mcp', 'invalid_status');
      `);
      throw new Error('Verification status check constraint did not work');
    } catch (error: any) {
      if (error.code === '23514') {
        console.log('✓ Verification status check constraint working');
      } else {
        throw error;
      }
    }

    // Test 8: Verify updated_at trigger
    console.log('\n--- Test 8: Testing updated_at trigger ---');
    const beforeUpdate = await client.query(`
      SELECT updated_at FROM user_mcp_configurations 
      WHERE user_id = 'U12345' AND server_name = 'test-server';
    `);
    const originalUpdatedAt = beforeUpdate.rows[0].updated_at;
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await client.query(`
      UPDATE user_mcp_configurations 
      SET enabled = false 
      WHERE user_id = 'U12345' AND server_name = 'test-server';
    `);
    
    const afterUpdate = await client.query(`
      SELECT updated_at FROM user_mcp_configurations 
      WHERE user_id = 'U12345' AND server_name = 'test-server';
    `);
    const newUpdatedAt = afterUpdate.rows[0].updated_at;
    
    if (new Date(newUpdatedAt) > new Date(originalUpdatedAt)) {
      console.log('✓ updated_at trigger working');
    } else {
      throw new Error('updated_at trigger did not update timestamp');
    }

    // Test 9: Verify data retrieval
    console.log('\n--- Test 9: Verifying data retrieval ---');
    const selectResult = await client.query(`
      SELECT * FROM user_mcp_configurations 
      WHERE user_id = 'U12345';
    `);
    if (selectResult.rows.length === 1) {
      console.log('✓ Data retrieval working');
      console.log('  Sample row:', {
        id: selectResult.rows[0].id,
        user_id: selectResult.rows[0].user_id,
        server_name: selectResult.rows[0].server_name,
        enabled: selectResult.rows[0].enabled,
      });
    } else {
      throw new Error('Expected 1 row, got ' + selectResult.rows.length);
    }

    // Test 10: Run migration down
    console.log('\n--- Test 10: Running migration down ---');
    await client.query(downSql);
    console.log('✓ Migration down completed');

    // Test 11: Verify table is dropped
    console.log('\n--- Test 11: Verifying table is dropped ---');
    const tableCheckAfterDown = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_mcp_configurations'
      );
    `);
    if (!tableCheckAfterDown.rows[0].exists) {
      console.log('✓ Table successfully dropped');
    } else {
      throw new Error('Table still exists after migration down');
    }

    console.log('\n✅ All migration tests passed!');
  } catch (error) {
    console.error('\n❌ Migration test failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n✓ Database connection closed');
  }
}

// Run the test
if (require.main === module) {
  testMigration()
    .then(() => {
      console.log('\n🎉 Migration test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration test failed:', error);
      process.exit(1);
    });
}

export { testMigration };
