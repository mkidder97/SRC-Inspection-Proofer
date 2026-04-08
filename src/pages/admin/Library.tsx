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

// ============================================================
// Replacement Pricing (read-only display)
// ============================================================
function ReplacementPricingTab() {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">Built-in replacement pricing schedules. Contact admin to update.</p>
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

// ============================================================
// Repair Pricing (CRUD)
// ============================================================
const CATEGORIES = Object.keys(REPAIR_PRICING)

function RepairPricingTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState(CATEGORIES[0])
  const [addNotes, setAddNotes] = useState('')
  const [addUnit, setAddUnit] = useState('ea')
  const [addPrice, setAddPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')

  const { data: dbRows } = useQuery({
    queryKey: ['ref-library', 'repair_pricing'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reference_library')
        .select('*')
        .eq('entry_type', 'repair_pricing')
        .eq('is_active', true)
      return data || []
    },
  })

  const addEntry = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'repair_pricing',
        service_type: addCategory,
        label: addNotes,
        content: { unit: addUnit, price: parseFloat(addPrice) },
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Entry added')
      setAddNotes(''); setAddPrice(''); setShowAdd(false)
      queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const row = dbRows?.find((r: any) => r.id === id)
      if (!row) throw new Error('Row not found')
      const content = row.content as any
      const { error } = await supabase.from('reference_library')
        .update({ content: { ...content, price } })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Price updated')
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] })
    },
  })

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Entry removed')
      queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] })
    },
  })

  // Build merged view: defaults + DB overrides
  const dbByCategory: Record<string, any[]> = {}
  for (const row of dbRows || []) {
    const cat = row.service_type || 'misc'
    if (!dbByCategory[cat]) dbByCategory[cat] = []
    dbByCategory[cat].push(row)
  }

  const hasCustom = (dbRows?.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {hasCustom ? `${dbRows!.length} custom entries overlaid on built-in defaults` : 'Using built-in defaults'}
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-primary-foreground bg-primary hover:opacity-90"
        >
          {showAdd ? 'Cancel' : 'Add Entry'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={addCategory} onChange={e => setAddCategory(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium mb-1">Description</label>
              <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="e.g. reflash scupper"
                className="w-full px-2 py-1.5 rounded border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit</label>
              <select value={addUnit} onChange={e => setAddUnit(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                <option value="ea">ea</option>
                <option value="lf">lf</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price ($)</label>
              <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="0"
                className="w-full px-2 py-1.5 rounded border text-sm" />
            </div>
          </div>
          <button
            onClick={() => addNotes && addPrice && addEntry.mutate()}
            disabled={!addNotes || !addPrice || addEntry.isPending}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50"
          >
            Save Entry
          </button>
        </div>
      )}

      {CATEGORIES.map(category => {
        const builtIn = REPAIR_PRICING[category] || []
        const custom = dbByCategory[category] || []
        const customLabels = new Set(custom.map((r: any) => (r.label || '').toLowerCase()))

        return (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unit</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Built-in entries (skip if overridden by custom) */}
                  {builtIn.filter(item => !customLabels.has(item.notes.toLowerCase())).map((item, i) => (
                    <tr key={`builtin-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{item.notes}</td>
                      <td className="px-3 py-1.5 text-right">{item.unit}</td>
                      <td className="px-3 py-1.5 text-right font-mono">${item.price.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className="text-xs text-muted-foreground">built-in</span>
                      </td>
                    </tr>
                  ))}
                  {/* Custom entries */}
                  {custom.map((row: any) => {
                    const content = row.content as { unit: string; price: number }
                    const isEditing = editingId === row.id
                    return (
                      <tr key={row.id} className="border-b last:border-0 bg-blue-50/30">
                        <td className="px-3 py-1.5 font-medium">{row.label}</td>
                        <td className="px-3 py-1.5 text-right">{content.unit}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {isEditing ? (
                            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) }) }}
                              className="w-20 px-1 py-0.5 rounded border text-right text-sm" autoFocus />
                          ) : (
                            `$${content.price.toLocaleString()}`
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-blue-600 font-medium">custom</span>
                            {isEditing ? (
                              <button onClick={() => updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) })}
                                className="text-xs text-green-600 hover:text-green-800 ml-1">save</button>
                            ) : (
                              <button onClick={() => { setEditingId(row.id); setEditPrice(String(content.price)) }}
                                className="text-xs text-blue-500 hover:text-blue-700 ml-1">edit</button>
                            )}
                            <button onClick={() => removeEntry.mutate(row.id)}
                              className="text-xs text-red-500 hover:text-red-700 ml-1">×</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Prohibited Phrases (CRUD)
// ============================================================
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
        {usingDefaults ? 'Using built-in defaults. Add phrases below to override.' : `${dbPhrases.length} phrases from database`}
      </p>

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
              <button onClick={() => removePhrase.mutate(row.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
