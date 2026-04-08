import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ServiceType } from '@/lib/constants'
import { Plus, Trash2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'

export function ApprovedReportsList() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [serviceType, setServiceType] = useState<string>('')
  const [uploading, setUploading] = useState(false)

  const { data: entries, isLoading } = useQuery({
    queryKey: ['approved-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'approved_report')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  async function handleUpload() {
    if (!file || !serviceType || !user) return
    setUploading(true)
    try {
      const path = `approved/${serviceType}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('reference-library')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase.from('reference_library').insert({
        entry_type: 'approved_report',
        service_type: serviceType,
        label: file.name,
        file_storage_path: path,
        uploaded_by: user.id,
      })
      if (insertErr) throw insertErr

      queryClient.invalidateQueries({ queryKey: ['approved-reports'] })
      toast.success('Approved report uploaded')
      setOpen(false)
      setFile(null)
      setServiceType('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reference_library')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-reports'] })
      toast.success('Report removed')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {entries?.length || 0} approved reports
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Upload Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Approved Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>{SERVICE_TYPE_LABELS[st]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PDF File</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById('approved-pdf')?.click()}
                >
                  <input
                    id="approved-pdf"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select PDF</p>
                    </>
                  )}
                </div>
              </div>
              <Button
                onClick={handleUpload}
                disabled={!file || !serviceType || uploading}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Upload Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {entry.label}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {SERVICE_TYPE_LABELS[entry.service_type as ServiceType] || 'Unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString()}
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
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No approved reports uploaded yet. Upload 2-3 per service type.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
