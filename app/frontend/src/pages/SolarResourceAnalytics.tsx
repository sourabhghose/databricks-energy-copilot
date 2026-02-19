import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SunMedium, MapPin, Zap, BarChart2 } from 'lucide-react'
import { api } from '../api/client'
import type {
  SolarResourceDashboard,
  IrradianceSiteRecord,
  SolarFarmYieldRecord,
  MonthlyIrradianceRecord,
  SolarDegradationRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function ResourceClassBadge({ cls }: { cls: string }) {
  const map: Record<string, string> = {
    EXCELLENT: 'bg-amber-900/60 text-amber-300 border border-amber-700',
    VERY_GOOD: 'bg-green-900/60 text-green-300 border border-green-700',
    GOOD: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    MODERATE: 'bg-gray-700 text-gray-300 border border-gray-600',
  }
  const label: Record<string, string> = {
    EXCELLENT: 'Excellent',
    VERY_GOOD: 'Very Good',
    GOOD: 'Good',
    MODERATE: 'Moderate',
  }
  const cn = map[cls] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cn}`}>
      {label[cls] ?? cls}
    </span>
  )
}

function TechnologyBadge({ tech }: { tech: string }) {
  const map: Record<string, string> = {
    FIXED_TILT: 'bg-gray-700 text-gray-300 border border-gray-600',
    SINGLE_AXIS_TRACKER: 'bg-amber-900/60 text-amber-300 border border-amber-700',
    DUAL_AXIS_TRACKER: 'bg-green-900/60 text-green-300 border border-green-700',
    BIFACIAL: 'bg-blue-900/60 text-blue-300 border border-blue-700',
  }
  const label: Record<string, string> = {
    FIXED_TILT: 'Fixed Tilt',
    SINGLE_AXIS_TRACKER: 'SAT',
    DUAL_AXIS_TRACKER: 'Dual Axis',
    BIFACIAL: 'Bifacial',
  }
  const cn = map[tech] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cn}`}>
      {label[tech] ?? tech}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart colour palette for sites and panel types
// ---------------------------------------------------------------------------

const SITE_COLORS: Record<string, string> = {
  'BH-NSW': '#f59e0b',
  'LR-QLD': '#ef4444',
  'CA-WA':  '#10b981',
  'AS-NT':  '#8b5cf6',
  'GE-WA':  '#06b6d4',
}

const PANEL_COLORS: Record<string, string> = {
  MONO_PERC:     '#f59e0b',
  POLY:          '#6b7280',
  BIFACIAL_MONO: '#10b981',
  HJT:           '#3b82f6',
  TOPCon:        '#a855f7',
}

// ---------------------------------------------------------------------------
// Monthly GHI chart data builder
// ---------------------------------------------------------------------------

function buildMonthlyGhiData(monthly: MonthlyIrradianceRecord[]) {
  const selectedSites = ['BH-NSW', 'LR-QLD', 'CA-WA', 'AS-NT', 'GE-WA']
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return months.map((monthName, idx) => {
    const monthNum = idx + 1
    const row: Record<string, string | number> = { month: monthName }
    for (const siteId of selectedSites) {
      const rec = monthly.find((r) => r.site_id === siteId && r.month === monthNum)
      if (rec) {
        row[siteId] = rec.ghi_kwh_m2_day
      }
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Degradation chart data builder
// ---------------------------------------------------------------------------

function buildDegradationData(degradation: SolarDegradationRecord[]) {
  const years = [0, 5, 10, 15, 20]
  return years.map((yr) => {
    const row: Record<string, string | number> = { year: `Year ${yr}` }
    const types = ['MONO_PERC', 'POLY', 'BIFACIAL_MONO', 'HJT', 'TOPCon']
    for (const pt of types) {
      const rec = degradation.find((r) => r.panel_type === pt && r.year === yr)
      if (rec) {
        row[pt] = rec.cumulative_degradation_pct
      }
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Site name map for chart legend
// ---------------------------------------------------------------------------

const SITE_NAMES: Record<string, string> = {
  'BH-NSW': 'Broken Hill',
  'LR-QLD': 'Longreach',
  'CA-WA':  'Carnarvon',
  'AS-NT':  'Alice Springs',
  'GE-WA':  'Geraldton',
}

const PANEL_LABELS: Record<string, string> = {
  MONO_PERC:     'Mono PERC',
  POLY:          'Polycrystalline',
  BIFACIAL_MONO: 'Bifacial Mono',
  HJT:           'HJT',
  TOPCon:        'TOPCon',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SolarResourceAnalytics() {
  const [data, setData] = useState<SolarResourceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getSolarResourceDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading solar resource data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const ghiChartData = buildMonthlyGhiData(data.monthly_irradiance)
  const degradationChartData = buildDegradationData(data.degradation_records)
  const selectedSiteIds = ['BH-NSW', 'LR-QLD', 'CA-WA', 'AS-NT', 'GE-WA']
  const panelTypes = ['MONO_PERC', 'POLY', 'BIFACIAL_MONO', 'HJT', 'TOPCon']

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">

      {/* Header */}
      <div className="flex items-center gap-3">
        <SunMedium className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Solar Irradiance &amp; Resource Assessment
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            GHI / DNI / DHI solar resource data, site suitability, panel performance degradation
            and solar farm energy yield analysis across Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={SunMedium}
          label="Best Solar Resource Site"
          value={data.best_solar_resource_site}
          sub="Highest annual GHI"
          color="text-amber-400"
        />
        <KpiCard
          icon={BarChart2}
          label="Avg Capacity Factor"
          value={`${data.avg_capacity_factor_pct.toFixed(1)}%`}
          sub="Across assessed solar farms"
          color="text-green-400"
        />
        <KpiCard
          icon={Zap}
          label="Total Assessed Capacity"
          value={`${data.total_assessed_capacity_mw.toFixed(0)} MW`}
          sub="Installed solar capacity"
          color="text-blue-400"
        />
        <KpiCard
          icon={MapPin}
          label="Avg Specific Yield"
          value={`${data.avg_specific_yield_kwh_kwp.toFixed(0)} kWh/kWp`}
          sub="Average energy per kWp installed"
          color="text-purple-400"
        />
      </div>

      {/* Monthly GHI by Site chart */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Monthly GHI by Site (kWh/m²/day) — Top 5 Resource Zones
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={ghiChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'GHI (kWh/m²/day)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
              domain={[2, 11]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {selectedSiteIds.map((siteId) => (
              <Line
                key={siteId}
                type="monotone"
                dataKey={siteId}
                name={SITE_NAMES[siteId]}
                stroke={SITE_COLORS[siteId]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Solar Farm Yields Table */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Solar Farm Energy Yields</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Farm</th>
                <th className="text-left py-2 pr-4 font-medium">State</th>
                <th className="text-left py-2 pr-4 font-medium">Technology</th>
                <th className="text-right py-2 pr-4 font-medium">Capacity (MW)</th>
                <th className="text-right py-2 pr-4 font-medium">Annual Yield (GWh)</th>
                <th className="text-right py-2 pr-4 font-medium">Specific Yield (kWh/kWp)</th>
                <th className="text-right py-2 pr-4 font-medium">CF %</th>
                <th className="text-right py-2 pr-4 font-medium">PR %</th>
                <th className="text-right py-2 pr-4 font-medium">P90 Yield (GWh)</th>
                <th className="text-right py-2 pr-4 font-medium">Yr1 Deg %</th>
                <th className="text-right py-2 font-medium">Annual Deg %</th>
              </tr>
            </thead>
            <tbody>
              {data.farm_yields.map((f: SolarFarmYieldRecord) => (
                <tr
                  key={f.farm_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-4 text-white font-medium">{f.farm_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{f.state}</td>
                  <td className="py-2 pr-4">
                    <TechnologyBadge tech={f.technology} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {f.installed_capacity_mw.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-green-400 font-medium">
                    {f.annual_yield_gwh.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-amber-400">
                    {f.specific_yield_kwh_kwp.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-400">
                    {f.capacity_factor_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {f.performance_ratio_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-400">
                    {f.p90_yield_gwh.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-orange-400">
                    {f.degradation_year1_pct.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-orange-300">
                    {f.degradation_annual_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Irradiance Sites Table */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">Solar Irradiance Resource Sites</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Site</th>
                <th className="text-left py-2 pr-4 font-medium">State</th>
                <th className="text-left py-2 pr-4 font-medium">Class</th>
                <th className="text-right py-2 pr-4 font-medium">GHI (kWh/m²/yr)</th>
                <th className="text-right py-2 pr-4 font-medium">DNI (kWh/m²/yr)</th>
                <th className="text-right py-2 pr-4 font-medium">DHI (kWh/m²/yr)</th>
                <th className="text-right py-2 pr-4 font-medium">Peak Sun Hrs</th>
                <th className="text-right py-2 pr-4 font-medium">Cloud Cover %</th>
                <th className="text-right py-2 pr-4 font-medium">Avg Temp (°C)</th>
                <th className="text-right py-2 font-medium">Soiling Loss %</th>
              </tr>
            </thead>
            <tbody>
              {data.irradiance_sites.map((s: IrradianceSiteRecord) => (
                <tr
                  key={s.site_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2 pr-4 text-white font-medium">{s.site_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{s.state}</td>
                  <td className="py-2 pr-4">
                    <ResourceClassBadge cls={s.resource_class} />
                  </td>
                  <td className="py-2 pr-4 text-right text-amber-400 font-medium">
                    {s.annual_ghi_kwh_m2.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-orange-400">
                    {s.annual_dni_kwh_m2.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-blue-400">
                    {s.annual_dhi_kwh_m2.toFixed(0)}
                  </td>
                  <td className="py-2 pr-4 text-right text-yellow-400">
                    {s.peak_sun_hours.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {s.cloud_cover_pct.toFixed(0)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {s.temperature_annual_avg_c.toFixed(1)}
                  </td>
                  <td className="py-2 text-right text-red-400">
                    {s.dust_soiling_loss_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel Degradation Chart */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-1">
          Cumulative Panel Degradation by Technology (%)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          HJT and TOPCon technologies show slower degradation rates compared to conventional POLY panels
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={degradationChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Cumulative Degradation (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {panelTypes.map((pt) => (
              <Line
                key={pt}
                type="monotone"
                dataKey={pt}
                name={PANEL_LABELS[pt]}
                stroke={PANEL_COLORS[pt]}
                strokeWidth={2}
                dot={{ r: 4, fill: PANEL_COLORS[pt] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
