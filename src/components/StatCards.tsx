import { CalendarCheck, Flame, Target, TrendingUp } from 'lucide-react'
import { today } from '../lib/stats'
import type { Habit, HabitLog, HabitStreak, WeeklyCompletion } from '../lib/types'

interface Props {
  habits: Habit[]
  logs: HabitLog[]
  streaks: HabitStreak[]
  weekly: WeeklyCompletion[]
}

export function StatCards({ habits, logs, streaks, weekly }: Props) {
  const t = today()
  const doneToday = logs.filter((l) => l.log_date === t && habits.some((h) => h.id === l.habit_id)).length
  const longest = streaks.reduce((m, s) => Math.max(m, s.current_streak), 0)
  const thisWeek = weekly[weekly.length - 1]
  const lastWeek = weekly[weekly.length - 2]
  const rate30 = habits.length
    ? Math.round((100 * streaks.reduce((s, x) => s + x.done_last_30, 0)) / (habits.length * 30))
    : 0

  const cards = [
    { icon: CalendarCheck, label: 'Today', value: `${doneToday}/${habits.length}`, sub: 'habits done', color: 'text-emerald-400' },
    { icon: Flame, label: 'Longest active streak', value: `${longest}`, sub: 'days', color: 'text-orange-400' },
    {
      icon: Target,
      label: 'This week',
      value: `${thisWeek?.pct ?? 0}%`,
      sub: lastWeek ? `${(thisWeek?.pct ?? 0) - lastWeek.pct >= 0 ? '+' : ''}${(thisWeek?.pct ?? 0) - lastWeek.pct} vs last week` : 'of weekly targets',
      color: 'text-sky-400',
    },
    { icon: TrendingUp, label: '30-day consistency', value: `${rate30}%`, sub: 'of possible check-ins', color: 'text-violet-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card">
          <div className={`flex items-center gap-2 text-xs ${c.color}`}>
            <c.icon className="size-4" />
            {c.label}
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-100 tabular-nums">{c.value}</div>
          <div className="text-xs text-zinc-500">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
