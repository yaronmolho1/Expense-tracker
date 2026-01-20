import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// For tests, use singleton connection to enable transaction isolation
// In production, create new connection
let client: ReturnType<typeof postgres>;

if (process.env.NODE_ENV === 'test') {
  // Use singleton to ensure transaction hooks work
  if (!(global as any).__testDbClient) {
    (global as any).__testDbClient = postgres(connectionString, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
    });
  }
  client = (global as any).__testDbClient;
} else {
  client = postgres(connectionString);
}

// Create drizzle instance with schema
export const db = drizzle(client, { schema });