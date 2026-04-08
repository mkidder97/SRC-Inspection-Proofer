import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { STATUS_LABELS, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ReportStatus, ServiceType } from '@/lib/constants'
import { Download, Loader2, CheckCircle } from 'lucide-react'

interface ReviewToolbarProps {
  report: any
  totalFlags: number
  resolvedCount: number
  onExport: () => void
  isExporting: boolean
}

export function ReviewToolbar({
  report,
  totalFlags,
  resolvedCount,
  onExport,
  isExporting,
}: ReviewToolbarProps) {
  const extracted = report?.extracted_data as Record<string, unknown> | null
  const allResolved = totalFlags > 0 && resolvedCount >= totalFlags
  const progressPercent = totalFlags > 0 ? (resolvedCount / totalFlags) * 100 : 0
  const isCompleted = report?.status === 'completed'

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
            variant={isCompleted ? 'default' : 'secondary'}
            className={`text-xs ${isCompleted ? 'bg-green-600' : ''}`}
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
        {allResolved && !isCompleted && (
          <Button
            size="sm"
            className="w-full"
            disabled={isExporting}
            onClick={onExport}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export Corrections Summary
              </>
            )}
          </Button>
        )}

        {isCompleted && (
          <div className="flex items-center justify-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Corrections exported
          </div>
        )}

        {!allResolved && totalFlags > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Resolve all flags to export corrections
          </p>
        )}
      </div>
    </div>
  )
}
