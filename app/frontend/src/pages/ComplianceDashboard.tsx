import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, Clock, Plus, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { complianceApi } from '../api/client'
import type { ComplianceObligation } from '../api/client'

const tooltipStyle = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }
const tooltipLabelStyle = { color: '#d1d5db' }

const STATUS_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-green-500/20 text-green-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  AT_RISK: 'bg-orange-500/20 text-orange-400',
  OVERDUE: 'bg-red-500/20 text-red-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400',
  HIGH: 'bg-orange-500/20 text-orange-400',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400',
  LOW: 'bg-blue-500/20 text-blue-400',
}

export default function ComplianceDashboard() {
  const [loading, setLoading] = useState(false)
  const [totalObligations, setTotalObligations] = useState(0)
  const [complianceRate, setComplianceRate] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ status: string; cnt: number }>>([])
  const [obligations, setObligations] = useState<ComplianceObligation[]>([])
  const [timeline, setTimeline] = useState<ComplianceObligation[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('NER_COMPLIANCE')
  const [newDueDate, setNewDueDate] = useState('')
  const [newPriority, setNewPriority] = useState('MEDIUM')
  const [newRegion, setNewRegion] = useState('NSW1')

  async function loadData() {
    setLoading(true)
    try {
      const dash = await complianceApi.dashboard()
      setTotalObligations(dash.total_obligations)
      setComplianceRate(dash.compliance_rate)
      setOverdueCount(dash.overdue_count)
      setStatusBreakdown(dash.status_breakdown || [])
      setTimeline(dash.timeline || [])

      const obs = await complianceApi.obligations()
      setObligations(obs.obligations || [])
    } catch (e) { console.error('Compliance load error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleCreate() {
    if (!newTitle || !newDueDate) return
    try {
      await complianceApi.create({
        title: newTitle, obligation_type: newType, due_date: newDueDate,
        priority: newPriority, region: newRegion,
      })
      setShowAddForm(false)
      setNewTitle('')
      loadData()
    } catch (e) { console.error('Create error:', e) }
  }

  const chartData = statusBreakdown.map(s => ({ name: s.status, count: Number(s.cnt) }))
  const BAR_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#3b82f6']

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
            <p className="text-gray-400 text-sm">Regulatory obligations & deadlines</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Add Obligation
          </button>
          <button onClick={loadData} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Obligations', value: totalObligations, icon: Shield, color: 'blue' },
          { label: 'Compliance Rate', value: `${complianceRate}%`, icon: CheckCircle, color: complianceRate > 80 ? 'green' : 'yellow' },
          { label: 'Overdue', value: overdueCount, icon: AlertTriangle, color: overdueCount > 0 ? 'red' : 'green' },
          { label: 'Upcoming (30d)', value: timeline.length, icon: Clock, color: 'purple' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-5 h-5 text-${kpi.color}-400`} />
              <span className="text-gray-400 text-sm">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
          <h3 className="text-white font-semibold">New Obligation</h3>
          <div className="grid grid-cols-3 gap-4">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            <select value={newType} onChange={e => setNewType(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
              {['NER_COMPLIANCE', 'AER_REPORTING', 'AEMO_REGISTRATION', 'AEMC_RULE_CHANGE', 'RET_OBLIGATION'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={newRegion} onChange={e => setNewRegion(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
              {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm">Create</button>
          </div>
        </div>
      )}

      {/* Status Chart + Timeline */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Upcoming Deadlines</h3>
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {timeline.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700">
                <div>
                  <p className="text-white text-sm font-medium">{t.title}</p>
                  <p className="text-gray-500 text-xs">{t.obligation_type?.replace(/_/g, ' ')} · {t.region}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[t.priority] || 'bg-gray-600 text-gray-300'}`}>{t.priority}</span>
                  <span className="text-gray-400 text-xs">{t.due_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Obligations Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">All Obligations</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Region</th>
              <th className="py-2 px-3">Due Date</th>
              <th className="py-2 px-3">Priority</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {obligations.map((o, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 text-white">{o.title}</td>
                <td className="py-2 px-3 text-gray-400">{o.obligation_type?.replace(/_/g, ' ')}</td>
                <td className="py-2 px-3 text-gray-400">{o.region}</td>
                <td className="py-2 px-3 text-gray-400">{o.due_date}</td>
                <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[o.priority] || ''}`}>{o.priority}</span></td>
                <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
