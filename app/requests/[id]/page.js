'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import RequestForm from '../../components/RequestForm';
import ToastContainer, { useToast } from '../../components/Toast';

const REASON_LABELS = {
  damaged: 'Damaged', wrong_item: 'Wrong Item', size_issue: 'Size Issue',
  not_as_described: 'Not As Described', changed_mind: 'Changed Mind',
};
const RESOLUTION_LABELS = { refund: 'Refund', replacement: 'Replacement', store_credit: 'Store Credit' };
const STATUS_LABELS = { open: 'Open', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' };

const TRANSITION_CONFIG = {
  in_review: { label: 'Start Review', class: 'btn-warning', confirm: false },
  approved: { label: 'Approve', class: 'btn-success', confirm: true },
  rejected: { label: 'Reject', class: 'btn-danger', confirm: true },
  completed: { label: 'Complete', class: 'btn-primary', confirm: true },
};

function DetailField({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

export default function RequestDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { toasts, addToast } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [transitioning, setTransitioning] = useState(null);

  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Approve form state
  const [resolution, setResolution] = useState('refund');
  const [refundAmount, setRefundAmount] = useState('');
  const [approveErrors, setApproveErrors] = useState({});

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${params.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `Error ${res.status}`);
      }
      setRequest(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const handleTransition = async (newStatus) => {
    if (newStatus === 'approved') {
      setShowApprove(true);
      return;
    }
    setTransitioning(newStatus);
    try {
      const res = await fetch(`/api/requests/${params.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) {
        addToast(result.error?.message || 'Status change failed', 'error');
        return;
      }
      addToast(`Status changed to ${STATUS_LABELS[newStatus]}`, 'success');
      fetchRequest();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setTransitioning(null);
    }
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    setApproveErrors({});
    setTransitioning('approved');
    try {
      const body = {
        status: 'approved',
        resolution,
        ...(resolution === 'refund' ? { refund_amount: refundAmount } : {}),
      };
      const res = await fetch(`/api/requests/${params.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.error?.details) {
          setApproveErrors(result.error.details);
          return;
        }
        addToast(result.error?.message || 'Approval failed', 'error');
        return;
      }
      setShowApprove(false);
      addToast('Request approved', 'success');
      fetchRequest();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setTransitioning(null);
    }
  };

  const handleEdit = async (payload) => {
    setEditing(true);
    try {
      const res = await fetch(`/api/requests/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.error?.details) return { errors: result.error.details };
        addToast(result.error?.message || 'Update failed', 'error');
        return {};
      }
      setShowEdit(false);
      addToast('Request updated', 'success');
      fetchRequest();
      return {};
    } catch (err) {
      addToast(err.message, 'error');
      return {};
    } finally {
      setEditing(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/requests/${params.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteText.trim() }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null);
        addToast(result?.error?.message || 'Failed to add note', 'error');
        return;
      }
      setNoteText('');
      addToast('Note added', 'success');
      fetchRequest();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/requests/${params.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const result = await res.json().catch(() => null);
        addToast(result?.error?.message || 'Removal failed', 'error');
        setShowRemoveConfirm(false);
        return;
      }
      addToast('Request removed', 'success');
      router.push('/');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setRemoving(false);
    }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: 'var(--muted)' }}>
        <div className="text-center">
          <div className="skeleton mx-auto mb-4" style={{ width: '3rem', height: '3rem', borderRadius: '50%' }} />
          <p>Loading request…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">😥</p>
          <p className="font-semibold text-lg">{error}</p>
          <div className="flex gap-3 justify-center mt-4">
            <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back to list</button>
            <button className="btn btn-primary" onClick={fetchRequest}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const r = request;

  return (
    <div className="flex flex-col min-h-full">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="border-b px-4 sm:px-6 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => router.push('/')}
            className="text-sm font-medium mb-3 inline-flex items-center gap-1 hover:underline"
            style={{ color: '#6366f1' }}
          >
            ← Back to all requests
          </button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
                <span className="font-mono" style={{ color: '#6366f1' }}>{r.reference}</span>
                <StatusBadge status={r.status} />
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Created {formatDate(r.created_at)} · Last updated {formatDate(r.updated_at)}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Transition buttons — only legal actions */}
              {r.allowed_transitions?.map((t) => {
                const cfg = TRANSITION_CONFIG[t];
                return (
                  <button
                    key={t}
                    className={`btn ${cfg.class}`}
                    onClick={() => handleTransition(t)}
                    disabled={transitioning !== null}
                    id={`btn-${t}`}
                  >
                    {transitioning === t ? '…' : cfg.label}
                  </button>
                );
              })}
              {r.can_edit && (
                <button className="btn btn-ghost" onClick={() => setShowEdit(true)} id="btn-edit">
                  ✏️ Edit
                </button>
              )}
              {r.can_remove && (
                <button className="btn btn-danger" onClick={() => setShowRemoveConfirm(true)} id="btn-remove"
                  style={{ background: 'transparent', color: '#ef4444', borderColor: '#ef4444' }}>
                  🗑 Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Customer info */}
            <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>Customer</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DetailField label="Name" value={r.customer_name} />
                <DetailField label="Email" value={r.customer_email} />
                <DetailField label="Phone" value={r.customer_phone} />
              </dl>
            </section>

            {/* Order & Item */}
            <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>Order & Item</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailField label="Order Number" value={r.order_number} mono />
                <DetailField label="Item SKU" value={r.item_sku} mono />
                <DetailField label="Item Name" value={r.item_name} />
                <DetailField label="Quantity" value={r.quantity} />
              </dl>
            </section>

            {/* Return details */}
            <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>Return Details</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailField label="Reason" value={
                  <span className="reason-badge">{REASON_LABELS[r.reason] || r.reason}</span>
                } />
                <DetailField label="Resolution" value={
                  r.resolution
                    ? <span className="font-medium">{RESOLUTION_LABELS[r.resolution]}{r.refund_amount ? ` — ₹${Number(r.refund_amount).toLocaleString('en-IN')}` : ''}</span>
                    : '—'
                } />
                <div className="sm:col-span-2">
                  <DetailField label="Description" value={r.description} />
                </div>
              </dl>
            </section>
          </div>

          {/* Right: Notes */}
          <div className="flex flex-col gap-4">
            <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>
                Notes ({r.notes?.length || 0})
              </h3>

              {/* Add note form */}
              <form onSubmit={handleAddNote} className="mb-4">
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Add a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  id="note-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary mt-2 w-full"
                  disabled={!noteText.trim() || addingNote}
                  id="btn-add-note"
                >
                  {addingNote ? 'Adding…' : 'Add Note'}
                </button>
              </form>

              {/* Notes timeline */}
              {r.notes?.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>No notes yet</p>
              ) : (
                <div className="flex flex-col">
                  {r.notes?.map((note) => (
                    <div key={note.id} className="note-item">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold">{note.author}</span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {formatDate(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm" style={{ lineHeight: 1.5 }}>{note.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEdit && (
        <Modal title="Edit Request Details" onClose={() => setShowEdit(false)} wide>
          <RequestForm
            initial={r}
            onSubmit={handleEdit}
            onCancel={() => setShowEdit(false)}
            submitting={editing}
          />
        </Modal>
      )}

      {/* Approve Modal */}
      {showApprove && (
        <Modal title="Approve Request" onClose={() => { setShowApprove(false); setApproveErrors({}); }}>
          <form onSubmit={handleApprove} className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Choose how this return will be resolved:
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Resolution</label>
              <select
                className={`input select ${approveErrors.resolution ? 'input-error' : ''}`}
                value={resolution}
                onChange={(e) => { setResolution(e.target.value); setRefundAmount(''); setApproveErrors({}); }}
                id="approve-resolution"
              >
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
                <option value="store_credit">Store Credit</option>
              </select>
              {approveErrors.resolution && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{approveErrors.resolution}</p>}
            </div>

            {resolution === 'refund' && (
              <div>
                <label className="block text-sm font-medium mb-1">Refund Amount (₹)</label>
                <input
                  type="text"
                  className={`input ${approveErrors.refund_amount ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(e) => { setRefundAmount(e.target.value); setApproveErrors({}); }}
                  id="approve-refund-amount"
                />
                {approveErrors.refund_amount && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{approveErrors.refund_amount}</p>}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowApprove(false); setApproveErrors({}); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success" disabled={transitioning !== null}>
                {transitioning === 'approved' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <Modal title="Remove Request" onClose={() => setShowRemoveConfirm(false)}>
          <p className="text-sm mb-4">
            Are you sure you want to remove <strong>{r.reference}</strong>? The request will be taken off the desk
            but the record will be preserved.
          </p>
          <div className="flex gap-3 justify-end">
            <button className="btn btn-ghost" onClick={() => setShowRemoveConfirm(false)} disabled={removing}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleRemove} disabled={removing} id="btn-confirm-remove">
              {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
