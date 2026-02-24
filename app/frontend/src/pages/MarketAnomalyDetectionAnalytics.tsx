import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, Activity, DollarSign } from 'lucide-react'
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
import { getMarketAnomalyDetectionDashboard } from '../api/client'
import type { NEMADashboard } from '../api/client'

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
// Colour palettes
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#ef4444',
  TAS1: '#06b6d4',
}

const MODEL_REGION_COLORS = ['#3b82f6', '#22c55e', '#f59e0b']

// ---------------------------------------------------------------------------
// Data derivation helpers
// ---------------------------------------------------------------------------

function buildAnomalyTypeData(anomalies: NEMADashboard['anomalies']) {
  const map: Record<string, Record<string, number>> = {}
  for (const a of anomalies) {
    if (!map[a.anomaly_type]) map[a.anomaly_type] = { Low: 0, Medium: 0, High: 0, Critical: 0 }
    map[a.anomaly_type][a.severity] = (map[a.anomaly_type][a.severity] ?? 0) + 1
  }
  return Object.entries(map).map(([name, sev]) => ({ name, ...sev }))
}

function buildPatternData(patterns: NEMADashboard['patterns']) {
  return [...patterns]
    .sort((a, b) => b.frequency_per_year - a.frequency_per_year)
    .map(p => ({ name: p.pattern_name.length > 18 ? p.pattern_name.slice(0, 18) + '…' : p.pattern_name, freq: p.frequency_per_year }))
}

function buildAlertTrendData(alerts: NEMADashboard['alerts']) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const data = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    for (const r of regions) {
      const matching = alerts.filter(a => a.year === 2024 && a.quarter === q && a.region === r)
      row[r] = matching.reduce((sum, a) => sum + a.alerts_triggered, 0)
    }
    return row
  })
  return data
}

function buildModelF1Data(modelPerf: NEMADashboard['model_performance']) {
  const models = Array.from(new Set(modelPerf.map(m => m.model_name)))
  return models.map(mname => {
    const row: Record<string, string | number> = { model: mname.length > 16 ? mname.slice(0, 16) + '…' : mname }
    for (const rec of modelPerf.filter(m => m.model_name === mname)) {
      row[rec.region] = rec.f1_score
    }
    return row
  })
}

function buildFinancialImpactData(anomalies: NEMADashboard['anomalies']) {
  const map: Record<string, number> = {}
  for (const a of anomalies) {
    map[a.region] = (map[a.region] ?? 0) + a.financial_impact_m_aud
  }
  return Object.entries(map).map(([region, impact]) => ({ region, impact: Math.round(impact * 10) / 10 }))
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function MarketAnomalyDetectionAnalytics() {
  const [data, setData] = useState<NEMADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMarketAnomalyDetectionDashboard()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading Market Anomaly Detection data…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Failed to load data: {error}</p>
      </div>
    )
  }

  const { summary } = data
  const anomalyTypeData = buildAnomalyTypeData(data.anomalies)
  const patternData = buildPatternData(data.patterns)
  const alertTrendData = buildAlertTrendData(data.alerts)
  const modelF1Data = buildModelF1Data(data.model_performance)
  const financialData = buildFinancialImpactData(data.anomalies)
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const modelRegions = Array.from(new Set(data.model_performance.map(m => m.region))).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-600 rounded-lg">
          <AlertTriangle size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Market Anomaly Detection</h1>
          <p className="text-sm text-gray-400">NEMA — Sprint 158a analytics dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Anomalies (2024)"
          value={String(summary.total_anomalies_2024)}
          sub="Detected across all regions"
          icon={AlertTriangle}
          color="bg-orange-600"
        />
        <KpiCard
          title="Critical Anomalies (2024)"
          value={String(summary.critical_anomalies_2024)}
          sub="Severity: Critical"
          icon={Activity}
          color="bg-red-600"
        />
        <KpiCard
          title="Total Financial Impact"
          value={`$${summary.total_financial_impact_m_aud.toFixed(1)}M`}
          sub="AUD — all years"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Best Detection Model"
          value={summary.best_detection_model}
          sub="Highest F1 score"
          icon={TrendingUp}
          color="bg-blue-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Anomaly count by type coloured by severity */}
        <ChartCard title="Anomaly Count by Type (all years)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={anomalyTypeData} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ paddingTop: 8 }} />
              {Object.keys(SEVERITY_COLORS).map(sev => (
                <Bar key={sev} dataKey={sev} stackId="a" fill={SEVERITY_COLORS[sev]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Pattern frequency sorted desc */}
        <ChartCard title="Pattern Frequency (per year, sorted)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={patternData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="freq" fill="#6366f1" name="Events/Year" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 3: Monthly alerts trend by region (2024) */}
        <ChartCard title="Quarterly Alerts Triggered by Region (2024)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={alertTrendData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              {regions.map(r => (
                <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLORS[r]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Model F1 score by model (grouped by region) */}
        <ChartCard title="Detection Model F1 Score by Region">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={modelF1Data} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="model" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
              <YAxis domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend wrapperStyle={{ paddingTop: 8 }} />
              {modelRegions.map((region, idx) => (
                <Bar key={region} dataKey={region} fill={MODEL_REGION_COLORS[idx]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Chart 5: Financial impact by region */}
      <ChartCard title="Total Financial Impact by Region (all years, $M AUD)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={financialData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Impact']}
            />
            <Bar dataKey="impact" name="Financial Impact ($M AUD)" radius={[4, 4, 0, 0]}>
              {financialData.map(d => (
                <rect key={d.region} fill={REGION_COLORS[d.region] ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
