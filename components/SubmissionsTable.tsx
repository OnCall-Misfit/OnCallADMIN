'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Submission } from '@/lib/types';
import { deleteSubmission } from '@/lib/actions';

interface Props {
  submissions: Submission[];
}

const statusColors: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  processed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function SubmissionsTable({ submissions }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = search
    ? submissions.filter((s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete submission for "${name}"?\n\nThis will also remove their skills and ingestion logs. This cannot be undone.`))
      return;

    setDeletingId(id);
    setDeleteError(null);

    const result = await deleteSubmission(id);
    setDeletingId(null);

    if (result?.error) {
      setDeleteError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm w-64 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm mb-4">
          Delete failed: {deleteError}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Age', 'Location', 'Status', 'Availability', 'Work Setup', 'Pay', 'Created', ''].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {search ? 'No results match that search.' : 'No submissions yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.age}</td>
                  <td className="px-4 py-3 text-gray-600">{s.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[s.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {s.availability ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {s.work_setup ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {s.pay_rate != null ? `${s.pay_rate}/${s.pay_period ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/submissions/${s.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs mr-3"
                    >
                      Edit
                    </Link>
                     <button
                      onClick={() => handleDelete(s.id, `${s.first_name} ${s.last_name}`)}
                      disabled={deletingId === s.id}
                      className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40 cursor-pointer"
                    >
                      {deletingId === s.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
