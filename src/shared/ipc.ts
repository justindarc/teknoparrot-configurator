import type { AppSettings } from "./types"
import type {
  BulkControlResult,
  BulkControlUpdate,
  BulkSettingsResult,
  BulkSettingsUpdate,
  CapturedBinding,
  GameConfig,
  GameConfigUpdate,
  GameSummary,
  GlobalSettings,
  RawInputDeviceInfo,
} from "./teknoparrot"

/**
 * Single source of truth for IPC channel names. Referencing these constants
 * in both the main and preload processes prevents typos and drift.
 */
export const IpcChannels = {
  // App settings (this app's own preferences).
  getSettings: "app:getSettings",
  saveSettings: "app:saveSettings",
  pickDirectory: "dialog:pickDirectory",
  // TeknoParrot data.
  validateInstall: "tp:validateInstall",
  getGlobalSettings: "tp:getGlobalSettings",
  saveGlobalSettings: "tp:saveGlobalSettings",
  listGames: "tp:listGames",
  getGameConfig: "tp:getGameConfig",
  saveGameConfig: "tp:saveGameConfig",
  saveGameSettings: "tp:saveGameSettings",
  saveControlBindings: "tp:saveControlBindings",
  launchGame: "tp:launchGame",
  // Input capture. XInput and DirectInput (joysticks) are polled natively in
  // main; keyboard/mouse are captured in the renderer via DOM events.
  startXInputCapture: "input:startXInputCapture",
  stopXInputCapture: "input:stopXInputCapture",
  startDirectInputCapture: "input:startDirectInputCapture",
  stopDirectInputCapture: "input:stopDirectInputCapture",
  listRawInputDevices: "input:listRawInputDevices",
  /** main -> renderer stream of captured inputs while a capture is active. */
  captureEvent: "input:captureEvent",
} as const

export interface LaunchResult {
  ok: boolean
  message?: string
}

/** Result of validating a candidate TeknoParrot directory. */
export interface InstallInfo {
  valid: boolean
  hasParrotData: boolean
  userProfileCount: number
  gameProfileCount: number
}

/**
 * The typed surface exposed to the renderer via `window.api`. The preload
 * script implements this and `contextBridge` exposes it.
 */
export interface Api {
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  pickDirectory(): Promise<string | undefined>

  validateInstall(path: string): Promise<InstallInfo>
  getGlobalSettings(): Promise<GlobalSettings>
  saveGlobalSettings(settings: GlobalSettings): Promise<GlobalSettings>
  listGames(): Promise<GameSummary[]>
  getGameConfig(profileName: string): Promise<GameConfig>
  saveGameConfig(update: GameConfigUpdate): Promise<GameConfig>
  /** Applies the same field values to every listed profile that defines them. */
  saveGameSettings(payload: BulkSettingsUpdate): Promise<BulkSettingsResult[]>
  saveControlBindings(payload: BulkControlUpdate): Promise<BulkControlResult[]>
  launchGame(profileName: string): Promise<LaunchResult>

  /**
   * Starts polling connected XInput controllers. While active, each detected
   * press/axis is delivered through `onCaptureEvent`. Resolves to `false` when
   * XInput is unavailable (non-Windows, or the native module failed to load).
   */
  startXInputCapture(): Promise<boolean>
  stopXInputCapture(): Promise<void>
  /**
   * Starts polling attached DirectInput joysticks/wheels. Resolves to `false`
   * when DirectInput is unavailable (non-Windows or the native layer failed).
   */
  startDirectInputCapture(): Promise<boolean>
  stopDirectInputCapture(): Promise<void>
  /** Enumerates connected keyboards/mice for RawInput bindings. */
  listRawInputDevices(): Promise<RawInputDeviceInfo[]>
  /** Subscribes to captured inputs. Returns an unsubscribe function. */
  onCaptureEvent(callback: (binding: CapturedBinding) => void): () => void
}
