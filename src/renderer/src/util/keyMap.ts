import type {
  CapturedBinding,
  DirectInputButtonData,
  RawInputButtonData,
  RawInputDeviceInfo,
  RawMouseButton,
} from "@shared/teknoparrot"

/**
 * Translates DOM keyboard/mouse events into the exact structured data + labels
 * TeknoParrot records, for the DirectInput and RawInput capture paths.
 *
 * TeknoParrot stores two different naming systems:
 *  - DirectInput keyboard: SharpDX `Key` enum name, and `Button` = the DIK
 *    scancode + 47 (the offset SharpDX reports for buffered keyboard data),
 *    with the fixed GUID_SysKeyboard device GUID.
 *  - RawInput keyboard: `System.Windows.Forms.Keys` enum name in `KeyboardKey`.
 *
 * The maps are keyed by `KeyboardEvent.code` (physical, layout-independent).
 */

/** Fixed DirectInput system-keyboard GUID (GUID_SysKeyboard). */
export const SYS_KEYBOARD_GUID = "6f1d2b61-d5a0-11cf-bfc7-444553540000"

/** SharpDX buffered-keyboard offset = DIK scancode + this constant. */
const DI_KEYBOARD_OFFSET = 47

interface KeyInfo {
  /** SharpDX DirectInput Key enum name (DI label). */
  di: string
  /** DIK scancode = SharpDX Key value. */
  dik: number
  /** System.Windows.Forms.Keys enum name (RawInput). */
  keys: string
}

// DIK scancodes for letters/digits, used to build entries compactly.
const LETTER_DIK: Record<string, number> = {
  A: 30,
  B: 48,
  C: 46,
  D: 32,
  E: 18,
  F: 33,
  G: 34,
  H: 35,
  I: 23,
  J: 36,
  K: 37,
  L: 38,
  M: 50,
  N: 49,
  O: 24,
  P: 25,
  Q: 16,
  R: 19,
  S: 31,
  T: 20,
  U: 22,
  V: 47,
  W: 17,
  X: 45,
  Y: 21,
  Z: 44,
}
const DIGIT_DIK: Record<string, number> = {
  "1": 2,
  "2": 3,
  "3": 4,
  "4": 5,
  "5": 6,
  "6": 7,
  "7": 8,
  "8": 9,
  "9": 10,
  "0": 11,
}
const FN_DIK: Record<number, number> = {
  1: 59,
  2: 60,
  3: 61,
  4: 62,
  5: 63,
  6: 64,
  7: 65,
  8: 66,
  9: 67,
  10: 68,
  11: 87,
  12: 88,
}
const NUMPAD_DIK: Record<string, number> = {
  "0": 82,
  "1": 79,
  "2": 80,
  "3": 81,
  "4": 75,
  "5": 76,
  "6": 77,
  "7": 71,
  "8": 72,
  "9": 73,
}

const KEY_MAP: Record<string, KeyInfo> = {}

for (const [letter, dik] of Object.entries(LETTER_DIK)) {
  KEY_MAP[`Key${letter}`] = { di: letter, dik, keys: letter }
}
for (const [digit, dik] of Object.entries(DIGIT_DIK)) {
  KEY_MAP[`Digit${digit}`] = { di: `D${digit}`, dik, keys: `D${digit}` }
}
for (let n = 1; n <= 12; n++) {
  KEY_MAP[`F${n}`] = { di: `F${n}`, dik: FN_DIK[n], keys: `F${n}` }
}
for (const [digit, dik] of Object.entries(NUMPAD_DIK)) {
  KEY_MAP[`Numpad${digit}`] = { di: `NumberPad${digit}`, dik, keys: `NumPad${digit}` }
}

// Special / punctuation keys (Keys names follow System.Windows.Forms).
Object.assign(KEY_MAP, {
  Escape: { di: "Escape", dik: 1, keys: "Escape" },
  Backspace: { di: "Back", dik: 14, keys: "Back" },
  Tab: { di: "Tab", dik: 15, keys: "Tab" },
  Enter: { di: "Return", dik: 28, keys: "Return" },
  NumpadEnter: { di: "NumPadEnter", dik: 156, keys: "Return" },
  Space: { di: "Space", dik: 57, keys: "Space" },
  ShiftLeft: { di: "LeftShift", dik: 42, keys: "ShiftKey" },
  ShiftRight: { di: "RightShift", dik: 54, keys: "ShiftKey" },
  ControlLeft: { di: "LeftControl", dik: 29, keys: "ControlKey" },
  ControlRight: { di: "RightControl", dik: 157, keys: "ControlKey" },
  AltLeft: { di: "LeftAlt", dik: 56, keys: "Menu" },
  AltRight: { di: "RightAlt", dik: 184, keys: "Menu" },
  ArrowUp: { di: "Up", dik: 200, keys: "Up" },
  ArrowDown: { di: "Down", dik: 208, keys: "Down" },
  ArrowLeft: { di: "Left", dik: 203, keys: "Left" },
  ArrowRight: { di: "Right", dik: 205, keys: "Right" },
  Home: { di: "Home", dik: 199, keys: "Home" },
  End: { di: "End", dik: 207, keys: "End" },
  PageUp: { di: "PriorText", dik: 201, keys: "PageUp" },
  PageDown: { di: "NextText", dik: 209, keys: "PageDown" },
  Insert: { di: "Insert", dik: 210, keys: "Insert" },
  Delete: { di: "Delete", dik: 211, keys: "Delete" },
  Minus: { di: "Minus", dik: 12, keys: "OemMinus" },
  Equal: { di: "Equals", dik: 13, keys: "Oemplus" },
  BracketLeft: { di: "LeftBracket", dik: 26, keys: "OemOpenBrackets" },
  BracketRight: { di: "RightBracket", dik: 27, keys: "OemCloseBrackets" },
  Semicolon: { di: "Semicolon", dik: 39, keys: "OemSemicolon" },
  Quote: { di: "Apostrophe", dik: 40, keys: "OemQuotes" },
  Backquote: { di: "Grave", dik: 41, keys: "Oemtilde" },
  Backslash: { di: "Backslash", dik: 43, keys: "OemBackslash" },
  Comma: { di: "Comma", dik: 51, keys: "Oemcomma" },
  Period: { di: "Period", dik: 52, keys: "OemPeriod" },
  Slash: { di: "Slash", dik: 53, keys: "OemQuestion" },
  NumpadAdd: { di: "Add", dik: 78, keys: "Add" },
  NumpadSubtract: { di: "Subtract", dik: 74, keys: "Subtract" },
  NumpadMultiply: { di: "Multiply", dik: 55, keys: "Multiply" },
  NumpadDivide: { di: "Divide", dik: 181, keys: "Divide" },
  NumpadDecimal: { di: "Decimal", dik: 83, keys: "Decimal" },
} satisfies Record<string, KeyInfo>)

/** Builds a captured binding for a keyboard event under the given API. */
export function capturedFromKey(
  code: string,
  api: "DirectInput" | "RawInput",
  device?: RawInputDeviceInfo,
): CapturedBinding | null {
  const info = KEY_MAP[code]
  if (!info) return null

  if (api === "DirectInput") {
    const directInputButton: DirectInputButtonData = {
      button: info.dik + DI_KEYBOARD_OFFSET,
      isAxis: false,
      isAxisMinus: false,
      isFullAxis: false,
      povDirection: 0,
      isReverseAxis: false,
      joystickGuid: SYS_KEYBOARD_GUID,
    }
    return { api, label: `Keyboard Button ${info.di}`, directInputButton }
  }

  // RawInput: pair the key with the chosen device (real DevicePath + name).
  // Without a selection, fall back to TeknoParrot's default standard-keyboard
  // name and an empty path.
  const name = device?.name ?? "HID Keyboard Device"
  const rawInputButton: RawInputButtonData = {
    devicePath: device?.path ?? "",
    deviceType: "Keyboard",
    mouseButton: "None",
    keyboardKey: info.keys,
  }
  return { api, label: `${name} ${info.keys}`, rawInputButton }
}

const MOUSE_BUTTONS: Record<number, RawMouseButton> = {
  0: "LeftButton",
  1: "MiddleButton",
  2: "RightButton",
  3: "Button4",
  4: "Button5",
}

/** Builds a RawInput captured binding for a mouse-button event. */
export function capturedFromMouse(
  button: number,
  device?: RawInputDeviceInfo,
): CapturedBinding | null {
  const mouseButton = MOUSE_BUTTONS[button]
  if (!mouseButton) return null
  const name = device?.name ?? "HID-compliant mouse"
  const rawInputButton: RawInputButtonData = {
    devicePath: device?.path ?? "",
    deviceType: "Mouse",
    mouseButton,
    keyboardKey: "None",
  }
  return { api: "RawInput", label: `${name} ${mouseButton}`, rawInputButton }
}
