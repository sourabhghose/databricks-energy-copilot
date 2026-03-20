// Phase 5B — DNSP Enterprise Intelligence Hub
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, BarChart2, Flame, Wifi, Plug, Wrench, Building2, ArrowRight,
  DollarSign, Activity, AlertTriangle, CheckCircle,
  BookOpen, Cpu, BarChart3, Zap, TreePine, Briefcase,
  TrendingUp, Users, Scale, Target, Sliders, Upload, Award,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../api/client'

interface ModuleCard {
  label: string
  description: string
  to: string
  Icon: LucideIcon
  color: string
  badge?: string
}

const MODULES: ModuleCard[] = [
  // AER Compliance
  { label: 'RIN & Regulatory Compliance', description: 'Regulatory Information Notices, STPIS performance bands, revenue cap monitoring', to: '/dnsp/aer/rin', Icon: FileText, color: 'bg-blue-500', badge: 'AER' },
  { label: 'STPIS Tracker', description: 'S-factor incentive scheme — SAIDI/SAIFI performance vs target bands A–D', to: '/dnsp/aer/stpis', Icon: BarChart2, color: 'bg-blue-500', badge: 'AER' },
  { label: 'Regulatory Calendar', description: 'AER regulatory milestones, determination dates, and upcoming 90-day deadlines', to: '/dnsp/aer/calendar', Icon: CheckCircle, color: 'bg-blue-500', badge: 'AER' },
  // Tariffs
  { label: 'Network Tariff Analytics', description: 'Tariff structure migration, revenue by customer class, demand tariff uptake', to: '/dnsp/tariffs', Icon: DollarSign, color: 'bg-green-500', badge: 'Tariffs' },
  { label: 'Tariff Reform Tracker', description: 'Cost-reflective tariff migration progress — DNSPs vs AER reform targets', to: '/dnsp/tariffs/reform', Icon: Activity, color: 'bg-green-500', badge: 'Tariffs' },
  // Bushfire
  { label: 'Bushfire Mitigation (BMP)', description: 'AusNet BMP asset register, ELC inspection compliance, fire risk zone map', to: '/dnsp/bushfire', Icon: Flame, color: 'bg-red-500', badge: 'Bushfire' },
  { label: 'ELC Inspection Tracking', description: 'Electrical line clearance inspection schedule and vegetation management compliance', to: '/dnsp/bushfire/elc', Icon: Flame, color: 'bg-red-500', badge: 'Bushfire' },
  { label: 'Fire Risk Assets', description: 'High-risk asset register in BMO zones with risk ratings and treatment plans', to: '/dnsp/bushfire/assets', Icon: AlertTriangle, color: 'bg-red-500', badge: 'Bushfire' },
  { label: 'Seasonal Readiness', description: 'Pre-summer bushfire preparation checklist — AusNet Services VIC', to: '/dnsp/bushfire/seasonal', Icon: CheckCircle, color: 'bg-red-500', badge: 'Bushfire' },
  // Rural
  { label: 'Rural Network Analytics', description: 'Ergon Energy CSO payments, RAPS fleet, rural feeder SAIDI, Ergon vs Energex', to: '/dnsp/rural', Icon: Wifi, color: 'bg-yellow-500', badge: 'Rural' },
  { label: 'CSO Subsidy Tracker', description: 'Community Service Obligation payment trends and non-network alternative assessments', to: '/dnsp/rural/cso', Icon: DollarSign, color: 'bg-yellow-500', badge: 'Rural' },
  { label: 'RAPS Fleet Management', description: 'Remote Area Power Supply fleet — solar, battery, diesel status and service schedule', to: '/dnsp/rural/raps', Icon: Wifi, color: 'bg-yellow-500', badge: 'Rural' },
  // Connections
  { label: 'Connection Queue', description: 'NER connection application queue with deadline countdown and compliance KPIs', to: '/dnsp/connections', Icon: Plug, color: 'bg-purple-500', badge: 'Connections' },
  { label: 'Timely Connections', description: 'NER timeframe compliance by application type, large customer pipeline', to: '/dnsp/connections/timely', Icon: Plug, color: 'bg-purple-500', badge: 'Connections' },
  // Capex
  { label: 'Capital Program', description: 'Project register with completion progress, budget vs actuals, Capex/Opex analysis', to: '/dnsp/capex', Icon: Building2, color: 'bg-gray-600', badge: 'Capex' },
  { label: 'Maintenance Scheduler', description: 'Work order register with priority triage, SLA tracking, and cost monitoring', to: '/dnsp/capex/maintenance', Icon: Wrench, color: 'bg-gray-600', badge: 'Capex' },
  { label: 'Fault Response KPIs', description: 'SLA compliance, average response and restoration times by fault type and DNSP', to: '/dnsp/capex/fault-kpis', Icon: Wrench, color: 'bg-gray-600', badge: 'Capex' },
  // AIO Compliance
  { label: 'AIO Compliance Hub', description: 'Annual Information Obligations tracker — section completion, STPIS S-factor, AER submission status', to: '/dnsp/aio', Icon: FileText, color: 'bg-indigo-600', badge: 'AIO' },
  { label: 'STPIS Calculator', description: 'SAIDI/SAIFI band performance vs targets — S-factor and revenue adjustment per DNSP', to: '/dnsp/aio/stpis-calc', Icon: BarChart2, color: 'bg-indigo-600', badge: 'AIO' },
  { label: 'AIO Submission Pack', description: 'Section-by-section AIO submission readiness — validation checklist and export', to: '/dnsp/aio/submission', Icon: Upload, color: 'bg-indigo-600', badge: 'AIO' },
  // Asset Intelligence
  { label: 'Asset Intelligence', description: 'Cross-system health scoring, failure probability and AER expenditure alignment across all asset classes', to: '/dnsp/asset-intel', Icon: Cpu, color: 'bg-cyan-600', badge: 'Asset Intel' },
  { label: 'Asset Risk Matrix', description: 'Composite risk ranking — consequence × probability with replacement cost prioritisation', to: '/dnsp/asset-intel/risk-matrix', Icon: AlertTriangle, color: 'bg-cyan-600', badge: 'Asset Intel' },
  { label: 'Expenditure Justification', description: 'AER capex/opex justification templates linked to asset health evidence', to: '/dnsp/asset-intel/justification', Icon: Scale, color: 'bg-cyan-600', badge: 'Asset Intel' },
  // AER Benchmarking
  { label: 'AER Benchmarking', description: 'Partial productivity measures against peer DNSPs and AER frontier — regulatory reset intelligence', to: '/dnsp/benchmarking', Icon: BarChart3, color: 'bg-teal-600', badge: 'Benchmarking' },
  { label: 'Peer Comparison', description: 'Efficiency scores, opex metrics and reliability benchmarks across all Australian DNSPs', to: '/dnsp/benchmarking/peers', Icon: Users, color: 'bg-teal-600', badge: 'Benchmarking' },
  { label: 'Reset Preparation', description: 'Regulatory determination readiness — efficiency gap analysis and narrative builder', to: '/dnsp/benchmarking/reset', Icon: Target, color: 'bg-teal-600', badge: 'Benchmarking' },
  // Hosting Capacity
  { label: 'DER Hosting Capacity', description: 'Feeder utilisation, DER connection queue and curtailment risk assessment', to: '/dnsp/hosting-capacity', Icon: Zap, color: 'bg-amber-600', badge: 'DER & Hosting' },
  { label: 'LV Scenario Modeller', description: 'DER integration scenario analysis — constrained feeders, curtailment and augmentation capex', to: '/dnsp/hosting-capacity/scenarios', Icon: Sliders, color: 'bg-amber-600', badge: 'DER & Hosting' },
  { label: 'Curtailment Risk Map', description: 'Zone-level export curtailment heat map with AER reporting compliance tracker', to: '/dnsp/hosting-capacity/curtailment', Icon: AlertTriangle, color: 'bg-amber-600', badge: 'DER & Hosting' },
  // Vegetation Risk
  { label: 'Vegetation Risk Intelligence', description: 'NDVI satellite change detection, risk scoring and ELC compliance tracking', to: '/dnsp/veg-risk', Icon: TreePine, color: 'bg-emerald-600', badge: 'Veg Risk' },
  { label: 'Line Clearance Compliance', description: 'ELC inspection schedule compliance — overdue spans, zone prioritisation and contractor tracking', to: '/dnsp/veg-risk/elc', Icon: CheckCircle, color: 'bg-emerald-600', badge: 'Veg Risk' },
  { label: 'Bushfire Risk Forecast', description: 'BMO zone risk scoring — current vs peak season with mitigation plan tracking', to: '/dnsp/veg-risk/bushfire-forecast', Icon: Flame, color: 'bg-emerald-600', badge: 'Veg Risk' },
  // Workforce Analytics
  { label: 'Workforce & Contractor Analytics', description: 'Total workforce, contractor ratio, opex benchmarking and AER efficiency gap analysis', to: '/dnsp/workforce', Icon: Briefcase, color: 'bg-violet-600', badge: 'Workforce' },
  { label: 'Contractor Scorecard', description: 'Contractor performance, cost per work type and SLA compliance tracking', to: '/dnsp/workforce/contractors', Icon: Award, color: 'bg-violet-600', badge: 'Workforce' },
  { label: 'Opex Benchmarking', description: 'Actual vs AER allowed opex by category — efficiency gap and reset exposure', to: '/dnsp/workforce/opex', Icon: DollarSign, color: 'bg-violet-600', badge: 'Workforce' },
  // DAPR Assembly
  { label: 'DAPR Assembly Hub', description: 'Distribution Annual Planning Report — NER cl. 5.20.1 submission tracker', to: '/dnsp/dapr-assembly', Icon: BookOpen, color: 'bg-rose-600', badge: 'DAPR' },
  { label: 'Demand Forecast Review', description: '5-year peak demand forecast with DER offset — DAPR Section D2 supporting analysis', to: '/dnsp/dapr-assembly/demand', Icon: TrendingUp, color: 'bg-rose-600', badge: 'DAPR' },
  { label: 'Network Capability Statement', description: 'Bulk supply point headroom, N-1 compliance and transfer capability — DAPR Section D3', to: '/dnsp/dapr-assembly/network', Icon: Activity, color: 'bg-rose-600', badge: 'DAPR' },
]

const BADGE_COLORS: Record<string, string> = {
  AER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  Tariffs: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Bushfire: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  Rural: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  Connections: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  Capex: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  AIO: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  'Asset Intel': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
  Benchmarking: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  'DER & Hosting': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  'Veg Risk': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  Workforce: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  DAPR: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
}

export default function DnspHub() {
  const [kpis, setKpis] = useState<{ label: string; value: string; sub: string; color: string }[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAerSummary().catch(() => null),
      api.getRuralSummary().catch(() => null),
      api.getConnectionsSummary().catch(() => null),
      api.getCapexSummary().catch(() => null),
    ]).then(([aer, rural, conn, capex]) => {
      const aerData = aer as Record<string, number> | null
      const ruralData = rural as Record<string, number> | null
      const connData = conn as Record<string, number> | null
      const capexData = capex as Record<string, number> | null
      setKpis([
        {
          label: 'STPIS Compliant DNSPs',
          value: aerData ? `${3 - (aerData.stpis_underperformers ?? 0)} / 3` : '—',
          sub: 'Meeting AER performance targets',
          color: 'bg-blue-500',
        },
        {
          label: 'CSO Payments YTD',
          value: ruralData ? `$${(ruralData.total_cso_ytd_m ?? 0).toFixed(0)}M` : '—',
          sub: 'QLD Govt rural subsidy',
          color: 'bg-yellow-500',
        },
        {
          label: 'NER Compliance Rate',
          value: connData ? `${(connData.ner_compliance_rate_pct ?? 0).toFixed(1)}%` : '—',
          sub: 'Connection applications on time',
          color: 'bg-purple-500',
        },
        {
          label: 'Capex Actuals',
          value: capexData ? `$${(capexData.total_spend_m ?? 0).toFixed(0)}M` : '—',
          sub: `of $${capexData ? (capexData.total_budget_m ?? 0).toFixed(0) : '—'}M budget`,
          color: 'bg-gray-600',
        },
      ])
      setLoadingKpis(false)
    })
  }, [])

  const modulesByBadge = MODULES.reduce((acc, m) => {
    const b = m.badge ?? 'Other'
    if (!acc[b]) acc[b] = []
    acc[b].push(m)
    return acc
  }, {} as Record<string, ModuleCard[]>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DNSP Enterprise Intelligence</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Unified hub for AER compliance, network tariffs, bushfire mitigation, rural programs, connections, and capital delivery</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">AusNet · Ergon · Energex — Synthetic</span>
      </div>

      {/* Cross-module KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingKpis
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse h-24" />
          ))
          : kpis.map((k, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className={`inline-flex p-2 rounded-lg ${k.color} mb-3`}>
                <Activity size={16} className="text-white" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{k.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{k.sub}</p>
            </div>
          ))}
      </div>

      {/* Module cards by domain */}
      {Object.entries(modulesByBadge).map(([badge, modules]) => (
        <div key={badge}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[badge] ?? ''}`}>{badge}</span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m, i) => (
              <Link key={i} to={m.to} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${m.color} flex-shrink-0`}>
                    <m.Icon size={18} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{m.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{m.description}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Data sources:</strong> All data in this module is synthetic and generated for demonstration purposes. In production, tables are sourced from AER RIN submissions, AEMO network data, DNSP operational systems, and Databricks gold-layer Delta tables (<code className="font-mono">energy_copilot_catalog.gold</code>).
        </p>
      </div>
    </div>
  )
}
