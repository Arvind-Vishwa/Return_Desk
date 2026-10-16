'use client';

import { useState } from 'react';

const REASONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'size_issue', label: 'Size Issue' },
  { value: 'not_as_described', label: 'Not As Described' },
  { value: 'changed_mind', label: 'Changed Mind' },
];

const EMPTY = {
  customer_name: '', customer_email: '', customer_phone: '',
  order_number: '', item_sku: '', item_name: '',
  quantity: 1, reason: 'damaged', description: '',
};

export default function RequestForm({ initial, onSubmit, onCancel, submitting }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        customer_name: initial.customer_name || '',
        customer_email: initial.customer_email || '',
        customer_phone: initial.customer_phone || '',
        order_number: initial.order_number || '',
        item_sku: initial.item_sku || '',
        item_name: initial.item_name || '',
        quantity: initial.quantity || 1,
        reason: initial.reason || 'damaged',
        description: initial.description || '',
      };
    }
    return { ...EMPTY };
  });
  const [errors, setErrors] = useState({});

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Build payload — for edit, only send changed fields
    let payload;
    if (isEdit) {
      payload = {};
      for (const key of Object.keys(form)) {
        const val = key === 'quantity' ? Number(form[key]) : form[key];
        const orig = initial[key];
        if (val !== orig && !(val === '' && (orig === null || orig === undefined))) {
          payload[key] = key === 'quantity' ? Number(form[key]) : form[key] || null;
        }
      }
      if (Object.keys(payload).length === 0) {
        onCancel();
        return;
      }
    } else {
      payload = { ...form, quantity: Number(form.quantity) };
      if (!payload.customer_phone) delete payload.customer_phone;
      if (!payload.description) delete payload.description;
    }

    const result = await onSubmit(payload);
    if (result?.errors) {
      setErrors(result.errors);
    }
  };

  const Field = ({ label, field, type = 'text', required = true, ...props }) => (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={`field-${field}`}>
        {label} {!required && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={`field-${field}`}
          className={`input ${errors[field] ? 'input-error' : ''}`}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          rows={3}
          {...props}
        />
      ) : type === 'select' ? (
        <select
          id={`field-${field}`}
          className={`input select ${errors[field] ? 'input-error' : ''}`}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
        >
          {props.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          id={`field-${field}`}
          type={type}
          className={`input ${errors[field] ? 'input-error' : ''}`}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          {...props}
        />
      )}
      {errors[field] && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors[field]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errors.body && (
        <div className="p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
          {errors.body}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Customer Name" field="customer_name" placeholder="John Doe" />
        <Field label="Email" field="customer_email" type="email" placeholder="john@example.com" />
      </div>

      <Field label="Phone" field="customer_phone" required={false} placeholder="+91 9876543210" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Order Number" field="order_number" placeholder="ORD-10001" />
        <Field label="Item SKU" field="item_sku" placeholder="SKU-CUSH-01" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Item Name" field="item_name" placeholder="Memory foam seat cushion" />
        <Field label="Quantity" field="quantity" type="number" min="1" max="1000" />
      </div>

      <Field label="Reason" field="reason" type="select" options={REASONS} />
      <Field label="Description" field="description" type="textarea" required={false} placeholder="Describe the issue…" />

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Request'}
        </button>
      </div>
    </form>
  );
}
