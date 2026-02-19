import { useEffect, useState } from 'react'
import { DollarSign, FileText, AlertTriangle, CheckCircle, Clock, XCircle, Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { api } from '../api/client'
import type { SettlementDashboard, SettlementRun, PrudentialRecord, SettlementResidueRecord, TecAdjustment } from '../api/client'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtAUD(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function fmtMW(value: number): string {
  return `${value.toFixed(0)} MW`
}

// ---------------------------------------------------------------------------
// Settlement Run badges
// ---------------------------------------------------------------------------

function RunTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    DISPATCH: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    BILLING_WEEKLY: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    BILLING_MONTHLY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    FINAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    PREDISPATCH: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  const label: Record<string, string> = {
    DISPATCH: 'Dispatch',
    BILLING_WEEKLY: 'Weekly Billing',
    BILLING_MONTHLY: 'Monthly Billing',
    FINAL: 'Final',
    PREDISPATCH: 'Pre-Dispatch',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-700'}`}>
      {label[type] ?? type}
    </span>
  )
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle size={11} /> Complete
      </span>
    )
  }
  if (status === 'RUNNING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <Loader2 size={11} className="animate-spin" /> Running
      </span>
    )
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <XCircle size={11} /> Failed
      </span>
    )
  }
  // PENDING
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      <Clock size={11} /> Pending
    </span>
  )
}

// ---------------------------------------------------------------------------
// Prudential status badge
// ---------------------------------------------------------------------------

function PrudentialStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OK: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    EXCEEDANCE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    DEFAULT: 'bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Utilisation progress bar
// ---------------------------------------------------------------------------

function UtilisationBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 200)
  const barWidth = Math.min(clamped, 100)
  let colour = 'bg-green-500'
  if (pct >= 90) colour = 'bg-red-500'
  else if (pct >= 70) colour = 'bg-amber-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colour}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-14 text-right ${pct >= 90 ? 'text-red-600 dark:text-red-400' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TEC reason badge
// ---------------------------------------------------------------------------

function TecReasonBadge({ reason }: { reason: string }) {
  const map: Record<string, string> = {
    AUGMENTATION: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    NEW_UNIT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    DERATING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    DECOMMISSION: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  const label: Record<string, string> = {
    AUGMENTATION: 'Augmentation',
    NEW_UNIT: 'New Unit',
    DERATING: 'De-rating',
    DECOMMISSION: 'Decommission',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[reason] ?? 'bg-gray-100 text-gray-700'}`}>
      {label[reason] ?? reason}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Region chip
// ---------------------------------------------------------------------------

function RegionChip({ region }: { region: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
      {region}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  alert?: boolean
}

function KpiCard({ title, value, subtitle, icon, alert = false }: KpiCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-5 flex flex-col gap-3 ${alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${alert ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold ${alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settlement Runs table
// ---------------------------------------------------------------------------

function SettlementRunsTable({ runs }: { runs: SettlementRun[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Clock size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Settlement Runs</h2>
        <span className="ml-auto text-xs text-gray-400">{runs.length} runs</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Run ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trading Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Settlement ($M)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Runtime (s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {runs.map((run) => (
              <tr key={run.run_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{run.run_id}</td>
                <td className="px-4 py-3"><RunTypeBadge type={run.run_type} /></td>
                <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{run.trading_date}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                  {run.total_settlement_aud > 0 ? `$${(run.total_settlement_aud / 1_000_000).toFixed(1)}M` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {run.runtime_seconds > 0 ? run.runtime_seconds.toFixed(1) : '—'}
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
// Prudential Status table
// ---------------------------------------------------------------------------

function PrudentialTable({ records }: { records: PrudentialRecord[] }) {
  const typeMap: Record<string, string> = {
    GENERATOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    RETAILER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    TRADER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Prudential Status</h2>
        <span className="ml-auto text-xs text-gray-400">{records.length} participants</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Participant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Credit Limit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Exposure</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-44">Utilisation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Default Notice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {records.map((rec) => (
              <tr key={rec.participant_id} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${rec.status === 'DEFAULT' ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-xs">{rec.participant_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{rec.participant_id}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${typeMap[rec.participant_type] ?? 'bg-gray-100 text-gray-700'}`}>
                    {rec.participant_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{fmtAUD(rec.credit_limit_aud)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">{fmtAUD(rec.current_exposure_aud)}</td>
                <td className="px-4 py-3 w-44"><UtilisationBar pct={rec.utilisation_pct} /></td>
                <td className="px-4 py-3"><PrudentialStatusBadge status={rec.status} /></td>
                <td className="px-4 py-3 text-center">
                  {rec.default_notice_issued ? (
                    <span className="text-red-600 dark:text-red-400 font-bold text-xs">YES</span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
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
// Settlement Residues table
// ---------------------------------------------------------------------------

function ResiduesTable({ records }: { records: SettlementResidueRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <DollarSign size={16} className="text-green-600" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Settlement Residues</h2>
        <span className="ml-auto text-xs text-gray-400">{records.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interval</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interconnector</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Flow (MW)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Price Diff ($/MWh)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Residue ($)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Direction</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pool</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {records.map((rec, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{rec.interval_id}</td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{rec.interconnector_id}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{rec.flow_mw.toFixed(0)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">${rec.price_differential.toFixed(0)}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">{fmtAUD(rec.settlement_residue_aud)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${rec.direction === 'IMPORT' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                    {rec.direction}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${rec.allocation_pool === 'SRA_POOL' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {rec.allocation_pool}
                  </span>
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
// TEC Adjustments table
// ---------------------------------------------------------------------------

function TecAdjustmentsTable({ adjustments }: { adjustments: TecAdjustment[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <FileText size={16} className="text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">TEC / MLF Adjustments</h2>
        <span className="ml-auto text-xs text-gray-400">{adjustments.length} recent changes</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">DUID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Station</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">TEC Change</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Change (MW)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">MLF Before/After</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Effective</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {adjustments.map((adj) => (
              <tr key={adj.duid} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{adj.duid}</td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{adj.station_name}</td>
                <td className="px-4 py-3"><RegionChip region={adj.region} /></td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
                    {adj.previous_tec_mw.toFixed(0)}
                    <ArrowRight size={12} className="text-gray-400" />
                    {adj.new_tec_mw.toFixed(0)} MW
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${adj.change_mw >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {adj.change_mw >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {adj.change_mw >= 0 ? '+' : ''}{adj.change_mw.toFixed(0)}
                  </span>
                </td>
                <td className="px-4 py-3"><TecReasonBadge reason={adj.reason} /></td>
                <td className="px-4 py-3 text-center text-xs font-mono text-gray-600 dark:text-gray-400">
                  {adj.mlf_before > 0 ? adj.mlf_before.toFixed(3) : '—'}
                  {' → '}
                  {adj.mlf_after > 0 ? adj.mlf_after.toFixed(3) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{adj.effective_date}</td>
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

export default function NemSettlement() {
  const [dashboard, setDashboard] = useState<SettlementDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getSettlementDashboard()
      .then((data) => {
        setDashboard(data)
        setError(null)
      })
      .catch((err) => setError(err.message ?? 'Failed to load settlement data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading settlement data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle size={24} className="text-red-500 mr-2" />
        <span className="text-red-600 dark:text-red-400">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const energyM = (dashboard.total_energy_settlement_aud / 1_000_000).toFixed(1)
  const fcasM = (dashboard.total_fcas_settlement_aud / 1_000_000).toFixed(1)
  const residuesM = (dashboard.total_residues_aud / 1_000_000).toFixed(2)

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NEM Settlement &amp; Prudential Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AEMO settlement runs, residues, prudential exceedances and TEC/MLF adjustments
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          <Clock size={13} />
          {dashboard.settlement_period}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Energy Settlement"
          value={`$${energyM}M`}
          subtitle="Weekly billing period"
          icon={<DollarSign size={18} />}
        />
        <KpiCard
          title="FCAS Settlement"
          value={`$${fcasM}M`}
          subtitle="Ancillary services"
          icon={<TrendingUp size={18} />}
        />
        <KpiCard
          title="Settlement Residues"
          value={`$${residuesM}M`}
          subtitle={`Largest: ${dashboard.largest_residue_interconnector}`}
          icon={<ArrowRight size={18} />}
        />
        <KpiCard
          title="Prudential Exceedances"
          value={String(dashboard.prudential_exceedances)}
          subtitle={`${dashboard.pending_settlement_runs} run(s) pending`}
          icon={<AlertTriangle size={18} />}
          alert={dashboard.prudential_exceedances > 0}
        />
      </div>

      {/* Settlement Runs */}
      <SettlementRunsTable runs={dashboard.settlement_runs} />

      {/* Prudential Status */}
      <PrudentialTable records={dashboard.prudential_records} />

      {/* Settlement Residues */}
      <ResiduesTable records={dashboard.residues} />

      {/* TEC Adjustments */}
      <TecAdjustmentsTable adjustments={dashboard.tec_adjustments} />
    </div>
  )
}
