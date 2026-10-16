'use client';

import { useState } from 'react';
import { REASONS, REASON_LABELS } from '@/lib/constants';

const EMPTY = {
  customer_name: '', customer_email: '', customer_phone: '', order_number: '',
  item_sku: '', item_name: '', quantity: 1, reason: 'damaged', description: '',
};

const FIELDS = [
  ['customer_name', 'Customer name', 'text'],
  ['customer_email', 'Customer email', 'email'],
  ['customer_phone', 'Customer phone (optional)', 'tel'],
  ['order_number', 'Order number', 'text'],
  ['item_sku', 'Item SKU', 'text'],
  ['item_name', 'Item name', 'text'],
  ['quantity', 'Quantity', 'number'],
];

export default function RequestForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    const start = { ...EMPTY };
    for (const key of Object.keys(EMPTY)) if (initial?.[key] != null) start[key] = initial[key];
    return start;
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err.message);
      setFieldErrors(err.details ?? {});
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded border border-gray-300 px-3 py-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border bg-white p-4">
      {formError && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{formError}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([key, label, type]) => (
          <label key={key} className="block text-sm">
            {label}
            <input type={type} value={values[key]} onChange={set(key)} className={inputClass}
              min={type === 'number' ? 1 : undefined} />
            {fieldErrors[key] && <span className="text-xs text-red-700">{fieldErrors[key]}</span>}
          </label>
        ))}
        <label className="block text-sm">
          Reason
          <select value={values.reason} onChange={set('reason')} className={inputClass}>
            {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
          {fieldErrors.reason && <span className="text-xs text-red-700">{fieldErrors.reason}</span>}
        </label>
      </div>

      <label className="block text-sm">
        Description (optional)
        <textarea value={values.description} onChange={set('description')} rows={3} className={inputClass} />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>}
      </div>
    </form>
  );
}