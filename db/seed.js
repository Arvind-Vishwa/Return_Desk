require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const STATUSES = ['open', 'in_review', 'approved', 'rejected', 'completed'];
const REASONS = ['damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind'];
const RESOLUTIONS = ['refund', 'replacement', 'store_credit'];

const CUSTOMERS = [
  ['Aarav Sharma', 'aarav@example.com', '9876500001'],
  ['Priya Nair', 'priya@example.com', '9876500002'],
  ['Rohan Mehta', 'rohan@example.com', null],
  ['Sneha Kulkarni', 'sneha@example.com', '9876500004'],
  ['Vikram Rao', 'vikram@example.com', '9876500005'],
  ['Ananya Iyer', 'ananya@example.com', null],
  ['Karan Patel', 'karan@example.com', '9876500007'],
];

const ITEMS = [
  ['SKU-CUSH-01', 'Memory foam seat cushion', 1499],
  ['SKU-PILL-02', 'Cervical pillow', 1299],
  ['SKU-BACK-03', 'Lumbar back support', 1799],
  ['SKU-SOCK-04', 'Arch support socks (pack of 3)', 599],
  ['SKU-INSO-05', 'Orthotic insoles', 899],
];

const NOTES = [
  'Customer shared photos of the item.',
  'Called the customer to confirm the order details.',
  'Checked with the warehouse about stock for a replacement.',
];

const INSERT_REQUEST = `
  INSERT INTO return_requests
    (customer_name, customer_email, customer_phone, order_number, item_sku, item_name,
     quantity, reason, description, status, resolution, refund_amount, created_at, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          now() - make_interval(days => $13), now() - make_interval(days => $13))
  RETURNING id`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE request_notes, return_requests RESTART IDENTITY CASCADE');
    await client.query('ALTER SEQUENCE request_ref_seq RESTART WITH 1001');

    for (let i = 0; i < 35; i++) {
      const status = STATUSES[i % 5];
      const reason = REASONS[Math.floor(i / 5) % 5];
      const [name, email, phone] = CUSTOMERS[i % CUSTOMERS.length];
      const [sku, itemName, price] = ITEMS[i % ITEMS.length];
      const quantity = (i % 3) + 1;

      let resolution = null;
      let refundAmount = null;
      if (status === 'approved' || status === 'completed') {
        resolution = RESOLUTIONS[i % 3];
        if (resolution === 'refund') refundAmount = price * quantity;
      }

      const { rows } = await client.query(INSERT_REQUEST, [
        name, email, phone, `ORD-${10001 + i}`, sku, itemName, quantity, reason,
        `Customer reports: ${reason.replace(/_/g, ' ')}.`, status, resolution, refundAmount,
        40 - i,
      ]);

      if (i % 3 === 0) {
        for (let n = 0; n < 2; n++) {
          await client.query(
            `INSERT INTO request_notes (request_id, body, created_at)
             VALUES ($1, $2, now() - ($3 * interval '1 day'))`,
            [rows[0].id, NOTES[(i + n) % NOTES.length], 39 - i - n * 0.5]
          );
        }
      }
    }

    // Rule 3 demo: ORD-10004's pillow request was rejected, so a new open one is allowed
    await client.query(INSERT_REQUEST, [
      'Rohan Mehta', 'rohan@example.com', null, 'ORD-10004', 'SKU-PILL-02', 'Cervical pillow',
      1, 'damaged', 'Raised again after the first request was rejected.', 'open', null, null, 1,
    ]);

    await client.query('COMMIT');
    console.log('Seeded 36 requests');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });