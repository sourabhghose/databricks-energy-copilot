import React, { useEffect, useState } from 'react'
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
import { Award } from 'lucide-react'
import {
  getRenewableEnergyCertificateDashboard,
  RECADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const TECH_COLOURS: Record<string, string> = {
  'Wind':        '#3b82f6',
  'Large Solar': '#f59e0b',
  'Hydro':       '#06b6d4',
  'Bioenergy':   '#10b981',
  'Wave/Tidal':  '#0ea5e9',
  'Geothermal':  '#ef4444',
  'Other':       '#8b5cf6',
}

const REGION_COLOURS: Record<string, string> = {
  'NSW': '#3b82f6',
  'QLD': '#f59e0b',
  'VIC': '#8b5cf6',
  'SA':  '#10b981',
  'WA':  '#f97316',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'BAU':            '#94a3b8',
  'Accelerated RE': '#10b981',
  '33 GW Target':   '#3b82f6',
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function kpiCard(title: string, value: string, sub: string, Icon: React.ElementType) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
        <Icon size={16} />
        {title}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RenewableEnergyCertificateAnalytics() {
  const [data, setData] = useState<RECADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRenewableEnergyCertificateDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-500 dark:text-red-400">
        Failed to load Renewable Energy Certificate data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-500 dark:text-gray-400 animate-pulse">
        Loading Renewable Energy Certificate Market Analytics...
      </div>
    )
  }

  const { lgc_market, stc_market, accreditation, compliance, projections, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: LGC spot price vs forward price by quarter
  // -------------------------------------------------------------------------
  const lgcPriceChart = lgc_market.map(r => ({
    quarter: r.quarter,
    spot: r.lgc_spot_price,
    forward: r.lgc_forward_price,
  }))

  // -------------------------------------------------------------------------
  // Chart 2: STC installs by segment (rooftop solar, HWT, other) by quarter
  // -------------------------------------------------------------------------
  const stcInstallChart = stc_market.map(r => ({
    quarter: r.quarter,
    rooftop_solar: r.rooftop_solar_installs_k,
    hwt: r.solar_hwt_installs_k,
    other: r.other_installs_k,
  }))

  // -------------------------------------------------------------------------
  // Chart 3: Accredited capacity by technology, coloured by region
  // Aggregate: sum accredited_capacity_mw per technology per region
  // -------------------------------------------------------------------------
  const accredByTech: Record<string, Record<string, number>> = {}
  for (const rec of accreditation) {
    if (!accredByTech[rec.technology]) accredByTech[rec.technology] = {}
    accredByTech[rec.technology][rec.region] =
      (accredByTech[rec.technology][rec.region] ?? 0) + rec.accredited_capacity_mw
  }
  const accredChart = Object.entries(accredByTech).map(([tech, regionMap]) => ({
    technology: tech,
    ...regionMap,
  }))
  const allRegions = ['NSW', 'QLD', 'VIC', 'SA', 'WA']

  // -------------------------------------------------------------------------
  // Chart 4: Compliance % by liable entity — last 3 years (2022–2024)
  // -------------------------------------------------------------------------
  const lastThreeYears = [2022, 2023, 2024]
  const complianceFiltered = compliance.filter(c => lastThreeYears.includes(c.year))
  const complianceByEntity: Record<string, Record<number, number>> = {}
  for (const rec of complianceFiltered) {
    if (!complianceByEntity[rec.liable_entity]) complianceByEntity[rec.liable_entity] = {}
    complianceByEntity[rec.liable_entity][rec.year] = rec.compliance_pct
  }
  const complianceChart = Object.entries(complianceByEntity).map(([entity, yearMap]) => ({
    entity,
    ...Object.fromEntries(Object.entries(yearMap).map(([yr, val]) => [yr, val])),
  }))
  const yearColors: Record<number, string> = { 2022: '#94a3b8', 2023: '#3b82f6', 2024: '#10b981' }

  // -------------------------------------------------------------------------
  // Chart 5: LGC price forecast by year for 3 scenarios
  // -------------------------------------------------------------------------
  const projByYear: Record<number, Record<string, number>> = {}
  for (const rec of projections) {
    if (!projByYear[rec.year]) projByYear[rec.year] = {}
    projByYear[rec.year][rec.scenario] = rec.lgc_price_forecast
  }
  const projChart = Object.entries(projByYear)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([yr, scenarioMap]) => ({
      year: yr,
      ...scenarioMap,
    }))
  const scenarios = ['BAU', 'Accelerated RE', '33 GW Target']

  return (
    <div className="p-6 space-y-8 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Award className="text-amber-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Renewable Energy Certificate Market Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            LGC market · STC market · Accreditation · Compliance · RET projections
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCard(
          'Total LGC Created',
          `${(summary.total_lgc_created_m as number).toFixed(1)} M`,
          'All quarters 2020–2024',
          Award,
        )}
        {kpiCard(
          'Current LGC Price',
          `$${(summary.current_lgc_price as number).toFixed(2)}/MWh`,
          'Latest quarter spot price',
          Award,
        )}
        {kpiCard(
          'Current STC Price',
          `$${(summary.current_stc_price as number).toFixed(2)}`,
          'Latest quarter regulated price',
          Award,
        )}
        {kpiCard(
          'Accredited Capacity',
          `${(summary.accredited_capacity_gw as number).toFixed(1)} GW`,
          `RET on track: ${summary.ret_target_on_track ? 'Yes' : 'No'}`,
          Award,
        )}
      </div>

      {/* Chart 1: LGC Spot vs Forward Price */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          LGC Spot vs Forward Price by Quarter (2020–2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lgcPriceChart} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-45}
              textAnchor="end"
              interval={1}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" $" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />
            <Line
              type="monotone"
              dataKey="spot"
              name="Spot Price ($/MWh)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="forward"
              name="Forward Price ($/MWh)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: STC installs by segment */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          STC Installations by Segment per Quarter (000s)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stcInstallChart} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="quarter"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-45}
              textAnchor="end"
              interval={1}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />
            <Bar dataKey="rooftop_solar" name="Rooftop Solar" stackId="a" fill="#f59e0b" />
            <Bar dataKey="hwt" name="Solar HWT" stackId="a" fill="#06b6d4" />
            <Bar dataKey="other" name="Other" stackId="a" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Accredited capacity by technology coloured by region */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Accredited Capacity by Technology and Region (MW)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={accredChart} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="technology" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />
            {allRegions.map(region => (
              <Bar
                key={region}
                dataKey={region}
                name={region}
                stackId="tech"
                fill={REGION_COLOURS[region]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Compliance % by entity — last 3 years */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Liable Entity Compliance % — Last 3 Years (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={complianceChart} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="entity" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={[80, 105]} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />
            {lastThreeYears.map(yr => (
              <Bar
                key={yr}
                dataKey={String(yr)}
                name={String(yr)}
                fill={yearColors[yr]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: LGC Price Forecast by scenario */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          LGC Price Forecast by Scenario (2025–2035)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={projChart} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" $" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />
            {scenarios.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                name={sc}
                stroke={SCENARIO_COLOURS[sc]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Market Summary
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeof value === 'boolean'
                  ? value ? 'Yes' : 'No'
                  : typeof value === 'number'
                  ? value.toFixed(2)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
