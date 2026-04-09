import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { REPAIR_PRICING, REPLACEMENT_PRICING } from '@/lib/pricing-constants'
import { ES_PHRASE_CATEGORIES, DEFICIENCY_CATEGORIES } from '@/lib/constants'
import { toast } from 'sonner'

type Tab = 'replacement' | 'repair' | 'prohibited' | 'es_phrases' | 'deficiency_phrases'

export default function Library() {
  const [tab, setTab] = useState<Tab>('replacement')

  const tabs: [Tab, string][] = [
    ['replacement', 'Replacement Pricing'],
    ['repair', 'Repair Pricing'],
    ['prohibited', 'Prohibited Phrases'],
    ['es_phrases', 'ES Phrases'],
    ['deficiency_phrases', 'Deficiency Phrases'],
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reference Library</h1>
      <p className="text-sm text-gray-500 mb-6">Pricing, phrases, and templates used by the proofer engine</p>

      <div className="flex gap-0.5 border-b mb-6 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'replacement' && <ReplacementPricingTab />}
      {tab === 'repair' && <RepairPricingTab />}
      {tab === 'prohibited' && <ProhibitedPhrasesTab />}
      {tab === 'es_phrases' && <ESPhrasesTab />}
      {tab === 'deficiency_phrases' && <DeficiencyPhrasesTab />}
    </div>
  )
}

// ============================================================
// Replacement Pricing (CRUD — DB overrides built-in)
// ============================================================
const REPLACEMENT_CATEGORIES = Object.keys(REPLACEMENT_PRICING)

function ReplacementPricingTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addCat, setAddCat] = useState(REPLACEMENT_CATEGORIES[0])
  const [addKey, setAddKey] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')

  const { data: dbRows } = useQuery({
    queryKey: ['ref-library', 'cost_table'],
    queryFn: async () => {
      const { data } = await supabase.from('reference_library').select('*')
        .eq('entry_type', 'cost_table').eq('is_active', true)
      return data || []
    },
  })

  const addEntry = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'cost_table', service_type: addCat, label: addKey,
        content: { price: parseFloat(addPrice) }, uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Price added'); setAddKey(''); setAddPrice(''); setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['ref-library', 'cost_table'] }) },
    onError: (e) => toast.error(e.message),
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await supabase.from('reference_library').update({ content: { price } }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Updated'); setEditingId(null); queryClient.invalidateQueries({ queryKey: ['ref-library', 'cost_table'] }) },
  })

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['ref-library', 'cost_table'] }) },
  })

  const dbByCat: Record<string, any[]> = {}
  for (const row of dbRows || []) { const c = row.service_type || 'misc'; if (!dbByCat[c]) dbByCat[c] = []; dbByCat[c].push(row) }
  const hasCustom = (dbRows?.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">{hasCustom ? `${dbRows!.length} custom overrides` : 'Using built-in defaults'}</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700">
          {showAdd ? 'Cancel' : 'Add Override'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                {REPLACEMENT_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type Key</label>
              <input value={addKey} onChange={e => setAddKey(e.target.value)} placeholder="e.g. recover_tpo" className="w-full px-2 py-1.5 rounded border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">$/sqft</label>
              <input type="number" step="0.25" value={addPrice} onChange={e => setAddPrice(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" />
            </div>
          </div>
          <button onClick={() => addKey && addPrice && addEntry.mutate()} disabled={!addKey || !addPrice}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      )}

      {REPLACEMENT_CATEGORIES.map(category => {
        const builtIn = (REPLACEMENT_PRICING as any)[category] || {}
        const custom = dbByCat[category] || []
        const customKeys = new Set(custom.map((r: any) => (r.label || '').toLowerCase()))

        return (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">$/sqft</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Source</th>
                </tr></thead>
                <tbody>
                  {Object.entries(builtIn).filter(([k]) => !customKeys.has(k.toLowerCase())).map(([key, val]) => (
                    <tr key={`b-${key}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{key.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-1.5 text-right font-mono">${(val as number).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right"><span className="text-xs text-gray-400">built-in</span></td>
                    </tr>
                  ))}
                  {custom.map((row: any) => {
                    const price = (row.content as any)?.price
                    const isEd = editingId === row.id
                    return (
                      <tr key={row.id} className="border-b last:border-0 bg-blue-50/30">
                        <td className="px-3 py-1.5 font-medium">{row.label?.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {isEd ? <input type="number" step="0.25" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) })}
                            className="w-20 px-1 py-0.5 rounded border text-right text-sm" autoFocus />
                          : `$${price?.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-blue-600 font-medium">custom</span>
                            {isEd ? <button onClick={() => updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) })} className="text-xs text-green-600 ml-1">save</button>
                            : <button onClick={() => { setEditingId(row.id); setEditPrice(String(price)) }} className="text-xs text-blue-500 ml-1">edit</button>}
                            <button onClick={() => removeEntry.mutate(row.id)} className="text-xs text-red-500 ml-1">×</button>
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
// Repair Pricing (CRUD — unchanged from before)
// ============================================================
const REPAIR_CATEGORIES = Object.keys(REPAIR_PRICING)

function RepairPricingTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addCat, setAddCat] = useState(REPAIR_CATEGORIES[0])
  const [addNotes, setAddNotes] = useState('')
  const [addUnit, setAddUnit] = useState('ea')
  const [addPrice, setAddPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')

  const { data: dbRows } = useQuery({
    queryKey: ['ref-library', 'repair_pricing'],
    queryFn: async () => {
      const { data } = await supabase.from('reference_library').select('*')
        .eq('entry_type', 'repair_pricing').eq('is_active', true)
      return data || []
    },
  })

  const addEntry = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'repair_pricing', service_type: addCat, label: addNotes,
        content: { unit: addUnit, price: parseFloat(addPrice) }, uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Added'); setAddNotes(''); setAddPrice(''); setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] }) },
    onError: (e) => toast.error(e.message),
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const row = dbRows?.find((r: any) => r.id === id)
      const content = row?.content as any
      const { error } = await supabase.from('reference_library').update({ content: { ...content, price } }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Updated'); setEditingId(null); queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] }) },
  })

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['ref-library', 'repair_pricing'] }) },
  })

  const dbByCat: Record<string, any[]> = {}
  for (const row of dbRows || []) { const c = row.service_type || 'misc'; if (!dbByCat[c]) dbByCat[c] = []; dbByCat[c].push(row) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">{(dbRows?.length ?? 0) > 0 ? `${dbRows!.length} custom entries` : 'Using built-in defaults'}</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700">
          {showAdd ? 'Cancel' : 'Add Entry'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><label className="block text-xs font-medium mb-1">Category</label>
              <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                {REPAIR_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium mb-1">Description</label>
              <input value={addNotes} onChange={e => setAddNotes(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Unit</label>
              <select value={addUnit} onChange={e => setAddUnit(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                <option value="ea">ea</option><option value="lf">lf</option>
              </select></div>
            <div><label className="block text-xs font-medium mb-1">Price ($)</label>
              <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm" /></div>
          </div>
          <button onClick={() => addNotes && addPrice && addEntry.mutate()} disabled={!addNotes || !addPrice}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Save</button>
        </div>
      )}

      {REPAIR_CATEGORIES.map(category => {
        const builtIn = REPAIR_PRICING[category] || []
        const custom = dbByCat[category] || []
        const customLabels = new Set(custom.map((r: any) => (r.label || '').toLowerCase()))
        return (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Unit</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Source</th>
                </tr></thead>
                <tbody>
                  {builtIn.filter(item => !customLabels.has(item.notes.toLowerCase())).map((item, i) => (
                    <tr key={`b-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{item.notes}</td>
                      <td className="px-3 py-1.5 text-right">{item.unit}</td>
                      <td className="px-3 py-1.5 text-right font-mono">${item.price.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right"><span className="text-xs text-gray-400">built-in</span></td>
                    </tr>
                  ))}
                  {custom.map((row: any) => {
                    const c = row.content as { unit: string; price: number }
                    const isEd = editingId === row.id
                    return (
                      <tr key={row.id} className="border-b last:border-0 bg-blue-50/30">
                        <td className="px-3 py-1.5 font-medium">{row.label}</td>
                        <td className="px-3 py-1.5 text-right">{c.unit}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {isEd ? <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) })}
                            className="w-20 px-1 py-0.5 rounded border text-right text-sm" autoFocus />
                          : `$${c.price.toLocaleString()}`}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-blue-600 font-medium">custom</span>
                            {isEd ? <button onClick={() => updateEntry.mutate({ id: row.id, price: parseFloat(editPrice) })} className="text-xs text-green-600 ml-1">save</button>
                            : <button onClick={() => { setEditingId(row.id); setEditPrice(String(c.price)) }} className="text-xs text-blue-500 ml-1">edit</button>}
                            <button onClick={() => removeEntry.mutate(row.id)} className="text-xs text-red-500 ml-1">×</button>
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
// Prohibited Phrases (with recommended alternatives)
// ============================================================
function ProhibitedPhrasesTab() {
  const queryClient = useQueryClient()
  const [newPhrase, setNewPhrase] = useState('')
  const [newReplacement, setNewReplacement] = useState('')

  const { data: dbPhrases, isLoading } = useQuery({
    queryKey: ['ref-library', 'prohibited_phrase'],
    queryFn: async () => {
      const { data } = await supabase.from('reference_library').select('*')
        .eq('entry_type', 'prohibited_phrase').eq('is_active', true).order('label')
      return data || []
    },
  })

  const addPhrase = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'prohibited_phrase', label: newPhrase.trim(),
        content: newReplacement.trim() ? { replacement: newReplacement.trim() } : null,
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Added'); setNewPhrase(''); setNewReplacement(''); queryClient.invalidateQueries({ queryKey: ['ref-library', 'prohibited_phrase'] }) },
    onError: (e) => toast.error(e.message),
  })

  const removePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['ref-library', 'prohibited_phrase'] }) },
  })

  const defaults = [
    { phrase: 'structurally sound', rec: 'appears to be in serviceable condition' },
    { phrase: 'no structural concerns', rec: 'no significant structural issues were observed' },
    { phrase: 'guaranteed', rec: 'based on our assessment' },
    { phrase: 'warranted', rec: 'recommended' },
    { phrase: 'will not leak', rec: 'is expected to perform adequately' },
    { phrase: 'no further action required', rec: 'routine maintenance is recommended' },
    { phrase: 'fully compliant', rec: 'appears to meet applicable standards' },
    { phrase: 'covered by insurance', rec: '' },
    { phrase: 'insurance will pay', rec: '' },
    { phrase: 'meets all code requirements', rec: 'appears to conform to applicable codes' },
    { phrase: 'code compliant', rec: 'appears to conform to applicable codes' },
  ]
  const usingDefaults = !dbPhrases?.length

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        {usingDefaults ? 'Using built-in defaults. Add phrases below to override.' : `${dbPhrases.length} phrases from database`}
      </p>

      {/* Add form */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Prohibited Phrase</label>
            <input value={newPhrase} onChange={e => setNewPhrase(e.target.value)} placeholder="e.g. structurally sound"
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Recommended Alternative <span className="text-gray-400">(optional)</span></label>
            <input value={newReplacement} onChange={e => setNewReplacement(e.target.value)} placeholder="e.g. appears to be in serviceable condition"
              className="w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <button onClick={() => newPhrase.trim() && addPhrase.mutate()} disabled={!newPhrase.trim()}
          className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Add Phrase</button>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 font-medium text-red-500">Prohibited</th>
            <th className="text-left px-3 py-2 font-medium text-green-600">Recommended Alternative</th>
            <th className="px-3 py-2 w-20"></th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={3} className="px-3 py-4 text-gray-400">Loading...</td></tr>
            : usingDefaults ? defaults.map(d => (
              <tr key={d.phrase} className="border-b last:border-0">
                <td className="px-3 py-2 text-red-700">{d.phrase}</td>
                <td className="px-3 py-2 text-green-700 italic">{d.rec || '—'}</td>
                <td className="px-3 py-2 text-right"><span className="text-xs text-gray-400">built-in</span></td>
              </tr>
            )) : dbPhrases.map((row: any) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-red-700 font-medium">{row.label}</td>
                <td className="px-3 py-2 text-green-700 italic">{(row.content as any)?.replacement || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removePhrase.mutate(row.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// ES Phrases Library
// ============================================================
function ESPhrasesTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addCat, setAddCat] = useState<string>(ES_PHRASE_CATEGORIES[0])
  const [addLabel, setAddLabel] = useState('')
  const [addText, setAddText] = useState('')

  const { data: dbPhrases } = useQuery({
    queryKey: ['ref-library', 'es_phrase'],
    queryFn: async () => {
      const { data } = await supabase.from('reference_library').select('*')
        .eq('entry_type', 'es_phrase').eq('is_active', true).order('service_type').order('label')
      return data || []
    },
  })

  const addPhrase = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'es_phrase', service_type: addCat, label: addLabel.trim(),
        content: { text: addText.trim() }, uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Added'); setAddLabel(''); setAddText(''); setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['ref-library', 'es_phrase'] }) },
    onError: (e) => toast.error(e.message),
  })

  const removePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['ref-library', 'es_phrase'] }) },
  })

  const grouped: Record<string, any[]> = {}
  for (const row of dbPhrases || []) { const c = row.service_type || 'general'; if (!grouped[c]) grouped[c] = []; grouped[c].push(row) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Reusable phrases for the Executive Summary Builder. Click to insert in the editor.</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700">
          {showAdd ? 'Cancel' : 'Add Phrase'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium mb-1">Category</label>
              <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                {ES_PHRASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="col-span-2"><label className="block text-xs font-medium mb-1">Label</label>
              <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="Short name" className="w-full px-2 py-1.5 rounded border text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium mb-1">Phrase Text</label>
            <textarea value={addText} onChange={e => setAddText(e.target.value)} placeholder="The full phrase or sentence..."
              rows={3} className="w-full px-2 py-1.5 rounded border text-sm resize-none" /></div>
          <button onClick={() => addLabel && addText && addPhrase.mutate()} disabled={!addLabel || !addText}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Save Phrase</button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm mb-1">No ES phrases yet</p>
          <p className="text-xs">Add reusable phrases that will appear in the Summary Builder</p>
        </div>
      ) : Object.entries(grouped).map(([cat, phrases]) => (
        <div key={cat} className="mb-5">
          <h3 className="text-sm font-semibold mb-2 capitalize">{cat}</h3>
          <div className="space-y-1.5">
            {phrases.map((row: any) => (
              <div key={row.id} className="bg-white rounded-lg border p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-800">{row.label}</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{(row.content as any)?.text}</p>
                </div>
                <button onClick={() => removePhrase.mutate(row.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">Remove</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Deficiency Phrases Library
// ============================================================
function DeficiencyPhrasesTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addCat, setAddCat] = useState(DEFICIENCY_CATEGORIES[0])
  const [addLabel, setAddLabel] = useState('')
  const [addText, setAddText] = useState('')
  const [addUnit, setAddUnit] = useState('ea')
  const [addCost, setAddCost] = useState('')

  const { data: dbPhrases } = useQuery({
    queryKey: ['ref-library', 'deficiency_phrase'],
    queryFn: async () => {
      const { data } = await supabase.from('reference_library').select('*')
        .eq('entry_type', 'deficiency_phrase').eq('is_active', true).order('service_type').order('label')
      return data || []
    },
  })

  const addPhrase = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reference_library').insert({
        entry_type: 'deficiency_phrase', service_type: addCat, label: addLabel.trim(),
        content: { text: addText.trim(), unit: addUnit, default_cost: addCost ? parseFloat(addCost) : null },
        uploaded_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Added'); setAddLabel(''); setAddText(''); setAddCost(''); setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['ref-library', 'deficiency_phrase'] }) },
    onError: (e) => toast.error(e.message),
  })

  const removePhrase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_library').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Removed'); queryClient.invalidateQueries({ queryKey: ['ref-library', 'deficiency_phrase'] }) },
  })

  const grouped: Record<string, any[]> = {}
  for (const row of dbPhrases || []) { const c = row.service_type || 'General'; if (!grouped[c]) grouped[c] = []; grouped[c].push(row) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Standard deficiency descriptions for consistent reporting</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700">
          {showAdd ? 'Cancel' : 'Add Phrase'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><label className="block text-xs font-medium mb-1">Category</label>
              <select value={addCat} onChange={e => setAddCat(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                {DEFICIENCY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="col-span-3"><label className="block text-xs font-medium mb-1">Short Label</label>
              <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="e.g. Seal storm collar" className="w-full px-2 py-1.5 rounded border text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium mb-1">Full Description</label>
            <textarea value={addText} onChange={e => setAddText(e.target.value)} placeholder="Complete deficiency description..."
              rows={2} className="w-full px-2 py-1.5 rounded border text-sm resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Unit</label>
              <select value={addUnit} onChange={e => setAddUnit(e.target.value)} className="w-full px-2 py-1.5 rounded border text-sm bg-white">
                <option value="ea">ea</option><option value="lf">lf</option>
              </select></div>
            <div><label className="block text-xs font-medium mb-1">Default Cost ($)</label>
              <input type="number" value={addCost} onChange={e => setAddCost(e.target.value)} placeholder="Optional" className="w-full px-2 py-1.5 rounded border text-sm" /></div>
          </div>
          <button onClick={() => addLabel && addText && addPhrase.mutate()} disabled={!addLabel || !addText}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Save Phrase</button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm mb-1">No deficiency phrases yet</p>
          <p className="text-xs">Add standard descriptions for consistent deficiency reporting</p>
        </div>
      ) : Object.entries(grouped).map(([cat, phrases]) => (
        <div key={cat} className="mb-5">
          <h3 className="text-sm font-semibold mb-2">{cat}</h3>
          <div className="space-y-1.5">
            {phrases.map((row: any) => {
              const c = row.content as any
              return (
                <div key={row.id} className="bg-white rounded-lg border p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-gray-800">{row.label}</p>
                      {c?.default_cost && <span className="text-[10px] font-mono text-gray-400">${c.default_cost}/{c?.unit || 'ea'}</span>}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{c?.text}</p>
                  </div>
                  <button onClick={() => removePhrase.mutate(row.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">Remove</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
