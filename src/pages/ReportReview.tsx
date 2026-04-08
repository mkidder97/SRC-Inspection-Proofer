import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useReportFlags } from '@/hooks/useReportFlags'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { PdfViewer } from '@/components/review/PdfViewer'
import { FlagList } from '@/components/review/FlagList'
import { ReviewToolbar } from '@/components/review/ReviewToolbar'
import { AuditLog } from '@/components/review/AuditLog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function ReportReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    flags,
    report,
    flagsLoading,
    reportLoading,
    resolveFlag,
    totalFlags,
    resolvedCount,
  } = useReportFlags(id)

  const exportCorrections = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'export-corrections',
        { body: { reportId: id } }
      )
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Build the text file and trigger download
      const extracted = report?.extracted_data as Record<string, unknown> | null
      const address = (extracted?.property_address as string) || 'report'
      const date = (extracted?.inspection_date as string) || new Date().toISOString().split('T')[0]
      const filename = `corrections-${address.replace(/[^a-zA-Z0-9]/g, '-')}-${date}.txt`

      const blob = new Blob([formatCorrectionsText(data)], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Corrections exported')
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: (err) => {
      toast.error(`Export failed: ${err.message}`)
    },
  })

  function handleResolve(params: {
    flagId: string
    action: 'accept' | 'edit' | 'dismiss'
    finalValue?: string
    note?: string
  }) {
    resolveFlag.mutate(params)
  }

  if (reportLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[calc(100vh-12rem)] w-full" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Report not found</p>
        <Button className="mt-4" onClick={() => navigate('/reports')}>
          Back to Reports
        </Button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Back button */}
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Split panel */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={35}>
          <PdfViewer storagePath={report.original_storage_path} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full flex flex-col">
            <ReviewToolbar
              report={report}
              totalFlags={totalFlags}
              resolvedCount={resolvedCount}
              onExport={() => exportCorrections.mutate()}
              isExporting={exportCorrections.isPending}
            />
            {flagsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : (
              <FlagList
                flags={flags || []}
                onResolve={handleResolve}
                isPending={resolveFlag.isPending}
              />
            )}
            {/* Audit trail */}
            <div className="border-t">
              <AuditLog reportId={id!} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function formatCorrectionsText(data: any): string {
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
