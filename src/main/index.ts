import { join } from "node:path"
import { app, BrowserWindow, shell } from "electron"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import { registerIpcHandlers } from "./ipc"
import { handleIconProtocol, registerIconScheme } from "./teknoparrot/iconProtocol"

// Must run before the app is ready.
registerIconScheme()

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: "TeknoParrot Configurator",
    backgroundColor: "#121212",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      // Security defaults — do not weaken these.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show only once rendered to avoid a white flash on startup.
  mainWindow.on("ready-to-show", () => mainWindow.show())

  // Open external links in the user's browser, never in an Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }

  return mainWindow
}

// Enforce a single running instance.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.teknoparrot.configurator")

    // Open/close devtools with F12 in dev, ignore in production.
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    handleIconProtocol()
    registerIpcHandlers()
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on("second-instance", () => {
    const [existing] = BrowserWindow.getAllWindows()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    }
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}
