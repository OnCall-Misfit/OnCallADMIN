'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Submission } from '@/lib/types';
import { deleteSubmission, deleteSubmissions } from '@/lib/actions';

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

  // ── Batch selection ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? submissions.filter((s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someSelected = filtered.some((s) => selectedIds.has(s.id));

  // Drive the indeterminate state on the select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  // Clear selection when search changes (selected rows may leave the visible set)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search]);

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Single delete ──────────────────────────────────────────────────────────
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

    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    router.refresh();
  }

  // ── Batch delete ───────────────────────────────────────────────────────────
  async function handleBatchDelete() {
    const ids = [...selectedIds].filter((id) => filtered.some((s) => s.id === id));
    if (ids.length === 0) return;

    if (!confirm(`Delete ${ids.length} selected submission${ids.length > 1 ? 's' : ''}?\n\nThis will also remove their skills and ingestion logs. This cannot be undone.`))
      return;

    setIsBatchDeleting(true);
    setDeleteError(null);

    const result = await deleteSubmissions(ids);
    setIsBatchDeleting(false);

    if (result?.error) {
      setDeleteError(result.error);
      return;
    }

    setSelectedIds(new Set());
    router.refresh();
  }

  const visibleSelectedCount = [...selectedIds].filter((id) => filtered.some((s) => s.id === id)).length;

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {visibleSelectedCount > 0 && (
          <>
            <span className="text-sm text-gray-600">
              {visibleSelectedCount} selected
            </span>
            <button
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              {isBatchDeleting ? 'Deleting…' : `Delete ${visibleSelectedCount}`}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={isBatchDeleting}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 cursor-pointer"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm mb-4">
          Delete failed: {deleteError}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Select-all checkbox */}
              <th className="px-4 py-3 w-8">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={filtered.length === 0}
                  className="cursor-pointer accent-blue-600"
                  aria-label="Select all"
                />
              </th>
              {['Name', 'Birthdate', 'Gender', 'Location', 'Status', 'Availability', 'Work Setup', 'Pay', 'Created', ''].map(
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
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {search ? 'No results match that search.' : 'No submissions yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const isSelected = selectedIds.has(s.id);
                return (
                  <tr
                    key={s.id}
                    className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(s.id)}
                        className="cursor-pointer accent-blue-600"
                        aria-label={`Select ${s.first_name} ${s.last_name}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.birthdate}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.gender}</td>
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
                        disabled={deletingId === s.id || isBatchDeleting}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40 cursor-pointer"
                      >
                        {deletingId === s.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
