import { Suspense } from 'react';
import RequestList from '@/app/components/RequestList';

export default function RequestsPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <RequestList />
    </Suspense>
  );
}