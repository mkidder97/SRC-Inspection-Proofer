import { useState, useCallback, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { BlockPalette } from '@/components/summary/BlockPalette'
import { ReportDataPanel } from '@/components/summary/ReportDataPanel'
import { WorkflowSteps } from '@/components/WorkflowSteps'
import { ANNUAL_PM_BLOCKS, interpolateTemplate } from '@/lib/es-templates'
import { toast } from 'sonner'

export default function SummaryBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [usedBlocks, setUsedBlocks] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const { data: report } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const reportData = useMemo(() => {
    const corrected = (report?.corrected_data || report?.extracted_data || {}) as Record<string, any>
    const ctx = (report?.proofer_context || {}) as Record<string, any>
    return {
      ...corrected,
      deficiency_count: corrected.deficiencies?.length ?? 0,
      skylight_count: ctx.skylight_count ?? 0,
      years_until_replacement: corrected.replacement_year ? corrected.replacement_year - new Date().getFullYear() : null,
      ...ctx,
    }
  }, [report])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Click a template block on the left to start building your executive summary...',
      }),
    ],
    content: report?.executive_summary_draft || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[500px] px-6 py-5 text-gray-800 leading-relaxed',
      },
    },
  })

  // Load existing draft
  useEffect(() => {
    if (editor && report?.executive_summary_draft && !editor.getText().trim()) {
      editor.commands.setContent(report.executive_summary_draft)
    }
  }, [editor, report?.executive_summary_draft])

  // Auto-save (debounced)
  useEffect(() => {
    if (!editor || !id) return
    const handler = setTimeout(() => {
      const html = editor.getHTML()
      if (html === '<p></p>' || !html.trim()) return
      supabase.from('reports').update({ executive_summary_draft: html }).eq('id', id)
        .then(() => setLastSaved(new Date().toLocaleTimeString()))
    }, 2000)
    return () => clearTimeout(handler)
  }, [editor?.getHTML(), id])

  function handleInsertBlock(text: string, blockId: string) {
    if (!editor) return
    if (blockId === 'custom') {
      editor.chain().focus().insertContent('<p></p>').run()
    } else {
      editor.chain().focus().insertContent(`<p>${text}</p><p></p>`).run()
      setUsedBlocks(prev => new Set([...prev, blockId]))
    }
  }

  function handleInsertReference(text: string) {
    if (!editor) return
    editor.chain().focus().insertContent(text).run()
  }

  // AI Draft
  const aiDraft = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('draft-executive-summary', {
        body: { reportId: id },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      if (editor && data?.draft) {
        const proceed = !editor.getText().trim() || confirm('Replace current content with AI draft?')
        if (proceed) {
          editor.commands.setContent(data.draft)
          toast.success('AI draft loaded — review and edit before finalizing')
        }
      }
    },
    onError: (err) => toast.error(`Draft failed: ${err.message}`),
  })

  // Export
  const exportCorrections = useMutation({
    mutationFn: async () => {
      // Save the ES draft first
      if (editor) {
        await supabase.from('reports').update({
          executive_summary_draft: editor.getHTML(),
        }).eq('id', id!)
      }
      const { data, error } = await supabase.functions.invoke('export-corrections', {
        body: { reportId: id },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      const m = data.metadata || {}
      const address = m.property_address || 'report'
      const date = m.inspection_date || new Date().toISOString().split('T')[0]
      const filename = `corrections-${address.replace(/[^a-zA-Z0-9]/g, '-')}-${date}.txt`

      // Build text with ES
      let text = formatCorrections(data)
      if (editor) {
        text += '\n\nEXECUTIVE SUMMARY\n' + '='.repeat(40) + '\n'
        text += editor.getText()
      }

      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    },
    onError: (err) => toast.error(`Export failed: ${err.message}`),
  })

  if (!report) return <div className="p-8 text-gray-400">Loading...</div>

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <WorkflowSteps current="summary" reportId={id} />

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Block Palette */}
        <div className="w-[220px] border-r bg-gray-50/80 flex-shrink-0">
          <div className="px-3 py-2.5 border-b bg-white">
            <h3 className="text-xs font-semibold text-gray-700">Template Blocks</h3>
          </div>
          <BlockPalette
            blocks={ANNUAL_PM_BLOCKS}
            usedBlockIds={usedBlocks}
            reportData={reportData}
            onInsert={handleInsertBlock}
          />
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50/50">
            <div className="flex items-center gap-2">
              {editor && (
                <>
                  <button onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>B</button>
                  <button onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`px-2 py-1 rounded text-xs italic ${editor.isActive('italic') ? 'bg-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>I</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                </>
              )}
              <button
                onClick={() => aiDraft.mutate()}
                disabled={aiDraft.isPending}
                className="px-3 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {aiDraft.isPending ? 'Drafting...' : '✨ Draft with AI'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {lastSaved && <span className="text-[10px] text-gray-400">Saved {lastSaved}</span>}
              <button
                onClick={() => exportCorrections.mutate()}
                disabled={exportCorrections.isPending}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {exportCorrections.isPending ? 'Exporting...' : 'Export Final Package'}
              </button>
            </div>
          </div>

          {/* Tiptap editor */}
          <div className="flex-1 overflow-y-auto">
            {editor && <EditorContent editor={editor} />}
          </div>
        </div>

        {/* Right: Report Data */}
        <div className="w-[260px] border-l bg-gray-50/80 flex-shrink-0">
          <div className="px-3 py-2.5 border-b bg-white">
            <h3 className="text-xs font-semibold text-gray-700">Report Data</h3>
          </div>
          <ReportDataPanel
            data={reportData}
            context={(report?.proofer_context || {}) as Record<string, any>}
            onInsertReference={handleInsertReference}
          />
        </div>
      </div>
    </div>
  )
}

function formatCorrections(data: any): string {
  const m = data.metadata || {}
  const lines: string[] = [
    'SRC INSPECTION REPORT — CORRECTIONS SUMMARY',
    '='.repeat(44),
    `Property: ${m.property_address || 'N/A'} | Date: ${m.inspection_date || 'N/A'} | Type: ${m.service_type || 'N/A'}`,
    `Exported: ${m.exported_at || new Date().toISOString()}`,
    '',
    `Total: ${data.summary?.total ?? 0} | Accepted: ${data.summary?.accepted ?? 0} | Edited: ${data.summary?.edited ?? 0} | Dismissed: ${data.summary?.dismissed ?? 0}`,
    '',
  ]
  for (const c of (data.corrections || [])) {
    lines.push(`[${c.flag_type?.toUpperCase()}] ${c.field_label}`)
    if (c.current_value) lines.push(`  Original: ${c.current_value}`)
    if (c.resolution_value) lines.push(`  Corrected: ${c.resolution_value}`)
    lines.push('')
  }
  for (const d of (data.dismissed || [])) {
    lines.push(`[DISMISSED] ${d.field_label}`)
    if (d.dismiss_reason) lines.push(`  Reason: ${d.dismiss_reason}`)
    lines.push('')
  }
  return lines.join('\n')
}
