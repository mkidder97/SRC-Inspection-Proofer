import type { ESBlock } from '@/lib/es-templates'
import { interpolateTemplate } from '@/lib/es-templates'

interface BlockPaletteProps {
  blocks: ESBlock[]
  usedBlockIds: Set<string>
  reportData: Record<string, any>
  onInsert: (text: string, blockId: string) => void
}

export function BlockPalette({ blocks, usedBlockIds, reportData, onInsert }: BlockPaletteProps) {
  const coreBlocks = blocks.filter(b => b.category === 'core')
  const addonBlocks = blocks.filter(b => b.category === 'addon')

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Core Blocks</h3>
        <div className="space-y-1.5">
          {coreBlocks.map(block => (
            <BlockButton
              key={block.id}
              block={block}
              used={usedBlockIds.has(block.id)}
              reportData={reportData}
              onInsert={onInsert}
            />
          ))}
        </div>

        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">Add-On Blocks</h3>
        <div className="space-y-1.5">
          {addonBlocks.map(block => (
            <BlockButton
              key={block.id}
              block={block}
              used={usedBlockIds.has(block.id)}
              reportData={reportData}
              onInsert={onInsert}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BlockButton({ block, used, reportData, onInsert }: {
  block: ESBlock
  used: boolean
  reportData: Record<string, any>
  onInsert: (text: string, blockId: string) => void
}) {
  const preview = block.template
    ? interpolateTemplate(block.template, reportData).slice(0, 60) + '...'
    : 'Empty — type your own text'

  return (
    <button
      onClick={() => {
        if (block.id === 'custom') {
          onInsert('', block.id)
        } else {
          const filled = interpolateTemplate(block.template, reportData)
          onInsert(filled, block.id)
        }
      }}
      disabled={used && block.id !== 'custom'}
      className={`w-full text-left rounded-lg p-2.5 transition-all text-xs ${
        used && block.id !== 'custom'
          ? 'bg-green-50 border border-green-200 opacity-60 cursor-default'
          : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-medium text-gray-900">{block.label}</span>
        {used && block.id !== 'custom' && (
          <span className="text-green-600 text-[10px]">✓ Added</span>
        )}
      </div>
      <p className="text-gray-400 text-[11px] leading-relaxed truncate">{preview}</p>
    </button>
  )
}
