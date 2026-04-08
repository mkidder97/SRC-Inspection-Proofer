export const REPORT_STATUSES = [
  'uploaded',
  'extracting',
  'extracted',
  'proofing',
  'proofed',
  'reviewing',
  'approved',
  'completed',
  'failed',
] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const FLAG_TYPES = [
  'pricing',
  'missing_section',
  'completeness',
  'consistency',
  'prohibited_language',
  'executive_summary',
] as const

export type FlagType = (typeof FLAG_TYPES)[number]

export const FLAG_STATUSES = ['open', 'accepted', 'edited', 'dismissed'] as const

export type FlagStatus = (typeof FLAG_STATUSES)[number]

export const SERVICE_TYPES = [
  'annual_pm',
  'due_diligence',
  'survey',
  'storm',
  'construction_management',
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  annual_pm: 'Annual PM',
  due_diligence: 'Due Diligence',
  survey: 'Survey',
  storm: 'Storm',
  construction_management: 'Construction Management',
}

export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  pricing: 'Pricing',
  missing_section: 'Missing Sections',
  completeness: 'Completeness',
  consistency: 'Consistency',
  prohibited_language: 'Prohibited Language',
  executive_summary: 'Executive Summary',
}

export const STATUS_LABELS: Record<ReportStatus, string> = {
  uploaded: 'Uploaded',
  extracting: 'Extracting...',
  extracted: 'Extracted',
  proofing: 'Proofing...',
  proofed: 'Ready for Review',
  reviewing: 'In Review',
  approved: 'Approved',
  completed: 'Completed',
  failed: 'Failed',
}
