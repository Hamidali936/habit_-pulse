import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import type { Habit, HabitLog, HabitStreak, ISODate, MetricEntry, MetricTrendPoint, WeeklyCompletion } from './types'

// JS mirrors of the SQL views, used for local/demo mode.

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const today = (): ISODate => toISO(new Date())

export function computeStreaks(habits: Habit[], logs: HabitLog[]): HabitStreak[] {
  const now = parseISO(today())
  return habits.map((h) => {
    const dates = [...new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.log_date))].sort()
    let best = 0
    let current = 0
    let run = 0
    for (let i = 0; i < dates.length; i++) {
      const prev = i > 0 ? parseISO(dates[i - 1]) : null
      const cur = parseISO(dates[i])
      run = prev && differenceInCalendarDays(cur, prev) === 1 ? run + 1 : 1
      best = Math.max(best, run)
      if (i === dates.length - 1) {
        current = differenceInCalendarDays(now, cur) <= 1 ? run : 0
      }
    }
    const within = (days: number) =>
      dates.filter((d) => differenceInCalendarDays(now, parseISO(d)) < days).length
    return {
      habit_id: h.id,
      current_streak: current,
      best_streak: best,
      done_last_7: within(7),
      done_last_30: within(30),
      total: dates.length,
    }
  })
}

export function computeTrends(entries: MetricEntry[]): MetricTrendPoint[] {
  const byMetric = new Map<string, MetricEntry[]>()
  for (const e of entries) {
    const list = byMetric.get(e.metric_id) ?? []
    list.push(e)
    byMetric.set(e.metric_id, list)
  }
  const out: MetricTrendPoint[] = []
  for (const list of byMetric.values()) {
    list.sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    list.forEach((e, i) => {
      const win = (n: number) => {
        const slice = list.slice(Math.max(0, i - n + 1), i + 1)
        return slice.reduce((s, x) => s + x.value, 0) / slice.length
      }
      out.push({
        metric_id: e.metric_id,
        entry_date: e.entry_date,
        value: e.value,
        avg_7d: win(7),
        avg_30d: win(30),
        delta: i > 0 ? e.value - list[i - 1].value : null,
      })
    })
  }
  return out
}

export function computeWeekly(habits: Habit[], logs: HabitLog[]): WeeklyCompletion[] {
  const active = habits.filter((h) => !h.archived_at)
  const target = active.reduce((s, h) => s + h.target_per_week, 0)
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weeks: WeeklyCompletion[] = []
  for (let i = 11; i >= 0; i--) {
    const start = subWeeks(thisWeek, i)
    const end = addDays(start, 7)
    const completed = logs.filter((l) => {
      const d = parseISO(l.log_date)
      return d >= start && d < end && active.some((h) => h.id === l.habit_id)
    }).length
    weeks.push({
      week_start: toISO(start),
      completed,
      target,
      pct: Math.min(100, Math.round((100 * completed) / Math.max(target, 1))),
    })
  }
  return weeks
}
