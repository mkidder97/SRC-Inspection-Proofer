import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function ProhibitedPhrases() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [replacement, setReplacement] = useState('')

  const { data: entries, isLoading } = useQuery({
    queryKey: ['prohibited-phrases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'prohibited_phrase')
        .eq('is_active', true)
        .order('label')
      if (error) throw error
      return data
    },
  })

  const addPhrase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'prohibited_phrase',
        label: phrase,
        content: replacement ? { replacement } : null,
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prohibited-phrases'] })
      toast.success('Prohibited phrase added')
      setOpen(false)
      setPhrase('')
      setReplacement('')
    },
    onError: (err) => toast.error(err.message),
  })

  const deletePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reference_library')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prohibited-phrases'] })
      toast.success('Phrase removed')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {entries?.length || 0} phrases
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Phrase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Prohibited Phrase</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Prohibited Phrase</Label>
                <Input
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="e.g., structurally sound"
                />
              </div>
              <div className="space-y-2">
                <Label>Suggested Replacement (optional)</Label>
                <Input
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  placeholder="e.g., appears to be in serviceable condition"
                />
              </div>
              <Button
                onClick={() => addPhrase.mutate()}
                disabled={!phrase || addPhrase.isPending}
                className="w-full"
              >
                {addPhrase.isPending ? 'Adding...' : 'Add Phrase'}
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
              <TableHead>Phrase</TableHead>
              <TableHead>Suggested Replacement</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-destructive">
                  "{entry.label}"
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(entry.content as any)?.replacement || '—  (remove entirely)'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => deletePhrase.mutate(entry.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!entries?.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No prohibited phrases yet. Add your first phrase above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
