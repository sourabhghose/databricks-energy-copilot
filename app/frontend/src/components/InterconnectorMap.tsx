import type { InterconnectorFlow } from '../api/client'

export interface InterconnectorMapProps {
  flows: InterconnectorFlow[]
}

// ---------------------------------------------------------------------------
// Fixed SVG positions for the 5 NEM region nodes (500 x 450 canvas)
// ---------------------------------------------------------------------------
const REGION_POS: Record<string, { cx: number; cy: number }> = {
  QLD1: { cx: 250, cy:  60 },
  NSW1: { cx: 330, cy: 180 },
  VIC1: { cx: 280, cy: 310 },
  SA1:  { cx: 130, cy: 300 },
  TAS1: { cx: 270, cy: 420 },
}

const REGION_COLORS: Record<string, string> = {
  QLD1: '#F59E0B',
  NSW1: '#3B82F6',
  VIC1: '#8B5CF6',
  SA1:  '#EF4444',
  TAS1: '#10B981',
}

// Static default flows used when no data is passed
const STATIC_FLOWS: InterconnectorFlow[] = [
  { id: 'QNI',        from: 'QLD1', to: 'NSW1', flowMw:    0, limitMw: 1078 },
  { id: 'VIC1-NSW1',  from: 'VIC1', to: 'NSW1', flowMw:    0, limitMw: 1600 },
  { id: 'V-SA',       from: 'VIC1', to: 'SA1',  flowMw:    0, limitMw:  600 },
  { id: 'V-TAS',      from: 'VIC1', to: 'TAS1', flowMw:    0, limitMw:  594 },
  { id: 'Murraylink', from: 'SA1',  to: 'VIC1', flowMw:    0, limitMw:  220 },
]

// ---------------------------------------------------------------------------
// Murraylink is drawn offset from V-SA so they don't overlap.
// We perpendicular-offset the line by ±12px.
// ---------------------------------------------------------------------------
function perpendicularOffset(
  x1: number, y1: number,
  x2: number, y2: number,
  amount: number
): { ox: number; oy: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return { ox: (-dy / len) * amount, oy: (dx / len) * amount }
}

// ---------------------------------------------------------------------------
// Determine line colour based on flow direction / zero
// ---------------------------------------------------------------------------
function flowColor(flowMw: number): string {
  if (flowMw > 0) return '#10B981'   // green — exporting
  if (flowMw < 0) return '#EF4444'   // red   — importing
  return '#9CA3AF'                    // gray  — no flow
}

// ---------------------------------------------------------------------------
// Single interconnector line with arrowhead
// ---------------------------------------------------------------------------
interface FlowLineProps {
  flow: InterconnectorFlow
  /** Optional perpendicular pixel offset for parallel lines (e.g. Murraylink) */
  offset?: number
  dashed?: boolean
}

function FlowLine({ flow, offset = 0, dashed = false }: FlowLineProps) {
  const from = REGION_POS[flow.from]
  const to   = REGION_POS[flow.to]
  if (!from || !to) return null

  const color = flowColor(flow.flowMw)

  // Utilization drives stroke width: min 1px, max 6px
  const utilPct = flow.limitMw > 0 ? Math.abs(flow.flowMw) / flow.limitMw : 0
  const strokeWidth = Math.max(1, Math.min(6, 1 + utilPct * 5))

  // Apply perpendicular offset
  const { ox, oy } = perpendicularOffset(from.cx, from.cy, to.cx, to.cy, offset)
  const x1 = from.cx + ox
  const y1 = from.cy + oy
  const x2 = to.cx   + ox
  const y2 = to.cy   + oy

  // Arrow direction: positive flow goes from→to; negative goes to→from
  const isForward = flow.flowMw >= 0
  const srcX = isForward ? x1 : x2
  const srcY = isForward ? y1 : y2
  const dstX = isForward ? x2 : x1
  const dstY = isForward ? y2 : y1

  // Midpoint for label
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  const markerId = `arrow-${flow.id.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerWidth="7"
          markerHeight="7"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L7,3 z" fill={color} />
        </marker>
      </defs>

      <line
        x1={srcX}
        y1={srcY}
        x2={dstX}
        y2={dstY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? '6 3' : undefined}
        markerEnd={`url(#${markerId})`}
        opacity={0.9}
      />

      {/* MW label at midpoint */}
      <rect
        x={midX - 26}
        y={midY - 9}
        width={52}
        height={16}
        rx={3}
        fill="white"
        stroke={color}
        strokeWidth={0.8}
        opacity={0.92}
      />
      <text
        x={midX}
        y={midY + 4}
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill={color}
      >
        {Math.abs(flow.flowMw).toFixed(0)} MW
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Region node circle + label
// ---------------------------------------------------------------------------
function RegionNode({ id }: { id: string }) {
  const pos = REGION_POS[id]
  if (!pos) return null
  const color = REGION_COLORS[id] ?? '#6B7280'

  return (
    <g>
      <circle
        cx={pos.cx}
        cy={pos.cy}
        r={26}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={pos.cx}
        y={pos.cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        fontWeight="700"
        fill={color}
      >
        {id}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InterconnectorMap({ flows }: InterconnectorMapProps) {
  const displayFlows = flows.length > 0 ? flows : STATIC_FLOWS
  const regions = Object.keys(REGION_POS)

  // Find each named interconnector in the live data
  const getFlow = (id: string) =>
    displayFlows.find(f => f.id === id) ??
    STATIC_FLOWS.find(f => f.id === id)!

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded" />
          Export (positive flow)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-red-500 rounded" />
          Import (negative flow)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-gray-400 rounded" />
          No flow
        </span>
        <span className="text-gray-400">Line width proportional to utilisation</span>
      </div>

      <svg
        viewBox="0 0 500 450"
        className="w-full max-w-lg mx-auto"
        aria-label="NEM interconnector flow diagram"
        role="img"
      >
        {/* Draw flow lines first (behind nodes) */}

        {/* QNI: QLD1 ↔ NSW1 */}
        <FlowLine flow={getFlow('QNI')} />

        {/* VIC1-NSW1: NSW1 ↔ VIC1 */}
        <FlowLine flow={getFlow('VIC1-NSW1')} />

        {/* V-SA: VIC1 ↔ SA1 — offset +12px */}
        <FlowLine flow={getFlow('V-SA')} offset={12} />

        {/* V-TAS: VIC1 ↔ TAS1 */}
        <FlowLine flow={getFlow('V-TAS')} />

        {/* Murraylink: SA1 ↔ VIC1 — dashed, offset −12px from V-SA */}
        <FlowLine flow={getFlow('Murraylink')} offset={-12} dashed />

        {/* Region nodes on top */}
        {regions.map(id => (
          <RegionNode key={id} id={id} />
        ))}
      </svg>

      {/* Flow table */}
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
            {displayFlows.map(f => {
              const utilPct = f.limitMw > 0 ? (Math.abs(f.flowMw) / f.limitMw) * 100 : 0
              const isExport = f.flowMw > 0
              const isZero   = f.flowMw === 0
              return (
                <tr key={f.id} className="border-b border-gray-50">
                  <td className="py-1 pr-4 font-mono font-semibold text-gray-700">{f.id}</td>
                  <td className="py-1 pr-4 text-gray-600">{f.from}</td>
                  <td className="py-1 pr-4 text-gray-600">{f.to}</td>
                  <td
                    className={`py-1 pr-4 font-mono font-semibold ${
                      isZero ? 'text-gray-400' : isExport ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {isExport ? '+' : ''}{f.flowMw.toFixed(0)}
                  </td>
                  <td className="py-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            utilPct > 80
                              ? 'bg-red-500'
                              : utilPct > 60
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                          }`}
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
    </div>
  )
}
