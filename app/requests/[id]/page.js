'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/app/lib/api';
import { REASON_LABELS, RESOLUTIONS, RESOLUTION_LABELS } from '@/lib/constants';
import StatusBadge from '@/app/components/StatusBadge';
import RequestForm from '@/app/components/RequestForm';

const ACTION_LABELS = {
  in_review: 'Start review',
  approved: 'Approve…',
  rejected: 'Reject',
  completed: 'Mark completed',
};

export default function RequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiFetch(`/api/requests/${id}`);
      setRequest(json.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function run(action) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      const details = err.details ? Object.values(err.details).join(' ') : '';
      setActionError(`${err.message}${details ? ` — ${details}` : ''}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (body) =>
    run(() => apiFetch(`/api/requests/${id}/status`, { method: 'POST', body }));

  async function remove() {
    if (!confirm('Remove this request from the desk? The record is kept.')) return;
    setBusy(true);
    try {
      await apiFetch(`/api/requests/${id}`, { method: 'DELETE' });
      router.push('/requests');
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="rounded bg-red-50 p-3 text-red-800">{loadError}</p>
        <Link href="/requests" className="text-blue-700 hover:underline">Back to all requests</Link>
      </div>
    );
  }
  if (!request) return <p className="text-gray-500">Loading request…</p>;

  return (
    <div className="space-y-6">
      <Link href="/requests" className="text-sm text-blue-700 hover:underline">← All requests</Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{request.reference}</h1>
        <StatusBadge status={request.status} />
      </div>

      {actionError && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}

      <div className="flex flex-wrap gap-2">
        {request.allowed_transitions.map((status) => (
          <button key={status} disabled={busy}
            onClick={() => (status === 'approved' ? setApproving(true) : changeStatus({ status }))}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {ACTION_LABELS[status]}
          </button>
        ))}
        {request.can_edit && !editing && (
          <button onClick={() => setEditing(true)} className="rounded border px-3 py-2 text-sm">Edit details</button>
        )}
        {request.can_remove && (
          <button disabled={busy} onClick={remove} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700">
            Remove
          </button>
        )}
      </div>

      {approving && (
        <ApproveForm busy={busy} onCancel={() => setApproving(false)}
          onSubmit={async (body) => { if (await changeStatus(body)) setApproving(false); }} />
      )}

      {editing ? (
        <RequestForm initial={request} submitLabel="Save changes" onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await apiFetch(`/api/requests/${id}`, { method: 'PATCH', body: values });
            setEditing(false);
            await load();
          }} />
      ) : (
        <dl className="grid gap-4 rounded border bg-white p-4 text-sm sm:grid-cols-2">
          <Field label="Customer" value={request.customer_name} />
          <Field label="Contact" value={[request.customer_email, request.customer_phone].filter(Boolean).join(' · ')} />
          <Field label="Order" value={request.order_number} />
          <Field label="Item" value={`${request.item_name} (${request.item_sku}) × ${request.quantity}`} />
          <Field label="Reason" value={REASON_LABELS[request.reason]} />
          <Field label="Resolution" value={request.resolution
            ? `${RESOLUTION_LABELS[request.resolution]}${request.refund_amount ? ` — ₹${request.refund_amount}` : ''}`
            : '—'} />
          <Field label="Description" value={request.description || '—'} />
          <Field label="Created" value={new Date(request.created_at).toLocaleString('en-IN')} />
        </dl>
      )}

      <Notes requestId={id} notes={request.notes} onAdded={load} />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function ApproveForm({ busy, onSubmit, onCancel }) {
  const [resolution, setResolution] = useState('refund');
  const [amount, setAmount] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ status: 'approved', resolution, refund_amount: resolution === 'refund' ? amount : null });
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4 text-sm"
    >
      <label>
        Resolution
        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="mt-1 block rounded border px-3 py-2">
          {RESOLUTIONS.map((r) => <option key={r} value={r}>{RESOLUTION_LABELS[r]}</option>)}
        </select>
      </label>
      {resolution === 'refund' && (
        <label>
          Refund amount (₹)
          <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-36 rounded border px-3 py-2" />
        </label>
      )}
      <button disabled={busy} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">Confirm approval</button>
      <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
    </form>
  );
}

function Notes({ requestId, notes, onAdded }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/requests/${requestId}/notes`, { method: 'POST', body: { body: text } });
      setText('');
      await onAdded();
    } catch (err) {
      setError(err.details?.body ?? err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Notes</h2>
      {notes.length === 0 && <p className="text-sm text-gray-500">No notes yet.</p>}
      <ol className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded border bg-white p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-xs text-gray-500">{n.author} · {new Date(n.created_at).toLocaleString('en-IN')}</p>
          </li>
        ))}
      </ol>
      <form onSubmit={add} className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Add a note…"
          className="w-full rounded border px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={saving} className="rounded bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50">
          {saving ? 'Adding…' : 'Add note'}
        </button>
      </form>
    </section>
  );
}