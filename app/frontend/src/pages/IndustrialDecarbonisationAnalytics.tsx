import { useEffect, useState } from 'react'
import { Factory, TrendingDown, DollarSign, Users, AlertTriangle } from 'lucide-react'
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
import {
  getIndustrialDecarbonisationDashboard,
  IDRADashboard,
} from '../api/client'

export default function IndustrialDecarbonisationAnalytics() {
  const [data, setData] = useState<IDRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getIndustrialDecarbonisationDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-300">
        <div className="text-center">
          <Factory size={48} className="mx-auto mb-4 text-orange-400 animate-pulse" />
          <p className="text-lg">Loading Industrial Decarbonisation data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4" />
          <p className="text-lg">Error loading data: {error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { sectors, facilities, abatement_records, policies, investments, summary } = data

  // KPI values
  const totalEmissions = summary['total_industrial_emissions_mt'] ?? 0
  const totalAbatement = summary['total_abatement_potential_mt'] ?? 0
  const totalInvestment = summary['total_investment_required_bn'] ?? 0
  const netJobs = summary['jobs_transition_net'] ?? 0
  const avgCost = summary['avg_abatement_cost_dolpertonne'] ?? 0

  // Chart 1: Sector emissions vs abatement potential (grouped bar)
  const sectorEmissionsData = sectors.map((s) => ({
    name: s.sector_name.length > 10 ? s.sector_name.substring(0, 10) : s.sector_name,
    fullName: s.sector_name,
    emissions: s.emissions_mt_co2e_pa,
    abatementPotential: Math.round(s.emissions_mt_co2e_pa * s.abatement_potential_pct) / 100,
  }))

  // Chart 2: Abatement cost curve grouped by technology (average cost by sector & tech, 2030)
  const techCostMap: Record<string, Record<string, number>> = {}
  const techCostCount: Record<string, Record<string, number>> = {}
  abatement_records
    .filter((r) => r.year === 2030)
    .forEach((r) => {
      if (!techCostMap[r.technology]) {
        techCostMap[r.technology] = {}
        techCostCount[r.technology] = {}
      }
      const costPerTonne = r.capex_m > 0 && r.abatement_mt_co2e > 0
        ? Math.round(r.capex_m / (r.abatement_mt_co2e * 10))
        : 0
      techCostMap[r.technology][r.sector] = (techCostMap[r.technology][r.sector] ?? 0) + costPerTonne
      techCostCount[r.technology][r.sector] = (techCostCount[r.technology][r.sector] ?? 0) + 1
    })

  const technologies = Array.from(new Set(abatement_records.map((r) => r.technology)))
  const sectorNames = sectors.map((s) => s.sector_name)
  const sectorColors = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']

  const abatementCostData = technologies.map((tech) => {
    const entry: Record<string, string | number> = { technology: tech.length > 15 ? tech.substring(0, 15) : tech }
    sectorNames.forEach((sec) => {
      const count = techCostCount[tech]?.[sec] ?? 0
      entry[sec] = count > 0 ? Math.round((techCostMap[tech][sec] ?? 0) / count) : 0
    })
    return entry
  })

  // Chart 3: Abatement trajectory 2025-2030 (cumulative MT CO2e)
  const years = [2025, 2030]
  const trajectoryData = years.map((yr) => {
    const total = abatement_records
      .filter((r) => r.year === yr)
      .reduce((sum, r) => sum + r.abatement_mt_co2e, 0)
    return {
      year: yr.toString(),
      totalAbatement: Math.round(total * 10) / 10,
    }
  })

  // Chart 4: Investment by sector and type
  const investmentBySector: Record<string, Record<string, number>> = {}
  investments.forEach((inv) => {
    if (!investmentBySector[inv.sector]) investmentBySector[inv.sector] = {}
    investmentBySector[inv.sector][inv.status] =
      (investmentBySector[inv.sector][inv.status] ?? 0) + inv.total_capex_m
  })
  const investmentChartData = Object.entries(investmentBySector).map(([sector, statusMap]) => ({
    sector: sector.length > 10 ? sector.substring(0, 10) : sector,
    Announced: Math.round((statusMap['Announced'] ?? 0)),
    FID: Math.round((statusMap['FID'] ?? 0)),
    Construction: Math.round((statusMap['Construction'] ?? 0)),
    Operating: Math.round((statusMap['Operating'] ?? 0)),
  }))

  // Table 1: Top 10 facilities by emissions
  const topFacilities = [...facilities]
    .sort((a, b) => b.annual_emissions_mt_co2e - a.annual_emissions_mt_co2e)
    .slice(0, 10)

  // Table 2: Policies
  const topPolicies = policies.slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Factory size={32} className="text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Industrial Decarbonisation Roadmap Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Australian heavy industry emissions, abatement pathways, investment pipeline and policy mechanisms
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Factory size={18} className="text-orange-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Total Industrial Emissions</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalEmissions.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">MT CO2e per annum</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-green-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Abatement Potential</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{totalAbatement.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">MT CO2e pa potential reduction</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-blue-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Investment Required</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">${totalInvestment.toFixed(1)}bn</p>
          <p className="text-xs text-gray-500 mt-1">Total announced pipeline</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-purple-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Net Jobs (2030)</span>
          </div>
          <p className={`text-2xl font-bold ${netJobs >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netJobs >= 0 ? '+' : ''}{netJobs.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Created minus at-risk</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-yellow-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Avg Abatement Cost</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">${avgCost.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Per tonne CO2e</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Sector emissions vs abatement */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Sector Emissions vs Abatement Potential (MT CO2e pa)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorEmissionsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)} MT`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="emissions" name="Emissions" fill="#f97316" radius={[2, 2, 0, 0]} />
              <Bar dataKey="abatementPotential" name="Abatement Potential" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Abatement deployment trajectory */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Abatement Deployment Trajectory — Total MT CO2e Abated</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trajectoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number) => [`${value.toFixed(1)} MT CO2e`, 'Total Abatement']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="totalAbatement"
                name="Total Abatement"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Abatement cost curve by technology */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Abatement Cost Curve by Technology & Sector (2030, $/t CO2e)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={abatementCostData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number, name: string) => [`$${value}/t`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {sectorNames.map((sec, idx) => (
                <Bar key={sec} dataKey={sec} stackId="a" fill={sectorColors[idx % sectorColors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Investment by sector and status */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Announced Investment by Sector & Status ($M)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={investmentChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value: number, name: string) => [`$${value.toLocaleString()}M`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="Announced" stackId="a" fill="#6366f1" />
              <Bar dataKey="FID" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Construction" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Operating" stackId="a" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top 10 Facilities Table */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Top 10 Facilities by Emissions & Abatement Pathway</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Facility</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Sector</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">State</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Emissions (MT)</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Pathway</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Yr</th>
                </tr>
              </thead>
              <tbody>
                {topFacilities.map((f, idx) => (
                  <tr key={f.facility_id} className={idx % 2 === 0 ? 'bg-gray-750' : ''}>
                    <td className="py-1.5 px-2 text-gray-200 max-w-[140px] truncate">{f.facility_name}</td>
                    <td className="py-1.5 px-2 text-gray-300">{f.sector}</td>
                    <td className="py-1.5 px-2 text-gray-400">{f.state}</td>
                    <td className="py-1.5 px-2 text-right text-orange-400 font-mono">{f.annual_emissions_mt_co2e.toFixed(1)}</td>
                    <td className="py-1.5 px-2">
                      <span className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded text-xs">{f.abatement_pathway}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{f.planned_transition_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Policy Support Mechanisms Table */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Policy Support Mechanisms — Effectiveness Rating</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Policy</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Mechanism</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Support $M</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Coverage %</th>
                  <th className="text-center py-2 px-2 text-gray-400 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topPolicies.map((p, idx) => (
                  <tr key={p.policy_id} className={idx % 2 === 0 ? 'bg-gray-750' : ''}>
                    <td className="py-1.5 px-2 text-gray-200 max-w-[150px] truncate" title={p.policy_name}>{p.policy_name}</td>
                    <td className="py-1.5 px-2 text-gray-300">{p.mechanism}</td>
                    <td className="py-1.5 px-2 text-right text-blue-400 font-mono">
                      {p.support_value_m > 0 ? `$${p.support_value_m.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-300">{p.coverage_pct_of_sector.toFixed(0)}%</td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        p.effectiveness_rating >= 4 ? 'bg-green-900/50 text-green-300' :
                        p.effectiveness_rating === 3 ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-red-900/50 text-red-300'
                      }`}>
                        {'★'.repeat(p.effectiveness_rating)}{'☆'.repeat(5 - p.effectiveness_rating)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
