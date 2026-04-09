import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useReportFlags } from '@/hooks/useReportFlags'
import { FLAG_TYPE_LABELS, SERVICE_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'
import { toast } from 'sonner'

export default function ReportReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { flags, report, flagsLoading, reportLoading, resolveFlag, totalFlags, resolvedCount } = useReportFlags(id)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!report?.original_storage_path) return
    supabase.storage
      .from('report-uploads')
      .createSignedUrl(report.original_storage_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setPdfUrl(data.signedUrl) })
  }, [report?.original_storage_path])

  const exportCorrections = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('export-corrections', { body: { reportId: id } })
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      const extracted = report?.extracted_data as Record<string, any> | null
      const address = (extracted?.property_address as string) || 'report'
      const date = (extracted?.inspection_date as string) || new Date().toISOString().split('T')[0]
      const filename = `corrections-${address.replace(/[^a-zA-Z0-9]/g, '-')}-${date}.txt`

      const text = formatCorrections(data)
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Corrections exported')
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: (err) => toast.error(`Export failed: ${err.message}`),
  })

  if (reportLoading) return <div className="p-6 text-muted-foreground">Loading...</div>
  if (!report) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground mb-4">Report not found</p>
      <button onClick={() => navigate('/reports')} className="px-4 py-2 rounded-md text-sm border hover:bg-gray-50">Back to Reports</button>
    </div>
  )

  const extracted = report.extracted_data as Record<string, any> | null
  const allResolved = totalFlags > 0 && resolvedCount >= totalFlags
  const isCompleted = report.status === 'completed'
  const progressPct = totalFlags > 0 ? (resolvedCount / totalFlags) * 100 : 0

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Back */}
      <div className="px-4 py-2 border-b">
        <button onClick={() => navigate('/reports')} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
      </div>

      {/* Split panel */}
      <div className="flex-1 flex">
        {/* Left: PDF */}
        <div className="w-[60%] border-r bg-gray-50">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title="Report PDF" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading PDF...</div>
          )}
        </div>

        {/* Right: Flags */}
        <div className="w-[40%] flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="border-b p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-sm truncate">{(extracted?.property_address as string) || 'Report'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-xs border">{SERVICE_TYPE_LABELS[report.service_type as keyof typeof SERVICE_TYPE_LABELS] || report.service_type}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[report.status] || report.status}
                </span>
              </div>
            </div>
            {totalFlags > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Flags resolved</span>
                  <span>{resolvedCount} / {totalFlags}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
            <button
              onClick={() => navigate(`/reports/${id}/summary`)}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              Continue to Summary Builder
              {!allResolved && totalFlags > 0 && (
                <span className="ml-1.5 text-blue-200 font-normal">({totalFlags - resolvedCount} flags unresolved)</span>
              )}
            </button>
          </div>

          {/* Flag list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {flagsLoading ? (
              <p className="text-muted-foreground text-sm">Loading flags...</p>
            ) : !flags?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No flags generated</p>
                <p className="text-xs mt-1">The report passed all checks</p>
              </div>
            ) : (
              flags.map((flag: any) => (
                <FlagCard key={flag.id} flag={flag} onResolve={(action, finalValue, note) => {
                  resolveFlag.mutate({ flagId: flag.id, action, finalValue, note })
                }} isPending={resolveFlag.isPending} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FlagCard({ flag, onResolve, isPending }: {
  flag: any
  onResolve: (action: 'accept' | 'edit' | 'dismiss', finalValue?: string, note?: string) => void
  isPending: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [editValue, setEditValue] = useState(flag.suggested_value || '')
  const [dismissReason, setDismissReason] = useState('')

  const resolved = flag.status !== 'open'

  const typeColor: Record<string, string> = {
    prohibited_language: 'bg-red-100 text-red-800',
    pricing: 'bg-amber-100 text-amber-800',
    missing_section: 'bg-yellow-100 text-yellow-800',
    completeness: 'bg-blue-100 text-blue-800',
    executive_summary: 'bg-blue-100 text-blue-800',
    consistency: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className={`rounded-lg border p-3 text-sm ${resolved ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColor[flag.flag_type] || 'bg-gray-100 text-gray-700'}`}>
            {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
          </span>
          <p className="font-medium mt-1">{flag.field_label}</p>
        </div>
        {flag.confidence < 0.9 && (
          <span className="text-xs text-muted-foreground">{Math.round(flag.confidence * 100)}%</span>
        )}
      </div>

      {flag.current_value && (
        <p className="text-xs text-muted-foreground mb-1">Current: <code className="bg-gray-100 px-1 rounded">{flag.current_value}</code></p>
      )}
      {flag.suggested_value && (
        <p className="text-xs text-green-700 mb-1">Suggested: {flag.suggested_value}</p>
      )}
      <p className="text-xs text-muted-foreground mb-2">{flag.reason}</p>

      {resolved ? (
        <p className="text-xs font-medium">
          {flag.status === 'accepted' && `✓ Accepted: ${flag.resolution_value || flag.suggested_value}`}
          {flag.status === 'edited' && `✏ Edited: ${flag.resolution_value}`}
          {flag.status === 'dismissed' && `✗ Dismissed: ${flag.dismiss_reason || 'No reason'}`}
        </p>
      ) : (
        <>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <div className="flex gap-2">
                <button onClick={() => { onResolve('edit', editValue); setEditing(false) }} disabled={isPending}
                  className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">Save</button>
                <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs border hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : dismissing ? (
            <div className="space-y-2">
              <textarea
                value={dismissReason}
                onChange={e => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this flag?"
                className="w-full px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
              />
              <div className="flex gap-2">
                <button onClick={() => { onResolve('dismiss', undefined, dismissReason); setDismissing(false) }} disabled={isPending}
                  className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-white hover:opacity-90 disabled:opacity-50">Dismiss</button>
                <button onClick={() => setDismissing(false)} className="px-2 py-1 rounded text-xs border hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => onResolve('accept')} disabled={isPending}
                className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">Accept</button>
              <button onClick={() => setEditing(true)}
                className="px-2 py-1 rounded text-xs font-medium border hover:bg-gray-50">Edit</button>
              <button onClick={() => setDismissing(true)}
                className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatCorrections(data: any): string {
  const m = data.metadata || {}
  const lines: string[] = [
    'SRC INSPECTION REPORT — CORRECTIONS SUMMARY',
    '============================================',
    `Property: ${m.property_address || 'N/A'} | Date: ${m.inspection_date || 'N/A'} | Type: ${m.service_type || 'N/A'} | Inspector: ${m.inspector_name || 'N/A'}`,
    `Exported: ${m.exported_at || new Date().toISOString()}`,
    '',
    `Total flags: ${data.summary?.total ?? 0} | Accepted: ${data.summary?.accepted ?? 0} | Edited: ${data.summary?.edited ?? 0} | Dismissed: ${data.summary?.dismissed ?? 0}`,
    '',
  ]
  const corrections = data.corrections || []
  if (corrections.length > 0) {
    lines.push(`CORRECTIONS APPLIED (${corrections.length})`)
    corrections.forEach((c: any, i: number) => {
      lines.push(`[${i + 1}] ${(c.flag_type || '').toUpperCase()} — ${c.field_label}`)
      if (c.current_value) lines.push(`    Original: ${c.current_value}`)
      if (c.resolution_value) lines.push(`    Corrected: ${c.resolution_value}`)
      if (c.reason) lines.push(`    Reason: ${c.reason}`)
      lines.push('')
    })
  }
  const dismissed = data.dismissed || []
  if (dismissed.length > 0) {
    lines.push(`DISMISSED FLAGS (${dismissed.length})`)
    dismissed.forEach((d: any, i: number) => {
      lines.push(`[${i + 1}] ${(d.flag_type || '').toUpperCase()} — ${d.field_label}`)
      if (d.dismiss_reason) lines.push(`    Dismissed: ${d.dismiss_reason}`)
      lines.push('')
    })
  }
  return lines.join('\n')
}
