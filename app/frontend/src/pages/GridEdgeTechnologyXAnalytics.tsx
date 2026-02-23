import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Cpu, TrendingUp, Network, Users } from 'lucide-react'
import {
  getGridEdgeTechnologyXDashboard,
  GETAXDashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  'Smart Meter':                   '#60a5fa',
  'HEMS':                          '#4ade80',
  'Edge AI Controller':            '#facc15',
  'Micro-inverter':                '#f87171',
  'Vehicle Charger Smart':         '#fb923c',
  'Peer-to-Peer Trading Platform': '#a78bfa',
  'Grid-Interactive HVAC':         '#34d399',
}

const SEGMENT_COLOURS: Record<string, string> = {
  'Smart Meters':               '#60a5fa',
  'HEMS':                       '#4ade80',
  'EV Smart Charging':          '#facc15',
  'Grid-Interactive Buildings': '#f87171',
  'Peer-to-Peer':               '#fb923c',
  'Edge AI':                    '#a78bfa',
}

const BENEFIT_COLOURS: Record<string, string> = {
  annual_value_m:    '#34d399',
  cost_to_unlock_m:  '#f87171',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#facc15',
  VIC1: '#4ade80',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GridEdgeTechnologyXAnalytics() {
  const [data, setData] = useState<GETAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGridEdgeTechnologyXDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading Grid Edge Technology Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ─── Chart 1: Stacked bar — deployment_count_k by technology × region ──────
  const techRegionMap: Record<string, Record<string, number>> = {}
  const regionsSet = new Set<string>()
  data.technologies.forEach(t => {
    if (!techRegionMap[t.technology]) techRegionMap[t.technology] = {}
    techRegionMap[t.technology][t.region] = t.deployment_count_k
    regionsSet.add(t.region)
  })
  const regions = Array.from(regionsSet).sort()
  const deploymentBarData = Object.entries(techRegionMap).map(([tech, regionMap]) => ({
    technology: tech.length > 16 ? tech.slice(0, 14) + '…' : tech,
    fullTech: tech,
    ...regionMap,
  }))

  // ─── Chart 2: Line — market_size_m by year for 6 segments ────────────────
  const yearsSet = new Set<number>()
  data.market_size.forEach(m => yearsSet.add(m.year))
  const years = Array.from(yearsSet).sort((a, b) => a - b)
  const segmentsSet = new Set<string>()
  data.market_size.forEach(m => segmentsSet.add(m.segment))
  const segments = Array.from(segmentsSet)
  const marketLineData = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    segments.forEach(seg => {
      const rec = data.market_size.find(m => m.year === yr && m.segment === seg)
      row[seg] = rec ? rec.market_size_m : 0
    })
    return row
  })

  // ─── Chart 3: Grouped bar — annual_value_m and cost_to_unlock_m by benefit_type ─
  const benefitTypeMap: Record<string, { annual_value_m: number; cost_to_unlock_m: number }> = {}
  data.network_benefits.forEach(nb => {
    if (!benefitTypeMap[nb.benefit_type]) {
      benefitTypeMap[nb.benefit_type] = { annual_value_m: 0, cost_to_unlock_m: 0 }
    }
    benefitTypeMap[nb.benefit_type].annual_value_m += nb.annual_value_m
    benefitTypeMap[nb.benefit_type].cost_to_unlock_m += nb.cost_to_unlock_m
  })
  const benefitBarData = Object.entries(benefitTypeMap).map(([bt, vals]) => ({
    benefit_type: bt.replace(' ', '\n'),
    annual_value_m: Math.round(vals.annual_value_m * 10) / 10,
    cost_to_unlock_m: Math.round(vals.cost_to_unlock_m * 10) / 10,
  }))

  // ─── Chart 4: Bar — adoption_2030_pct vs adoption_2024_pct by segment ─────
  const adoptionSegMap: Record<string, { a24: number; a30: number; count: number }> = {}
  data.consumer_adoption.forEach(ca => {
    if (!adoptionSegMap[ca.segment]) adoptionSegMap[ca.segment] = { a24: 0, a30: 0, count: 0 }
    adoptionSegMap[ca.segment].a24 += ca.adoption_2024_pct
    adoptionSegMap[ca.segment].a30 += ca.adoption_2030_pct
    adoptionSegMap[ca.segment].count += 1
  })
  const adoptionBarData = Object.entries(adoptionSegMap).map(([seg, vals]) => ({
    segment: seg,
    'Adoption 2024 (%)': Math.round((vals.a24 / vals.count) * 10) / 10,
    'Adoption 2030 (%)': Math.round((vals.a30 / vals.count) * 10) / 10,
  }))

  // ─── Chart 5: Bar — net_benefit_m by DNSP coloured by region ─────────────
  const dnspNetBenefitMap: Record<string, { net: number; region: string }> = {}
  data.network_benefits.forEach(nb => {
    if (!dnspNetBenefitMap[nb.dnsp]) {
      dnspNetBenefitMap[nb.dnsp] = { net: 0, region: nb.region }
    }
    dnspNetBenefitMap[nb.dnsp].net += nb.net_benefit_m
  })
  const dnspBarData = Object.entries(dnspNetBenefitMap)
    .map(([dnsp, v]) => ({
      dnsp,
      net_benefit_m: Math.round(v.net * 100) / 100,
      region: v.region,
    }))
    .sort((a, b) => b.net_benefit_m - a.net_benefit_m)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cpu className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Grid Edge Technology Analytics</h1>
          <p className="text-sm text-gray-400">
            Deployment, market growth, network benefits and consumer adoption across NEM regions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Deployments"
          value={`${summary.total_deployments_m ?? '—'}M`}
          sub="Across all technologies & regions"
          Icon={Cpu}
        />
        <KpiCard
          label="Peak Demand Reduction"
          value={`${summary.peak_demand_reduction_mw ?? '—'} MW`}
          sub="Aggregated network benefit"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Total Network Benefit"
          value={`$${summary.total_network_benefit_m ?? '—'}M`}
          sub="Net across all DNSPs"
          Icon={Network}
        />
        <KpiCard
          label="Leading Technology"
          value={String(summary.leading_technology ?? '—')}
          sub={`Fastest growing: ${summary.fastest_growing_segment ?? '—'}`}
          Icon={Users}
        />
      </div>

      {/* Chart 1: Stacked bar — deployments by technology × region */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Deployments by Technology and Region (000s)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={deploymentBarData} margin={{ top: 4, right: 16, bottom: 60, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="technology"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            {regions.map(region => (
              <Bar
                key={region}
                dataKey={region}
                stackId="stack"
                fill={REGION_COLOURS[region] ?? '#6b7280'}
                name={region}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Line — market size by year for 6 segments */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Market Size by Segment 2024–2034 ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={marketLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {segments.map(seg => (
              <Line
                key={seg}
                type="monotone"
                dataKey={seg}
                stroke={SEGMENT_COLOURS[seg] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={seg}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Grouped bar — annual_value_m and cost_to_unlock_m by benefit_type */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Network Benefit Value vs Cost to Unlock by Type ($M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={benefitBarData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="benefit_type"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="annual_value_m" fill={BENEFIT_COLOURS.annual_value_m} name="Annual Value ($M)" />
            <Bar dataKey="cost_to_unlock_m" fill={BENEFIT_COLOURS.cost_to_unlock_m} name="Cost to Unlock ($M)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Bar — adoption 2024 vs 2030 by consumer segment */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Consumer Adoption 2024 vs 2030 by Segment (% avg across technologies)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={adoptionBarData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="segment"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="Adoption 2024 (%)" fill="#60a5fa" name="2024 Adoption (%)" />
            <Bar dataKey="Adoption 2030 (%)" fill="#34d399" name="2030 Adoption (%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Bar — net_benefit_m by DNSP coloured by region */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Net Network Benefit by DNSP ($M, coloured by region)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dnspBarData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="dnsp"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val.toFixed(2)}M`, 'Net Benefit']}
            />
            <Bar dataKey="net_benefit_m" name="Net Benefit ($M)">
              {dnspBarData.map((entry, idx) => (
                <rect
                  key={idx}
                  fill={REGION_COLOURS[entry.region] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Region colour legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(REGION_COLOURS).map(([reg, colour]) => (
            <div key={reg} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {reg}
            </div>
          ))}
        </div>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <dt className="text-xs text-gray-400 uppercase tracking-wide break-words">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-base font-semibold text-white mt-1 break-words">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
