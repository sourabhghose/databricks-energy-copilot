import { useState, useEffect, useRef, useCallback } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Clock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReplaySnapshot {
    timestamp: string
    region: string
    prices: Record<string, { region: string; rrp: number; demand_mw: number; available_gen_mw: number }>
    generation: Array<{ fuel_type: string; mw: number; is_renewable: boolean }>
    interconnectors: Array<{ id: string; from_region: string; to_region: string; flow_mw: number; limit_mw: number; congested: boolean }>
    weather: { temperature_c: number; wind_kmh: number; solar_wm2: number }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const SPEEDS = [1, 5, 10, 60]

function regionColor(r: string): string {
    const map: Record<string, string> = {
        NSW1: '#3b82f6', QLD1: '#f59e0b', VIC1: '#8b5cf6', SA1: '#ef4444', TAS1: '#10b981',
    }
    return map[r] ?? '#6b7280'
}

function fuelColor(ft: string): string {
    const lower = ft.toLowerCase()
    if (lower.includes('coal')) return '#374151'
    if (lower.includes('gas')) return '#f97316'
    if (lower.includes('hydro')) return '#0ea5e9'
    if (lower.includes('wind')) return '#06b6d4'
    if (lower.includes('solar')) return '#eab308'
    if (lower.includes('batter')) return '#8b5cf6'
    return '#6b7280'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarketReplay() {
    const [region, setRegion] = useState('NSW1')
    const [date, setDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return d.toISOString().slice(0, 10)
    })
    const [snapshots, setSnapshots] = useState<ReplaySnapshot[]>([])
    const [index, setIndex] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [loading, setLoading] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Fetch range
    const loadRange = useCallback(async () => {
        setLoading(true)
        setPlaying(false)
        try {
            const start = `${date}T00:00:00Z`
            const end = `${date}T23:59:59Z`
            const params = new URLSearchParams({ start, end, region, step_minutes: '5' })
            const res = await fetch(`/api/replay/range?${params}`)
            const data = await res.json()
            setSnapshots(data.snapshots || [])
            setIndex(0)
        } catch {
            setSnapshots([])
        } finally {
            setLoading(false)
        }
    }, [date, region])

    useEffect(() => { loadRange() }, [loadRange])

    // Playback timer
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (playing && snapshots.length > 0) {
            timerRef.current = setInterval(() => {
                setIndex(prev => {
                    if (prev >= snapshots.length - 1) {
                        setPlaying(false)
                        return prev
                    }
                    return prev + 1
                })
            }, 1000 / speed)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [playing, speed, snapshots.length])

    const snap = snapshots[index] as ReplaySnapshot | undefined

    const priceCards = REGIONS.map(r => {
        const p = snap?.prices?.[r]
        return { region: r, rrp: p?.rrp ?? 0, demand: p?.demand_mw ?? 0 }
    })

    const genData = (snap?.generation || []).map(g => ({
        fuel: g.fuel_type.replace(/_/g, ' '),
        mw: g.mw,
        fill: fuelColor(g.fuel_type),
    }))

    const currentTs = snap?.timestamp ? new Date(snap.timestamp).toLocaleString() : '—'

    return (
        <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock size={22} className="text-blue-500" /> Market Replay
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Time-travel through historical NEM market states</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    />
                    <select
                        value={region}
                        onChange={e => setRegion(e.target.value)}
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    >
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={loadRange} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
                    </button>
                </div>
            </div>

            {/* Timeline slider + controls */}
            <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIndex(i => Math.max(0, i - 1))} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                        <SkipBack size={18} />
                    </button>
                    <button
                        onClick={() => setPlaying(!playing)}
                        className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {playing ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button onClick={() => setIndex(i => Math.min(snapshots.length - 1, i + 1))} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                        <SkipForward size={18} />
                    </button>

                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, snapshots.length - 1)}
                        value={index}
                        onChange={e => { setIndex(Number(e.target.value)); setPlaying(false) }}
                        className="flex-1"
                    />

                    <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-44 text-right">
                        {currentTs}
                    </span>

                    <div className="flex items-center gap-1 ml-2">
                        {SPEEDS.map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-0.5 text-xs rounded ${speed === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {snapshots.length} snapshots loaded &middot; interval {index + 1}/{snapshots.length}
                </div>
            </div>

            {/* 2x2 Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Price cards */}
                <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Spot Prices ($/MWh)</h3>
                    <div className="grid grid-cols-5 gap-2">
                        {priceCards.map(p => (
                            <div
                                key={p.region}
                                className="text-center p-2 rounded"
                                style={{ borderLeft: `3px solid ${regionColor(p.region)}` }}
                            >
                                <div className="text-xs text-gray-500">{p.region}</div>
                                <div className={`text-lg font-bold ${p.rrp > 300 ? 'text-red-600' : p.rrp < 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                    ${p.rrp.toFixed(0)}
                                </div>
                                <div className="text-[10px] text-gray-400">{p.demand.toFixed(0)} MW</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Generation bar chart */}
                <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Generation by Fuel ({region})</h3>
                    {genData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={genData} layout="vertical" margin={{ left: 80, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis type="number" tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="fuel" tick={{ fontSize: 10 }} width={75} />
                                <Tooltip />
                                <Bar dataKey="mw" name="MW">
                                    {genData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-gray-400 text-sm">No generation data</div>
                    )}
                </div>

                {/* Interconnectors */}
                <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Interconnector Flows</h3>
                    <div className="space-y-2">
                        {(snap?.interconnectors || []).map(ic => {
                            const pct = ic.limit_mw > 0 ? Math.abs(ic.flow_mw) / ic.limit_mw * 100 : 0
                            return (
                                <div key={ic.id} className="flex items-center gap-2 text-xs">
                                    <span className="w-24 font-mono text-gray-600 dark:text-gray-400 truncate">{ic.id}</span>
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative">
                                        <div
                                            className={`h-3 rounded-full ${ic.congested ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                    </div>
                                    <span className={`w-20 text-right font-mono ${ic.congested ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {ic.flow_mw.toFixed(0)} MW
                                    </span>
                                </div>
                            )
                        })}
                        {(!snap?.interconnectors || snap.interconnectors.length === 0) && (
                            <div className="text-center text-gray-400 text-sm py-4">No interconnector data</div>
                        )}
                    </div>
                </div>

                {/* Weather + Demand */}
                <div className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Weather &amp; Demand ({region})</h3>
                    {snap?.weather && Object.keys(snap.weather).length > 0 ? (
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-orange-600">{snap.weather.temperature_c?.toFixed(1) ?? '—'}°C</div>
                                <div className="text-xs text-gray-500">Temperature</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-cyan-600">{snap.weather.wind_kmh?.toFixed(0) ?? '—'} km/h</div>
                                <div className="text-xs text-gray-500">Wind Speed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-600">{snap.weather.solar_wm2?.toFixed(0) ?? '—'} W/m²</div>
                                <div className="text-xs text-gray-500">Solar</div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-20 flex items-center justify-center text-gray-400 text-sm">No weather data</div>
                    )}
                    {snap?.prices?.[region] && (
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Demand</span>
                                <span className="font-mono font-semibold">{snap.prices[region].demand_mw.toFixed(0)} MW</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-500">Available Gen</span>
                                <span className="font-mono font-semibold">{snap.prices[region].available_gen_mw.toFixed(0)} MW</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
