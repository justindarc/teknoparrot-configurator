/**
 * Application-level settings, persisted by this app itself (via electron-store),
 * as opposed to TeknoParrot's own on-disk settings. Keep this file free of any
 * Node or Electron imports so it can be bundled into the sandboxed renderer.
 */
export interface AppSettings {
  /** Root directory of the TeknoParrot installation. */
  teknoParrotPath: string
  /** UI colour scheme preference. */
  themeMode: "light" | "dark" | "system"
}

export const defaultSettings: AppSettings = {
  teknoParrotPath: "",
  themeMode: "system",
}
