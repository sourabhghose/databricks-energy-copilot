import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { GenerationDataPoint } from '../api/client'

export interface GenerationChartProps {
  region: string
  data: GenerationDataPoint[]
}

const FUEL_CONFIG: { key: keyof Omit<GenerationDataPoint, 'timestamp'>; label: string; color: string }[] = [
  { key: 'coal',    label: 'Coal',    color: '#374151' },
  { key: 'gas',     label: 'Gas',     color: '#6B7280' },
  { key: 'hydro',   label: 'Hydro',   color: '#3B82F6' },
  { key: 'wind',    label: 'Wind',    color: '#10B981' },
  { key: 'solar',   label: 'Solar',   color: '#F59E0B' },
  { key: 'battery', label: 'Battery', color: '#8B5CF6' },
]

// Plausible mock data used when the data prop is empty
function buildMockData(): GenerationDataPoint[] {
  const now = Date.now()
  return Array.from({ length: 12 }, (_, i) => ({
    timestamp: new Date(now - (11 - i) * 5 * 60_000).toISOString(),
    coal:    2000 + Math.random() * 200,
    gas:     500  + Math.random() * 100,
    wind:    800  + Math.random() * 200,
    solar:   400  + Math.random() * 80,
    hydro:   300  + Math.random() * 50,
    battery: 50   + Math.random() * 30,
  }))
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
  })
}

// Custom tooltip: shows MW and % of total for each fuel type at that timestamp
interface CustomTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {[...payload].reverse().map(entry => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
        const fuelLabel = FUEL_CONFIG.find(f => f.key === entry.name)?.label ?? entry.name
        return (
          <div key={entry.name} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{fuelLabel}</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-semibold text-gray-800">
                {entry.value.toFixed(0)} MW
              </span>
              <span className="text-gray-400 ml-1">({pct}%)</span>
            </div>
          </div>
        )
      })}
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-gray-500 font-medium">Total</span>
        <span className="font-mono font-semibold text-gray-800">{total.toFixed(0)} MW</span>
      </div>
    </div>
  )
}

export default function GenerationChart({ region, data }: GenerationChartProps) {
  // Fall back to mock data if data prop is empty
  const source = data.length > 0 ? data : buildMockData()

  const chartData = source.map(d => ({
    ...d,
    time: formatTimestamp(d.timestamp),
  }))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        {region} — Generation Mix
      </h3>
      <p className="text-xs text-gray-400 mb-4">Stacked generation by fuel type (MW)</p>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} stackOffset="none">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            interval={Math.max(0, Math.floor(chartData.length / 6))}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
            width={48}
            label={{
              value: 'MW',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: '#9CA3AF' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {FUEL_CONFIG.map(({ key, color }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={color}
              fill={color}
              fillOpacity={0.85}
              strokeWidth={0}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Custom legend with colour swatches below chart */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {FUEL_CONFIG.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
