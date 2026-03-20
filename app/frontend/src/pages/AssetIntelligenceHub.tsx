// Cross-System Asset Intelligence Hub
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Heart, AlertTriangle, DollarSign, CheckCircle, type LucideIcon } from 'lucide-react'
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

const FALLBACK_HEALTH = [
  { asset_class: 'Zone Substations', health_score: 6.8, count: 42, replacement_value_m: 312.4 },
  { asset_class: 'Distribution Transformers', health_score: 5.9, count: 1840, replacement_value_m: 184.0 },
  { asset_class: 'HV Overhead Lines', health_score: 5.2, count: 620, replacement_value_m: 248.0 },
  { asset_class: 'LV Underground Cables', health_score: 7.1, count: 390, replacement_value_m: 97.5 },
  { asset_class: 'Circuit Breakers', health_score: 6.3, count: 280, replacement_value_m: 56.0 },
  { asset_class: 'Protection Relays', health_score: 4.8, count: 560, replacement_value_m: 33.6 },
  { asset_class: 'SCADA/Control Systems', health_score: 7.5, count: 38, replacement_value_m: 45.6 },
  { asset_class: 'Capacitor Banks', health_score: 5.5, count: 90, replacement_value_m: 18.0 },
]

const FALLBACK_ASSETS = [
  { asset_id: 'ZS-0042', asset_class: 'Zone Substation', description: 'Blacktown 132/33kV Zone Substation', age_years: 42, health_score: 3.2, failure_prob_pct: 28, consequence: 'High', priority_score: 94 },
  { asset_id: 'TX-1281', asset_class: 'Distribution Transformer', description: '11kV/LV 500kVA Pad Mount — St Marys Industrial', age_years: 38, health_score: 2.8, failure_prob_pct: 35, consequence: 'High', priority_score: 91 },
  { asset_id: 'OHL-0387', asset_class: 'HV Overhead Line', description: 'Penrith–Richmond 33kV single circuit', age_years: 51, health_score: 3.5, failure_prob_pct: 22, consequence: 'High', priority_score: 88 },
  { asset_id: 'CB-0019', asset_class: 'Circuit Breaker', description: 'Castle Hill 11kV oil CB', age_years: 44, health_score: 3.1, failure_prob_pct: 31, consequence: 'Medium', priority_score: 84 },
  { asset_id: 'PR-0088', asset_class: 'Protection Relay', description: 'Electromechanical IDMTL relay — Rouse Hill', age_years: 36, health_score: 2.4, failure_prob_pct: 42, consequence: 'High', priority_score: 83 },
  { asset_id: 'ZS-0018', asset_class: 'Zone Substation', description: 'Windsor 66/11kV Zone Substation', age_years: 39, health_score: 4.1, failure_prob_pct: 19, consequence: 'High', priority_score: 80 },
  { asset_id: 'TX-0892', asset_class: 'Distribution Transformer', description: '11kV/LV 315kVA Pole-top — Katoomba', age_years: 46, health_score: 3.7, failure_prob_pct: 24, consequence: 'Medium', priority_score: 77 },
  { asset_id: 'CAP-0041', asset_class: 'Capacitor Bank', description: '11kV 2MVAR capacitor bank — Seven Hills', age_years: 32, health_score: 4.5, failure_prob_pct: 18, consequence: 'Low', priority_score: 68 },
]

export default function AssetIntelligenceHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [healthScores, setHealthScores] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAssetIntelSummary(),
      api.getAssetIntelHealthScores(),
    ]).then(([s, h]) => {
      setSummary(s ?? {})
      const scores = Array.isArray(h?.items) ? h.items : Array.isArray(h) ? h : FALLBACK_HEALTH
      setHealthScores(scores)
      setAssets(Array.isArray(s?.top_risk_assets) ? s.top_risk_assets : FALLBACK_ASSETS)
      setLoading(false)
    }).catch(() => {
      setHealthScores(FALLBACK_HEALTH)
      setAssets(FALLBACK_ASSETS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const avgHealth = summary.avg_health_score ?? (healthScores.reduce((a, r) => a + (r.health_score ?? 0), 0) / (healthScores.length || 1))
  const highRiskPct = summary.high_risk_pct ?? 12.4
  const replacementValueM = summary.replacement_value_m ?? healthScores.reduce((a, r) => a + (r.replacement_value_m ?? 0), 0)
  const aerJustifiedPct = summary.aer_spend_justified_pct ?? 78.3

  const priorityColor = (score: number) => {
    if (score >= 90) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    if (score >= 75) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
    if (score >= 60) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Cross-System Asset Intelligence</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Composite health scoring, failure probability and AER expenditure alignment across all asset classes</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg Health Score" value={`${avgHealth.toFixed(1)}/10`} sub="Composite asset health index" Icon={Heart} color={avgHealth >= 6 ? 'bg-green-500' : avgHealth >= 4 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="High Risk" value={`${highRiskPct.toFixed(1)}%`} sub="Assets in critical/high band" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Replacement Value" value={`$${(replacementValueM / 1000).toFixed(1)}B`} sub="Total network asset value" Icon={DollarSign} color="bg-purple-500" />
        <KpiCard label="AER Spend Justified" value={`${aerJustifiedPct.toFixed(1)}%`} sub="Expenditure with adequate evidence" Icon={CheckCircle} color={aerJustifiedPct >= 80 ? 'bg-green-500' : 'bg-amber-500'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Health Score by Asset Class</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={healthScores} margin={{ bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="asset_class" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-25} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Bar dataKey="health_score" fill="#3B82F6" name="Health Score (0–10)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Top Priority Assets — Composite Risk Ranking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Asset ID</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Class</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Age (yr)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Health</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Fail. Prob.</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Consequence</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Priority Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {assets.map((a, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{a.asset_id}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{a.asset_class}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs max-w-xs">{a.description}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{a.age_years}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(a.health_score ?? 0) < 4 ? 'text-red-600 dark:text-red-400' : (a.health_score ?? 0) < 6 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(a.health_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{a.failure_prob_pct}%</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${a.consequence === 'High' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : a.consequence === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                      {a.consequence}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${priorityColor(a.priority_score ?? 0)}`}>
                      {a.priority_score}
                    </span>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-gray-400 dark:text-gray-500">No asset data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
