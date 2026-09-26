import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const sb = supabase
  if (!sb || session) return <>{children}</>
  if (!ready) return null

  const submit = async (mode: 'signin' | 'signup') => {
    setBusy(true)
    setMsg(null)
    const { error } =
      mode === 'signin'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Check your inbox to confirm your email, then sign in.')
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit('signin')
        }}
        className="card w-full max-w-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity className="size-6" />
          <h1 className="text-xl font-semibold text-zinc-100">HabitPulse</h1>
        </div>
        <p className="text-sm text-zinc-400">Sign in to sync habits and health metrics across devices.</p>
        <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {msg && <p className="text-sm text-amber-400">{msg}</p>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" type="submit" disabled={busy}>Sign in</button>
          <button className="btn flex-1" type="button" disabled={busy} onClick={() => void submit('signup')}>Create account</button>
        </div>
      </form>
    </div>
  )
}
