export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase';
import SubmissionForm from '@/components/SubmissionForm';
import { notFound } from 'next/navigation';
import type { Submission, SkillDefinition } from '@/lib/types';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditSubmissionPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: submission }, { data: skills }, { data: caregiverSkills }] = await Promise.all([
    supabase.from('submissions').select('*').eq('id', id).single(),
    supabase.from('skill_definitions').select('*').order('category').order('name'),
    supabase.from('caregiver_skills').select('skill_id').eq('submission_id', id),
  ]);

  if (!submission) notFound();

  const skill_ids = (caregiverSkills ?? []).map((cs) => cs.skill_id as number);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{submission.first_name} {submission.last_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{id}</p>
        </div>
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
      </div>
      <SubmissionForm
        submission={{ ...(submission as Submission), skill_ids }}
        skillDefinitions={(skills ?? []) as SkillDefinition[]}
      />
    </div>
  );
}
