import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { InlineField } from '@/components/InlineField'
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants'
import { REPLACEMENT_PRICING } from '@/lib/pricing-constants'
import type { ClientType } from '@/lib/constants'
import { toast } from 'sonner'

const SKYLIGHT_PRICES: Record<string, { label: string; price: number }> = {
  '4x4': { label: '4×4 Dome', price: 1045 },
  '4x8': { label: '4×8 Dome', price: 2035 },
  '4x8_meltout': { label: '4×8 Melt-Out', price: 4500 },
  '4x8_spring': { label: '4×8 Spring-Loaded', price: 5500 },
}

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
    skylight_dome_type: '' as string,
    has_leak_history: false,
    special_notes: '',
  })
  const [confirming, setConfirming] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Load extracted data and auto-prefill skylight count from inspection findings
  useEffect(() => {
    if (!report?.extracted_data) return
    const ext = report.extracted_data as Record<string, any>
    setData(ext)

    // Auto-prefill skylight count from inspection findings text
    const findings = ext.inspection_findings || ext.executive_summary || ''
    const skylightMatch = findings.match(/(\w+)\s*\((\d+)\)\s*(?:curb\s*mounted\s*)?skylight/i)
    if (skylightMatch) {
      const count = parseInt(skylightMatch[2])
      if (count > 0) {
        setContext(prev => ({ ...prev, skylight_count: count, skylight_dome_type: prev.skylight_dome_type || '4x4' }))
      }
    }
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

  // Compute SRC recommended cap ex price
  const capExEstimate = useMemo(() => {
    const sqft = data.square_footage
    const capType = data.capital_expense_type || ''
    if (!sqft || !context.client_type) return null

    const isRecover = /recover/i.test(capType)
    const isTearoff = /tear.?off/i.test(capType)
    const desc = data.system_description || ''
    const isBURGravel = /bur.{0,10}gravel|gravel/i.test(desc)
    const isEPDM = /epdm/i.test(desc)
    const isInfill = /infill.{0,10}metal/i.test(capType)

    let basePsf: number | null = null
    if (context.client_type === 'prologis_tx') {
      const p = REPLACEMENT_PRICING.prologis_texas
      if (isRecover && isBURGravel) basePsf = p.recover_bur_gravel
      else if (isRecover) basePsf = p.recover_tpo
      else if (isTearoff) basePsf = p.tearoff_two_new_tpo
      else if (isInfill) basePsf = p.tpo_infill_over_metal
      else if (isEPDM) basePsf = p.epdm_membrane_swap
    } else if (context.client_type === 'eastgroup_houston') {
      const p = REPLACEMENT_PRICING.non_prologis_texas
      if (isRecover) basePsf = p.eastgroup_hou_recover
      else if (isTearoff) basePsf = p.eastgroup_hou_tearoff
    } else if (context.client_type === 'non_prologis_tx') {
      const p = REPLACEMENT_PRICING.non_prologis_texas
      if (isRecover && isBURGravel) basePsf = p.recover_bur_gravel
      else if (isRecover) basePsf = p.recover_tpo_bur_smooth_modbit
      else if (isTearoff) basePsf = p.tearoff_two_new_tpo
      else if (isInfill) basePsf = p.tpo_infill_over_metal
      else if (isEPDM) basePsf = p.epdm_membrane_swap
    } else {
      const p = REPLACEMENT_PRICING.non_prologis_general
      if (isRecover && isBURGravel) basePsf = p.recover_bur_gravel
      else if (isRecover) basePsf = p.recover_tpo_bur_smooth_modbit
      else if (isTearoff) basePsf = p.tearoff_two_roofs
      else if (isInfill) basePsf = p.tpo_infill_over_metal
      else if (isEPDM) basePsf = p.epdm_membrane_swap
    }

    if (!basePsf) return null

    let economiesAdj = 0
    if (sqft < 100000) economiesAdj = ((100000 - sqft) / 25000) * 1.0
    else if (sqft >= 200000) economiesAdj = -1.0

    const adjustedPsf = basePsf + economiesAdj
    const membraneTotal = Math.round(adjustedPsf * sqft)

    const skylightPrice = SKYLIGHT_PRICES[context.skylight_dome_type]?.price ?? 0
    const skylightAdder = context.skylight_count > 0 && skylightPrice > 0 ? context.skylight_count * skylightPrice : 0
    const grandTotal = membraneTotal + skylightAdder

    return { basePsf, economiesAdj, adjustedPsf, membraneTotal, skylightAdder, grandTotal, skylightPrice }
  }, [data.square_footage, data.capital_expense_type, data.system_description, context.client_type, context.skylight_count, context.skylight_dome_type])

  async function handleConfirm() {
    if (!context.client_type) {
      toast.error('Please select a client type before confirming')
      return
    }
    setConfirming(true)
    try {
      const { error: updateErr } = await supabase.from('reports').update({
        corrected_data: data,
        proofer_context: context,
        status: 'confirmed',
      }).eq('id', id!)
      if (updateErr) throw updateErr

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

  const deficiencies = data.deficiencies || []

  return (
    <div className="h-[calc(100vh-3rem)] flex">
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
          {/* Property */}
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

          {/* Roof System */}
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

          {/* Capital Expense — with SRC recommendation */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Capital Expense</h2>
            <div className="space-y-0.5">
              <InlineField label="Expense Type" value={data.capital_expense_type} onChange={v => updateField('capital_expense_type', v)} />
              <InlineField label="Report Total ($)" value={data.capital_expense_total} onChange={v => updateField('capital_expense_total', v)} type="number" />
              <InlineField label="Report Per Sqft ($)" value={data.capital_expense_per_sqft} onChange={v => updateField('capital_expense_per_sqft', v)} type="number" />
              <InlineField label="Replacement Year" value={data.replacement_year} onChange={v => updateField('replacement_year', v)} type="number" />
            </div>

            {/* SRC Recommended Estimate */}
            {capExEstimate ? (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                <h3 className="text-xs font-semibold text-green-800 mb-2">SRC Recommended Estimate</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-green-700">
                    <span>Membrane ({(data.square_footage || 0).toLocaleString()} sqft × ${capExEstimate.adjustedPsf.toFixed(2)})</span>
                    <span className="font-mono font-medium">${capExEstimate.membraneTotal.toLocaleString()}</span>
                  </div>
                  {capExEstimate.skylightAdder > 0 ? (
                    <div className="flex justify-between text-green-700">
                      <span>Skylights ({context.skylight_count} × ${capExEstimate.skylightPrice.toLocaleString()})</span>
                      <span className="font-mono font-medium">${capExEstimate.skylightAdder.toLocaleString()}</span>
                    </div>
                  ) : context.skylight_count === 0 ? (
                    <div className="text-amber-600 italic">Does not include skylights — enter count below if applicable</div>
                  ) : null}
                  <hr className="border-green-200" />
                  <div className="flex justify-between text-green-900 font-semibold">
                    <span>SRC Recommended Total</span>
                    <span className="font-mono">${capExEstimate.grandTotal.toLocaleString()}</span>
                  </div>
                  {data.capital_expense_total && (
                    <div className="flex justify-between text-gray-500 pt-1">
                      <span>Report states</span>
                      <span className="font-mono">${data.capital_expense_total.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : context.client_type ? (
              <div className="mt-3 rounded-lg bg-gray-50 border p-3 text-xs text-gray-500 italic">
                Select expense type and ensure square footage is filled to see SRC recommendation
              </div>
            ) : null}
          </section>

          <hr className="border-gray-100" />

          {/* Deficiencies — full descriptions, no truncation */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Deficiencies ({deficiencies.length})
            </h2>
            {deficiencies.length > 0 ? (
              <div className="space-y-2">
                {deficiencies.map((d: any, i: number) => (
                  <div key={i} className="rounded-lg border p-3 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">#{d.number}</span>
                        <span className="text-xs font-semibold text-gray-800">{d.category}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs flex-shrink-0">
                        <span className="text-gray-500">Qty: <strong>{d.quantity ?? '—'}</strong></span>
                        <span className="font-mono font-semibold text-gray-800">{d.cost ? `$${d.cost.toLocaleString()}` : '—'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{d.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No deficiencies extracted</p>
            )}
          </section>

          <hr className="border-gray-100" />

          {/* Proofer Context */}
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
                      onChange={e => setContext(prev => ({ ...prev, skylight_dome_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select...</option>
                      {Object.entries(SKYLIGHT_PRICES).map(([key, { label, price }]) => (
                        <option key={key} value={key}>{label} (${price.toLocaleString()}/ea)</option>
                      ))}
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

          {/* Confirm */}
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
