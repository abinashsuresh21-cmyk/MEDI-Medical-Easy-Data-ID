/*
# Harden MEDI API permissions

1. Security Changes
- Remove anonymous API access to all MEDI application tables.
- Remove direct API execution of internal trigger helper functions from anonymous and authenticated roles.
- Keep signed-in application access through the RLS policies already defined.

2. Important Notes
- Signup-triggered profile creation and patient ID generation continue to work because database triggers execute with their owner privileges.
- No patient, doctor, or medical record data is available through the anonymous API role.
*/

revoke all on table public.profiles, public.doctors, public.patients, public.medical_records from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_medi_patient_id() from anon, authenticated;