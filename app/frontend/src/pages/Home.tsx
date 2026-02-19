import { useMemo, useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { Activity, BarChart2, Clock, Zap } from 'lucide-react'
import { useLatestPrices, usePriceHistory } from '../hooks/useMarketData'
import PriceTicker from '../components/PriceTicker'
import { api, MarketSummaryRecord } from '../api/client'

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
type Region = typeof REGIONS[number]

// ---------------------------------------------------------------------------
// Plausible mock data — shown when the API is unavailable
// ---------------------------------------------------------------------------

const MOCK_PRICES = [
  { region: 'NSW1', price:  72.50, trend: 'up'   as const, updatedAt: new Date().toISOString(), avg_demand_mw: 8_420, peak_demand_mw:  9_100 },
  { region: 'QLD1', price:  65.30, trend: 'flat' as const, updatedAt: new Date().toISOString(), avg_demand_mw: 7_150, peak_demand_mw:  7_900 },
  { region: 'VIC1', price:  55.80, trend: 'down' as const, updatedAt: new Date().toISOString(), avg_demand_mw: 5_980, peak_demand_mw:  6_700 },
  { region: 'SA1',  price:  88.10, trend: 'up'   as const, updatedAt: new Date().toISOString(), avg_demand_mw: 1_640, peak_demand_mw:  1_950 },
  { region: 'TAS1', price:  42.00, trend: 'flat' as const, updatedAt: new Date().toISOString(), avg_demand_mw: 1_120, peak_demand_mw:  1_280 },
]

// Demand capacity caps per region (approximate NEM values)
const REGION_CAPACITY: Record<Region, number> = {
  NSW1: 15_000,
  QLD1: 12_000,
  VIC1: 11_000,
  SA1:   3_500,
  TAS1:  2_000,
}

// ---------------------------------------------------------------------------
// Generate synthetic 24-hr sparkline data for a region when API is down
// ---------------------------------------------------------------------------
function buildMockSparkline(region: string): { price: number }[] {
  const seed = region.charCodeAt(0)
  return Array.from({ length: 288 }, (_, i) => ({
    price: Math.max(10, 60 + Math.sin((i + seed) * 0.18) * 30 + Math.random() * 15),
  }))
}

// ---------------------------------------------------------------------------
// 24-hr price sparkline — Recharts LineChart 120×40, no axes
// ---------------------------------------------------------------------------
function RegionSparkline({ region }: { region: string }) {
  const now   = useMemo(() => new Date(), [])
  const end   = useMemo(() => now.toISOString(), [now])
  const start = useMemo(
    () => new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
    [now]
  )

  const { data: history, loading } = usePriceHistory(region, start, end)

  const sparkData = useMemo(() => {
    const source = history.length > 0
      ? history.map(p => ({ price: p.price }))
      : buildMockSparkline(region)
    // Down-sample to at most 96 points for smooth rendering
    const step = Math.max(1, Math.floor(source.length / 96))
    return source.filter((_, i) => i % step === 0)
  }, [history, region])

  if (loading && history.length === 0) {
    return (
      <div
        className="rounded bg-gray-100 animate-pulse"
        style={{ width: 120, height: 40 }}
        aria-label="Loading sparkline"
      />
    )
  }

  return (
    <ResponsiveContainer width={120} height={40}>
      <LineChart data={sparkData}>
        <Line
          type="monotone"
          dataKey="price"
          stroke="#3B82F6"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Demand card — shows avg + peak demand for a region
// ---------------------------------------------------------------------------
interface DemandCardProps {
  region: Region
  avgDemandMw: number
  peakDemandMw: number
}

function DemandCard({ region, avgDemandMw, peakDemandMw }: DemandCardProps) {
  const capacity = REGION_CAPACITY[region]
  const pct = Math.min(100, (avgDemandMw / capacity) * 100)
  const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {region}
        </span>
        <span className="text-base font-bold text-gray-800 tabular-nums">
          {avgDemandMw.toLocaleString()} MW
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
        <span>Avg demand</span>
        <span>Peak: {peakDemandMw.toLocaleString()} MW</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Daily AI Market Summary widget
// ---------------------------------------------------------------------------
function MarketSummaryWidget() {
  const [summary, setSummary] = useState<MarketSummaryRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getMarketSummary()
      .then(data => {
        if (!cancelled) {
          setSummary(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-56 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-400 italic">Summary unavailable</p>
      </div>
    )
  }

  const wordCount = summary.word_count ?? 0
  const formattedDate = new Date(summary.summary_date).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Australia/Sydney',
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Widget header */}
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Daily AI Market Summary</h3>
          <p className="text-xs text-gray-400 mt-0.5">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Word count badge */}
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
            {wordCount.toLocaleString()} words
          </span>
          {/* Model ID badge */}
          <span className="text-xs text-gray-400 font-mono">{summary.model_id}</span>
        </div>
      </div>

      {/* Narrative text */}
      <div className="max-h-48 overflow-y-auto">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {summary.narrative}
        </p>
      </div>

      {/* Attribution footer */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
        <Zap size={12} className="text-amber-500" />
        <span className="text-xs text-gray-400">Powered by Claude Sonnet 4.5</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Home() {
  const { data: apiPrices, loading, error } = useLatestPrices(30_000)

  // Merge API prices with mock data structure.
  // The RegionPrice interface from client.ts does not include demand fields,
  // so we fall back to MOCK_PRICES for demand values when the API is down,
  // or use a static demand figure alongside real prices.
  const regionData = useMemo(() => {
    if (apiPrices.length > 0) {
      return REGIONS.map(region => {
        const live  = apiPrices.find(p => p.region === region)
        const mock  = MOCK_PRICES.find(p => p.region === region)!
        return {
          region,
          price:         live?.price       ?? mock.price,
          trend:         (live?.trend ?? mock.trend) as 'up' | 'down' | 'flat',
          updatedAt:     live?.updatedAt   ?? mock.updatedAt,
          avg_demand_mw: mock.avg_demand_mw,   // demand not in current API shape
          peak_demand_mw: mock.peak_demand_mw,
        }
      })
    }
    // API is unavailable — use full mock set
    return MOCK_PRICES.map(p => ({
      region: p.region,
      price: p.price,
      trend: p.trend,
      updatedAt: p.updatedAt,
      avg_demand_mw: p.avg_demand_mw,
      peak_demand_mw: p.peak_demand_mw,
    }))
  }, [apiPrices])

  // Timestamp of the most recent update across all regions
  const lastUpdated = useMemo(() => {
    const timestamps = regionData
      .map(r => r.updatedAt)
      .filter(Boolean)
      .map(t => new Date(t).getTime())
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps))
  }, [regionData])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Executive Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            National Electricity Market — real-time snapshot
          </p>
        </div>
        {/* Last updated timestamp — top right */}
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <Clock size={12} />
            <span>
              Last updated{' '}
              {lastUpdated.toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Australia/Sydney',
              })}{' '}
              AEST
            </span>
          </div>
        )}
      </div>

      {/* Error banner — displayed only when API is unavailable */}
      {error && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <span className="font-semibold">API unavailable</span>
          <span className="text-amber-600">— showing indicative mock data. {error}</span>
        </div>
      )}

      {/* Region price cards */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Spot Prices — All Regions
        </h3>
        {loading && apiPrices.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {REGIONS.map(r => (
              <div key={r} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {regionData.map(({ region, price, trend, updatedAt }) => (
              <PriceTicker
                key={region}
                region={region}
                price={price}
                trend={trend}
                updatedAt={updatedAt}
              />
            ))}
          </div>
        )}
      </section>

      {/* Daily AI Market Summary widget */}
      <section>
        <MarketSummaryWidget />
      </section>

      {/* NEM Demand Summary — one card per region */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            NEM Demand Summary
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {regionData.map(({ region, avg_demand_mw, peak_demand_mw }) => (
            <DemandCard
              key={region}
              region={region as Region}
              avgDemandMw={avg_demand_mw}
              peakDemandMw={peak_demand_mw}
            />
          ))}
        </div>
      </section>

      {/* 24-hr sparklines — one per region */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            24-Hour Price Trend
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {REGIONS.map(region => (
            <div key={region} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-xs font-medium text-gray-600 mb-1">{region}</div>
              <RegionSparkline region={region} />
              <div className="text-xs text-gray-400 mt-1">Last 24 hrs</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
