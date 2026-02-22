import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Monitor, TrendingUp, DollarSign, Activity } from 'lucide-react'
import {
  DETADashboard,
  DETATwinRecord,
  DETAPredictiveRecord,
  getDigitalEnergyTwinDashboard,
} from '../api/client'

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, Icon, colour,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── maturity label → numeric ─────────────────────────────────────────────────
const maturityLevel = (m: string): number => {
  if (m.startsWith('Level 1')) return 1
  if (m.startsWith('Level 2')) return 2
  if (m.startsWith('Level 3')) return 3
  return 4
}
const maturityLabel = (m: string): string => {
  const map: Record<string, string> = {
    'Level 1-Descriptive':  'L1 Descriptive',
    'Level 2-Diagnostic':   'L2 Diagnostic',
    'Level 3-Predictive':   'L3 Predictive',
    'Level 4-Prescriptive': 'L4 Prescriptive',
  }
  return map[m] ?? m
}

// ── chart colour palette ─────────────────────────────────────────────────────
const COLOURS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185', '#38bdf8', '#4ade80']

// ── page ─────────────────────────────────────────────────────────────────────
export default function DigitalEnergyTwinAnalytics() {
  const [data, setData] = useState<DETADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDigitalEnergyTwinDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Digital Energy Twin Analytics…</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
      </div>
    )
  }

  const { twins, data_streams, simulations, predictions, roi_records, summary } = data

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalTwins = Number(summary.total_twins_deployed)
  const avgMaturity = Number(summary.avg_twin_maturity_level).toFixed(1)
  const annualBenefit = `$${Number(summary.total_annual_benefit_m).toFixed(1)}M`
  const avgRoi = `${Number(summary.avg_roi_pct).toFixed(0)}%`

  // ── Chart 1: Maturity distribution by asset type ──────────────────────────
  const assetMaturityMap: Record<string, Record<string, number>> = {}
  twins.forEach((t: DETATwinRecord) => {
    if (!assetMaturityMap[t.asset_type]) assetMaturityMap[t.asset_type] = {}
    const lbl = maturityLabel(t.twin_maturity)
    assetMaturityMap[t.asset_type][lbl] = (assetMaturityMap[t.asset_type][lbl] ?? 0) + 1
  })
  const maturityDistData = Object.entries(assetMaturityMap).map(([at, lvls]) => ({
    assetType: at.replace(' ', '\n'),
    ...lvls,
  }))
  const maturityKeys = ['L1 Descriptive', 'L2 Diagnostic', 'L3 Predictive', 'L4 Prescriptive']

  // ── Chart 2: ROI accumulation over years per twin ────────────────────────
  const roiTwins = [...new Set(roi_records.map((r) => r.twin_id))].slice(0, 4)
  const roiYears = [...new Set(roi_records.map((r) => r.year))].sort()
  const roiLineData = roiYears.map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    roiTwins.forEach((tid) => {
      const recs = roi_records.filter((r) => r.twin_id === tid && r.year <= yr)
      row[tid] = Math.round(recs.reduce((s, r) => s + r.net_benefit_m, 0) * 100) / 100
    })
    return row
  })

  // ── Chart 3: Simulation types — cost and energy savings ──────────────────
  const simTypeMap: Record<string, { cost: number; energy: number; count: number }> = {}
  simulations.forEach((s) => {
    if (!simTypeMap[s.simulation_type])
      simTypeMap[s.simulation_type] = { cost: 0, energy: 0, count: 0 }
    simTypeMap[s.simulation_type].cost += s.cost_avoided_m
    simTypeMap[s.simulation_type].energy += s.energy_optimised_mwh
    simTypeMap[s.simulation_type].count += 1
  })
  const simChartData = Object.entries(simTypeMap).map(([st, v]) => ({
    type: st,
    cost_avoided_m: Math.round(v.cost * 100) / 100,
    energy_mwh: Math.round(v.energy),
    count: v.count,
  }))

  // ── Chart 4: Data streams by sensor type and quality ─────────────────────
  const sensorMap: Record<string, { count: number; qualitySum: number }> = {}
  data_streams.forEach((ds) => {
    if (!sensorMap[ds.sensor_type]) sensorMap[ds.sensor_type] = { count: 0, qualitySum: 0 }
    sensorMap[ds.sensor_type].count += 1
    sensorMap[ds.sensor_type].qualitySum += ds.data_quality_pct
  })
  const sensorChartData = Object.entries(sensorMap).map(([st, v]) => ({
    sensor: st,
    count: v.count,
    avg_quality: Math.round((v.qualitySum / v.count) * 10) / 10,
  }))

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Monitor size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Digital Energy Twin Analytics</h1>
          <p className="text-xs text-gray-400">Digital twins for energy assets and grid infrastructure</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Twins Deployed"
          value={String(totalTwins)}
          sub="Across all asset types"
          Icon={Monitor}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Maturity Level"
          value={avgMaturity}
          sub="1=Descriptive → 4=Prescriptive"
          Icon={Activity}
          colour="bg-emerald-600"
        />
        <KpiCard
          label="Annual Benefit"
          value={annualBenefit}
          sub="Net benefit 2024"
          Icon={DollarSign}
          colour="bg-amber-500"
        />
        <KpiCard
          label="Avg ROI"
          value={avgRoi}
          sub="Across all twin years"
          Icon={TrendingUp}
          colour="bg-purple-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Maturity distribution */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-white mb-4">Twin Maturity Distribution by Asset Type</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={maturityDistData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="assetType" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {maturityKeys.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="a" fill={COLOURS[i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Cumulative ROI */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-white mb-4">Cumulative Net Benefit by Twin (A$M)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={roiLineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {roiTwins.map((tid, i) => (
                <Line key={tid} type="monotone" dataKey={tid} stroke={COLOURS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: Simulation types */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-white mb-4">Simulation Cost Avoided by Type (A$M)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={simChartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="cost_avoided_m" name="Cost Avoided (A$M)" fill="#60a5fa" />
              <Bar dataKey="count" name="# Simulations" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Sensor types */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-white mb-4">Data Streams by Sensor Type & Avg Quality (%)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sensorChartData} margin={{ top: 4, right: 16, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sensor" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[80, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="count" name="Stream Count" fill="#f59e0b" />
              <Bar yAxisId="right" dataKey="avg_quality" name="Avg Quality %" fill="#a78bfa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table 1: Twin overview */}
      <div className="bg-gray-800 rounded-xl p-5 shadow overflow-x-auto">
        <h2 className="text-sm font-semibold text-white mb-4">Digital Twin Overview</h2>
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">Twin</th>
              <th className="text-left py-2 pr-4">Asset Type</th>
              <th className="text-left py-2 pr-4">Region</th>
              <th className="text-right py-2 pr-4">Capacity (MW)</th>
              <th className="text-left py-2 pr-4">Maturity</th>
              <th className="text-right py-2 pr-4">Streams</th>
              <th className="text-right py-2 pr-4">Accuracy %</th>
              <th className="text-right py-2 pr-4">ROI A$M/yr</th>
              <th className="text-left py-2">Use Cases</th>
            </tr>
          </thead>
          <tbody>
            {twins.map((t: DETATwinRecord) => {
              const lvl = maturityLevel(t.twin_maturity)
              const matColour =
                lvl === 4 ? 'text-emerald-400' :
                lvl === 3 ? 'text-blue-400' :
                lvl === 2 ? 'text-yellow-400' : 'text-gray-400'
              return (
                <tr key={t.twin_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{t.twin_name}</td>
                  <td className="py-2 pr-4">{t.asset_type}</td>
                  <td className="py-2 pr-4">{t.region}</td>
                  <td className="py-2 pr-4 text-right">{t.physical_capacity_mw.toLocaleString()}</td>
                  <td className={`py-2 pr-4 ${matColour}`}>{maturityLabel(t.twin_maturity)}</td>
                  <td className="py-2 pr-4 text-right">{t.data_streams_count}</td>
                  <td className="py-2 pr-4 text-right">{t.accuracy_pct.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">{t.roi_m_pa.toFixed(2)}</td>
                  <td className="py-2 text-gray-400">{t.use_cases.split(', ').slice(0, 3).join(', ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Table 2: Predictive maintenance */}
      <div className="bg-gray-800 rounded-xl p-5 shadow overflow-x-auto">
        <h2 className="text-sm font-semibold text-white mb-4">Predictive Maintenance Records</h2>
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-4">ID</th>
              <th className="text-left py-2 pr-4">Twin</th>
              <th className="text-left py-2 pr-4">Component</th>
              <th className="text-left py-2 pr-4">Prediction Type</th>
              <th className="text-right py-2 pr-4">Horizon (d)</th>
              <th className="text-right py-2 pr-4">Confidence %</th>
              <th className="text-left py-2 pr-4">Predicted Date</th>
              <th className="text-center py-2 pr-4">Accurate</th>
              <th className="text-right py-2 pr-4">Revenue Saved A$M</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p: DETAPredictiveRecord) => (
              <tr key={p.pred_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-mono text-gray-400">{p.pred_id}</td>
                <td className="py-2 pr-4 text-white">{p.twin_id}</td>
                <td className="py-2 pr-4">{p.asset_component}</td>
                <td className="py-2 pr-4">{p.prediction_type}</td>
                <td className="py-2 pr-4 text-right">{p.prediction_horizon_days}</td>
                <td className="py-2 pr-4 text-right">{p.confidence_pct.toFixed(1)}</td>
                <td className="py-2 pr-4">{p.predicted_event_date}</td>
                <td className="py-2 pr-4 text-center">
                  {p.prediction_accuracy
                    ? <span className="text-emerald-400 font-bold">Yes</span>
                    : p.false_positive
                    ? <span className="text-red-400">FP</span>
                    : <span className="text-yellow-400">No</span>}
                </td>
                <td className="py-2 pr-4 text-right text-emerald-400">
                  {p.prevented_revenue_loss_m.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
