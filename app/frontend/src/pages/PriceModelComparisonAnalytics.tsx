import { useEffect, useState, useMemo } from 'react'
import { Cpu } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getPriceModelComparisonDashboard,
  PMCDashboard,
  PMCModelRecord,
  PMCAccuracyRecord,
  PMCCommercialUseRecord,
  PMCBacktestRecord,
} from '../api/client'

// ── Colour maps ───────────────────────────────────────────────────────────────

const FAMILY_BADGE: Record<string, string> = {
  STATISTICAL:   'bg-blue-700 text-blue-100',
  ML:            'bg-emerald-700 text-emerald-100',
  DEEP_LEARNING: 'bg-purple-700 text-purple-100',
  HYBRID:        'bg-amber-700 text-amber-100',
  FUNDAMENTAL:   'bg-rose-700 text-rose-100',
  EXPERT_SYSTEM: 'bg-slate-600 text-slate-100',
}

const COMPLEXITY_BADGE: Record<string, string> = {
  LOW:       'bg-green-800 text-green-200',
  MEDIUM:    'bg-yellow-700 text-yellow-100',
  HIGH:      'bg-orange-700 text-orange-100',
  VERY_HIGH: 'bg-red-700 text-red-100',
}

const ACCURACY_BADGE: Record<string, string> = {
  HIGH:   'bg-green-800 text-green-200',
  MEDIUM: 'bg-yellow-700 text-yellow-100',
  LOW:    'bg-red-800 text-red-200',
}

const CATEGORY_COLORS: Record<string, string> = {
  DEMAND:     '#3b82f6',
  GENERATION: '#10b981',
  WEATHER:    '#f59e0b',
  FUEL:       '#ef4444',
  CALENDAR:   '#a855f7',
  MARKET:     '#06b6d4',
}

const MODEL_COLORS: Record<string, string> = {
  M001: '#f59e0b',
  M002: '#10b981',
  M003: '#3b82f6',
  M004: '#a855f7',
  M005: '#ef4444',
  M006: '#06b6d4',
  M007: '#f97316',
  M008: '#8b5cf6',
}

const SCENARIO_COLORS: Record<string, string> = {
  NORMAL:         '#6b7280',
  HIGH_VRE:       '#10b981',
  PRICE_SPIKE:    '#ef4444',
  MARKET_STRESS:  '#a855f7',
  NEGATIVE_PRICE: '#3b82f6',
}

const REGIONS = ['NSW', 'VIC', 'QLD', 'SA', 'WA']

// ── Helpers ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ── Section: Model Registry ───────────────────────────────────────────────────

function ModelRegistry({ models }: { models: PMCModelRecord[] }) {
  return (
    <div>
      <SectionTitle title="Model Registry" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Family</th>
              <th className="py-2 pr-4">Algorithm</th>
              <th className="py-2 pr-4">Complexity</th>
              <th className="py-2 pr-4">Horizon (hrs)</th>
              <th className="py-2 pr-4">Compute (min)</th>
              <th className="py-2 pr-4">Training Freq</th>
              <th className="py-2 pr-4">Vendor</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.model_id} className="border-b border-gray-800 hover:bg-gray-750">
                <td className="py-2 pr-4 font-mono text-gray-400">{m.model_id}</td>
                <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">{m.model_name}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${FAMILY_BADGE[m.model_family] ?? 'bg-gray-700 text-gray-200'}`}>
                    {m.model_family}
                  </span>
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">{m.algorithm}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${COMPLEXITY_BADGE[m.model_complexity] ?? 'bg-gray-700 text-gray-200'}`}>
                    {m.model_complexity}
                  </span>
                </td>
                <td className="py-2 pr-4 text-center">{m.forecast_horizon_hrs}</td>
                <td className="py-2 pr-4 text-center">{m.compute_time_mins.toFixed(1)}</td>
                <td className="py-2 pr-4">{m.training_frequency}</td>
                <td className="py-2 pr-4 text-gray-400">{m.commercial_vendor ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Accuracy Comparison ─────────────────────────────────────────────

function AccuracyComparison({
  accuracy,
  models,
}: {
  accuracy: PMCAccuracyRecord[]
  models: PMCModelRecord[]
}) {
  const [selectedRegion, setSelectedRegion] = useState('NSW')
  const [selectedYear, setSelectedYear] = useState(2024)

  const chartData = useMemo(() => {
    const filtered = accuracy.filter(
      (a) => a.region === selectedRegion && a.year === selectedYear,
    )
    return models.map((m) => {
      const rec = filtered.find((a) => a.model_id === m.model_id)
      return {
        name: m.model_name.length > 14 ? m.model_name.slice(0, 14) + '…' : m.model_name,
        MAE: rec?.mae ?? 0,
        RMSE: rec?.rmse ?? 0,
        'Spike Det %': rec?.spike_detection_rate_pct ?? 0,
        model_id: m.model_id,
      }
    })
  }, [accuracy, models, selectedRegion, selectedYear])

  return (
    <div>
      <SectionTitle title="Accuracy Comparison — MAE / RMSE by Model" />
      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-400 mr-2">Region</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mr-2">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
          >
            {[2023, 2024].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="MAE" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="RMSE" fill="#a855f7" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Spike detection sub-chart */}
      <p className="text-xs text-gray-400 mt-5 mb-2">Spike Detection Rate (%)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
          />
          <Bar dataKey="Spike Det %" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Section: Commercial Applications ─────────────────────────────────────────

function CommercialApplications({ uses }: { uses: PMCCommercialUseRecord[] }) {
  return (
    <div>
      <SectionTitle title="Commercial Applications" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="py-2 pr-4">Use Case</th>
              <th className="py-2 pr-4">Preferred Model Family</th>
              <th className="py-2 pr-4">Accuracy Req.</th>
              <th className="py-2 pr-4">Horizon (hrs)</th>
              <th className="py-2 pr-4">Est. Annual Value ($M)</th>
              <th className="py-2 pr-4">Adoption (%)</th>
            </tr>
          </thead>
          <tbody>
            {uses.map((u) => (
              <tr key={u.use_case} className="border-b border-gray-800 hover:bg-gray-750">
                <td className="py-2 pr-4 font-medium text-white">{u.use_case.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${FAMILY_BADGE[u.preferred_model_family] ?? 'bg-gray-700 text-gray-200'}`}>
                    {u.preferred_model_family}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACCURACY_BADGE[u.accuracy_requirement] ?? 'bg-gray-700 text-gray-200'}`}>
                    {u.accuracy_requirement}
                  </span>
                </td>
                <td className="py-2 pr-4 text-center">
                  {u.horizon_needed_hrs >= 8760
                    ? `${(u.horizon_needed_hrs / 8760).toFixed(0)}yr`
                    : u.horizon_needed_hrs >= 168
                    ? `${(u.horizon_needed_hrs / 168).toFixed(0)}wk`
                    : `${u.horizon_needed_hrs}h`}
                </td>
                <td className="py-2 pr-4 text-emerald-400 font-medium">
                  ${u.annual_value_m.toFixed(0)}M
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${u.adoption_pct}%` }}
                      />
                    </div>
                    <span>{u.adoption_pct.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section: Feature Importance ───────────────────────────────────────────────

function FeatureImportanceChart({
  featureImportance,
  models,
}: {
  featureImportance: { model_id: string; feature: string; importance_pct: number; feature_category: string }[]
  models: PMCModelRecord[]
}) {
  // Build stacked bar data — one bar per model, stacked by feature_category
  const categories = Array.from(new Set(featureImportance.map((f) => f.feature_category)))

  const chartData = useMemo(() => {
    return models.map((m) => {
      const feats = featureImportance.filter((f) => f.model_id === m.model_id)
      const row: Record<string, string | number> = {
        name: m.model_name.length > 12 ? m.model_name.slice(0, 12) + '…' : m.model_name,
      }
      categories.forEach((cat) => {
        const total = feats
          .filter((f) => f.feature_category === cat)
          .reduce((s, f) => s + f.importance_pct, 0)
        row[cat] = parseFloat(total.toFixed(1))
      })
      return row
    })
  }, [featureImportance, models, categories])

  return (
    <div>
      <SectionTitle title="Feature Importance by Model (Stacked)" />
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 110]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {categories.map((cat) => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] ?? '#6b7280'} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Section: Backtest Rankings ────────────────────────────────────────────────

function BacktestRankings({
  backtests,
  models,
}: {
  backtests: PMCBacktestRecord[]
  models: PMCModelRecord[]
}) {
  const [selectedScenario, setSelectedScenario] = useState('PRICE_SPIKE')
  const scenarios = Array.from(new Set(backtests.map((b) => b.scenario)))

  const filtered = useMemo(
    () => backtests.filter((b) => b.scenario === selectedScenario),
    [backtests, selectedScenario],
  )

  // one row per model — pick first matching record
  const rows = useMemo(() => {
    return models.map((m) => {
      const rec = filtered.find((b) => b.model_id === m.model_id)
      return { model: m, rec }
    })
  }, [models, filtered])

  return (
    <div>
      <SectionTitle title="Backtest Rankings by Scenario" />
      <div className="mb-4">
        <label className="text-xs text-gray-400 mr-2">Scenario</label>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
        >
          {scenarios.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <tr>
              <th className="py-2 pr-4">Rank</th>
              <th className="py-2 pr-4">Model</th>
              <th className="py-2 pr-4">Family</th>
              <th className="py-2 pr-4">Region</th>
              <th className="py-2 pr-4">MAE Normal</th>
              <th className="py-2 pr-4">MAE Spike</th>
              <th className="py-2 pr-4">MAE Negative</th>
              <th className="py-2 pr-4">Period</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.rec)
              .sort((a, b) => (a.rec?.overall_rank ?? 99) - (b.rec?.overall_rank ?? 99))
              .map(({ model: m, rec: b }) => (
                <tr key={m.model_id} className="border-b border-gray-800 hover:bg-gray-750">
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        b!.overall_rank === 1
                          ? 'bg-amber-500 text-black'
                          : b!.overall_rank === 2
                          ? 'bg-gray-400 text-black'
                          : b!.overall_rank === 3
                          ? 'bg-orange-700 text-white'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      #{b!.overall_rank}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-medium text-white">{m.model_name}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${FAMILY_BADGE[m.model_family] ?? 'bg-gray-700 text-gray-200'}`}>
                      {m.model_family}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{b!.region}</td>
                  <td className="py-2 pr-4 text-blue-300">{b!.mae_normal.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-red-400">{b!.mae_spike.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-cyan-400">{b!.mae_negative.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-gray-400">{b!.backtest_period}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* scenario colour legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {scenarios.map((s) => (
          <span key={s} className="flex items-center gap-1 text-xs text-gray-400">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: SCENARIO_COLORS[s] ?? '#6b7280' }}
            />
            {s.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PriceModelComparisonAnalytics() {
  const [data, setData] = useState<PMCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPriceModelComparisonDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Price Model Comparison data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="p-6 space-y-10 text-white bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Cpu className="w-7 h-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Market Price Forecasting Model Comparison Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Comparing statistical, ML, deep-learning, fundamental and hybrid forecasting approaches
            across accuracy metrics, feature drivers, and commercial applications.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Best MAE Model" value={String(summary.best_model_mae)} />
        <KpiCard label="Best Spike Model" value={String(summary.best_spike_model).replace('_', ' ')} />
        <KpiCard
          label="Avg MAE (all models)"
          value={`$${Number(summary.avg_mae_all_models).toFixed(1)}/MWh`}
        />
        <KpiCard
          label="Spike Detection Leader"
          value={`${Number(summary.spike_detection_leader_pct).toFixed(1)}%`}
        />
        <KpiCard
          label="Commercial Adoption"
          value={`${Number(summary.commercial_adoption_pct).toFixed(1)}%`}
        />
        <KpiCard
          label="Annual Forecast Value"
          value={`$${Number(summary.annual_forecast_value_m).toLocaleString()}M`}
        />
      </div>

      {/* Model Registry */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <ModelRegistry models={data.models} />
      </div>

      {/* Accuracy Comparison */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <AccuracyComparison accuracy={data.accuracy} models={data.models} />
      </div>

      {/* Commercial Applications */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <CommercialApplications uses={data.commercial_uses} />
      </div>

      {/* Feature Importance */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <FeatureImportanceChart
          featureImportance={data.feature_importance}
          models={data.models}
        />
      </div>

      {/* Backtest Rankings */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <BacktestRankings backtests={data.backtests} models={data.models} />
      </div>

      {/* Model family legend */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Model Family Legend</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(FAMILY_BADGE).map(([fam, cls]) => (
            <span key={fam} className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
              {fam}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Model colours (charts): ARIMA-GARCH=amber, XGBoost=emerald, LSTM=blue, Prophet=purple,
          Dispatch Sim=red, Ensemble=cyan, SARIMA-GARCH=orange, Transformer=violet.
        </p>
      </div>
    </div>
  )
}
