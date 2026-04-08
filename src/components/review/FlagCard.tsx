import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FLAG_TYPE_LABELS } from '@/lib/constants'
import type { FlagType } from '@/lib/constants'
import { Check, Pencil, X, AlertCircle, AlertTriangle, Info, Undo2 } from 'lucide-react'

interface FlagCardProps {
  flag: {
    id: string
    field_address: string
    field_label: string
    flag_type: string
    current_value: string | null
    suggested_value: string | null
    reason: string
    confidence: number
    status: string
    resolution_value: string | null
    dismiss_reason: string | null
  }
  onResolve: (params: {
    flagId: string
    action: 'accept' | 'edit' | 'dismiss'
    finalValue?: string
    note?: string
  }) => void
  isPending: boolean
}

export function FlagCard({ flag, onResolve, isPending }: FlagCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [dismissMode, setDismissMode] = useState(false)
  const [editValue, setEditValue] = useState(flag.suggested_value || '')
  const [dismissReason, setDismissReason] = useState('')

  const isResolved = flag.status !== 'open'

  const severityIcon = () => {
    if (flag.confidence >= 0.9) return <AlertCircle className="h-4 w-4 text-destructive" />
    if (flag.confidence >= 0.7) return <AlertTriangle className="h-4 w-4 text-amber-500" />
    return <Info className="h-4 w-4 text-blue-500" />
  }

  const statusBadge = () => {
    switch (flag.status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Accepted</Badge>
      case 'edited':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Edited</Badge>
      case 'dismissed':
        return <Badge variant="outline" className="text-muted-foreground">Dismissed</Badge>
      default:
        return null
    }
  }

  return (
    <Card className={`transition-all ${isResolved ? 'opacity-60' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {severityIcon()}
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight">{flag.field_label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {FLAG_TYPE_LABELS[flag.flag_type as FlagType] || flag.flag_type}
              </p>
            </div>
          </div>
          {statusBadge()}
        </div>

        {/* Reason */}
        <p className="text-sm text-muted-foreground">{flag.reason}</p>

        {/* Current vs Suggested */}
        {(flag.current_value || flag.suggested_value) && !isResolved && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {flag.current_value && (
              <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                <p className="text-xs text-muted-foreground mb-0.5">Current</p>
                <p className="font-mono text-xs break-all">{flag.current_value}</p>
              </div>
            )}
            {flag.suggested_value && (
              <div className="bg-green-50 dark:bg-green-950/30 rounded p-2">
                <p className="text-xs text-muted-foreground mb-0.5">Suggested</p>
                <p className="font-mono text-xs break-all">{flag.suggested_value}</p>
              </div>
            )}
          </div>
        )}

        {/* Resolved info */}
        {isResolved && flag.resolution_value && (
          <div className="bg-muted/50 rounded p-2 text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">Applied value</p>
            <p className="font-mono text-xs">{flag.resolution_value}</p>
          </div>
        )}
        {isResolved && flag.dismiss_reason && (
          <div className="bg-muted/50 rounded p-2 text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">Dismiss reason</p>
            <p className="text-xs">{flag.dismiss_reason}</p>
          </div>
        )}

        {/* Edit mode */}
        {editMode && (
          <div className="space-y-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter corrected value"
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onResolve({ flagId: flag.id, action: 'edit', finalValue: editValue })
                  setEditMode(false)
                }}
                disabled={isPending || !editValue}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Dismiss mode */}
        {dismissMode && (
          <div className="space-y-2">
            <Textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Why is this flag being dismissed?"
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onResolve({ flagId: flag.id, action: 'dismiss', note: dismissReason })
                  setDismissMode(false)
                }}
                disabled={isPending}
              >
                Confirm Dismiss
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isResolved && !editMode && !dismissMode && (
          <div className="flex gap-2">
            {flag.suggested_value && (
              <Button
                size="sm"
                onClick={() => onResolve({ flagId: flag.id, action: 'accept' })}
                disabled={isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Accept
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditMode(true)}
              disabled={isPending}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissMode(true)}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
