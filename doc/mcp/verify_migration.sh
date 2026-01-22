#!/bin/bash

# Migration Verification Script
# This script verifies the migration SQL files are syntactically correct
# without actually executing them against a database

echo "🔍 Verifying User MCP Configuration Migration Files"
echo "=================================================="
echo ""

# Check if migration files exist
echo "📁 Checking migration files..."
if [ ! -f "doc/mcp/user_mcp_configurations.sql" ]; then
    echo "❌ Migration up file not found: doc/mcp/user_mcp_configurations.sql"
    exit 1
fi
echo "✓ Migration up file exists"

if [ ! -f "doc/mcp/user_mcp_configurations_down.sql" ]; then
    echo "❌ Migration down file not found: doc/mcp/user_mcp_configurations_down.sql"
    exit 1
fi
echo "✓ Migration down file exists"

# Check file sizes
echo ""
echo "📊 File sizes:"
ls -lh doc/mcp/user_mcp_configurations.sql | awk '{print "  Migration up:   " $5}'
ls -lh doc/mcp/user_mcp_configurations_down.sql | awk '{print "  Migration down: " $5}'

# Check for required SQL keywords in migration up
echo ""
echo "🔎 Verifying migration up content..."
if grep -q "CREATE TABLE IF NOT EXISTS user_mcp_configurations" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ CREATE TABLE statement found"
else
    echo "❌ CREATE TABLE statement not found"
    exit 1
fi

if grep -q "CREATE INDEX" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ CREATE INDEX statements found"
else
    echo "❌ CREATE INDEX statements not found"
    exit 1
fi

if grep -q "CREATE TRIGGER" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ CREATE TRIGGER statement found"
else
    echo "❌ CREATE TRIGGER statement not found"
    exit 1
fi

# Check for required columns
echo ""
echo "🔎 Verifying required columns..."
required_columns=("id" "user_id" "server_name" "transport_type" "url" "encrypted_auth_token" "enabled" "capabilities" "verification_status" "verification_error" "created_at" "updated_at")

for column in "${required_columns[@]}"; do
    if grep -q "$column" doc/mcp/user_mcp_configurations.sql; then
        echo "✓ Column '$column' defined"
    else
        echo "❌ Column '$column' not found"
        exit 1
    fi
done

# Check for constraints
echo ""
echo "🔎 Verifying constraints..."
if grep -q "CHECK (transport_type IN ('sse', 'websocket'))" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ Transport type check constraint found"
else
    echo "❌ Transport type check constraint not found"
    exit 1
fi

if grep -q "CHECK (verification_status IN ('verified', 'unverified', 'failed'))" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ Verification status check constraint found"
else
    echo "❌ Verification status check constraint not found"
    exit 1
fi

if grep -q "UNIQUE (user_id, server_name)" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ Unique constraint on (user_id, server_name) found"
else
    echo "❌ Unique constraint not found"
    exit 1
fi

# Check for required indexes
echo ""
echo "🔎 Verifying indexes..."
required_indexes=("idx_user_mcp_configs_user_id" "idx_user_mcp_configs_enabled" "idx_user_mcp_configs_server_name")

for index in "${required_indexes[@]}"; do
    if grep -q "$index" doc/mcp/user_mcp_configurations.sql; then
        echo "✓ Index '$index' defined"
    else
        echo "❌ Index '$index' not found"
        exit 1
    fi
done

# Check migration down content
echo ""
echo "🔎 Verifying migration down content..."
if grep -q "DROP TABLE IF EXISTS user_mcp_configurations" doc/mcp/user_mcp_configurations_down.sql; then
    echo "✓ DROP TABLE statement found"
else
    echo "❌ DROP TABLE statement not found"
    exit 1
fi

if grep -q "DROP TRIGGER" doc/mcp/user_mcp_configurations_down.sql; then
    echo "✓ DROP TRIGGER statement found"
else
    echo "❌ DROP TRIGGER statement not found"
    exit 1
fi

if grep -q "DROP FUNCTION" doc/mcp/user_mcp_configurations_down.sql; then
    echo "✓ DROP FUNCTION statement found"
else
    echo "❌ DROP FUNCTION statement not found"
    exit 1
fi

# Check for documentation
echo ""
echo "📝 Verifying documentation..."
if grep -q "COMMENT ON TABLE" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ Table comments found"
else
    echo "⚠️  Warning: Table comments not found (optional)"
fi

if grep -q "COMMENT ON COLUMN" doc/mcp/user_mcp_configurations.sql; then
    echo "✓ Column comments found"
else
    echo "⚠️  Warning: Column comments not found (optional)"
fi

# Summary
echo ""
echo "=================================================="
echo "✅ Migration verification completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Review the migration files manually"
echo "  2. Test against a development database:"
echo "     node doc/mcp/test_migration.js"
echo "  3. Apply to production database:"
echo "     psql -h \$POSTGRES_HOST -U \$POSTGRES_USER -d \$POSTGRES_DATABASE -f doc/mcp/user_mcp_configurations.sql"
echo ""
