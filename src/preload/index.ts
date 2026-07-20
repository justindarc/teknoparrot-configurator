import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"
import { IpcChannels, type Api } from "@shared/ipc"
import type { AppSettings } from "@shared/types"
import type {
  BulkControlUpdate,
  BulkSettingsUpdate,
  CapturedBinding,
  GameConfigUpdate,
  GlobalSettings,
} from "@shared/teknoparrot"

/**
 * The renderer-facing API. Every method is a thin, typed wrapper around an
 * `ipcRenderer.invoke` call — no Node primitives are handed to the renderer,
 * preserving context isolation.
 */
const api: Api = {
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke(IpcChannels.saveSettings, settings),
  pickDirectory: () => ipcRenderer.invoke(IpcChannels.pickDirectory),

  validateInstall: (path: string) => ipcRenderer.invoke(IpcChannels.validateInstall, path),
  getGlobalSettings: () => ipcRenderer.invoke(IpcChannels.getGlobalSettings),
  saveGlobalSettings: (settings: GlobalSettings) =>
    ipcRenderer.invoke(IpcChannels.saveGlobalSettings, settings),
  listGames: () => ipcRenderer.invoke(IpcChannels.listGames),
  getGameConfig: (profileName: string) =>
    ipcRenderer.invoke(IpcChannels.getGameConfig, profileName),
  saveGameConfig: (update: GameConfigUpdate) =>
    ipcRenderer.invoke(IpcChannels.saveGameConfig, update),
  saveGameSettings: (payload: BulkSettingsUpdate) =>
    ipcRenderer.invoke(IpcChannels.saveGameSettings, payload),
  saveControlBindings: (payload: BulkControlUpdate) =>
    ipcRenderer.invoke(IpcChannels.saveControlBindings, payload),
  launchGame: (profileName: string) => ipcRenderer.invoke(IpcChannels.launchGame, profileName),

  startXInputCapture: () => ipcRenderer.invoke(IpcChannels.startXInputCapture),
  stopXInputCapture: () => ipcRenderer.invoke(IpcChannels.stopXInputCapture),
  startDirectInputCapture: () => ipcRenderer.invoke(IpcChannels.startDirectInputCapture),
  stopDirectInputCapture: () => ipcRenderer.invoke(IpcChannels.stopDirectInputCapture),
  listRawInputDevices: () => ipcRenderer.invoke(IpcChannels.listRawInputDevices),
  onCaptureEvent: (callback: (binding: CapturedBinding) => void) => {
    // Wrap the listener so the raw IpcRendererEvent is never handed to the
    // renderer, preserving context isolation.
    const listener = (_e: IpcRendererEvent, binding: CapturedBinding): void => callback(binding)
    ipcRenderer.on(IpcChannels.captureEvent, listener)
    return () => ipcRenderer.removeListener(IpcChannels.captureEvent, listener)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Fallback for the (discouraged) non-isolated case.
  // @ts-expect-error — augmenting the global window object.
  window.electron = electronAPI
  // @ts-expect-error — augmenting the global window object.
  window.api = api
}
