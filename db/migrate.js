require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('Schema created');
}

main().catch((err) => { console.error(err); process.exit(1); });