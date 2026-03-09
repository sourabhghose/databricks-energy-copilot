import { useState, useEffect, useCallback } from 'react'
import { signalsApi, TradingSignal, SignalPerformance } from '../api/client'

const SIGNAL_COLORS: Record<string, string> = {
  FORWARD_MISPRICING: '#3B82F6',
  SPOT_ARBITRAGE: '#10B981',
  CONSTRAINT_PLAY: '#F59E0B',
  WEATHER_SHIFT: '#EAB308',
  DEMAND_SURGE: '#EF4444',
  VOLATILITY_REGIME: '#8B5CF6',
  RENEWABLE_SHORTFALL: '#06B6D4',
  PEAK_SPREAD: '#EC4899',
}

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const SIGNAL_TYPES = Object.keys(SIGNAL_COLORS)

export default function TradingSignals() {
  const [signals, setSignals] = useState<TradingSignal[]>([])
  const [stats, setStats] = useState<{ total_active: number; total_opportunity_aud: number; avg_confidence: number; best_rr: number }>({ total_active: 0, total_opportunity_aud: 0, avg_confidence: 0, best_rr: 0 })
  const [perf, setPerf] = useState<SignalPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [regionFilter, setRegionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [confFilter, setConfFilter] = useState(0)
  const [tab, setTab] = useState<'signals' | 'performance' | 'config'>('signals')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [executeModal, setExecuteModal] = useState<TradingSignal | null>(null)
  const [winRate, setWinRate] = useState(0)

  const fetchSignals = useCallback(async () => {
    try {
      const filters: Record<string, string | number> = {}
      if (regionFilter) filters.region = regionFilter
      if (typeFilter) filters.signal_type = typeFilter
      if (confFilter > 0) filters.min_confidence = confFilter
      const data = await signalsApi.list(filters as any)
      setSignals(data.signals || [])
      const best = data.signals?.reduce((max, s) => s.reward_risk_ratio > max ? s.reward_risk_ratio : max, 0) || 0
      const totalOpp = data.signals?.reduce((sum, s) => sum + s.expected_profit_aud, 0) || 0
      const avgConf = data.signals?.length ? data.signals.reduce((sum, s) => sum + s.confidence, 0) / data.signals.length : 0
      setStats({ total_active: data.count || 0, total_opportunity_aud: totalOpp, avg_confidence: avgConf, best_rr: best })
    } catch {
      setSignals([])
    }
    setLoading(false)
  }, [regionFilter, typeFilter, confFilter])

  const fetchPerf = useCallback(async () => {
    try {
      const data = await signalsApi.performance()
      setPerf(data.performance || [])
      const totalExec = data.performance?.reduce((s, p) => s + p.executed, 0) || 0
      const totalClosed = data.performance?.reduce((s, p) => s + p.executed + p.expired + p.dismissed, 0) || 1
      setWinRate(totalExec / totalClosed)
    } catch {
      setPerf([])
    }
  }, [])

  useEffect(() => { fetchSignals(); fetchPerf() }, [fetchSignals, fetchPerf])

  const handleScan = async () => {
    setScanning(true)
    try {
      const data = await signalsApi.scan(regionFilter || undefined)
      setSignals(data.signals || [])
      await fetchSignals()
    } catch { /* noop */ }
    setScanning(false)
  }

  const handleExecute = async (sig: TradingSignal) => {
    try {
      await signalsApi.execute(sig.signal_id)
      setExecuteModal(null)
      fetchSignals()
    } catch { /* noop */ }
  }

  const handleDismiss = async (id: string) => {
    try {
      await signalsApi.dismiss(id)
      fetchSignals()
    } catch { /* noop */ }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trading Signals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered algorithmic trading opportunities across the NEM</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {scanning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Scanning...
            </>
          ) : 'Scan Now'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200">
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200">
          <option value="">All Types</option>
          {SIGNAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={confFilter} onChange={e => setConfFilter(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-gray-200">
          <option value={0}>Min Confidence: Any</option>
          <option value={0.5}>50%+</option>
          <option value={0.7}>70%+</option>
          <option value={0.8}>80%+</option>
          <option value={0.9}>90%+</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active Signals</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.total_active}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Opportunity</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(stats.total_opportunity_aud)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Best Reward/Risk</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.best_rr.toFixed(1)}x</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Win Rate</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{(winRate * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['signals', 'performance', 'config'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t === 'signals' ? 'Active Signals' : t === 'performance' ? 'Performance' : 'Config'}
          </button>
        ))}
      </div>

      {/* Signals Tab */}
      {tab === 'signals' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading signals...</div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No active signals. Click "Scan Now" to detect opportunities.</div>
          ) : (
            signals.map(sig => (
              <div key={sig.signal_id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => toggleExpand(sig.signal_id)}>
                  {/* Type badge */}
                  <span className="shrink-0 px-2 py-1 rounded text-[10px] font-bold text-white uppercase"
                    style={{ backgroundColor: SIGNAL_COLORS[sig.signal_type] || '#6B7280' }}>
                    {sig.signal_type.replace(/_/g, ' ')}
                  </span>
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white">{sig.region}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${sig.direction === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {sig.direction === 'BUY' ? '\u2191' : '\u2193'} {sig.direction}
                      </span>
                      <span className="text-xs text-gray-500">{sig.suggested_trade_type} {sig.suggested_profile}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>Profit: <span className="text-green-600 font-medium">{fmt(sig.expected_profit_aud)}</span></span>
                      <span>Risk: <span className="text-red-500 font-medium">{fmt(sig.risk_aud)}</span></span>
                      <span>R/R: <span className="font-medium text-gray-700 dark:text-gray-300">{sig.reward_risk_ratio.toFixed(1)}x</span></span>
                      <span>{sig.suggested_volume_mw} MW @ ${sig.suggested_price.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="shrink-0 w-20 text-right">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{(sig.confidence * 100).toFixed(0)}%</div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                      <div className="h-full rounded-full" style={{ width: `${sig.confidence * 100}%`, backgroundColor: sig.confidence > 0.8 ? '#10B981' : sig.confidence > 0.6 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                  </div>
                </div>

                {/* Expanded rationale */}
                {expanded.has(sig.signal_id) && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="mt-3 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                      dangerouslySetInnerHTML={{ __html: sig.rationale.replace(/### /g, '<h4>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                    <div className="flex gap-2 mt-4">
                      <button onClick={(e) => { e.stopPropagation(); setExecuteModal(sig) }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                        Execute Trade
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDismiss(sig.signal_id) }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Performance Tab */}
      {tab === 'performance' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Signal Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Executed</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Win Rate</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Expected P&L</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Avg Confidence</th>
              </tr>
            </thead>
            <tbody>
              {perf.map(p => (
                <tr key={p.signal_type} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                      style={{ backgroundColor: SIGNAL_COLORS[p.signal_type] || '#6B7280' }}>
                      {p.signal_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.total_signals}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{p.executed}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.win_rate > 0.5 ? 'text-green-600' : 'text-red-500'}>{(p.win_rate * 100).toFixed(0)}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{fmt(p.total_expected_profit)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{(p.avg_confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Config Tab */}
      {tab === 'config' && <ConfigPanel />}

      {/* Execute Modal */}
      {executeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setExecuteModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Execute Trade from Signal</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium text-gray-900 dark:text-white">{executeModal.suggested_trade_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Region</span><span className="font-medium text-gray-900 dark:text-white">{executeModal.region}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Direction</span><span className={`font-bold ${executeModal.direction === 'BUY' ? 'text-green-600' : 'text-red-500'}`}>{executeModal.direction}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Volume</span><span className="font-medium text-gray-900 dark:text-white">{executeModal.suggested_volume_mw} MW</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="font-medium text-gray-900 dark:text-white">${executeModal.suggested_price.toFixed(2)}/MWh</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Profile</span><span className="font-medium text-gray-900 dark:text-white">{executeModal.suggested_profile}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Period</span><span className="font-medium text-gray-900 dark:text-white">{executeModal.suggested_start_date} to {executeModal.suggested_end_date}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Expected Profit</span><span className="font-bold text-green-600">{fmt(executeModal.expected_profit_aud)}</span></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => handleExecute(executeModal)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
                Confirm & Create Trade
              </button>
              <button onClick={() => setExecuteModal(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigPanel() {
  const [config, setConfig] = useState<Record<string, { value: unknown }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    signalsApi.config().then(d => { setConfig(d.config || {}); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const update = async (key: string, val: unknown) => {
    try {
      await signalsApi.updateConfig(key, { value: val })
      setConfig(prev => ({ ...prev, [key]: { value: val } }))
    } catch { /* noop */ }
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Loading config...</div>

  const maxPos = (config.max_position_mw as any)?.value ?? 100
  const maxVar = (config.max_var_impact_aud as any)?.value ?? 500000
  const minConf = (config.min_confidence as any)?.value ?? 0.5

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Risk Limits Configuration</h3>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Position (MW): {maxPos}</label>
          <input type="range" min={10} max={500} step={10} value={maxPos}
            onChange={e => update('max_position_mw', Number(e.target.value))}
            className="w-full accent-blue-600" />
          <div className="flex justify-between text-xs text-gray-400"><span>10</span><span>500</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max VaR Impact (AUD): ${(maxVar / 1000).toFixed(0)}k</label>
          <input type="range" min={50000} max={2000000} step={50000} value={maxVar}
            onChange={e => update('max_var_impact_aud', Number(e.target.value))}
            className="w-full accent-blue-600" />
          <div className="flex justify-between text-xs text-gray-400"><span>$50k</span><span>$2M</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Confidence: {(minConf * 100).toFixed(0)}%</label>
          <input type="range" min={0.3} max={0.95} step={0.05} value={minConf}
            onChange={e => update('min_confidence', Number(e.target.value))}
            className="w-full accent-blue-600" />
          <div className="flex justify-between text-xs text-gray-400"><span>30%</span><span>95%</span></div>
        </div>
      </div>
    </div>
  )
}
