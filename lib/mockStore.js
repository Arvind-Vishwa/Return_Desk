import { TRANSITIONS, LOCKED_STATUSES, REMOVABLE_STATUSES, STATUS_LABELS } from './constants.js';
import { ApiError, notFound } from './error.js';

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

let nextId = 1;
let requests = [];
let notes = [];

function initMockData() {
  if (requests.length > 0) return;
  const now = Date.now();
  const DAY = 86400000;

  for (let i = 0; i < 35; i++) {
    const id = nextId++;
    const status = STATUSES[i % 5];
    const reason = REASONS[Math.floor(i / 5) % 5];
    const [name, email, phone] = CUSTOMERS[i % CUSTOMERS.length];
    const [sku, itemName, price] = ITEMS[i % ITEMS.length];
    const quantity = (i % 3) + 1;

    let resolution = null;
    let refundAmount = null;
    if (status === 'approved' || status === 'completed') {
      resolution = RESOLUTIONS[i % 3];
      if (resolution === 'refund') refundAmount = (price * quantity).toFixed(2);
    }

    const createdAt = new Date(now - (40 - i) * DAY).toISOString();
    const updatedAt = createdAt;

    requests.push({
      id: String(id),
      reference: `RD-${String(1000 + id).padStart(6, '0')}`,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      order_number: `ORD-${10001 + i}`,
      item_sku: sku,
      item_name: itemName,
      quantity,
      reason,
      description: `Customer reports: ${reason.replace(/_/g, ' ')}.`,
      status,
      resolution,
      refund_amount: refundAmount,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null,
    });

    if (i % 3 === 0) {
      for (let n = 0; n < 2; n++) {
        notes.push({
          id: String(notes.length + 1),
          request_id: String(id),
          body: NOTES[(i + n) % NOTES.length],
          author: 'Support agent',
          created_at: new Date(now - (39 - i - n * 0.5) * DAY).toISOString(),
        });
      }
    }
  }

  // Demo rule 3
  const id = nextId++;
  requests.push({
    id: String(id),
    reference: `RD-${String(1000 + id).padStart(6, '0')}`,
    customer_name: 'Rohan Mehta',
    customer_email: 'rohan@example.com',
    customer_phone: null,
    order_number: 'ORD-10004',
    item_sku: 'SKU-PILL-02',
    item_name: 'Cervical pillow',
    quantity: 1,
    reason: 'damaged',
    description: 'Raised again after the first request was rejected.',
    status: 'open',
    resolution: null,
    refund_amount: null,
    created_at: new Date(now - DAY).toISOString(),
    updated_at: new Date(now - DAY).toISOString(),
    deleted_at: null,
  });
}

initMockData();

function withActions(r) {
  return {
    ...r,
    allowed_transitions: TRANSITIONS[r.status] || [],
    can_edit: !LOCKED_STATUSES.includes(r.status),
    can_remove: REMOVABLE_STATUSES.includes(r.status),
  };
}

export const mockStore = {
  async listRequests({ q, status, reason, sort = 'created_at', order = 'desc', page = 1, pageSize = 10 }) {
    initMockData();
    let filtered = requests.filter((r) => r.deleted_at === null);

    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter((r) =>
        r.customer_name?.toLowerCase().includes(query) ||
        r.customer_email?.toLowerCase().includes(query) ||
        r.order_number?.toLowerCase().includes(query) ||
        r.reference?.toLowerCase().includes(query)
      );
    }

    if (status) filtered = filtered.filter((r) => r.status === status);
    if (reason) filtered = filtered.filter((r) => r.reason === reason);

    filtered.sort((a, b) => {
      let valA = a[sort] ?? '';
      let valB = b[sort] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return Number(b.id) - Number(a.id);
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize).map(withActions);

    return {
      data: paginated,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  async getRequest(id) {
    initMockData();
    const r = requests.find((req) => String(req.id) === String(id) && req.deleted_at === null);
    if (!r) throw notFound();
    const reqNotes = notes
      .filter((n) => String(n.request_id) === String(id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { ...withActions(r), notes: reqNotes };
  },

  async createRequest(d) {
    initMockData();
    // Rule 3: duplicate check
    const existingLive = requests.find(
      (r) =>
        r.deleted_at === null &&
        !['rejected', 'completed'].includes(r.status) &&
        r.order_number.toLowerCase() === d.order_number.toLowerCase() &&
        r.item_sku.toLowerCase() === d.item_sku.toLowerCase()
    );
    if (existingLive) {
      throw new ApiError(409, 'DUPLICATE_LIVE_REQUEST', 'This order and item already have a live return request');
    }

    const id = nextId++;
    const now = new Date().toISOString();
    const newReq = {
      id: String(id),
      reference: `RD-${String(1000 + id).padStart(6, '0')}`,
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: d.customer_phone ?? null,
      order_number: d.order_number,
      item_sku: d.item_sku,
      item_name: d.item_name,
      quantity: d.quantity,
      reason: d.reason,
      description: d.description ?? null,
      status: 'open',
      resolution: null,
      refund_amount: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    requests.unshift(newReq);
    return withActions(newReq);
  },

  async updateRequest(id, data) {
    initMockData();
    const r = requests.find((req) => String(req.id) === String(id) && req.deleted_at === null);
    if (!r) throw notFound();

    if (LOCKED_STATUSES.includes(r.status)) {
      throw new ApiError(409, 'REQUEST_LOCKED', `This request is ${STATUS_LABELS[r.status]}, so its details can no longer be edited`);
    }

    Object.assign(r, data, { updated_at: new Date().toISOString() });
    return withActions(r);
  },

  async changeStatus(id, { status, resolution, refundAmount }) {
    initMockData();
    const r = requests.find((req) => String(req.id) === String(id) && req.deleted_at === null);
    if (!r) throw notFound();

    const allowed = TRANSITIONS[r.status] || [];
    if (!allowed.includes(status)) {
      const from = STATUS_LABELS[r.status];
      const hint = allowed.length ? `Allowed next: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}` : `${from} is final`;
      throw new ApiError(409, 'INVALID_TRANSITION', `Cannot move from ${from} to ${STATUS_LABELS[status]}. ${hint}.`, {
        from: r.status,
        to: status,
        allowed,
      });
    }

    const oldStatus = r.status;
    r.status = status;
    r.updated_at = new Date().toISOString();
    if (status === 'approved') {
      r.resolution = resolution;
      r.refund_amount = resolution === 'refund' ? String(refundAmount) : null;
    }

    notes.push({
      id: String(notes.length + 1),
      request_id: String(id),
      body: `Status changed from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[status]}`,
      author: 'System',
      created_at: new Date().toISOString(),
    });

    return withActions(r);
  },

  async addNote(id, { body }) {
    initMockData();
    const r = requests.find((req) => String(req.id) === String(id) && req.deleted_at === null);
    if (!r) throw notFound();

    const note = {
      id: String(notes.length + 1),
      request_id: String(id),
      body,
      author: 'Support agent',
      created_at: new Date().toISOString(),
    };
    notes.push(note);
    return note;
  },

  async removeRequest(id) {
    initMockData();
    const r = requests.find((req) => String(req.id) === String(id) && req.deleted_at === null);
    if (!r) throw notFound();

    if (!REMOVABLE_STATUSES.includes(r.status)) {
      throw new ApiError(409, 'NOT_REMOVABLE', `Only Open or Rejected requests can be removed; this one is ${STATUS_LABELS[r.status]}`);
    }

    r.deleted_at = new Date().toISOString();
    r.updated_at = new Date().toISOString();
  },
};
