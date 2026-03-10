import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, Zap, Cpu, RefreshCw, Wifi } from 'lucide-react'
import { networkOpsApi, AssetLoading, VoltageEvent, PowerQuality } from '../api/client'

type Tab = 'loading' | 'voltage' | 'power_quality'

interface Summary {
  total_assets: number
  overloaded_count: number
  excursions_today: number
  total_der_mw: number
}

function getUtilizationColor(pct: number): string {
  if (pct > 95) return 'text-red-400'
  if (pct >= 80) return 'text-red-300'
  if (pct >= 60) return 'text-amber-400'
  return 'text-green-400'
}

function getUtilizationBadge(pct: number): JSX.Element {
  if (pct > 95) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
        CRITICAL
      </span>
    )
  }
  if (pct >= 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/40 text-red-400 border border-red-800">
        OVERLOAD
      </span>
    )
  }
  if (pct >= 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-900/40 text-amber-400 border border-amber-800">
        HIGH
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-900/40 text-green-400 border border-green-800">
      NORMAL
    </span>
  )
}

function getExcursionFlag(excursion_type: string): JSX.Element {
  const isOver = excursion_type?.toLowerCase().includes('over')
  const isUnder = excursion_type?.toLowerCase().includes('under')
  if (isOver) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/50 text-red-300 border border-red-700">
        <AlertTriangle className="w-3 h-3" />
        OVERVOLTAGE
      </span>
    )
  }
  if (isUnder) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-900/50 text-amber-300 border border-amber-700">
        <AlertTriangle className="w-3 h-3" />
        UNDERVOLTAGE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/50 text-blue-300 border border-blue-700">
      {excursion_type ?? 'UNKNOWN'}
    </span>
  )
}

function UtilizationBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  let barColor = 'bg-green-500'
  if (pct > 95) barColor = 'bg-red-500'
  else if (pct >= 80) barColor = 'bg-red-400'
  else if (pct >= 60) barColor = 'bg-amber-400'

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${barColor} ${pct > 95 ? 'animate-pulse' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold ${getUtilizationColor(pct)}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

export default function NetworkOperations() {
  const [activeTab, setActiveTab] = useState<Tab>('loading')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [assets, setAssets] = useState<AssetLoading[]>([])
  const [excursions, setExcursions] = useState<VoltageEvent[]>([])
  const [powerQuality, setPowerQuality] = useState<PowerQuality[]>([])
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchSummary = async () => {
    try {
      const data = await networkOpsApi.summary()
      setSummary(data)
    } catch {
      // non-fatal
    }
  }

  const fetchTabData = async (tab: Tab) => {
    setTabLoading(true)
    try {
      if (tab === 'loading') {
        const data = await networkOpsApi.loading()
        setAssets(data.assets ?? [])
      } else if (tab === 'voltage') {
        const data = await networkOpsApi.voltage()
        setExcursions(data.excursions ?? [])
      } else if (tab === 'power_quality') {
        const data = await networkOpsApi.powerQuality()
        setPowerQuality(data.metrics ?? [])
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data')
    } finally {
      setTabLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)
      await Promise.all([fetchSummary(), fetchTabData('loading')])
      setLoading(false)
    }
    init()
  }, [])

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab)
    await fetchTabData(tab)
  }

  const handleRefresh = async () => {
    setError(null)
    await Promise.all([fetchSummary(), fetchTabData(activeTab)])
    setLastRefresh(new Date())
  }

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'loading', label: 'Loading Dashboard', icon: <Activity className="w-4 h-4" /> },
    { key: 'voltage', label: 'Voltage Monitor', icon: <Zap className="w-4 h-4" /> },
    { key: 'power_quality', label: 'Power Quality', icon: <Wifi className="w-4 h-4" /> },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Network Operations</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time distribution network monitoring</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="text-gray-400 text-sm">Loading network data...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Network Operations</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time distribution network monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Total Assets</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-100">
            {summary?.total_assets?.toLocaleString() ?? '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Monitored substations</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Overloaded</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">
            {summary?.overloaded_count?.toLocaleString() ?? '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Assets above 80% utilisation</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Excursions Today</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {summary?.excursions_today?.toLocaleString() ?? '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Voltage excursion events</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wide">Total DER</span>
            <Activity className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            {summary?.total_der_mw != null
              ? `${summary.total_der_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`
              : '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Distributed energy resources</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {tabLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-gray-400 text-sm">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Loading Dashboard Tab */}
            {activeTab === 'loading' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr className="bg-gray-900/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Asset Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Region
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        DNSP
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        MW
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Nameplate (MVA)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Utilisation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {assets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No asset loading data available
                        </td>
                      </tr>
                    ) : (
                      assets.map((asset, idx) => (
                        <tr
                          key={idx}
                          className={`bg-gray-800 hover:bg-gray-750 transition-colors ${
                            asset.utilization_pct > 95 ? 'border-l-2 border-red-500' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-100">
                            {asset.asset_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">
                              {asset.region}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{asset.dnsp}</td>
                          <td className="px-4 py-3 text-sm text-gray-300 text-right font-mono">
                            {asset.mw?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300 text-right font-mono">
                            {asset.nameplate_rating_mva?.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <UtilizationBar pct={asset.utilization_pct} />
                          </td>
                          <td className="px-4 py-3">
                            {getUtilizationBadge(asset.utilization_pct)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Voltage Monitor Tab */}
            {activeTab === 'voltage' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr className="bg-gray-900/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Monitoring Point
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Voltage (kV)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Nominal (kV)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Deviation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Excursion Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {excursions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No voltage excursion events found
                        </td>
                      </tr>
                    ) : (
                      excursions.map((evt, idx) => {
                        const deviation =
                          evt.nominal_kv && evt.voltage_kv
                            ? (((evt.voltage_kv - evt.nominal_kv) / evt.nominal_kv) * 100).toFixed(
                                2
                              )
                            : null
                        const isPositive = deviation != null && parseFloat(deviation) > 0
                        return (
                          <tr
                            key={idx}
                            className="bg-gray-800 hover:bg-gray-750 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-100 font-mono">
                              {evt.monitoring_point_id}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-300">
                              {evt.voltage_kv?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-gray-400">
                              {evt.nominal_kv?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              {deviation != null ? (
                                <span
                                  className={
                                    isPositive ? 'text-red-400' : 'text-amber-400'
                                  }
                                >
                                  {isPositive ? '+' : ''}
                                  {deviation}%
                                </span>
                              ) : (
                                <span className="text-gray-500">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {getExcursionFlag(evt.excursion_type)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                              {evt.interval_datetime
                                ? new Date(evt.interval_datetime).toLocaleString()
                                : '--'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Power Quality Tab */}
            {activeTab === 'power_quality' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr className="bg-gray-900/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Monitoring Point
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Region
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        THD (%)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Flicker (Pst)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Unbalance (%)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        THD Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {powerQuality.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                          No power quality metrics available
                        </td>
                      </tr>
                    ) : (
                      powerQuality.map((pq, idx) => {
                        const thdExceeds = pq.thd_pct != null && pq.thd_pct > 5
                        const flickerExceeds = pq.flicker_pst != null && pq.flicker_pst > 1
                        const unbalanceExceeds =
                          pq.unbalance_pct != null && pq.unbalance_pct > 2
                        return (
                          <tr
                            key={idx}
                            className="bg-gray-800 hover:bg-gray-750 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-100 font-mono">
                              {pq.monitoring_point_id ?? pq.asset_name ?? '--'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {pq.region ? (
                                <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">
                                  {pq.region}
                                </span>
                              ) : (
                                '--'
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              <span className={thdExceeds ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                                {pq.thd_pct?.toFixed(2) ?? '--'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              <span
                                className={flickerExceeds ? 'text-amber-400 font-semibold' : 'text-gray-300'}
                              >
                                {pq.flicker_pst?.toFixed(3) ?? '--'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              <span
                                className={
                                  unbalanceExceeds ? 'text-amber-400 font-semibold' : 'text-gray-300'
                                }
                              >
                                {pq.unbalance_pct?.toFixed(2) ?? '--'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {thdExceeds ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/50 text-red-300 border border-red-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  EXCEEDS LIMIT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-900/40 text-green-400 border border-green-800">
                                  COMPLIANT
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                              {pq.interval_datetime
                                ? new Date(pq.interval_datetime).toLocaleString()
                                : '--'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Legend */}
      {activeTab === 'loading' && (
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span className="font-medium text-gray-400">Utilisation legend:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            &lt;60% Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            60–80% High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            80–95% Overload
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            &gt;95% Critical
          </span>
        </div>
      )}
      {activeTab === 'power_quality' && (
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span className="font-medium text-gray-400">Thresholds:</span>
          <span>THD &gt; 5% — non-compliant</span>
          <span>Flicker Pst &gt; 1.0 — non-compliant</span>
          <span>Voltage unbalance &gt; 2% — non-compliant</span>
        </div>
      )}
    </div>
  )
}
