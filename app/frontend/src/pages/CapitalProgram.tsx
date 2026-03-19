// Phase 5B — Capital Program
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { DollarSign, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { api, CapitalProject, CapexOpexRecord } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  'In Progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  Completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Planned: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  'On Hold': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  Delayed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function CapitalProgram() {
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [projects, setProjects] = useState<CapitalProject[]>([])
  const [capexOpex, setCapexOpex] = useState<CapexOpexRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dnspFilter, setDnspFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getCapexSummary(),
      api.getCapexProjects({
        ...(dnspFilter ? { dnsp: dnspFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
      api.getCapexOpexAnalysis(),
    ]).then(([s, p, co]) => {
      setSummary(s as Record<string, number>)
      setProjects(p.projects)
      setCapexOpex(co.analysis)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dnspFilter, categoryFilter, statusFilter])

  const categories = [...new Set(projects.map(p => p.category))].filter(Boolean).sort()

  // Capex actuals vs budget by category
  const categoryBudgetData = categories.map(cat => {
    const catProjects = projects.filter(p => p.category === cat)
    return {
      category: cat.replace('Infrastructure', 'Infra').replace('Management', 'Mgmt'),
      budget: Math.round(catProjects.reduce((s, p) => s + p.budget_m_aud, 0) * 10) / 10,
      actuals: Math.round(catProjects.reduce((s, p) => s + p.actual_spend_m_aud, 0) * 10) / 10,
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Capital Program</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Capital project register with budget tracking, completion progress, and Capex/Opex analysis</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic data</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget', value: `$${(summary.total_budget_m ?? 0).toFixed(0)}M`, sub: 'Approved program', Icon: DollarSign, color: 'bg-blue-500' },
          { label: 'Actuals to Date', value: `$${(summary.total_actuals_m ?? 0).toFixed(0)}M`, sub: `${(summary.budget_utilisation_pct ?? 0).toFixed(1)}% utilised`, Icon: TrendingUp, color: 'bg-purple-500' },
          { label: 'Active Projects', value: String(summary.active_projects ?? 0), sub: `${summary.completed_projects ?? 0} completed`, Icon: Clock, color: 'bg-yellow-500' },
          { label: 'On-Time Rate', value: `${(summary.on_time_pct ?? 0).toFixed(1)}%`, sub: 'Projects on schedule', Icon: CheckCircle, color: (summary.on_time_pct ?? 0) >= 80 ? 'bg-green-500' : 'bg-orange-500' },
        ].map((k, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-lg ${k.color}`}><k.Icon size={20} className="text-white" /></div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{k.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Budget vs Actuals chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Budget vs Actuals by Project Category ($M)</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryBudgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="budget" fill="#6B7280" name="Budget ($M)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actuals" fill="#3B82F6" name="Actuals ($M)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={dnspFilter} onChange={e => setDnspFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All DNSPs</option>
          <option value="AusNet Services">AusNet Services</option>
          <option value="Ergon Energy">Ergon Energy</option>
          <option value="Energex">Energex</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          {(Object.keys(STATUS_STYLES) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Project register */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Project Register ({projects.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Project ID</th>
                  <th className="pb-2 pr-3">DNSP</th>
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3">AER Status</th>
                  <th className="pb-2 pr-3">Budget $M</th>
                  <th className="pb-2 pr-3">Actuals $M</th>
                  <th className="pb-2 pr-3">Completion</th>
                  <th className="pb-2 pr-3">End Date</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {projects.slice(0, 40).map((p, i) => {
                  const pct = p.completion_pct ?? 0
                  return (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-1.5 pr-3 font-mono">{p.project_id}</td>
                      <td className="py-1.5 pr-3">{p.dnsp}</td>
                      <td className="py-1.5 pr-3 max-w-[160px] truncate">{p.project_name}</td>
                      <td className="py-1.5 pr-3">{p.category}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${p.aer_approved ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{p.aer_approved ? 'AER Approved' : 'Pending'}</span>
                      </td>
                      <td className="py-1.5 pr-3">{p.budget_m_aud?.toFixed(1)}</td>
                      <td className="py-1.5 pr-3">{p.actual_spend_m_aud?.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 w-28">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 font-mono">{p.target_completion_date?.slice(0, 10)}</td>
                      <td className="py-1.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[p.status] ?? ''}`}>{p.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Capex vs Opex analysis */}
      {capexOpex.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Capex / Opex Analysis by DNSP & Year</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={capexOpex.slice(0, 12).map(r => ({ label: `${r.dnsp.split(' ')[0]} ${r.period_year}`, capex: Math.round(r.capex_aud / 1e5) / 10, opex: Math.round(r.opex_aud / 1e5) / 10 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#F9FAFB' }} itemStyle={{ color: '#D1D5DB' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
              <Bar dataKey="capex" fill="#3B82F6" name="Capex ($M)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="opex" fill="#8B5CF6" name="Opex ($M)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
