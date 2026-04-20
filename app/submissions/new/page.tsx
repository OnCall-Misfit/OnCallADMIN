export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase';
import SubmissionForm from '@/components/SubmissionForm';
import type { SkillDefinition } from '@/lib/types';
import Link from 'next/link';

export default async function NewSubmissionPage() {
  const supabase = createAdminClient();

  const { data: skills } = await supabase
    .from('skill_definitions')
    .select('*')
    .order('category')
    .order('name');

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">New Submission</h1>
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
      </div>
      <SubmissionForm skillDefinitions={(skills ?? []) as SkillDefinition[]} />
    </div>
  );
}
