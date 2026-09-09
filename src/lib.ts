import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export type Role = 'doctor' | 'patient';
export type Profile = { id: string; role: Role; display_name: string };
export type Doctor = { id: string; user_id: string; doctor_name: string; specialization: string | null; hospital: string; phone: string | null };
export type Patient = { id: string; user_id: string; patient_id: string; full_name: string; age: number; gender: string; date_of_birth: string | null; phone: string; email: string; address: string | null; blood_group: string | null; emergency_contact: string | null; qr_code: string };
export type MedicalRecord = { id: string; patient_id: string; doctor_id: string; visit_date: string; diagnosis: string; symptoms: string | null; medicines: string | null; dosage: string | null; duration: string | null; prescription: string | null; medical_notes: string | null; follow_up_date: string | null; created_at: string; doctors?: Pick<Doctor, 'doctor_name' | 'hospital' | 'specialization'> };

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data as Profile | null;
}
export function formatDate(date: string | null | undefined): string { return date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
export function initials(name: string): string { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
