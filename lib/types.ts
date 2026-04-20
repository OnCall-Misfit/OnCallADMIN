export interface Submission {
  id: string;
  idempotency_key: string;
  name: string;
  age: number;
  location: string;
  contact_number: string;
  fb_link: string;
  years_of_experience: number;
  work_history: WorkHistoryEntry[];
  has_valid_id: boolean;
  valid_id_image_url: string | null;
  has_nbi_clearance: boolean;
  nbi_clearance_image_url: string | null;
  has_barangay_clearance: boolean;
  barangay_clearance_image_url: string | null;
  has_tesda_nc2: boolean;
  tesda_nc2_image_url: string | null;
  submitted_at: string | null;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
  pay_rate: number | null;
  pay_period: 'hour' | 'day' | 'month' | null;
  availability: 'immediate' | 'this_week' | 'flexible' | null;
  work_setup: 'stay-in' | 'stay-out' | 'stay-in & stay-out' | null;
}

export interface WorkHistoryEntry {
  employer?: string;
  role?: string;
  duration?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SkillDefinition {
  id: number;
  category: 'nursing_skill' | 'type_of_care' | 'life_skill';
  name: string;
}

export interface SubmissionPayload {
  name: string;
  age: number;
  location: string;
  contact_number: string;
  fb_link: string;
  years_of_experience: number;
  work_history: WorkHistoryEntry[];
  has_valid_id: boolean;
  valid_id_image_url: string | null;
  has_nbi_clearance: boolean;
  nbi_clearance_image_url: string | null;
  has_barangay_clearance: boolean;
  barangay_clearance_image_url: string | null;
  has_tesda_nc2: boolean;
  tesda_nc2_image_url: string | null;
  submitted_at: string | null;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  pay_rate: number | null;
  pay_period: 'hour' | 'day' | 'month' | null;
  availability: 'immediate' | 'this_week' | 'flexible' | null;
  work_setup: 'stay-in' | 'stay-out' | 'stay-in & stay-out' | null;
  skill_ids: number[];
}
