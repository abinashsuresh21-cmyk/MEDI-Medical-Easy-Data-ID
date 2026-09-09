/*
# Allow related doctor display information

1. Modified Security
- Replace the doctor read policy so authenticated users can read doctor directory rows needed to label medical records.
- Doctors retain access to their own doctor profile; patients can see doctor identity details attached to records they are allowed to read.

2. Privacy Notes
- The doctors table contains professional identity and workplace details only.
- Medical record access remains controlled by the medical_records policies and is unchanged.
*/

drop policy if exists "doctors_select_own" on public.doctors;
create policy "doctors_select_related" on public.doctors for select to authenticated using (
  auth.uid() = user_id
  or exists (
    select 1 from public.medical_records mr
    join public.patients p on p.id = mr.patient_id
    where mr.doctor_id = public.doctors.id and p.user_id = auth.uid()
  )
);