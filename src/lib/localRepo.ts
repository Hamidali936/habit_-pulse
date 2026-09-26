import { subDays } from 'date-fns'
import { computeStreaks, computeTrends, computeWeekly, toISO } from './stats'
import type { Habit, HabitLog, ImportRow, ISODate, Metric, MetricEntry, NewHabit, Repo, Snapshot } from './types'

// Demo/offline mode: same shape as the Supabase repo, persisted in localStorage.

interface LocalState {
  habits: Habit[]
  logs: HabitLog[]
  metrics: Metric[]
  entries: MetricEntry[]
}

const KEY = 'habitpulse:v1'
const uid = () => crypto.randomUUID()

function seed(): LocalState {
  const habits: Habit[] = [
    { id: uid(), name: 'Morning run', emoji: '🏃', color: '#f97316', target_per_week: 4, sort_order: 0, archived_at: null },
    { id: uid(), name: 'Read 20 pages', emoji: '📚', color: '#8b5cf6', target_per_week: 7, sort_order: 1, archived_at: null },
    { id: uid(), name: 'No sugar', emoji: '🍬', color: '#ec4899', target_per_week: 5, sort_order: 2, archived_at: null },
    { id: uid(), name: 'Meditate', emoji: '🧘', color: '#14b8a6', target_per_week: 7, sort_order: 3, archived_at: null },
  ]
  const logs: HabitLog[] = []
  const rng = mulberry32(42)
  for (let i = 59; i >= 0; i--) {
    const date = toISO(subDays(new Date(), i))
    habits.forEach((h, idx) => {
      const p = [0.55, 0.85, 0.7, 0.9][idx]
      // guarantee a live streak for the demo
      if (i < 5 && idx !== 0) logs.push({ habit_id: h.id, log_date: date })
      else if (rng() < p) logs.push({ habit_id: h.id, log_date: date })
    })
  }
  const metrics: Metric[] = [
    { id: uid(), key: 'steps', label: 'Steps', unit: 'steps', color: '#22c55e' },
    { id: uid(), key: 'sleep_hours', label: 'Sleep', unit: 'h', color: '#6366f1' },
    { id: uid(), key: 'weight_kg', label: 'Weight', unit: 'kg', color: '#f59e0b' },
    { id: uid(), key: 'resting_hr', label: 'Resting HR', unit: 'bpm', color: '#ef4444' },
  ]
  const entries: MetricEntry[] = []
  let weight = 78.4
  for (let i = 59; i >= 0; i--) {
    const date = toISO(subDays(new Date(), i))
    weight += (rng() - 0.53) * 0.35
    entries.push({ metric_id: metrics[0].id, entry_date: date, value: Math.round(4000 + rng() * 9000) })
    entries.push({ metric_id: metrics[1].id, entry_date: date, value: Math.round((5.5 + rng() * 3) * 10) / 10 })
    entries.push({ metric_id: metrics[2].id, entry_date: date, value: Math.round(weight * 10) / 10 })
    entries.push({ metric_id: metrics[3].id, entry_date: date, value: Math.round(54 + rng() * 10) })
  }
  return { habits, logs, metrics, entries }
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function read(): LocalState {
  const raw = localStorage.getItem(KEY)
  if (raw) return JSON.parse(raw) as LocalState
  const s = seed()
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

export function createLocalRepo(): Repo {
  let state = read()
  const listeners = new Set<() => void>()
  const commit = () => {
    localStorage.setItem(KEY, JSON.stringify(state))
    listeners.forEach((l) => l())
  }

  const ensureMetric = (key: string, label?: string, unit?: string): Metric => {
    let m = state.metrics.find((x) => x.key === key)
    if (!m) {
      const palette = ['#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']
      m = {
        id: uid(),
        key,
        label: label ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        unit: unit ?? '',
        color: palette[state.metrics.length % palette.length],
      }
      state.metrics.push(m)
    }
    return m
  }

  const upsertEntry = (metricId: string, date: ISODate, value: number) => {
    const existing = state.entries.find((e) => e.metric_id === metricId && e.entry_date === date)
    if (existing) existing.value = value
    else state.entries.push({ metric_id: metricId, entry_date: date, value })
  }

  return {
    mode: 'local',

    async load(): Promise<Snapshot> {
      const habits = state.habits.filter((h) => !h.archived_at).sort((a, b) => a.sort_order - b.sort_order)
      return {
        habits,
        logs: state.logs,
        streaks: computeStreaks(habits, state.logs),
        metrics: [...state.metrics].sort((a, b) => a.label.localeCompare(b.label)),
        trends: computeTrends(state.entries),
        weekly: computeWeekly(state.habits, state.logs),
      }
    },

    async addHabit(h: NewHabit) {
      state.habits.push({ ...h, id: uid(), sort_order: state.habits.length, archived_at: null })
      commit()
    },

    async archiveHabit(id: string) {
      const h = state.habits.find((x) => x.id === id)
      if (h) h.archived_at = new Date().toISOString()
      commit()
    },

    async toggleLog(habitId: string, date: ISODate) {
      const idx = state.logs.findIndex((l) => l.habit_id === habitId && l.log_date === date)
      if (idx >= 0) state.logs.splice(idx, 1)
      else state.logs.push({ habit_id: habitId, log_date: date })
      commit()
    },

    async logMetric(key, label, unit, date, value) {
      upsertEntry(ensureMetric(key, label, unit).id, date, value)
      commit()
    },

    async importRows(rows: ImportRow[]) {
      for (const r of rows) upsertEntry(ensureMetric(r.key, r.label, r.unit).id, r.date, r.value)
      commit()
      return rows.length
    },

    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}

export function resetLocalDemo() {
  localStorage.removeItem(KEY)
}
