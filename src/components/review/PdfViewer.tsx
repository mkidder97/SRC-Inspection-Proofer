import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText } from 'lucide-react'

interface PdfViewerProps {
  storagePath: string | null
}

export function PdfViewer({ storagePath }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!storagePath) {
      setLoading(false)
      return
    }

    async function getSignedUrl() {
      const { data, error } = await supabase.storage
        .from('report-uploads')
        .createSignedUrl(storagePath!, 3600) // 1 hour
      if (!error && data?.signedUrl) {
        setUrl(data.signedUrl)
      }
      setLoading(false)
    }

    getSignedUrl()
  }, [storagePath])

  if (loading) {
    return <Skeleton className="h-full w-full" />
  }

  if (!url) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>PDF not available</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      className="w-full h-full border-0"
      title="Original Report PDF"
    />
  )
}
