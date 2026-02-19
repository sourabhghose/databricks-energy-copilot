import { useEffect, useState } from 'react'
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
import { Activity, AlertCircle, Loader2 } from 'lucide-react'
import { api, DemandResponseDashboard, RertContract, DemandResponseActivation, DemandResponseProvider } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers / badges
// ---------------------------------------------------------------------------

function activationTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'RERT':      return <span className={`${base} bg-blue-800 text-blue-100`}>RERT</span>
    case 'SRAS':      return <span className={`${base} bg-purple-800 text-purple-100`}>SRAS</span>
    case 'VOLUNTARY': return <span className={`${base} bg-green-800 text-green-100`}>VOLUNTARY</span>
    default:          return <span className={`${base} bg-gray-600 text-gray-200`}>{type}</span>
  }
}

function triggerBadge(trigger: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (trigger) {
    case 'PRICE_SPIKE':       return <span className={`${base} bg-red-800 text-red-100`}>PRICE SPIKE</span>
    case 'RESERVE_LOW':       return <span className={`${base} bg-amber-700 text-amber-100`}>RESERVE LOW</span>
    case 'SYSTEM_EMERGENCY':  return <span className={`${base} bg-rose-800 text-rose-100`}>SYS EMERGENCY</span>
    default:                  return <span className={`${base} bg-gray-600 text-gray-200`}>{trigger}</span>
  }
}

function providerTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'AGGREGATOR': return <span className={`${base} bg-blue-700 text-blue-100`}>AGGREGATOR</span>
    case 'INDUSTRIAL': return <span className={`${base} bg-amber-700 text-amber-100`}>INDUSTRIAL</span>
    case 'RETAILER':   return <span className={`${base} bg-teal-700 text-teal-100`}>RETAILER</span>
    case 'C&I':        return <span className={`${base} bg-purple-700 text-purple-100`}>C&amp;I</span>
    default:           return <span className={`${base} bg-gray-600 text-gray-200`}>{type}</span>
  }
}

function reliabilityColor(pct: number): string {
  if (pct >= 98) return 'text-green-400 font-bold'
  if (pct >= 95) return 'text-green-400'
  if (pct >= 92) return 'text-amber-400'
  return 'text-red-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

function KpiCard({ label, value, sub, highlight }: KpiProps) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-blue-900/40 border border-blue-700/50' : 'bg-gray-800'}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DemandResponseAnalytics() {
  const [dashboard, setDashboard] = useState<DemandResponseDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDrDashboard()
      .then(setDashboard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading demand response data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-6">
        <AlertCircle size={18} />
        <span>Error: {error ?? 'No data'}</span>
      </div>
    )
  }

  // Bar chart data: top 8 contracts by contracted_mw
  const contractChartData = [...dashboard.contracts]
    .sort((a, b) => b.contracted_mw - a.contracted_mw)
    .slice(0, 8)
    .map(c => ({
      name: c.provider.length > 18 ? c.provider.slice(0, 18) + '…' : c.provider,
      contracted: c.contracted_mw,
      available: c.available_mw,
    }))

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="text-blue-400" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white">Demand Response &amp; RERT Analytics</h1>
          <p className="text-sm text-gray-400">
            RERT, SRAS &amp; NSCAS contracts — as at {dashboard.timestamp}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Contracted MW"
          value={`${dashboard.total_contracted_mw.toLocaleString()} MW`}
          sub="Across all contract types"
          highlight
        />
        <KpiCard
          label="Total Available MW"
          value={`${dashboard.total_available_mw.toLocaleString()} MW`}
          sub={`${((dashboard.total_available_mw / dashboard.total_contracted_mw) * 100).toFixed(1)}% availability`}
        />
        <KpiCard
          label="Activations YTD"
          value={String(dashboard.activations_ytd)}
          sub={`Avg ${dashboard.avg_activation_duration_min} min duration`}
        />
        <KpiCard
          label="Avoided VOLL"
          value={`$${dashboard.avoided_voll_m_aud.toFixed(1)}M`}
          sub={`Contract cost $${dashboard.total_activation_cost_m_aud.toFixed(1)}M`}
        />
      </div>

      {/* Bar Chart: Contracted vs Available by Provider */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Contracted vs Available MW by Provider (Top 8)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={contractChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#F9FAFB', fontSize: 12 }}
              itemStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
            <Bar dataKey="contracted" name="Contracted MW" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="available"  name="Available MW"  fill="#10B981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Activations Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Activations ({dashboard.activations.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left py-2 pr-3">ID</th>
                <th className="text-left py-2 pr-3">Interval</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-left py-2 pr-3">Provider</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-right py-2 pr-3">MW</th>
                <th className="text-right py-2 pr-3">Duration</th>
                <th className="text-left py-2 pr-3">Trigger</th>
                <th className="text-right py-2 pr-3">Spot $/MWh</th>
                <th className="text-right py-2 pr-3">Avoided VOLL $M</th>
                <th className="text-right py-2">Cost $</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.activations.map((a: DemandResponseActivation) => (
                <tr key={a.activation_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-mono text-xs text-gray-300">{a.activation_id}</td>
                  <td className="py-2 pr-3 text-xs text-gray-300">{a.trading_interval}</td>
                  <td className="py-2 pr-3 font-semibold text-blue-300">{a.region}</td>
                  <td className="py-2 pr-3 text-gray-200 max-w-[140px] truncate" title={a.provider}>{a.provider}</td>
                  <td className="py-2 pr-3">{activationTypeBadge(a.activation_type)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-white">{a.activated_mw.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{a.duration_min} min</td>
                  <td className="py-2 pr-3">{triggerBadge(a.trigger)}</td>
                  <td className="py-2 pr-3 text-right text-amber-300">${a.spot_price_aud_mwh.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-green-400">${a.avoided_voll_m_aud.toFixed(3)}</td>
                  <td className="py-2 text-right text-gray-300">${a.cost_aud.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Providers Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Registered Providers ({dashboard.providers.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="text-left py-2 pr-3">Provider</th>
                <th className="text-left py-2 pr-3">Type</th>
                <th className="text-right py-2 pr-3">Registered MW</th>
                <th className="text-left py-2 pr-3">Regions</th>
                <th className="text-right py-2 pr-3">Reliability</th>
                <th className="text-right py-2">Avg Response (min)</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.providers.map((p: DemandResponseProvider) => (
                <tr key={p.provider_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-semibold text-white">{p.provider_name}</td>
                  <td className="py-2 pr-3">{providerTypeBadge(p.provider_type)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-blue-300">{p.registered_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-300 text-xs">{p.regions.join(', ')}</td>
                  <td className={`py-2 pr-3 text-right ${reliabilityColor(p.reliability_pct)}`}>
                    {p.reliability_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-gray-300">{p.avg_response_time_min.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
