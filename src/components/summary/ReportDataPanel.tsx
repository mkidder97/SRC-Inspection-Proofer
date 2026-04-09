interface ReportDataPanelProps {
  data: Record<string, any>
  context: Record<string, any>
  onInsertReference: (text: string) => void
}

export function ReportDataPanel({ data, context, onInsertReference }: ReportDataPanelProps) {
  const deficiencies = data.deficiencies || []

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Property */}
        <Section title="Property">
          <DataRow label="Address" value={data.property_address} />
          <DataRow label="Client" value={data.client_name} />
          <DataRow label="Market" value={data.market} />
          <DataRow label="Inspection" value={data.inspection_date} />
        </Section>

        {/* Roof System */}
        <Section title="Roof System">
          <DataRow label="Type" value={data.system_description || data.roof_system_type} />
          <DataRow label="Area" value={data.square_footage ? `${data.square_footage.toLocaleString()} sqft` : null} />
          <DataRow label="Age" value={data.roof_age ? `${data.roof_age} years` : null} />
          <DataRow label="Rating" value={data.roof_rating} />
          <DataRow label="Install Year" value={data.installed_year} />
        </Section>

        {/* Capital Expense */}
        <Section title="Capital Expense">
          <DataRow label="Total" value={data.capital_expense_total ? `$${data.capital_expense_total.toLocaleString()}` : null} />
          <DataRow label="Per Sqft" value={data.capital_expense_per_sqft ? `$${data.capital_expense_per_sqft}` : null} />
          <DataRow label="Type" value={data.capital_expense_type} />
          <DataRow label="Year" value={data.replacement_year} />
        </Section>

        {/* Proofer Context */}
        {context && Object.keys(context).length > 0 && (
          <Section title="Proofer Context">
            {context.skylight_count > 0 && <DataRow label="Skylights" value={`${context.skylight_count} (${context.skylight_dome_type || 'unspecified'})`} />}
            {context.has_leak_history && <DataRow label="Leak History" value="Yes" />}
            {context.special_notes && <DataRow label="Notes" value={context.special_notes} />}
          </Section>
        )}

        {/* Deficiencies */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Deficiencies ({deficiencies.length})
          </h4>
          {deficiencies.length > 0 ? (
            <div className="space-y-1">
              {deficiencies.map((d: any, i: number) => (
                <button
                  key={i}
                  onClick={() => onInsertReference(
                    `Deficiency ${d.number} (${d.category}): ${d.description} — $${(d.cost || 0).toLocaleString()}`
                  )}
                  className="w-full text-left rounded p-2 text-xs bg-white border border-gray-150 hover:border-blue-300 hover:shadow-sm transition-all"
                  title="Click to insert reference"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">#{d.number} {d.category}</span>
                    <span className="font-mono text-gray-500">${(d.cost || 0).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-400 truncate mt-0.5">{d.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No deficiencies</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}
