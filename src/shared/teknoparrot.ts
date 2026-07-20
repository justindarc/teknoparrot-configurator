/**
 * Types describing the TeknoParrot data model, shared across all processes.
 * These map onto the on-disk files that TeknoParrot itself reads and writes:
 *
 *   ParrotData.xml        -> GlobalSettings
 *   GameProfiles/*.xml    -> profile templates (non-configurable flags)
 *   UserProfiles/*.xml    -> installed game configuration (GameConfig)
 *   Metadata/*.json       -> GameMetadata (platform, compatibility, versions)
 *   Icons/*.png           -> served to the UI via the `tpasset://` protocol
 *
 * Keep this file free of Node/Electron imports so it can be bundled into the
 * sandboxed renderer.
 */

import type { ControlScheme } from "./controlScheme"

/** The six field types TeknoParrot uses for configurable settings. */
export type FieldType = "Dropdown" | "DropdownIndex" | "Bool" | "Slider" | "Text" | "KeyCapture"

/** Per-vendor GPU compatibility rating from a game's Metadata JSON. */
export interface GpuCompatibility {
  status?: string
  issues?: string | null
}

/** Non-configurable descriptive metadata for a game (Metadata/*.json). */
export interface GameMetadata {
  platform?: string
  releaseYear?: string
  wheelRotation?: string
  supportedVersions: string[]
  generalIssues?: string | null
  nvidia: GpuCompatibility
  amd: GpuCompatibility
  intel: GpuCompatibility
}

/**
 * A lightweight catalog entry, merged from the game profile template, the user
 * profile (if installed) and the metadata JSON. Used to render the game list.
 */
export interface GameSummary {
  /** Profile file name without extension — the stable identifier. */
  profileName: string
  /** Display name (GameNameInternal). */
  name: string
  genre?: string
  /** Emulator backend, e.g. "TeknoParrot", "OpenParrot", "RPCS3". */
  emulator?: string
  /** Icon file name (served via tpasset://icon/<iconFile>), if one exists. */
  iconFile?: string
  /** True when a UserProfile exists with a configured GamePath. */
  installed: boolean
  gamePath?: string
  requiresAdmin: boolean
  patreon: boolean
  is64Bit: boolean
  metadata?: GameMetadata
  /** Primary physical control scheme, classified from the profile's bindings. */
  controlScheme: ControlScheme
  /** Best-effort simultaneous-player count (heuristic; from the bindings). */
  players: number
  /** Action buttons per player (excludes Start/Coin/Service); null if N/A. */
  buttonsPerPlayer: number | null
}

/** A single configurable setting within a game's ConfigValues. */
export interface ConfigField {
  category: string
  name: string
  value: string
  type: FieldType
  min: number
  max: number
  step: number
  options: string[]
  hint?: string
  /**
   * The value this field carries in the game's GameProfiles template — what
   * "reset to default" restores. Absent when the template has no such field.
   */
  defaultValue?: string
}

/** A single input binding from a game's JoystickButtons. */
export interface InputBinding {
  buttonName: string
  inputMapping: string
  analogType: string
  /** Composite binding label, e.g. "DI: Keyboard Button F2 | RI: …". */
  bindName: string
  /** Per-API binding labels (empty when that API is unbound). */
  bindNameDi: string
  bindNameXi: string
  bindNameRi: string
  /**
   * True when the binding is only shown in a non-default TeknoParrot mode (any
   * `HideWithout*` flag is set — e.g. the keyboard-for-axis "Left"/"Right"
   * halves of an analog control). The bulk editor omits these so each control
   * shows only its canonical binding.
   */
  hiddenByDefault: boolean
}

/** Which of TeknoParrot's three input APIs a capture targets. */
export type InputApi = "DirectInput" | "XInput" | "RawInput"

/**
 * Structured `<DirectInputButton>` data (SharpDX JoystickButton). For keyboard
 * captures `joystickGuid` is the fixed GUID_SysKeyboard and `button` the
 * DirectInput scancode; for joysticks it is the device InstanceGuid + offset.
 */
export interface DirectInputButtonData {
  button: number
  isAxis: boolean
  isAxisMinus: boolean
  isFullAxis: boolean
  povDirection: number
  isReverseAxis: boolean
  joystickGuid: string
}

/** Structured `<XInputButton>` data. `buttonCode` is a GamepadButtonFlags value. */
export interface XInputButtonData {
  isLeftThumbX: boolean
  isRightThumbX: boolean
  isLeftThumbY: boolean
  isRightThumbY: boolean
  isAxisMinus: boolean
  isLeftTrigger: boolean
  isRightTrigger: boolean
  buttonCode: number
  isButton: boolean
  buttonIndex: number
  xInputIndex: number
}

export type RawDeviceType = "None" | "Mouse" | "Keyboard"
export type RawMouseButton =
  "None" | "LeftButton" | "RightButton" | "MiddleButton" | "Button4" | "Button5"

/** Structured `<RawInputButton>` data. `keyboardKey` is a Keys enum name. */
export interface RawInputButtonData {
  devicePath: string
  deviceType: RawDeviceType
  mouseButton: RawMouseButton
  keyboardKey: string
}

/** An enumerated RawInput device the user can bind against. */
export interface RawInputDeviceInfo {
  /** Windows device interface path (RawInputButton.DevicePath). */
  path: string
  /** TeknoParrot-style display name (e.g. "Ultimarc AimTrak #1"). */
  name: string
  type: "Keyboard" | "Mouse"
}

/**
 * One captured input for a single API, ready to be written into a profile. The
 * relevant structured member is set based on `api`; `label` is the per-API
 * display string (without the "DI:"/"XI:"/"RI:" prefix the composite adds).
 */
export interface CapturedBinding {
  api: InputApi
  label: string
  directInputButton?: DirectInputButtonData
  xInputButton?: XInputButtonData
  rawInputButton?: RawInputButtonData
}

/** The full, editable configuration for one installed game. */
export interface GameConfig {
  profileName: string
  name: string
  gamePath: string
  emulator?: string
  fields: ConfigField[]
  inputs: InputBinding[]
}

/**
 * A partial update applied to a UserProfile. Field values are keyed by
 * `"<Category>::<FieldName>"` so a flat object survives IPC serialization.
 */
export interface GameConfigUpdate {
  profileName: string
  gamePath?: string
  fieldValues: Record<string, string>
}

export function fieldKey(category: string, name: string): string {
  return `${category}::${name}`
}

/**
 * A bulk settings update applied to several UserProfiles. Field values are
 * keyed by `"<Category>::<FieldName>"`; a profile that doesn't define a given
 * field simply skips it, so one payload can target games with differing
 * settings.
 */
export interface BulkSettingsUpdate {
  profileNames: string[]
  fieldValues: Record<string, string>
  /**
   * Fields to restore to each profile's own GameProfiles default. Resolved
   * per-profile, since two games can default the same setting differently.
   * A key present in `fieldValues` wins over a reset.
   */
  resetKeys?: string[]
}

/** Per-profile outcome of a bulk settings update. */
export interface BulkSettingsResult {
  profileName: string
  /** Number of FieldValue elements whose text was changed. */
  updated: number
}

/**
 * One de-duplicated control group's new binding, to apply across many games.
 * A binding in a game's profile is a target if its ButtonName is in
 * `buttonNames` OR its InputMapping is in `inputMappings` (union, not
 * intersection).
 */
export interface ControlBindingUpdate {
  buttonNames: string[]
  inputMappings: string[]
  /** Structured captures to write into the matched controls (one per API). */
  captures?: CapturedBinding[]
  /** Input APIs to unbind on the matched controls. */
  clearApis?: InputApi[]
}

/** A bulk update applied to the input bindings of several UserProfiles. */
export interface BulkControlUpdate {
  profileNames: string[]
  updates: ControlBindingUpdate[]
}

/** Per-profile outcome of a bulk control update. */
export interface BulkControlResult {
  profileName: string
  /** Number of binding elements whose BindName was changed. */
  updated: number
}

/**
 * Global TeknoParrot settings (ParrotData.xml). Only the settings that are
 * meaningful to configure from this app are surfaced; the writer preserves any
 * other elements in the file untouched.
 */
export interface GlobalSettings {
  lastPlayed: string
  language: string
  exitGameKey: string
  pauseGameKey: string
  saveLastPlayed: boolean
  useDiscordRPC: boolean
  silentMode: boolean
  checkForUpdates: boolean
  confirmExit: boolean
  confirmGameDeletion: boolean
  downloadIcons: boolean
  uiColour: string
  uiDarkMode: boolean
  datXmlLocation: string
  // Driving-game global hacks.
  useSto0ZDrivingHack: boolean
  stoozPercent: number
  fullAxisGas: boolean
  fullAxisBrake: boolean
  reverseAxisGas: boolean
  reverseAxisBrake: boolean
}
