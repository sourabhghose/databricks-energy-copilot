import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
  })
}

export default function GenerationChart({ region, data }: GenerationChartProps) {
  const chartData = data.map(d => ({
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
            interval={Math.floor(chartData.length / 6)}
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
          <Tooltip
            formatter={(v: number, name: string) => [
              `${v.toFixed(0)} MW`,
              FUEL_CONFIG.find(f => f.key === name)?.label ?? name,
            ]}
            labelFormatter={l => `Time: ${l}`}
          />
          <Legend
            formatter={name =>
              FUEL_CONFIG.find(f => f.key === name)?.label ?? name
            }
          />
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
    </div>
  )
}
