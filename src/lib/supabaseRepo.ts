import type { SupabaseClient } from '@supabase/supabase-js'
import type { Habit, HabitLog, HabitStreak, ImportRow, ISODate, Metric, MetricTrendPoint, NewHabit, Repo, Snapshot, WeeklyCompletion } from './types'

export function createSupabaseRepo(sb: SupabaseClient): Repo {
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message)
  }

  return {
    mode: 'supabase',

    async load(): Promise<Snapshot> {
      const [habits, logs, streaks, metrics, trends, weekly] = await Promise.all([
        sb.from('habits').select('id,name,emoji,color,target_per_week,sort_order,archived_at').is('archived_at', null).order('sort_order').order('created_at'),
        sb.from('habit_logs').select('habit_id,log_date'),
        sb.from('habit_streaks').select('habit_id,current_streak,best_streak,done_last_7,done_last_30,total'),
        sb.from('metrics').select('id,key,label,unit,color').order('label'),
        sb.from('metric_trends').select('metric_id,entry_date,value,avg_7d,avg_30d,delta').order('entry_date'),
        sb.from('weekly_completion').select('week_start,completed,target,pct').order('week_start'),
      ])
      for (const r of [habits, logs, streaks, metrics, trends, weekly]) fail(r.error)
      return {
        habits: (habits.data ?? []) as Habit[],
        logs: (logs.data ?? []) as HabitLog[],
        streaks: (streaks.data ?? []) as HabitStreak[],
        metrics: (metrics.data ?? []) as Metric[],
        trends: ((trends.data ?? []) as MetricTrendPoint[]).map((t) => ({
          ...t,
          value: Number(t.value),
          avg_7d: Number(t.avg_7d),
          avg_30d: Number(t.avg_30d),
          delta: t.delta === null ? null : Number(t.delta),
        })),
        weekly: (weekly.data ?? []) as WeeklyCompletion[],
      }
    },

    async addHabit(h: NewHabit) {
      fail((await sb.from('habits').insert(h)).error)
    },

    async archiveHabit(id: string) {
      fail((await sb.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', id)).error)
    },

    async toggleLog(habitId: string, date: ISODate) {
      fail((await sb.rpc('toggle_habit_log', { p_habit_id: habitId, p_date: date })).error)
    },

    async logMetric(key, label, unit, date, value) {
      fail((await sb.rpc('import_metric_entries', { rows: [{ key, label, unit, date, value, source: 'manual' }] })).error)
    },

    async importRows(rows: ImportRow[]) {
      const { data, error } = await sb.rpc('import_metric_entries', { rows })
      fail(error)
      return Number(data ?? 0)
    },

    subscribe(onChange) {
      const channel = sb
        .channel('habitpulse')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'metric_entries' }, onChange)
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
