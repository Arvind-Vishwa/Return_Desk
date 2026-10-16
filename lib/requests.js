import { query, withTransaction } from './db.js';
import { ApiError, notFound } from './error.js';
import { TRANSITIONS, LOCKED_STATUSES, REMOVABLE_STATUSES, STATUS_LABELS } from './constants.js';
import { SORT_COLUMNS } from './validations.js';
import { mockStore } from './mockStore.js';

const COLUMNS = `id, reference, customer_name, customer_email, customer_phone, order_number,
  item_sku, item_name, quantity, reason, description, status, resolution, refund_amount,
  created_at, updated_at`;

function withActions(row) {
  return {
    ...row,
    allowed_transitions: TRANSITIONS[row.status] || [],
    can_edit: !LOCKED_STATUSES.includes(row.status),
    can_remove: REMOVABLE_STATUSES.includes(row.status),
  };
}

function shouldUseMock(err) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('user:password@localhost')) {
    return true;
  }
  if (!err) return false;
  return (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.message?.includes('ECONNREFUSED') ||
    err.message?.includes('connect ECONNREFUSED') ||
    err.name === 'AggregateError'
  );
}

async function lockLiveRequest(client, id) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM return_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [id]
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

export async function listRequests(params) {
  if (shouldUseMock()) return mockStore.listRequests(params);
  try {
    const { q, status, reason, sort, order, page, pageSize } = params;
    const where = ['deleted_at IS NULL'];
    const sqlParams = [];

    if (q) {
      sqlParams.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
      const p = `$${sqlParams.length}`;
      where.push(`(customer_name ILIKE ${p} OR customer_email ILIKE ${p}
                   OR order_number ILIKE ${p} OR reference ILIKE ${p})`);
    }
    if (status) { sqlParams.push(status); where.push(`status = $${sqlParams.length}`); }
    if (reason) { sqlParams.push(reason); where.push(`reason = $${sqlParams.length}`); }

    const whereSql = where.join(' AND ');
    const orderSql = `${SORT_COLUMNS[sort]} ${order === 'asc' ? 'ASC' : 'DESC'}, id DESC`;

    const [countResult, dataResult] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM return_requests WHERE ${whereSql}`, sqlParams),
      query(
        `SELECT ${COLUMNS} FROM return_requests WHERE ${whereSql}
         ORDER BY ${orderSql} LIMIT $${sqlParams.length + 1} OFFSET $${sqlParams.length + 2}`,
        [...sqlParams, pageSize, (page - 1) * pageSize]
      ),
    ]);

    const total = countResult.rows[0].total;
    return {
      data: dataResult.rows.map(withActions),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.listRequests(params);
    throw err;
  }
}

export async function getRequest(id) {
  if (shouldUseMock()) return mockStore.getRequest(id);
  try {
    const { rows } = await query(
      `SELECT ${COLUMNS} FROM return_requests WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    if (!rows[0]) throw notFound();
    const notes = await query(
      `SELECT id, body, author, created_at FROM request_notes
       WHERE request_id = $1 ORDER BY created_at, id`, [id]
    );
    return { ...withActions(rows[0]), notes: notes.rows };
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.getRequest(id);
    throw err;
  }
}

export async function createRequest(d) {
  if (shouldUseMock()) return mockStore.createRequest(d);
  try {
    const { rows } = await query(
      `INSERT INTO return_requests
         (customer_name, customer_email, customer_phone, order_number, item_sku, item_name,
          quantity, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [d.customer_name, d.customer_email, d.customer_phone ?? null, d.order_number,
       d.item_sku, d.item_name, d.quantity, d.reason, d.description ?? null]
    );
    return withActions(rows[0]);
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.createRequest(d);
    throw err;
  }
}

export async function updateRequest(id, data) {
  if (shouldUseMock()) return mockStore.updateRequest(id, data);
  try {
    return await withTransaction(async (client) => {
      const current = await lockLiveRequest(client, id);
      if (LOCKED_STATUSES.includes(current.status)) {
        throw new ApiError(409, 'REQUEST_LOCKED',
          `This request is ${STATUS_LABELS[current.status]}, so its details can no longer be edited`);
      }
      const keys = Object.keys(data);
      const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const { rows } = await client.query(
        `UPDATE return_requests SET ${setSql}, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, ...keys.map((k) => data[k])]
      );
      return withActions(rows[0]);
    });
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.updateRequest(id, data);
    throw err;
  }
}

export async function changeStatus(id, { status, resolution, refundAmount }) {
  if (shouldUseMock()) return mockStore.changeStatus(id, { status, resolution, refundAmount });
  try {
    return await withTransaction(async (client) => {
      const current = await lockLiveRequest(client, id);
      const allowed = TRANSITIONS[current.status];

      if (!allowed.includes(status)) {
        const from = STATUS_LABELS[current.status];
        const hint = allowed.length
          ? `Allowed next: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}`
          : `${from} is final`;
        throw new ApiError(409, 'INVALID_TRANSITION',
          `Cannot move from ${from} to ${STATUS_LABELS[status]}. ${hint}.`,
          { from: current.status, to: status, allowed });
      }

      const { rows } = status === 'approved'
        ? await client.query(
            `UPDATE return_requests SET status = $2, resolution = $3, refund_amount = $4,
               updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
            [id, status, resolution, refundAmount])
        : await client.query(
            `UPDATE return_requests SET status = $2, updated_at = now()
             WHERE id = $1 RETURNING ${COLUMNS}`,
            [id, status]);

      await client.query(
        `INSERT INTO request_notes (request_id, body, author) VALUES ($1, $2, 'System')`,
        [id, `Status changed from ${STATUS_LABELS[current.status]} to ${STATUS_LABELS[status]}`]
      );
      return withActions(rows[0]);
    });
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.changeStatus(id, { status, resolution, refundAmount });
    throw err;
  }
}

export async function addNote(id, { body }) {
  if (shouldUseMock()) return mockStore.addNote(id, { body });
  try {
    const exists = await query(
      'SELECT 1 FROM return_requests WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!exists.rows[0]) throw notFound();
    const { rows } = await query(
      `INSERT INTO request_notes (request_id, body) VALUES ($1, $2)
       RETURNING id, body, author, created_at`, [id, body]
    );
    return rows[0];
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.addNote(id, { body });
    throw err;
  }
}

export async function removeRequest(id) {
  if (shouldUseMock()) return mockStore.removeRequest(id);
  try {
    return await withTransaction(async (client) => {
      const current = await lockLiveRequest(client, id);
      if (!REMOVABLE_STATUSES.includes(current.status)) {
        throw new ApiError(409, 'NOT_REMOVABLE',
          `Only Open or Rejected requests can be removed; this one is ${STATUS_LABELS[current.status]}`);
      }
      await client.query(
        'UPDATE return_requests SET deleted_at = now(), updated_at = now() WHERE id = $1', [id]
      );
    });
  } catch (err) {
    if (shouldUseMock(err)) return mockStore.removeRequest(id);
    throw err;
  }
}