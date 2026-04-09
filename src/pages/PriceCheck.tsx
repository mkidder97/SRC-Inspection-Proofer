import { useState, useMemo } from 'react'
import { REPLACEMENT_PRICING, REPAIR_PRICING } from '@/lib/pricing-constants'
import { CLIENT_TYPES, CLIENT_TYPE_LABELS } from '@/lib/constants'
import type { ClientType } from '@/lib/constants'

const ROOF_SYSTEMS = [
  { value: 'recover_tpo', label: 'Recover — TPO/BUR Smooth/Mod Bit' },
  { value: 'recover_bur_gravel', label: 'Recover — BUR Gravel' },
  { value: 'tearoff_two', label: 'Tear-off Two Roofs → New TPO' },
  { value: 'tearoff_fully_adhered', label: 'Tear-off → Fully Adhered' },
  { value: 'tpo_infill_metal', label: 'TPO Infill Over Metal' },
  { value: 'epdm_swap', label: 'EPDM Membrane Swap' },
]

interface LineItem {
  id: number
  category: string
  description: string
  unit: string
  quantity: number
  unitPrice: number
}

export default function PriceCheck() {
  const [clientType, setClientType] = useState<ClientType | ''>('')
  const [roofSystem, setRoofSystem] = useState('')
  const [sqft, setSqft] = useState<number | ''>('')
  const [skylightCount, setSkylightCount] = useState(0)
  const [skylightType, setSkylightType] = useState<'4x4' | '4x8'>('4x4')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [nextId, setNextId] = useState(1)

  const pricing = useMemo(() => {
    if (!clientType || !roofSystem || !sqft) return null

    let basePsf: number | null = null
    const lookupKey = (obj: Record<string, number>, ...keys: string[]): number | null => {
      for (const k of keys) { if (k in obj) return obj[k] }
      return null
    }

    if (clientType === 'prologis_tx') {
      const p = REPLACEMENT_PRICING.prologis_texas as Record<string, number>
      if (roofSystem === 'recover_tpo') basePsf = p.recover_tpo
      else if (roofSystem === 'recover_bur_gravel') basePsf = p.recover_bur_gravel
      else if (roofSystem === 'tearoff_two') basePsf = p.tearoff_two_new_tpo
      else if (roofSystem === 'tearoff_fully_adhered') basePsf = p.tearoff_two_fully_adhered
      else if (roofSystem === 'tpo_infill_metal') basePsf = p.tpo_infill_over_metal
      else if (roofSystem === 'epdm_swap') basePsf = p.epdm_membrane_swap
    } else if (clientType === 'eastgroup_houston') {
      const p = REPLACEMENT_PRICING.non_prologis_texas as Record<string, number>
      if (roofSystem.includes('recover')) basePsf = p.eastgroup_hou_recover
      else if (roofSystem.includes('tearoff')) basePsf = p.eastgroup_hou_tearoff
      else basePsf = lookupKey(p, roofSystem)
    } else if (clientType === 'non_prologis_tx') {
      const p = REPLACEMENT_PRICING.non_prologis_texas as Record<string, number>
      if (roofSystem === 'recover_tpo') basePsf = p.recover_tpo_bur_smooth_modbit
      else if (roofSystem === 'recover_bur_gravel') basePsf = p.recover_bur_gravel
      else if (roofSystem === 'tearoff_two' || roofSystem === 'tearoff_fully_adhered') basePsf = p.tearoff_two_new_tpo
      else if (roofSystem === 'tpo_infill_metal') basePsf = p.tpo_infill_over_metal
      else if (roofSystem === 'epdm_swap') basePsf = p.epdm_membrane_swap
    } else {
      const p = REPLACEMENT_PRICING.non_prologis_general as Record<string, number>
      if (roofSystem === 'recover_tpo') basePsf = p.recover_tpo_bur_smooth_modbit
      else if (roofSystem === 'recover_bur_gravel') basePsf = p.recover_bur_gravel
      else if (roofSystem === 'tearoff_two' || roofSystem === 'tearoff_fully_adhered') basePsf = p.tearoff_two_roofs
      else if (roofSystem === 'tpo_infill_metal') basePsf = p.tpo_infill_over_metal
      else if (roofSystem === 'epdm_swap') basePsf = p.epdm_membrane_swap
    }

    if (basePsf === null) return null

    let economiesAdj = 0
    if (sqft < 100000) economiesAdj = ((100000 - sqft) / 25000) * 1.0
    else if (sqft >= 200000) economiesAdj = -1.0

    const adjustedPsf = basePsf + economiesAdj
    const skylightPrice = skylightType === '4x4' ? 1045 : 2035
    const skylightAdder = skylightCount * skylightPrice
    const membraneTotal = Math.round(adjustedPsf * sqft)
    const grandTotal = membraneTotal + skylightAdder

    return { basePsf, economiesAdj, adjustedPsf, membraneTotal, skylightAdder, skylightPrice, grandTotal }
  }, [clientType, roofSystem, sqft, skylightCount, skylightType])

  const lineItemTotal = lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0)

  function addLineItem() {
    setLineItems(prev => [...prev, { id: nextId, category: '', description: '', unit: 'ea', quantity: 1, unitPrice: 0 }])
    setNextId(n => n + 1)
  }

  function updateLineItem(id: number, field: keyof LineItem, value: any) {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }

  function removeLineItem(id: number) {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }

  // Flatten repair pricing for the dropdown
  const repairOptions = Object.entries(REPAIR_PRICING).flatMap(([cat, items]) =>
    items.map(item => ({ category: cat, ...item }))
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Price Check</h1>
        <p className="text-sm text-gray-500 mt-1">Quick capital expense and repair pricing calculator</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Capital Expense Calculator */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Capital Expense Estimate</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Type</label>
              <select value={clientType} onChange={e => setClientType(e.target.value as ClientType)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent">
                <option value="">Select...</option>
                {CLIENT_TYPES.map(ct => <option key={ct} value={ct}>{CLIENT_TYPE_LABELS[ct]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Replacement Type</label>
              <select value={roofSystem} onChange={e => setRoofSystem(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent">
                <option value="">Select...</option>
                {ROOF_SYSTEMS.map(rs => <option key={rs.value} value={rs.value}>{rs.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Square Footage</label>
              <input type="number" value={sqft} onChange={e => setSqft(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 45000"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Skylights</label>
                <input type="number" min={0} value={skylightCount} onChange={e => setSkylightCount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {skylightCount > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Dome Type</label>
                  <select value={skylightType} onChange={e => setSkylightType(e.target.value as '4x4' | '4x8')}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="4x4">4×4 ($1,045/ea)</option>
                    <option value="4x8">4×8 ($2,035/ea)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {pricing && (
            <div className="mt-5 pt-4 border-t space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Base rate</span>
                <span className="font-mono">${pricing.basePsf.toFixed(2)}/sqft</span>
              </div>
              {pricing.economiesAdj !== 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Economies of scale adj.</span>
                  <span className="font-mono">{pricing.economiesAdj > 0 ? '+' : ''}${pricing.economiesAdj.toFixed(2)}/sqft</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium text-gray-700">
                <span>Adjusted rate</span>
                <span className="font-mono">${pricing.adjustedPsf.toFixed(2)}/sqft</span>
              </div>
              <hr className="border-gray-100" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Membrane ({(sqft as number).toLocaleString()} sqft × ${pricing.adjustedPsf.toFixed(2)})</span>
                <span className="font-mono">${pricing.membraneTotal.toLocaleString()}</span>
              </div>
              {pricing.skylightAdder > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Skylights ({skylightCount} × ${pricing.skylightPrice.toLocaleString()})</span>
                  <span className="font-mono">${pricing.skylightAdder.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
                <span>Total Capital Expense</span>
                <span className="font-mono text-blue-700">${pricing.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Repair Line Items */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Repair Line Items</h2>
            <button onClick={addLineItem}
              className="px-3 py-1 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              + Add Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Click "Add Item" to start building a repair estimate</p>
          ) : (
            <div className="space-y-3">
              {lineItems.map(li => (
                <div key={li.id} className="rounded-lg border border-gray-150 p-3 space-y-2 bg-gray-50/50">
                  <div className="flex gap-2">
                    <select
                      value={`${li.category}|${li.description}`}
                      onChange={e => {
                        const [cat, desc] = e.target.value.split('|')
                        const match = repairOptions.find(r => r.category === cat && r.notes === desc)
                        if (match) updateLineItem(li.id, 'category', cat)
                        if (match) { updateLineItem(li.id, 'description', desc); updateLineItem(li.id, 'unitPrice', match.price); updateLineItem(li.id, 'unit', match.unit) }
                      }}
                      className="flex-1 px-2 py-1.5 rounded border text-xs bg-white"
                    >
                      <option value="">Select repair item...</option>
                      {Object.entries(REPAIR_PRICING).map(([cat, items]) => (
                        <optgroup key={cat} label={cat.replace(/_/g, ' ')}>
                          {items.map(item => (
                            <option key={`${cat}|${item.notes}`} value={`${cat}|${item.notes}`}>
                              {item.notes} — ${item.price}/{item.unit}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button onClick={() => removeLineItem(li.id)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Qty:</span>
                    <input type="number" min={1} value={li.quantity}
                      onChange={e => updateLineItem(li.id, 'quantity', Number(e.target.value) || 1)}
                      className="w-16 px-2 py-1 rounded border text-center" />
                    <span className="text-gray-500">×</span>
                    <span className="font-mono">${li.unitPrice}/{li.unit}</span>
                    <span className="ml-auto font-semibold font-mono">${(li.quantity * li.unitPrice).toLocaleString()}</span>
                  </div>
                </div>
              ))}

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-semibold text-gray-700">Repair Total</span>
                <span className="text-base font-bold font-mono text-blue-700">${lineItemTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
