import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getSRAAnalyticsDashboard,
  SRAADashboard,
  SRAAuctionResultRecord,
  SRAAHolderRecord,
  SRAAResidueRecord,
  SRAAInterconnectorRecord,
  SRAAParticipantBehaviourRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'
const TABLE_TH = 'px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide'
const TABLE_TD = 'px-3 py-2 text-sm text-gray-200 whitespace-nowrap'
const TABLE_TD_MONO = 'px-3 py-2 text-sm text-gray-200 font-mono whitespace-nowrap'

const IC_COLORS: Record<string, string> = {
  'VIC1-NSW1':  '#3B82F6',
  'NSW1-QLD1':  '#10B981',
  'V-SA':       '#F59E0B',
  'V-MNSP1':    '#8B5CF6',
  'T-V-MNSP1':  '#EF4444',
  'N-Q-MNSP1':  '#06B6D4',
  'NSW1-VIC1':  '#F97316',
}
const IC_COLOR_LIST = Object.values(IC_COLORS)

const TYPE_COLORS: Record<string, string> = {
  GENERATOR:  '#3B82F6',
  RETAILER:   '#10B981',
  TRADER:     '#F59E0B',
  FINANCIAL:  '#8B5CF6',
  INTEGRATED: '#EF4444',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

function fmt(n: number, dp = 1) {
  return n.toFixed(dp)
}

// ---------------------------------------------------------------------------
// Section 1: KPI Cards
// ---------------------------------------------------------------------------
function KpiSection({ summary }: { summary: Record<string, unknown> }) {
  const total = summary['total_sra_revenue_2024_m'] as number
  const topIc = summary['most_valuable_interconnector'] as string
  const oversubRatio = summary['avg_oversubscription_ratio'] as number
  const holderReturn = summary['avg_sra_holder_return_pct'] as number
  const congRev = summary['total_congestion_revenue_m'] as number
  const residPct = summary['residual_pct'] as number

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <KpiCard label="Total SRA Revenue 2024" value={`$${total}M`} sub="Cleared at auction" />
      <KpiCard label="Top Interconnector" value={topIc} sub="Highest SRA revenue" />
      <KpiCard label="Avg Oversubscription" value={`${oversubRatio}x`} sub="Bid MW / Offered MW" />
      <KpiCard label="Avg Holder Return" value={`${holderReturn}%`} sub="Settlement vs purchase" />
      <KpiCard label="Total Congestion Rev" value={`$${congRev}M`} sub="All interconnectors 2024" />
      <KpiCard label="Residual %" value={`${residPct}%`} sub="Congestion not recovered" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2: Auction Results Table
// ---------------------------------------------------------------------------
function AuctionResultsSection({ records }: { records: SRAAuctionResultRecord[] }) {
  const [filterIc, setFilterIc] = useState('All')
  const [filterDir, setFilterDir] = useState('All')
  const interconnectors = ['All', ...Array.from(new Set(records.map((r) => r.interconnector_id))).sort()]
  const directions = ['All', 'IMPORT', 'EXPORT']

  const filtered = records.filter(
    (r) =>
      (filterIc === 'All' || r.interconnector_id === filterIc) &&
      (filterDir === 'All' || r.direction === filterDir),
  )

  const getOversubColor = (ratio: number) => {
    if (ratio >= 3.0) return 'text-red-400'
    if (ratio >= 2.0) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionHeader title="SRA Auction Results — Clearing Prices & Oversubscription" />
        <div className="flex gap-3">
          <select
            value={filterIc}
            onChange={(e) => setFilterIc(e.target.value)}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {interconnectors.map((ic) => <option key={ic}>{ic}</option>)}
          </select>
          <select
            value={filterDir}
            onChange={(e) => setFilterDir(e.target.value)}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {directions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Auction ID</th>
              <th className={TABLE_TH}>Quarter</th>
              <th className={TABLE_TH}>Interconnector</th>
              <th className={TABLE_TH}>Direction</th>
              <th className={TABLE_TH}>Units Offered</th>
              <th className={TABLE_TH}>Units Sold</th>
              <th className={TABLE_TH}>Clearing Price ($/MWh)</th>
              <th className={TABLE_TH}>Revenue ($M)</th>
              <th className={TABLE_TH}>Participants</th>
              <th className={TABLE_TH}>Oversubscription</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.auction_id} className={i % 2 === 0 ? 'bg-gray-900/30' : ''}>
                <td className={TABLE_TD_MONO}>{r.auction_id}</td>
                <td className={TABLE_TD}>{r.quarter}</td>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (IC_COLORS[r.interconnector_id] ?? '#6B7280') + '33', color: IC_COLORS[r.interconnector_id] ?? '#9CA3AF' }}
                  >
                    {r.interconnector_id}
                  </span>
                </td>
                <td className={TABLE_TD}>
                  <span className={r.direction === 'IMPORT' ? 'text-blue-400' : 'text-amber-400'}>
                    {r.direction}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>{r.units_offered.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>{r.units_sold.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>${fmt(r.clearing_price, 2)}</td>
                <td className={TABLE_TD_MONO}>${fmt(r.revenue_m, 2)}M</td>
                <td className={TABLE_TD}>{r.participants}</td>
                <td className={`${TABLE_TD_MONO} font-bold ${getOversubColor(r.oversubscription_ratio)}`}>
                  {fmt(r.oversubscription_ratio, 2)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 3: Revenue & Residue — Stacked Bar per interconnector per quarter
// ---------------------------------------------------------------------------
function RevenueResidueSection({ residues }: { residues: SRAAResidueRecord[] }) {
  const [filterIc, setFilterIc] = useState('All')
  const interconnectors = ['All', ...Array.from(new Set(residues.map((r) => r.interconnector_id))).sort()]

  const filtered = filterIc === 'All' ? residues : residues.filter((r) => r.interconnector_id === filterIc)

  // Group by quarter — sum across interconnectors when showing All
  const quarters = Array.from(new Set(filtered.map((r) => r.quarter))).sort()
  const chartData = quarters.map((q) => {
    const rows = filtered.filter((r) => r.quarter === q)
    const totalCong = rows.reduce((s, r) => s + r.total_congestion_revenue_m, 0)
    const sraRev = rows.reduce((s, r) => s + r.sra_auction_revenue_m, 0)
    const residual = rows.reduce((s, r) => s + r.residual_m, 0)
    return {
      quarter: q,
      'SRA Auction Revenue': parseFloat(sraRev.toFixed(2)),
      'Residual': parseFloat(residual.toFixed(2)),
      'Total Congestion': parseFloat(totalCong.toFixed(2)),
    }
  })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionHeader title="Congestion Revenue vs SRA Auction Revenue vs Residual ($M)" />
        <select
          value={filterIc}
          onChange={(e) => setFilterIc(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {interconnectors.map((ic) => <option key={ic}>{ic}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} unit="M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => `$${v.toFixed(2)}M`}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar dataKey="SRA Auction Revenue" stackId="a" fill="#3B82F6" />
          <Bar dataKey="Residual" stackId="a" fill="#F59E0B" />
        </BarChart>
      </ResponsiveContainer>

      {/* Residue detail table */}
      <div className="overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Quarter</th>
              <th className={TABLE_TH}>Interconnector</th>
              <th className={TABLE_TH}>Total Congestion ($M)</th>
              <th className={TABLE_TH}>SRA Auction Rev ($M)</th>
              <th className={TABLE_TH}>Residual ($M)</th>
              <th className={TABLE_TH}>Distribution</th>
              <th className={TABLE_TH}>Avg Price Diff ($/MWh)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.quarter}-${r.interconnector_id}`} className={i % 2 === 0 ? 'bg-gray-900/30' : ''}>
                <td className={TABLE_TD}>{r.quarter}</td>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (IC_COLORS[r.interconnector_id] ?? '#6B7280') + '33', color: IC_COLORS[r.interconnector_id] ?? '#9CA3AF' }}
                  >
                    {r.interconnector_id}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>${fmt(r.total_congestion_revenue_m, 2)}M</td>
                <td className={TABLE_TD_MONO}>${fmt(r.sra_auction_revenue_m, 2)}M</td>
                <td className={`${TABLE_TD_MONO} text-amber-400`}>${fmt(r.residual_m, 2)}M</td>
                <td className={TABLE_TD}>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                    {r.residual_distribution}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>${fmt(r.avg_spot_price_differential, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 4: Holder Performance Table (P&L + Return %)
// ---------------------------------------------------------------------------
function HolderPerformanceSection({ holders }: { holders: SRAAHolderRecord[] }) {
  const [filterType, setFilterType] = useState('All')
  const [filterIc, setFilterIc] = useState('All')
  const holderTypes = ['All', ...Array.from(new Set(holders.map((h) => h.holder_type))).sort()]
  const interconnectors = ['All', ...Array.from(new Set(holders.map((h) => h.interconnector_id))).sort()]

  const filtered = holders.filter(
    (h) =>
      (filterType === 'All' || h.holder_type === filterType) &&
      (filterIc === 'All' || h.interconnector_id === filterIc),
  )

  const getReturnColor = (ret: number) => {
    if (ret > 20) return 'text-green-400'
    if (ret > 0) return 'text-emerald-400'
    if (ret > -5) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionHeader title="SRA Unit Holder Performance — P&L & Return %" />
        <div className="flex gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {holderTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select
            value={filterIc}
            onChange={(e) => setFilterIc(e.target.value)}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {interconnectors.map((ic) => <option key={ic}>{ic}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Company</th>
              <th className={TABLE_TH}>Type</th>
              <th className={TABLE_TH}>Quarter</th>
              <th className={TABLE_TH}>Interconnector</th>
              <th className={TABLE_TH}>Units Held</th>
              <th className={TABLE_TH}>Purchase Price ($/MWh)</th>
              <th className={TABLE_TH}>Settlement Value ($M)</th>
              <th className={TABLE_TH}>P&L ($M)</th>
              <th className={TABLE_TH}>Return %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={h.holder_id} className={i % 2 === 0 ? 'bg-gray-900/30' : ''}>
                <td className={TABLE_TD}>{h.company}</td>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (TYPE_COLORS[h.holder_type] ?? '#6B7280') + '33', color: TYPE_COLORS[h.holder_type] ?? '#9CA3AF' }}
                  >
                    {h.holder_type}
                  </span>
                </td>
                <td className={TABLE_TD}>{h.quarter}</td>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (IC_COLORS[h.interconnector_id] ?? '#6B7280') + '33', color: IC_COLORS[h.interconnector_id] ?? '#9CA3AF' }}
                  >
                    {h.interconnector_id}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>{h.units_held.toLocaleString()}</td>
                <td className={TABLE_TD_MONO}>${fmt(h.purchase_price, 2)}</td>
                <td className={TABLE_TD_MONO}>${fmt(h.settlement_value, 2)}M</td>
                <td className={`${TABLE_TD_MONO} ${h.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {h.profit_loss >= 0 ? '+' : ''}${fmt(h.profit_loss, 2)}M
                </td>
                <td className={`${TABLE_TD_MONO} font-bold ${getReturnColor(h.return_pct)}`}>
                  {h.return_pct >= 0 ? '+' : ''}{fmt(h.return_pct, 1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Interconnector SRA Value — Annual Bar Chart
// ---------------------------------------------------------------------------
function InterconnectorSraValueSection({ records }: { records: SRAAInterconnectorRecord[] }) {
  const interconnectors = Array.from(new Set(records.map((r) => r.interconnector_id))).sort()

  // Pivot: one row per interconnector, bars for 2023 and 2024
  const chartData = interconnectors.map((ic) => {
    const row: Record<string, string | number> = { interconnector: ic }
    for (const yr of [2023, 2024]) {
      const rec = records.find((r) => r.interconnector_id === ic && r.year === yr)
      row[`${yr} SRA Rev`] = rec ? rec.total_sra_revenue_m : 0
      row[`${yr} Cover %`] = rec ? rec.sra_cover_ratio : 0
    }
    return row
  })

  // Utilisation / congestion summary table
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Interconnector SRA Revenue — Annual Comparison (2023 vs 2024)" />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="interconnector" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} unit="M" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => `$${v.toFixed(2)}M`}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar dataKey="2023 SRA Rev" fill="#6B7280" />
          <Bar dataKey="2024 SRA Rev" fill="#3B82F6" />
        </BarChart>
      </ResponsiveContainer>

      {/* Detail table */}
      <div className="overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Interconnector</th>
              <th className={TABLE_TH}>Year</th>
              <th className={TABLE_TH}>SRA Revenue ($M)</th>
              <th className={TABLE_TH}>Avg Import Price ($/MWh)</th>
              <th className={TABLE_TH}>Avg Export Price ($/MWh)</th>
              <th className={TABLE_TH}>Utilisation %</th>
              <th className={TABLE_TH}>Congestion Hours</th>
              <th className={TABLE_TH}>SRA Cover Ratio %</th>
            </tr>
          </thead>
          <tbody>
            {records.sort((a, b) => a.interconnector_id.localeCompare(b.interconnector_id) || a.year - b.year).map((r, i) => (
              <tr key={`${r.interconnector_id}-${r.year}`} className={i % 2 === 0 ? 'bg-gray-900/30' : ''}>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (IC_COLORS[r.interconnector_id] ?? '#6B7280') + '33', color: IC_COLORS[r.interconnector_id] ?? '#9CA3AF' }}
                  >
                    {r.interconnector_id}
                  </span>
                </td>
                <td className={TABLE_TD}>{r.year}</td>
                <td className={TABLE_TD_MONO}>${fmt(r.total_sra_revenue_m, 2)}M</td>
                <td className={TABLE_TD_MONO}>${fmt(r.avg_clearing_price_import, 2)}</td>
                <td className={TABLE_TD_MONO}>${fmt(r.avg_clearing_price_export, 2)}</td>
                <td className={TABLE_TD_MONO}>{fmt(r.utilisation_pct, 1)}%</td>
                <td className={TABLE_TD_MONO}>{r.congestion_hours.toLocaleString()} hrs</td>
                <td className={TABLE_TD_MONO}>
                  <span className={r.sra_cover_ratio >= 65 ? 'text-green-400' : r.sra_cover_ratio >= 55 ? 'text-yellow-400' : 'text-red-400'}>
                    {fmt(r.sra_cover_ratio, 1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 6: Participant Behaviour — Grouped BarChart return % by type
// ---------------------------------------------------------------------------
function ParticipantBehaviourSection({ records }: { records: SRAAParticipantBehaviourRecord[] }) {
  const [filterQuarter, setFilterQuarter] = useState('All')
  const quarters = ['All', ...Array.from(new Set(records.map((r) => r.quarter))).sort()]
  const filtered = filterQuarter === 'All' ? records : records.filter((r) => r.quarter === filterQuarter)

  // Chart: group by participant_type, bars = avg_return_pct per quarter
  const types = Array.from(new Set(records.map((r) => r.participant_type))).sort()
  const chartQuarters = Array.from(new Set(records.map((r) => r.quarter))).sort()
  const chartData = chartQuarters.map((q) => {
    const row: Record<string, string | number> = { quarter: q }
    for (const t of types) {
      const rec = records.find((r) => r.quarter === q && r.participant_type === t)
      row[t] = rec ? parseFloat(rec.avg_return_pct.toFixed(1)) : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionHeader title="Participant Behaviour — Avg Return % by Type & Quarter" />
        <select
          value={filterQuarter}
          onChange={(e) => setFilterQuarter(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {quarters.map((q) => <option key={q}>{q}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          {types.map((t, idx) => (
            <Bar key={t} dataKey={t} fill={IC_COLOR_LIST[idx % IC_COLOR_LIST.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Detail table */}
      <div className="overflow-x-auto mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className={TABLE_TH}>Quarter</th>
              <th className={TABLE_TH}>Participant Type</th>
              <th className={TABLE_TH}>Avg Units Purchased</th>
              <th className={TABLE_TH}>Avg Purchase Price ($/MWh)</th>
              <th className={TABLE_TH}>Avg Return %</th>
              <th className={TABLE_TH}>Participation Rate %</th>
              <th className={TABLE_TH}>Strategy</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.quarter}-${r.participant_type}`} className={i % 2 === 0 ? 'bg-gray-900/30' : ''}>
                <td className={TABLE_TD}>{r.quarter}</td>
                <td className={TABLE_TD}>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ backgroundColor: (TYPE_COLORS[r.participant_type] ?? '#6B7280') + '33', color: TYPE_COLORS[r.participant_type] ?? '#9CA3AF' }}
                  >
                    {r.participant_type}
                  </span>
                </td>
                <td className={TABLE_TD_MONO}>{fmt(r.avg_units_purchased, 1)}</td>
                <td className={TABLE_TD_MONO}>${fmt(r.avg_purchase_price, 2)}</td>
                <td className={`${TABLE_TD_MONO} font-bold ${r.avg_return_pct >= 15 ? 'text-green-400' : r.avg_return_pct >= 5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {r.avg_return_pct >= 0 ? '+' : ''}{fmt(r.avg_return_pct, 1)}%
                </td>
                <td className={TABLE_TD_MONO}>{fmt(r.participation_rate_pct, 1)}%</td>
                <td className={TABLE_TD}>
                  <span className={
                    r.strategy === 'HEDGING' ? 'text-blue-400' :
                    r.strategy === 'SPECULATIVE' ? 'text-amber-400' : 'text-purple-400'
                  }>
                    {r.strategy}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function SRAAnalyticsPage() {
  const [data, setData] = useState<SRAADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSRAAnalyticsDashboard()
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Loading SRA Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">Error loading SRA Analytics: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            NEM Settlement Residue Auction (SRA) Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            Deep-dive SRA auction clearing, unit holder performance, congestion revenue decomposition,
            interconnector SRA value, and participant behaviour strategy — covering 7 NEM interconnectors.
          </p>
        </div>

        {/* KPI Section */}
        <KpiSection summary={data.summary} />

        {/* Auction Results Table */}
        <AuctionResultsSection records={data.auction_results} />

        {/* Revenue & Residue */}
        <RevenueResidueSection residues={data.residues} />

        {/* Holder Performance */}
        <HolderPerformanceSection holders={data.holders} />

        {/* Interconnector SRA Value */}
        <InterconnectorSraValueSection records={data.interconnectors} />

        {/* Participant Behaviour */}
        <ParticipantBehaviourSection records={data.participant_behaviour} />
      </div>
    </div>
  )
}
