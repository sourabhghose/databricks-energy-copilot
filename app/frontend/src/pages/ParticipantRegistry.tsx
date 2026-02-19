import React, { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { Building2, Users, Shield, Zap, RefreshCw } from 'lucide-react'
import { api, ParticipantRegistry, MarketParticipant, ParticipantAsset } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette for pie chart segments
// ---------------------------------------------------------------------------
const PIE_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#94a3b8', // slate (Others)
]

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'indigo',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    amber:  'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colorMap[color] ?? colorMap.indigo}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ComplianceBadge({ status }: { status: string }) {
  if (status === 'COMPLIANT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Compliant
      </span>
    )
  }
  if (status === 'NOTICE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Notice
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      Suspended
    </span>
  )
}

function CreditBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-red-500' :
    pct >= 60 ? 'bg-amber-500' :
    'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    GENERATOR:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    RETAILER:        'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    TRADER:          'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    NETWORK:         'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    MARKET_CUSTOMER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  }
  const label = type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ')
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? map.GENERATOR}`}>
      {label}
    </span>
  )
}

function AssetStatusBadge({ status }: { status: string }) {
  if (status === 'COMMISSIONED') {
    return <span className="text-xs font-medium text-green-600 dark:text-green-400">Commissioned</span>
  }
  if (status === 'MOTHBALLED') {
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Mothballed</span>
  }
  return <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Decommissioned</span>
}

// ---------------------------------------------------------------------------
// HHI interpretation helper
// ---------------------------------------------------------------------------
function hhiInterpretation(hhi: number): { label: string; color: string } {
  if (hhi < 1500) return { label: 'Competitive', color: 'text-green-600 dark:text-green-400' }
  if (hhi < 2500) return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400' }
  return { label: 'Concentrated', color: 'text-red-600 dark:text-red-400' }
}

// ---------------------------------------------------------------------------
// Market share pie data builder
// ---------------------------------------------------------------------------
function buildPieData(participants: MarketParticipant[]) {
  const sorted = [...participants].sort((a, b) => b.market_share_pct - a.market_share_pct)
  const top8 = sorted.slice(0, 8)
  const othersShare = sorted.slice(8).reduce((sum, p) => sum + p.market_share_pct, 0)
  const data = top8.map(p => ({ name: p.company_name, value: parseFloat(p.market_share_pct.toFixed(1)) }))
  if (othersShare > 0) {
    data.push({ name: 'Others', value: parseFloat(othersShare.toFixed(1)) })
  }
  return data
}

// ---------------------------------------------------------------------------
// Asset detail row
// ---------------------------------------------------------------------------
function AssetRow({ asset }: { asset: ParticipantAsset }) {
  const utilPct = asset.registered_capacity_mw > 0
    ? (asset.current_output_mw / asset.registered_capacity_mw) * 100
    : 0
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <td className="px-4 py-2 text-xs font-mono text-gray-700 dark:text-gray-300">{asset.duid}</td>
      <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{asset.asset_name}</td>
      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-500">{asset.asset_type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-500">{asset.region}</td>
      <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 tabular-nums">{asset.fuel_type}</td>
      <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 tabular-nums text-right">
        {asset.registered_capacity_mw.toLocaleString()} MW
      </td>
      <td className="px-4 py-2 text-xs tabular-nums text-right">
        <span className={asset.current_output_mw > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
          {asset.current_output_mw.toLocaleString()} MW
        </span>
        {asset.registered_capacity_mw > 0 && (
          <span className="text-gray-400 dark:text-gray-500 ml-1">({utilPct.toFixed(0)}%)</span>
        )}
      </td>
      <td className="px-4 py-2"><AssetStatusBadge status={asset.status} /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Expanded asset panel for a participant
// ---------------------------------------------------------------------------
function AssetPanel({
  participant,
  assets,
  loading,
}: {
  participant: MarketParticipant
  assets: ParticipantAsset[]
  loading: boolean
}) {
  return (
    <tr>
      <td colSpan={9} className="bg-gray-50 dark:bg-gray-800/60 px-6 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Zap size={14} className="text-amber-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {participant.company_name} — Registered Assets
          </span>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400 py-4">Loading assets...</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No assets found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  {['DUID', 'Asset Name', 'Type', 'Region', 'Fuel', 'Registered MW', 'Current Output', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {assets.map(a => <AssetRow key={a.duid} asset={a} />)}
              </tbody>
            </table>
          </div>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type TypeFilter = 'ALL' | 'GENERATOR' | 'RETAILER' | 'TRADER'

export default function ParticipantRegistryPage() {
  const [registry, setRegistry] = useState<ParticipantRegistry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assetMap, setAssetMap] = useState<Record<string, ParticipantAsset[]>>({})
  const [assetLoading, setAssetLoading] = useState<Record<string, boolean>>({})

  const fetchRegistry = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getParticipantRegistry()
      setRegistry(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load registry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRegistry() }, [fetchRegistry])

  const handleRowClick = useCallback(async (participantId: string) => {
    if (expandedId === participantId) {
      setExpandedId(null)
      return
    }
    setExpandedId(participantId)
    if (assetMap[participantId]) return
    setAssetLoading(prev => ({ ...prev, [participantId]: true }))
    try {
      const assets = await api.getParticipantAssets(participantId)
      setAssetMap(prev => ({ ...prev, [participantId]: assets }))
    } catch {
      setAssetMap(prev => ({ ...prev, [participantId]: [] }))
    } finally {
      setAssetLoading(prev => ({ ...prev, [participantId]: false }))
    }
  }, [expandedId, assetMap])

  // Filtered list
  const participants = registry?.participants ?? []
  const filtered = participants.filter(p => {
    const matchType = typeFilter === 'ALL' || p.participant_type === typeFilter
    const matchSearch = search.trim() === '' ||
      p.company_name.toLowerCase().includes(search.toLowerCase()) ||
      p.participant_id.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const pieData = registry ? buildPieData(registry.participants) : []
  const hhi = registry?.market_concentration_hhi ?? 0
  const { label: hhiLabel, color: hhiColor } = hhiInterpretation(hhi)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading participant registry...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <div className="text-center text-red-500 dark:text-red-400">
          <p className="font-semibold mb-2">Failed to load registry</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchRegistry}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="text-indigo-500" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Market Participant Registry</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">NEM registered entities, portfolios, credit limits, and market fees</p>
          </div>
          <span className="ml-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-semibold">
            NEM Participants
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search participant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56"
          />
          <button
            onClick={fetchRegistry}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Market Concentration Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Participants"
          value={String(registry?.total_participants ?? 0)}
          sub="Registered with AEMO"
          color="indigo"
        />
        <StatCard
          icon={Zap}
          label="Total Capacity"
          value={`${((registry?.total_registered_capacity_mw ?? 0) / 1000).toFixed(1)} GW`}
          sub="Registered generation"
          color="amber"
        />
        <StatCard
          icon={Shield}
          label="HHI Index"
          value={hhi.toFixed(0)}
          sub={hhiLabel + ' (< 1500 = Competitive, > 2500 = Concentrated)'}
          color={hhi < 1500 ? 'green' : hhi < 2500 ? 'amber' : 'indigo'}
        />
        <StatCard
          icon={Building2}
          label="Largest Player"
          value={registry?.largest_participant ?? '-'}
          sub={`${participants.length > 0 ? participants[0].market_share_pct.toFixed(1) : '0'}% market share`}
          color="blue"
        />
      </div>

      {/* Charts + Table layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Market Share Donut Chart */}
        <div className="xl:col-span-1 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Market Share</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Market Share']}
                contentStyle={{
                  background: 'rgba(17,24,39,0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: '12px',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(value: string) => (
                  <span style={{ color: '#6b7280' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Participants Table */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Registered Participants</h2>
            <div className="flex gap-1">
              {(['ALL', 'GENERATOR', 'RETAILER', 'TRADER'] as TypeFilter[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={[
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    typeFilter === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                  ].join(' ')}
                >
                  {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/60">
                <tr>
                  {[
                    'Participant', 'Type', 'Regions', 'Capacity MW',
                    'Share %', 'Credit Used', 'Assets',
                    'Compliance', 'Last Settlement',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                      No participants match the current filter.
                    </td>
                  </tr>
                )}
                {filtered.map(p => (
                  <React.Fragment key={p.participant_id}>
                    <tr
                      onClick={() => handleRowClick(p.participant_id)}
                      className={[
                        'border-t border-gray-100 dark:border-gray-700 cursor-pointer transition-colors',
                        expandedId === p.participant_id
                          ? 'bg-indigo-50 dark:bg-indigo-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                      ].join(' ')}
                    >
                      {/* Participant */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{p.company_name}</div>
                        <div className="text-xs text-gray-400 font-mono">{p.participant_id}</div>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3">
                        <TypeBadge type={p.participant_type} />
                      </td>
                      {/* Regions */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.regions.map(r => (
                            <span key={r} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* Capacity MW */}
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 tabular-nums text-right">
                        {p.total_capacity_mw.toLocaleString()}
                      </td>
                      {/* Market Share % */}
                      <td className="px-4 py-3 text-xs font-semibold tabular-nums text-right">
                        <span className="text-indigo-600 dark:text-indigo-400">{p.market_share_pct.toFixed(1)}%</span>
                      </td>
                      {/* Credit Used */}
                      <td className="px-4 py-3">
                        <CreditBar pct={p.credit_used_pct} />
                      </td>
                      {/* Assets */}
                      <td className="px-4 py-3 text-xs text-center text-gray-700 dark:text-gray-300">
                        {p.assets_count}
                      </td>
                      {/* Compliance */}
                      <td className="px-4 py-3">
                        <ComplianceBadge status={p.compliance_status} />
                      </td>
                      {/* Last Settlement */}
                      <td className="px-4 py-3 text-xs tabular-nums text-right text-gray-700 dark:text-gray-300">
                        {p.last_settlement_aud >= 0 ? '+' : ''}
                        ${(p.last_settlement_aud / 1_000_000).toFixed(2)}M
                      </td>
                    </tr>
                    {expandedId === p.participant_id && (
                      <AssetPanel
                        participant={p}
                        assets={assetMap[p.participant_id] ?? []}
                        loading={assetLoading[p.participant_id] ?? false}
                      />
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} of {participants.length} participants shown
            {expandedId && ' — click a row to collapse asset detail'}
          </div>
        </div>
      </div>

      {/* HHI context footer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Market Concentration — Herfindahl-Hirschman Index (HHI)
        </h3>
        <div className="flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-300">
          <span>
            Current HHI: <strong className={hhiColor}>{hhi.toFixed(0)} ({hhiLabel})</strong>
          </span>
          <span className="text-green-600 dark:text-green-400">Below 1,500: Competitive market</span>
          <span className="text-amber-600 dark:text-amber-400">1,500 – 2,500: Moderately concentrated</span>
          <span className="text-red-600 dark:text-red-400">Above 2,500: Highly concentrated</span>
          <span className="text-gray-400">ACCC threshold for merger review: 2,500</span>
        </div>
      </div>
    </div>
  )
}
