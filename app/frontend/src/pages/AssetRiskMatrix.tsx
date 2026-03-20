// Asset Risk Matrix
import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, TrendingDown, Activity, type LucideIcon } from 'lucide-react'
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

const FALLBACK_ASSETS = [
  { asset_id: 'ZS-0042', asset_class: 'Zone Substation', description: 'Blacktown 132/33kV', age_years: 42, health_score: 3.2, failure_prob_pct: 28, consequence: 'Catastrophic', likelihood: 'Likely', risk_score: 20, risk_level: 'Extreme' },
  { asset_id: 'PR-0088', asset_class: 'Protection Relay', description: 'Rouse Hill IDMTL', age_years: 36, health_score: 2.4, failure_prob_pct: 42, consequence: 'Major', likelihood: 'Almost Certain', risk_score: 20, risk_level: 'Extreme' },
  { asset_id: 'TX-1281', asset_class: 'Distribution Transformer', description: 'St Marys 500kVA', age_years: 38, health_score: 2.8, failure_prob_pct: 35, consequence: 'Major', likelihood: 'Likely', risk_score: 16, risk_level: 'High' },
  { asset_id: 'OHL-0387', asset_class: 'HV Overhead Line', description: 'Penrith–Richmond 33kV', age_years: 51, health_score: 3.5, failure_prob_pct: 22, consequence: 'Major', likelihood: 'Possible', risk_score: 12, risk_level: 'High' },
  { asset_id: 'CB-0019', asset_class: 'Circuit Breaker', description: 'Castle Hill 11kV oil CB', age_years: 44, health_score: 3.1, failure_prob_pct: 31, consequence: 'Moderate', likelihood: 'Likely', risk_score: 12, risk_level: 'High' },
  { asset_id: 'ZS-0018', asset_class: 'Zone Substation', description: 'Windsor 66/11kV', age_years: 39, health_score: 4.1, failure_prob_pct: 19, consequence: 'Major', likelihood: 'Possible', risk_score: 12, risk_level: 'High' },
  { asset_id: 'TX-0892', asset_class: 'Distribution Transformer', description: 'Katoomba 315kVA', age_years: 46, health_score: 3.7, failure_prob_pct: 24, consequence: 'Moderate', likelihood: 'Possible', risk_score: 9, risk_level: 'Medium' },
  { asset_id: 'CAP-0041', asset_class: 'Capacitor Bank', description: 'Seven Hills 2MVAR', age_years: 32, health_score: 4.5, failure_prob_pct: 18, consequence: 'Minor', likelihood: 'Likely', risk_score: 8, risk_level: 'Medium' },
  { asset_id: 'LV-2201', asset_class: 'LV Cable', description: 'Parramatta underground', age_years: 28, health_score: 5.8, failure_prob_pct: 11, consequence: 'Minor', likelihood: 'Possible', risk_score: 6, risk_level: 'Medium' },
  { asset_id: 'TR-0110', asset_class: 'Power Transformer', description: 'Gosford 132/33kV 60MVA', age_years: 22, health_score: 6.2, failure_prob_pct: 8, consequence: 'Major', likelihood: 'Unlikely', risk_score: 8, risk_level: 'Medium' },
]

// 5x5 risk matrix colours
const MATRIX_COLORS: Record<string, string> = {
  'extreme': 'bg-red-600 text-white',
  'high': 'bg-orange-500 text-white',
  'medium': 'bg-amber-400 text-gray-900',
  'low': 'bg-green-400 text-gray-900',
  'negligible': 'bg-green-200 text-gray-700',
}

const CONSEQUENCES = ['Catastrophic', 'Major', 'Moderate', 'Minor', 'Insignificant']
const LIKELIHOODS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare']

// Risk level for each [likelihood][consequence] cell — simplified AS/NZS 31010
const RISK_LEVEL_MATRIX: string[][] = [
  ['extreme', 'extreme', 'high',   'high',   'medium'],
  ['extreme', 'high',   'high',   'medium', 'medium'],
  ['high',    'high',   'medium', 'medium', 'low'],
  ['high',    'medium', 'medium', 'low',    'low'],
  ['medium',  'medium', 'low',    'low',    'negligible'],
]

export default function AssetRiskMatrix() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAssetIntelSummary(),
      api.getAssetIntelHealthScores(),
    ]).then(([s, _h]) => {
      setSummary(s ?? {})
      setAssets(Array.isArray(s?.top_risk_assets) ? s.top_risk_assets : FALLBACK_ASSETS)
      setLoading(false)
    }).catch(() => {
      setAssets(FALLBACK_ASSETS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const criticalCount = assets.filter(a => a.risk_level === 'Extreme' || a.risk_level === 'Critical').length
  const pastEolCount = assets.filter(a => (a.age_years ?? 0) > 40).length
  const avgFailProb = assets.length ? assets.reduce((a, r) => a + (r.failure_prob_pct ?? 0), 0) / assets.length : 0

  const riskLevelBadge = (level: string) => {
    if (level === 'Extreme' || level === 'Critical') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    if (level === 'High') return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
    if (level === 'Medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Risk Matrix</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Likelihood × Consequence risk assessment aligned to AS/NZS 31010</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Critical Risk Count" value={String(criticalCount)} sub="Extreme/Critical risk assets" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Past EOL" value={String(pastEolCount)} sub="Assets older than 40 years" Icon={Clock} color="bg-orange-500" />
        <KpiCard label="Avg Failure Prob." value={`${avgFailProb.toFixed(1)}%`} sub="Annual failure probability" Icon={TrendingDown} color="bg-amber-500" />
        <KpiCard label="Total Assets Assessed" value={String(summary.total_assets ?? assets.length)} sub="Network assets in scope" Icon={Activity} color="bg-blue-500" />
      </div>

      {/* 5×5 Risk Matrix Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">5×5 Risk Matrix — Likelihood vs Consequence</h2>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-gray-500 dark:text-gray-400 w-32">Likelihood \ Consequence</th>
                {CONSEQUENCES.map(c => (
                  <th key={c} className="p-2 text-center text-gray-600 dark:text-gray-400 font-medium w-28">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIKELIHOODS.map((likelihood, li) => (
                <tr key={likelihood}>
                  <td className="p-2 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap pr-4">{likelihood}</td>
                  {CONSEQUENCES.map((_, ci) => {
                    const level = RISK_LEVEL_MATRIX[li][ci]
                    return (
                      <td key={ci} className="p-0.5">
                        <div className={`h-10 w-full rounded flex items-center justify-center text-[11px] font-semibold capitalize ${MATRIX_COLORS[level]}`}>
                          {level}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs">
          {Object.entries(MATRIX_COLORS).map(([level, cls]) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${cls.split(' ')[0]}`} />
              <span className="text-gray-500 dark:text-gray-400 capitalize">{level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 10 highest risk assets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Top-10 Highest Risk Assets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Asset ID</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Class</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Age (yr)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Health</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Likelihood</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Consequence</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {assets.slice(0, 10).map((a, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{a.asset_id}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{a.asset_class}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs">{a.description}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{a.age_years}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(a.health_score ?? 0) < 4 ? 'text-red-600 dark:text-red-400' : (a.health_score ?? 0) < 6 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(a.health_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{a.likelihood}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{a.consequence}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${riskLevelBadge(a.risk_level)}`}>{a.risk_level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
