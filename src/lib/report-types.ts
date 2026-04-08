// Matches actual SRC annual inspection report structure

export interface ExtractedReport {
  // Property info
  property_address: string | null
  building_identifier: string | null
  client_name: string | null
  property_manager: string | null
  pm_phone: string | null
  market: string | null

  // Roof details
  roof_area_sqft: number | null
  roof_system: string | null
  system_description: string | null
  lttr_value: number | null
  perimeter_detail: string | null
  flashing_detail: string | null
  drainage_system: string | null
  manufacturer: string | null
  warranty: boolean | null
  warranty_expiration: string | null
  installing_contractor: string | null
  repairing_contractor: string | null

  // Roof life overview
  roof_age_years: number | null
  installed_year: number | null
  roof_rating: string | null
  replacement_year: number | null
  capital_expense_total: number | null
  capital_expense_per_sqft: number | null
  maintenance_budget_total: number | null
  maintenance_budget_per_sqft: number | null

  // Inspection
  inspection_date: string | null
  inspector_name: string | null
  service_type: string | null

  // Findings narrative
  inspection_findings: string | null

  // Capital expense projection
  capital_expense_year: number | null
  capital_expense_description: string | null
  capital_expense_notes: string | null

  // Work order history
  work_order_period: string | null
  work_order_leaks: string | null
  work_order_deficiencies: string | null

  // Deficiencies (preventative maintenance line items)
  deficiencies: Deficiency[]

  // Sections found in document
  sections_present: string[]

  // Extraction confidence
  confidence: number
}

export interface Deficiency {
  number: number
  category: string
  description: string
  cost: number
}

export interface Flag {
  id: string
  report_id: string
  field_address: string
  field_label: string
  flag_type: string
  current_value: string | null
  suggested_value: string | null
  reason: string
  confidence: number
  status: 'open' | 'accepted' | 'edited' | 'dismissed'
  resolution_value: string | null
  dismiss_reason: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}
