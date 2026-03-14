import { useState, useEffect, useCallback } from 'react'
import {
  settlementBackOfficeApi,
  SettlementRun,
  SettlementCharge,
  SettlementDisputeEnhanced,
  SettlementJournal,
  SettlementEvidence,
  GlMapping,
  AccrualEntry,
  DisputeWorkflowState,
} from '../api/client'

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const RUN_TYPES = ['PRELIM', 'FINAL', 'R1', 'R2', 'R3']
const RUN_STATUSES = ['PENDING', 'VALIDATED', 'ACCEPTED', 'DISPUTED', 'FAILED']
const CHARGE_TYPES = ['ENERGY', 'FCAS_RAISE', 'FCAS_LOWER', 'SRA_RESIDUE', 'ANCILLARY', 'RERT', 'ADMIN']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const WORKFLOW_STATES: DisputeWorkflowState[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED']

const WORKFLOW_COLORS: Record<string, string> = {
  DRAFT: '#6B7280',
  SUBMITTED: '#3B82F6',
  UNDER_REVIEW: '#F59E0B',
  ACCEPTED: '#10B981',
  REJECTED: '#EF4444',
  CLOSED: '#8B5CF6',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  VALIDATED: '#3B82F6',
  ACCEPTED: '#10B981',
  DISPUTED: '#EF4444',
  FAILED: '#6B7280',
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '$0.00'
  return '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  )
}

// =========================================================================
// TABS
// =========================================================================

type TabKey = 'runs' | 'recon' | 'trueup' | 'disputes' | 'finance' | 'gl'

export default function SettlementBackOffice() {
  const [tab, setTab] = useState<TabKey>('runs')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'runs', label: 'Runs' },
    { key: 'recon', label: 'Reconciliation' },
    { key: 'trueup', label: 'True-Up' },
    { key: 'disputes', label: 'Disputes' },
    { key: 'finance', label: 'Finance' },
    { key: 'gl', label: 'GL Config' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Settlement Back Office</h1>
      <p style={{ color: '#6B7280', marginBottom: 20, fontSize: 14 }}>
        AEMO settlement ingestion, true-up analysis, dispute management, and finance-ready outputs
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #3B82F6' : '2px solid transparent',
              color: tab === t.key ? '#3B82F6' : '#6B7280',
              fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'runs' && <RunsTab />}
      {tab === 'recon' && <ReconTab />}
      {tab === 'trueup' && <TrueUpTab />}
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'gl' && <GlConfigTab />}
    </div>
  )
}

// =========================================================================
// Runs Tab
// =========================================================================

function RunsTab() {
  const [runs, setRuns] = useState<SettlementRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [charges, setCharges] = useState<SettlementCharge[]>([])
  const [regionFilter, setRegionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const fetchRuns = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (regionFilter) params.region = regionFilter
      if (typeFilter) params.run_type = typeFilter
      const data = await settlementBackOfficeApi.listRuns(params)
      setRuns(data.runs || [])
    } catch { setRuns([]) }
    setLoading(false)
  }, [regionFilter, typeFilter])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  const toggleExpand = async (runId: string) => {
    if (expanded === runId) { setExpanded(null); setCharges([]); return }
    setExpanded(runId)
    try {
      const data = await settlementBackOfficeApi.getRunCharges(runId)
      setCharges(data.charges || [])
    } catch { setCharges([]) }
  }

  const totalAemo = runs.reduce((s, r) => s + (r.aemo_total_aud || 0), 0)
  const totalVariance = runs.reduce((s, r) => s + (r.variance_aud || 0), 0)
  const pending = runs.filter(r => r.status === 'PENDING').length
  const accepted = runs.filter(r => r.status === 'ACCEPTED').length

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Total Runs" value={String(runs.length)} />
        <KpiCard label="Accepted" value={String(accepted)} color="#10B981" />
        <KpiCard label="Pending" value={String(pending)} color="#F59E0B" />
        <KpiCard label="Net AEMO AUD" value={fmt(totalAemo)} sub={`Variance: ${fmt(totalVariance)}`} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={selectStyle}>
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>+ Create Run</button>
      </div>

      {showCreate && <CreateRunForm onCreated={() => { setShowCreate(false); fetchRuns() }} />}

      {/* Table */}
      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead>
            <tr>
              {['Type', 'Period', 'Region', 'Run Date', 'Status', 'AEMO AUD', 'Variance', 'Auto'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <>
                <tr key={r.run_id} onClick={() => toggleExpand(r.run_id)} style={{ cursor: 'pointer' }}>
                  <td style={tdStyle}>{r.run_type}</td>
                  <td style={tdStyle}>{r.billing_period}</td>
                  <td style={tdStyle}>{r.region}</td>
                  <td style={tdStyle}>{r.run_date}</td>
                  <td style={tdStyle}><Badge label={r.status} color={STATUS_COLORS[r.status] || '#6B7280'} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.aemo_total_aud)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: (r.variance_aud || 0) < 0 ? '#EF4444' : '#10B981' }}>
                    {fmt(r.variance_aud)} ({(r.variance_pct || 0).toFixed(2)}%)
                  </td>
                  <td style={tdStyle}>{r.auto_accept ? 'Yes' : 'No'}</td>
                </tr>
                {expanded === r.run_id && (
                  <tr key={r.run_id + '-exp'}>
                    <td colSpan={8} style={{ padding: '8px 16px', background: '#F9FAFB' }}>
                      <strong>Charges ({charges.length})</strong>
                      {charges.length === 0 ? <p style={{ fontSize: 13, color: '#6B7280' }}>No charges</p> : (
                        <table style={{ ...tableStyle, marginTop: 8 }}>
                          <thead><tr>
                            {['Type', 'Code', 'Region', 'Date', 'AEMO', 'Internal', 'Variance', 'Mapped'].map(h => (
                              <th key={h} style={thStyle}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {charges.map(c => (
                              <tr key={c.charge_id}>
                                <td style={tdStyle}>{c.charge_type}</td>
                                <td style={tdStyle}>{c.charge_code}</td>
                                <td style={tdStyle}>{c.region}</td>
                                <td style={tdStyle}>{c.interval_date}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.aemo_amount_aud)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.internal_amount_aud)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.variance_aud)}</td>
                                <td style={tdStyle}><Badge label={c.mapped_status} color={c.mapped_status === 'MAPPED' ? '#10B981' : '#F59E0B'} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CreateRunForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ run_type: 'PRELIM', billing_period: '', region: 'NSW1', run_date: '', aemo_total_aud: 0, internal_total_aud: 0, notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await settlementBackOfficeApi.createRun(form)
      onCreated()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  return (
    <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <select value={form.run_type} onChange={e => setForm({ ...form, run_type: e.target.value })} style={selectStyle}>
        {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input placeholder="Period (YYYY-MM)" value={form.billing_period} onChange={e => setForm({ ...form, billing_period: e.target.value })} style={inputStyle} />
      <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={selectStyle}>
        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input type="date" value={form.run_date} onChange={e => setForm({ ...form, run_date: e.target.value })} style={inputStyle} />
      <input type="number" placeholder="AEMO AUD" value={form.aemo_total_aud || ''} onChange={e => setForm({ ...form, aemo_total_aud: Number(e.target.value) })} style={inputStyle} />
      <input type="number" placeholder="Internal AUD" value={form.internal_total_aud || ''} onChange={e => setForm({ ...form, internal_total_aud: Number(e.target.value) })} style={inputStyle} />
      <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
      <button onClick={submit} disabled={submitting} style={btnPrimary}>{submitting ? 'Creating...' : 'Create'}</button>
    </div>
  )
}

// =========================================================================
// Reconciliation Tab
// =========================================================================

function ReconTab() {
  const [recon, setRecon] = useState<any>(null)
  const [daysBack, setDaysBack] = useState(7)
  const [loading, setLoading] = useState(true)

  const fetchRecon = useCallback(async () => {
    setLoading(true)
    try {
      const data = await settlementBackOfficeApi.reconciliation(daysBack)
      setRecon(data)
    } catch { setRecon(null) }
    setLoading(false)
  }, [daysBack])

  useEffect(() => { fetchRecon() }, [fetchRecon])

  if (loading) return <p>Loading reconciliation...</p>
  if (!recon) return <p style={{ color: '#6B7280' }}>No reconciliation data</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>Days Back:</label>
        <input type="number" value={daysBack} onChange={e => setDaysBack(Number(e.target.value))} min={1} max={90} style={{ ...inputStyle, width: 80 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="AEMO Settlement" value={fmt(recon.total_aemo_settlement)} />
        <KpiCard label="Internal Settlement" value={fmt(recon.total_internal_settlement)} />
        <KpiCard label="Variance" value={fmt(recon.variance)} color={Math.abs(recon.variance) > 10000 ? '#EF4444' : '#10B981'} sub={`${recon.variance_pct?.toFixed(2)}%`} />
        <KpiCard label="Threshold Breaches" value={String(recon.threshold_breaches)} color={recon.threshold_breaches > 0 ? '#EF4444' : '#10B981'} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Variance by Region</h3>
      <table style={tableStyle}>
        <thead><tr>
          {['Region', 'AEMO AUD', 'Internal AUD', 'Variance', '%', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {(recon.variances_by_region || []).map((v: any) => (
            <tr key={v.region}>
              <td style={tdStyle}>{v.region}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(v.aemo_aud)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(v.internal_aud)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(v.variance_aud)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{v.variance_pct?.toFixed(2)}%</td>
              <td style={tdStyle}><Badge label={v.status} color={v.status === 'BREACH' ? '#EF4444' : '#10B981'} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {recon.residues?.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>SRA Residues</h3>
          <table style={tableStyle}>
            <thead><tr>
              {['Interconnector', 'Flow MW', 'Residue AUD', 'Direction'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recon.residues.map((r: any) => (
                <tr key={r.interconnector_id}>
                  <td style={tdStyle}>{r.interconnector_id}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.flow_mw?.toFixed(1)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.settlement_residue_aud)}</td>
                  <td style={tdStyle}><Badge label={r.direction} color={r.direction === 'EXPORT' ? '#3B82F6' : '#F59E0B'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// =========================================================================
// True-Up Tab
// =========================================================================

function TrueUpTab() {
  const [threshold, setThreshold] = useState(5000)
  const [material, setMaterial] = useState<SettlementRun[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMaterial = useCallback(async () => {
    setLoading(true)
    try {
      const data = await settlementBackOfficeApi.trueupMaterial(threshold)
      setMaterial(data.material_runs || [])
    } catch { setMaterial([]) }
    setLoading(false)
  }, [threshold])

  useEffect(() => { fetchMaterial() }, [fetchMaterial])

  const handleAccept = async (runId: string) => {
    try {
      await settlementBackOfficeApi.trueupAccept(runId)
      fetchMaterial()
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Materiality Threshold (AUD):</label>
        <input type="range" min={1000} max={50000} step={1000} value={threshold} onChange={e => setThreshold(Number(e.target.value))} style={{ width: 200 }} />
        <span style={{ fontWeight: 600 }}>{fmt(threshold)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Material Runs" value={String(material.length)} color={material.length > 0 ? '#EF4444' : '#10B981'} />
        <KpiCard label="Total Variance" value={fmt(material.reduce((s, r) => s + Math.abs(r.variance_aud || 0), 0))} />
        <KpiCard label="Threshold" value={fmt(threshold)} />
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead><tr>
            {['Type', 'Period', 'Region', 'AEMO AUD', 'Variance', 'Var %', 'Status', 'Action'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {material.map(r => (
              <tr key={r.run_id}>
                <td style={tdStyle}>{r.run_type}</td>
                <td style={tdStyle}>{r.billing_period}</td>
                <td style={tdStyle}>{r.region}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.aemo_total_aud)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#EF4444' }}>{fmt(r.variance_aud)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{(r.variance_pct || 0).toFixed(2)}%</td>
                <td style={tdStyle}><Badge label={r.status} color={STATUS_COLORS[r.status] || '#6B7280'} /></td>
                <td style={tdStyle}>
                  <button onClick={() => handleAccept(r.run_id)} style={{ ...btnSmall, background: '#10B981' }}>Accept</button>
                </td>
              </tr>
            ))}
            {material.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#6B7280' }}>No material variances above threshold</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// =========================================================================
// Disputes Tab
// =========================================================================

function DisputesTab() {
  const [disputes, setDisputes] = useState<SettlementDisputeEnhanced[]>([])
  const [summary, setSummary] = useState<{ by_workflow_state: Record<string, number>; total_disputes: number; total_variance_aud: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDispute, setSelectedDispute] = useState<SettlementDisputeEnhanced | null>(null)
  const [evidence, setEvidence] = useState<SettlementEvidence[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [wsFilter, setWsFilter] = useState('')

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (wsFilter) params.workflow_state = wsFilter
      const [disp, sum] = await Promise.all([
        settlementBackOfficeApi.listDisputes(params),
        settlementBackOfficeApi.disputeSummary(),
      ])
      setDisputes(disp.disputes || [])
      setSummary(sum)
    } catch { setDisputes([]) }
    setLoading(false)
  }, [wsFilter])

  useEffect(() => { fetchDisputes() }, [fetchDisputes])

  const openDetail = async (d: SettlementDisputeEnhanced) => {
    setSelectedDispute(d)
    try {
      const [ev, tl] = await Promise.all([
        settlementBackOfficeApi.listEvidence(d.dispute_id),
        settlementBackOfficeApi.disputeTimeline(d.dispute_id),
      ])
      setEvidence(ev.evidence || [])
      setTimeline(tl.timeline || [])
    } catch { setEvidence([]); setTimeline([]) }
  }

  const handleTransition = async (disputeId: string, target: DisputeWorkflowState) => {
    try {
      const res = await settlementBackOfficeApi.transitionDispute(disputeId, target)
      if (res.error) { alert(res.error); return }
      fetchDisputes()
      setSelectedDispute(null)
    } catch { /* ignore */ }
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {WORKFLOW_STATES.map(ws => (
          <KpiCard key={ws} label={ws} value={String(summary?.by_workflow_state?.[ws] || 0)} color={WORKFLOW_COLORS[ws]} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <select value={wsFilter} onChange={e => setWsFilter(e.target.value)} style={selectStyle}>
          <option value="">All States</option>
          {WORKFLOW_STATES.map(ws => <option key={ws} value={ws}>{ws}</option>)}
        </select>
        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>+ New Dispute</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6B7280' }}>
          Total: {summary?.total_disputes || 0} | Variance: {fmt(summary?.total_variance_aud || 0)}
        </span>
      </div>

      {showCreate && <CreateDisputeForm onCreated={() => { setShowCreate(false); fetchDisputes() }} />}

      {/* Dispute List */}
      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead><tr>
            {['Region', 'Date', 'Type', 'AEMO', 'Variance', 'Priority', 'Workflow', 'Assigned'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {disputes.map(d => (
              <tr key={d.dispute_id} onClick={() => openDetail(d)} style={{ cursor: 'pointer' }}>
                <td style={tdStyle}>{d.region}</td>
                <td style={tdStyle}>{d.settlement_date}</td>
                <td style={tdStyle}>{d.dispute_type}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(d.aemo_amount_aud)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#EF4444' }}>{fmt(d.variance_aud)}</td>
                <td style={tdStyle}><Badge label={d.priority || 'MEDIUM'} color={d.priority === 'CRITICAL' ? '#EF4444' : d.priority === 'HIGH' ? '#F59E0B' : '#6B7280'} /></td>
                <td style={tdStyle}><Badge label={d.workflow_state || 'DRAFT'} color={WORKFLOW_COLORS[d.workflow_state || 'DRAFT']} /></td>
                <td style={tdStyle}>{d.assigned_to || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail slide-out */}
      {selectedDispute && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,.1)', zIndex: 999, overflow: 'auto', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Dispute Detail</h3>
            <button onClick={() => setSelectedDispute(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 16 }}>
            <div><strong>Region:</strong> {selectedDispute.region}</div>
            <div><strong>Date:</strong> {selectedDispute.settlement_date}</div>
            <div><strong>Type:</strong> {selectedDispute.dispute_type}</div>
            <div><strong>Priority:</strong> {selectedDispute.priority}</div>
            <div><strong>AEMO:</strong> {fmt(selectedDispute.aemo_amount_aud)}</div>
            <div><strong>Internal:</strong> {fmt(selectedDispute.internal_amount_aud)}</div>
            <div><strong>Variance:</strong> <span style={{ color: '#EF4444' }}>{fmt(selectedDispute.variance_aud)}</span></div>
            <div><strong>State:</strong> <Badge label={selectedDispute.workflow_state || 'DRAFT'} color={WORKFLOW_COLORS[selectedDispute.workflow_state || 'DRAFT']} /></div>
            <div><strong>Assigned:</strong> {selectedDispute.assigned_to || '-'}</div>
            <div><strong>AEMO Ref:</strong> {selectedDispute.aemo_case_ref || '-'}</div>
          </div>

          {selectedDispute.description && <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>{selectedDispute.description}</p>}

          {/* Transitions */}
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 13 }}>Transition to:</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {getValidTransitions(selectedDispute.workflow_state || 'DRAFT').map(t => (
                <button key={t} onClick={() => handleTransition(selectedDispute.dispute_id, t)} style={{ ...btnSmall, background: WORKFLOW_COLORS[t] }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Evidence ({evidence.length})</h4>
          {evidence.length === 0 ? <p style={{ fontSize: 13, color: '#6B7280' }}>No evidence attached</p> : (
            <div style={{ marginBottom: 16 }}>
              {evidence.map(e => (
                <div key={e.evidence_id} style={{ padding: 8, background: '#F9FAFB', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                  <Badge label={e.evidence_type} color="#3B82F6" /> {e.filename || 'untitled'} — {e.uploaded_by}, {e.uploaded_at}
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Audit Timeline ({timeline.length})</h4>
          {timeline.length === 0 ? <p style={{ fontSize: 13, color: '#6B7280' }}>No CDF history</p> : (
            <div>
              {timeline.map((t, i) => (
                <div key={i} style={{ padding: 8, borderLeft: '2px solid #3B82F6', paddingLeft: 12, marginBottom: 8, fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{t._change_type} — v{t._commit_version}</div>
                  <div style={{ color: '#6B7280' }}>{t._commit_timestamp}</div>
                  <div>Status: {t.status} | Workflow: {t.workflow_state}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreateDisputeForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    region: 'NSW1', settlement_date: '', dispute_type: 'ENERGY_AMOUNT',
    aemo_amount_aud: 0, internal_amount_aud: 0, description: '',
    priority: 'MEDIUM', assigned_to: '', aemo_case_ref: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await settlementBackOfficeApi.createDisputeV2(form)
      onCreated()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  return (
    <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={selectStyle}>
        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input type="date" value={form.settlement_date} onChange={e => setForm({ ...form, settlement_date: e.target.value })} style={inputStyle} />
      <select value={form.dispute_type} onChange={e => setForm({ ...form, dispute_type: e.target.value })} style={selectStyle}>
        {['ENERGY_AMOUNT', 'FCAS_RECOVERY', 'SRA_RESIDUE', 'PRICE'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={selectStyle}>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input type="number" placeholder="AEMO AUD" value={form.aemo_amount_aud || ''} onChange={e => setForm({ ...form, aemo_amount_aud: Number(e.target.value) })} style={inputStyle} />
      <input type="number" placeholder="Internal AUD" value={form.internal_amount_aud || ''} onChange={e => setForm({ ...form, internal_amount_aud: Number(e.target.value) })} style={inputStyle} />
      <input placeholder="Assigned To" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={inputStyle} />
      <input placeholder="AEMO Case Ref" value={form.aemo_case_ref} onChange={e => setForm({ ...form, aemo_case_ref: e.target.value })} style={inputStyle} />
      <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, gridColumn: 'span 3' }} />
      <button onClick={submit} disabled={submitting} style={btnPrimary}>{submitting ? 'Creating...' : 'Create'}</button>
    </div>
  )
}

function getValidTransitions(current: string): DisputeWorkflowState[] {
  const map: Record<string, DisputeWorkflowState[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['CLOSED'],
    REJECTED: ['DRAFT', 'CLOSED'],
    CLOSED: [],
  }
  return map[current] || []
}

// =========================================================================
// Finance Tab
// =========================================================================

function FinanceTab() {
  const [journals, setJournals] = useState<SettlementJournal[]>([])
  const [accruals, setAccruals] = useState<AccrualEntry[]>([])
  const [totals, setTotals] = useState({ debit: 0, credit: 0, accrued: 0 })
  const [loading, setLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState('')

  const fetchFinance = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | boolean> = {}
      if (periodFilter) params.period = periodFilter
      const [jData, aData] = await Promise.all([
        settlementBackOfficeApi.listJournals(params as any),
        settlementBackOfficeApi.accruals(periodFilter || undefined),
      ])
      setJournals(jData.journals || [])
      setTotals({ debit: jData.total_debit_aud, credit: jData.total_credit_aud, accrued: aData.total_accrued_aud })
      setAccruals(aData.accruals || [])
    } catch { setJournals([]); setAccruals([]) }
    setLoading(false)
  }, [periodFilter])

  useEffect(() => { fetchFinance() }, [fetchFinance])

  const handlePost = async (journalId: string) => {
    try {
      await settlementBackOfficeApi.postJournal(journalId)
      fetchFinance()
    } catch { /* ignore */ }
  }

  const handleGenerate = async (runId: string) => {
    try {
      await settlementBackOfficeApi.generateJournals({ run_id: runId })
      fetchFinance()
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Total Debit" value={fmt(totals.debit)} />
        <KpiCard label="Total Credit" value={fmt(totals.credit)} />
        <KpiCard label="Accrued (Unposted)" value={fmt(totals.accrued)} color="#F59E0B" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input placeholder="Period (YYYY-MM)" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={{ ...inputStyle, width: 160 }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>GL Journals</h3>
      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead><tr>
            {['Period', 'Type', 'Account', 'Charge', 'Region', 'Debit', 'Credit', 'Posted', ''].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {journals.map(j => (
              <tr key={j.journal_id}>
                <td style={tdStyle}>{j.period}</td>
                <td style={tdStyle}>{j.journal_type}</td>
                <td style={tdStyle}>{j.account_code} — {j.account_name}</td>
                <td style={tdStyle}>{j.charge_type}</td>
                <td style={tdStyle}>{j.region}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{j.debit_aud > 0 ? fmt(j.debit_aud) : '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{j.credit_aud > 0 ? fmt(j.credit_aud) : '-'}</td>
                <td style={tdStyle}><Badge label={j.posted ? 'POSTED' : 'UNPOSTED'} color={j.posted ? '#10B981' : '#F59E0B'} /></td>
                <td style={tdStyle}>
                  {!j.posted && <button onClick={() => handlePost(j.journal_id)} style={{ ...btnSmall, background: '#3B82F6' }}>Post</button>}
                </td>
              </tr>
            ))}
            {journals.length === 0 && (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#6B7280' }}>No journals</td></tr>
            )}
          </tbody>
        </table>
      )}

      {accruals.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Accruals</h3>
          <table style={tableStyle}>
            <thead><tr>
              {['Period', 'Charge Type', 'Region', 'Debit', 'Credit'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {accruals.map((a, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{a.period}</td>
                  <td style={tdStyle}>{a.charge_type}</td>
                  <td style={tdStyle}>{a.region}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(a.accrued_debit)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(a.accrued_credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// =========================================================================
// GL Config Tab
// =========================================================================

function GlConfigTab() {
  const [mappings, setMappings] = useState<GlMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const fetchMappings = useCallback(async () => {
    try {
      const data = await settlementBackOfficeApi.listGlMappings()
      setMappings(data.mappings || [])
    } catch { setMappings([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMappings() }, [fetchMappings])

  const handleDelete = async (mappingId: string) => {
    if (!confirm('Deactivate this GL mapping?')) return
    try {
      await settlementBackOfficeApi.deleteGlMapping(mappingId)
      fetchMappings()
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>GL Account Mappings</h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Add Mapping</button>
      </div>

      {showAdd && <GlMappingForm onCreated={() => { setShowAdd(false); fetchMappings() }} />}

      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead><tr>
            {['Charge Type', 'Debit Code', 'Debit Name', 'Credit Code', 'Credit Name', 'Active', ''].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {mappings.map(m => (
              <tr key={m.mapping_id}>
                <td style={tdStyle}><strong>{m.charge_type}</strong></td>
                <td style={tdStyle}>{m.debit_account_code}</td>
                <td style={tdStyle}>{m.debit_account_name}</td>
                <td style={tdStyle}>{m.credit_account_code}</td>
                <td style={tdStyle}>{m.credit_account_name}</td>
                <td style={tdStyle}><Badge label={m.is_active ? 'Active' : 'Inactive'} color={m.is_active ? '#10B981' : '#6B7280'} /></td>
                <td style={tdStyle}>
                  {m.is_active && <button onClick={() => handleDelete(m.mapping_id)} style={{ ...btnSmall, background: '#EF4444' }}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function GlMappingForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ charge_type: 'ENERGY', debit_account_code: '', debit_account_name: '', credit_account_code: '', credit_account_name: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await settlementBackOfficeApi.upsertGlMapping(form)
      onCreated()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  return (
    <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <select value={form.charge_type} onChange={e => setForm({ ...form, charge_type: e.target.value })} style={selectStyle}>
        {CHARGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input placeholder="Debit Code" value={form.debit_account_code} onChange={e => setForm({ ...form, debit_account_code: e.target.value })} style={inputStyle} />
      <input placeholder="Debit Name" value={form.debit_account_name} onChange={e => setForm({ ...form, debit_account_name: e.target.value })} style={inputStyle} />
      <input placeholder="Credit Code" value={form.credit_account_code} onChange={e => setForm({ ...form, credit_account_code: e.target.value })} style={inputStyle} />
      <input placeholder="Credit Name" value={form.credit_account_name} onChange={e => setForm({ ...form, credit_account_name: e.target.value })} style={inputStyle} />
      <button onClick={submit} disabled={submitting} style={btnPrimary}>{submitting ? 'Saving...' : 'Save'}</button>
    </div>
  )
}

// =========================================================================
// Shared components & styles
// =========================================================================

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 16px', border: '1px solid #E5E7EB' }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#6B7280' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #F3F4F6' }
const inputStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }
const selectStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, background: '#fff' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall: React.CSSProperties = { padding: '4px 10px', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }
