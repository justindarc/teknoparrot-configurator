import type { WebContents } from "electron"
import { IpcChannels } from "@shared/ipc"
import type { CapturedBinding, XInputButtonData } from "@shared/teknoparrot"

/**
 * XInput capture for the controls editor. TeknoParrot records XInput bindings
 * as a GamepadButtonFlags value plus a controller index, so we poll the native
 * XInput API (via `xinput-ffi`, which wraps xinput1_4.dll) and translate each
 * newly-pressed button / crossed trigger / deflected thumbstick into the exact
 * struct + label TeknoParrot writes. Keyboard and mouse are captured in the
 * renderer via DOM events, so they are not handled here.
 *
 * The module is Windows-only; on other platforms (or if the native binary
 * fails to load) `start` resolves to false and capture is simply unavailable.
 */

/** GamepadButtonFlags — value + SharpDX enum name, matching TeknoParrot. */
const XINPUT_BUTTONS: ReadonlyArray<{ flag: number; name: string }> = [
  { flag: 0x0001, name: "DPadUp" },
  { flag: 0x0002, name: "DPadDown" },
  { flag: 0x0004, name: "DPadLeft" },
  { flag: 0x0008, name: "DPadRight" },
  { flag: 0x0010, name: "Start" },
  { flag: 0x0020, name: "Back" },
  { flag: 0x0040, name: "LeftThumb" },
  { flag: 0x0080, name: "RightThumb" },
  { flag: 0x0100, name: "LeftShoulder" },
  { flag: 0x0200, name: "RightShoulder" },
  { flag: 0x1000, name: "A" },
  { flag: 0x2000, name: "B" },
  { flag: 0x4000, name: "X" },
  { flag: 0x8000, name: "Y" },
]

// XInput thresholds (match the SDK constants xinput-ffi also uses).
const TRIGGER_THRESHOLD = 30
const LEFT_THUMB_DEADZONE = 7849
const RIGHT_THUMB_DEADZONE = 8689
const MAX_CONTROLLERS = 4
const POLL_INTERVAL_MS = 25

interface GamepadState {
  wButtons: number
  bLeftTrigger: number
  bRightTrigger: number
  sThumbLX: number
  sThumbLY: number
  sThumbRX: number
  sThumbRY: number
}

// The subset of the xinput-ffi surface we use, typed loosely since the package
// ships ESM-only and is loaded via dynamic import.
interface XInputModule {
  getState(option: { dwUserIndex: number; translate: boolean }): Promise<{ gamepad: GamepadState }>
}

let xinput: XInputModule | null = null
let loadFailed = false
let timer: ReturnType<typeof setInterval> | null = null
let polling = false
let sender: WebContents | null = null
const previous = new Map<number, GamepadState>()

async function loadXInput(): Promise<XInputModule | null> {
  if (xinput || loadFailed) return xinput
  // XInput is Windows-only; on other platforms xinput-ffi loads but every call
  // throws, so treat it as unavailable up front (the renderer shows a hint).
  if (process.platform !== "win32") {
    loadFailed = true
    return null
  }
  try {
    // Dynamic import keeps the ESM-only package out of the CJS require graph.
    xinput = (await import("xinput-ffi")) as unknown as XInputModule
  } catch (err) {
    loadFailed = true
    console.warn("[inputCapture] xinput-ffi unavailable:", (err as Error).message)
  }
  return xinput
}

function blankXInputButton(index: number): XInputButtonData {
  return {
    isLeftThumbX: false,
    isRightThumbX: false,
    isLeftThumbY: false,
    isRightThumbY: false,
    isAxisMinus: false,
    isLeftTrigger: false,
    isRightTrigger: false,
    buttonCode: 0,
    isButton: false,
    buttonIndex: 0,
    xInputIndex: index,
  }
}

function emit(binding: CapturedBinding): void {
  if (sender && !sender.isDestroyed()) {
    sender.send(IpcChannels.captureEvent, binding)
  }
}

/** Emits a capture for the first meaningful change between two gamepad states. */
function diffAndEmit(index: number, prev: GamepadState, next: GamepadState): void {
  // Buttons: only newly pressed bits (0 -> 1 transitions).
  const pressed = next.wButtons & ~prev.wButtons
  if (pressed !== 0) {
    const match = XINPUT_BUTTONS.find((b) => (pressed & b.flag) !== 0)
    if (match) {
      const button = blankXInputButton(index)
      button.isButton = true
      button.buttonCode = match.flag
      emit({
        api: "XInput",
        label: `Input Device ${index} ${match.name}`,
        xInputButton: button,
      })
      return
    }
  }

  // Triggers (analog, treated as a press when crossing the threshold).
  if (prev.bLeftTrigger <= TRIGGER_THRESHOLD && next.bLeftTrigger > TRIGGER_THRESHOLD) {
    const button = blankXInputButton(index)
    button.isLeftTrigger = true
    emit({ api: "XInput", label: `Input Device ${index} LeftTrigger`, xInputButton: button })
    return
  }
  if (prev.bRightTrigger <= TRIGGER_THRESHOLD && next.bRightTrigger > TRIGGER_THRESHOLD) {
    const button = blankXInputButton(index)
    button.isRightTrigger = true
    emit({ api: "XInput", label: `Input Device ${index} RightTrigger`, xInputButton: button })
    return
  }

  // Thumbsticks (analog axes): fire when a new deflection crosses the deadzone.
  const thumbs: Array<{
    prev: number
    next: number
    deadzone: number
    axis: keyof XInputButtonData
    name: string
  }> = [
    {
      prev: prev.sThumbLX,
      next: next.sThumbLX,
      deadzone: LEFT_THUMB_DEADZONE,
      axis: "isLeftThumbX",
      name: "LeftThumbX",
    },
    {
      prev: prev.sThumbLY,
      next: next.sThumbLY,
      deadzone: LEFT_THUMB_DEADZONE,
      axis: "isLeftThumbY",
      name: "LeftThumbY",
    },
    {
      prev: prev.sThumbRX,
      next: next.sThumbRX,
      deadzone: RIGHT_THUMB_DEADZONE,
      axis: "isRightThumbX",
      name: "RightThumbX",
    },
    {
      prev: prev.sThumbRY,
      next: next.sThumbRY,
      deadzone: RIGHT_THUMB_DEADZONE,
      axis: "isRightThumbY",
      name: "RightThumbY",
    },
  ]
  for (const t of thumbs) {
    if (Math.abs(t.prev) <= t.deadzone && Math.abs(t.next) > t.deadzone) {
      const button = blankXInputButton(index)
      button[t.axis] = true as never
      button.isAxisMinus = t.next < 0
      emit({
        api: "XInput",
        label: `Input Device ${index} ${t.name} ${t.next < 0 ? "-" : "+"}`,
        xInputButton: button,
      })
      return
    }
  }
}

async function poll(): Promise<void> {
  if (polling || !xinput) return
  polling = true
  try {
    for (let i = 0; i < MAX_CONTROLLERS; i++) {
      let state: GamepadState
      try {
        const result = await xinput.getState({ dwUserIndex: i, translate: false })
        state = result.gamepad
      } catch {
        // Not connected / transient read error — drop any stale baseline.
        previous.delete(i)
        continue
      }
      const prev = previous.get(i)
      if (prev) diffAndEmit(i, prev, state)
      previous.set(i, state)
    }
  } finally {
    polling = false
  }
}

/** Starts polling XInput controllers. Returns false when XInput is unavailable. */
export async function startXInputCapture(webContents: WebContents): Promise<boolean> {
  const mod = await loadXInput()
  if (!mod) return false
  stopXInputCapture()
  sender = webContents
  previous.clear()
  timer = setInterval(() => void poll(), POLL_INTERVAL_MS)
  return true
}

export function stopXInputCapture(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  previous.clear()
  sender = null
}
