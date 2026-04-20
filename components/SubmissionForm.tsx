'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Submission, SkillDefinition, SubmissionPayload, WorkHistoryEntry } from '@/lib/types';
import { createSubmission, updateSubmission } from '@/lib/actions';

interface Props {
  submission?: Submission & { skill_ids: number[] };
  skillDefinitions: SkillDefinition[];
}

type FormState = {
  name: string;
  age: string;
  location: string;
  contact_number: string;
  fb_link: string;
  years_of_experience: string;
  work_history: string;
  has_valid_id: boolean;
  valid_id_image_url: string;
  has_nbi_clearance: boolean;
  nbi_clearance_image_url: string;
  has_barangay_clearance: boolean;
  barangay_clearance_image_url: string;
  has_tesda_nc2: boolean;
  tesda_nc2_image_url: string;
  submitted_at: string;
  status: string;
  error_message: string;
  pay_rate: string;
  pay_period: string;
  availability: string;
  work_setup: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  nursing_skill: 'Nursing Skills',
  type_of_care: 'Type of Care',
  life_skill: 'Life Skills',
};

const input =
  'border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const label = 'block text-xs font-medium text-gray-600 mb-1';

export default function SubmissionForm({ submission, skillDefinitions }: Props) {
  const router = useRouter();
  const isEditing = !!submission;

  const [form, setForm] = useState<FormState>({
    name: submission?.name ?? '',
    age: String(submission?.age ?? 18),
    location: submission?.location ?? '',
    contact_number: submission?.contact_number ?? '',
    fb_link: submission?.fb_link ?? '',
    years_of_experience: String(submission?.years_of_experience ?? 0),
    work_history: JSON.stringify(submission?.work_history ?? [], null, 2),
    has_valid_id: submission?.has_valid_id ?? false,
    valid_id_image_url: submission?.valid_id_image_url ?? '',
    has_nbi_clearance: submission?.has_nbi_clearance ?? false,
    nbi_clearance_image_url: submission?.nbi_clearance_image_url ?? '',
    has_barangay_clearance: submission?.has_barangay_clearance ?? false,
    barangay_clearance_image_url: submission?.barangay_clearance_image_url ?? '',
    has_tesda_nc2: submission?.has_tesda_nc2 ?? false,
    tesda_nc2_image_url: submission?.tesda_nc2_image_url ?? '',
    submitted_at: submission?.submitted_at
      ? submission.submitted_at.slice(0, 16)
      : '',
    status: submission?.status ?? 'received',
    error_message: submission?.error_message ?? '',
    pay_rate: submission?.pay_rate != null ? String(submission.pay_rate) : '',
    pay_period: submission?.pay_period ?? '',
    availability: submission?.availability ?? '',
    work_setup: submission?.work_setup ?? '',
  });

  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(
    new Set(submission?.skill_ids ?? [])
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const groupedSkills = skillDefinitions.reduce<Record<string, SkillDefinition[]>>(
    (acc, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill);
      return acc;
    },
    {}
  );

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, type } = e.target;
    const value =
      type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleSkill(skillId: number) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.has(skillId) ? next.delete(skillId) : next.add(skillId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    let work_history: WorkHistoryEntry[];
    try {
      work_history = JSON.parse(form.work_history || '[]');
      if (!Array.isArray(work_history)) throw new Error('Must be a JSON array');
    } catch (err) {
      setError(`work_history: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
      setPending(false);
      return;
    }

    const payload: SubmissionPayload = {
      name: form.name,
      age: parseInt(form.age),
      location: form.location,
      contact_number: form.contact_number,
      fb_link: form.fb_link,
      years_of_experience: parseInt(form.years_of_experience),
      work_history,
      has_valid_id: form.has_valid_id,
      valid_id_image_url: form.valid_id_image_url || null,
      has_nbi_clearance: form.has_nbi_clearance,
      nbi_clearance_image_url: form.nbi_clearance_image_url || null,
      has_barangay_clearance: form.has_barangay_clearance,
      barangay_clearance_image_url: form.barangay_clearance_image_url || null,
      has_tesda_nc2: form.has_tesda_nc2,
      tesda_nc2_image_url: form.tesda_nc2_image_url || null,
      submitted_at: form.submitted_at ? new Date(form.submitted_at).toISOString() : null,
      status: form.status as 'received' | 'processed' | 'failed',
      error_message: form.error_message || null,
      pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : null,
      pay_period: (form.pay_period || null) as 'hour' | 'day' | 'month' | null,
      availability: (form.availability || null) as
        | 'immediate'
        | 'this_week'
        | 'flexible'
        | null,
      work_setup: (form.work_setup || null) as
        | 'stay-in'
        | 'stay-out'
        | 'stay-in & stay-out'
        | null,
      skill_ids: Array.from(selectedSkills),
    };

    const result = isEditing
      ? await updateSubmission(submission.id, payload)
      : await createSubmission(payload);

    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
    // On success the server action calls redirect('/') — navigation is handled automatically
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* ── Basic Info ─────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Basic Info
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
          <div>
            <label className={label}>Age *</label>
            <input
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              min={16}
              max={120}
              className={input}
              required
            />
          </div>
          <div>
            <label className={label}>Location *</label>
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
          <div>
            <label className={label}>Contact Number *</label>
            <input
              name="contact_number"
              value={form.contact_number}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Facebook Link *</label>
            <input
              name="fb_link"
              value={form.fb_link}
              onChange={handleChange}
              className={input}
              required
            />
          </div>
        </div>
      </section>

      {/* ── Experience ─────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Experience
        </h2>
        <div className="space-y-4">
          <div className="w-40">
            <label className={label}>Years of Experience</label>
            <input
              type="number"
              name="years_of_experience"
              value={form.years_of_experience}
              onChange={handleChange}
              min={0}
              max={80}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Work History (JSON array)</label>
            <textarea
              name="work_history"
              value={form.work_history}
              onChange={handleChange}
              rows={6}
              className={`${input} font-mono text-xs`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Format:{' '}
              <code className="bg-gray-100 px-1 rounded">
                {`[{"employer":"...","role":"...","duration":"...","description":"..."}]`}
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* ── Documents ──────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Documents
        </h2>
        <div className="space-y-3">
          {(
            [
              { flag: 'has_valid_id', url: 'valid_id_image_url', label: 'Valid ID' },
              { flag: 'has_nbi_clearance', url: 'nbi_clearance_image_url', label: 'NBI Clearance' },
              {
                flag: 'has_barangay_clearance',
                url: 'barangay_clearance_image_url',
                label: 'Barangay Clearance',
              },
              { flag: 'has_tesda_nc2', url: 'tesda_nc2_image_url', label: 'TESDA NC2' },
            ] as { flag: keyof FormState; url: keyof FormState; label: string }[]
          ).map(({ flag, url, label: docLabel }) => (
            <div key={String(flag)} className="grid grid-cols-4 gap-4 items-center">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name={String(flag)}
                  checked={form[flag] as boolean}
                  onChange={handleChange}
                  className="w-4 h-4 rounded"
                />
                {docLabel}
              </label>
              <div className="col-span-3">
                <input
                  name={String(url)}
                  value={(form[url] as string) || ''}
                  onChange={handleChange}
                  placeholder="Image URL"
                  className={input}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pay & Availability ─────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Pay & Availability
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Pay Rate</label>
            <input
              type="number"
              name="pay_rate"
              value={form.pay_rate}
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="e.g. 600"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Pay Period</label>
            <select name="pay_period" value={form.pay_period} onChange={handleChange} className={input}>
              <option value="">— none —</option>
              <option value="hour">hour</option>
              <option value="day">day</option>
              <option value="month">month</option>
            </select>
          </div>
          <div>
            <label className={label}>Availability</label>
            <select
              name="availability"
              value={form.availability}
              onChange={handleChange}
              className={input}
            >
              <option value="">— none —</option>
              <option value="immediate">immediate</option>
              <option value="this_week">this_week</option>
              <option value="flexible">flexible</option>
            </select>
          </div>
          <div>
            <label className={label}>Work Setup</label>
            <select
              name="work_setup"
              value={form.work_setup}
              onChange={handleChange}
              className={input}
            >
              <option value="">— none —</option>
              <option value="stay-in">stay-in</option>
              <option value="stay-out">stay-out</option>
              <option value="stay-in & stay-out">stay-in &amp; stay-out</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Skills ─────────────────────────────────────── */}
      {skillDefinitions.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Skills
          </h2>
          <div className="space-y-4">
            {Object.entries(groupedSkills).map(([category, skills]) => (
              <div key={category}>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {skills.map((skill) => (
                    <label
                      key={skill.id}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkills.has(skill.id)}
                        onChange={() => toggleSkill(skill.id)}
                        className="w-4 h-4 rounded"
                      />
                      {skill.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Admin ──────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Admin
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Status *</label>
            <select name="status" value={form.status} onChange={handleChange} className={input} required>
              <option value="received">received</option>
              <option value="processed">processed</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div>
            <label className={label}>Submitted At</label>
            <input
              type="datetime-local"
              name="submitted_at"
              value={form.submitted_at}
              onChange={handleChange}
              className={input}
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Error Message</label>
            <textarea
              name="error_message"
              value={form.error_message}
              onChange={handleChange}
              rows={2}
              className={input}
            />
          </div>
        </div>
      </section>

      {/* ── Actions ────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {pending ? 'Saving…' : isEditing ? 'Update Submission' : 'Create Submission'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 text-sm hover:text-gray-800 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
