import { REASONS, RESOLUTIONS, STATUSES } from './constants.js';
import { ApiError, validationError } from './error.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;
const EDITABLE_FIELDS = ['customer_name', 'customer_email', 'customer_phone', 'order_number',
  'item_sku', 'item_name', 'quantity', 'reason', 'description'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateRequestInput(body, { partial = false } = {}) {
  if (!isObject(body)) throw validationError({ body: 'Expected a JSON object' });
  const errors = {};
  const data = {};

  for (const key of Object.keys(body)) {
    if (!EDITABLE_FIELDS.includes(key)) {
      errors[key] = key === 'status'
        ? 'Use POST /api/requests/:id/status to change status'
        : 'Unknown field';
    }
  }

  const text = (field, required, max) => {
    const value = body[field];
    if (value === undefined) {
      if (required && !partial) errors[field] = 'Required';
      return;
    }
    if (value !== null && typeof value !== 'string') { errors[field] = 'Must be text'; return; }
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      if (required) errors[field] = 'Required';
      else data[field] = null;
      return;
    }
    if (trimmed.length > max) { errors[field] = `Must be ${max} characters or fewer`; return; }
    data[field] = trimmed;
  };

  text('customer_name', true, 200);
  text('customer_email', true, 200);
  text('customer_phone', false, 30);
  text('order_number', true, 50);
  text('item_sku', true, 50);
  text('item_name', true, 200);
  text('description', false, 2000);

  if (data.customer_email && !EMAIL_RE.test(data.customer_email)) {
    errors.customer_email = 'Must be a valid email address';
  }

  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 1000) errors.quantity = 'Must be a whole number from 1 to 1000';
    else data.quantity = q;
  } else if (!partial) errors.quantity = 'Required';

  if (body.reason !== undefined) {
    if (!REASONS.includes(body.reason)) errors.reason = `Must be one of: ${REASONS.join(', ')}`;
    else data.reason = body.reason;
  } else if (!partial) errors.reason = 'Required';

  if (Object.keys(errors).length) throw validationError(errors);
  if (partial && Object.keys(data).length === 0) throw validationError({ body: 'Nothing to update' });
  return data;
}

export function validateStatusChange(body) {
  if (!isObject(body)) throw validationError({ body: 'Expected a JSON object' });
  const { status, resolution, refund_amount: amount } = body;
  const errors = {};

  if (!STATUSES.includes(status)) errors.status = `Must be one of: ${STATUSES.join(', ')}`;

  const hasResolution = resolution !== undefined && resolution !== null;
  const hasAmount = amount !== undefined && amount !== null && amount !== '';

  if (status === 'approved') {
    if (!RESOLUTIONS.includes(resolution)) {
      errors.resolution = 'Approval needs a resolution: refund, replacement or store_credit';
    } else if (resolution === 'refund') {
      if (!hasAmount || !MONEY_RE.test(String(amount)) || Number(amount) <= 0) {
        errors.refund_amount = 'A refund needs an amount greater than 0 (max 2 decimals)';
      }
    } else if (hasAmount) {
      errors.refund_amount = 'A refund amount is only allowed when the resolution is refund';
    }
  } else if (hasResolution || hasAmount) {
    errors.resolution = 'Resolution and refund amount can only be set when approving';
  }

  if (Object.keys(errors).length) throw validationError(errors);
  return {
    status,
    resolution: status === 'approved' ? resolution : null,
    refundAmount: status === 'approved' && resolution === 'refund' ? String(amount) : null,
  };
}

export function validateNote(body) {
  if (!isObject(body)) throw validationError({ body: 'Expected a JSON object' });
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) throw validationError({ body: 'Note cannot be empty' });
  if (text.length > 5000) throw validationError({ body: 'Note must be 5000 characters or fewer' });
  return { body: text };
}

export const SORT_COLUMNS = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  reference: 'reference',
  customer_name: 'customer_name',
  status: 'status',
};

export function validateListQuery(searchParams) {
  const get = (k) => searchParams.get(k)?.trim() || '';
  const errors = {};
  const q = get('q');
  const status = get('status');
  const reason = get('reason');
  const sort = get('sort') || 'created_at';
  const order = get('order') || 'desc';
  const page = Number(get('page') || 1);
  const pageSize = Number(get('pageSize') || 10);

  if (q.length > 100) errors.q = 'Search is too long';
  if (status && !STATUSES.includes(status)) errors.status = 'Unknown status';
  if (reason && !REASONS.includes(reason)) errors.reason = 'Unknown reason';
  if (!SORT_COLUMNS[sort]) errors.sort = `Must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}`;
  if (!['asc', 'desc'].includes(order)) errors.order = 'Must be asc or desc';
  if (!Number.isInteger(page) || page < 1) errors.page = 'Must be a whole number from 1';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) errors.pageSize = 'Must be 1 to 100';

  if (Object.keys(errors).length) throw new ApiError(400, 'INVALID_QUERY', 'Invalid list parameters', errors);
  return { q, status, reason, sort, order, page, pageSize };
}