import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ServiceType } from '@/lib/constants'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function CostTableManager() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [serviceType, setServiceType] = useState<string>('all')

  const { data: entries, isLoading } = useQuery({
    queryKey: ['cost-table'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'cost_table')
        .eq('is_active', true)
        .order('label')
      if (error) throw error
      return data
    },
  })

  const addEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'cost_table',
        service_type: serviceType === 'all' ? null : serviceType,
        label,
        content: { unit, min: parseFloat(min), max: parseFloat(max) },
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-table'] })
      toast.success('Cost table entry added')
      setOpen(false)
      setLabel('')
      setUnit('')
      setMin('')
      setMax('')
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reference_library')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-table'] })
      toast.success('Entry removed')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {entries?.length || 0} entries
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Cost Table Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Item Description</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., TPO 60-mil membrane" />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g., SF, LF, EA" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Cost ($)</Label>
                  <Input type="number" step="0.01" value={min} onChange={(e) => setMin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Cost ($)</Label>
                  <Input type="number" step="0.01" value={max} onChange={(e) => setMax(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Service Types</SelectItem>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>{SERVICE_TYPE_LABELS[st]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addEntry.mutate()} disabled={!label || !min || !max || addEntry.isPending} className="w-full">
                {addEntry.isPending ? 'Adding...' : 'Add Entry'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>Max</TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.label}</TableCell>
                <TableCell>{(entry.content as any)?.unit || '—'}</TableCell>
                <TableCell>${Number((entry.content as any)?.min || 0).toFixed(2)}</TableCell>
                <TableCell>${Number((entry.content as any)?.max || 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {entry.service_type ? SERVICE_TYPE_LABELS[entry.service_type as ServiceType] : 'All'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(entry.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!entries?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No cost table entries yet. Add your first entry above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
