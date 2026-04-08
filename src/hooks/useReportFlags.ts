import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useReportFlags(reportId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['flags', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flags')
        .select('*')
        .eq('report_id', reportId!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!reportId,
  })

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!reportId,
  })

  const resolveFlag = useMutation({
    mutationFn: async ({
      flagId,
      action,
      finalValue,
      note,
    }: {
      flagId: string
      action: 'accept' | 'edit' | 'dismiss'
      finalValue?: string
      note?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('resolve-flag', {
        body: { flagId, action, finalValue, note },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flags', reportId] })
      queryClient.invalidateQueries({ queryKey: ['report', reportId] })
    },
    onError: (err) => {
      toast.error(`Failed to resolve flag: ${err.message}`)
    },
  })

  const openFlags = flags?.filter((f) => f.status === 'open') || []
  const resolvedFlags = flags?.filter((f) => f.status !== 'open') || []

  return {
    flags,
    report,
    flagsLoading,
    reportLoading,
    resolveFlag,
    openFlags,
    resolvedFlags,
    totalFlags: flags?.length || 0,
    resolvedCount: resolvedFlags.length,
  }
}
