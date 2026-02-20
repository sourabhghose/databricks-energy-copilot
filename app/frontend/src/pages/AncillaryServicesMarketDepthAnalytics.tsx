import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  getAncillaryMarketDepthDashboard,
  AMDDashboard,
  AMDMarketShareRecord,
  AMDHerfindahlRecord,
  AMDPriceFormationRecord,
  AMDNewEntrantRecord,
  AMDBatteryShareRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const KPI_CARD_BG = 'bg-gray-800 border border-gray-700 rounded-lg p-4'

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={KPI_CARD_BG}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

const COMPANY_COLORS: Record<string, string> = {
  'AGL Energy':    '#3B82F6',
  'Origin Energy': '#10B981',
  'Neoen BESS':    '#F59E0B',
  'Hornsdale PSP': '#8B5CF6',
  'Snowy Hydro':   '#EF4444',
}

const SERVICE_COLORS: string[] = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#F97316', '#EC4899',
]

// ---------------------------------------------------------------------------
// Section 1: Market Share by Service — Stacked Bar per service (region filter)
// ---------------------------------------------------------------------------
function MarketShareSection({ records }: { records: AMDMarketShareRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('NSW')
  const regions = [...new Set(records.map((r) => r.region))].sort()
  const companies = [...new Set(records.map((r) => r.company))]

  // Group by service for selected region
  const services = [...new Set(records.map((r) => r.service))]
  const chartData = services.map((svc) => {
    const row: Record<string, number | string> = { service: svc.replace(/_/g, ' ') }
    for (const co of companies) {
      const rec = records.find((r) => r.service === svc && r.region === selectedRegion && r.company === co)
      row[co] = rec ? parseFloat(rec.market_share_pct.toFixed(1)) : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="FCAS Market Share by Service — Provider Breakdown" />
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="service"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${v.toFixed(1)}%`]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
          {companies.map((co) => (
            <Bar
              key={co}
              dataKey={co}
              stackId="a"
              fill={COMPANY_COLORS[co] ?? '#6B7280'}
              radius={companies.indexOf(co) === companies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs mt-2">
        Market share percentage by provider for each FCAS service type — {selectedRegion} region, Q4 2024
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 2: HHI Concentration — Bar chart with 2500 threshold reference line
// ---------------------------------------------------------------------------
const STRUCTURE_COLOR: Record<string, string> = {
  HIGHLY_CONCENTRATED:     '#EF4444',
  MODERATELY_CONCENTRATED: '#F59E0B',
  COMPETITIVE:             '#10B981',
}

function HHIConcentrationSection({ records }: { records: AMDHerfindahlRecord[] }) {
  const [selectedQuarter, setSelectedQuarter] = useState('2024-Q4')
  const quarters = [...new Set(records.map((r) => r.quarter))].sort()

  const chartData = records
    .filter((r) => r.quarter === selectedQuarter)
    .sort((a, b) => b.hhi_score - a.hhi_score)
    .map((r) => ({
      service: r.service.replace(/_/g, ' '),
      hhi: parseFloat(r.hhi_score.toFixed(0)),
      cr3: parseFloat(r.cr3_pct.toFixed(1)),
      providers: r.number_of_providers,
      structure: r.market_structure,
      fill: STRUCTURE_COLOR[r.market_structure] ?? '#6B7280',
    }))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="HHI Market Concentration by Service (NEM-wide)" />
        <select
          value={selectedQuarter}
          onChange={(e) => setSelectedQuarter(e.target.value)}
          className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
        >
          {quarters.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mb-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-red-500" />
          <span className="text-gray-400">Highly Concentrated (&gt;2500)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-amber-500" />
          <span className="text-gray-400">Moderately Concentrated (1500–2500)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-emerald-500" />
          <span className="text-gray-400">Competitive (&lt;1500)</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="service"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} domain={[0, 5000]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number, name: string) => {
              if (name === 'HHI Score') return [v.toFixed(0), 'HHI Score']
              return [v, name]
            }}
          />
          <ReferenceLine
            y={2500}
            stroke="#EF4444"
            strokeDasharray="6 3"
            label={{ value: 'HHI 2500 (Highly Concentrated threshold)', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
          />
          <ReferenceLine
            y={1500}
            stroke="#F59E0B"
            strokeDasharray="6 3"
            label={{ value: 'HHI 1500', fill: '#F59E0B', fontSize: 10, position: 'insideTopRight' }}
          />
          <Bar dataKey="hhi" name="HHI Score" radius={[4, 4, 0, 0]}
            fill="#3B82F6"
            // per-bar fill via cell pattern — recharts uses fill from data via Cell
          >
            {chartData.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-4">Service</th>
              <th className="text-right py-2 pr-4">HHI Score</th>
              <th className="text-right py-2 pr-4">CR3 %</th>
              <th className="text-right py-2 pr-4">Providers</th>
              <th className="text-left py-2">Structure</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((r) => (
              <tr key={r.service} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{r.service}</td>
                <td className={`py-2 pr-4 text-right font-bold ${r.hhi > 2500 ? 'text-red-400' : r.hhi > 1500 ? 'text-amber-400' : 'text-green-400'}`}>
                  {r.hhi.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">{r.cr3}%</td>
                <td className="py-2 pr-4 text-right text-gray-400">{r.providers}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.structure === 'HIGHLY_CONCENTRATED' ? 'bg-red-900 text-red-300' : r.structure === 'MODERATELY_CONCENTRATED' ? 'bg-amber-900 text-amber-300' : 'bg-green-900 text-green-300'}`}>
                    {r.structure.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 3: Price Formation — LineChart avg price by service over months
// ---------------------------------------------------------------------------
function PriceFormationSection({ records }: { records: AMDPriceFormationRecord[] }) {
  const [selectedService, setSelectedService] = useState('RAISE_6SEC')
  const services = [...new Set(records.map((r) => r.service))].sort()

  // All services on one chart OR single service deep-dive
  const months = [...new Set(records.map((r) => r.month))].sort()

  // Multi-service avg price chart
  const multiChartData = months.map((m) => {
    const row: Record<string, number | string> = { month: m.slice(5) }
    for (const svc of services) {
      const rec = records.find((r) => r.month === m && r.service === svc)
      row[svc.replace(/_/g, ' ')] = rec ? parseFloat(rec.avg_price.toFixed(2)) : 0
    }
    return row
  })

  // Single service stats chart
  const singleData = records
    .filter((r) => r.service === selectedService)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({
      month: r.month.slice(5),
      'Avg Price': r.avg_price,
      'Median Price': r.median_price,
      'P95 Price': r.p95_price,
    }))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="FCAS Price Formation — Monthly Trends 2024 ($/MW/h)" />

      {/* Multi-service overview */}
      <p className="text-gray-400 text-xs mb-3">Average price across all services (Jan–Jun 2024)</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={multiChartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="$" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 10 }} />
          {services.map((svc, i) => (
            <Line
              key={svc}
              type="monotone"
              dataKey={svc.replace(/_/g, ' ')}
              stroke={SERVICE_COLORS[i % SERVICE_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Single service deep-dive */}
      <div className="mt-6">
        <div className="flex items-center gap-4 mb-3">
          <p className="text-gray-400 text-xs">Price distribution for single service:</p>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="bg-gray-700 text-gray-200 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {services.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={singleData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="$" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
              formatter={(v: number) => [`$${v.toFixed(2)}`]}
            />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
            <Line type="monotone" dataKey="Avg Price"    stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Median Price" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="P95 Price"    stroke="#EF4444" strokeWidth={2} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price stats table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-3">Month</th>
              <th className="text-right py-2 pr-3">Avg $</th>
              <th className="text-right py-2 pr-3">Median $</th>
              <th className="text-right py-2 pr-3">P95 $</th>
              <th className="text-right py-2 pr-3">Zero Price %</th>
              <th className="text-right py-2 pr-3">VoLL Price %</th>
              <th className="text-right py-2 pr-3">Volume MW</th>
              <th className="text-right py-2">Surplus MW</th>
            </tr>
          </thead>
          <tbody>
            {records
              .filter((r) => r.service === selectedService)
              .sort((a, b) => a.month.localeCompare(b.month))
              .map((r) => (
                <tr key={r.month} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-3 text-gray-300 font-mono text-xs">{r.month}</td>
                  <td className="py-2 pr-3 text-right text-blue-400 font-mono">${r.avg_price.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-green-400 font-mono">${r.median_price.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-red-400 font-mono">${r.p95_price.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.zero_price_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right text-amber-400">{r.voll_price_pct.toFixed(2)}%</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.avg_volume_mw.toFixed(0)}</td>
                  <td className="py-2 text-right text-gray-400">{r.clearing_surplus_mw.toFixed(0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 4: New Entrant Impact — table
// ---------------------------------------------------------------------------
const IMPACT_STYLE: Record<string, string> = {
  HIGH:   'bg-green-900 text-green-300 border border-green-700',
  MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
  LOW:    'bg-blue-900 text-blue-300 border border-blue-700',
}

function NewEntrantSection({ records }: { records: AMDNewEntrantRecord[] }) {
  const sorted = [...records].sort((a, b) => Math.abs(b.price_change_est_pct) - Math.abs(a.price_change_est_pct))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Battery New Entrant Market Impact — FCAS Entry Analysis" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-4">Project / Technology</th>
              <th className="text-right py-2 pr-4">Entry Year</th>
              <th className="text-right py-2 pr-4">Capacity MW</th>
              <th className="text-left py-2 pr-4">Service Capability</th>
              <th className="text-center py-2 pr-4">Market Impact</th>
              <th className="text-right py-2">Est. Price Change</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.technology} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-3 pr-4 text-white font-medium text-sm">{r.technology}</td>
                <td className="py-3 pr-4 text-right text-gray-400">{r.entry_year}</td>
                <td className="py-3 pr-4 text-right text-blue-400 font-semibold">
                  {r.capacity_mw.toFixed(0)}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {r.service_capability.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs font-mono">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${IMPACT_STYLE[r.market_impact] ?? 'bg-gray-700 text-gray-300'}`}>
                    {r.market_impact}
                  </span>
                </td>
                <td className={`py-3 text-right font-bold font-mono ${r.price_change_est_pct < 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.price_change_est_pct > 0 ? '+' : ''}{r.price_change_est_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-500 text-xs mt-3">
        Estimated price reduction from new BESS entry into FCAS markets. Negative values indicate price reduction benefit for consumers.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Battery Market Share Growth — LineChart by region/quarter
// ---------------------------------------------------------------------------
const REGION_COLORS: Record<string, string> = {
  NSW: '#3B82F6',
  VIC: '#10B981',
  QLD: '#F59E0B',
  SA:  '#8B5CF6',
  TAS: '#EF4444',
}

function BatteryShareGrowthSection({ records }: { records: AMDBatteryShareRecord[] }) {
  const [metric, setMetric] = useState<'raise_6sec' | 'raise_60sec' | 'contingency' | 'lower'>('raise_6sec')
  const METRIC_LABELS: Record<string, string> = {
    raise_6sec:   'Raise 6-Second',
    raise_60sec:  'Raise 60-Second',
    contingency:  'Contingency',
    lower:        'Lower Services',
  }
  const METRIC_FIELDS: Record<string, keyof AMDBatteryShareRecord> = {
    raise_6sec:  'battery_share_raise_6sec_pct',
    raise_60sec: 'battery_share_raise_60sec_pct',
    contingency: 'battery_share_contingency_pct',
    lower:       'battery_share_lower_pct',
  }

  const regions = [...new Set(records.map((r) => r.region))].sort()
  const quarters = [...new Set(records.map((r) => r.quarter))].sort()

  const chartData = quarters.map((q) => {
    const row: Record<string, number | string> = { quarter: q }
    for (const region of regions) {
      const rec = records.find((r) => r.quarter === q && r.region === region)
      const field = METRIC_FIELDS[metric]
      row[region] = rec ? parseFloat((rec[field] as number).toFixed(1)) : 0
    }
    return row
  })

  // Revenue chart per region (quarterly)
  const revenueData = quarters.map((q) => {
    const row: Record<string, number | string> = { quarter: q }
    for (const region of regions) {
      const rec = records.find((r) => r.quarter === q && r.region === region)
      row[region] = rec ? parseFloat(rec.total_battery_fcas_revenue_m.toFixed(2)) : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
      <SectionHeader title="Battery Storage FCAS Market Share Growth by Region (2024)" />

      <div className="flex items-center gap-4 mb-4">
        <p className="text-gray-400 text-xs">Service type:</p>
        {Object.keys(METRIC_LABELS).map((key) => (
          <button
            key={key}
            onClick={() => setMetric(key as typeof metric)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${metric === key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {METRIC_LABELS[key]}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(v: number) => [`${v.toFixed(1)}%`]}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          {regions.map((region) => (
            <Line
              key={region}
              type="monotone"
              dataKey={region}
              stroke={REGION_COLORS[region] ?? '#6B7280'}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Battery FCAS Revenue */}
      <div className="mt-6">
        <p className="text-gray-400 text-xs mb-3">Total Battery FCAS Revenue by Region ($M / quarter)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={revenueData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`]}
            />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
            {regions.map((region) => (
              <Bar key={region} dataKey={region} stackId="a" fill={REGION_COLORS[region] ?? '#6B7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left py-2 pr-4">Region</th>
              <th className="text-left py-2 pr-4">Quarter</th>
              <th className="text-right py-2 pr-4">Raise 6s %</th>
              <th className="text-right py-2 pr-4">Raise 60s %</th>
              <th className="text-right py-2 pr-4">Contingency %</th>
              <th className="text-right py-2 pr-4">Lower %</th>
              <th className="text-right py-2 pr-4">Revenue $M</th>
              <th className="text-right py-2">FCAS Capacity MW</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 font-semibold" style={{ color: REGION_COLORS[r.region] ?? '#fff' }}>
                  {r.region}
                </td>
                <td className="py-2 pr-4 text-gray-400 text-xs font-mono">{r.quarter}</td>
                <td className="py-2 pr-4 text-right text-blue-400">{r.battery_share_raise_6sec_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-green-400">{r.battery_share_raise_60sec_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-amber-400">{r.battery_share_contingency_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-purple-400">{r.battery_share_lower_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right text-gray-300">${r.total_battery_fcas_revenue_m.toFixed(2)}M</td>
                <td className="py-2 text-right text-gray-400">{r.battery_capacity_fcas_mw.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function AncillaryServicesMarketDepthAnalytics() {
  const [data, setData] = useState<AMDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAncillaryMarketDepthDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-lg">
        Loading NEM Ancillary Services Market Depth data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-lg">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const s = data.summary as Record<string, unknown>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          NEM Ancillary Services Market Depth Analytics
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          FCAS market concentration, provider diversity, price formation and market power analysis
          across all eight ancillary service types — National Electricity Market 2024
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KpiCard
          label="Most Concentrated Service"
          value={String(s['most_concentrated_service']).replace(/_/g, ' ')}
          sub="Highest HHI score"
        />
        <KpiCard
          label="Avg HHI (Raise Services)"
          value={String(s['avg_hhi_raise'])}
          sub="Highly concentrated >2500"
        />
        <KpiCard
          label="Battery Share RAISE 6s"
          value={`${s['battery_share_raise_6sec_pct']}%`}
          sub="BESS dominance in fast FCAS"
        />
        <KpiCard
          label="Total FCAS Cost 2024"
          value={`$${s['total_fcas_cost_m']}M`}
          sub="All NEM ancillary services"
        />
        <KpiCard
          label="Active FCAS Providers"
          value={String(s['number_of_providers_all_services'])}
          sub="Across all service types"
        />
        <KpiCard
          label="Competitive Services"
          value={`${s['competitive_services_count']} / 8`}
          sub="HHI below 1500 threshold"
        />
      </div>

      {/* Section 1: Market Share by Service */}
      <MarketShareSection records={data.market_shares} />

      {/* Section 2: HHI Concentration */}
      <HHIConcentrationSection records={data.herfindahl} />

      {/* Section 3: Price Formation */}
      <PriceFormationSection records={data.price_formation} />

      {/* Section 4: New Entrant Impact */}
      <NewEntrantSection records={data.new_entrants} />

      {/* Section 5: Battery Market Share Growth */}
      <BatteryShareGrowthSection records={data.battery_share} />
    </div>
  )
}
