import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Activity,
  Zap,
  MapPin,
  Clock,
  Users,
  TrendingDown,
  DollarSign,
  BarChart2,
  RefreshCw,
} from 'lucide-react'
import { outagesApi, OutageEvent, ReliabilityKPI, GSLTracking } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SummaryData {
  active_outages: number
  saidi_ytd: number
  saidi_target: number
  saidi_pct_of_target: number
  worst_region: string
  timestamp: string
}

interface CauseRow {
  cause_code: string
  event_count: number
  total_affected: number
  avg_duration_min: number
}

interface WorstFeeder {
  feeder_id: string
  zone_substation: string
  region: string
  outage_count: number
  total_affected: number
  total_minutes: number
}

type TabId = 'reliability' | 'causes' | 'feeders' | 'gsl'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CAUSE_COLORS: Record<string, string> = {
  vegetation: 'bg-green-500/20 text-green-400 border border-green-500/30',
  equipment_failure: 'bg-red-500/20 text-red-400 border border-red-500/30',
  weather: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  animal: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  third_party: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

function causeClass(code: string): string {
  return CAUSE_COLORS[code.toLowerCase()] ?? CAUSE_COLORS.unknown
}

function causeLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtTime(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Summary KPI bar -------------------------------------------------------
function SummaryBar({ data }: { data: SummaryData | null }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  const saidiPct = Math.min((data.saidi_ytd / data.saidi_target) * 100, 120)
  const saidiOver = data.saidi_ytd > data.saidi_target
  const saidiLabel = `${data.saidi_ytd.toFixed(1)} / ${data.saidi_target.toFixed(1)} min`

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Active outages */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Active Outages</span>
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-gray-100">{data.active_outages}</span>
          {data.active_outages > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* SAIDI YTD */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">SAIDI YTD</span>
          <Activity className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-sm font-semibold text-gray-100 mb-1">{saidiLabel}</div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${saidiOver ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(saidiPct, 100)}%` }}
          />
        </div>
        <div className={`text-xs mt-1 ${saidiOver ? 'text-red-400' : 'text-green-400'}`}>
          {saidiOver ? `${(data.saidi_ytd - data.saidi_target).toFixed(1)} min over target` : `${(data.saidi_target - data.saidi_ytd).toFixed(1)} min under target`}
        </div>
      </div>

      {/* SAIFI */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">SAIFI YTD</span>
          <Zap className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="text-3xl font-bold text-gray-100">
          {data.saidi_pct_of_target.toFixed(0)}
          <span className="text-sm text-gray-400 ml-1">%</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">of AER SAIDI target</div>
      </div>

      {/* Worst region */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Worst Region</span>
          <MapPin className="w-4 h-4 text-orange-400" />
        </div>
        <div className="text-2xl font-bold text-orange-400">{data.worst_region || '—'}</div>
        <div className="text-xs text-gray-400 mt-1">Highest SAIDI deviation</div>
      </div>
    </div>
  )
}

// Active outages panel --------------------------------------------------
function ActiveOutagesPanel({ outages, loading }: { outages: OutageEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (outages.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center py-10">
        <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-green-400 font-medium">No active outages</p>
        <p className="text-gray-400 text-sm">All feeders operating normally</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Active Outages
          <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/30">
            {outages.length}
          </span>
        </h2>
      </div>
      <div className="divide-y divide-gray-700">
        {outages.map((o) => (
          <div key={o.event_id} className="px-4 py-3 hover:bg-gray-750 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-1 w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-100">{o.feeder_id}</span>
                    <span className="text-xs text-gray-400">{o.zone_substation}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${causeClass(o.cause_code)}`}>
                      {causeLabel(o.cause_code)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {o.affected_customers.toLocaleString()} customers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Started {fmtTime(o.start_time)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {o.region}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-gray-400">ETR</div>
                <div className="text-sm font-semibold text-amber-400">
                  {o.etr_minutes > 0 ? `${o.etr_minutes} min` : 'Unknown'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Reliability tracker tab -----------------------------------------------
function ReliabilityTab({ kpis, loading }: { kpis: ReliabilityKPI[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    )
  }
  if (kpis.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">No reliability data available.</p>
  }
  return (
    <div className="space-y-3">
      {kpis.map((k) => {
        const saidiPct = Math.min((k.saidi_minutes / k.aer_target_saidi) * 100, 130)
        const saifiPct = Math.min((k.saifi_count / k.aer_target_saifi) * 100, 130)
        const saidiOver = k.saidi_minutes > k.aer_target_saidi
        const saifiOver = k.saifi_count > k.aer_target_saifi
        return (
          <div key={`${k.region}-${k.period_type}`} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-100">{k.region}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-600 text-gray-300 rounded">{k.period_type}</span>
              </div>
              <span className="text-xs text-gray-400">CAIDI {k.caidi_minutes.toFixed(1)} min</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* SAIDI */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">SAIDI</span>
                  <span className={saidiOver ? 'text-red-400' : 'text-green-400'}>
                    {k.saidi_minutes.toFixed(1)} / {k.aer_target_saidi.toFixed(1)} min
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${saidiOver ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(saidiPct, 100)}%` }}
                  />
                </div>
              </div>
              {/* SAIFI */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">SAIFI</span>
                  <span className={saifiOver ? 'text-red-400' : 'text-green-400'}>
                    {k.saifi_count.toFixed(2)} / {k.aer_target_saifi.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${saifiOver ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(saifiPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Cause breakdown tab ---------------------------------------------------
function CausesTab({ causes, loading }: { causes: CauseRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    )
  }
  if (causes.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">No cause data available.</p>
  }
  const maxCount = Math.max(...causes.map((c) => c.event_count), 1)
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
            <th className="text-left py-2 pr-4 font-medium">Cause</th>
            <th className="text-right py-2 px-4 font-medium">Events</th>
            <th className="text-right py-2 px-4 font-medium">Customers</th>
            <th className="text-right py-2 pl-4 font-medium">Avg Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {causes.map((c) => (
            <tr key={c.cause_code} className="hover:bg-gray-700/40 transition-colors">
              <td className="py-3 pr-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${causeClass(c.cause_code)}`}>
                  {causeLabel(c.cause_code)}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-24 bg-gray-700 rounded-full h-1.5 hidden md:block">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${(c.event_count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-100 font-medium tabular-nums">{c.event_count}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-gray-300 tabular-nums">
                {c.total_affected.toLocaleString()}
              </td>
              <td className="py-3 pl-4 text-right text-gray-300 tabular-nums">
                {c.avg_duration_min.toFixed(0)} min
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Worst feeders tab -----------------------------------------------------
function WorstFeedersTab({ feeders, loading }: { feeders: WorstFeeder[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>
    )
  }
  if (feeders.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">No feeder data available.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
            <th className="text-left py-2 pr-4 font-medium">#</th>
            <th className="text-left py-2 pr-4 font-medium">Feeder</th>
            <th className="text-left py-2 pr-4 font-medium">Zone Substation</th>
            <th className="text-left py-2 pr-4 font-medium">Region</th>
            <th className="text-right py-2 px-4 font-medium">Outages</th>
            <th className="text-right py-2 px-4 font-medium">Customers</th>
            <th className="text-right py-2 pl-4 font-medium">Total Min</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {feeders.map((f, idx) => (
            <tr key={f.feeder_id} className="hover:bg-gray-700/40 transition-colors">
              <td className="py-3 pr-4">
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? 'bg-red-500/20 text-red-400'
                      : idx === 1
                      ? 'bg-orange-500/20 text-orange-400'
                      : idx === 2
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-gray-600 text-gray-400'
                  }`}
                >
                  {idx + 1}
                </span>
              </td>
              <td className="py-3 pr-4 font-medium text-gray-100">{f.feeder_id}</td>
              <td className="py-3 pr-4 text-gray-300">{f.zone_substation}</td>
              <td className="py-3 pr-4 text-gray-400">{f.region}</td>
              <td className="py-3 px-4 text-right text-gray-300 tabular-nums">{f.outage_count}</td>
              <td className="py-3 px-4 text-right text-gray-300 tabular-nums">
                {f.total_affected.toLocaleString()}
              </td>
              <td className="py-3 pl-4 text-right text-gray-300 tabular-nums">
                {f.total_minutes.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// GSL Liability tab -----------------------------------------------------
function GSLTab({
  feeders,
  totalEligible,
  totalPayment,
  loading,
}: {
  feeders: GSLTracking[]
  totalEligible?: number
  totalPayment?: number
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-gray-700 rounded animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }
  if (feeders.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">No GSL tracking data available.</p>
  }

  return (
    <div className="space-y-4">
      {/* Totals banner */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Eligible Customers</span>
          </div>
          <div className="text-2xl font-bold text-gray-100">
            {totalEligible != null ? totalEligible.toLocaleString() : '—'}
          </div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Total Projected GSL</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {totalPayment != null
              ? `$${totalPayment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Per-feeder table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
              <th className="text-left py-2 pr-4 font-medium">Feeder</th>
              <th className="text-right py-2 px-4 font-medium">Total Customers</th>
              <th className="text-right py-2 px-4 font-medium">GSL Eligible</th>
              <th className="text-right py-2 pl-4 font-medium">Projected ($AUD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {feeders.map((f) => (
              <tr key={f.feeder_id} className="hover:bg-gray-700/40 transition-colors">
                <td className="py-3 pr-4 font-medium text-gray-100">{f.feeder_id}</td>
                <td className="py-3 px-4 text-right text-gray-300 tabular-nums">
                  {f.total_customers.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  <span
                    className={`font-medium ${
                      f.eligible_count > 0 ? 'text-amber-400' : 'text-gray-400'
                    }`}
                  >
                    {f.eligible_count.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 pl-4 text-right text-green-400 font-medium tabular-nums">
                  ${f.total_projected_aud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function OutageManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('reliability')
  const [refreshing, setRefreshing] = useState(false)

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Active outages
  const [activeOutages, setActiveOutages] = useState<OutageEvent[]>([])
  const [activeLoading, setActiveLoading] = useState(true)

  // Tab data
  const [kpis, setKpis] = useState<ReliabilityKPI[]>([])
  const [kpisLoading, setKpisLoading] = useState(false)

  const [causes, setCauses] = useState<CauseRow[]>([])
  const [causesLoading, setCausesLoading] = useState(false)

  const [worstFeeders, setWorstFeeders] = useState<WorstFeeder[]>([])
  const [feedersLoading, setFeedersLoading] = useState(false)

  const [gslFeeders, setGslFeeders] = useState<GSLTracking[]>([])
  const [gslTotalEligible, setGslTotalEligible] = useState<number | undefined>()
  const [gslTotalPayment, setGslTotalPayment] = useState<number | undefined>()
  const [gslLoading, setGslLoading] = useState(false)

  // Fetch summary + active outages on mount
  const fetchCore = async () => {
    setSummaryLoading(true)
    setActiveLoading(true)
    try {
      const [s, a] = await Promise.all([outagesApi.summary(), outagesApi.active()])
      setSummary(s)
      setActiveOutages(a.active_outages)
    } catch (err) {
      console.error('OutageManagement: fetchCore error', err)
    } finally {
      setSummaryLoading(false)
      setActiveLoading(false)
    }
  }

  useEffect(() => {
    fetchCore()
  }, [])

  // Fetch tab data on tab change
  useEffect(() => {
    if (activeTab === 'reliability' && kpis.length === 0) {
      setKpisLoading(true)
      outagesApi
        .reliability()
        .then((r) => setKpis(r.kpis))
        .catch((e) => console.error('reliability fetch', e))
        .finally(() => setKpisLoading(false))
    }
    if (activeTab === 'causes' && causes.length === 0) {
      setCausesLoading(true)
      outagesApi
        .causes(90)
        .then((r) => setCauses(r.causes))
        .catch((e) => console.error('causes fetch', e))
        .finally(() => setCausesLoading(false))
    }
    if (activeTab === 'feeders' && worstFeeders.length === 0) {
      setFeedersLoading(true)
      outagesApi
        .worstFeeders()
        .then((r) => setWorstFeeders(r.worst_feeders))
        .catch((e) => console.error('worstFeeders fetch', e))
        .finally(() => setFeedersLoading(false))
    }
    if (activeTab === 'gsl' && gslFeeders.length === 0) {
      setGslLoading(true)
      outagesApi
        .gsl()
        .then((r) => {
          setGslFeeders(r.feeders)
          setGslTotalEligible(r.total_eligible_customers)
          setGslTotalPayment(r.total_projected_payment_aud)
        })
        .catch((e) => console.error('gsl fetch', e))
        .finally(() => setGslLoading(false))
    }
  }, [activeTab])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Clear cached tab data to force reload
    setKpis([])
    setCauses([])
    setWorstFeeders([])
    setGslFeeders([])
    await fetchCore()
    setRefreshing(false)
  }

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'reliability', label: 'Reliability Tracker', icon: <Activity className="w-4 h-4" /> },
    { id: 'causes', label: 'Cause Breakdown', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'feeders', label: 'Worst Feeders', icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'gsl', label: 'GSL Liability', icon: <DollarSign className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Outage Management</h1>
          <p className="text-gray-400 text-sm mt-1">Reliability KPIs, outage tracking & GSL compliance</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary KPI bar */}
      <SummaryBar data={summary} />

      {/* Active outages panel */}
      <ActiveOutagesPanel outages={activeOutages} loading={activeLoading} />

      {/* Tabbed analytics panel */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-700 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-100'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">
          {activeTab === 'reliability' && <ReliabilityTab kpis={kpis} loading={kpisLoading} />}
          {activeTab === 'causes' && <CausesTab causes={causes} loading={causesLoading} />}
          {activeTab === 'feeders' && <WorstFeedersTab feeders={worstFeeders} loading={feedersLoading} />}
          {activeTab === 'gsl' && (
            <GSLTab
              feeders={gslFeeders}
              totalEligible={gslTotalEligible}
              totalPayment={gslTotalPayment}
              loading={gslLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}
