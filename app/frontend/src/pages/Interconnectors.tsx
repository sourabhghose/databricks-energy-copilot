import React, { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, RefreshCw, Zap, Activity } from 'lucide-react'
import { api, InterconnectorSummary, SettlementRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Types (local)
// ---------------------------------------------------------------------------

type InterconnectorRecord = InterconnectorSummary['interconnectors'][number]

// ---------------------------------------------------------------------------
// NEM Topology SVG diagram
// ---------------------------------------------------------------------------

// Fixed node positions for the NEM topology diagram
// QLD1 is north, TAS1 is south
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  QLD1: { x: 250, y:  60 },
  NSW1: { x: 330, y: 175 },
  VIC1: { x: 260, y: 305 },
  SA1:  { x: 100, y: 295 },
  TAS1: { x: 255, y: 430 },
}

// Interconnector topology: which nodes each interconnector connects
const IC_NODE_MAP: Record<string, { from: string; to: string }> = {
  'NSW1-QLD1':  { from: 'QLD1', to: 'NSW1' },
  'VIC1-NSW1':  { from: 'NSW1', to: 'VIC1' },
  'VIC1-SA1':   { from: 'VIC1', to: 'SA1'  },
  'V-SA':       { from: 'VIC1', to: 'SA1'  },
  'T-V-MNSP1':  { from: 'TAS1', to: 'VIC1' },
}

interface FlowLineProps {
  ic: InterconnectorRecord
  fromPt: { x: number; y: number }
  toPt: { x: number; y: number }
  offset?: number  // perpendicular offset for parallel lines (VIC1-SA1 / V-SA)
}

function FlowLine({ ic, fromPt, toPt, offset = 0 }: FlowLineProps) {
  const dx = toPt.x - fromPt.x
  const dy = toPt.y - fromPt.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = -dy / len  // perpendicular unit vector
  const ny =  dx / len

  // Apply perpendicular offset to avoid overlap (for VIC1-SA1 / V-SA)
  const x1 = fromPt.x + nx * offset
  const y1 = fromPt.y + ny * offset
  const x2 = toPt.x   + nx * offset
  const y2 = toPt.y   + ny * offset

  // Midpoint for label
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  // Color: blue = forward flow (positive), orange = reverse, gray = near zero
  const absFlow = Math.abs(ic.mw_flow)
  let lineColor = '#6b7280'  // gray
  if (absFlow > 20) {
    lineColor = ic.mw_flow > 0 ? '#3b82f6' : '#f97316'  // blue or orange
  }

  const strokeWidth = Math.max(1.5, Math.min(5, 1.5 + (absFlow / ic.mw_flow_limit) * 4))

  // Arrow direction: show arrow at midpoint
  const arrowDir = ic.mw_flow >= 0 ? 1 : -1
  const arrowMx = mx + arrowDir * (dx / len) * 8
  const arrowMy = my + arrowDir * (dy / len) * 8

  return (
    <g>
      <line
        x1={x1} y1={y1}
        x2={x2} y2={y2}
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Arrowhead at midpoint */}
      <polygon
        points={`
          ${arrowMx},${arrowMy}
          ${arrowMx - arrowDir * (dy / len) * 6 - arrowDir * (dx / len) * 8},
          ${arrowMy - arrowDir * (-dx / len) * 6 - arrowDir * (dy / len) * 8}
          ${arrowMx + arrowDir * (dy / len) * 6 - arrowDir * (dx / len) * 8},
          ${arrowMy + arrowDir * (-dx / len) * 6 - arrowDir * (dy / len) * 8}
        `}
        fill={lineColor}
        opacity={0.9}
      />
      {/* Flow label */}
      <rect
        x={mx - 26} y={my - 10}
        width={52} height={16}
        rx={3}
        fill="white"
        fillOpacity={0.88}
        stroke={lineColor}
        strokeWidth={0.8}
      />
      <text
        x={mx} y={my + 3}
        textAnchor="middle"
        fontSize={9}
        fontWeight="600"
        fill={lineColor}
        fontFamily="monospace"
      >
        {ic.mw_flow > 0 ? '+' : ''}{Math.round(ic.mw_flow)} MW
      </text>
      {/* Congested label */}
      {ic.congested && (
        <>
          <rect
            x={mx - 30} y={my + 9}
            width={60} height={13}
            rx={2}
            fill="#fee2e2"
            stroke="#ef4444"
            strokeWidth={0.8}
          />
          <text
            x={mx} y={my + 19}
            textAnchor="middle"
            fontSize={8}
            fontWeight="700"
            fill="#dc2626"
          >
            CONGESTED
          </text>
        </>
      )}
    </g>
  )
}

interface NEMTopologyProps {
  interconnectors: InterconnectorRecord[]
}

function NEMTopologyDiagram({ interconnectors }: NEMTopologyProps) {
  const icMap = Object.fromEntries(interconnectors.map(ic => [ic.interconnectorid, ic]))

  return (
    <svg
      viewBox="0 0 500 490"
      width="100%"
      style={{ maxWidth: 480 }}
      aria-label="NEM Interconnector Topology"
    >
      {/* Background */}
      <rect x={0} y={0} width={500} height={490} fill="#f9fafb" rx={8} />

      {/* Title */}
      <text x={250} y={26} textAnchor="middle" fontSize={13} fontWeight="700" fill="#374151">
        NEM Interconnector Topology
      </text>

      {/* Draw interconnector lines */}
      {Object.entries(IC_NODE_MAP).map(([icId, { from, to }], idx) => {
        const ic = icMap[icId]
        if (!ic) return null
        const fromPt = NODE_POSITIONS[from]
        const toPt   = NODE_POSITIONS[to]
        if (!fromPt || !toPt) return null
        // VIC1-SA1 and V-SA share the same node pair — offset them slightly
        const offset = icId === 'VIC1-SA1' ? -10 : icId === 'V-SA' ? 10 : 0
        return (
          <FlowLine
            key={icId}
            ic={ic}
            fromPt={fromPt}
            toPt={toPt}
            offset={offset}
          />
        )
      })}

      {/* Draw region nodes */}
      {Object.entries(NODE_POSITIONS).map(([region, pos]) => (
        <g key={region}>
          <rect
            x={pos.x - 34} y={pos.y - 18}
            width={68} height={36}
            rx={6}
            fill="#1e40af"
            stroke="#1d4ed8"
            strokeWidth={1.5}
            filter="drop-shadow(0 2px 3px rgba(0,0,0,0.15))"
          />
          <text
            x={pos.x} y={pos.y + 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight="700"
            fill="white"
          >
            {region}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform="translate(12, 455)">
        <text fontSize={8} fill="#6b7280" fontStyle="italic">
          Blue = forward flow  |  Orange = reverse  |  Thick line = high utilisation
        </text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Interconnector detail table
// ---------------------------------------------------------------------------

function UtilisationBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  const color = pct >= 95 ? '#dc2626' : pct >= 75 ? '#f59e0b' : '#16a34a'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 min-w-16">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${capped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

interface InterconnectorTableProps {
  interconnectors: InterconnectorRecord[]
}

function InterconnectorTable({ interconnectors }: InterconnectorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-700">
            <th className="pb-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">Interconnector</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">From → To</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600 dark:text-gray-400 text-right">Flow (MW)</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600 dark:text-gray-400 text-right">Limit (MW)</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600 dark:text-gray-400">Utilisation %</th>
            <th className="pb-2 font-semibold text-gray-600 dark:text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {interconnectors.map(ic => {
            const absFlow = Math.abs(ic.mw_flow)
            const utilPct = (absFlow / ic.mw_flow_limit) * 100
            const dirArrow = ic.mw_flow >= 0 ? '→' : '←'
            const flowColor = ic.mw_flow > 20
              ? 'text-blue-600 dark:text-blue-400'
              : ic.mw_flow < -20
              ? 'text-orange-500 dark:text-orange-400'
              : 'text-gray-500 dark:text-gray-400'

            return (
              <tr key={ic.interconnectorid} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="py-2 pr-4 font-mono font-medium text-gray-900 dark:text-gray-100">
                  {ic.interconnectorid}
                </td>
                <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {ic.from_region} {dirArrow} {ic.to_region}
                </td>
                <td className={`py-2 pr-4 font-mono font-semibold text-right ${flowColor}`}>
                  {ic.mw_flow > 0 ? '+' : ''}{ic.mw_flow.toFixed(0)}
                </td>
                <td className="py-2 pr-4 font-mono text-gray-600 dark:text-gray-400 text-right">
                  {ic.mw_flow_limit.toFixed(0)}
                </td>
                <td className="py-2 pr-4 min-w-36">
                  <UtilisationBar pct={utilPct} />
                </td>
                <td className="py-2">
                  {ic.congested ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      Congested
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Normal
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settlement summary table
// ---------------------------------------------------------------------------

function SpotPriceCell({ price }: { price: number }) {
  let colorClass = 'text-gray-900 dark:text-gray-100'
  if (price > 300) colorClass = 'text-red-600 dark:text-red-400 font-semibold'
  else if (price > 100) colorClass = 'text-amber-600 dark:text-amber-400 font-semibold'
  else if (price < 0) colorClass = 'text-blue-600 dark:text-blue-400 font-semibold'
  return (
    <span className={`font-mono ${colorClass}`}>
      ${price.toFixed(2)}
    </span>
  )
}

interface SettlementTableProps {
  records: SettlementRecord[]
}

function SettlementTable({ records }: SettlementTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-700">
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400">Region</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Demand (MW)</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Net Interchange</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Spot Price</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Raise Reg</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Lower Reg</th>
            <th className="pb-2 pr-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Raise 6s</th>
            <th className="pb-2 font-semibold text-gray-600 dark:text-gray-400 text-right">Lower 6s</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {records.map(rec => (
            <tr key={rec.region} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="py-2 pr-3">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {rec.region}
                </span>
              </td>
              <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300 text-right">
                {rec.totaldemand_mw.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
              <td className="py-2 pr-3 font-mono text-right">
                <span className={rec.net_interchange_mw >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {rec.net_interchange_mw > 0 ? '+' : ''}{rec.net_interchange_mw.toFixed(0)}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">
                <SpotPriceCell price={rec.rrp_aud_mwh} />
              </td>
              <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400 text-right">
                ${rec.raise_reg_rrp.toFixed(2)}
              </td>
              <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400 text-right">
                ${rec.lower_reg_rrp.toFixed(2)}
              </td>
              <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400 text-right">
                ${rec.raise6sec_rrp.toFixed(2)}
              </td>
              <td className="py-2 font-mono text-gray-600 dark:text-gray-400 text-right">
                ${rec.lower6sec_rrp.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary stat cards
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: string
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-start gap-3">
      <div className={`mt-0.5 ${accent ?? 'text-blue-500'}`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
        {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Interconnectors() {
  const [icSummary, setIcSummary] = useState<InterconnectorSummary | null>(null)
  const [settlement, setSettlement] = useState<SettlementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [icData, settlData] = await Promise.all([
        api.getInterconnectorsSummary(12),
        api.getSettlementSummary(),
      ])
      setIcSummary(icData)
      setSettlement(settlData)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30_000)
    return () => clearInterval(timer)
  }, [fetchData])

  const congestedCount = icSummary
    ? icSummary.interconnectors.filter(ic => ic.congested).length
    : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="text-blue-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Interconnector Flows &amp; Settlement
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              NEM interconnector power flows and settlement/market summary
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          API unavailable — showing mock data. ({error})
        </div>
      )}

      {/* Summary stat cards */}
      {icSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<ArrowRightLeft size={20} />}
            label="Total Interstate Flow"
            value={`${icSummary.total_interstate_mw.toLocaleString('en-AU', { maximumFractionDigits: 0 })} MW`}
            sub="sum of abs(flow) across all ICs"
            accent="text-blue-500"
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Most Loaded"
            value={icSummary.most_loaded}
            sub="highest utilisation %"
            accent="text-indigo-500"
          />
          <StatCard
            icon={<Zap size={20} />}
            label="Congested"
            value={`${congestedCount} / ${icSummary.interconnectors.length}`}
            sub={congestedCount > 0 ? 'interconnectors at ≥95% limit' : 'all within limits'}
            accent={congestedCount > 0 ? 'text-red-500' : 'text-green-500'}
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Interconnectors"
            value={`${icSummary.interconnectors.length} active`}
            sub="NSW1-QLD1, VIC1-NSW1, VIC1-SA1, V-SA, Basslink"
            accent="text-teal-500"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !icSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 h-20 animate-pulse bg-gray-100 dark:bg-gray-700" />
          ))}
        </div>
      )}

      {/* Main content: topology + table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* NEM Topology SVG */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <ArrowRightLeft size={15} />
            NEM Network Topology
          </h2>
          {loading && !icSummary ? (
            <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-700 rounded" />
          ) : icSummary ? (
            <NEMTopologyDiagram interconnectors={icSummary.interconnectors} />
          ) : null}
        </div>

        {/* Interconnector detail table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Activity size={15} />
            Interconnector Detail
          </h2>
          {loading && !icSummary ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-100 dark:bg-gray-700 rounded" />
              ))}
            </div>
          ) : icSummary ? (
            <InterconnectorTable interconnectors={icSummary.interconnectors} />
          ) : null}
        </div>
      </div>

      {/* Settlement summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Zap size={15} />
          Settlement Summary — Current Trading Interval
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Spot price colour: <span className="text-red-600 font-semibold">red &gt;$300</span>,{' '}
          <span className="text-amber-600 font-semibold">amber &gt;$100</span>,{' '}
          <span className="text-blue-600 font-semibold">blue &lt;$0</span>.{' '}
          Net interchange: positive = net import into region.
        </p>
        {loading && settlement.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse bg-gray-100 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : settlement.length > 0 ? (
          <SettlementTable records={settlement} />
        ) : null}
      </div>

    </div>
  )
}
