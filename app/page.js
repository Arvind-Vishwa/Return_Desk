'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from './components/StatusBadge';
import SearchBar from './components/SearchBar';
import Filters from './components/Filters';
import Pagination from './components/Pagination';
import Modal from './components/Modal';
import RequestForm from './components/RequestForm';
import ToastContainer, { useToast } from './components/Toast';

const REASON_LABELS = {
  damaged: 'Damaged', wrong_item: 'Wrong Item', size_issue: 'Size Issue',
  not_as_described: 'Not As Described', changed_mind: 'Changed Mind',
};

const SORT_LABELS = {
  created_at: 'Date Created',
  updated_at: 'Last Updated',
  reference: 'Reference',
  customer_name: 'Customer',
  status: 'Status',
};

const SKELETON_WIDTHS = ['75%', '60%', '85%', '70%', '80%', '65%'];

function SkeletonRow({ rowIndex = 0 }) {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i}>
          <div
            className="skeleton"
            style={{
              height: '1rem',
              width: SKELETON_WIDTHS[(i + rowIndex) % SKELETON_WIDTHS.length],
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { toasts, addToast } = useToast();

  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (reason) params.set('reason', reason);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', page);
      params.set('pageSize', 10);

      const res = await fetch(`/api/requests?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `Server error (${res.status})`);
      }
      const result = await res.json();
      setData(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, status, reason, sort, order, page, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  const handleSearch = (v) => { setQ(v); setPage(1); };
  const handleStatus = (v) => { setStatus(v); setPage(1); };
  const handleReason = (v) => { setReason(v); setPage(1); };

  const handleSort = (col) => {
    if (sort === col) {
      setOrder((prev) => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.error?.details) return { errors: result.error.details };
        addToast(result.error?.message || 'Failed to create request', 'error');
        return {};
      }
      setShowCreate(false);
      addToast('Request created successfully', 'success');
      fetchData();
      return {};
    } catch (err) {
      addToast(err.message, 'error');
      return {};
    } finally {
      setCreating(false);
    }
  };

  const SortIcon = ({ col }) => {
    if (sort !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col min-h-full">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="border-b px-4 sm:px-6 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span style={{ color: '#6366f1' }}>↩</span> ReturnDesk
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Returns Management Dashboard</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
            id="btn-new-request"
          >
            + New Request
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">

          {/* Search + Filters + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar value={q} onChange={handleSearch} />
            <Filters
              status={status}
              reason={reason}
              onStatusChange={handleStatus}
              onReasonChange={handleReason}
            />
          </div>

          {/* Sort indicator */}
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <span>Sorted by</span>
            <select
              className="input select"
              style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', fontSize: '0.8rem' }}
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              id="sort-select"
            >
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
              id="sort-order"
            >
              {order === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>

          {/* Error state */}
          {error && !loading && (
            <div className="p-4 rounded-lg text-center" style={{ background: '#fee2e2', color: '#991b1b' }}>
              <p className="font-medium">Failed to load requests</p>
              <p className="text-sm mt-1">{error}</p>
              <button className="btn btn-ghost mt-3" onClick={fetchData}>Try Again</button>
            </div>
          )}

          {/* Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('reference')}>
                    Ref <SortIcon col="reference" />
                  </th>
                  <th onClick={() => handleSort('customer_name')}>
                    Customer <SortIcon col="customer_name" />
                  </th>
                  <th className="hidden md:table-cell">Item</th>
                  <th onClick={() => handleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                  <th className="hidden sm:table-cell">Reason</th>
                  <th onClick={() => handleSort('created_at')}>
                    Created <SortIcon col="created_at" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} rowIndex={i} />)
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <div style={{ color: 'var(--muted)' }}>
                        <p className="text-3xl mb-2">📭</p>
                        <p className="font-medium">No requests found</p>
                        <p className="text-sm mt-1">
                          {q || status || reason
                            ? 'Try adjusting your search or filters'
                            : 'Create your first return request to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/requests/${r.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="font-mono text-sm font-medium" style={{ color: '#6366f1' }}>
                          {r.reference}
                        </span>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{r.customer_name}</p>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.customer_email}</p>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <div>
                          <p className="text-sm">{r.item_name}</p>
                          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{r.item_sku} × {r.quantity}</p>
                        </div>
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="hidden sm:table-cell">
                        <span className="reason-badge">{REASON_LABELS[r.reason] || r.reason}</span>
                      </td>
                      <td>
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>{formatDate(r.created_at)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      </main>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="New Return Request" onClose={() => setShowCreate(false)} wide>
          <RequestForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitting={creating}
          />
        </Modal>
      )}
    </div>
  );
}
