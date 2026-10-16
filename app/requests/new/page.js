'use client';

import { useRouter } from 'next/navigation';
import RequestForm from '@/app/components/RequestForm';
import { apiFetch } from '@/app/lib/api';

export default function NewRequestPage() {
  const router = useRouter();

  async function create(values) {
    const json = await apiFetch('/api/requests', { method: 'POST', body: values });
    router.push(`/requests/${json.data.id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New return request</h1>
      <RequestForm submitLabel="Create request" onSubmit={create} onCancel={() => router.back()} />
    </div>
  );
}