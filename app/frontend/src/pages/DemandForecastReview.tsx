// Demand Forecast Review (DAPR)
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Zap, TrendingUp, TrendingDown, Activity, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'

interface KpiCardProps {
  label: string; value: string; sub?: string
  Icon: LucideIcon; color: string
}
function KpiCard({ label, value, sub, Icon, color }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const FALLBACK_FORECAST = [
  { year: 2026, gross_peak_mw: 4820, der_offset_mw: 380, net_peak_mw: 4440, growth_pct: 1.8 },
  { year: 2027, gross_peak_mw: 4904, der_offset_mw: 520, net_peak_mw: 4384, growth_pct: 1.7 },
  { year: 2028, gross_peak_mw: 5004, der_offset_mw: 680, net_peak_mw: 4324, growth_pct: 2.0 },
  { year: 2029, gross_peak_mw: 5118, der_offset_mw: 860, net_peak_mw: 4258, growth_pct: 2.3 },
  { year: 2030, gross_peak_mw: 5234, der_offset_mw: 1060, net_peak_mw: 4174, growth_pct: 2.3 },
]

export default function DemandForecastReview() {
  const [forecast, setForecast] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDaprDemandForecast().then((d) => {
      setSummary(d?.summary ?? {})
      setForecast(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_FORECAST)
      setLoading(false)
    }).catch(() => {
      setForecast(FALLBACK_FORECAST)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const currentYear = forecast[0] ?? {}
  const lastYear = forecast[forecast.length - 1] ?? {}
  const peakDemandMW = currentYear.gross_peak_mw ?? 0
  const fiveYearGrowthPct = (peakDemandMW > 0 && lastYear.gross_peak_mw > 0)
    ? ((lastYear.gross_peak_mw - peakDemandMW) / peakDemandMW) * 100
    : summary.five_year_growth_pct ?? 8.6
  const derOffsetMW = lastYear.der_offset_mw ?? 0
  const netPeakMW = lastYear.net_peak_mw ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Demand Forecast Review (DAPR)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">5-year peak demand forecast with DER offset — DAPR Section D2 supporting analysis</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Peak Demand (Current)" value={`${peakDemandMW.toLocaleString()} MW`} sub={`${currentYear.year ?? 2026} maximum demand`} Icon={Zap} color="bg-blue-500" />
        <KpiCard label="5-Year Growth" value={`+${fiveYearGrowthPct.toFixed(1)}%`} sub="Gross peak demand growth" Icon={TrendingUp} color="bg-green-500" />
        <KpiCard label="DER Offset (2030)" value={`${derOffsetMW.toLocaleString()} MW`} sub="Rooftop solar, BESS, EVs" Icon={TrendingDown} color="bg-purple-500" />
        <KpiCard label="Net Peak (2030)" value={`${netPeakMW.toLocaleString()} MW`} sub="After DER offset" Icon={Activity} color="bg-amber-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Gross Peak Demand vs Net Peak Demand (MW)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={forecast} margin={{ bottom: 10, left: 10 }}>
            <defs>
              <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" MW" domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Area type="monotone" dataKey="gross_peak_mw" stroke="#3B82F6" fill="url(#grossGrad)" strokeWidth={2} name="Gross Peak (MW)" />
            <Area type="monotone" dataKey="net_peak_mw" stroke="#10B981" fill="url(#netGrad)" strokeWidth={2} name="Net Peak after DER (MW)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Annual Demand Forecast Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Year</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Gross Peak MW</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">YoY Growth %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">DER Offset MW</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Net Peak MW</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Net Change vs Current</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {forecast.map((row, i) => {
                const netChange = peakDemandMW > 0 ? row.net_peak_mw - peakDemandMW : 0
                return (
                  <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${i === 0 ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-bold font-mono">{row.year}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.gross_peak_mw ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        +{(row.growth_pct ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-purple-600 dark:text-purple-400 font-semibold">{(row.der_offset_mw ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{(row.net_peak_mw ?? 0).toLocaleString()}</td>
                    <td className="py-2.5">
                      <span className={`font-semibold text-xs ${netChange <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {i === 0 ? '—' : `${netChange <= 0 ? '' : '+'}${netChange.toFixed(0)} MW`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">DER offset includes rooftop solar (6.5% annual growth), residential BESS and managed EV charging per AER-approved assumptions.</p>
      </div>
    </div>
  )
}
