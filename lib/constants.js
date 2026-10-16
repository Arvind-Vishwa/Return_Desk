export const STATUSES = ['open', 'in_review', 'approved', 'rejected', 'completed'];
export const REASONS = ['damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind'];
export const RESOLUTIONS = ['refund', 'replacement', 'store_credit'];

// Rule 1: the only legal moves
export const TRANSITIONS = {
  open: ['in_review'],
  in_review: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};

export const LOCKED_STATUSES = ['approved', 'rejected', 'completed']; // Rule 4
export const REMOVABLE_STATUSES = ['open', 'rejected'];             // Rule 5

export const STATUS_LABELS = {
  open: 'Open', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected', completed: 'Completed',
};
export const REASON_LABELS = {
  damaged: 'Damaged', wrong_item: 'Wrong Item', size_issue: 'Size Issue',
  not_as_described: 'Not As Described', changed_mind: 'Changed Mind',
};
export const RESOLUTION_LABELS = { refund: 'Refund', replacement: 'Replacement', store_credit: 'Store Credit' };