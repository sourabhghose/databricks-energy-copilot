import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getLargeScaleRenewableAuctionDashboard,
  LSRADashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  Wind:           '#3b82f6',
  Solar:          '#f59e0b',
  'Solar+Storage':'#10b981',
  'Wind+Storage': '#8b5cf6',
  'Pumped Hydro': '#06b6d4',
  Hybrid:         '#f97316',
  Firming:        '#ec4899',
}

const JUR_COLORS: Record<string, string> = {
  NSW:     '#3b82f6',
  VIC:     '#10b981',
  QLD:     '#f59e0b',
  SA:      '#8b5cf6',
  TAS:     '#06b6d4',
  Federal: '#f97316',
}

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#a78bfa','#fb923c']

function kpi(label: string, value: string, sub?: string) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LargeScaleRenewableAuctionAnalytics() {
  const [data, setData] = useState<LSRADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLargeScaleRenewableAuctionDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load LSRA data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-400 animate-pulse">
        Loading Large-Scale Renewable Auction Analytics…
      </div>
    )
  }

  const { auctions, projects, price_trajectory, developers, market_dynamics, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: auction contracted_capacity_mw coloured by technology_mix
  // -------------------------------------------------------------------------
  const auctionCapData = auctions.map(a => ({
    name: a.auction_name.length > 22 ? a.auction_name.slice(0, 22) + '…' : a.auction_name,
    contracted_capacity_mw: a.contracted_capacity_mw,
    technology_mix: a.technology_mix,
  }))

  // -------------------------------------------------------------------------
  // Chart 2: clearing price trajectory 2019-2024 by technology
  // -------------------------------------------------------------------------
  const trajTechs = ['Wind', 'Solar', 'Solar+Storage']
  const trajYears = [2019, 2020, 2021, 2022, 2023, 2024]
  const trajByYear = trajYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    for (const tech of trajTechs) {
      const rec = price_trajectory.find(p => p.technology === tech && p.year === yr)
      row[tech] = rec ? rec.avg_clearing_price_mwh : 0
    }
    return row
  })

  // -------------------------------------------------------------------------
  // Chart 3: project capacity by developer (top 15) coloured by technology
  // -------------------------------------------------------------------------
  const devProjectMap: Record<string, { capacity_mw: number; technology: string }> = {}
  for (const proj of projects) {
    if (!devProjectMap[proj.developer]) {
      devProjectMap[proj.developer] = { capacity_mw: 0, technology: proj.technology }
    }
    devProjectMap[proj.developer].capacity_mw += proj.capacity_mw
  }
  const topDevProjects = Object.entries(devProjectMap)
    .sort((a, b) => b[1].capacity_mw - a[1].capacity_mw)
    .slice(0, 15)
    .map(([name, vals]) => ({
      name: name.length > 18 ? name.slice(0, 18) + '…' : name,
      capacity_mw: Math.round(vals.capacity_mw),
      technology: vals.technology,
    }))

  // -------------------------------------------------------------------------
  // Chart 4: jurisdiction total_capacity_contracted_mw by year (grouped)
  // -------------------------------------------------------------------------
  const dynYears = [2021, 2022, 2023, 2024]
  const dynByYear = dynYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    for (const jur of ['NSW', 'VIC', 'QLD', 'SA', 'TAS', 'Federal']) {
      const rec = market_dynamics.find(m => m.jurisdiction === jur && m.year === yr)
      row[jur] = rec ? Math.round(rec.total_capacity_contracted_mw) : 0
    }
    return row
  })

  // -------------------------------------------------------------------------
  // Chart 5: developer market_share_pct sorted descending (top 15)
  // -------------------------------------------------------------------------
  const topDevShare = [...developers]
    .sort((a, b) => b.market_share_pct - a.market_share_pct)
    .slice(0, 15)
    .map(d => ({
      name: d.developer_name.length > 18 ? d.developer_name.slice(0, 18) + '…' : d.developer_name,
      market_share_pct: d.market_share_pct,
    }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Award className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Large-Scale Renewable Energy Auction Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Australian state &amp; federal renewable energy auctions — CfD, Reverse Auction, REZ Allocation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpi('Total Auctions', String(summary.total_auctions))}
        {kpi('Total Contracted', `${summary.total_contracted_capacity_gw.toFixed(2)} GW`)}
        {kpi('Avg Clearing Price', `$${summary.avg_clearing_price_mwh.toFixed(2)}/MWh`)}
        {kpi('Lowest Clearing Price', `$${summary.lowest_clearing_price_mwh.toFixed(2)}/MWh`, 'Best auction result')}
      </div>

      {/* Chart 1: Auction Contracted Capacity */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Auction Contracted Capacity (MW) by Technology Mix
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={auctionCapData} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="contracted_capacity_mw" name="Contracted (MW)" radius={[3, 3, 0, 0]}>
              {auctionCapData.map((entry, idx) => (
                <Cell key={idx} fill={TECH_COLORS[entry.technology_mix] ?? PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(TECH_COLORS).map(([tech, color]) => (
            <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Clearing Price Trajectory */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Clearing Price Trajectory 2019–2024 ($/MWh) — Wind, Solar, Solar+Storage
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trajByYear} margin={{ top: 4, right: 20, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {trajTechs.map(tech => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech]}
                strokeWidth={2}
                dot={{ r: 4, fill: TECH_COLORS[tech] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Project Capacity by Developer */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Top 15 Developers — Project Capacity (MW) by Technology
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topDevProjects} margin={{ top: 4, right: 16, left: 16, bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[3, 3, 0, 0]}>
              {topDevProjects.map((entry, idx) => (
                <Cell key={idx} fill={TECH_COLORS[entry.technology] ?? PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Jurisdiction contracted by year */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Capacity Contracted by Jurisdiction &amp; Year (MW)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dynByYear} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {['NSW', 'VIC', 'QLD', 'SA', 'TAS', 'Federal'].map(jur => (
              <Bar key={jur} dataKey={jur} stackId="a" fill={JUR_COLORS[jur]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Developer Market Share */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Developer Market Share (%) — Top 15
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={topDevShare}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 140, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={135}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="market_share_pct" name="Market Share (%)" radius={[0, 3, 3, 0]}>
              {topDevShare.map((_entry, idx) => (
                <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-600 text-center mt-4">
        Synthetic data for illustrative purposes only — Australian renewable energy auction analytics
      </p>
    </div>
  )
}
