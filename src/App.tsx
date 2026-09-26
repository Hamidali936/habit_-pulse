import { useState } from 'react'
import { Activity, Database, LogOut, Plus, RotateCcw, Upload } from 'lucide-react'
import { AuthGate } from './components/AuthGate'
import { MetricCharts, WeeklyChart } from './components/Charts'
import { AddHabitDialog, ImportDialog, LogMetricDialog } from './components/Dialogs'
import { HabitGrid } from './components/HabitGrid'
import { StatCards } from './components/StatCards'
import { useRepo } from './hooks/useRepo'
import { resetLocalDemo } from './lib/localRepo'
import { supabase } from './lib/supabase'

type Dialog = 'habit' | 'metric' | 'import' | null

function Dashboard() {
  const { repo, data, loading, error, run } = useRepo()
  const [dialog, setDialog] = useState<Dialog>(null)

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Activity className="size-6 text-emerald-400" />
          <h1 className="font-semibold text-lg">HabitPulse</h1>
          <span className={`ml-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${repo.mode === 'supabase' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
            <Database className="size-3" />
            {repo.mode === 'supabase' ? 'Supabase · live' : 'Demo mode · local'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn" onClick={() => setDialog('import')}><Upload className="size-4" />Import CSV</button>
            <button className="btn" onClick={() => setDialog('metric')}><Plus className="size-4" />Log metric</button>
            <button className="btn-primary" onClick={() => setDialog('habit')}><Plus className="size-4" />Habit</button>
            {repo.mode === 'local' ? (
              <button className="btn-icon" title="Reset demo data" onClick={() => { resetLocalDemo(); location.reload() }}><RotateCcw className="size-4" /></button>
            ) : (
              <button className="btn-icon" title="Sign out" onClick={() => void supabase?.auth.signOut()}><LogOut className="size-4" /></button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}
        {loading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <>
            <StatCards habits={data.habits} logs={data.logs} streaks={data.streaks} weekly={data.weekly} />

            <section className="card">
              <SectionTitle>Habits · last 14 days</SectionTitle>
              <HabitGrid
                habits={data.habits}
                logs={data.logs}
                streaks={data.streaks}
                onToggle={(id, date) => void run(() => repo.toggleLog(id, date))}
                onArchive={(id) => { if (confirm('Archive this habit?')) void run(() => repo.archiveHabit(id)) }}
              />
            </section>

            <section className="card">
              <SectionTitle>Weekly completion · last 12 weeks</SectionTitle>
              <WeeklyChart weekly={data.weekly} />
            </section>

            <section>
              <SectionTitle>Health metrics</SectionTitle>
              <MetricCharts metrics={data.metrics} trends={data.trends} />
            </section>
          </>
        )}
      </main>

      {dialog === 'habit' && (
        <AddHabitDialog onClose={() => setDialog(null)} onSave={(h) => { setDialog(null); void run(() => repo.addHabit(h)) }} />
      )}
      {dialog === 'metric' && (
        <LogMetricDialog
          metrics={data.metrics}
          onClose={() => setDialog(null)}
          onSave={(key, label, unit, date, value) => { setDialog(null); void run(() => repo.logMetric(key, label, unit, date, value)) }}
        />
      )}
      {dialog === 'import' && (
        <ImportDialog onClose={() => setDialog(null)} onImport={(rows) => run(() => repo.importRows(rows))} />
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-medium text-zinc-400 mb-3">{children}</h2>
}

export default function App() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}
