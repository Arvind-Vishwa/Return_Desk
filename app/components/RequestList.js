'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/app/lib/api';
import { STATUSES, REASONS, STATUS_LABELS, REASON_LABELS } from '@/lib/constants';
import StatusBadge from './StatusBadge';

const SORT_OPTIONS = [
  ['created_at:desc', 'Newest first'],
  ['created_at:asc', 'Oldest first'],
  ['updated_at:desc', 'Recently updated'],
  ['reference:asc', 'Reference A–Z'],
  ['customer_name:asc', 'Customer A–Z'],
  ['status:asc', 'Status'],
];

export default function RequestList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [searchText, setSearchText] = useState(searchParams.get('q') ?? '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  function updateParams(changes) {
    const params = new URLSearchParams(queryString);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!('page' in changes)) params.delete('page');
    router.replace(`${pathname}?${params}`);
  }

  // Debounced search
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (searchText.trim() === current) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchText.trim()) params.set('q', searchText.trim());
      else params.delete('q');
      params.delete('page');
      router.replace(`${pathname}?${params}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText, searchParams, router, pathname]);

  // Fetch whenever the URL changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/requests?${queryString}`)
      .then((json) => { if (!cancelled) setResult(json); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryString]);

  const sortValue = `${searchParams.get('sort') ?? 'created_at'}:${searchParams.get('order') ?? 'desc'}`;
  const meta = result?.meta;
  const rows = result?.data ?? [];
  const inputClass = 'rounded border border-gray-300 bg-white px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Return requests</h1>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          placeholder="Search customer, order or reference"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className={inputClass}
        />
        <select value={searchParams.get('status') ?? ''} onChange={(e) => updateParams({ status: e.target.value })} className={inputClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={searchParams.get('reason') ?? ''} onChange={(e) => updateParams({ reason: e.target.value })} className={inputClass}>
          <option value="">All reasons</option>
          {REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
        </select>
        <select
          value={sortValue}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(':');
            updateParams({ sort, order });
          }}
          className={inputClass}
        >
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Could not load requests: {error}
        </div>
      )}

      {loading && !result && <p className="text-gray-500">Loading requests…</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded border border-dashed bg-white p-8 text-center text-gray-500">
          No requests match your search and filters.
        </div>
      )}

      {rows.length > 0 && (
        <div className={loading ? 'opacity-50' : ''}>
          {/* Desktop: table */}
          <table className="hidden w-full overflow-hidden rounded border bg-white text-sm md:table">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Reference</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Order / Item</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono">
                    <Link href={`/requests/${r.id}`} className="text-blue-700 hover:underline">{r.reference}</Link>
                  </td>
                  <td className="p-3">{r.customer_name}</td>
                  <td className="p-3">{r.order_number} · {r.item_name} × {r.quantity}</td>
                  <td className="p-3">{REASON_LABELS[r.reason]}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                  <td className="p-3">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="block rounded border bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{r.reference}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 font-medium">{r.customer_name}</p>
                  <p className="text-sm text-gray-600">{r.order_number} · {r.item_name} · {REASON_LABELS[r.reason]}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span>Page {meta.page} of {meta.totalPages} · {meta.total} requests</span>
          <div className="flex gap-2">
            <button disabled={meta.page <= 1} onClick={() => updateParams({ page: String(meta.page - 1) })}
              className="rounded border bg-white px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={meta.page >= meta.totalPages} onClick={() => updateParams({ page: String(meta.page + 1) })}
              className="rounded border bg-white px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}