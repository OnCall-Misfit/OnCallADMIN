export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase';
import SubmissionsTable from '@/components/SubmissionsTable';
import type { Submission } from '@/lib/types';

export default async function HomePage() {
  const supabase = createAdminClient();

  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
        Error loading submissions: {error.message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Submissions{' '}
          <span className="text-gray-400 font-normal text-sm">
            ({submissions?.length ?? 0})
          </span>
        </h1>
      </div>
      <SubmissionsTable submissions={(submissions ?? []) as Submission[]} />
    </div>
  );
}
