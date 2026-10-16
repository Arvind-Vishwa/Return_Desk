import { STATUS_LABELS } from '@/lib/constants';

const STYLES = {
  open: 'bg-blue-100 text-blue-800 ring-blue-300',
  in_review: 'bg-amber-100 text-amber-800 ring-amber-300',
  approved: 'bg-green-100 text-green-800 ring-green-300',
  rejected: 'bg-red-100 text-red-800 ring-red-300',
  completed: 'bg-gray-200 text-gray-800 ring-gray-300',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}