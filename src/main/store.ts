import Store from "electron-store"
import { type AppSettings, defaultSettings } from "@shared/types"

interface StoreSchema {
  settings: AppSettings
}

/**
 * Persistent, JSON-backed application preferences (this app's own settings —
 * not TeknoParrot's). Written to the platform `userData` directory.
 */
const store = new Store<StoreSchema>({
  defaults: { settings: defaultSettings },
})

export function getSettings(): AppSettings {
  return { ...defaultSettings, ...store.get("settings") }
}

export function saveSettings(settings: AppSettings): AppSettings {
  store.set("settings", settings)
  return getSettings()
}

/** Convenience accessor for the configured TeknoParrot root, or '' if unset. */
export function getTeknoParrotPath(): string {
  return getSettings().teknoParrotPath
}
