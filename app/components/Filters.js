'use client';

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

const REASONS = [
  { value: '', label: 'All Reasons' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'size_issue', label: 'Size Issue' },
  { value: 'not_as_described', label: 'Not As Described' },
  { value: 'changed_mind', label: 'Changed Mind' },
];

export default function Filters({ status, reason, onStatusChange, onReasonChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <select
        className="input select"
        style={{ width: 'auto', minWidth: '9rem' }}
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        id="filter-status"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <select
        className="input select"
        style={{ width: 'auto', minWidth: '9rem' }}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        id="filter-reason"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}
