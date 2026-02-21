import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Building2, AlertCircle, Loader2 } from 'lucide-react'
import {
  getBehindMeterCommercialDashboard,
  BTMCDashboard,
  BTMCCostSavingRecord,
  BTMCBEMSRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (n: number, dp = 0) =>
  n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

const fmtM = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n}`

const STATUS_COLORS: Record<string, string> = {
  Completed: 'bg-green-700 text-green-200',
  'In Progress': 'bg-blue-700 text-blue-200',
  Planned: 'bg-yellow-700 text-yellow-200',
  'Under Review': 'bg-purple-700 text-purple-200',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BehindMeterCommercialAnalytics() {
  const [data, setData] = useState<BTMCDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBehindMeterCommercialDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-900">
        <Loader2 className="animate-spin text-blue-400" size={40} />
        <span className="ml-3 text-gray-300 text-lg">Loading commercial analytics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-900">
        <AlertCircle className="text-red-400" size={36} />
        <span className="ml-3 text-red-300 text-base">{error ?? 'Unknown error'}</span>
      </div>
    )
  }

  const { sites, load_profiles, cost_savings, demand_tariffs, bems_deployments, benchmarks, summary } = data

  // ---- KPI cards ----
  const kpis = [
    {
      label: 'Total Sites',
      value: fmt(summary.total_sites ?? sites.length),
      sub: 'commercial premises',
      color: 'text-blue-400',
    },
    {
      label: 'Annual Savings',
      value: fmtM(summary.total_annual_savings_aud ?? 0),
      sub: 'combined energy savings',
      color: 'text-green-400',
    },
    {
      label: 'Avg Solar Penetration',
      value: `${fmt(summary.avg_solar_penetration_pct ?? 0, 1)}%`,
      sub: 'generation share',
      color: 'text-yellow-400',
    },
    {
      label: 'Total CO₂ Savings',
      value: `${fmt(summary.total_co2_savings_tpa ?? 0)} t`,
      sub: 'tonnes CO₂-e/yr',
      color: 'text-teal-400',
    },
  ]

  // ---- Benchmark chart: energy intensity by sector ----
  const sectorGroups: Record<string, { sector: string; best_practice?: number; median?: number; poor_performer?: number }> = {}
  benchmarks.forEach((b) => {
    if (b.metric_name.includes('Energy Intensity')) {
      if (!sectorGroups[b.industry_sector]) sectorGroups[b.industry_sector] = { sector: b.industry_sector }
      sectorGroups[b.industry_sector].best_practice = b.best_practice
      sectorGroups[b.industry_sector].median = b.median
      sectorGroups[b.industry_sector].poor_performer = b.poor_performer
    }
  })
  const benchmarkChartData = Object.values(sectorGroups)

  // ---- Load profile chart: hourly weekday vs weekend ----
  const loadByHour: Record<number, { hour: number; Weekday: number; Weekend: number; count_wd: number; count_we: number }> = {}
  load_profiles.forEach((lp) => {
    if (!loadByHour[lp.hour]) {
      loadByHour[lp.hour] = { hour: lp.hour, Weekday: 0, Weekend: 0, count_wd: 0, count_we: 0 }
    }
    if (lp.day_type === 'Weekday') {
      loadByHour[lp.hour].Weekday += lp.avg_demand_kw
      loadByHour[lp.hour].count_wd += 1
    } else {
      loadByHour[lp.hour].Weekend += lp.avg_demand_kw
      loadByHour[lp.hour].count_we += 1
    }
  })
  const loadChartData = Array.from({ length: 24 }, (_, h) => {
    const row = loadByHour[h]
    if (!row) return { hour: `${h}:00`, Weekday: 0, Weekend: 0 }
    return {
      hour: `${h}:00`,
      Weekday: row.count_wd > 0 ? Math.round(row.Weekday / row.count_wd) : 0,
      Weekend: row.count_we > 0 ? Math.round(row.Weekend / row.count_we) : 0,
    }
  })

  // ---- Cost savings by measure ----
  const measureTotals: Record<string, number> = {}
  cost_savings.forEach((cs) => {
    measureTotals[cs.measure] = (measureTotals[cs.measure] ?? 0) + cs.annual_saving_aud
  })
  const costByMeasure = Object.entries(measureTotals).map(([measure, total]) => ({
    measure,
    savings: Math.round(total / 1000),
  }))

  // ---- Solar by sector ----
  const solarBySector: Record<string, number> = {}
  sites.forEach((s) => {
    solarBySector[s.industry_sector] = (solarBySector[s.industry_sector] ?? 0) + s.solar_capacity_kw
  })
  const solarChartData = Object.entries(solarBySector).map(([sector, kw]) => ({ sector, solar_kw: Math.round(kw) }))

  // ---- Top 10 cost saving opportunities ----
  const topSavings: BTMCCostSavingRecord[] = [...cost_savings]
    .sort((a, b) => b.annual_saving_aud - a.annual_saving_aud)
    .slice(0, 10)

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="text-blue-400" size={32} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Behind-the-Meter Commercial Energy Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Commercial building energy performance, BEMS deployments, tariff optimisation and cost savings
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Benchmark Chart + Load Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Energy Intensity Benchmark */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Energy Intensity Benchmark by Sector (kWh/m²/yr)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={benchmarkChartData} margin={{ top: 4, right: 16, bottom: 40, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9CA3AF', fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar dataKey="best_practice" name="Best Practice" fill="#22C55E" radius={[2, 2, 0, 0]} />
              <Bar dataKey="median" name="Median" fill="#EAB308" radius={[2, 2, 0, 0]} />
              <Bar dataKey="poor_performer" name="Poor Performer" fill="#EF4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Load Profile */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Hourly Demand Profile — Weekday vs Weekend (avg kW)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={loadChartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Line type="monotone" dataKey="Weekday" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Weekend" stroke="#F97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Cost Savings by Measure + Solar by Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Cost savings by measure */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Annual Cost Savings by Measure ($K)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={costByMeasure} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis type="category" dataKey="measure" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
                formatter={(v: number) => [`$${v}K`, 'Annual Saving']}
              />
              <Bar dataKey="savings" name="Annual Saving ($K)" fill="#34D399" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Solar capacity by sector */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Solar PV Capacity by Industry Sector (kW)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={solarChartData} margin={{ top: 4, right: 16, bottom: 40, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9CA3AF', fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
                formatter={(v: number) => [`${v} kW`, 'Solar Capacity']}
              />
              <Bar dataKey="solar_kw" name="Solar Capacity (kW)" fill="#FBBF24" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Top 10 cost saving opportunities table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">
          Top 10 Cost Saving Opportunities
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Measure</th>
                <th className="py-2 pr-3 text-right">Annual Saving</th>
                <th className="py-2 pr-3 text-right">Capex</th>
                <th className="py-2 pr-3 text-right">Payback</th>
                <th className="py-2 pr-3 text-right">IRR %</th>
                <th className="py-2 pr-3 text-right">CO₂ (tpa)</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {topSavings.map((cs: BTMCCostSavingRecord) => {
                const site = sites.find((s) => s.site_id === cs.site_id)
                return (
                  <tr key={cs.saving_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                    <td className="py-2 pr-3 text-gray-300 text-xs max-w-[120px] truncate">
                      {site?.site_name ?? cs.site_id}
                    </td>
                    <td className="py-2 pr-3 text-gray-200">{cs.measure}</td>
                    <td className="py-2 pr-3 text-right text-green-400 font-medium">
                      {fmtM(cs.annual_saving_aud)}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300">{fmtM(cs.capex_aud)}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{cs.payback_years} yr</td>
                    <td className="py-2 pr-3 text-right text-blue-400">{cs.irr_pct}%</td>
                    <td className="py-2 pr-3 text-right text-teal-400">{fmt(cs.co2_saving_tpa, 0)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[cs.implementation_status] ?? 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {cs.implementation_status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: BEMS table */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">
          BEMS Deployments — Vendor &amp; Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Protocol</th>
                <th className="py-2 pr-3 text-right">Data Points</th>
                <th className="py-2 pr-3 text-right">Faults YTD</th>
                <th className="py-2 pr-3 text-right">Energy Saving</th>
                <th className="py-2 text-right">Payback</th>
              </tr>
            </thead>
            <tbody>
              {bems_deployments.map((b: BTMCBEMSRecord) => {
                const site = sites.find((s) => s.site_id === b.site_id)
                return (
                  <tr key={b.bems_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                    <td className="py-2 pr-3 text-gray-300 text-xs max-w-[130px] truncate">
                      {site?.site_name ?? b.site_id}
                    </td>
                    <td className="py-2 pr-3 text-gray-200 text-xs">{b.vendor}</td>
                    <td className="py-2 pr-3 text-gray-400 text-xs">{b.integration_protocol}</td>
                    <td className="py-2 pr-3 text-right text-gray-300">{fmt(b.data_points_count)}</td>
                    <td className="py-2 pr-3 text-right text-yellow-400">{b.fault_detections_ytd}</td>
                    <td className="py-2 pr-3 text-right text-green-400 font-medium">{b.energy_saving_pct}%</td>
                    <td className="py-2 text-right text-gray-300">{b.payback_years} yr</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 5: Demand tariffs summary */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">
          Demand Tariff Comparison — Network &amp; Structure
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-3">Network</th>
                <th className="py-2 pr-3">Structure</th>
                <th className="py-2 pr-3 text-right">Peak Rate</th>
                <th className="py-2 pr-3 text-right">Off-Peak Rate</th>
                <th className="py-2 pr-3 text-right">Demand Chg</th>
                <th className="py-2 pr-3 text-right">Annual Bill</th>
                <th className="py-2 text-right">vs Flat</th>
              </tr>
            </thead>
            <tbody>
              {demand_tariffs.map((dt) => (
                <tr key={dt.tariff_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-3 text-gray-300">{dt.network_name}</td>
                  <td className="py-2 pr-3 text-blue-400">{dt.tariff_structure}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">${dt.peak_rate_dollar_per_kwh.toFixed(2)}/kWh</td>
                  <td className="py-2 pr-3 text-right text-gray-300">${dt.offpeak_rate_dollar_per_kwh.toFixed(2)}/kWh</td>
                  <td className="py-2 pr-3 text-right text-gray-300">
                    {dt.demand_charge_dollar_per_kw > 0 ? `$${dt.demand_charge_dollar_per_kw}/kW` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-200">{fmtM(dt.annual_bill_aud)}</td>
                  <td className={`py-2 text-right font-medium ${dt.bill_saving_vs_flat_pct < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {dt.bill_saving_vs_flat_pct > 0 ? '+' : ''}{dt.bill_saving_vs_flat_pct.toFixed(1)}%
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
