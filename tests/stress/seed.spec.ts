/**
 * Database Seed
 *
 * Populates the Supabase database with realistic Filipino caregiver applicant
 * profiles so the admin UI has actual data to browse and test against.
 *
 * Run:  npm run db:seed
 *
 * Safe to re-run — it skips seeding if profiles already exist.
 * Does NOT use the __STRESS_TEST__ prefix, so cleanup scripts won't touch it.
 *
 * What it seeds:
 *   1. skill_definitions  — 26 skills across 3 categories (if table is empty)
 *   2. submissions        — 15 realistic caregiver profiles
 *   3. caregiver_skills   — skill assignments per profile
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import { getSupabaseClient } from './helpers';

const supabase = getSupabaseClient();

// ---------------------------------------------------------------------------
// Skill definitions to seed
// ---------------------------------------------------------------------------

const SKILL_DEFS = [
  // nursing_skill (9)
  { category: 'nursing_skill', name: 'Vital Signs & Blood Sugar Monitoring' },
  { category: 'nursing_skill', name: 'NGT / PEG Tube Feeding' },
  { category: 'nursing_skill', name: 'Medication Administration & Management' },
  { category: 'nursing_skill', name: 'Airway Management (Tracheostomy & Suctioning)' },
  { category: 'nursing_skill', name: 'Catheter Care (Foley / IFC)' },
  { category: 'nursing_skill', name: 'Injections & IV Therapy (Requires RN)' },
  { category: 'nursing_skill', name: 'Wound & Bedsore Care' },
  { category: 'nursing_skill', name: 'Respiratory Support (Oxygen & Nebulizer)' },
  { category: 'nursing_skill', name: 'Stoma / Colostomy Care' },
  // type_of_care (9)
  { category: 'type_of_care', name: 'Stroke / Post-Stroke Care' },
  { category: 'type_of_care', name: "Dementia / Alzheimer's" },
  { category: 'type_of_care', name: 'Bedridden / Total Mobility Assistance' },
  { category: 'type_of_care', name: 'General Elderly Care / Companionship' },
  { category: 'type_of_care', name: 'Newborn / Infant Care' },
  { category: 'type_of_care', name: 'Kidney Disease / Dialysis Patient' },
  { category: 'type_of_care', name: 'Cancer / Palliative / Hospice Care' },
  { category: 'type_of_care', name: 'Special Needs / Pediatric' },
  { category: 'type_of_care', name: 'Post-Surgical / Orthopedic Recovery' },
  // life_skill (8)
  { category: 'life_skill', name: 'Bathing, Grooming & Personal Hygiene' },
  { category: 'life_skill', name: 'Lifting, Transferring & Repositioning' },
  { category: 'life_skill', name: 'Toileting & Diaper Changing' },
  { category: 'life_skill', name: 'Feeding & Meal Preparation' },
  { category: 'life_skill', name: 'Companionship & Supervision' },
  { category: 'life_skill', name: 'Physical Therapy & Exercise Assistance' },
  { category: 'life_skill', name: 'Light Housekeeping & Errands' },
  { category: 'life_skill', name: 'Medical Escort / Hospital Watcher (Bantay)' },
] as const;

// ---------------------------------------------------------------------------
// Seed profiles
// ---------------------------------------------------------------------------

const PROFILES = [
  {
    first_name: 'Maria', last_name: 'Santos',
    age: 34,
    location: 'Quezon City, Metro Manila',
    contact_number: '+63 917 123 4567',
    fb_link: 'https://facebook.com/maria.santos.caregiver',
    years_of_experience: 8,
    work_history: [
      { employer: 'Asian Hospital', role: 'Staff Nurse', duration: '3 years', description: 'Worked in the geriatric ward managing post-stroke patients.' },
      { employer: 'Medina Family', role: 'Private Caregiver', duration: '5 years', description: 'Full-time live-in caregiver for a bedridden elderly patient with Alzheimer\'s.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 800, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['General Elderly Care / Companionship', "Dementia / Alzheimer's", 'Medication Administration & Management', 'Vital Signs & Blood Sugar Monitoring', 'Light Housekeeping & Errands'],
  },
  {
    first_name: 'Jose', last_name: 'Reyes',
    age: 28,
    location: 'Cebu City, Cebu',
    contact_number: '+63 918 234 5678',
    fb_link: 'https://facebook.com/jose.reyes.cg',
    years_of_experience: 4,
    work_history: [
      { employer: 'Chong Hua Hospital', role: 'Nursing Aide', duration: '2 years', description: 'Assisted RNs in medical-surgical ward with daily patient care.' },
      { employer: 'Lim Household', role: 'Caregiver', duration: '2 years', description: 'Provided post-operative care and physical therapy assistance.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: false, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 650, pay_period: 'day' as const,
    availability: 'this_week' as const,
    skillNames: ['Post-Surgical / Orthopedic Recovery', 'Wound & Bedsore Care', 'Vital Signs & Blood Sugar Monitoring', 'Bathing, Grooming & Personal Hygiene'],
  },
  {
    first_name: 'Ana', last_name: 'Dela Cruz',
    age: 42,
    location: 'Davao City, Davao del Sur',
    contact_number: '+63 919 345 6789',
    fb_link: 'https://facebook.com/ana.delacruz.nurse',
    years_of_experience: 15,
    work_history: [
      { employer: 'Southern Philippines Medical Center', role: 'Registered Nurse', duration: '7 years', description: 'Head nurse in ICU, managed critically ill patients.' },
      { employer: 'Al-Farabi Family (Kuwait)', role: 'Private Nurse', duration: '5 years', description: 'Live-in private nurse for elderly stroke patient, managed all medical needs.' },
      { employer: 'Garcia Family', role: 'Senior Caregiver', duration: '3 years', description: 'Cared for a patient with late-stage Parkinson\'s disease.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1200, pay_period: 'day' as const,
    availability: 'flexible' as const,
    skillNames: ['Stroke / Post-Stroke Care', 'General Elderly Care / Companionship', 'Injections & IV Therapy (Requires RN)', 'Catheter Care (Foley / IFC)', 'Medication Administration & Management', 'Vital Signs & Blood Sugar Monitoring', 'Airway Management (Tracheostomy & Suctioning)'],
  },
  {
    first_name: 'Rodrigo', last_name: 'Bautista',
    age: 31,
    location: 'Caloocan, Metro Manila',
    contact_number: '+63 920 456 7890',
    fb_link: 'https://facebook.com/rodrigo.bautista.care',
    years_of_experience: 5,
    work_history: [
      { employer: 'Jose Reyes Memorial Hospital', role: 'Nursing Attendant', duration: '2 years', description: 'Assisted patients with daily living activities in rehabilitation unit.' },
      { employer: 'Villanueva Family', role: 'Caregiver', duration: '3 years', description: 'Cared for a pediatric patient with cerebral palsy, including therapy exercises.' },
    ],
    has_valid_id: true, has_nbi_clearance: false, has_barangay_clearance: true, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 600, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['Special Needs / Pediatric', 'Bedridden / Total Mobility Assistance', 'Lifting, Transferring & Repositioning', 'Light Housekeeping & Errands'],
  },
  {
    first_name: 'Ligaya', last_name: 'Fernandez',
    age: 38,
    location: 'Pasig, Metro Manila',
    contact_number: '+63 921 567 8901',
    fb_link: 'https://facebook.com/ligaya.fernandez',
    years_of_experience: 10,
    work_history: [
      { employer: 'Makati Medical Center', role: 'Bedside Nurse', duration: '4 years', description: 'Managed patients in oncology ward, providing palliative and comfort care.' },
      { employer: 'Tanaka Family (Japan)', role: 'Live-in Caregiver', duration: '6 years', description: 'Cared for an elderly cancer patient, coordinated with oncologists.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1000, pay_period: 'day' as const,
    availability: 'this_week' as const,
    skillNames: ['Cancer / Palliative / Hospice Care', 'General Elderly Care / Companionship', 'Medication Administration & Management', 'Respiratory Support (Oxygen & Nebulizer)', 'Vital Signs & Blood Sugar Monitoring', 'Companionship & Supervision'],
  },
  {
    first_name: 'Emmanuel', last_name: 'Castillo',
    age: 25,
    location: 'Antipolo, Rizal',
    contact_number: '+63 922 678 9012',
    fb_link: 'https://facebook.com/emmanuel.castillo.cg',
    years_of_experience: 2,
    work_history: [
      { employer: 'Our Lady of Lourdes Hospital', role: 'Volunteer Aide', duration: '6 months', description: 'Volunteered in the elderly ward during nursing school.' },
      { employer: 'Cruz Family', role: 'Caregiver', duration: '1.5 years', description: 'First professional caregiving role, assisted elderly man with daily activities.' },
    ],
    has_valid_id: true, has_nbi_clearance: false, has_barangay_clearance: false, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 500, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['General Elderly Care / Companionship', 'Light Housekeeping & Errands', 'Feeding & Meal Preparation', 'Companionship & Supervision'],
  },
  {
    first_name: 'Rosario', last_name: 'Mendoza',
    age: 47,
    location: 'Iloilo City, Iloilo',
    contact_number: '+63 923 789 0123',
    fb_link: 'https://facebook.com/rosario.mendoza.nurse',
    years_of_experience: 20,
    work_history: [
      { employer: 'Western Visayas Medical Center', role: 'Senior Nurse', duration: '10 years', description: 'Managed stroke and neurological patients in the neurology ward.' },
      { employer: 'Schmidt Family (Germany)', role: 'Live-in Nurse', duration: '7 years', description: 'Provided comprehensive nursing care for a bedridden dementia patient.' },
      { employer: 'Reyes Family', role: 'Geriatric Specialist Caregiver', duration: '3 years', description: 'Specialized in dementia and Alzheimer\'s care management.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1500, pay_period: 'day' as const,
    availability: 'flexible' as const,
    skillNames: ["Dementia / Alzheimer's", 'Bedridden / Total Mobility Assistance', 'Stroke / Post-Stroke Care', 'Catheter Care (Foley / IFC)', 'Medication Administration & Management', 'Vital Signs & Blood Sugar Monitoring', 'Airway Management (Tracheostomy & Suctioning)', 'Respiratory Support (Oxygen & Nebulizer)'],
  },
  {
    first_name: 'Danilo', last_name: 'Aquino',
    age: 33,
    location: 'Taguig, Metro Manila',
    contact_number: '+63 924 890 1234',
    fb_link: 'https://facebook.com/danilo.aquino.caregiver',
    years_of_experience: 6,
    work_history: [
      { employer: 'Philippine Heart Center', role: 'Cardiac Nurse Aide', duration: '3 years', description: 'Assisted in the cardiac care unit, monitoring vitals and assisting with post-op recovery.' },
      { employer: 'Lopez Family', role: 'Caregiver', duration: '3 years', description: 'Provided post-cardiac surgery home care for an elderly patient.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 700, pay_period: 'day' as const,
    availability: 'this_week' as const,
    skillNames: ['Post-Surgical / Orthopedic Recovery', 'Vital Signs & Blood Sugar Monitoring', 'Medication Administration & Management', 'Lifting, Transferring & Repositioning', 'Airway Management (Tracheostomy & Suctioning)'],
  },
  {
    first_name: 'Marites', last_name: 'Soriano',
    age: 29,
    location: 'Las Piñas, Metro Manila',
    contact_number: '+63 925 901 2345',
    fb_link: 'https://facebook.com/marites.soriano',
    years_of_experience: 3,
    work_history: [
      { employer: 'Quirino Memorial Medical Center', role: 'Nursing Aide', duration: '1 year', description: 'Assisted in pediatric ward with newborn and infant care.' },
      { employer: 'Tan Family', role: 'Caregiver', duration: '2 years', description: 'Full-time caregiver for a child with autism spectrum disorder.' },
    ],
    has_valid_id: true, has_nbi_clearance: false, has_barangay_clearance: true, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 580, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['Special Needs / Pediatric', 'Feeding & Meal Preparation', 'Companionship & Supervision', 'Light Housekeeping & Errands'],
  },
  {
    first_name: 'Eduardo', last_name: 'Flores',
    age: 52,
    location: 'Cagayan de Oro City, Misamis Oriental',
    contact_number: '+63 926 012 3456',
    fb_link: 'https://facebook.com/eduardo.flores.rn',
    years_of_experience: 25,
    work_history: [
      { employer: 'Northern Mindanao Medical Center', role: 'Charge Nurse', duration: '12 years', description: 'Supervised nursing staff in the surgical ward.' },
      { employer: 'Al-Rashid Family (Saudi Arabia)', role: 'Private Nurse', duration: '10 years', description: 'Provided exclusive nursing services for a high-profile family.' },
      { employer: 'Reyes Family', role: 'Home Care Nurse', duration: '3 years', description: 'Managed complex wound care and IV therapy for a post-surgical patient.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1800, pay_period: 'day' as const,
    availability: 'flexible' as const,
    skillNames: ['Wound & Bedsore Care', 'Injections & IV Therapy (Requires RN)', 'Catheter Care (Foley / IFC)', 'Medication Administration & Management', 'Post-Surgical / Orthopedic Recovery', 'Airway Management (Tracheostomy & Suctioning)', 'Vital Signs & Blood Sugar Monitoring'],
  },
  {
    first_name: 'Concepcion', last_name: 'Ramos',
    age: 36,
    location: 'Mandaue City, Cebu',
    contact_number: '+63 927 123 4560',
    fb_link: 'https://facebook.com/conce.ramos.caregiver',
    years_of_experience: 9,
    work_history: [
      { employer: 'Cebu Doctors\' University Hospital', role: 'Staff Nurse', duration: '4 years', description: 'Managed a mixed medical-surgical ward of 30 patients.' },
      { employer: 'Yamamoto Family (Japan)', role: 'Live-in Caregiver', duration: '5 years', description: 'Cared for two elderly family members simultaneously, one with Parkinson\'s and one post-stroke.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 950, pay_period: 'day' as const,
    availability: 'this_week' as const,
    skillNames: ['Stroke / Post-Stroke Care', 'General Elderly Care / Companionship', 'Medication Administration & Management', 'Feeding & Meal Preparation', 'Light Housekeeping & Errands'],
  },
  {
    first_name: 'Lovely', last_name: 'Torres',
    age: 23,
    location: 'Mandaluyong, Metro Manila',
    contact_number: '+63 928 234 5601',
    fb_link: 'https://facebook.com/lovely.torres.rn',
    years_of_experience: 1,
    work_history: [
      { employer: 'Cardinal Santos Medical Center', role: 'Graduate Nurse', duration: '1 year', description: 'Completed 1-year training rotation across medical, surgical, and pediatric wards.' },
    ],
    has_valid_id: true, has_nbi_clearance: false, has_barangay_clearance: false, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 480, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['Vital Signs & Blood Sugar Monitoring', 'Bathing, Grooming & Personal Hygiene', 'Lifting, Transferring & Repositioning', 'Companionship & Supervision'],
  },
  {
    first_name: 'Bernardo', last_name: 'Pascual',
    age: 44,
    location: 'General Santos City, South Cotabato',
    contact_number: '+63 929 345 6702',
    fb_link: 'https://facebook.com/bernardo.pascual.rn',
    years_of_experience: 18,
    work_history: [
      { employer: 'Mindanao Central Sanitarium', role: 'Psychiatric Nurse', duration: '6 years', description: 'Specialized in mental health patient management and behavioral therapy support.' },
      { employer: 'King Faisal Hospital (Saudi Arabia)', role: 'Staff Nurse', duration: '8 years', description: 'Served in multiple wards including ICU, oncology, and geriatrics.' },
      { employer: 'Lim Family', role: 'Private Nurse', duration: '4 years', description: 'Managed all medical needs for an elderly patient with multiple comorbidities.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1400, pay_period: 'day' as const,
    availability: 'flexible' as const,
    skillNames: ['General Elderly Care / Companionship', 'Cancer / Palliative / Hospice Care', 'Medication Administration & Management', 'Vital Signs & Blood Sugar Monitoring', 'Respiratory Support (Oxygen & Nebulizer)', 'Medical Escort / Hospital Watcher (Bantay)'],
  },
  {
    first_name: 'Shiela', last_name: 'Navarro',
    age: 27,
    location: 'Bacoor, Cavite',
    contact_number: '+63 930 456 7803',
    fb_link: 'https://facebook.com/shiela.navarro.caregiver',
    years_of_experience: 3,
    work_history: [
      { employer: 'Adventist Medical Center', role: 'Nursing Aide', duration: '1 year', description: 'Assisted in post-partum and newborn care unit.' },
      { employer: 'Gonzales Family', role: 'Caregiver', duration: '2 years', description: 'Provided specialized care for a diabetic elderly woman, including glucose monitoring and diet management.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: false, has_tesda_nc2: false,
    status: 'received' as const, pay_rate: 560, pay_period: 'day' as const,
    availability: 'immediate' as const,
    skillNames: ['Vital Signs & Blood Sugar Monitoring', 'Feeding & Meal Preparation', 'Medication Administration & Management', 'Bathing, Grooming & Personal Hygiene'],
  },
  {
    first_name: 'Ricardo', last_name: 'Villanueva',
    age: 39,
    location: 'Batangas City, Batangas',
    contact_number: '+63 931 567 8904',
    fb_link: 'https://facebook.com/ricardo.villanueva.rn',
    years_of_experience: 12,
    work_history: [
      { employer: 'Batangas Medical Center', role: 'Emergency Room Nurse', duration: '5 years', description: 'Handled trauma and emergency cases in a high-volume ER.' },
      { employer: 'Al-Saud Family (UAE)', role: 'Private Nurse', duration: '5 years', description: 'Full-time private nurse for a family patriarch with chronic renal failure.' },
      { employer: 'Reyes-Santos Family', role: 'Home Care Nurse', duration: '2 years', description: 'Managed dialysis preparation, IV therapy, and wound care for two patients.' },
    ],
    has_valid_id: true, has_nbi_clearance: true, has_barangay_clearance: true, has_tesda_nc2: true,
    status: 'processed' as const, pay_rate: 1100, pay_period: 'day' as const,
    availability: 'this_week' as const,
    skillNames: ['Injections & IV Therapy (Requires RN)', 'Catheter Care (Foley / IFC)', 'Wound & Bedsore Care', 'Medication Administration & Management', 'Airway Management (Tracheostomy & Suctioning)', 'Kidney Disease / Dialysis Patient', 'Medical Escort / Hospital Watcher (Bantay)'],
  },
] as const;

// ---------------------------------------------------------------------------
// Seed test
// ---------------------------------------------------------------------------

test.describe('Database Seed', () => {
  test('seed skill_definitions and caregiver profiles', async () => {
    // ── Step 1: Check if profiles already exist ─────────────────────────────
    const { count: existingCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .not('first_name', 'ilike', '__STRESS_TEST__%');

    if ((existingCount ?? 0) > 0) {
      console.log(`\n  [SEED] Database already has ${existingCount} non-test profiles. Skipping seed.`);
      console.log('  [SEED] To re-seed, manually delete existing profiles first.\n');
      return;
    }

    // ── Step 2: Seed skill_definitions if empty ──────────────────────────────
    const { count: skillCount } = await supabase
      .from('skill_definitions')
      .select('id', { count: 'exact', head: true });

    let skillMap: Record<string, number> = {};

    if ((skillCount ?? 0) === 0) {
      console.log('\n  [SEED] Seeding skill_definitions...');
      const { data: inserted, error } = await supabase
        .from('skill_definitions')
        .insert(SKILL_DEFS.map((s) => ({ category: s.category, name: s.name })))
        .select('id, name');

      expect(error).toBeNull();
      skillMap = Object.fromEntries((inserted ?? []).map((s: { id: number; name: string }) => [s.name, s.id]));
      console.log(`  [SEED] Inserted ${inserted?.length ?? 0} skill definitions.`);
    } else {
      console.log(`\n  [SEED] skill_definitions already has ${skillCount} rows. Loading...`);
      const { data: existing } = await supabase
        .from('skill_definitions')
        .select('id, name');
      skillMap = Object.fromEntries((existing ?? []).map((s: { id: number; name: string }) => [s.name, s.id]));
    }

    // ── Step 3: Insert profiles ──────────────────────────────────────────────
    console.log(`  [SEED] Inserting ${PROFILES.length} caregiver profiles...`);
    let successCount = 0;
    let errorCount = 0;

    for (const profile of PROFILES) {
      try {
        const {
          skillNames,
          status,
          pay_rate,
          pay_period,
          availability,
          has_valid_id,
          has_nbi_clearance,
          has_barangay_clearance,
          has_tesda_nc2,
          work_history,
          ...rest
        } = profile;

        const idempotency_key = randomBytes(32).toString('hex');

        const { data: created, error: insertError } = await supabase
          .from('submissions')
          .insert({
            ...rest,
            status,
            pay_rate,
            pay_period,
            availability,
            has_valid_id,
            has_nbi_clearance,
            has_barangay_clearance,
            has_tesda_nc2,
            work_history,
            valid_id_image_url: null,
            nbi_clearance_image_url: null,
            barangay_clearance_image_url: null,
            tesda_nc2_image_url: null,
            submitted_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            error_message: null,
            idempotency_key,
          })
          .select('id')
          .single();

        if (insertError) {
          console.log(`  [SEED] ✗ ${profile.first_name} ${profile.last_name}: ${insertError.message}`);
          errorCount++;
          continue;
        }

        // Assign skills
        const skillIds = skillNames
          .map((name) => skillMap[name])
          .filter((id): id is number => id !== undefined);

        if (skillIds.length > 0) {
          await supabase
            .from('caregiver_skills')
            .insert(skillIds.map((skill_id) => ({ submission_id: created!.id, skill_id })));
        }

        console.log(`  [SEED] ✓ ${profile.first_name} ${profile.last_name} (${profile.years_of_experience} yrs exp, ${skillIds.length} skills)`);
        successCount++;
      } catch (err) {
        console.log(`  [SEED] ✗ ${profile.first_name} ${profile.last_name}: ${err}`);
        errorCount++;
      }
    }

    console.log(`\n  [SEED] Done — ${successCount} profiles inserted, ${errorCount} errors.\n`);
    expect(errorCount).toBe(0);
    expect(successCount).toBe(PROFILES.length);

    // ── Step 4: Verify final counts ──────────────────────────────────────────
    const { count: finalCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .not('first_name', 'ilike', '__STRESS_TEST__%');

    expect(finalCount).toBe(PROFILES.length);
    console.log(`  [SEED] Verified: ${finalCount} profiles in database.\n`);
  });
});
