// Set up test environment variables
process.env.MCP_ENCRYPTION_KEY = 'test-encryption-key-for-jest-testing-only-32-chars-minimum';
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
process.env.POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || 'gengar_test';

// Increase timeout for database operations
jest.setTimeout(30000);
