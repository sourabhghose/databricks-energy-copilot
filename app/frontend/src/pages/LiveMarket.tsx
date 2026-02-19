import { useState } from 'react'
import GenerationChart from '../components/GenerationChart'
import InterconnectorMap from '../components/InterconnectorMap'
import type { GenerationDataPoint, InterconnectorFlow } from '../api/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

// --- Placeholder data ---
function makePlaceholderGeneration(): GenerationDataPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const base = new Date()
    base.setMinutes(base.getMinutes() - (11 - i) * 5)
    return {
      timestamp: base.toISOString(),
      coal:    2200 + Math.random() * 200,
      gas:     800  + Math.random() * 150,
      hydro:   400  + Math.random() * 100,
      wind:    600  + Math.random() * 300,
      solar:   i < 4 ? 100 + i * 80 : 500 - (i - 4) * 40,
      battery: 50   + Math.random() * 50,
    }
  })
}

function makePlaceholderInterconnectors(): InterconnectorFlow[] {
  return [
    { id: 'QNI',       from: 'QLD1', to: 'NSW1', flowMw:  320, limitMw:  1078 },
    { id: 'VIC1-NSW1', from: 'VIC1', to: 'NSW1', flowMw: -150, limitMw:  1600 },
    { id: 'V-SA',      from: 'VIC1', to: 'SA1',  flowMw:  200, limitMw:   600 },
    { id: 'V-TAS',     from: 'VIC1', to: 'TAS1', flowMw:  -80, limitMw:   594 },
    { id: 'Murraylink', from: 'VIC1', to: 'SA1', flowMw:   90, limitMw:   220 },
  ]
}

function makePlaceholderPriceChart() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    price: 60 + Math.sin(i * 0.5) * 40 + Math.random() * 20,
  }))
}

export default function LiveMarket() {
  const [region, setRegion] = useState('NSW1')

  const genData = makePlaceholderGeneration()
  const interconnectors = makePlaceholderInterconnectors()
  const priceData = makePlaceholderPriceChart()

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Live Market</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time NEM generation, prices, and interconnector flows</p>
        </div>
        {/* Region selector */}
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {REGIONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Price chart */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {region} — Spot Price (last 24 hrs)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={3} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={v => `$${v.toFixed(0)}`}
              width={55}
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}/MWh`, 'Spot Price']}
              labelFormatter={l => `Time: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Generation chart */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <GenerationChart region={region} data={genData} />
      </section>

      {/* Interconnector map */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Interconnector Flows</h3>
        <InterconnectorMap flows={interconnectors} />
      </section>
    </div>
  )
}
