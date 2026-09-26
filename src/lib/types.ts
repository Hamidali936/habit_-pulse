export type ISODate = string // 'YYYY-MM-DD'

export interface Habit {
  id: string
  name: string
  emoji: string
  color: string
  target_per_week: number
  sort_order: number
  archived_at: string | null
}

export interface HabitLog {
  habit_id: string
  log_date: ISODate
}

export interface HabitStreak {
  habit_id: string
  current_streak: number
  best_streak: number
  done_last_7: number
  done_last_30: number
  total: number
}

export interface Metric {
  id: string
  key: string
  label: string
  unit: string
  color: string
}

export interface MetricEntry {
  metric_id: string
  entry_date: ISODate
  value: number
}

export interface MetricTrendPoint {
  metric_id: string
  entry_date: ISODate
  value: number
  avg_7d: number
  avg_30d: number
  delta: number | null
}

export interface WeeklyCompletion {
  week_start: ISODate
  completed: number
  target: number
  pct: number
}

export interface ImportRow {
  key: string
  label?: string
  unit?: string
  date: ISODate
  value: number
  source?: string
}

export interface NewHabit {
  name: string
  emoji: string
  color: string
  target_per_week: number
}

export interface Snapshot {
  habits: Habit[]
  logs: HabitLog[]
  streaks: HabitStreak[]
  metrics: Metric[]
  trends: MetricTrendPoint[]
  weekly: WeeklyCompletion[]
}

export interface Repo {
  readonly mode: 'supabase' | 'local'
  load(): Promise<Snapshot>
  addHabit(h: NewHabit): Promise<void>
  archiveHabit(id: string): Promise<void>
  toggleLog(habitId: string, date: ISODate): Promise<void>
  logMetric(key: string, label: string, unit: string, date: ISODate, value: number): Promise<void>
  importRows(rows: ImportRow[]): Promise<number>
  subscribe(onChange: () => void): () => void
}
