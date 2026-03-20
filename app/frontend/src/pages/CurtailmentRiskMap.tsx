// Curtailment Risk & Events
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Zap, AlertTriangle, DollarSign, Clock, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'

interface KpiCardProps {
  label: string; value: string; sub?: string
  Icon: LucideIcon; color: string
}
function KpiCard({ label, value, sub, Icon, color }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const MONTHLY_TREND = [
  { month: 'Jul', events: 2, curtailed_mwh: 48.2 },
  { month: 'Aug', events: 3, curtailed_mwh: 71.4 },
  { month: 'Sep', events: 4, curtailed_mwh: 92.1 },
  { month: 'Oct', events: 6, curtailed_mwh: 148.3 },
  { month: 'Nov', events: 8, curtailed_mwh: 211.6 },
  { month: 'Dec', events: 5, curtailed_mwh: 124.8 },
  { month: 'Jan', events: 4, curtailed_mwh: 98.5 },
  { month: 'Feb', events: 3, curtailed_mwh: 74.2 },
  { month: 'Mar', events: 3, curtailed_mwh: 61.8 },
]

const FALLBACK_EVENTS = [
  { event_id: 'CE-2026-0038', feeder_id: 'F-2241', feeder_name: 'Rooftop Solar Cres 11kV', date: '2026-03-14', cause: 'Thermal Overload', duration_min: 82, energy_curtailed_mwh: 12.4, revenue_loss: 4340, region: 'Western Sydney' },
  { event_id: 'CE-2026-0037', feeder_id: 'F-1882', feeder_name: 'New Estate Rd 11kV', date: '2026-03-12', cause: 'Voltage Violation', duration_min: 65, energy_curtailed_mwh: 9.8, revenue_loss: 3430, region: 'Hills District' },
  { event_id: 'CE-2026-0036', feeder_id: 'F-0991', feeder_name: 'Industrial Park 11kV', date: '2026-03-10', cause: 'Protection Trip', duration_min: 120, energy_curtailed_mwh: 18.2, revenue_loss: 6370, region: 'Penrith' },
  { event_id: 'CE-2026-0035', feeder_id: 'F-3340', feeder_name: 'Residential Grove 11kV', date: '2026-03-07', cause: 'Thermal Overload', duration_min: 44, energy_curtailed_mwh: 7.1, revenue_loss: 2485, region: 'Campbelltown' },
  { event_id: 'CE-2026-0034', feeder_id: 'F-2241', feeder_name: 'Rooftop Solar Cres 11kV', date: '2026-03-01', cause: 'DOE Limit', duration_min: 38, energy_curtailed_mwh: 5.9, revenue_loss: 2065, region: 'Western Sydney' },
  { event_id: 'CE-2026-0033', feeder_id: 'F-0442', feeder_name: 'Shopping Centre 22kV', date: '2026-02-28', cause: 'Voltage Violation', duration_min: 55, energy_curtailed_mwh: 8.4, revenue_loss: 2940, region: 'Parramatta' },
  { event_id: 'CE-2026-0032', feeder_id: 'F-1122', feeder_name: 'Rural North 33kV', date: '2026-02-25', cause: 'Thermal Overload', duration_min: 210, energy_curtailed_mwh: 32.1, revenue_loss: 11235, region: 'Hunter' },
  { event_id: 'CE-2026-0031', feeder_id: 'F-2018', feeder_name: 'Hilltop Estate 11kV', date: '2026-02-22', cause: 'DOE Limit', duration_min: 28, energy_curtailed_mwh: 4.2, revenue_loss: 1470, region: 'Blue Mountains' },
]

const causeBadge = (cause: string) => {
  if (cause === 'Thermal Overload') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (cause === 'Voltage Violation') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  if (cause === 'Protection Trip') return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
}

export default function CurtailmentRiskMap() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [events, setEvents] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>(MONTHLY_TREND)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getHostingCapacitySummary(),
      api.getHostingCapacityCurtailment(),
    ]).then(([s, c]) => {
      setSummary(s ?? {})
      setEvents(Array.isArray(c?.items) ? c.items : Array.isArray(c) ? c : FALLBACK_EVENTS)
      if (Array.isArray(c?.monthly_trend)) setTrend(c.monthly_trend)
      setLoading(false)
    }).catch(() => {
      setEvents(FALLBACK_EVENTS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const totalEvents = summary.curtailment_events_ytd ?? events.length
  const totalMwh = events.reduce((a, e) => a + (e.energy_curtailed_mwh ?? 0), 0)
  const totalRevLoss = events.reduce((a, e) => a + (e.revenue_loss ?? 0), 0)
  const avgDuration = events.length ? events.reduce((a, e) => a + (e.duration_min ?? 0), 0) / events.length : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Curtailment Risk & Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">DER generation curtailment events — cause analysis, feeder attribution and revenue impact</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Events YTD" value={String(totalEvents)} sub="Curtailment events this year" Icon={Zap} color="bg-red-500" />
        <KpiCard label="Total Curtailed" value={`${totalMwh.toFixed(0)} MWh`} sub="Generation curtailed YTD" Icon={AlertTriangle} color="bg-orange-500" />
        <KpiCard label="Revenue Loss" value={`$${(totalRevLoss / 1000).toFixed(0)}k`} sub="Customer revenue impact" Icon={DollarSign} color="bg-amber-500" />
        <KpiCard label="Avg Duration" value={`${avgDuration.toFixed(0)} min`} sub="Average event duration" Icon={Clock} color="bg-blue-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Monthly Curtailment Trend — Events & MWh</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend} margin={{ bottom: 10, left: 10 }}>
            <defs>
              <linearGradient id="curtailGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" MWh" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" evt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Area yAxisId="left" type="monotone" dataKey="curtailed_mwh" stroke="#EF4444" fill="url(#curtailGrad)" strokeWidth={2} name="Curtailed MWh" />
            <Area yAxisId="right" type="monotone" dataKey="events" stroke="#F59E0B" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Events" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Curtailment Event Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Event ID</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Feeder</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Region</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Cause</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Duration (min)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Curtailed MWh</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Rev. Loss $</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {events.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.event_id}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{row.date}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs">{row.feeder_name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.region}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${causeBadge(row.cause)}`}>{row.cause}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.duration_min}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-semibold">{(row.energy_curtailed_mwh ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 text-red-600 dark:text-red-400 font-semibold">${(row.revenue_loss ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
