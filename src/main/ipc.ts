import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { BrowserWindow, dialog, ipcMain } from "electron"
import { IpcChannels, type LaunchResult } from "@shared/ipc"
import type { AppSettings } from "@shared/types"
import type {
  BulkControlUpdate,
  BulkSettingsUpdate,
  GameConfigUpdate,
  GlobalSettings,
} from "@shared/teknoparrot"
import * as store from "./store"
import { validateInstall } from "./teknoparrot/paths"
import { readGlobalSettings, writeGlobalSettings } from "./teknoparrot/parrotData"
import { listGames } from "./teknoparrot/games"
import {
  readGameConfig,
  writeControlBindings,
  writeGameConfig,
  writeGameSettings,
} from "./teknoparrot/userProfile"
import { startXInputCapture, stopXInputCapture } from "./teknoparrot/inputCapture"
import { startDirectInputCapture, stopDirectInputCapture } from "./teknoparrot/directInputCapture"
import { listRawInputDevices } from "./teknoparrot/rawInputDevices"

/** Throws if no TeknoParrot path is configured; returns it otherwise. */
function requireTpPath(): string {
  const root = store.getTeknoParrotPath()
  if (!root || !existsSync(root)) {
    throw new Error("No valid TeknoParrot installation is configured. Set it in Settings.")
  }
  return root
}

/**
 * Registers every IPC handler. Called once, after the app is ready. IPC is a
 * trust boundary, so each handler validates inputs and the configured paths.
 */
export function registerIpcHandlers(): void {
  // --- App settings ---
  ipcMain.handle(IpcChannels.getSettings, () => store.getSettings())

  ipcMain.handle(IpcChannels.saveSettings, (_e, settings: AppSettings) =>
    store.saveSettings(settings),
  )

  ipcMain.handle(IpcChannels.pickDirectory, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(window!, {
      properties: ["openDirectory"],
    })
    return result.canceled ? undefined : result.filePaths[0]
  })

  // --- TeknoParrot data ---
  ipcMain.handle(IpcChannels.validateInstall, (_e, path: string) => validateInstall(path))

  ipcMain.handle(IpcChannels.getGlobalSettings, () => readGlobalSettings(requireTpPath()))

  ipcMain.handle(IpcChannels.saveGlobalSettings, (_e, settings: GlobalSettings) =>
    writeGlobalSettings(requireTpPath(), settings),
  )

  ipcMain.handle(IpcChannels.listGames, () => listGames(requireTpPath()))

  ipcMain.handle(IpcChannels.getGameConfig, (_e, profileName: string) => {
    if (!profileName) throw new Error("A profile name is required.")
    return readGameConfig(requireTpPath(), profileName)
  })

  ipcMain.handle(IpcChannels.saveGameConfig, (_e, update: GameConfigUpdate) => {
    if (!update?.profileName) throw new Error("A profile name is required.")
    return writeGameConfig(requireTpPath(), update)
  })

  ipcMain.handle(IpcChannels.saveGameSettings, (_e, payload: BulkSettingsUpdate) => {
    if (!payload?.profileNames?.length) throw new Error("At least one profile is required.")
    const hasEdits = payload.fieldValues && Object.keys(payload.fieldValues).length > 0
    if (!hasEdits && !payload.resetKeys?.length) return []
    return writeGameSettings(requireTpPath(), payload)
  })

  ipcMain.handle(IpcChannels.saveControlBindings, (_e, payload: BulkControlUpdate) => {
    if (!payload?.profileNames?.length) throw new Error("At least one profile is required.")
    if (!payload.updates?.length) return []
    return writeControlBindings(requireTpPath(), payload)
  })

  // --- Input capture ---
  ipcMain.handle(IpcChannels.startXInputCapture, (event) => startXInputCapture(event.sender))

  ipcMain.handle(IpcChannels.stopXInputCapture, () => stopXInputCapture())

  ipcMain.handle(IpcChannels.startDirectInputCapture, (event) =>
    startDirectInputCapture(event.sender),
  )

  ipcMain.handle(IpcChannels.stopDirectInputCapture, () => stopDirectInputCapture())

  ipcMain.handle(IpcChannels.listRawInputDevices, () => listRawInputDevices())

  ipcMain.handle(IpcChannels.launchGame, (_e, profileName: string): LaunchResult => {
    const root = requireTpPath()
    if (!profileName) return { ok: false, message: "A profile name is required." }

    // Launch through TeknoParrotUi so the emulator hooks are applied, rather
    // than spawning the raw game executable directly.
    const launcher = join(root, "TeknoParrotUi.exe")
    if (!existsSync(launcher)) {
      return { ok: false, message: "TeknoParrotUi.exe was not found in the configured folder." }
    }
    const profilePath = join("UserProfiles", `${profileName}.xml`)
    if (!existsSync(join(root, profilePath))) {
      return { ok: false, message: `No UserProfile exists for "${profileName}".` }
    }

    try {
      const child = spawn(launcher, [`--profile=${profilePath}`], {
        detached: true,
        stdio: "ignore",
        cwd: root,
      })
      child.unref()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  })
}
