import { useState, type ReactNode } from 'react'
import { Upload, X } from 'lucide-react'
import { parseCsv } from '../lib/csv'
import { today } from '../lib/stats'
import type { ImportRow, Metric, NewHabit } from '../lib/types'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const COLORS = ['#10b981', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6', '#eab308', '#ef4444']
const EMOJIS = ['✅', '🏃', '📚', '🧘', '💧', '🥗', '💪', '😴', '🚭', '✍️', '🎸', '🧹']

export function AddHabitDialog({ onClose, onSave }: { onClose: () => void; onSave: (h: NewHabit) => void }) {
  const [h, setH] = useState<NewHabit>({ name: '', emoji: '✅', color: COLORS[0], target_per_week: 7 })
  return (
    <Modal title="New habit" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (h.name.trim()) onSave({ ...h, name: h.name.trim() })
        }}
      >
        <input className="input" placeholder="e.g. Drink 2L water" value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} autoFocus required maxLength={80} />
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button type="button" key={e} onClick={() => setH({ ...h, emoji: e })} className={`size-9 rounded-md text-lg ${h.emoji === e ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}>{e}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setH({ ...h, color: c })} className={`size-7 rounded-full ring-offset-2 ring-offset-zinc-900 ${h.color === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} aria-label={c} />
          ))}
        </div>
        <label className="block text-sm text-zinc-400">
          Target: <span className="text-zinc-100">{h.target_per_week}×</span> per week
          <input type="range" min={1} max={7} value={h.target_per_week} onChange={(e) => setH({ ...h, target_per_week: Number(e.target.value) })} className="w-full accent-emerald-500" />
        </label>
        <button className="btn-primary w-full" type="submit">Add habit</button>
      </form>
    </Modal>
  )
}

interface LogMetricProps {
  metrics: Metric[]
  onClose: () => void
  onSave: (key: string, label: string, unit: string, date: string, value: number) => void
}

export function LogMetricDialog({ metrics, onClose, onSave }: LogMetricProps) {
  const [key, setKey] = useState(metrics[0]?.key ?? '__new')
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState('')
  const [date, setDate] = useState(today())
  const [value, setValue] = useState('')
  const isNew = key === '__new'
  const selected = metrics.find((m) => m.key === key)
  return (
    <Modal title="Log a metric" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const v = parseFloat(value)
          if (!Number.isFinite(v)) return
          if (isNew) {
            const k = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
            if (!k) return
            onSave(k, label.trim(), unit.trim(), date, v)
          } else if (selected) {
            onSave(selected.key, selected.label, selected.unit, date, v)
          }
        }}
      >
        <select className="input" value={key} onChange={(e) => setKey(e.target.value)}>
          {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>)}
          <option value="__new">+ New metric…</option>
        </select>
        {isNew && (
          <div className="flex gap-2">
            <input className="input" placeholder="Name (e.g. Weight)" value={label} onChange={(e) => setLabel(e.target.value)} required />
            <input className="input w-24" placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2">
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
          <input className="input" type="number" step="any" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
        </div>
        <button className="btn-primary w-full" type="submit">Save</button>
      </form>
    </Modal>
  )
}

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (rows: ImportRow[]) => Promise<void> }) {
  const [preview, setPreview] = useState<{ rows: ImportRow[]; format: string; skipped: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    try {
      setPreview(parseCsv(await f.text()))
    } catch (e) {
      setPreview(null)
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const keys = preview ? [...new Set(preview.rows.map((r) => r.key))] : []

  return (
    <Modal title="Import CSV" onClose={onClose}>
      <label className="flex flex-col items-center gap-2 border border-dashed border-zinc-700 rounded-lg p-6 text-sm text-zinc-400 cursor-pointer hover:border-zinc-500">
        <Upload className="size-6" />
        <span>Drop a CSV or click to choose</span>
        <span className="text-xs text-zinc-600">date,key,value · wide (one column per metric) · Strava activities.csv</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {err && <p className="text-sm text-rose-400">{err}</p>}
      {preview && (
        <div className="text-sm space-y-2">
          <p className="text-zinc-300">
            Detected <span className="text-zinc-100">{preview.format}</span>: {preview.rows.length} entries across {keys.length} metric{keys.length === 1 ? '' : 's'}
            {preview.skipped > 0 && <span className="text-zinc-500"> · {preview.skipped} rows skipped</span>}
          </p>
          <div className="flex flex-wrap gap-1">
            {keys.map((k) => <span key={k} className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-300">{k}</span>)}
          </div>
          <button
            className="btn-primary w-full"
            disabled={busy || preview.rows.length === 0}
            onClick={async () => {
              setBusy(true)
              await onImport(preview.rows)
              setBusy(false)
              onClose()
            }}
          >
            {busy ? 'Importing…' : `Import ${preview.rows.length} entries`}
          </button>
        </div>
      )}
    </Modal>
  )
}
