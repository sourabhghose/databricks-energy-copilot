import { useState, useEffect } from 'react'
import { Sun, Battery, Car, Zap, AlertTriangle, CheckCircle, TrendingDown, Activity } from 'lucide-react'
import { derApi, DERInstallation, HostingCapacity, CurtailmentEvent, VPPDispatch, DOECompliance } from '../api/client'

type Tab = 'fleet' | 'hosting' | 'curtailment' | 'vpp' | 'doe'

interface DERSummary {
  solar_mw: number
  battery_mw: number
  ev_count: number
  curtailment_today_mwh: number
}

interface CurtailmentImpact {
  total_mwh: number
  total_aud: number
  event_count: number
}

function KPICard({ icon, label, value, unit, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  unit: string
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-gray-100 text-xl font-bold mt-0.5">
          {typeof value === 'number' ? value.toLocaleString() : value}
          <span className="text-gray-400 text-sm font-normal ml-1">{unit}</span>
        </p>
      </div>
    </div>
  )
}

function TechBadge({ technology }: { technology: string }) {
  const colors: Record<string, string> = {
    solar: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
    battery: 'bg-blue-900 text-blue-300 border border-blue-700',
    ev_charger: 'bg-green-900 text-green-300 border border-green-700',
  }
  const labels: Record<string, string> = {
    solar: 'Solar',
    battery: 'Battery',
    ev_charger: 'EV Charger',
  }
  const cls = colors[technology] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {labels[technology] ?? technology}
    </span>
  )
}

function CapacityBar({ pct }: { pct: number }) {
  const color = pct > 50 ? 'bg-red-500' : pct > 20 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[80px]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${
        pct > 50 ? 'text-red-400' : pct > 20 ? 'text-amber-400' : 'text-green-400'
      }`}>{pct.toFixed(1)}%</span>
    </div>
  )
}

function ComplianceDot({ rate }: { rate: number }) {
  const color = rate >= 90 ? 'text-green-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400'
  return <span className={`font-semibold ${color}`}>{rate.toFixed(1)}%</span>
}

function ResponseGauge({ accuracy }: { accuracy: number }) {
  const color = accuracy >= 90 ? 'text-green-400' : accuracy >= 70 ? 'text-amber-400' : 'text-red-400'
  const barColor = accuracy >= 90 ? 'bg-green-500' : accuracy >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[80px]">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(accuracy, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium w-10 text-right ${color}`}>{accuracy.toFixed(1)}%</span>
    </div>
  )
}

export default function DERManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('fleet')
  const [summary, setSummary] = useState<DERSummary | null>(null)
  const [fleet, setFleet] = useState<DERInstallation[]>([])
  const [hosting, setHosting] = useState<HostingCapacity[]>([])
  const [curtailment, setCurtailment] = useState<CurtailmentEvent[]>([])
  const [curtailmentImpact, setCurtailmentImpact] = useState<CurtailmentImpact | null>(null)
  const [vpp, setVpp] = useState<VPPDispatch[]>([])
  const [doe, setDoe] = useState<DOECompliance[]>([])
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await derApi.summary()
        setSummary(data)
      } catch {
        setSummary({ solar_mw: 0, battery_mw: 0, ev_count: 0, curtailment_today_mwh: 0 })
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  useEffect(() => {
    const fetchTab = async () => {
      setTabLoading(true)
      try {
        if (activeTab === 'fleet') {
          const res = await derApi.fleet()
          setFleet(res?.fleet ?? (Array.isArray(res) ? res : []))
        } else if (activeTab === 'hosting') {
          const res = await derApi.hostingCapacity()
          setHosting(res?.feeders ?? (Array.isArray(res) ? res : []))
        } else if (activeTab === 'curtailment') {
          const [evtRes, impactRes] = await Promise.all([
            derApi.curtailment(),
            derApi.curtailmentImpact(),
          ])
          setCurtailment(evtRes?.curtailment ?? (Array.isArray(evtRes) ? evtRes : []))
          setCurtailmentImpact({
            total_mwh: impactRes?.total_curtailed_mwh ?? 0,
            total_aud: impactRes?.total_lost_value_aud ?? 0,
            event_count: impactRes?.total_events ?? 0,
          })
        } else if (activeTab === 'vpp') {
          const res = await derApi.vpp()
          setVpp(res?.events ?? (Array.isArray(res) ? res : []))
        } else if (activeTab === 'doe') {
          const res = await derApi.doeCompliance()
          setDoe(res?.feeders ?? (Array.isArray(res) ? res : []))
        }
      } catch {
        // silently handle — tables will show empty
      } finally {
        setTabLoading(false)
      }
    }
    fetchTab()
  }, [activeTab])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fleet', label: 'Fleet Dashboard' },
    { key: 'hosting', label: 'Hosting Capacity' },
    { key: 'curtailment', label: 'Curtailment Analytics' },
    { key: 'vpp', label: 'VPP Performance' },
    { key: 'doe', label: 'DOE Compliance' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">DER Management</h1>
        <p className="text-gray-400 text-sm mt-1">
          Distributed energy resources, hosting capacity &amp; VPP performance
        </p>
      </div>

      {/* KPI Summary */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<Sun size={18} className="text-yellow-300" />}
            label="Solar Capacity"
            value={summary?.solar_mw?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'}
            unit="MW"
            color="bg-yellow-900"
          />
          <KPICard
            icon={<Battery size={18} className="text-blue-300" />}
            label="Battery Capacity"
            value={summary?.battery_mw?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'}
            unit="MW"
            color="bg-blue-900"
          />
          <KPICard
            icon={<Car size={18} className="text-green-300" />}
            label="EV Chargers"
            value={summary?.ev_count ?? '—'}
            unit="units"
            color="bg-green-900"
          />
          <KPICard
            icon={<TrendingDown size={18} className="text-red-300" />}
            label="Curtailment Today"
            value={summary?.curtailment_today_mwh?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'}
            unit="MWh"
            color="bg-red-900"
          />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tabLoading ? (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex items-center justify-center h-48">
          <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
        </div>
      ) : (
        <>
          {/* Fleet Dashboard */}
          {activeTab === 'fleet' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h2 className="text-gray-100 font-semibold mb-4 flex items-center gap-2">
                <Zap size={16} className="text-blue-400" />
                DER Fleet by Zone &amp; Technology
              </h2>
              {fleet.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No fleet data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Zone / Substation</th>
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Technology</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Installations</th>
                        <th className="text-right text-gray-400 font-medium py-2">Total Capacity (kW)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map((row, i) => (
                        <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                          <td className="py-2 pr-4 text-gray-200 font-medium">{row.zone_substation ?? '—'}</td>
                          <td className="py-2 pr-4">
                            <TechBadge technology={row.technology ?? ''} />
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-300">
                            {(row.install_count ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-gray-300">
                            {(row.total_capacity_kw ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Hosting Capacity */}
          {activeTab === 'hosting' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h2 className="text-gray-100 font-semibold mb-1 flex items-center gap-2">
                <Activity size={16} className="text-green-400" />
                Feeder Hosting Capacity
              </h2>
              <p className="text-gray-500 text-xs mb-4">
                Used % = dynamic capacity utilised. Green &gt;50% remaining, amber 20–50%, red &lt;20%
              </p>
              {hosting.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No hosting capacity data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Feeder ID</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Static kW</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Dynamic kW</th>
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Limiting Constraint</th>
                        <th className="text-left text-gray-400 font-medium py-2 min-w-[160px]">Used %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hosting.map((row, i) => {
                        const cap = row.dynamic_capacity_kw && row.dynamic_capacity_kw > 0
                          ? row.dynamic_capacity_kw
                          : row.static_capacity_kw ?? 1
                        const used = row.static_capacity_kw && cap > 0
                          ? Math.max(0, Math.min(100, ((cap - (row.dynamic_capacity_kw ?? cap)) / cap) * 100))
                          : 0
                        // If we have explicit used_pct field, prefer it
                        const usedPct = (row as any).used_pct != null ? (row as any).used_pct : used
                        return (
                          <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                            <td className="py-2 pr-4 text-gray-200 font-medium">{row.feeder_id ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-gray-300">
                              {(row.static_capacity_kw ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300">
                              {(row.dynamic_capacity_kw ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 pr-4 text-gray-400 text-xs">{row.limiting_constraint ?? '—'}</td>
                            <td className="py-2">
                              <CapacityBar pct={usedPct} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Curtailment Analytics */}
          {activeTab === 'curtailment' && (
            <div className="space-y-4">
              {/* Impact KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs mb-1">Total Curtailed</p>
                  <p className="text-gray-100 text-xl font-bold">
                    {curtailmentImpact?.total_mwh != null
                      ? curtailmentImpact.total_mwh.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : '—'}
                    <span className="text-gray-400 text-sm font-normal ml-1">MWh</span>
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs mb-1">Revenue Impact</p>
                  <p className="text-gray-100 text-xl font-bold">
                    {curtailmentImpact?.total_aud != null
                      ? `$${curtailmentImpact.total_aud.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : '—'}
                    <span className="text-gray-400 text-sm font-normal ml-1">AUD</span>
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs mb-1">Events</p>
                  <p className="text-gray-100 text-xl font-bold">
                    {curtailmentImpact?.event_count != null
                      ? curtailmentImpact.event_count.toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Curtailment Events Table */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h2 className="text-gray-100 font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  Curtailment Events
                </h2>
                {curtailment.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No curtailment events found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left text-gray-400 font-medium py-2 pr-4">Device / Zone</th>
                          <th className="text-left text-gray-400 font-medium py-2 pr-4">Start Time</th>
                          <th className="text-left text-gray-400 font-medium py-2 pr-4">Duration</th>
                          <th className="text-right text-gray-400 font-medium py-2 pr-4">Curtailed (kWh)</th>
                          <th className="text-left text-gray-400 font-medium py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curtailment.map((row, i) => (
                          <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                            <td className="py-2 pr-4 text-gray-200 font-medium">
                              {(row as any).device_id ?? (row as any).zone ?? '—'}
                            </td>
                            <td className="py-2 pr-4 text-gray-300 text-xs">
                              {(row as any).start_time ?? '—'}
                            </td>
                            <td className="py-2 pr-4 text-gray-300 text-xs">
                              {(row as any).duration_min != null
                                ? `${(row as any).duration_min} min`
                                : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right text-amber-300 font-medium">
                              {(row as any).curtailed_kwh != null
                                ? (row as any).curtailed_kwh.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                : '—'}
                            </td>
                            <td className="py-2 text-gray-400 text-xs">
                              {(row as any).reason ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VPP Performance */}
          {activeTab === 'vpp' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h2 className="text-gray-100 font-semibold mb-4 flex items-center gap-2">
                <Zap size={16} className="text-purple-400" />
                VPP Dispatch Events
              </h2>
              {vpp.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No VPP dispatch data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Dispatch ID</th>
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Event Time</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Dispatched (kW)</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Delivered (kW)</th>
                        <th className="text-left text-gray-400 font-medium py-2 min-w-[160px]">Response Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vpp.map((row, i) => {
                        const accuracy = (row as any).response_accuracy_pct
                          ?? ((row as any).delivered_kw != null && (row as any).dispatched_kw != null && (row as any).dispatched_kw > 0
                            ? ((row as any).delivered_kw / (row as any).dispatched_kw) * 100
                            : 0)
                        return (
                          <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                            <td className="py-2 pr-4 text-gray-200 font-medium text-xs">
                              {(row as any).dispatch_id ?? `EVT-${i + 1}`}
                            </td>
                            <td className="py-2 pr-4 text-gray-300 text-xs">
                              {(row as any).event_time ?? (row as any).dispatch_time ?? '—'}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300">
                              {(row as any).dispatched_kw != null
                                ? (row as any).dispatched_kw.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300">
                              {(row as any).delivered_kw != null
                                ? (row as any).delivered_kw.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                : '—'}
                            </td>
                            <td className="py-2">
                              <ResponseGauge accuracy={accuracy} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DOE Compliance */}
          {activeTab === 'doe' && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h2 className="text-gray-100 font-semibold mb-1 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                DOE Compliance by Feeder
              </h2>
              <p className="text-gray-500 text-xs mb-4">
                Green ≥90%, amber 70–90%, red &lt;70%
              </p>
              {doe.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No compliance data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 font-medium py-2 pr-4">Feeder ID</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Total Devices</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Compliant</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Non-Compliant</th>
                        <th className="text-right text-gray-400 font-medium py-2 pr-4">Compliance Rate</th>
                        <th className="text-left text-gray-400 font-medium py-2">Last Checked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doe.map((row, i) => {
                        const rate = (row as any).compliance_rate_pct
                          ?? ((row as any).compliant_count != null && (row as any).total_devices != null && (row as any).total_devices > 0
                            ? ((row as any).compliant_count / (row as any).total_devices) * 100
                            : 0)
                        const nonCompliant = (row as any).non_compliant_count
                          ?? ((row as any).total_devices != null && (row as any).compliant_count != null
                            ? (row as any).total_devices - (row as any).compliant_count
                            : '—')
                        return (
                          <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                            <td className="py-2 pr-4 text-gray-200 font-medium">{(row as any).feeder_id ?? '—'}</td>
                            <td className="py-2 pr-4 text-right text-gray-300">
                              {(row as any).total_devices != null
                                ? (row as any).total_devices.toLocaleString()
                                : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right text-green-400">
                              {(row as any).compliant_count != null
                                ? (row as any).compliant_count.toLocaleString()
                                : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right text-red-400">
                              {typeof nonCompliant === 'number' ? nonCompliant.toLocaleString() : nonCompliant}
                            </td>
                            <td className="py-2 pr-4 text-right">
                              <ComplianceDot rate={rate} />
                            </td>
                            <td className="py-2 text-gray-400 text-xs">
                              {(row as any).last_checked ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
