import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/lib/constants'
import type { ServiceType } from '@/lib/constants'
import { toast } from 'sonner'

export default function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [uploading, setUploading] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === 'application/pdf') setFile(dropped)
    else toast.error('Please upload a PDF file')
  }, [])

  async function handleUpload() {
    if (!file || !serviceType || !user) return
    setUploading(true)
    setProgress(10)
    setStatusText('Uploading PDF...')

    try {
      const storagePath = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage.from('report-uploads').upload(storagePath, file)
      if (uploadErr) throw uploadErr
      setProgress(30)

      const { data: urlData } = supabase.storage.from('report-uploads').getPublicUrl(storagePath)

      const { data: report, error: insertErr } = await supabase
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
      if (insertErr) throw insertErr
      setProgress(50)
      setStatusText('Extracting report data...')

      const { error: extractErr } = await supabase.functions.invoke('extract-report', { body: { reportId: report.id } })
      if (extractErr) throw extractErr
      setProgress(100)
      setStatusText('Extraction complete — review next')

      toast.success('Report extracted — review data before proofing')
      navigate(`/reports/${report.id}/review`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      setStatusText(null)
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Upload Report</h1>
      <p className="text-muted-foreground mb-6 text-sm">Upload an SRC inspection report PDF for proofing</p>

      <div className="bg-white rounded-xl border p-6 space-y-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('pdf-input')?.click()}
          className="cursor-pointer rounded-lg p-8 text-center transition-colors"
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : '#d1d5db'}`,
            backgroundColor: dragOver ? '#f0f0ff' : file ? '#fafafa' : 'transparent',
          }}
        >
          <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="text-left">
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null) }} className="text-muted-foreground hover:text-foreground ml-2">✕</button>
            </div>
          ) : (
            <>
              <p className="text-3xl mb-2">📁</p>
              <p className="font-medium text-sm">Drop your PDF here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </>
          )}
        </div>

        {/* Service type */}
        <div>
          <label className="block text-sm font-medium mb-1">Service Type</label>
          <select
            value={serviceType}
            onChange={e => setServiceType(e.target.value as ServiceType)}
            className="w-full px-3 py-2 rounded-md border border-input text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select service type</option>
            {SERVICE_TYPES.map(st => (
              <option key={st} value={st}>{SERVICE_TYPE_LABELS[st]}</option>
            ))}
          </select>
        </div>

        {/* Progress */}
        {statusText && (
          <div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">{statusText}</p>
          </div>
        )}

        {/* Submit */}
        <button
          disabled={!file || !serviceType || uploading}
          onClick={handleUpload}
          className="w-full py-2.5 rounded-md text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Upload & Extract'}
        </button>
      </div>
    </div>
  )
}
