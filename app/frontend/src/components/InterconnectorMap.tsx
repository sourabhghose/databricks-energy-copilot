import type { InterconnectorFlow } from '../api/client'

export interface InterconnectorMapProps {
  flows: InterconnectorFlow[]
}

// SVG layout positions for each NEM region node (cx, cy)
const REGION_POS: Record<string, { cx: number; cy: number }> = {
  QLD1: { cx: 340, cy:  70 },
  NSW1: { cx: 340, cy: 185 },
  VIC1: { cx: 280, cy: 300 },
  SA1:  { cx: 130, cy: 265 },
  TAS1: { cx: 230, cy: 400 },
}

const REGION_COLORS: Record<string, string> = {
  QLD1: '#F59E0B',
  NSW1: '#3B82F6',
  VIC1: '#8B5CF6',
  SA1:  '#EF4444',
  TAS1: '#10B981',
}

interface FlowArrowProps {
  flow: InterconnectorFlow
}

function FlowArrow({ flow }: FlowArrowProps) {
  const from = REGION_POS[flow.from]
  const to   = REGION_POS[flow.to]
  if (!from || !to) return null

  // Positive flow = exporting from `from` to `to`
  const isExport = flow.flowMw >= 0
  // Arrow points in the direction of flow
  const srcX = isExport ? from.cx : to.cx
  const srcY = isExport ? from.cy : to.cy
  const dstX = isExport ? to.cx   : from.cx
  const dstY = isExport ? to.cy   : from.cy

  const color = isExport ? '#10B981' : '#EF4444'

  // Midpoint for label
  const midX = (from.cx + to.cx) / 2
  const midY = (from.cy + to.cy) / 2

  // Utilization for stroke width
  const utilPct = flow.limitMw > 0 ? Math.abs(flow.flowMw) / flow.limitMw : 0
  const strokeWidth = Math.max(1.5, utilPct * 5)

  return (
    <g>
      <defs>
        <marker
          id={`arrow-${flow.id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={srcX}
        y1={srcY}
        x2={dstX}
        y2={dstY}
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#arrow-${flow.id})`}
        opacity={0.85}
      />
      {/* Flow label */}
      <rect
        x={midX - 28}
        y={midY - 11}
        width={56}
        height={18}
        rx={4}
        fill="white"
        stroke={color}
        strokeWidth={1}
        opacity={0.9}
      />
      <text
        x={midX}
        y={midY + 3}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill={color}
      >
        {flow.id}: {Math.abs(flow.flowMw).toFixed(0)} MW
      </text>
    </g>
  )
}

function RegionNode({ id }: { id: string }) {
  const pos = REGION_POS[id]
  if (!pos) return null
  const color = REGION_COLORS[id] ?? '#6B7280'

  return (
    <g>
      <circle cx={pos.cx} cy={pos.cy} r={28} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
      <text
        x={pos.cx}
        y={pos.cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="700"
        fill={color}
      >
        {id}
      </text>
    </g>
  )
}

export default function InterconnectorMap({ flows }: InterconnectorMapProps) {
  const regions = Object.keys(REGION_POS)

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded"></span>
          Export (flow direction)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 bg-red-500 rounded"></span>
          Import (flow direction)
        </span>
        <span className="text-gray-400">Arrow width proportional to utilisation</span>
      </div>

      <svg
        viewBox="0 0 490 460"
        className="w-full max-w-lg mx-auto"
        aria-label="NEM interconnector flow diagram"
        role="img"
      >
        {/* Draw flow arrows first (below nodes) */}
        {flows.map(f => (
          <FlowArrow key={f.id} flow={f} />
        ))}
        {/* Draw region nodes on top */}
        {regions.map(id => (
          <RegionNode key={id} id={id} />
        ))}
      </svg>

      {/* Flow table */}
      {flows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-100">
                <th className="pb-1 pr-4 font-medium">Interconnector</th>
                <th className="pb-1 pr-4 font-medium">From</th>
                <th className="pb-1 pr-4 font-medium">To</th>
                <th className="pb-1 pr-4 font-medium">Flow (MW)</th>
                <th className="pb-1 font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {flows.map(f => {
                const utilPct = f.limitMw > 0 ? (Math.abs(f.flowMw) / f.limitMw) * 100 : 0
                const isExport = f.flowMw >= 0
                return (
                  <tr key={f.id} className="border-b border-gray-50">
                    <td className="py-1 pr-4 font-mono font-semibold text-gray-700">{f.id}</td>
                    <td className="py-1 pr-4 text-gray-600">{f.from}</td>
                    <td className="py-1 pr-4 text-gray-600">{f.to}</td>
                    <td className={`py-1 pr-4 font-mono font-semibold ${isExport ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isExport ? '+' : ''}{f.flowMw.toFixed(0)}
                    </td>
                    <td className="py-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${utilPct > 80 ? 'bg-red-500' : utilPct > 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                        <span className="text-gray-500">{utilPct.toFixed(0)}%</span>
                      </div>
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
