import { useEffect, useState } from 'react'
import { Network } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api, TnspDashboard, TnspRevenueRecord, AerDeterminationRecord, TnspAssetRecord } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${highlight ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue vs Approved Chart (2025 data)
// ---------------------------------------------------------------------------
interface RevenueVsApprovedChartProps {
  records: TnspRevenueRecord[]
}

interface RevenueChartEntry {
  tnsp: string
  approved: number
  actual: number
  recovery: number
}

function RevenueVsApprovedChart({ records }: RevenueVsApprovedChartProps) {
  const data2025 = records.filter(r => r.year === 2025)

  const chartData: RevenueChartEntry[] = data2025.map(r => ({
    tnsp: r.tnsp,
    approved: r.approved_revenue_m_aud,
    actual: r.actual_revenue_m_aud,
    recovery: r.over_under_recovery_m_aud,
  }))

  if (!chartData.length) {
    return <div className="text-sm text-gray-400 py-8 text-center">No 2025 revenue data available</div>
  }

  interface TooltipPayloadItem {
    name: string
    value: number
    color: string
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const rec = data2025.find(r => r.tnsp === label)
    return (
      <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg p-3 shadow-lg min-w-[180px]">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: ${p.value.toFixed(1)}M
          </p>
        ))}
        {rec && (
          <p className={`mt-1 font-medium ${rec.over_under_recovery_m_aud >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {rec.over_under_recovery_m_aud >= 0 ? 'Over-recovery' : 'Under-recovery'}: ${Math.abs(rec.over_under_recovery_m_aud).toFixed(1)}M
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Revenue vs Approved — 2025 ($M AUD)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="tnsp" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="approved" name="Approved Revenue" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" name="Actual Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AER Determinations Table
// ---------------------------------------------------------------------------
interface DeterminationsTableProps {
  determinations: AerDeterminationRecord[]
}

function DeterminationsTable({ determinations }: DeterminationsTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">AER Regulatory Determinations</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['TNSP', 'State', 'Period', 'Total Rev $M', 'RAB Start $M', 'RAB End $M', 'WACC %', 'Capex $M', 'Appeal', 'Outcome'].map(h => (
                <th key={h} className="py-2 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {determinations.map((d) => (
              <tr key={d.determination_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{d.tnsp}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{d.state}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{d.regulatory_period}</td>
                <td className="py-2 px-3 text-gray-900 dark:text-white font-mono">{d.total_revenue_m_aud.toFixed(1)}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{d.rab_at_start_m_aud.toFixed(1)}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{d.rab_at_end_m_aud.toFixed(1)}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{d.allowed_wacc_pct.toFixed(2)}%</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{d.approved_capex_m_aud.toFixed(1)}</td>
                <td className="py-2 px-3">
                  {d.appeal_lodged ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">LODGED</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">NONE</span>
                  )}
                </td>
                <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{d.appeal_outcome ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!determinations.length && (
          <div className="text-sm text-gray-400 py-6 text-center">No determinations found</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TNSP Asset Table
// ---------------------------------------------------------------------------
interface AssetTableProps {
  assets: TnspAssetRecord[]
}

function saidiColor(saidi: number): string {
  if (saidi < 2) return 'text-green-600 dark:text-green-400'
  if (saidi <= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function AssetTable({ assets }: AssetTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">TNSP Asset Records</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['TNSP', 'State', 'Circuit km', 'Substations', 'Avg Age (yrs)', 'Reliability Target', 'Actual Reliability', 'SAIDI (min)', 'Replacement Rate %'].map(h => (
                <th key={h} className="py-2 px-3 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const reliabilityPct = Math.min(100, (a.actual_reliability_pct / a.reliability_target_pct) * 100)
              const barColor = reliabilityPct >= 100 ? 'bg-green-500' : reliabilityPct >= 97 ? 'bg-amber-500' : 'bg-red-500'
              return (
                <tr key={a.tnsp} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{a.tnsp}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{a.state}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{a.circuit_km.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{a.substations}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{a.asset_age_yrs_avg.toFixed(1)}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{a.reliability_target_pct.toFixed(2)}%</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700 dark:text-gray-300 w-14">{a.actual_reliability_pct.toFixed(2)}%</span>
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${reliabilityPct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`py-2 px-3 font-mono font-semibold ${saidiColor(a.saidi_minutes)}`}>
                    {a.saidi_minutes.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono">{a.asset_replacement_rate_pct.toFixed(2)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!assets.length && (
          <div className="text-sm text-gray-400 py-6 text-center">No asset records found</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main TnspAnalytics Page
// ---------------------------------------------------------------------------
const TNSP_OPTIONS = ['All', 'TransGrid', 'Powerlink', 'AusNet Services', 'ElectraNet', 'TasNetworks']

export default function TnspAnalytics() {
  const [dashboard, setDashboard] = useState<TnspDashboard | null>(null)
  const [revenueRecords, setRevenueRecords] = useState<TnspRevenueRecord[]>([])
  const [determinations, setDeterminations] = useState<AerDeterminationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTnsp, setSelectedTnsp] = useState<string>('All')

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.getTnspDashboard(),
      api.getTnspRevenue(),
      api.getAerDeterminations(),
    ])
      .then(([dash, rev, dets]) => {
        setDashboard(dash)
        setRevenueRecords(rev)
        setDeterminations(dets)
      })
      .catch(err => setError(err?.message ?? 'Failed to load TNSP data'))
      .finally(() => setLoading(false))
  }, [])

  const filteredRevenue: TnspRevenueRecord[] = selectedTnsp === 'All'
    ? revenueRecords
    : revenueRecords.filter(r => r.tnsp === selectedTnsp)

  const filteredDeterminations: AerDeterminationRecord[] = selectedTnsp === 'All'
    ? determinations
    : determinations.filter(d => d.tnsp === selectedTnsp)

  const filteredAssets: TnspAssetRecord[] = dashboard
    ? (selectedTnsp === 'All'
        ? dashboard.asset_records
        : dashboard.asset_records.filter(a => a.tnsp === selectedTnsp))
    : []

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <Network className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">TNSP Revenue & AER Determinations</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Transmission Network Service Providers</p>
          </div>
        </div>
        {dashboard && (
          <span className="text-xs text-gray-400 dark:text-gray-500 self-center">
            Updated: {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 h-24 animate-pulse">
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {!loading && dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total TNSP Revenue YTD"
            value={`$${dashboard.total_tnsp_revenue_ytd_m_aud.toFixed(1)}M`}
            sub="2025 actuals"
            highlight
          />
          <KpiCard
            label="Total RAB Value"
            value={`$${dashboard.total_rab_value_m_aud.toFixed(0)}M`}
            sub="Regulatory Asset Base"
          />
          <KpiCard
            label="Avg WACC"
            value={`${dashboard.avg_wacc_pct.toFixed(2)}%`}
            sub="Weighted Avg Cost of Capital"
          />
          <KpiCard
            label="Number of TNSPs"
            value={String(dashboard.num_tnsps)}
            sub="Active network operators"
          />
        </div>
      )}

      {/* TNSP Filter */}
      {!loading && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium mr-1">Filter by TNSP:</span>
          {TNSP_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setSelectedTnsp(opt)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                selectedTnsp === opt
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Revenue vs Approved Chart */}
      {!loading && filteredRevenue.length > 0 && (
        <RevenueVsApprovedChart records={filteredRevenue} />
      )}

      {/* AER Determinations Table */}
      {!loading && filteredDeterminations.length > 0 && (
        <DeterminationsTable determinations={filteredDeterminations} />
      )}

      {/* Asset Table */}
      {!loading && filteredAssets.length > 0 && (
        <AssetTable assets={filteredAssets} />
      )}

      {/* Empty state when no data after filter */}
      {!loading && !error && filteredRevenue.length === 0 && filteredDeterminations.length === 0 && filteredAssets.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <Network size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No data available for selected filter</p>
        </div>
      )}
    </div>
  )
}
