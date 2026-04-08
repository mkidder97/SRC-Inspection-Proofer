-- Add new columns and update constraints for 6-pass proofing

-- Add severity and pass_number columns
ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS severity text DEFAULT 'warning';
ALTER TABLE public.flags ADD COLUMN IF NOT EXISTS pass_number integer;

-- Make confidence nullable (math checks have no confidence score)
ALTER TABLE public.flags ALTER COLUMN confidence DROP NOT NULL;

-- Drop the old flag_type check constraint and add expanded one
ALTER TABLE public.flags DROP CONSTRAINT IF EXISTS flags_flag_type_check;
ALTER TABLE public.flags ADD CONSTRAINT flags_flag_type_check CHECK (flag_type IN (
  'pricing', 'missing_section', 'completeness', 'consistency',
  'prohibited_language', 'executive_summary',
  'capital_expense', 'deficiency_pricing', 'math_error',
  'findings_consistency', 'photo_validation'
));
