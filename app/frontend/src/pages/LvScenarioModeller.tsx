// LV Network Scenario Modeller
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Zap, DollarSign, Calendar, type LucideIcon } from 'lucide-react'
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

const FALLBACK_SCENARIOS = [
  {
    scenario_id: 'S0',
    scenario_name: 'Base Case (No Action)',
    description: 'No network augmentation — DER growth continues unconstrained',
    constrained_feeders: 87,
    annual_curtailment_mwh: 4820,
    capex_m: 0,
    timeline_years: 5,
    risk_level: 'High',
  },
  {
    scenario_id: 'S1',
    scenario_name: 'Targeted Augmentation',
    description: 'Upgrade top 15 most-constrained feeders with conductor replacement',
    constrained_feeders: 38,
    annual_curtailment_mwh: 1940,
    capex_m: 42.8,
    timeline_years: 3,
    risk_level: 'Medium',
  },
  {
    scenario_id: 'S2',
    scenario_name: 'Dynamic Operating Envelopes',
    description: 'DOE implementation on 200 feeders — managed curtailment approach',
    constrained_feeders: 52,
    annual_curtailment_mwh: 2210,
    capex_m: 18.4,
    timeline_years: 2,
    risk_level: 'Medium',
  },
  {
    scenario_id: 'S3',
    scenario_name: 'Community BESS + DOE',
    description: 'Community battery storage co-located with DOE — optimal DER integration',
    constrained_feeders: 22,
    annual_curtailment_mwh: 840,
    capex_m: 68.2,
    timeline_years: 4,
    risk_level: 'Low',
  },
]

const riskBadge = (level: string) => {
  if (level === 'High') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (level === 'Medium') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

export default function LvScenarioModeller() {
  const [scenarios, setScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getHostingCapacityScenarios().then((d) => {
      setScenarios(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_SCENARIOS)
      setLoading(false)
    }).catch(() => {
      setScenarios(FALLBACK_SCENARIOS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const base = scenarios.find(s => s.scenario_id === 'S0') ?? scenarios[0] ?? {}

  // Build chart data with one row per scenario
  const chartData = scenarios.map(s => ({
    name: s.scenario_name?.replace(' (No Action)', '') ?? s.scenario_id,
    constrained_feeders: s.constrained_feeders,
    curtailment_mwh: s.annual_curtailment_mwh,
    capex_m: s.capex_m,
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">LV Network Scenario Modeller</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">DER integration scenario analysis — constrained feeders, curtailment and augmentation capex</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Constrained Feeders (Base)" value={String(base.constrained_feeders ?? 0)} sub="No-action scenario" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Annual Curtailment (Base)" value={`${(base.annual_curtailment_mwh ?? 0).toLocaleString()} MWh`} sub="No-action scenario" Icon={Zap} color="bg-orange-500" />
        <KpiCard label="Network Aug. Cost (Best)" value={`$${Math.min(...scenarios.filter(s => s.scenario_id !== 'S0').map(s => s.capex_m ?? 999)).toFixed(0)}M`} sub="Minimum intervention capex" Icon={DollarSign} color="bg-blue-500" />
        <KpiCard label="Min. Timeline" value={`${Math.min(...scenarios.filter(s => s.scenario_id !== 'S0').map(s => s.timeline_years ?? 99))} yr`} sub="Fastest path to compliance" Icon={Calendar} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Constrained Feeders by Scenario</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Bar dataKey="constrained_feeders" fill="#EF4444" name="Constrained Feeders" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Annual Curtailment vs Capex by Scenario</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" MWh" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" $M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar yAxisId="left" dataKey="curtailment_mwh" fill="#F59E0B" name="Curtailment (MWh)" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="capex_m" fill="#3B82F6" name="Capex ($M)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Scenario Comparison Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Scenario</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Constrained</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Curtailment MWh</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Capex $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Timeline (yr)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {scenarios.map((row, i) => (
                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${row.scenario_id === 'S0' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold whitespace-nowrap">{row.scenario_name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs max-w-xs">{row.description}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{row.constrained_feeders}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.annual_curtailment_mwh ?? 0).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.capex_m === 0 ? '—' : `$${(row.capex_m ?? 0).toFixed(1)}M`}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.timeline_years}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${riskBadge(row.risk_level)}`}>{row.risk_level}</span>
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
