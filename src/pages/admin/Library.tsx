import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { REPAIR_PRICING, REPLACEMENT_PRICING } from '@/lib/pricing-constants'
import { toast } from 'sonner'

type Tab = 'replacement' | 'repair' | 'prohibited'

export default function Library() {
  const [tab, setTab] = useState<Tab>('replacement')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Reference Library</h1>
      <p className="text-sm text-muted-foreground mb-6">Pricing schedules and prohibited phrases used by the proofer</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {([
          ['replacement', 'Replacement Pricing'],
          ['repair', 'Repair Pricing'],
          ['prohibited', 'Prohibited Phrases'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'replacement' && <ReplacementPricingTab />}
      {tab === 'repair' && <RepairPricingTab />}
      {tab === 'prohibited' && <ProhibitedPhrasesTab />}
    </div>
  )
}

function ReplacementPricingTab() {
  const { data: dbRows } = useQuery({
    queryKey: ['ref-library', 'cost_table'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'cost_table')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const usingDefaults = !dbRows?.length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {usingDefaults ? 'Using built-in defaults' : `${dbRows.length} entries from database • Last updated ${new Date(dbRows[0].created_at).toLocaleDateString()}`}
        </p>
      </div>

      {Object.entries(REPLACEMENT_PRICING).map(([category, prices]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(prices).map(([key, val]) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{key.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">${(val as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function RepairPricingTab() {
  const { data: dbRows } = useQuery({
    queryKey: ['ref-library', 'repair_pricing'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'repair_pricing')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      return data || []
    },
  })

  const usingDefaults = !dbRows?.length

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {usingDefaults ? 'Using built-in defaults' : `${dbRows.length} entries from database • Last updated ${new Date(dbRows[0].created_at).toLocaleDateString()}`}
      </p>

      {Object.entries(REPAIR_PRICING).map(([category, items]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{item.notes}</td>
                    <td className="px-3 py-1.5 text-right">{item.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono">${item.price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function ProhibitedPhrasesTab() {
  const queryClient = useQueryClient()
  const [newPhrase, setNewPhrase] = useState('')

  const { data: dbPhrases, isLoading } = useQuery({
    queryKey: ['ref-library', 'prohibited_phrase'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'prohibited_phrase')
        .eq('is_active', true)
        .order('label')
      return data || []
    },
  })

  const addPhrase = useMutation({
    mutationFn: async (phrase: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'prohibited_phrase',
        label: phrase,
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Phrase added')
      setNewPhrase('')
      queryClient.invalidateQueries({ queryKey: ['ref-library', 'prohibited_phrase'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const removePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Phrase removed')
      queryClient.invalidateQueries({ queryKey: ['ref-library', 'prohibited_phrase'] })
    },
  })

  const usingDefaults = !dbPhrases?.length
  const defaultPhrases = [
    'structurally sound', 'no structural concerns', 'guaranteed', 'warranted',
    'will not leak', 'no further action required', 'fully compliant',
    'covered by insurance', 'insurance will pay', 'meets all code requirements', 'code compliant',
  ]

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {usingDefaults
          ? 'Using built-in defaults. Add phrases below to override.'
          : `${dbPhrases.length} phrases from database`}
      </p>

      {/* Add new */}
      <div className="flex gap-2 mb-4">
        <input
          value={newPhrase}
          onChange={e => setNewPhrase(e.target.value)}
          placeholder="Add prohibited phrase..."
          className="flex-1 px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={e => { if (e.key === 'Enter' && newPhrase.trim()) addPhrase.mutate(newPhrase.trim()) }}
        />
        <button
          onClick={() => newPhrase.trim() && addPhrase.mutate(newPhrase.trim())}
          disabled={!newPhrase.trim() || addPhrase.isPending}
          className="px-4 py-2 rounded-md text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border divide-y">
        {isLoading ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">Loading...</div>
        ) : usingDefaults ? (
          defaultPhrases.map((phrase) => (
            <div key={phrase} className="px-3 py-2 flex items-center justify-between text-sm">
              <span>{phrase}</span>
              <span className="text-xs text-muted-foreground">built-in</span>
            </div>
          ))
        ) : (
          dbPhrases.map((row: any) => (
            <div key={row.id} className="px-3 py-2 flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <button
                onClick={() => removePhrase.mutate(row.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
