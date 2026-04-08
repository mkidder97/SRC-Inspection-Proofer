import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { Upload, Search, CheckCircle, FileOutput, Shield } from 'lucide-react'

interface AuditLogProps {
  reportId: string
}

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  extract: { icon: Search, label: 'Report extracted', color: 'text-blue-500' },
  proof: { icon: Shield, label: 'Report proofed', color: 'text-amber-500' },
  resolve_flag_accept: { icon: CheckCircle, label: 'Flag accepted', color: 'text-green-500' },
  resolve_flag_edit: { icon: CheckCircle, label: 'Flag edited', color: 'text-blue-500' },
  resolve_flag_dismiss: { icon: CheckCircle, label: 'Flag dismissed', color: 'text-muted-foreground' },
  generate_pdf: { icon: FileOutput, label: 'PDF generated', color: 'text-primary' },
  upload: { icon: Upload, label: 'Report uploaded', color: 'text-muted-foreground' },
}

export function AuditLog({ reportId }: AuditLogProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="audit">
        <AccordionTrigger className="text-sm px-4">
          Activity Log ({logs?.length || 0})
        </AccordionTrigger>
        <AccordionContent>
          <div className="px-4 pb-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {logs?.map((log) => {
                  const config = ACTION_CONFIG[log.action] || {
                    icon: Search,
                    label: log.action,
                    color: 'text-muted-foreground',
                  }
                  const Icon = config.icon
                  const details = log.details as Record<string, unknown> | null

                  return (
                    <div key={log.id} className="flex items-start gap-2 py-1.5 text-xs">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{config.label}</span>
                        {details?.flag_type && (
                          <span className="text-muted-foreground"> — {details.flag_type as string}</span>
                        )}
                        {details?.flagCount != null && (
                          <span className="text-muted-foreground"> — {details.flagCount as number} flags</span>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}
                {!logs?.length && (
                  <p className="text-muted-foreground text-center py-4">No activity yet</p>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
