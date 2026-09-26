import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Metric, MetricTrendPoint, WeeklyCompletion } from '../lib/types'

const axis = { stroke: '#52525b', fontSize: 11, tickLine: false, axisLine: false } as const
const tooltip = {
  contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#a1a1aa' },
} as const

export function WeeklyChart({ weekly }: { weekly: WeeklyCompletion[] }) {
  const data = weekly.map((w) => ({ ...w, label: format(parseISO(w.week_start), 'MMM d') }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#27272a" />
        <XAxis dataKey="label" {...axis} />
        <YAxis domain={[0, 100]} unit="%" {...axis} />
        <Tooltip {...tooltip} formatter={(v, _n, p) => [`${v}% (${p.payload.completed}/${p.payload.target})`, 'completion']} />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]} fill="#10b981" />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface MetricProps {
  metrics: Metric[]
  trends: MetricTrendPoint[]
}

export function MetricCharts({ metrics, trends }: MetricProps) {
  const [range, setRange] = useState<30 | 60 | 90>(30)
  if (metrics.length === 0) {
    return <p className="text-zinc-500 text-sm">No metrics yet — log one or import a CSV.</p>
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-xs">
        {([30, 60, 90] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded-md ${range === r ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {r}d
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {metrics.map((m) => {
          const pts = trends.filter((t) => t.metric_id === m.id).slice(-range)
          const last = pts[pts.length - 1]
          const first = pts[0]
          const change = last && first ? last.avg_7d - first.avg_7d : 0
          return (
            <div key={m.id} className="card">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-zinc-500">{m.label}</div>
                  <div className="text-2xl font-semibold text-zinc-100 tabular-nums">
                    {last ? fmt(last.value) : '—'} <span className="text-sm text-zinc-500">{m.unit}</span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-zinc-500">7d avg {last ? fmt(last.avg_7d) : '—'}</div>
                  <div className={change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {change >= 0 ? '▲' : '▼'} {fmt(Math.abs(change))} over {range}d
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={pts.map((p) => ({ ...p, label: format(parseISO(p.entry_date), 'MMM d') }))} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#27272a" />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis domain={['auto', 'auto']} {...axis} tickFormatter={fmt} />
                  <Tooltip {...tooltip} formatter={(v, name) => [fmt(Number(v)), name === 'avg_7d' ? '7d avg' : name === 'avg_30d' ? '30d avg' : m.label]} />
                  <Area type="monotone" dataKey="value" stroke={m.color} strokeWidth={1.5} fill={`url(#g-${m.id})`} dot={false} />
                  <Line type="monotone" dataKey="avg_7d" stroke="#e4e4e7" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="avg_30d" stroke="#71717a" strokeWidth={1} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString()
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
