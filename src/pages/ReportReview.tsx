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

  const approveReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'approved' })
        .eq('id', id!)
      if (error) throw error
      // Audit log
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('audit_log').insert({
          report_id: id,
          user_id: user.id,
          action: 'approve',
          details: { total_flags: totalFlags, resolved: resolvedCount },
        })
      }
      // Trigger AI learning from this approved report
      await supabase.functions.invoke('learn-from-report', {
        body: { reportId: id },
      })
    },
    onSuccess: () => {
      toast.success('Report approved')
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: (err) => {
      toast.error(`Approval failed: ${err.message}`)
    },
  })

  const generatePdf = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'generate-corrected-report',
        { body: { reportId: id } }
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Corrected PDF generated successfully')
      queryClient.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: (err) => {
      toast.error(`PDF generation failed: ${err.message}`)
    },
  })

  async function handleDownload() {
    if (!report?.corrected_storage_path) return
    const { data, error } = await supabase.storage
      .from('corrected-reports')
      .createSignedUrl(report.corrected_storage_path, 3600)
    if (error || !data?.signedUrl) {
      toast.error('Failed to get download URL')
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = `corrected-report-${id}.pdf`
    a.click()
  }

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
              onGenerate={() => generatePdf.mutate()}
              onDownload={handleDownload}
              onApprove={() => approveReport.mutate()}
              isGenerating={generatePdf.isPending}
              isApproving={approveReport.isPending}
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
