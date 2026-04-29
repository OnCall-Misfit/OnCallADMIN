export interface Submission {
  id: string;
  idempotency_key: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: 'Male' | 'Female' | 'LGBTQ+' | 'Prefer not to say';
  location: string;
  contact_number: string;
  fb_link: string | null;
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
  availability: string | null;
  work_setup: 'stay-in' | 'stay-out' | 'stay-in & stay-out' | null;
  shift_preference: 'Dayshift' | 'Nightshift' | 'Both' | null;
  type_of_work: 'Caregiver' | 'Old sitter' | 'Both' | null;
  avatar_url: string | null;
}

export interface WorkHistoryEntry {
  employer_name?: string;
  job_title?: string;
  start_date?: string | null;
  end_date?: string | null;
  job_description?: string;
  currently_employed?: boolean;
}

export interface SkillDefinition {
  id: number;
  category: 'nursing_skill' | 'type_of_care' | 'life_skill';
  name: string;
}

export interface SubmissionPayload {
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: 'Male' | 'Female' | 'LGBTQ+' | 'Prefer not to say';
  location: string;
  contact_number: string;
  fb_link: string | null;
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
  availability: string | null;
  work_setup: 'stay-in' | 'stay-out' | 'stay-in & stay-out' | null;
  shift_preference: 'Dayshift' | 'Nightshift' | 'Both' | null;
  type_of_work: 'Caregiver' | 'Old sitter' | 'Both' | null;
  avatar_url: string | null;
  skill_ids: number[];
}
