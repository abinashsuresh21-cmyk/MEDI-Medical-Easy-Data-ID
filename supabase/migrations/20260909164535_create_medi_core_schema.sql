/*
# MEDI core schema and security

1. New Tables
- `profiles`: one row per authenticated account, with immutable role (`doctor` or `patient`) and display name.
- `doctors`: doctor-specific professional details linked to an auth account.
- `patients`: patient identity and personal details linked to an auth account, with a generated unique MEDI Patient ID and QR payload.
- `medical_records`: doctor-authored visits linked to a patient and doctor.

2. Supporting Objects
- `medi_patient_id_seq`: sequence for human-readable MEDI IDs.
- `handle_new_user`: trigger function that creates a profile after signup and reads role/name from signup metadata.
- `set_medi_patient_id`: trigger function that assigns a unique MEDI-YYYY-NNNNN identifier.

3. Security
- RLS enabled on every application table.
- Patients can read only their own profile and medical records.
- Doctors can read patient profiles and records needed for care, and can create/update only records they authored.
- Profiles expose only the signed-in user's own row and do not allow role edits.
- No policy permits a patient to write doctor-owned medical data.

4. Important Notes
- The QR payload is only the MEDI Patient ID; it contains no clinical or contact information.
- Auth passwords remain inside Supabase Auth and are never stored in application tables.
*/

create sequence if not exists public.medi_patient_id_seq;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, role text not null check (role in ('doctor', 'patient')), display_name text not null, created_at timestamptz not null default now());
create table if not exists public.doctors (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade, doctor_name text not null, specialization text, hospital text not null, phone text, created_at timestamptz not null default now());
create table if not exists public.patients (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade, patient_id text not null unique, full_name text not null, age integer not null check (age >= 0 and age <= 130), gender text not null, date_of_birth date, phone text not null, email text not null, address text, blood_group text, emergency_contact text, qr_code text not null unique, created_at timestamptz not null default now());
create table if not exists public.medical_records (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete cascade, doctor_id uuid not null references public.doctors(id) on delete restrict, visit_date date not null default current_date, diagnosis text not null, symptoms text, medicines text, dosage text, duration text, prescription text, medical_notes text, follow_up_date date, created_at timestamptz not null default now());
create index if not exists patients_patient_id_idx on public.patients(patient_id);
create index if not exists medical_records_patient_idx on public.medical_records(patient_id, visit_date desc);
create index if not exists medical_records_doctor_idx on public.medical_records(doctor_id, visit_date desc);

create or replace function public.set_medi_patient_id() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.patient_id is null or new.patient_id = '' then new.patient_id := 'MEDI-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.medi_patient_id_seq')::text, 5, '0'); end if; if new.qr_code is null or new.qr_code = '' then new.qr_code := new.patient_id; end if; return new; end; $$;
drop trigger if exists patients_set_medi_id on public.patients;
create trigger patients_set_medi_id before insert on public.patients for each row execute function public.set_medi_patient_id();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, role, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'role', 'patient'), coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.medical_records enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "doctors_select_own" on public.doctors;
create policy "doctors_select_own" on public.doctors for select to authenticated using (auth.uid() = user_id);
drop policy if exists "doctors_insert_own" on public.doctors;
create policy "doctors_insert_own" on public.doctors for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor'));
drop policy if exists "doctors_update_own" on public.doctors;
create policy "doctors_update_own" on public.doctors for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "patients_select_self_or_doctor" on public.patients;
create policy "patients_select_self_or_doctor" on public.patients for select to authenticated using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor'));
drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own" on public.patients for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'patient'));
drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own" on public.patients for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "records_select_patient_or_doctor" on public.medical_records;
create policy "records_select_patient_or_doctor" on public.medical_records for select to authenticated using (exists (select 1 from public.patients p where p.id = public.medical_records.patient_id and p.user_id = auth.uid()) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'doctor'));
drop policy if exists "records_insert_doctor" on public.medical_records;
create policy "records_insert_doctor" on public.medical_records for insert to authenticated with check (exists (select 1 from public.doctors d where d.id = public.medical_records.doctor_id and d.user_id = auth.uid()));
drop policy if exists "records_update_author_doctor" on public.medical_records;
create policy "records_update_author_doctor" on public.medical_records for update to authenticated using (exists (select 1 from public.doctors d where d.id = public.medical_records.doctor_id and d.user_id = auth.uid())) with check (exists (select 1 from public.doctors d where d.id = public.medical_records.doctor_id and d.user_id = auth.uid()));
drop policy if exists "records_delete_author_doctor" on public.medical_records;
create policy "records_delete_author_doctor" on public.medical_records for delete to authenticated using (exists (select 1 from public.doctors d where d.id = public.medical_records.doctor_id and d.user_id = auth.uid()));

grant usage, select on sequence public.medi_patient_id_seq to authenticated;
grant select on public.profiles, public.doctors, public.patients, public.medical_records to authenticated;
grant insert, update on public.doctors, public.patients to authenticated;
grant insert, update, delete on public.medical_records to authenticated;