# User MCP Configurations Migration

This directory contains the database migration scripts for the User MCP Configuration feature.

## Files

- **user_mcp_configurations.sql** - Migration up script (creates table, indexes, triggers)
- **user_mcp_configurations_down.sql** - Migration down script (rollback)
- **test_migration.ts** - Automated test script to verify migration

## Migration Up

To apply the migration and create the `user_mcp_configurations` table:

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DATABASE -f doc/mcp/user_mcp_configurations.sql
```

Or using the `pg` client in Node.js:

```typescript
import { Client } from 'pg';
import * as fs from 'fs';

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
});

await client.connect();
const sql = fs.readFileSync('doc/mcp/user_mcp_configurations.sql', 'utf8');
await client.query(sql);
await client.end();
```

## Migration Down

To rollback the migration and remove the table:

```bash
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DATABASE -f doc/mcp/user_mcp_configurations_down.sql
```

## Verifying the Migration

Before testing against a database, verify the migration files are syntactically correct:

```bash
bash doc/mcp/verify_migration.sh
```

This will check:
- ✓ Migration files exist
- ✓ Required SQL statements present
- ✓ All columns defined
- ✓ Constraints configured
- ✓ Indexes created
- ✓ Documentation included

## Testing the Migration

Run the automated test script to verify the migration works correctly against a real database:

```bash
node doc/mcp/test_migration.js
```

The test script will:
1. ✓ Run migration up
2. ✓ Verify table creation
3. ✓ Verify indexes creation
4. ✓ Test data insertion
5. ✓ Verify unique constraint (user_id, server_name)
6. ✓ Verify transport_type check constraint
7. ✓ Verify verification_status check constraint
8. ✓ Verify updated_at trigger
9. ✓ Test data retrieval
10. ✓ Run migration down
11. ✓ Verify table deletion

## Table Schema

```sql
CREATE TABLE user_mcp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  server_name VARCHAR(255) NOT NULL,
  transport_type VARCHAR(20) NOT NULL CHECK (transport_type IN ('sse', 'websocket')),
  url TEXT NOT NULL,
  encrypted_auth_token TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  capabilities JSONB,
  verification_status VARCHAR(20) NOT NULL CHECK (verification_status IN ('verified', 'unverified', 'failed')),
  verification_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_server UNIQUE (user_id, server_name)
);
```

## Indexes

1. **idx_user_mcp_configs_user_id** - Lookup configurations by user
2. **idx_user_mcp_configs_enabled** - Partial index for enabled configurations (AI pipeline optimization)
3. **idx_user_mcp_configs_server_name** - Lookup by user and server name (slash commands)

## Triggers

- **trigger_update_user_mcp_configurations_updated_at** - Automatically updates `updated_at` timestamp on row updates

## TypeORM Integration

The table is managed by TypeORM with the `UserMCPConfiguration` entity. TypeORM is configured with `synchronize: true` in development, which means:

- In **development**: TypeORM will auto-sync the schema based on entity definitions
- In **production**: You should run this migration script manually

The entity is already registered in `lib/database/data-source.ts`.

## Requirements Validated

This migration satisfies the following requirements:

- **Requirement 1.1**: Store MCP server configurations associated with Slack user IDs
- **Requirement 1.2**: Persist server name, transport type, URL, and authentication token
- **Requirement 1.5**: Store connection details (transport type, URL, auth token)
- **Requirement 1.6**: Support SSE and WebSocket transport types

## Security Considerations

- **encrypted_auth_token**: Stores encrypted authentication tokens (encryption handled by application layer)
- **HTTPS enforcement**: Validated at application layer before insertion
- **SSRF protection**: URL validation performed at application layer
- **User isolation**: Enforced through application layer queries filtering by user_id

## Maintenance

### Adding a Column

If you need to add a new column:

1. Update the `UserMCPConfiguration` entity in `lib/database/entities/UserMCPConfiguration.ts`
2. Create a new migration script (e.g., `add_column_to_user_mcp_configurations.sql`)
3. Test the migration with a test script

### Modifying Constraints

If you need to modify constraints:

1. Create a migration script that drops and recreates the constraint
2. Test thoroughly to ensure existing data is compatible
3. Consider data migration if constraint changes affect existing rows
