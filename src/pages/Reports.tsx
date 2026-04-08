import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { SERVICE_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'
import type { ServiceType, ReportStatus } from '@/lib/constants'
import { FileText, Plus, ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function Reports() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('all')


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

  function statusVariant(status: string) {
    switch (status) {
      case 'completed': return 'default' as const
      case 'failed': return 'destructive' as const
      case 'proofed': return 'secondary' as const
      default: return 'outline' as const
    }
  }

  const totalReports = reports?.length || 0
  const completedReports = reports?.filter((r) => r.status === 'completed').length || 0
  const proofedReports = reports?.filter((r) => r.status === 'proofed' || r.status === 'reviewing').length || 0
  const avgFlags = totalReports > 0
    ? Math.round((reports?.reduce((sum, r) => sum + (r.flag_count || 0), 0) || 0) / totalReports)
    : 0

  const filteredReports = statusFilter === 'all'
    ? reports
    : reports?.filter((r) => {
        if (statusFilter === 'needs_review') return r.status === 'proofed' || r.status === 'reviewing'
        return r.status === statusFilter
      })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            All uploaded inspection reports
          </p>
        </div>
        <Button onClick={() => navigate('/upload')}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Stats */}
      {totalReports > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalReports}</p>
                <p className="text-xs text-muted-foreground">Total Reports</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('needs_review')}>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{proofedReports}</p>
                <p className="text-xs text-muted-foreground">Needs Review</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('completed')}>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedReports}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {statusFilter === 'all' ? 'All Reports' : statusFilter === 'needs_review' ? 'Needs Review' : 'Completed'}
          </CardTitle>
          {statusFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
              Show All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredReports?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No reports yet</p>
              <p className="text-sm mt-1">Upload your first inspection report to get started</p>
              <Button className="mt-4" onClick={() => navigate('/upload')}>
                Upload Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports?.map((report) => {
                  const extracted = report.extracted_data as Record<string, unknown> | null
                  const address = extracted?.property_address as string | null
                  return (
                    <TableRow
                      key={report.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/reports/${report.id}`)}
                    >
                      <TableCell className="font-medium">
                        {address || 'Pending extraction...'}
                      </TableCell>
                      <TableCell>
                        {SERVICE_TYPE_LABELS[report.service_type as ServiceType] || report.service_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(report.status)}>
                          {STATUS_LABELS[report.status as ReportStatus] || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.flag_count != null
                          ? `${report.resolved_count ?? 0}/${report.flag_count}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
