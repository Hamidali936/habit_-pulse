import { subDays, format, parseISO, isToday } from 'date-fns'
import { Flame, Trash2, Trophy } from 'lucide-react'
import { toISO } from '../lib/stats'
import type { Habit, HabitLog, HabitStreak, ISODate } from '../lib/types'

interface Props {
  habits: Habit[]
  logs: HabitLog[]
  streaks: HabitStreak[]
  days?: number
  onToggle: (habitId: string, date: ISODate) => void
  onArchive: (habitId: string) => void
}

export function HabitGrid({ habits, logs, streaks, days = 14, onToggle, onArchive }: Props) {
  const dates: ISODate[] = Array.from({ length: days }, (_, i) => toISO(subDays(new Date(), days - 1 - i)))
  const done = new Set(logs.map((l) => `${l.habit_id}|${l.log_date}`))
  const streakOf = (id: string) => streaks.find((s) => s.habit_id === id)

  if (habits.length === 0) {
    return <p className="text-zinc-500 text-sm">No habits yet — add one to start tracking.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="text-left font-medium pl-1">Habit</th>
            {dates.map((d) => {
              const dt = parseISO(d)
              return (
                <th key={d} className={`font-medium w-9 ${isToday(dt) ? 'text-emerald-400' : ''}`}>
                  <div>{format(dt, 'EEEEE')}</div>
                  <div className="text-[10px] text-zinc-600">{format(dt, 'd')}</div>
                </th>
              )
            })}
            <th className="font-medium text-right pr-1">Streak</th>
            <th className="font-medium text-right pr-1">7d</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => {
            const s = streakOf(h.id)
            return (
              <tr key={h.id} className="group">
                <td className="pl-1 pr-3 whitespace-nowrap">
                  <span className="mr-2">{h.emoji}</span>
                  <span className="text-sm text-zinc-200">{h.name}</span>
                </td>
                {dates.map((d) => {
                  const on = done.has(`${h.id}|${d}`)
                  return (
                    <td key={d} className="text-center">
                      <button
                        aria-label={`${h.name} on ${d}`}
                        aria-pressed={on}
                        onClick={() => onToggle(h.id, d)}
                        className="size-7 rounded-md border transition-all hover:scale-110"
                        style={{
                          backgroundColor: on ? h.color : 'transparent',
                          borderColor: on ? h.color : '#3f3f46',
                          boxShadow: on ? `0 0 12px ${h.color}55` : undefined,
                        }}
                      />
                    </td>
                  )
                })}
                <td className="text-right pr-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-sm text-orange-400">
                    <Flame className="size-3.5" />
                    {s?.current_streak ?? 0}
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-500" title="Best streak">
                    <Trophy className="size-3" />
                    {s?.best_streak ?? 0}
                  </span>
                </td>
                <td className="text-right pr-1 text-sm text-zinc-400 whitespace-nowrap">
                  {s?.done_last_7 ?? 0}/{h.target_per_week}
                </td>
                <td>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition"
                    title="Archive habit"
                    onClick={() => onArchive(h.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
