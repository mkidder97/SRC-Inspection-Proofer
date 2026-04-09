-- Proofer workbench: context fields, ES draft, confirmed status

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS proofer_context jsonb DEFAULT '{}';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS executive_summary_draft text DEFAULT '';

-- Update status to include 'confirmed' between extracted and proofing
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'uploaded', 'extracting', 'extracted', 'confirmed', 'proofing', 'proofed',
  'reviewing', 'approved', 'completed', 'failed'
));

-- Add es_template entry type to reference_library
ALTER TABLE public.reference_library DROP CONSTRAINT IF EXISTS reference_library_entry_type_check;
ALTER TABLE public.reference_library ADD CONSTRAINT reference_library_entry_type_check CHECK (entry_type IN (
  'cost_table', 'prohibited_phrase', 'approved_report', 'es_rules', 'repair_pricing', 'es_template'
));
