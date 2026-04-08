import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ReportStatus, ServiceType } from '@/lib/constants'
import { Download, FileOutput, Loader2, CheckCircle, ShieldCheck } from 'lucide-react'

interface ReviewToolbarProps {
  report: any
  totalFlags: number
  resolvedCount: number
  onGenerate: () => void
  onDownload: () => void
  onApprove: () => void
  isGenerating: boolean
  isApproving: boolean
}

export function ReviewToolbar({
  report,
  totalFlags,
  resolvedCount,
  onGenerate,
  onDownload,
  onApprove,
  isGenerating,
  isApproving,
}: ReviewToolbarProps) {
  const extracted = report?.extracted_data as Record<string, unknown> | null
  const allResolved = totalFlags > 0 && resolvedCount >= totalFlags
  const progressPercent = totalFlags > 0 ? (resolvedCount / totalFlags) * 100 : 0
  const hasCorrectedPdf = !!report?.corrected_pdf_url
  const isApproved = report?.status === 'approved' || report?.status === 'completed'
  const canApprove = allResolved && !isApproved

  return (
    <div className="border-b p-4 space-y-3">
      {/* Report info */}
      <div>
        <h2 className="font-semibold text-sm truncate">
          {(extracted?.property_address as string) || 'Report'}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {SERVICE_TYPE_LABELS[report?.service_type as ServiceType] || report?.service_type}
          </Badge>
          <Badge
            variant={isApproved ? 'default' : 'secondary'}
            className={`text-xs ${isApproved ? 'bg-green-600' : ''}`}
          >
            {STATUS_LABELS[report?.status as ReportStatus] || report?.status}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      {totalFlags > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Flags resolved</span>
            <span>
              {resolvedCount} / {totalFlags}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {/* Step 1: Approve (after all flags resolved) */}
        {canApprove && (
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isApproving}
            onClick={onApprove}
          >
            {isApproving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Approve Report
              </>
            )}
          </Button>
        )}

        {/* Step 2: Generate PDF (after approved) */}
        {isApproved && !hasCorrectedPdf && (
          <Button
            size="sm"
            className="w-full"
            disabled={isGenerating}
            onClick={onGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileOutput className="h-3.5 w-3.5 mr-1" />
                Generate Corrected PDF
              </>
            )}
          </Button>
        )}

        {/* Step 3: Download (after generated) */}
        {hasCorrectedPdf && (
          <Button size="sm" className="w-full" onClick={onDownload}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Download Corrected PDF
          </Button>
        )}

        {/* Status message when not all flags resolved */}
        {!allResolved && totalFlags > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Resolve all flags to approve this report
          </p>
        )}
      </div>
    </div>
  )
}
