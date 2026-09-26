import { useCallback, useEffect, useMemo, useState } from 'react'
import { createLocalRepo } from '../lib/localRepo'
import { createSupabaseRepo } from '../lib/supabaseRepo'
import { supabase } from '../lib/supabase'
import type { Repo, Snapshot } from '../lib/types'

const EMPTY: Snapshot = { habits: [], logs: [], streaks: [], metrics: [], trends: [], weekly: [] }

export function useRepo() {
  const repo: Repo = useMemo(() => (supabase ? createSupabaseRepo(supabase) : createLocalRepo()), [])
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setData(await repo.load())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void refresh()
    return repo.subscribe(() => void refresh())
  }, [repo, refresh])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn()
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [refresh],
  )

  return { repo, data, loading, error, refresh, run }
}
