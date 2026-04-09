import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { InlineField } from '@/components/InlineField'
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ClientType } from '@/lib/constants'
import { toast } from 'sonner'

export default function ExtractionReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const [data, setData] = useState<Record<string, any>>({})
  const [context, setContext] = useState({
    client_type: '' as ClientType | '',
    skylight_count: 0,
    skylight_dome_type: '' as '4x4' | '4x8' | '',
    has_leak_history: false,
    special_notes: '',
  })
  const [confirming, setConfirming] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (report?.extracted_data) setData(report.extracted_data as Record<string, any>)
  }, [report?.extracted_data])

  useEffect(() => {
    if (!report?.original_storage_path) return
    supabase.storage
      .from('report-uploads')
      .createSignedUrl(report.original_storage_path, 3600)
      .then(({ data: d }) => { if (d?.signedUrl) setPdfUrl(d.signedUrl) })
  }, [report?.original_storage_path])

  function updateField(key: string, value: any) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  async function handleConfirm() {
    if (!context.client_type) {
      toast.error('Please select a client type before confirming')
      return
    }
    setConfirming(true)
    try {
      // Save corrected data + proofer context
      const { error: updateErr } = await supabase.from('reports').update({
        corrected_data: data,
        proofer_context: context,
        status: 'confirmed',
      }).eq('id', id!)
      if (updateErr) throw updateErr

      // Run proofing
      toast.info('Running proofing passes...')
      const { error: proofErr } = await supabase.functions.invoke('proof-report', { body: { reportId: id } })
      if (proofErr) throw proofErr

      toast.success('Proofing complete')
      navigate(`/reports/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm')
    } finally {
      setConfirming(false)
    }
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading report data...</div>
  if (!report) return <div className="p-8 text-center text-gray-500">Report not found</div>

  const extracted = report.extracted_data as Record<string, any> | null
  const deficiencies = data.deficiencies || []

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left: PDF */}
      <div className="w-[58%] bg-gray-100 border-r">
        {pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-full" title="Report PDF" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading PDF...</div>
        )}
      </div>

      {/* Right: Data Review */}
      <div className="w-[42%] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-3 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Review Extracted Data</h1>
              <p className="text-xs text-gray-500 mt-0.5">Verify AI extraction and fill in missing context</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {SERVICE_TYPE_LABELS[report.service_type as keyof typeof SERVICE_TYPE_LABELS] || report.service_type}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Section A: Extracted Data */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Property Information</h2>
            <div className="space-y-0.5">
              <InlineField label="Property Address" value={data.property_address} onChange={v => updateField('property_address', v)} />
              <InlineField label="Client Name" value={data.client_name} onChange={v => updateField('client_name', v)} />
              <InlineField label="Market / City" value={data.market} onChange={v => updateField('market', v)} />
              <InlineField label="Inspection Date" value={data.inspection_date} onChange={v => updateField('inspection_date', v)} />
              <InlineField label="Inspector Name" value={data.inspector_name} onChange={v => updateField('inspector_name', v)} />
            </div>
          </section>

          <hr className="border-gray-100" />

          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Roof System</h2>
            <div className="space-y-0.5">
              <InlineField label="System Description" value={data.system_description} onChange={v => updateField('system_description', v)}
                type="select" options={[
                  { value: 'BUR with Gravel Surface', label: 'BUR with Gravel Surface' },
                  { value: 'TPO Membrane', label: 'TPO Membrane' },
                  { value: 'EPDM Membrane', label: 'EPDM Membrane' },
                  { value: 'BUR Cap Sheet / Modified Bitumen', label: 'BUR Cap Sheet / Modified Bitumen' },
                ]} />
              <InlineField label="Square Footage" value={data.square_footage} onChange={v => updateField('square_footage', v)} type="number" />
              <InlineField label="Roof Age (years)" value={data.roof_age} onChange={v => updateField('roof_age', v)} type="number" />
              <InlineField label="Installed Year" value={data.installed_year} onChange={v => updateField('installed_year', v)} type="number" />
              <InlineField label="Roof Rating" value={data.roof_rating} onChange={v => updateField('roof_rating', v)}
                type="select" options={[
                  { value: 'Good', label: 'Good' },
                  { value: 'Serviceable', label: 'Serviceable' },
                  { value: 'Poor', label: 'Poor' },
                  { value: 'Needs Replacement', label: 'Needs Replacement' },
                ]} />
            </div>
          </section>

          <hr className="border-gray-100" />

          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Capital Expense</h2>
            <div className="space-y-0.5">
              <InlineField label="Expense Type" value={data.capital_expense_type} onChange={v => updateField('capital_expense_type', v)} />
              <InlineField label="Total ($)" value={data.capital_expense_total} onChange={v => updateField('capital_expense_total', v)} type="number" />
              <InlineField label="Per Sqft ($)" value={data.capital_expense_per_sqft} onChange={v => updateField('capital_expense_per_sqft', v)} type="number" />
              <InlineField label="Replacement Year" value={data.replacement_year} onChange={v => updateField('replacement_year', v)} type="number" />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Deficiencies table */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Deficiencies ({deficiencies.length})
            </h2>
            {deficiencies.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Category</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deficiencies.map((d: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-500">{d.number}</td>
                        <td className="px-3 py-2 font-medium">{d.category}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{d.description}</td>
                        <td className="px-3 py-2 text-right">{d.quantity ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{d.cost ? `$${d.cost.toLocaleString()}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No deficiencies extracted</p>
            )}
          </section>

          <hr className="border-gray-100" />

          {/* Section B: Proofer Context */}
          <section>
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Proofer Context</h2>
            <p className="text-xs text-gray-400 mb-3">Information the PDF doesn't contain — you provide it</p>

            <div className="space-y-4 bg-blue-50/50 rounded-lg p-4 border border-blue-100">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Type <span className="text-red-500">*</span></label>
                <select
                  value={context.client_type}
                  onChange={e => setContext(prev => ({ ...prev, client_type: e.target.value as ClientType }))}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="">Select client type...</option>
                  {CLIENT_TYPES.map(ct => (
                    <option key={ct} value={ct}>{CLIENT_TYPE_LABELS[ct]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Skylight Count</label>
                  <input
                    type="number"
                    min={0}
                    value={context.skylight_count}
                    onChange={e => setContext(prev => ({ ...prev, skylight_count: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                {context.skylight_count > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dome Type</label>
                    <select
                      value={context.skylight_dome_type}
                      onChange={e => setContext(prev => ({ ...prev, skylight_dome_type: e.target.value as '4x4' | '4x8' | '' }))}
                      className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select...</option>
                      <option value="4x4">4×4 ($1,045/ea)</option>
                      <option value="4x8">4×8 ($2,035/ea)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Has Leak History?</label>
                <button
                  type="button"
                  onClick={() => setContext(prev => ({ ...prev, has_leak_history: !prev.has_leak_history }))}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${context.has_leak_history ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${context.has_leak_history ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-gray-500">{context.has_leak_history ? 'Yes' : 'No'}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Special Notes</label>
                <textarea
                  value={context.special_notes}
                  onChange={e => setContext(prev => ({ ...prev, special_notes: e.target.value }))}
                  placeholder="Any additional context for the proofer..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </section>

          {/* Action buttons */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={handleConfirm}
              disabled={confirming || !context.client_type}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {confirming ? 'Running proofing...' : 'Confirm & Run Proofing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
