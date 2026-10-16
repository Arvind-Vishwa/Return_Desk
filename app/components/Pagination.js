'use client';

export default function Pagination({ meta, onPageChange }) {
  const { page, totalPages, total, pageSize } = meta;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-sm" style={{ color: 'var(--muted)' }}>
      <span>
        Showing <strong style={{ color: 'var(--foreground)' }}>{from}–{to}</strong> of{' '}
        <strong style={{ color: 'var(--foreground)' }}>{total}</strong>
      </span>
      <div className="flex gap-1">
        <button
          className="btn btn-ghost"
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          id="page-first"
        >
          ««
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          id="page-prev"
        >
          ‹ Prev
        </button>
        <span className="flex items-center px-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {page} / {totalPages}
        </span>
        <button
          className="btn btn-ghost"
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          id="page-next"
        >
          Next ›
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          id="page-last"
        >
          »»
        </button>
      </div>
    </div>
  );
}
