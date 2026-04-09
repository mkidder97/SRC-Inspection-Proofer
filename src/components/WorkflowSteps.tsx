const STEPS = [
  { key: 'upload', label: 'Upload', path: '/upload' },
  { key: 'review', label: 'Review Data', path: null },
  { key: 'flags', label: 'Flags', path: null },
  { key: 'summary', label: 'Summary', path: null },
]

interface WorkflowStepsProps {
  current: string
  reportId?: string
}

export function WorkflowSteps({ current, reportId }: WorkflowStepsProps) {
  const currentIdx = STEPS.findIndex(s => s.key === current)

  return (
    <div className="flex items-center gap-1 px-5 py-2.5 bg-white border-b">
      {STEPS.map((step, i) => {
        const completed = i < currentIdx
        const active = step.key === current
        const href = step.key === 'upload' ? '/upload'
          : step.key === 'review' && reportId ? `/reports/${reportId}/review`
          : step.key === 'flags' && reportId ? `/reports/${reportId}`
          : step.key === 'summary' && reportId ? `/reports/${reportId}/summary`
          : null

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && <div className={`w-8 h-px mx-1 ${completed ? 'bg-blue-400' : 'bg-gray-200'}`} />}
            {href && (completed || active) ? (
              <a
                href={href}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  completed ? 'text-green-700 hover:bg-green-50' :
                  'text-gray-400'
                }`}
              >
                {completed && <span className="text-green-500">✓</span>}
                {step.label}
              </a>
            ) : (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                active ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                completed ? 'text-green-700' :
                'text-gray-400'
              }`}>
                {completed && <span className="text-green-500">✓</span>}
                {step.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
