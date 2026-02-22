import { useEffect, useState } from 'react'
import { BarChart2, Zap, TrendingDown, DollarSign, Loader2, AlertCircle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getNEMGenerationMixDashboard,
  NEGMDashboard,
  NEGMRetirementRecord,
  NEGMInvestmentRecord,
} from '../api/client'

const COLORS = {
  black_coal: '#374151',
  brown_coal: '#78350f',
  gas:        '#f59e0b',
  hydro:      '#3b82f6',
  wind:       '#10b981',
  solar_utility: '#fbbf24',
  solar_rooftop: '#fde68a',
  battery:    '#8b5cf6',
  pumped_hydro: '#06b6d4',
  other:      '#84cc16',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Current Policies': '#94a3b8',
  'Net Zero 2050':    '#10b981',
  'Accelerated':      '#3b82f6',
  'Delayed':          '#ef4444',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const KPICard = ({
  title, value, sub, icon: Icon, color,
}: { title: string; value: string; sub: string; icon: React.ElementType; color: string }) => (
  <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{sub}</p>
    </div>
  </div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-gray-100 text-lg font-semibold mb-4">{children}</h2>
)

const reliabilityBadge = (impact: string) => {
  const map: Record<string, string> = {
    High:   'bg-red-900 text-red-300',
    Medium: 'bg-yellow-900 text-yellow-300',
    Low:    'bg-green-900 text-green-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[impact] ?? 'bg-gray-700 text-gray-300'}`}>
      {impact}
    </span>
  )
}

const contractBadge = (status: string) => {
  const map: Record<string, string> = {
    Merchant: 'bg-blue-900 text-blue-300',
    CIS:      'bg-green-900 text-green-300',
    PPA:      'bg-purple-900 text-purple-300',
    RERT:     'bg-orange-900 text-orange-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

export default function NEMGenerationMixAnalytics() {
  const [data, setData] = useState<NEGMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('NSW')

  useEffect(() => {
    getNEMGenerationMixDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center gap-3">
      <AlertCircle className="w-6 h-6 text-red-400" />
      <p className="text-red-400">{error ?? 'Failed to load data'}</p>
    </div>
  )

  const { summary, generation_fleet, transition_records, retirements, investments, dispatch_shares, scenarios } = data

  // ---- KPI ----
  const totalCapacity = summary['total_nem_capacity_gw']
  const renShare = summary['current_renewable_share_pct']
  const annualRet = summary['annual_retirement_gw']
  const annualInv = summary['annual_investment_gw']

  // ---- Transition area chart: NEM total (sum across regions per year) ----
  const yearMap: Record<number, Record<string, number>> = {}
  transition_records.forEach(r => {
    if (!yearMap[r.year]) yearMap[r.year] = {
      year: r.year, black_coal: 0, brown_coal: 0, gas: 0, hydro: 0,
      wind: 0, solar_utility: 0, solar_rooftop: 0, battery: 0, pumped_hydro: 0, other: 0,
    }
    const y = yearMap[r.year]
    y['black_coal']    += r.black_coal_gw
    y['brown_coal']    += r.brown_coal_gw
    y['gas']           += r.gas_gw
    y['hydro']         += r.hydro_gw
    y['wind']          += r.wind_gw
    y['solar_utility'] += r.solar_utility_gw
    y['solar_rooftop'] += r.solar_rooftop_gw
    y['battery']       += r.battery_gw
    y['pumped_hydro']  += r.pumped_hydro_gw
    y['other']         += r.other_renewables_gw
  })
  const transitionChartData = Object.values(yearMap)
    .sort((a, b) => a['year'] - b['year'])
    .map(y => ({ ...y, year: String(y['year']) }))

  // ---- Capacity by technology bar chart ----
  const techCapMap: Record<string, number> = {}
  generation_fleet.forEach(g => {
    techCapMap[g.technology] = (techCapMap[g.technology] ?? 0) + g.capacity_gw
  })
  const techCapData = Object.entries(techCapMap)
    .map(([tech, cap]) => ({ tech, capacity_gw: Math.round(cap * 10) / 10 }))
    .sort((a, b) => b.capacity_gw - a.capacity_gw)

  // ---- Scenario comparison line chart ----
  const scenarioYears = [2025, 2030, 2035, 2040, 2050]
  const scenarioNames = ['Current Policies', 'Net Zero 2050', 'Accelerated', 'Delayed']
  const scenarioChartData = scenarioYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    scenarioNames.forEach(name => {
      const rec = scenarios.find(s => s.scenario_name === name && s.year === yr)
      row[name] = rec ? rec.renewable_share_pct : 0
    })
    return row
  })

  // ---- Dispatch share bar chart by region ----
  const regionDispatch = dispatch_shares
    .filter(d => d.region === selectedRegion)
    .sort((a, b) => a.month - b.month)
    .map(d => ({
      month: MONTH_NAMES[d.month - 1],
      Renewables: Math.round((d.wind_pct + d.solar_utility_pct + d.solar_rooftop_pct + d.hydro_pct + d.battery_pct + d.pumped_hydro_pct + d.other_pct) * 10) / 10,
      Gas: d.gas_pct,
      Coal: d.coal_pct,
    }))

  // ---- Tables ----
  const sortedRetirements: NEGMRetirementRecord[] = [...retirements].sort((a, b) => a.retirement_year - b.retirement_year)
  const sortedInvestments: NEGMInvestmentRecord[] = [...investments].sort((a, b) => b.capacity_mw - a.capacity_mw)

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-600 rounded-lg">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold">NEM Generation Mix Transition Analytics</h1>
          <p className="text-gray-400 text-sm">National Electricity Market capacity transition, retirements and new investment pipeline</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total NEM Capacity"
          value={`${totalCapacity.toFixed(1)} GW`}
          sub="Current installed capacity"
          icon={Zap}
          color="bg-blue-600"
        />
        <KPICard
          title="Renewable Share"
          value={`${renShare.toFixed(1)}%`}
          sub="Of total NEM capacity"
          icon={BarChart2}
          color="bg-emerald-600"
        />
        <KPICard
          title="Annual Retirements"
          value={`${annualRet.toFixed(2)} GW`}
          sub="2024–2025 scheduled exits"
          icon={TrendingDown}
          color="bg-red-600"
        />
        <KPICard
          title="Annual Investment"
          value={`${annualInv.toFixed(2)} GW`}
          sub="2025–2026 expected COD"
          icon={DollarSign}
          color="bg-amber-600"
        />
      </div>

      {/* Generation Mix Transition — Stacked Area */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <SectionTitle>NEM Generation Mix Transition (2024–2033)</SectionTitle>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={transitionChartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" GW" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Area type="monotone" dataKey="black_coal"    stackId="1" stroke={COLORS.black_coal}    fill={COLORS.black_coal}    name="Black Coal" />
            <Area type="monotone" dataKey="brown_coal"    stackId="1" stroke={COLORS.brown_coal}    fill={COLORS.brown_coal}    name="Brown Coal" />
            <Area type="monotone" dataKey="gas"           stackId="1" stroke={COLORS.gas}           fill={COLORS.gas}           name="Gas" />
            <Area type="monotone" dataKey="hydro"         stackId="1" stroke={COLORS.hydro}         fill={COLORS.hydro}         name="Hydro" />
            <Area type="monotone" dataKey="wind"          stackId="1" stroke={COLORS.wind}          fill={COLORS.wind}          name="Wind" />
            <Area type="monotone" dataKey="solar_utility" stackId="1" stroke={COLORS.solar_utility} fill={COLORS.solar_utility} name="Solar Utility" />
            <Area type="monotone" dataKey="solar_rooftop" stackId="1" stroke={COLORS.solar_rooftop} fill={COLORS.solar_rooftop} name="Solar Rooftop" />
            <Area type="monotone" dataKey="battery"       stackId="1" stroke={COLORS.battery}       fill={COLORS.battery}       name="Battery" />
            <Area type="monotone" dataKey="pumped_hydro"  stackId="1" stroke={COLORS.pumped_hydro}  fill={COLORS.pumped_hydro}  name="Pumped Hydro" />
            <Area type="monotone" dataKey="other"         stackId="1" stroke={COLORS.other}         fill={COLORS.other}         name="Other Renewables" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: Tech Capacity + Scenario Line */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Current Fleet Capacity by Technology */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <SectionTitle>Current Fleet Capacity by Technology</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={techCapData} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" />
              <YAxis dataKey="tech" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} formatter={(v: number) => [`${v} GW`, 'Capacity']} />
              <Bar dataKey="capacity_gw" fill="#3b82f6" name="Capacity (GW)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scenario Renewable Share Line Chart */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <SectionTitle>Scenario Comparison — Renewable Share % (2025–2050)</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scenarioChartData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 105]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} formatter={(v: number) => [`${v}%`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {scenarioNames.map(name => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={SCENARIO_COLORS[name]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Dispatch Share by Region */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Monthly Dispatch Share — Renewables vs Thermal</SectionTitle>
          <select
            className="bg-gray-700 text-gray-200 rounded-lg px-3 py-1.5 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
          >
            {['NSW','VIC','QLD','SA','TAS'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={regionDispatch} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} formatter={(v: number) => [`${v}%`]} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Renewables" stackId="a" fill="#10b981" />
            <Bar dataKey="Gas"        stackId="a" fill="#f59e0b" />
            <Bar dataKey="Coal"       stackId="a" fill="#374151" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming Retirements Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <SectionTitle>Upcoming Retirements (sorted by year)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-3 pr-4">Asset</th>
                <th className="text-left pb-3 pr-4">Technology</th>
                <th className="text-left pb-3 pr-4">Region</th>
                <th className="text-right pb-3 pr-4">Capacity (MW)</th>
                <th className="text-center pb-3 pr-4">Retire Year</th>
                <th className="text-left pb-3 pr-4">Replacement</th>
                <th className="text-center pb-3 pr-4">Reliability</th>
                <th className="text-right pb-3">CO₂ Saving (Mt/pa)</th>
              </tr>
            </thead>
            <tbody>
              {sortedRetirements.map(r => (
                <tr key={r.retirement_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 pr-4 text-white font-medium">{r.asset_name}</td>
                  <td className="py-2.5 pr-4 text-gray-300">{r.technology}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{r.region}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{r.capacity_mw.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-center text-amber-400 font-semibold">{r.retirement_year}</td>
                  <td className="py-2.5 pr-4 text-emerald-400">{r.replacement_technology}</td>
                  <td className="py-2.5 pr-4 text-center">{reliabilityBadge(r.reliability_impact)}</td>
                  <td className="py-2.5 text-right text-gray-300">{r.carbon_reduction_mt_pa.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investment Pipeline Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <SectionTitle>New Investment Pipeline (sorted by capacity)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-3 pr-4">Technology</th>
                <th className="text-left pb-3 pr-4">Developer</th>
                <th className="text-left pb-3 pr-4">Region</th>
                <th className="text-right pb-3 pr-4">Capacity (MW)</th>
                <th className="text-right pb-3 pr-4">Capex ($m)</th>
                <th className="text-right pb-3 pr-4">LCOE ($/MWh)</th>
                <th className="text-center pb-3 pr-4">COD Year</th>
                <th className="text-center pb-3">Contract</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvestments.map(inv => (
                <tr key={inv.investment_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 pr-4 text-white font-medium">{inv.technology}</td>
                  <td className="py-2.5 pr-4 text-gray-300">{inv.developer}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{inv.region}</td>
                  <td className="py-2.5 pr-4 text-right text-blue-400 font-semibold">{inv.capacity_mw.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">${inv.capex_m.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">${inv.lcoe_dolpermwh.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 text-center text-emerald-400">{inv.expected_cod_year}</td>
                  <td className="py-2.5 text-center">{contractBadge(inv.contract_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
