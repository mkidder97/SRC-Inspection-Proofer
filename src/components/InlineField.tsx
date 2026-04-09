import { useState, useRef, useEffect } from 'react'

interface InlineFieldProps {
  label: string
  value: any
  onChange: (value: any) => void
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  confidence?: number | null
  placeholder?: string
}

export function InlineField({
  label, value, onChange, type = 'text', options, confidence, placeholder,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const isEmpty = value === null || value === undefined || value === ''
  const confColor = isEmpty ? '#ef4444' : (confidence ?? 1) >= 0.9 ? '#22c55e' : (confidence ?? 1) >= 0.7 ? '#eab308' : '#ef4444'

  function handleSave() {
    const parsed = type === 'number' ? (draft === '' ? null : Number(draft)) : draft || null
    onChange(parsed)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="group">
        <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
        <div className="flex items-center gap-1.5">
          {type === 'select' && options ? (
            <select
              ref={inputRef as any}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select...</option>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : type === 'textarea' ? (
            <textarea
              ref={inputRef as any}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <input
              ref={inputRef as any}
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}
          <button onClick={handleSave} className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">Save</button>
          <button onClick={() => { setDraft(String(value ?? '')); setEditing(false) }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-colors"
      onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
    >
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: confColor }}
          title={isEmpty ? 'Not found' : `Confidence: ${Math.round((confidence ?? 1) * 100)}%`}
        />
        <span className={`text-sm ${isEmpty ? 'text-red-500 italic' : 'text-gray-900'}`}>
          {isEmpty ? (placeholder || '[Not found — click to enter]') : (
            type === 'number' && typeof value === 'number' ? value.toLocaleString() : String(value)
          )}
        </span>
        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">Edit</span>
      </div>
    </div>
  )
}
