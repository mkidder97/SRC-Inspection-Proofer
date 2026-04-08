import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { SERVICE_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'

export default function Reports() {
  const navigate = useNavigate()
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading reports...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <button
          onClick={() => navigate('/upload')}
          className="px-4 py-2 rounded-md text-sm font-medium text-primary-foreground bg-primary hover:opacity-90"
        >
          Upload Report
        </button>
      </div>

      {!reports?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No reports yet</p>
          <p className="text-sm">Upload your first SRC inspection report to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uploaded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => {
                const extracted = r.extracted_data as Record<string, any> | null
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">
                      {(extracted?.property_address as string) || 'Processing...'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {SERVICE_TYPE_LABELS[r.service_type as keyof typeof SERVICE_TYPE_LABELS] || r.service_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'completed' ? 'bg-green-100 text-green-800' :
                        r.status === 'failed' ? 'bg-red-100 text-red-800' :
                        r.status === 'proofed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.flag_count > 0 ? `${r.resolved_count}/${r.flag_count}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/reports/${r.id}`)}
                        className="px-3 py-1 rounded text-xs font-medium border hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
