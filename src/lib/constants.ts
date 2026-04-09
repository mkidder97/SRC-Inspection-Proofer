export const SERVICE_TYPES = ['annual_pm', 'due_diligence', 'survey', 'storm', 'construction_management'] as const
export type ServiceType = typeof SERVICE_TYPES[number]

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  annual_pm: 'Annual PM',
  due_diligence: 'Due Diligence',
  survey: 'Survey',
  storm: 'Storm',
  construction_management: 'Construction Management',
}

export const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  extracting: 'Extracting',
  extracted: 'Extracted',
  confirmed: 'Confirmed',
  proofing: 'Proofing',
  proofed: 'Proofed',
  reviewing: 'Reviewing',
  approved: 'Approved',
  completed: 'Completed',
  failed: 'Failed',
}

export const FLAG_TYPE_LABELS: Record<string, string> = {
  pricing: 'Pricing',
  missing_section: 'Missing Section',
  completeness: 'Completeness',
  consistency: 'Consistency',
  prohibited_language: 'Prohibited Language',
  capital_expense: 'Capital Expense',
  deficiency_pricing: 'Deficiency Pricing',
  math_error: 'Math Error',
  findings_consistency: 'Findings Consistency',
}

export const CLIENT_TYPES = ['prologis_tx', 'non_prologis_tx', 'eastgroup_houston', 'non_prologis_general'] as const
export type ClientType = typeof CLIENT_TYPES[number]

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  prologis_tx: 'Prologis Texas',
  non_prologis_tx: 'Non-Prologis Texas',
  eastgroup_houston: 'EastGroup Houston',
  non_prologis_general: 'Non-Prologis (General)',
}
