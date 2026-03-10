import { useState, useEffect } from 'react'
import { AlertTriangle, Zap, Car, TrendingUp, RefreshCw } from 'lucide-react'
import { networkPlanningApi, DemandForecastSpatial, NetworkConstraint, EVImpact } from '../api/client'

type EVScenario = 'low' | 'medium' | 'high'

type TabId = 'demand' | 'constraints' | 'ev_impact' | 'augmentation'

interface SummaryData {
  total_constraints: number
  breach_by_2030: number
  avg_ev_impact_2030_mw: number
}

interface AugmentationOption {
  zone_substation: string
  constraint_type: string
  option: string
  type: 'network' | 'non_network'
  npv_aud: number
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'demand', label: 'Demand Forecast' },
  { id: 'constraints', label: 'Constraint Register' },
  { id: 'ev_impact', label: 'EV Impact' },
  { id: 'augmentation', label: 'Augmentation Options' },
]

const YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i)

const SCENARIO_COLORS: Record<string, string> = {
  bau: 'bg-gray-600 text-gray-200',
  high_solar: 'bg-yellow-700 text-yellow-100',
  high_ev: 'bg-green-700 text-green-100',
  combined: 'bg-blue-700 text-blue-100',
}

const SCENARIO_LABELS: Record<string, string> = {
  bau: 'BAU',
  high_solar: 'High Solar',
  high_ev: 'High EV',
  combined: 'Combined',
}

function formatNpv(aud: number): string {
  const m = aud / 1_000_000
  return `$${m.toFixed(1)}M`
}

function UtilizationBar({ pct }: { pct: number }) {
  const color = pct > 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = pct > 90 ? 'text-red-400' : pct >= 75 ? 'text-amber-400' : 'text-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${textColor}`}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-start gap-3">
      <div className="text-blue-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-2xl font-bold text-gray-100 mt-0.5">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function DemandForecastTab() {
  const [year, setYear] = useState(2030)
  const [data, setData] = useState<DemandForecastSpatial[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    networkPlanningApi
      .demandForecast()
      .then((res: any) => setData(res?.forecasts ?? (Array.isArray(res) ? res : [])))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const scenarioKeys = ['bau', 'high_solar', 'high_ev', 'combined']

  // Pivot: group by zone_substation, then for selected year find peak_demand_mw per scenario
  const zones = [...new Set(data.map(r => r.zone_substation))].sort()
  const pivoted: Record<string, Record<string, number | null>> = {}
  zones.forEach(z => {
    pivoted[z] = {}
    scenarioKeys.forEach(s => {
      const row = data.find(r => r.zone_substation === z && r.scenario === s && r.forecast_year === year)
      pivoted[z][s] = row ? row.peak_demand_mw : null
    })
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-gray-400 text-sm">Year:</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="flex gap-2 ml-4">
          {Object.entries(SCENARIO_LABELS).map(([k, v]) => (
            <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${SCENARIO_COLORS[k]}`}>
              {v}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <RefreshCw className="animate-spin mr-2" size={16} />
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Zone / Substation</th>
                {scenarioKeys.map((s) => (
                  <th key={s} className="text-right py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SCENARIO_COLORS[s]}`}>
                      {SCENARIO_LABELS[s]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 text-gray-100 font-medium">{zone}</td>
                  {scenarioKeys.map((s) => {
                    const val = pivoted[zone]?.[s]
                    return (
                      <td key={s} className="py-2 px-3 text-right text-gray-300">
                        {val != null ? `${val.toFixed(1)} MW` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No forecast data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConstraintRegisterTab() {
  const [data, setData] = useState<NetworkConstraint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    networkPlanningApi
      .constraints()
      .then((res: any) => setData(res?.constraints ?? (Array.isArray(res) ? res : [])))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const typeColors: Record<string, string> = {
    thermal: 'bg-orange-700 text-orange-100',
    voltage: 'bg-purple-700 text-purple-100',
    stability: 'bg-red-700 text-red-100',
    fault_level: 'bg-pink-700 text-pink-100',
  }

  return loading ? (
    <div className="flex items-center justify-center h-32 text-gray-500">
      <RefreshCw className="animate-spin mr-2" size={16} />
      Loading...
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Constraint ID</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Zone / Substation</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Limiting Asset</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium w-40">Utilisation</th>
            <th className="text-right py-2 px-3 text-gray-400 font-medium">Breach (BAU)</th>
            <th className="text-right py-2 px-3 text-gray-400 font-medium">Breach (High)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.constraint_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 px-3 text-gray-100 font-mono text-xs">{row.constraint_id}</td>
              <td className="py-2 px-3 text-gray-300">{row.zone_substation}</td>
              <td className="py-2 px-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    typeColors[row.constraint_type] || 'bg-gray-600 text-gray-200'
                  }`}
                >
                  {row.constraint_type}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400 text-xs">{row.limiting_asset}</td>
              <td className="py-2 px-3">
                <UtilizationBar pct={row.current_utilization_pct} />
              </td>
              <td className="py-2 px-3 text-right text-gray-300">
                {row.breach_year_bau ?? <span className="text-gray-600">None</span>}
              </td>
              <td className="py-2 px-3 text-right text-gray-300">
                {row.breach_year_high ?? <span className="text-gray-600">None</span>}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-gray-500">
                No constraints found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function EVImpactTab() {
  const [scenario, setScenario] = useState<EVScenario>('medium')
  const [data, setData] = useState<EVImpact[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    networkPlanningApi
      .evImpact()
      .then((res: any) => setData(res?.impacts ?? (Array.isArray(res) ? res : [])))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const scenarios: EVScenario[] = ['low', 'medium', 'high']

  const filtered = data.filter((r) => r.scenario === scenario)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {scenarios.map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              scenario === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <RefreshCw className="animate-spin mr-2" size={16} />
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Feeder ID</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Target Year</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Peak Load Delta</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Assets at Risk</th>
                <th className="text-center py-2 px-3 text-gray-400 font-medium">Upgrade Required</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={`${row.feeder_id}-${i}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 text-gray-100 font-mono text-xs">{row.feeder_id}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{row.target_year}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={row.peak_load_delta_mw > 0 ? 'text-red-400' : 'text-green-400'}>
                      {row.peak_load_delta_mw > 0 ? '+' : ''}
                      {row.peak_load_delta_mw.toFixed(2)} MW
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">{row.assets_at_risk}</td>
                  <td className="py-2 px-3 text-center">
                    {(row.upgrade_required_flag ?? (row as any).upgrade_required) ? (
                      <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full">Required</span>
                    ) : (
                      <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No EV impact data for {scenario} scenario
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AugmentationOptionsTab() {
  const [data, setData] = useState<AugmentationOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    networkPlanningApi
      .augmentationOptions()
      .then((res: any) => setData(res?.options ?? (Array.isArray(res) ? res : [])))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const typeColors: Record<string, string> = {
    thermal: 'bg-orange-700 text-orange-100',
    voltage: 'bg-purple-700 text-purple-100',
    stability: 'bg-red-700 text-red-100',
    fault_level: 'bg-pink-700 text-pink-100',
  }

  return loading ? (
    <div className="flex items-center justify-center h-32 text-gray-500">
      <RefreshCw className="animate-spin mr-2" size={16} />
      Loading...
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Zone / Substation</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Constraint Type</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Option</th>
            <th className="text-center py-2 px-3 text-gray-400 font-medium">Category</th>
            <th className="text-right py-2 px-3 text-gray-400 font-medium">NPV</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 px-3 text-gray-100">{row.zone_substation}</td>
              <td className="py-2 px-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    typeColors[row.constraint_type] || 'bg-gray-600 text-gray-200'
                  }`}
                >
                  {row.constraint_type}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-300">{row.option}</td>
              <td className="py-2 px-3 text-center">
                {row.type === 'network' ? (
                  <span className="bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded-full">Network</span>
                ) : (
                  <span className="bg-teal-900 text-teal-300 text-xs px-2 py-0.5 rounded-full">Non-Network</span>
                )}
              </td>
              <td className="py-2 px-3 text-right text-gray-300">{formatNpv(row.npv_aud)}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-500">
                No augmentation options available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function NetworkPlanning() {
  const [activeTab, setActiveTab] = useState<TabId>('demand')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    setSummaryLoading(true)
    networkPlanningApi
      .summary()
      .then((res: SummaryData) => setSummary(res))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Network Planning</h1>
        <p className="text-gray-400 text-sm mt-1">Spatial demand forecasts, constraints &amp; EV impact projections</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Total Constraints"
          value={summaryLoading ? '—' : (summary?.total_constraints ?? '—')}
          sub="Active network constraints"
        />
        <KpiCard
          icon={<Zap size={20} />}
          label="Breach by 2030"
          value={summaryLoading ? '—' : (summary?.breach_by_2030 ?? '—')}
          sub="Constraints breaching under BAU"
        />
        <KpiCard
          icon={<Car size={20} />}
          label="Avg EV Impact 2030"
          value={
            summaryLoading
              ? '—'
              : summary?.avg_ev_impact_2030_mw != null
              ? `${summary.avg_ev_impact_2030_mw.toFixed(1)} MW`
              : '—'
          }
          sub="Average peak load delta (medium scenario)"
        />
      </div>

      {/* Tab navigation + content */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex gap-2 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'demand' && <DemandForecastTab />}
        {activeTab === 'constraints' && <ConstraintRegisterTab />}
        {activeTab === 'ev_impact' && <EVImpactTab />}
        {activeTab === 'augmentation' && <AugmentationOptionsTab />}
      </div>
    </div>
  )
}
