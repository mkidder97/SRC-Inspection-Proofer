import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FlagCard } from './FlagCard'
import { FLAG_TYPE_LABELS } from '@/lib/constants'
import type { FlagType } from '@/lib/constants'

interface FlagListProps {
  flags: any[]
  onResolve: (params: {
    flagId: string
    action: 'accept' | 'edit' | 'dismiss'
    finalValue?: string
    note?: string
  }) => void
  isPending: boolean
}

export function FlagList({ flags, onResolve, isPending }: FlagListProps) {
  // Group flags by type
  const grouped = flags.reduce<Record<string, any[]>>((acc, flag) => {
    const type = flag.flag_type
    if (!acc[type]) acc[type] = []
    acc[type].push(flag)
    return acc
  }, {})

  const flagTypes = Object.keys(grouped)

  if (!flags.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground text-center">
        <div>
          <p className="font-medium">No flags generated</p>
          <p className="text-sm mt-1">The report passed all checks</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <Accordion type="multiple" defaultValue={flagTypes}>
          {flagTypes.map((type) => {
            const typeFlags = grouped[type]
            const openCount = typeFlags.filter((f: any) => f.status === 'open').length
            return (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <span>{FLAG_TYPE_LABELS[type as FlagType] || type}</span>
                    {openCount > 0 ? (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        {openCount}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600">
                        Done
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {typeFlags.map((flag: any) => (
                      <FlagCard
                        key={flag.id}
                        flag={flag}
                        onResolve={onResolve}
                        isPending={isPending}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </ScrollArea>
  )
}
