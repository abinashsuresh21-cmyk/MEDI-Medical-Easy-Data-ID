/*
# Add frequency column to medical records

1. Modified Tables
- `medical_records`: add nullable `frequency` text column for structured prescription frequency (e.g. "Twice daily", "Every 8 hours").

2. Notes
- Additive change only; existing records and all current functionality are unaffected.
- The column is nullable so old records without frequency remain valid.
*/

alter table public.medical_records add column if not exists frequency text;

comment on column public.medical_records.frequency is 'How often a prescribed medicine should be taken, e.g. Twice daily';