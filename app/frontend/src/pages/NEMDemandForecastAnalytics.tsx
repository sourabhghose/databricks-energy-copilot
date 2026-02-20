import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, MapPin, BarChart2, Activity, AlertTriangle } from 'lucide-react'
import {
  getNEMDemandForecastDashboard,
  NDFDashboard,
  NDFGrowthDriverRecord,
  NDFSensitivityRecord,
  NDFReliabilityOutlookRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#22d3ee',
  QLD1: '#4ade80',
  VIC1: '#f472b6',
  SA1:  '#facc15',
  TAS1: '#fb923c',
}

const CONFIDENCE_COLOURS: Record<string, string> = {
  HIGH:   'bg-green-600',
  MEDIUM: 'bg-yellow-600',
  LOW:    'bg-red-600',
}

const CATEGORY_COLOURS: Record<string, string> = {
  EV:              '#22d3ee',
  ELECTRIFICATION: '#4ade80',
  ECONOMIC:        '#f472b6',
  POPULATION:      '#facc15',
  EFFICIENCY:      '#fb923c',
  SOLAR_OFFSET:    '#a78bfa',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NEMDemandForecastAnalytics() {
  const [data, setData] = useState<NDFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNEMDemandForecastDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading NEM Demand Forecast Analytics...</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data'}</p>
    </div>
  )

  const summary = data.summary as Record<string, string | number>

  // ─── Regional demand forecast: CENTRAL scenario, annual energy by year ──────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const centralByYear: Record<number, Record<string, number>> = {}
  for (const rf of data.regional_forecasts) {
    if (rf.scenario !== 'CENTRAL') continue
    if (!centralByYear[rf.year]) centralByYear[rf.year] = { year: rf.year }
    centralByYear[rf.year][rf.region] = rf.annual_energy_twh
  }
  const demandForecastChartData = Object.values(centralByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // ─── Peak demand 50 POE by year (SUMMER, all regions combined avg) ──────────
  const peakByYear: Record<number, Record<string, number>> = {}
  for (const pd of data.peak_demands) {
    if (pd.season !== 'SUMMER') continue
    if (!peakByYear[pd.year]) peakByYear[pd.year] = { year: pd.year }
    peakByYear[pd.year][`${pd.region}_10poe`] = pd.peak_10_poe_mw
    peakByYear[pd.year][`${pd.region}_50poe`] = pd.peak_50_poe_mw
    peakByYear[pd.year][`${pd.region}_90poe`] = pd.peak_90_poe_mw
  }
  const peakChartData = Object.values(peakByYear).sort((a, b) => (a.year as number) - (b.year as number))

  // ─── Growth drivers: contribution TWh 2040 ────────────────────────────────
  const driversChartData = data.growth_drivers.map((d: NDFGrowthDriverRecord) => ({
    name: `${d.driver} (${d.region})`.substring(0, 32),
    'TWh 2040': d.contribution_twh_2040,
    'TWh 2030': d.contribution_twh_2030,
    category: d.category,
  })).sort((a, b) => b['TWh 2040'] - a['TWh 2040'])

  // ─── Sensitivity tornado chart data ───────────────────────────────────────
  const tornadoData = data.sensitivities.map((s: NDFSensitivityRecord) => ({
    parameter: s.parameter,
    low: s.low_case_aud,
    central: s.central_case_aud,
    high: s.high_case_aud,
    range: s.high_case_aud - s.low_case_aud,
    impact: s.impact_on_peak_mw,
  })).sort((a, b) => b.range - a.range)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-800 rounded-xl">
          <TrendingUp className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Demand Forecast Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ESOO/GSOO-style electricity demand forecasting, load growth drivers, and reliability outlook
          </p>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Regions Modelled"
          value={String(summary.total_regions ?? 5)}
          sub="NEM dispatch regions"
          Icon={MapPin}
        />
        <KpiCard
          label="Scenarios"
          value={String(summary.scenarios_modelled ?? 4)}
          sub="LOW / CENTRAL / HIGH / STEP_CHANGE"
          Icon={BarChart2}
        />
        <KpiCard
          label="Forecast Horizon"
          value={`${summary.forecast_horizon_years ?? 17} yrs`}
          sub="2024 – 2040"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Highest Growth"
          value={String(summary.highest_growth_scenario ?? 'STEP_CHANGE')}
          sub="Scenario with greatest load growth"
          Icon={Activity}
        />
      </div>

      {/* ─── Regional Demand Forecast LineChart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Regional Demand Forecast — CENTRAL Scenario (TWh)</h2>
        <p className="text-xs text-gray-400 mb-4">Annual energy demand by NEM region, central growth scenario 2024–2040</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={demandForecastChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {regions.map(r => (
              <Line
                key={r}
                type="monotone"
                dataKey={r}
                stroke={REGION_COLOURS[r] ?? '#60a5fa'}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Peak Demand 10/50/90 POE (NSW1 SUMMER) ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Peak Demand POE Bands — NSW1 Summer (MW)</h2>
        <p className="text-xs text-gray-400 mb-4">10%, 50%, and 90% probability of exceedance for NSW1 summer maximum demand</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={peakChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="NSW1_10poe"
              name="10% POE (high)"
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="NSW1_50poe"
              name="50% POE (central)"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="NSW1_90poe"
              name="90% POE (low)"
              stroke="#4ade80"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Growth Drivers Horizontal BarChart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Load Growth Drivers — Contribution 2030 vs 2040 (TWh)</h2>
        <p className="text-xs text-gray-400 mb-4">Key demand drivers by NEM region; negative values indicate load reduction</p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={driversChartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 180, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={175}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="TWh 2030" fill="#60a5fa" radius={[0, 3, 3, 0]} />
            <Bar dataKey="TWh 2040" fill="#34d399" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Sensitivity Tornado Chart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Sensitivity Analysis — Parameter Range (Tornado)</h2>
        <p className="text-xs text-gray-400 mb-4">Low, central, and high case values per key demand parameter</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={tornadoData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 165, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="parameter"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={160}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="low" name="Low Case" fill="#f87171" radius={[0, 3, 3, 0]} />
            <Bar dataKey="central" name="Central Case" fill="#22d3ee" radius={[0, 3, 3, 0]} />
            <Bar dataKey="high" name="High Case" fill="#4ade80" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Sensitivity detail table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Parameter</th>
                <th className="text-left pb-2 pr-4">Unit</th>
                <th className="text-right pb-2 pr-4">Low</th>
                <th className="text-right pb-2 pr-4">Central</th>
                <th className="text-right pb-2 pr-4">High</th>
                <th className="text-right pb-2 pr-4">Peak Impact (MW)</th>
                <th className="text-right pb-2">Probability (%)</th>
              </tr>
            </thead>
            <tbody>
              {data.sensitivities.map((s: NDFSensitivityRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{s.parameter}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{s.unit}</td>
                  <td className="py-2 pr-4 text-right text-red-300 font-mono">{s.low_case_aud}</td>
                  <td className="py-2 pr-4 text-right text-cyan-300 font-mono">{s.central_case_aud}</td>
                  <td className="py-2 pr-4 text-right text-green-300 font-mono">{s.high_case_aud}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${s.impact_on_peak_mw >= 0 ? 'text-yellow-300' : 'text-purple-300'}`}>
                    {s.impact_on_peak_mw >= 0 ? '+' : ''}{s.impact_on_peak_mw.toFixed(0)}
                  </td>
                  <td className="py-2 text-right text-gray-300 font-mono">{s.probability_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Growth Drivers Detail Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Growth Driver Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Driver</th>
                <th className="text-left pb-2 pr-4">Category</th>
                <th className="text-left pb-2 pr-4">Region</th>
                <th className="text-right pb-2 pr-4">2030 (TWh)</th>
                <th className="text-right pb-2 pr-4">2040 (TWh)</th>
                <th className="text-left pb-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.growth_drivers.map((d: NDFGrowthDriverRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{d.driver}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: CATEGORY_COLOURS[d.category] ? `${CATEGORY_COLOURS[d.category]}33` : undefined, color: CATEGORY_COLOURS[d.category] ?? '#9ca3af' }}
                    >
                      {d.category}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{d.region}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${d.contribution_twh_2030 >= 0 ? 'text-cyan-300' : 'text-red-300'}`}>
                    {d.contribution_twh_2030 >= 0 ? '+' : ''}{d.contribution_twh_2030}
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono ${d.contribution_twh_2040 >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {d.contribution_twh_2040 >= 0 ? '+' : ''}{d.contribution_twh_2040}
                  </td>
                  <td className="py-2">
                    <Badge label={d.confidence} colourClass={CONFIDENCE_COLOURS[d.confidence] ?? 'bg-gray-600'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Reliability Outlook Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Reliability Outlook — Reserve Margin & USE</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Reserve margin, Unserved Energy (USE), and Loss of Energy Expectation (LoEE) by region and year.
          Rows highlighted in red indicate regions at risk of breaching the reliability standard.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Region</th>
                <th className="text-right pb-2 pr-4">Year</th>
                <th className="text-right pb-2 pr-4">Reserve Margin (%)</th>
                <th className="text-right pb-2 pr-4">USE (MWh)</th>
                <th className="text-right pb-2 pr-4">LoEE (hrs)</th>
                <th className="text-left pb-2 pr-4">Reliability Standard</th>
                <th className="text-left pb-2">Risk Status</th>
              </tr>
            </thead>
            <tbody>
              {data.reliability_outlook.map((r: NDFReliabilityOutlookRecord, i: number) => (
                <tr
                  key={i}
                  className={`border-b border-gray-700/50 ${r.at_risk ? 'bg-red-950/40 hover:bg-red-900/40' : 'hover:bg-gray-700/30'}`}
                >
                  <td className={`py-2 pr-4 font-medium ${r.at_risk ? 'text-red-300' : 'text-white'}`}>{r.region}</td>
                  <td className="py-2 pr-4 text-right text-gray-300 font-mono">{r.year}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${r.reserve_margin_pct < 10 ? 'text-red-400' : r.reserve_margin_pct < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {r.reserve_margin_pct.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono ${r.USE_mwh > 10 ? 'text-red-300' : 'text-gray-300'}`}>
                    {r.USE_mwh.toFixed(2)}
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono ${r.loee_hours > 1 ? 'text-red-300' : 'text-gray-300'}`}>
                    {r.loee_hours.toFixed(3)}
                  </td>
                  <td className="py-2 pr-4">
                    {r.reliability_standard_met
                      ? <Badge label="MET" colourClass="bg-green-700" />
                      : <Badge label="BREACH" colourClass="bg-red-700" />
                    }
                  </td>
                  <td className="py-2">
                    {r.at_risk
                      ? <span className="flex items-center gap-1 text-red-400 text-xs font-semibold"><AlertTriangle className="w-3 h-3" />AT RISK</span>
                      : <span className="text-green-400 text-xs">Adequate</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
