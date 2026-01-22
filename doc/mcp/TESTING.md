# Migration Testing Guide

This guide explains how to test the `user_mcp_configurations` migration.

## Prerequisites

1. PostgreSQL database running and accessible
2. Environment variables configured in `.env`:
   - `POSTGRES_HOST`
   - `POSTGRES_PORT` (default: 5432)
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DATABASE`

## Automated Testing

Run the automated test script:

```bash
node doc/mcp/test_migration.js
```

This script will:
1. ✓ Connect to the database
2. ✓ Run migration up (create table, indexes, triggers)
3. ✓ Verify table exists
4. ✓ Verify all indexes exist
5. ✓ Insert test data
6. ✓ Test unique constraint (user_id, server_name)
7. ✓ Test transport_type check constraint
8. ✓ Test verification_status check constraint
9. ✓ Test updated_at trigger
10. ✓ Verify data retrieval
11. ✓ Run migration down (drop table)
12. ✓ Verify table is dropped

Expected output:
```
✓ Connected to database

--- Test 1: Running migration up ---
✓ Migration up completed

--- Test 2: Verifying table exists ---
✓ Table user_mcp_configurations exists

--- Test 3: Verifying indexes ---
✓ Index idx_user_mcp_configs_user_id exists
✓ Index idx_user_mcp_configs_enabled exists
✓ Index idx_user_mcp_configs_server_name exists

--- Test 4: Inserting test data ---
✓ Test data inserted

--- Test 5: Testing unique constraint ---
✓ Unique constraint working (duplicate rejected)

--- Test 6: Testing transport_type check constraint ---
✓ Transport type check constraint working

--- Test 7: Testing verification_status check constraint ---
✓ Verification status check constraint working

--- Test 8: Testing updated_at trigger ---
✓ updated_at trigger working

--- Test 9: Verifying data retrieval ---
✓ Data retrieval working
  Sample row: { id: '...', user_id: 'U12345', server_name: 'test-server', enabled: false }

--- Test 10: Running migration down ---
✓ Migration down completed

--- Test 11: Verifying table is dropped ---
✓ Table successfully dropped

✅ All migration tests passed!

✓ Database connection closed

🎉 Migration test completed successfully
```

## Manual Testing

If you prefer to test manually:

### 1. Apply Migration

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DATABASE -f doc/mcp/user_mcp_configurations.sql
```

### 2. Verify Table Creation

```sql
\d user_mcp_configurations
```

Expected output should show:
- All columns with correct types
- Primary key on `id`
- Unique constraint on `(user_id, server_name)`
- Check constraints on `transport_type` and `verification_status`

### 3. Verify Indexes

```sql
\di user_mcp_configurations*
```

Expected indexes:
- `user_mcp_configurations_pkey` (PRIMARY KEY)
- `unique_user_server` (UNIQUE)
- `idx_user_mcp_configs_user_id`
- `idx_user_mcp_configs_enabled`
- `idx_user_mcp_configs_server_name`

### 4. Test Insert

```sql
INSERT INTO user_mcp_configurations 
  (user_id, server_name, transport_type, url, verification_status)
VALUES 
  ('U12345', 'test-server', 'sse', 'https://example.com/mcp', 'verified');
```

### 5. Test Unique Constraint

This should fail:
```sql
INSERT INTO user_mcp_configurations 
  (user_id, server_name, transport_type, url, verification_status)
VALUES 
  ('U12345', 'test-server', 'sse', 'https://example.com/mcp2', 'verified');
```

Expected error: `duplicate key value violates unique constraint "unique_user_server"`

### 6. Test Check Constraints

This should fail (invalid transport_type):
```sql
INSERT INTO user_mcp_configurations 
  (user_id, server_name, transport_type, url, verification_status)
VALUES 
  ('U12345', 'test-server-2', 'invalid', 'https://example.com/mcp', 'verified');
```

Expected error: `new row for relation "user_mcp_configurations" violates check constraint`

This should fail (invalid verification_status):
```sql
INSERT INTO user_mcp_configurations 
  (user_id, server_name, transport_type, url, verification_status)
VALUES 
  ('U12345', 'test-server-3', 'sse', 'https://example.com/mcp', 'invalid');
```

Expected error: `new row for relation "user_mcp_configurations" violates check constraint`

### 7. Test Updated At Trigger

```sql
-- Check current updated_at
SELECT id, updated_at FROM user_mcp_configurations WHERE user_id = 'U12345';

-- Wait a moment, then update
SELECT pg_sleep(1);
UPDATE user_mcp_configurations SET enabled = false WHERE user_id = 'U12345';

-- Verify updated_at changed
SELECT id, updated_at FROM user_mcp_configurations WHERE user_id = 'U12345';
```

The `updated_at` timestamp should be newer after the update.

### 8. Test Rollback

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DATABASE -f doc/mcp/user_mcp_configurations_down.sql
```

Verify table is dropped:
```sql
\dt user_mcp_configurations
```

Expected: `Did not find any relation named "user_mcp_configurations"`

## Integration with TypeORM

The migration is compatible with TypeORM. The entity `UserMCPConfiguration` is already defined in:
- `lib/database/entities/UserMCPConfiguration.ts`

And registered in:
- `lib/database/data-source.ts`

### Development Mode

In development, TypeORM's `synchronize: true` will auto-sync the schema. You can:
1. Let TypeORM create the table automatically, OR
2. Run the migration manually first

### Production Mode

In production, you should:
1. Disable `synchronize` (set to `false`)
2. Run migrations manually using the SQL scripts
3. Test migrations in staging environment first

## Troubleshooting

### Connection Refused

If you get "connection refused":
- Check that PostgreSQL is running
- Verify `POSTGRES_HOST` and `POSTGRES_PORT` are correct
- Check firewall settings

### Authentication Failed

If you get "authentication failed":
- Verify `POSTGRES_USER` and `POSTGRES_PASSWORD` are correct
- Check PostgreSQL `pg_hba.conf` for authentication settings

### Table Already Exists

If you get "table already exists":
- Run the down migration first: `node doc/mcp/test_migration_down.js`
- Or drop the table manually: `DROP TABLE IF EXISTS user_mcp_configurations CASCADE;`

### Permission Denied

If you get "permission denied":
- Ensure the database user has CREATE TABLE privileges
- Grant privileges: `GRANT CREATE ON DATABASE your_database TO your_user;`

## Next Steps

After successful migration testing:

1. ✅ Migration scripts created and tested
2. ⏭️ Implement `MCPConfigurationService` (Task 2.1-2.8)
3. ⏭️ Add validation and security features (Task 3.1-3.7)
4. ⏭️ Implement encryption (Task 4.1-4.3)
5. ⏭️ Continue with remaining tasks in the implementation plan
