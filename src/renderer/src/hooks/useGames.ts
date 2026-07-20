import { useCallback, useEffect, useState } from "react"
import type { GameSummary } from "@shared/teknoparrot"

/**
 * Loads the TeknoParrot game catalog from the main process. Reloads whenever
 * `enabled` becomes true (i.e. once a valid install path is known).
 */
export function useGames(enabled: boolean): {
  games: GameSummary[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setGames(await window.api.listGames())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  return { games, loading, error, reload }
}
