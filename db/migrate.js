try {
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config();
} catch {}
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Please set it in .env or .env.local');
  }
  const isCloud = connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('render.com');
  const client = new Client({
    connectionString,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('Schema created');
}

main().catch((err) => { console.error(err); process.exit(1); });