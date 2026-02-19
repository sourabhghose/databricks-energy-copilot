import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import {
  api,
  CommunityEnergyDashboard,
  CommunityBatteryRecord,
  SolarGardenRecord,
  StandalonePowerRecord,
} from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const PROGRAM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  VPP_SA:          { bg: '#7c3aed33', text: '#a78bfa', label: 'VPP SA' },
  DNSP_COMM:       { bg: '#1d4ed833', text: '#60a5fa', label: 'DNSP Comm' },
  RETAILER_COMM:   { bg: '#15803d33', text: '#4ade80', label: 'Retailer Comm' },
  GOVERNMENT_GRANT:{ bg: '#92400033', text: '#fbbf24', label: 'Gov Grant' },
}

const BATTERY_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPERATING:    { bg: '#15803d33', text: '#4ade80' },
  CONSTRUCTION: { bg: '#1d4ed833', text: '#60a5fa' },
  APPROVED:     { bg: '#71400033', text: '#fbbf24' },
  PROPOSED:     { bg: '#37415133', text: '#9ca3af' },
}

const GARDEN_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPERATING:    { bg: '#15803d33', text: '#4ade80' },
  CONSTRUCTION: { bg: '#1d4ed833', text: '#60a5fa' },
  APPROVED:     { bg: '#71400033', text: '#fbbf24' },
  PROPOSED:     { bg: '#37415133', text: '#9ca3af' },
}

const TECH_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  SOLAR_BATTERY:        { bg: '#1d4ed833', text: '#60a5fa', label: 'Solar + Battery' },
  SOLAR_DIESEL:         { bg: '#c2410c33', text: '#fb923c', label: 'Solar + Diesel' },
  SOLAR_BATTERY_DIESEL: { bg: '#92400033', text: '#fbbf24', label: 'Solar + Batt + Diesel' },
  WIND_BATTERY:         { bg: '#0f766e33', text: '#2dd4bf', label: 'Wind + Battery' },
}

function ProgramBadge({ program }: { program: string }) {
  const s = PROGRAM_STYLES[program] ?? { bg: '#37415133', text: '#9ca3af', label: program }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

function StatusBadge({ status, styles }: { status: string; styles: Record<string, { bg: string; text: string }> }) {
  const s = styles[status] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

function TechBadge({ technology }: { technology: string }) {
  const s = TECH_STYLES[technology] ?? { bg: '#37415133', text: '#9ca3af', label: technology }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

// ── Community Batteries Table ─────────────────────────────────────────────────

function CommunityBatteriesTable({ batteries }: { batteries: CommunityBatteryRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Community Batteries ({batteries.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-400 py-2 pr-4">Name</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Operator</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">State</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Program</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Capacity (kWh)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Participants</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Bill Savings</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Utilisation</th>
              <th className="text-center text-xs text-gray-400 py-2 px-3">Status</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Commission</th>
            </tr>
          </thead>
          <tbody>
            {batteries.map(b => (
              <tr key={b.battery_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-semibold text-white">{b.name}</td>
                <td className="py-2 px-3 text-gray-300">{b.operator}</td>
                <td className="py-2 px-3 text-gray-300">{b.state}</td>
                <td className="py-2 px-3">
                  <ProgramBadge program={b.program} />
                </td>
                <td className="text-right text-gray-300 py-2 px-3">{b.capacity_kwh.toLocaleString()}</td>
                <td className="text-right text-gray-300 py-2 px-3">{b.participants.toLocaleString()}</td>
                <td className="text-right text-gray-300 py-2 px-3">{b.avg_bill_savings_pct.toFixed(1)}%</td>
                <td className="text-right text-gray-300 py-2 px-3">{b.utilisation_pct.toFixed(1)}%</td>
                <td className="text-center py-2 px-3">
                  <StatusBadge status={b.status} styles={BATTERY_STATUS_STYLES} />
                </td>
                <td className="text-right text-gray-400 py-2 px-3">{b.commissioning_year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Solar Gardens Table ───────────────────────────────────────────────────────

function SolarGardensTable({ gardens }: { gardens: SolarGardenRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Solar Gardens ({gardens.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-400 py-2 pr-4">Name</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Operator</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">State</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Capacity (kW)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Subscribers</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Savings/Sub (A$/yr)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Waitlist</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Low-Income %</th>
              <th className="text-center text-xs text-gray-400 py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {gardens.map(g => (
              <tr key={g.garden_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-semibold text-white">{g.name}</td>
                <td className="py-2 px-3 text-gray-300">{g.operator}</td>
                <td className="py-2 px-3 text-gray-300">{g.state}</td>
                <td className="text-right text-gray-300 py-2 px-3">{g.capacity_kw.toLocaleString()}</td>
                <td className="text-right text-gray-300 py-2 px-3">{g.subscribers.toLocaleString()}</td>
                <td className="text-right text-gray-300 py-2 px-3">A${g.savings_per_subscriber_aud_yr.toFixed(0)}</td>
                <td className="text-right py-2 px-3">
                  <span className={g.waitlist_count > 300 ? 'text-amber-400' : 'text-gray-300'}>
                    {g.waitlist_count.toLocaleString()}
                  </span>
                </td>
                <td className="text-right text-gray-300 py-2 px-3">{g.low_income_reserved_pct.toFixed(1)}%</td>
                <td className="text-center py-2 px-3">
                  <StatusBadge status={g.status} styles={GARDEN_STATUS_STYLES} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Standalone Power Systems Table ────────────────────────────────────────────

function SpsTable({ systems }: { systems: StandalonePowerRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
        Standalone Power Systems — SPS ({systems.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-xs text-gray-400 py-2 pr-4">Network Area</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">DNSP</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">State</th>
              <th className="text-left text-xs text-gray-400 py-2 px-3">Technology</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Customers</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Reliability</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">CO₂ Saved (tCO₂/yr)</th>
              <th className="text-right text-xs text-gray-400 py-2 px-3">Network Deferral (M AUD)</th>
            </tr>
          </thead>
          <tbody>
            {systems.map(s => (
              <tr key={s.sps_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-semibold text-white">{s.network_area}</td>
                <td className="py-2 px-3 text-gray-300">{s.dnsp}</td>
                <td className="py-2 px-3 text-gray-300">{s.state}</td>
                <td className="py-2 px-3">
                  <TechBadge technology={s.technology} />
                </td>
                <td className="text-right text-gray-300 py-2 px-3">{s.customers_served.toLocaleString()}</td>
                <td className="text-right py-2 px-3">
                  <span className={s.reliability_pct >= 99.5 ? 'text-green-400' : s.reliability_pct >= 99.0 ? 'text-amber-400' : 'text-orange-400'}>
                    {s.reliability_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="text-right text-gray-300 py-2 px-3">
                  {s.carbon_saved_tco2_yr > 0 ? s.carbon_saved_tco2_yr.toFixed(1) : '—'}
                </td>
                <td className="text-right text-gray-300 py-2 px-3">
                  A${s.network_deferral_m_aud.toFixed(1)}M
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommunityEnergy() {
  const [dashboard, setDashboard] = useState<CommunityEnergyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCommunityEnergyDashboard()
      .then(setDashboard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">Loading community energy data...</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-red-400 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="text-purple-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Community Energy &amp; Microgrids Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Community batteries, solar gardens, standalone power systems (SPS), off-grid communities &amp; microgrid projects
          </p>
        </div>
      </div>

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Community Batteries"
          value={dashboard.total_community_batteries}
          sub="Operating + Construction"
        />
        <KpiCard
          label="Community Battery Capacity"
          value={dashboard.total_community_battery_capacity_mwh.toFixed(1)}
          unit="MWh"
          sub="Operating systems only"
        />
        <KpiCard
          label="Solar Garden Capacity"
          value={dashboard.total_solar_garden_capacity_mw.toFixed(1)}
          unit="MW"
          sub="All solar garden programs"
        />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Solar Garden Subscribers"
          value={dashboard.total_solar_garden_subscribers.toLocaleString()}
          sub="Enrolled households"
        />
        <KpiCard
          label="Standalone Power Systems"
          value={dashboard.total_sps_systems}
          sub="Remote & off-grid SPS"
        />
        <KpiCard
          label="SPS Customers"
          value={dashboard.total_sps_customers.toLocaleString()}
          sub="Customers served by SPS"
        />
      </div>

      {/* Community Batteries Table */}
      <CommunityBatteriesTable batteries={dashboard.community_batteries} />

      {/* Solar Gardens Table */}
      <SolarGardensTable gardens={dashboard.solar_gardens} />

      {/* SPS Table */}
      <SpsTable systems={dashboard.sps_systems} />
    </div>
  )
}
