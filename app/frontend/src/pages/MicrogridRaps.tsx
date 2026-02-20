import React, { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Wifi, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  api,
  MicrogridDashboard,
  MicrogridRecord,
  MicrogridEnergyRecord,
  OffGridTechnologyRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMUNITY_TYPE_COLORS: Record<string, string> = {
  ABORIGINAL: 'bg-teal-700 text-white',
  PASTORAL:   'bg-amber-600 text-white',
  MINING:     'bg-orange-600 text-white',
  ISLAND:     'bg-blue-600 text-white',
  TOURISM:    'bg-purple-600 text-white',
  DEFENCE:    'bg-gray-600 text-white',
}

const GRID_TYPE_COLORS: Record<string, string> = {
  ISOLATED_DIESEL:     'bg-red-700 text-white',
  HYBRID_SOLAR_DIESEL: 'bg-amber-600 text-white',
  FULL_RENEWABLE:      'bg-green-600 text-white',
  PARTIAL_GRID:        'bg-blue-600 text-white',
}

const TECH_DISPLAY: Record<string, string> = {
  SOLAR_PV:  'Solar PV',
  WIND:      'Wind',
  BATTERY:   'Battery',
  DIESEL:    'Diesel',
  FLYWHEEL:  'Flywheel',
  FUEL_CELL: 'Fuel Cell',
}

const TECH_COLORS: Record<string, string> = {
  SOLAR_PV:  'bg-amber-500',
  WIND:      'bg-cyan-500',
  BATTERY:   'bg-green-500',
  DIESEL:    'bg-red-500',
  FLYWHEEL:  'bg-violet-500',
  FUEL_CELL: 'bg-sky-500',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rfBarColor(rf: number): string {
  if (rf >= 100) return '#16a34a'
  if (rf >= 70)  return '#84cc16'
  if (rf >= 40)  return '#f59e0b'
  return '#ef4444'
}

function rfTextColor(rf: number): string {
  if (rf >= 100) return 'text-green-400'
  if (rf >= 70)  return 'text-lime-400'
  if (rf >= 40)  return 'text-amber-400'
  return 'text-red-400'
}

function fmt0(v: number): string { return v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) }
function fmt1(v: number): string { return v.toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }
function fmtK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'text-white' }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Renewable Fraction Chart (horizontal bar)
// ---------------------------------------------------------------------------

interface RfBarProps {
  microgrids: MicrogridRecord[]
}

function RfBarChart({ microgrids }: RfBarProps) {
  const sorted = [...microgrids].sort((a, b) => b.renewable_fraction_pct - a.renewable_fraction_pct)
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">Renewable Fraction by Microgrid</h2>
      <div className="space-y-2">
        {sorted.map((mg) => (
          <div key={mg.microgrid_id} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-48 truncate shrink-0">
              {mg.microgrid_name}
            </span>
            <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(mg.renewable_fraction_pct, 100)}%`,
                  backgroundColor: rfBarColor(mg.renewable_fraction_pct),
                }}
              />
            </div>
            <span className={`text-xs font-semibold w-12 text-right shrink-0 ${rfTextColor(mg.renewable_fraction_pct)}`}>
              {fmt1(mg.renewable_fraction_pct)}%
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded text-center w-24 shrink-0 ${COMMUNITY_TYPE_COLORS[mg.community_type] ?? 'bg-gray-600 text-white'}`}>
              {mg.community_type}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Energy Mix Chart
// ---------------------------------------------------------------------------

interface EnergyMixProps {
  energyRecords: MicrogridEnergyRecord[]
  microgrids: MicrogridRecord[]
}

function EnergyMixChart({ energyRecords, microgrids }: EnergyMixProps) {
  const uniqueIds = Array.from(new Set(energyRecords.map((r) => r.microgrid_id)))
  const [selectedId, setSelectedId] = useState<string>(uniqueIds[0] ?? '')

  const records = energyRecords
    .filter((r) => r.microgrid_id === selectedId)
    .sort((a, b) => a.month - b.month)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Monthly Energy Mix</h2>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600 focus:outline-none"
        >
          {uniqueIds.map((id) => {
            const mg = microgrids.find((m) => m.microgrid_id === id)
            return (
              <option key={id} value={id}>
                {mg ? mg.microgrid_name : id}
              </option>
            )
          })}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={records} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month_name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" width={70} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
            itemStyle={{ color: '#d1d5db', fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Area type="monotone" dataKey="solar_generation_mwh" name="Solar" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.7} />
          <Area type="monotone" dataKey="wind_generation_mwh"  name="Wind"  stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.7} />
          <Area type="monotone" dataKey="storage_discharge_mwh" name="Storage" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.7} />
          <Area type="monotone" dataKey="diesel_generation_mwh" name="Diesel" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diesel Displacement Chart
// ---------------------------------------------------------------------------

function DieselDisplacementChart({ data }: { data: { state: string; quarter: string; diesel_litres_consumed: number; renewable_fraction_pct: number }[] }) {
  const states = Array.from(new Set(data.map((d) => d.state)))
  const [selectedState, setSelectedState] = useState<string>(states[0] ?? 'QLD')

  const stateData = data
    .filter((d) => d.state === selectedState)
    .sort((a, b) => a.quarter.localeCompare(b.quarter))
    .map((d) => ({ ...d, litres_m: +(d.diesel_litres_consumed / 1_000_000).toFixed(2) }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Diesel Consumption Trend by State (2024)</h2>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="text-xs bg-gray-700 text-gray-200 rounded px-2 py-1 border border-gray-600 focus:outline-none"
        >
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={stateData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" ML" width={60} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" width={45} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontSize: 12 }}
            itemStyle={{ color: '#d1d5db', fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Bar yAxisId="left" dataKey="litres_m" name="Diesel Consumed (ML)" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="renewable_fraction_pct" name="Renewable Fraction %" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Microgrid Registry Table
// ---------------------------------------------------------------------------

function MicrogridTable({ microgrids }: { microgrids: MicrogridRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">Microgrid Registry</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              {['Name', 'Location', 'State', 'Community', 'Grid Type', 'Peak (kW)', 'RF %', 'Solar (kW)', 'Storage (kWh)', 'Diesel Saved', 'CO₂ Avoided', 'Status'].map((h) => (
                <th key={h} className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {microgrids.map((mg) => (
              <tr key={mg.microgrid_id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                <td className="py-2 px-3 font-medium text-white whitespace-nowrap">{mg.microgrid_name}</td>
                <td className="py-2 px-3 whitespace-nowrap">{mg.location}</td>
                <td className="py-2 px-3">{mg.state}</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${COMMUNITY_TYPE_COLORS[mg.community_type] ?? 'bg-gray-600 text-white'}`}>
                    {mg.community_type}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${GRID_TYPE_COLORS[mg.grid_type] ?? 'bg-gray-600 text-white'}`}>
                    {mg.grid_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">{fmt0(mg.peak_demand_kw)}</td>
                <td className={`py-2 px-3 text-right font-semibold ${rfTextColor(mg.renewable_fraction_pct)}`}>
                  {fmt1(mg.renewable_fraction_pct)}%
                </td>
                <td className="py-2 px-3 text-right">{fmt0(mg.solar_capacity_kw)}</td>
                <td className="py-2 px-3 text-right">{fmt0(mg.storage_kwh)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{fmtK(mg.diesel_cost_saving_aud_yr)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{fmt0(mg.co2_avoided_tpa)} t</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    mg.status === 'OPERATING'     ? 'bg-green-700 text-white' :
                    mg.status === 'CONSTRUCTION'  ? 'bg-yellow-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {mg.status}
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
// Technology Summary
// ---------------------------------------------------------------------------

function TechnologySummary({ records }: { records: OffGridTechnologyRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-200 mb-4">Off-Grid Technology Deployment Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {records.map((rec) => (
          <div key={rec.technology} className="bg-gray-750 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full ${TECH_COLORS[rec.technology] ?? 'bg-gray-500'}`} />
              <span className="font-semibold text-white text-sm">
                {TECH_DISPLAY[rec.technology] ?? rec.technology}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-gray-400">Installed Capacity</span>
              <span className="text-right text-gray-200">{(rec.installed_capacity_kw / 1000).toFixed(0)} MW</span>
              <span className="text-gray-400">Sites Deployed</span>
              <span className="text-right text-gray-200">{rec.sites_deployed}</span>
              <span className="text-gray-400">Avg Cost/kW</span>
              <span className="text-right text-gray-200">${fmt0(rec.avg_cost_per_kw)}</span>
              <span className="text-gray-400">Reliability</span>
              <span className="text-right text-green-400 font-medium">{rec.reliability_pct}%</span>
              <span className="text-gray-400">Maint. Cost/kW/yr</span>
              <span className="text-right text-gray-200">${rec.maintenance_cost_kw_yr}/kW</span>
              <span className="text-gray-400">Design Life</span>
              <span className="text-right text-gray-200">{rec.design_life_years} yrs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MicrogridRaps() {
  const [dashboard, setDashboard] = useState<MicrogridDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMicrogridRapsDashboard()
      setDashboard(data)
      setLastUpdated(new Date().toLocaleTimeString('en-AU'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load microgrid RAPS data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading Microgrid RAPS data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-600 rounded-lg">
            <Wifi className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Microgrids & Remote Area Power Systems (RAPS)</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Isolated microgrid operations, diesel displacement, energy autonomy, and off-grid community analytics
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg border border-gray-700 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
          {lastUpdated && <span className="text-gray-500">· {lastUpdated}</span>}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Microgrids"
          value={String(dashboard.total_microgrids)}
          sub="Across all Australian states"
          accent="text-teal-400"
        />
        <KpiCard
          label="Avg Renewable Fraction"
          value={`${fmt1(dashboard.avg_renewable_fraction_pct)}%`}
          sub="Weighted average across sites"
          accent="text-green-400"
        />
        <KpiCard
          label="Total Diesel Displaced"
          value={`${fmt1(dashboard.total_diesel_displaced_ml)} ML/yr`}
          sub="Million litres of diesel saved annually"
          accent="text-amber-400"
        />
        <KpiCard
          label="Total CO2 Avoided"
          value={`${fmt0(dashboard.total_co2_avoided_tpa)} t/yr`}
          sub="Tonnes CO₂ per year avoided"
          accent="text-lime-400"
        />
      </div>

      {/* Renewable Fraction Chart */}
      <RfBarChart microgrids={dashboard.microgrids} />

      {/* Energy Mix + Diesel Displacement side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <EnergyMixChart
          energyRecords={dashboard.energy_records}
          microgrids={dashboard.microgrids}
        />
        <DieselDisplacementChart data={dashboard.diesel_displacement} />
      </div>

      {/* Microgrid Registry Table */}
      <MicrogridTable microgrids={dashboard.microgrids} />

      {/* Technology Summary */}
      <TechnologySummary records={dashboard.technology_summary} />
    </div>
  )
}
