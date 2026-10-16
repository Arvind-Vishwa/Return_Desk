'use client';

const STATUS_COLORS = {
  open: 'badge-open',
  in_review: 'badge-in_review',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  completed: 'badge-completed',
};

const STATUS_ICONS = {
  open: '○',
  in_review: '◐',
  approved: '✓',
  rejected: '✕',
  completed: '●',
};

const STATUS_LABELS = {
  open: 'Open',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || ''}`}>
      <span aria-hidden="true">{STATUS_ICONS[status]}</span>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
