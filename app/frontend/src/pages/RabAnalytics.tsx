import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Building2, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  RabDashboard,
  RegulatoryDetermination,
  RabYearlyRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
}

function KpiCard({ label, value, sub }: KpiProps) {
  return (
    <div className="rounded-lg p-4 bg-gray-800">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function AerBadge({ decision }: { decision: string }) {
  const styles: Record<string, string> = {
    FINAL:        'bg-green-800 text-green-200',
    DRAFT:        'bg-yellow-800 text-yellow-200',
    UNDER_REVIEW: 'bg-orange-800 text-orange-200',
  }
  const cls = styles[decision] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {decision.replace('_', ' ')}
    </span>
  )
}

function NetworkTypeBadge({ type }: { type: string }) {
  const cls = type === 'TNSP'
    ? 'bg-blue-800 text-blue-200'
    : 'bg-green-800 text-green-200'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RabAnalytics() {
  const [dashboard, setDashboard]   = useState<RabDashboard | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState<string>('TransGrid')

  useEffect(() => {
    api.getRabDashboard()
      .then(d => {
        setDashboard(d)
        if (d.yearly_records.length > 0) {
          setSelectedNetwork(d.yearly_records[0].network)
        }
      })
      .catch(e => setError(e.message ?? 'Failed to load RAB data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading RAB analytics…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertCircle className="mr-2" size={20} />
        {error ?? 'No data available'}
      </div>
    )
  }

  // Top 10 determinations by allowed revenue for bar chart
  const top10 = [...dashboard.determinations]
    .sort((a, b) => b.allowed_revenue_m_aud - a.allowed_revenue_m_aud)
    .slice(0, 10)
    .map(d => ({
      name: d.network,
      revenue: d.allowed_revenue_m_aud,
    }))

  // Unique networks for dropdown
  const uniqueNetworks = Array.from(
    new Set(dashboard.yearly_records.map(r => r.network))
  )

  // Filtered yearly records
  const filteredYearly = dashboard.yearly_records.filter(
    r => r.network === selectedNetwork
  )

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="text-blue-400" size={24} />
        <h1 className="text-xl font-bold text-white">
          Regulatory Asset Base &amp; Network Revenue Analytics
        </h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total TNSP RAB"
          value={`$${fmt(dashboard.total_tnsp_rab_m_aud)}M`}
          sub="Transmission networks"
        />
        <KpiCard
          label="Total DNSP RAB"
          value={`$${fmt(dashboard.total_dnsp_rab_m_aud)}M`}
          sub="Distribution networks"
        />
        <KpiCard
          label="Total Allowed Revenue"
          value={`$${fmt(dashboard.total_allowed_revenue_m_aud)}M`}
          sub="5-year regulatory periods"
        />
        <KpiCard
          label="Avg WACC"
          value={`${dashboard.avg_wacc_pct.toFixed(2)}%`}
          sub="Nominal, all networks"
        />
      </div>

      {/* Allowed Revenue Bar Chart */}
      <div className="bg-gray-800 rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Allowed Revenue by Network — Top 10 ($M, 5-year period)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            layout="vertical"
            data={top10}
            margin={{ top: 4, right: 30, left: 120, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickFormatter={v => `$${fmt(v as number)}M`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#D1D5DB', fontSize: 11 }}
              width={115}
            />
            <Tooltip
              contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#F3F4F6', fontSize: 12 }}
              formatter={(value: number) => [`$${fmt(value)}M`, 'Allowed Revenue']}
            />
            <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Determinations Table */}
      <div className="bg-gray-800 rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          AER Regulatory Determinations
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Network</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-left py-2 pr-4">Period</th>
                <th className="text-right py-2 pr-4">RAB Start ($M)</th>
                <th className="text-right py-2 pr-4">RAB End ($M)</th>
                <th className="text-right py-2 pr-4">WACC %</th>
                <th className="text-right py-2 pr-4">Allowed Rev ($M)</th>
                <th className="text-left py-2 pr-4">AER Decision</th>
                <th className="text-left py-2">Decision Date</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.determinations.map((d: RegulatoryDetermination) => (
                <tr key={d.determination_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 text-gray-100 font-medium">{d.network}</td>
                  <td className="py-2 pr-4"><NetworkTypeBadge type={d.network_type} /></td>
                  <td className="py-2 pr-4 text-gray-300">{d.state}</td>
                  <td className="py-2 pr-4 text-gray-300">{d.regulatory_period}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{fmt(d.rab_start_m_aud)}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{fmt(d.rab_end_m_aud)}</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{d.wacc_nominal_pct.toFixed(2)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-200">{fmt(d.allowed_revenue_m_aud)}</td>
                  <td className="py-2 pr-4"><AerBadge decision={d.aer_decision} /></td>
                  <td className="py-2 text-gray-400">{d.decision_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yearly Records Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Yearly CAPEX / OPEX Performance
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Network:</label>
            <select
              value={selectedNetwork}
              onChange={e => setSelectedNetwork(e.target.value)}
              className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              {uniqueNetworks.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Year</th>
                <th className="text-right py-2 pr-4">RAB ($M)</th>
                <th className="text-right py-2 pr-4">CAPEX Actual</th>
                <th className="text-right py-2 pr-4">CAPEX Allow</th>
                <th className="text-right py-2 pr-4">CAPEX Var %</th>
                <th className="text-right py-2 pr-4">OPEX Actual</th>
                <th className="text-right py-2 pr-4">OPEX Allow</th>
                <th className="text-right py-2 pr-4">OPEX Var %</th>
                <th className="text-right py-2">Under/Over Rec ($M)</th>
              </tr>
            </thead>
            <tbody>
              {filteredYearly.map((r: RabYearlyRecord) => {
                const capexVarColor = r.capex_variance_pct < 0 ? 'text-green-400' : 'text-red-400'
                const opexVarColor  = r.opex_variance_pct  < 0 ? 'text-green-400' : 'text-red-400'
                const underOverColor = r.under_over_recovery_m_aud >= 0 ? 'text-red-400' : 'text-green-400'
                return (
                  <tr key={r.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4 text-gray-100 font-medium">{r.year}</td>
                    <td className="py-2 pr-4 text-right text-gray-200">{fmt(r.rab_value_m_aud)}</td>
                    <td className="py-2 pr-4 text-right text-gray-200">{fmt(r.capex_actual_m_aud, 1)}</td>
                    <td className="py-2 pr-4 text-right text-gray-400">{fmt(r.capex_allowance_m_aud, 1)}</td>
                    <td className={`py-2 pr-4 text-right font-medium ${capexVarColor}`}>
                      {r.capex_variance_pct > 0 ? '+' : ''}{r.capex_variance_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-200">{fmt(r.opex_actual_m_aud, 1)}</td>
                    <td className="py-2 pr-4 text-right text-gray-400">{fmt(r.opex_allowance_m_aud, 1)}</td>
                    <td className={`py-2 pr-4 text-right font-medium ${opexVarColor}`}>
                      {r.opex_variance_pct > 0 ? '+' : ''}{r.opex_variance_pct.toFixed(1)}%
                    </td>
                    <td className={`py-2 text-right font-medium ${underOverColor}`}>
                      {r.under_over_recovery_m_aud > 0 ? '+' : ''}{fmt(r.under_over_recovery_m_aud, 1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
