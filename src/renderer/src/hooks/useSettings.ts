import { useCallback, useEffect, useState } from "react"
import { defaultSettings, type AppSettings } from "@shared/types"

/**
 * Loads application settings from the main process and exposes a persisting
 * setter. Settings are cached in state and written through on every change.
 */
export function useSettings(): {
  settings: AppSettings
  loading: boolean
  saveSettings: (settings: AppSettings) => Promise<void>
} {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    window.api
      .getSettings()
      .then((loaded) => {
        if (active) setSettings(loaded)
      })
      .catch((error) => console.error("Failed to load settings", error))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const saveSettings = useCallback(async (next: AppSettings) => {
    const saved = await window.api.saveSettings(next)
    setSettings(saved)
  }, [])

  return { settings, loading, saveSettings }
}
