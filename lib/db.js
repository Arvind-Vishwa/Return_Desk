import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const isCloud = connectionString && (connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('render.com'));

const pool = globalThis.pgPool ?? new Pool({
  connectionString,
  max: 5,
  ssl: isCloud ? { rejectUnauthorized: false } : undefined,
});
if (process.env.NODE_ENV !== 'production') globalThis.pgPool = pool;

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}