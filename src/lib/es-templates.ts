export interface ESBlock {
  id: string
  label: string
  category: 'core' | 'addon'
  template: string
  variables: string[]
}

export const ANNUAL_PM_BLOCKS: ESBlock[] = [
  {
    id: 'property_overview',
    label: 'Property Overview',
    category: 'core',
    template: 'SRC performed an annual preventive maintenance inspection of the roof system at {{property_address}}. The facility encompasses approximately {{square_footage}} square feet of {{system_description}} roofing, installed approximately {{roof_age}} years ago.',
    variables: ['property_address', 'square_footage', 'system_description', 'roof_age'],
  },
  {
    id: 'condition_rating',
    label: 'Overall Condition Rating',
    category: 'core',
    template: 'Based on our inspection, the roof system is in {{roof_rating}} condition.',
    variables: ['roof_rating'],
  },
  {
    id: 'deficiency_summary',
    label: 'Deficiency Summary',
    category: 'core',
    template: 'We identified {{deficiency_count}} maintenance deficiencies totaling an estimated ${{deficiency_budget_total}} in recommended repairs.',
    variables: ['deficiency_count', 'deficiency_budget_total'],
  },
  {
    id: 'capital_expense',
    label: 'Capital Expense Recommendation',
    category: 'core',
    template: 'The projected capital expense budget for roof replacement is ${{capital_expense_total}} (${{capital_expense_per_sqft}}/sqft), with a recommended replacement timeframe of {{replacement_year}}.',
    variables: ['capital_expense_total', 'capital_expense_per_sqft', 'replacement_year'],
  },
  {
    id: 'replacement_recommendation',
    label: 'Replacement Recommendation',
    category: 'addon',
    template: 'Due to the age, current conditions, and leak history, SRC recommends replacing this assembly within the next {{years_until_replacement}} years. The current roof system has exceeded its expected service life and continued maintenance repairs will become increasingly costly.',
    variables: ['years_until_replacement'],
  },
  {
    id: 'skylight_assessment',
    label: 'Skylight Assessment',
    category: 'addon',
    template: 'The property has {{skylight_count}} skylights that were inspected. {{skylight_recommendation}}',
    variables: ['skylight_count', 'skylight_recommendation'],
  },
  {
    id: 'drainage',
    label: 'Drainage Assessment',
    category: 'addon',
    template: 'Drainage is provided by {{drainage_description}}. {{drainage_notes}}',
    variables: ['drainage_description', 'drainage_notes'],
  },
  {
    id: 'flashing',
    label: 'Flashing & Penetrations',
    category: 'addon',
    template: 'Flashings at penetrations and perimeter details were inspected and found to be {{flashing_condition}}.',
    variables: ['flashing_condition'],
  },
  {
    id: 'repair_history',
    label: 'Previous Repair History',
    category: 'addon',
    template: '{{work_order_history_summary}}',
    variables: ['work_order_history_summary'],
  },
  {
    id: 'timeline',
    label: 'Recommended Timeline',
    category: 'addon',
    template: 'SRC recommends {{timeline_urgency}} action on the identified deficiencies to prevent further deterioration of the roof system.',
    variables: ['timeline_urgency'],
  },
  {
    id: 'custom',
    label: 'Custom Note',
    category: 'addon',
    template: '',
    variables: [],
  },
]

export function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    if (val === undefined || val === null) return `[${key}]`
    if (typeof val === 'number') return val.toLocaleString()
    return String(val)
  })
}
