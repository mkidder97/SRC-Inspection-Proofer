-- Add 'repair_pricing' to reference_library entry_type constraint
ALTER TABLE public.reference_library DROP CONSTRAINT IF EXISTS reference_library_entry_type_check;
ALTER TABLE public.reference_library ADD CONSTRAINT reference_library_entry_type_check CHECK (entry_type IN (
  'cost_table', 'prohibited_phrase', 'approved_report', 'es_rules', 'repair_pricing'
));
