import { useEffect, useState } from 'react'
import { Radio, Activity, DollarSign, Zap, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getFrequencyReservePlanningDashboard } from '../api/client'
import type { FMRPDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Stacked Bar: Reserve procured_mw by reserve_type per region (2024)
// ---------------------------------------------------------------------------

const RESERVE_COLORS: Record<string, string> = {
  'Contingency Raise': '#6366f1',
  'Contingency Lower': '#22d3ee',
  'Regulation Raise': '#f59e0b',
  'Regulation Lower': '#34d399',
}

function ReserveByRegionChart({ data }: { data: FMRPDashboard }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const reserveTypes = ['Contingency Raise', 'Contingency Lower', 'Regulation Raise', 'Regulation Lower']

  const chartData = regions.map(region => {
    const row: Record<string, string | number> = { region }
    for (const rt of reserveTypes) {
      const total = data.reserves
        .filter(r => r.region === region && r.reserve_type === rt && r.year === 2024)
        .reduce((sum, r) => sum + r.procured_mw, 0)
      row[rt] = Math.round(total)
    }
    return row
  })

  return (
    <ChartCard title="Reserve Procured MW by Type per Region (2024)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {reserveTypes.map(rt => (
            <Bar key={rt} dataKey={rt} stackId="a" fill={RESERVE_COLORS[rt]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Bar: Event severity distribution by event_type
// ---------------------------------------------------------------------------

function EventSeverityChart({ data }: { data: FMRPDashboard }) {
  const eventTypes = ['Under-Frequency', 'Over-Frequency', 'Credible Contingency', 'Non-Credible']
  const severities = ['Minor', 'Moderate', 'Severe']
  const severityColors: Record<string, string> = {
    Minor: '#34d399',
    Moderate: '#f59e0b',
    Severe: '#ef4444',
  }

  const chartData = eventTypes.map(et => {
    const row: Record<string, string | number> = {
      type: et.replace('Credible Contingency', 'Cred. Cont.').replace('Non-Credible', 'Non-Cred.'),
    }
    for (const sev of severities) {
      row[sev] = data.events.filter(e => e.event_type === et && e.severity === sev).length
    }
    return row
  })

  return (
    <ChartCard title="Event Severity Distribution by Event Type">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {severities.map(sev => (
            <Bar key={sev} dataKey={sev} fill={severityColors[sev]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Bar: Provider fcas_capacity_mw sorted desc, coloured by provider_type
// ---------------------------------------------------------------------------

const PROVIDER_TYPE_COLORS: Record<string, string> = {
  Hydro: '#22d3ee',
  Battery: '#a78bfa',
  'Gas Turbine': '#f97316',
  'Demand Response': '#34d399',
  'Wind (Gov)': '#60a5fa',
}

function ProviderCapacityChart({ data }: { data: FMRPDashboard }) {
  const chartData = [...data.providers]
    .sort((a, b) => b.fcas_capacity_mw - a.fcas_capacity_mw)
    .map(p => ({
      name: p.provider_name.replace(' Gas Turbine', ' GT').replace(' Battery Reserve', ' Batt.').replace(' Big Battery', ' BigBatt'),
      capacity: p.fcas_capacity_mw,
      fill: PROVIDER_TYPE_COLORS[p.provider_type] ?? '#9ca3af',
    }))

  return (
    <ChartCard title="Provider FCAS Capacity MW (sorted descending)">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={120} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Bar dataKey="capacity" name="FCAS Capacity (MW)">
            {chartData.map((entry, index) => (
              <rect key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Line: Monthly system_frequency_avg_hz trend 2022-2024 by region
// ---------------------------------------------------------------------------

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#34d399',
  SA1: '#ef4444',
  TAS1: '#22d3ee',
}

function FrequencyTrendChart({ data }: { data: FMRPDashboard }) {
  const years = [2022, 2023, 2024]
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // Build a combined month-year label from year+month (1-4 per year)
  const chartData: Array<Record<string, string | number>> = []
  for (const year of years) {
    for (let month = 1; month <= 4; month++) {
      const label = `${year}-M${month}`
      const row: Record<string, string | number> = { label }
      for (const region of regions) {
        const match = data.trends.find(t => t.region === region && t.year === year && t.month === month)
        if (match) row[region] = match.system_frequency_avg_hz
      }
      chartData.push(row)
    }
  }

  return (
    <ChartCard title="Monthly System Frequency Avg Hz Trend (2022-2024) by Region">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[49.93, 50.07]}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {regions.map(region => (
            <Line
              key={region}
              type="monotone"
              dataKey={region}
              stroke={REGION_COLORS[region]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Bar: Annual FCAS cost per region (2022-2024 grouped)
// ---------------------------------------------------------------------------

const YEAR_COLORS: Record<number, string> = {
  2022: '#6366f1',
  2023: '#f59e0b',
  2024: '#34d399',
}

function AnnualFcasCostChart({ data }: { data: FMRPDashboard }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const years = [2022, 2023, 2024]

  const chartData = regions.map(region => {
    const row: Record<string, string | number> = { region }
    for (const year of years) {
      const cost = data.reserves
        .filter(r => r.region === region && r.year === year)
        .reduce((sum, r) => sum + r.cost_m_aud, 0)
      row[`${year}`] = Math.round(cost * 10) / 10
    }
    return row
  })

  return (
    <ChartCard title="Annual FCAS Cost per Region (M AUD, 2022-2024)">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {years.map(year => (
            <Bar key={year} dataKey={`${year}`} name={`${year}`} fill={YEAR_COLORS[year]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function FrequencyReservePlanningAnalytics() {
  const [data, setData] = useState<FMRPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFrequencyReservePlanningDashboard()
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Frequency Reserve Planning data...
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

  const { summary } = data

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-600">
          <Radio size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Frequency Management Reserve Planning (FMRP)
          </h1>
          <p className="text-sm text-gray-400">
            NEM FCAS procurement, frequency events, provider capacity and reserve trends
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Reserve Procured (2024 avg, MW)"
          value={summary.total_reserve_procured_mw.toLocaleString()}
          sub="Across all regions & types"
          icon={Zap}
          color="bg-indigo-600"
        />
        <KpiCard
          title="Total FCAS Cost (M AUD)"
          value={`$${summary.total_fcas_cost_m_aud.toFixed(1)}M`}
          sub="2022–2024 cumulative"
          icon={DollarSign}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg System Frequency (Hz)"
          value={summary.avg_frequency_hz.toFixed(3)}
          sub="All regions, 2022–2024"
          icon={Activity}
          color="bg-teal-600"
        />
        <KpiCard
          title="Frequency Events (2024)"
          value={`${summary.frequency_events_2024}`}
          sub="Under/Over-frequency & contingency"
          icon={AlertTriangle}
          color="bg-red-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ReserveByRegionChart data={data} />
        <EventSeverityChart data={data} />
        <ProviderCapacityChart data={data} />
        <FrequencyTrendChart data={data} />
        <div className="xl:col-span-2">
          <AnnualFcasCostChart data={data} />
        </div>
      </div>
    </div>
  )
}
