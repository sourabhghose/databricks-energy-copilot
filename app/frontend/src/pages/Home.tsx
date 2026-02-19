import { useLatestPrices } from '../hooks/useMarketData'
import PriceTicker from '../components/PriceTicker'
import { Activity, BarChart2 } from 'lucide-react'

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

// Placeholder sparkline component
function Sparkline({ region }: { region: string }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: 24 }, (_, i) => {
        const height = 20 + Math.sin((i + region.charCodeAt(0)) * 0.8) * 15 + 15
        return (
          <div
            key={i}
            className="w-1 bg-blue-400 rounded-sm opacity-70"
            style={{ height: `${Math.max(4, height)}%` }}
          />
        )
      })}
    </div>
  )
}

function DemandGauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-lg font-bold text-gray-800">{value.toLocaleString()} MW</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>0</span>
        <span>{(max / 1000).toFixed(0)}k MW cap</span>
      </div>
    </div>
  )
}

export default function Home() {
  const { data: prices, loading, error } = useLatestPrices(30_000)

  // Build a price map for easy lookup; fall back to placeholder data
  const priceMap: Record<string, { price: number; trend: 'up' | 'down' | 'flat'; updatedAt: string }> =
    Object.fromEntries(
      prices.map(p => [
        p.region,
        { price: p.price, trend: p.trend as 'up' | 'down' | 'flat', updatedAt: p.updatedAt },
      ])
    )

  const getRegionData = (region: string) =>
    priceMap[region] ?? { price: 0, trend: 'flat' as const, updatedAt: '' }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Executive Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">National Electricity Market — real-time snapshot</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load market data: {error}
        </div>
      )}

      {/* Region price cards */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Spot Prices — All Regions
        </h3>
        {loading && prices.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {REGIONS.map(r => (
              <div key={r} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {REGIONS.map(region => {
              const { price, trend, updatedAt } = getRegionData(region)
              return (
                <PriceTicker
                  key={region}
                  region={region}
                  price={price}
                  trend={trend}
                  updatedAt={updatedAt}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* NEM Demand Summary */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            NEM Demand Summary
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <DemandGauge label="NSW1" value={8_420} max={15_000} />
          <DemandGauge label="QLD1" value={7_150} max={12_000} />
          <DemandGauge label="VIC1" value={5_980} max={11_000} />
          <DemandGauge label="SA1"  value={1_640} max={3_500}  />
          <DemandGauge label="TAS1" value={1_120} max={2_000}  />
          <DemandGauge label="NEM Total" value={24_310} max={43_500} />
        </div>
      </section>

      {/* 24-hr sparklines */}
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
              <div className="text-xs font-medium text-gray-500 mb-2">{region}</div>
              <Sparkline region={region} />
              <div className="text-xs text-gray-400 mt-1">Last 24 hrs</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
