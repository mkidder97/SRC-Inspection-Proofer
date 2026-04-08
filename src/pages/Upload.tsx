import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ServiceType } from '@/lib/constants'
import { Upload as UploadIcon, FileText, X } from 'lucide-react'
import { toast } from 'sonner'

export default function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === 'application/pdf') {
      setFile(dropped)
    } else {
      toast.error('Please upload a PDF file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  async function handleUpload() {
    if (!file || !serviceType || !user) return

    setUploading(true)
    setProgress(10)
    setStatus('Uploading PDF...')

    try {
      // Upload PDF to storage
      const storagePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('report-uploads')
        .upload(storagePath, file)

      if (uploadError) throw uploadError
      setProgress(30)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('report-uploads')
        .getPublicUrl(storagePath)

      // Insert report record
      const { data: report, error: insertError } = await supabase
        .from('reports')
        .insert({
          uploaded_by: user.id,
          original_pdf_url: urlData.publicUrl,
          original_storage_path: storagePath,
          service_type: serviceType,
          status: 'uploaded',
        })
        .select()
        .single()

      if (insertError) throw insertError
      setProgress(50)
      setStatus('Extracting report data...')

      // Call extract-report edge function
      const { error: extractError } = await supabase.functions.invoke(
        'extract-report',
        { body: { reportId: report.id } }
      )

      if (extractError) throw extractError
      setProgress(75)
      setStatus('Proofing report...')

      // Chain: automatically run proofing after extraction
      const { error: proofError } = await supabase.functions.invoke(
        'proof-report',
        { body: { reportId: report.id } }
      )

      if (proofError) throw proofError
      setProgress(100)
      setStatus('Proofing complete!')

      toast.success('Report uploaded and extracted successfully')
      navigate(`/reports/${report.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      toast.error(message)
      setStatus(null)
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Report</h1>
        <p className="text-muted-foreground mt-1">
          Upload an SRC inspection report PDF for proofing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report PDF</CardTitle>
          <CardDescription>Drag and drop or click to select a PDF file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              ${file ? 'bg-muted/30' : ''}
            `}
            onClick={() => document.getElementById('pdf-input')?.click()}
          >
            <input
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <UploadIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Drop your PDF here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </>
            )}
          </div>

          {/* Service type selector */}
          <div className="space-y-2">
            <Label>Service Type</Label>
            <Select
              value={serviceType}
              onValueChange={(v) => setServiceType(v as ServiceType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {SERVICE_TYPE_LABELS[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          {status && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">{status}</p>
            </div>
          )}

          {/* Upload button */}
          <Button
            className="w-full"
            size="lg"
            disabled={!file || !serviceType || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Processing...' : 'Upload & Extract'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
