import { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getWindFarmWakeTurbineDashboard,
  WFWTDashboard,
  WFWTFarm,
  WFWTTurbine,
  WFWTPerformance,
  WFWTOptimisation,
  WFWTFault,
} from '../api/client'

// Colour maps
const STATE_COLOUR: Record<string, string> = {
  QLD: '#f59e0b',
  TAS: '#22d3ee',
  NSW: '#6366f1',
  VIC: '#22c55e',
  SA:  '#f97316',
}

const STATUS_COLOUR: Record<string, string> = {
  Applied:  '#22c55e',
  Piloting: '#6366f1',
  Assessed: '#f59e0b',
  Proposed: '#94a3b8',
}

const SEVERITY_COLOUR: Record<string, string> = {
  Critical: '#ef4444',
  Major:    '#f59e0b',
  Minor:    '#6366f1',
}

const LINE_COLOURS = ['#6366f1', '#22d3ee', '#f59e0b', '#22c55e']

export default function WindFarmWakeTurbineAnalytics() {
  const [data, setData] = useState<WFWTDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWindFarmWakeTurbineDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-500">Error: {error}</div>
  if (!data)  return <div className="p-6 text-gray-400">Loading...</div>

  const { farms, turbines, performance, optimisation, faults, summary } = data

  // ----- Chart 1: Farm wake_loss_pct + net_aep_gwh grouped by farm, coloured by state -----
  const chart1Data = farms.map((f: WFWTFarm) => ({
    name:         f.farm_name.replace(' Wind Farm', '').replace(' Wind', '').slice(0, 18),
    wake_loss:    f.wake_loss_pct,
    net_aep:      f.net_aep_gwh,
    state:        f.state,
    stateFill:    STATE_COLOUR[f.state] ?? '#94a3b8',
  }))

  // ----- Chart 2: Turbine capacity_factor_pct by row_position (grouped bar) -----
  const rowPositions = ['Front', 'Middle', 'Rear']
  const turbsByRow: Record<string, WFWTTurbine[]> = { Front: [], Middle: [], Rear: [] }
  turbines.forEach((t: WFWTTurbine) => {
    if (turbsByRow[t.row_position]) turbsByRow[t.row_position].push(t)
  })
  const chart2Data = rowPositions.map((pos) => {
    const group = turbsByRow[pos]
    const avg_cf = group.length
      ? group.reduce((s, t) => s + t.capacity_factor_pct, 0) / group.length
      : 0
    const avg_wake = group.length
      ? group.reduce((s, t) => s + t.wake_exposure_pct, 0) / group.length
      : 0
    return {
      row:     pos,
      avg_cf:  Math.round(avg_cf * 10) / 10,
      avg_wake: Math.round(avg_wake * 10) / 10,
    }
  })

  // ----- Chart 3: Monthly net_output_mwh vs curtailment_mwh trend 2024, top 4 farms -----
  const top4FarmIds = farms
    .slice()
    .sort((a, b) => b.net_aep_gwh - a.net_aep_gwh)
    .slice(0, 4)
    .map((f) => f.farm_id)

  const months2024 = [3, 6, 9, 12]
  const chart3Data = months2024.map((mo) => {
    const row: Record<string, string | number> = { month: `M${mo}` }
    top4FarmIds.forEach((fid) => {
      const rec = performance.find(
        (p: WFWTPerformance) => p.farm_id === fid && p.year === 2024 && p.month === mo,
      )
      const fname = farms.find((f) => f.farm_id === fid)?.farm_name ?? fid
      const label = fname.replace(' Wind Farm', '').replace(' Wind', '').slice(0, 12)
      row[`${label}_net`]    = rec ? rec.net_output_mwh : 0
      row[`${label}_curtail`] = rec ? rec.curtailment_mwh : 0
    })
    return row
  })
  const top4Labels = top4FarmIds.map((fid) => {
    const fname = farms.find((f) => f.farm_id === fid)?.farm_name ?? fid
    return fname.replace(' Wind Farm', '').replace(' Wind', '').slice(0, 12)
  })

  // ----- Chart 4: Optimisation annual_aep_gain_mwh by strategy, coloured by status -----
  const chart4Data = optimisation.map((o: WFWTOptimisation) => ({
    strategy:  o.optimisation_strategy.length > 20
      ? o.optimisation_strategy.slice(0, 20) + '…'
      : o.optimisation_strategy,
    aep_gain:  o.annual_aep_gain_mwh,
    status:    o.status,
    fill:      STATUS_COLOUR[o.status] ?? '#94a3b8',
  }))

  // ----- Chart 5: Fault downtime_hrs by fault_type coloured by severity -----
  const faultByType: Record<string, { total: number; severity: string }> = {}
  faults.forEach((f: WFWTFault) => {
    if (!faultByType[f.fault_type]) {
      faultByType[f.fault_type] = { total: 0, severity: f.severity }
    }
    faultByType[f.fault_type].total += f.downtime_hrs
    // keep worst severity
    const rank: Record<string, number> = { Critical: 3, Major: 2, Minor: 1 }
    if ((rank[f.severity] ?? 0) > (rank[faultByType[f.fault_type].severity] ?? 0)) {
      faultByType[f.fault_type].severity = f.severity
    }
  })
  const chart5Data = Object.entries(faultByType).map(([ft, v]) => ({
    fault_type: ft,
    downtime:   Math.round(v.total * 10) / 10,
    severity:   v.severity,
    fill:       SEVERITY_COLOUR[v.severity] ?? '#94a3b8',
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wind className="w-8 h-8 text-cyan-400" />
        <h1 className="text-2xl font-bold text-white">
          Wind Farm Wake Effect &amp; Turbine Performance Analytics
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Farms</p>
          <p className="text-2xl font-bold text-cyan-400">{summary.total_farms}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Turbines</p>
          <p className="text-2xl font-bold text-indigo-400">{summary.total_turbines}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Avg Wake Loss %</p>
          <p className="text-2xl font-bold text-amber-400">
            {summary.avg_wake_loss_pct.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Net AEP</p>
          <p className="text-2xl font-bold text-green-400">
            {summary.total_net_aep_gwh.toFixed(0)} GWh
          </p>
        </div>
      </div>

      {/* Chart 1: Farm wake loss + net AEP */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-1">
          Farm Wake Loss % vs Net AEP (GWh) — coloured by state
        </h2>
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(STATE_COLOUR).map(([state, colour]) => (
            <span key={state} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded" style={{ background: colour }} />
              {state}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 8, right: 16, bottom: 90, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis yAxisId="left"  tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" label={{ value: 'Wake Loss %', angle: -90, fill: '#9ca3af', fontSize: 10, dx: -12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GWh" label={{ value: 'Net AEP GWh', angle: 90, fill: '#9ca3af', fontSize: 10, dx: 14 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar yAxisId="left"  dataKey="wake_loss" name="Wake Loss %" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, idx) => (
                <Cell key={idx} fill={entry.stateFill} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="net_aep" name="Net AEP (GWh)" fill="#22d3ee" opacity={0.6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Turbine capacity factor + wake exposure by row position */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Avg Capacity Factor % &amp; Wake Exposure % by Row Position (Front / Middle / Rear)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart2Data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="row" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar dataKey="avg_cf"   name="Avg Capacity Factor %" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="avg_wake" name="Avg Wake Exposure %"   fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Monthly net output + curtailment trend 2024 top 4 farms */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Monthly Net Output &amp; Curtailment (MWh) — 2024, Top 4 Farms
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart3Data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" width={80} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
            {top4Labels.map((label, idx) => (
              <Line
                key={`${label}_net`}
                type="monotone"
                dataKey={`${label}_net`}
                name={`${label} net`}
                stroke={LINE_COLOURS[idx]}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {top4Labels.map((label, idx) => (
              <Line
                key={`${label}_curtail`}
                type="monotone"
                dataKey={`${label}_curtail`}
                name={`${label} curtail`}
                stroke={LINE_COLOURS[idx]}
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Optimisation AEP gain by strategy */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-1">
          Optimisation Annual AEP Gain (MWh) by Strategy — coloured by status
        </h2>
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(STATUS_COLOUR).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded" style={{ background: colour }} />
              {status}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart4Data} margin={{ top: 8, right: 16, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="strategy"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="aep_gain" name="AEP Gain (MWh)" radius={[4, 4, 0, 0]}>
              {chart4Data.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Fault downtime by fault type */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-1">
          Total Fault Downtime (hrs) by Fault Type — coloured by max severity
        </h2>
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(SEVERITY_COLOUR).map(([sev, colour]) => (
            <span key={sev} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded" style={{ background: colour }} />
              {sev}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart5Data} margin={{ top: 8, right: 16, bottom: 60, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="fault_type"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" hrs" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="downtime" name="Downtime (hrs)" radius={[4, 4, 0, 0]}>
              {chart5Data.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
