import { useState, useEffect } from 'react'
import { Leaf, DollarSign, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { environmentalsApi } from '../api/client'
import type { EnvironmentalHolding, CertificateBalance } from '../api/client'

const tooltipStyle = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }
const tooltipLabelStyle = { color: '#d1d5db' }
const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ef4444']

const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`

export default function EnvironmentalsDashboard() {
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState<Record<string, { held: number; committed: number; total_value: number }>>({})
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [carbonSummary, setCarbonSummary] = useState({ total_annual_tco2: 0, estimated_cost_aud: 0 })
  const [balances, setBalances] = useState<CertificateBalance[]>([])
  const [holdings, setHoldings] = useState<EnvironmentalHolding[]>([])
  const [showPpa, setShowPpa] = useState(false)
  const [ppaResult, setPpaResult] = useState<{ energy_npv: number; lgc_npv: number; total_npv: number; bundled_premium_pct: number } | null>(null)
  const [ppaStrike, setPpaStrike] = useState(55)
  const [ppaVolume, setPpaVolume] = useState(100)
  const [ppaTech, setPpaTech] = useState('solar_utility')
  const [ppaRegion, setPpaRegion] = useState('NSW1')

  async function loadData() {
    setLoading(true)
    try {
      const dash = await environmentalsApi.dashboard()
      setPosition(dash.certificate_position || {})
      setPrices(dash.market_prices || {})
      setCarbonSummary(dash.carbon_exposure_summary || { total_annual_tco2: 0, estimated_cost_aud: 0 })
      setBalances(dash.balances || [])

      const port = await environmentalsApi.portfolio()
      setHoldings(port.holdings || [])
    } catch (e) { console.error('Environmentals load error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function runPpaValuation() {
    try {
      const res = await environmentalsApi.valueBundledPpa({
        strike_price: ppaStrike, volume_mw: ppaVolume, technology: ppaTech, region: ppaRegion, term_years: 10,
      })
      setPpaResult(res)
    } catch (e) { console.error('PPA valuation error:', e) }
  }

  const certTypes = Object.keys(position)
  const pieData = certTypes.map(ct => ({ name: ct, value: position[ct]?.held || 0 }))

  const liabilityData = balances.map(b => ({
    name: `${b.certificate_type} ${b.vintage_year}`,
    closing: b.closing_balance,
    liability: b.liability,
    surplus: b.surplus_deficit,
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Leaf className="w-8 h-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Environmentals Dashboard</h1>
            <p className="text-gray-400 text-sm">LGC / ACCU / STC portfolio & carbon exposure</p>
          </div>
        </div>
        <button onClick={loadData} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Certificate Position Cards */}
      <div className="grid grid-cols-3 gap-4">
        {certTypes.map((ct, i) => (
          <div key={ct} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-bold text-white">{ct}</span>
              <span className="text-green-400 text-sm">${prices[ct]?.toFixed(2) || '—'}/cert</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Held</span><span className="text-white">{(position[ct]?.held || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Committed</span><span className="text-yellow-400">{(position[ct]?.committed || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Value</span><span className="text-blue-400">{fmt(position[ct]?.total_value || 0)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Carbon Exposure + Pie */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Carbon Exposure</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Annual Emissions</span>
              <span className="text-white text-xl font-bold">{(carbonSummary.total_annual_tco2 / 1000).toFixed(0)}k tCO2e</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Estimated Cost</span>
              <span className="text-red-400 text-xl font-bold">{fmt(carbonSummary.estimated_cost_aud)}</span>
            </div>
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm">Based on $32/tCO2 carbon price assumption</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Holdings by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value.toLocaleString()}`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liability Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">Certificate Balances vs Liabilities</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={liabilityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Legend />
            <Bar dataKey="closing" name="Closing Balance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="liability" name="Liability" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="surplus" name="Surplus/Deficit" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bundled PPA Valuation */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Bundled PPA Valuation (Electricity + LGCs)</h3>
          <button onClick={() => setShowPpa(!showPpa)} className="text-blue-400 hover:text-blue-300 text-sm">
            {showPpa ? 'Hide' : 'Show'} Valuation Tool
          </button>
        </div>
        {showPpa && (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-gray-400 text-xs">Strike ($/MWh)</label>
                <input type="number" value={ppaStrike} onChange={e => setPpaStrike(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs">Volume (MW)</label>
                <input type="number" value={ppaVolume} onChange={e => setPpaVolume(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs">Technology</label>
                <select value={ppaTech} onChange={e => setPpaTech(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="solar_utility">Solar</option>
                  <option value="wind">Wind</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs">Region</label>
                <select value={ppaRegion} onChange={e => setPpaRegion(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                  {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={runPpaValuation} className="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 text-sm">Value PPA</button>
              </div>
            </div>
            {ppaResult && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-xs">Energy NPV</p>
                  <p className="text-white text-lg font-bold">{fmt(ppaResult.energy_npv)}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-xs">LGC NPV</p>
                  <p className="text-green-400 text-lg font-bold">{fmt(ppaResult.lgc_npv)}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-xs">Total NPV</p>
                  <p className="text-blue-400 text-lg font-bold">{fmt(ppaResult.total_npv)}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-xs">Bundled Premium</p>
                  <p className="text-purple-400 text-lg font-bold">{ppaResult.bundled_premium_pct.toFixed(1)}%</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Holdings Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">Certificate Holdings</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Vintage</th>
              <th className="py-2 px-3 text-right">Quantity</th>
              <th className="py-2 px-3 text-right">Unit Price</th>
              <th className="py-2 px-3 text-right">Total Value</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Acquired</th>
            </tr>
          </thead>
          <tbody>
            {holdings.slice(0, 20).map((h, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 text-white font-medium">{h.certificate_type}</td>
                <td className="py-2 px-3 text-gray-400">{h.vintage_year}</td>
                <td className="py-2 px-3 text-right text-white">{h.quantity?.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-gray-400">${h.unit_price?.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-blue-400">{fmt(h.total_value || 0)}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${h.status === 'HELD' ? 'bg-green-500/20 text-green-400' : h.status === 'COMMITTED' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {h.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500 text-xs">{h.acquired_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
