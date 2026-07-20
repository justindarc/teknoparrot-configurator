import { existsSync } from "node:fs"
import { join } from "node:path"
import type {
  BulkControlResult,
  BulkControlUpdate,
  BulkSettingsResult,
  BulkSettingsUpdate,
  CapturedBinding,
  ConfigField,
  FieldType,
  GameConfig,
  GameConfigUpdate,
  InputBinding,
} from "@shared/teknoparrot"
import { fieldKey } from "@shared/teknoparrot"
import { tpPaths } from "./paths"
import {
  buildElement,
  child,
  childBool,
  childText,
  childrenByTag,
  elementIndent,
  parseXmlFile,
  removeChildElement,
  setChildText,
  upsertChildElement,
  upsertChildText,
  writeXmlFile,
  type Document,
  type Element,
} from "./xml"

/** `HideWithout*` flags mark a binding that only appears in a non-default mode. */
const HIDE_WITHOUT_FLAGS = [
  "HideWithoutKeyboardForAxis",
  "HideWithoutRelativeAxis",
  "HideWithoutUseDPadForGUN1Stick",
  "HideWithoutUseDPadForGUN2Stick",
  "HideWithoutUseAnalogAxisToAimGUN1",
  "HideWithoutUseAnalogAxisToAimGUN2",
  "HideWithoutProMode",
] as const

const FIELD_TYPES: readonly FieldType[] = [
  "Dropdown",
  "DropdownIndex",
  "Bool",
  "Slider",
  "Text",
  "KeyCapture",
]

function coerceFieldType(raw: string): FieldType {
  return (FIELD_TYPES as readonly string[]).includes(raw) ? (raw as FieldType) : "Text"
}

function userProfilePath(root: string, profileName: string): string {
  return join(tpPaths(root).userProfiles, `${profileName}.xml`)
}

function readFieldOptions(fi: Element): string[] {
  const opts = child(fi, "FieldOptions")
  if (!opts) return []
  return childrenByTag(opts, "string").map((s) => s.textContent?.trim() ?? "")
}

function readConfigFields(doc: Document, defaults: Map<string, string>): ConfigField[] {
  const cv = child(doc, "ConfigValues")
  if (!cv) return []
  return childrenByTag(cv, "FieldInformation").map((fi) => {
    const category = childText(fi, "CategoryName") || "General"
    const name = childText(fi, "FieldName")
    return {
      category,
      name,
      value: child(fi, "FieldValue")?.textContent ?? "",
      type: coerceFieldType(childText(fi, "FieldType")),
      min: Number(childText(fi, "FieldMin")) || 0,
      max: Number(childText(fi, "FieldMax")) || 0,
      step: Number(childText(fi, "FieldStep")) || 0,
      options: readFieldOptions(fi),
      hint: childText(fi, "Hint") || undefined,
      defaultValue: defaults.get(fieldKey(category, name)),
    }
  })
}

/**
 * The field values a game's GameProfiles template ships with, keyed by
 * `Category::FieldName`. A UserProfile starts life as a copy of this template,
 * so these are the values "reset to default" restores. Returns an empty map if
 * the template is missing or unreadable — callers then simply have no default.
 */
function readTemplateDefaults(root: string, profileName: string): Map<string, string> {
  const defaults = new Map<string, string>()
  const file = join(tpPaths(root).gameProfiles, `${profileName}.xml`)
  if (!existsSync(file)) return defaults

  let doc: Document
  try {
    doc = parseXmlFile(file)
  } catch {
    return defaults
  }

  const cv = child(doc, "ConfigValues")
  if (!cv) return defaults
  for (const fi of childrenByTag(cv, "FieldInformation")) {
    const key = fieldKey(childText(fi, "CategoryName") || "General", childText(fi, "FieldName"))
    defaults.set(key, child(fi, "FieldValue")?.textContent ?? "")
  }
  return defaults
}

function readInputBindings(doc: Document): InputBinding[] {
  // The outer <JoystickButtons> element contains one nested <JoystickButtons>
  // element per binding (an artefact of C#'s XmlSerializer).
  const outer = child(doc, "JoystickButtons")
  if (!outer) return []
  return childrenByTag(outer, "JoystickButtons")
    .map((jb) => ({
      buttonName: childText(jb, "ButtonName"),
      inputMapping: childText(jb, "InputMapping"),
      analogType: childText(jb, "AnalogType"),
      bindName: childText(jb, "BindName"),
      bindNameDi: childText(jb, "BindNameDi"),
      bindNameXi: childText(jb, "BindNameXi"),
      bindNameRi: childText(jb, "BindNameRi"),
      hiddenByDefault: HIDE_WITHOUT_FLAGS.some((flag) => childBool(jb, flag)),
    }))
    .filter((b) => b.buttonName.length > 0)
}

/** Reads the complete, editable configuration for an installed game. */
export function readGameConfig(root: string, profileName: string): GameConfig {
  const file = userProfilePath(root, profileName)
  if (!existsSync(file)) {
    throw new Error(`No UserProfile found for "${profileName}". Is the game installed?`)
  }
  const doc = parseXmlFile(file)
  return {
    profileName,
    name: childText(doc, "GameNameInternal") || profileName,
    gamePath: childText(doc, "GamePath"),
    emulator: childText(doc, "EmulatorType") || undefined,
    fields: readConfigFields(doc, readTemplateDefaults(root, profileName)),
    inputs: readInputBindings(doc),
  }
}

/**
 * Applies an update to a game's UserProfile by mutating the existing document,
 * then re-reads and returns the saved configuration. Only known fields are
 * touched; the rest of the file (input bindings, flags, etc.) is preserved.
 */
export function writeGameConfig(root: string, update: GameConfigUpdate): GameConfig {
  const file = userProfilePath(root, update.profileName)
  if (!existsSync(file)) {
    throw new Error(`No UserProfile found for "${update.profileName}".`)
  }
  const doc = parseXmlFile(file)

  if (typeof update.gamePath === "string") {
    setChildText(doc, "GamePath", update.gamePath)
  }

  const cv = child(doc, "ConfigValues")
  if (cv) {
    for (const fi of childrenByTag(cv, "FieldInformation")) {
      const key = fieldKey(childText(fi, "CategoryName") || "General", childText(fi, "FieldName"))
      if (key in update.fieldValues) {
        setChildText(fi, "FieldValue", update.fieldValues[key])
      }
    }
  }

  writeXmlFile(file, doc)
  return readGameConfig(root, update.profileName)
}

/**
 * Applies the same field values across several UserProfiles. Each profile only
 * takes the fields it actually defines, so a payload built from the union of
 * several games' settings is safe to send to all of them. Profiles that aren't
 * installed, or whose values already match, are left untouched.
 */
export function writeGameSettings(root: string, payload: BulkSettingsUpdate): BulkSettingsResult[] {
  const resetKeys = new Set(payload.resetKeys ?? [])
  const fieldValues = payload.fieldValues ?? {}

  return payload.profileNames.map((profileName) => {
    const file = userProfilePath(root, profileName)
    if (!existsSync(file)) return { profileName, updated: 0 }

    const doc = parseXmlFile(file)
    const cv = child(doc, "ConfigValues")
    if (!cv) return { profileName, updated: 0 }

    // Each profile resets to its own template's values, so the defaults have to
    // be resolved per profile rather than baked into the payload.
    const defaults: Map<string, string> = resetKeys.size
      ? readTemplateDefaults(root, profileName)
      : new Map()

    let updated = 0
    for (const fi of childrenByTag(cv, "FieldInformation")) {
      const key = fieldKey(childText(fi, "CategoryName") || "General", childText(fi, "FieldName"))
      let value: string | undefined
      if (key in fieldValues) value = fieldValues[key]
      else if (resetKeys.has(key)) value = defaults.get(key)
      // Undefined means neither an edit nor a template default applies here.
      if (value === undefined) continue
      if ((child(fi, "FieldValue")?.textContent ?? "") === value) continue
      setChildText(fi, "FieldValue", value)
      updated++
    }

    if (updated > 0) writeXmlFile(file, doc)
    return { profileName, updated }
  })
}

const xmlBool = (b: boolean): string => (b ? "true" : "false")

/** Direct-child leaf text of `parent`, or '' — avoids descendant matches. */
function leafText(parent: Element, tag: string): string {
  return childrenByTag(parent, tag)[0]?.textContent?.trim() ?? ""
}

/** Per-API structured element tag + the tags that must follow it (schema order). */
const API_ELEMENT: Record<
  CapturedBinding["api"],
  { tag: string; before: string[]; label: string }
> = {
  DirectInput: {
    tag: "DirectInputButton",
    before: ["XInputButton", "RawInputButton", "InputMapping"],
    label: "BindNameDi",
  },
  XInput: { tag: "XInputButton", before: ["RawInputButton", "InputMapping"], label: "BindNameXi" },
  RawInput: { tag: "RawInputButton", before: ["InputMapping"], label: "BindNameRi" },
}

/** Builds the ordered field list for a captured API's structured element. */
function capturedFields(captured: CapturedBinding): Array<[string, string]> | null {
  if (captured.api === "DirectInput" && captured.directInputButton) {
    const di = captured.directInputButton
    return [
      ["Button", String(di.button)],
      ["IsAxis", xmlBool(di.isAxis)],
      ["IsAxisMinus", xmlBool(di.isAxisMinus)],
      ["IsFullAxis", xmlBool(di.isFullAxis)],
      ["PovDirection", String(di.povDirection)],
      ["IsReverseAxis", xmlBool(di.isReverseAxis)],
      ["JoystickGuid", di.joystickGuid],
    ]
  }
  if (captured.api === "XInput" && captured.xInputButton) {
    const xi = captured.xInputButton
    return [
      ["IsLeftThumbX", xmlBool(xi.isLeftThumbX)],
      ["IsRightThumbX", xmlBool(xi.isRightThumbX)],
      ["IsLeftThumbY", xmlBool(xi.isLeftThumbY)],
      ["IsRightThumbY", xmlBool(xi.isRightThumbY)],
      ["IsAxisMinus", xmlBool(xi.isAxisMinus)],
      ["IsLeftTrigger", xmlBool(xi.isLeftTrigger)],
      ["IsRightTrigger", xmlBool(xi.isRightTrigger)],
      ["ButtonCode", String(xi.buttonCode)],
      ["IsButton", xmlBool(xi.isButton)],
      ["ButtonIndex", String(xi.buttonIndex)],
      ["XInputIndex", String(xi.xInputIndex)],
    ]
  }
  if (captured.api === "RawInput" && captured.rawInputButton) {
    const ri = captured.rawInputButton
    return [
      ["DevicePath", ri.devicePath],
      ["DeviceType", ri.deviceType],
      ["MouseButton", ri.mouseButton],
      ["KeyboardKey", ri.keyboardKey],
    ]
  }
  return null
}

/** Writes one captured API's structured element + per-API BindName label. */
function applyCapture(jb: Element, captured: CapturedBinding): boolean {
  const doc = jb.ownerDocument
  const fields = capturedFields(captured)
  if (!doc || !fields) return false
  const spec = API_ELEMENT[captured.api]
  const inputMapping = childrenByTag(jb, "InputMapping")[0]
  const childIndent = (inputMapping ? elementIndent(inputMapping) : "      ") + "  "
  upsertChildElement(jb, buildElement(doc, spec.tag, fields, childIndent), spec.before)
  upsertChildText(jb, spec.label, captured.label, ["BindName"])
  return true
}

/** Unbinds one API: removes its structured element and per-API BindName label. */
function clearApi(jb: Element, api: CapturedBinding["api"]): boolean {
  const spec = API_ELEMENT[api]
  const removedEl = removeChildElement(jb, spec.tag)
  const removedLabel = removeChildElement(jb, spec.label)
  return removedEl || removedLabel
}

/** Recomputes the composite `<BindName>` from the present per-API labels. */
function recomputeBindName(jb: Element): void {
  const parts: string[] = []
  const di = leafText(jb, "BindNameDi")
  const xi = leafText(jb, "BindNameXi")
  const ri = leafText(jb, "BindNameRi")
  if (di) parts.push(`DI: ${di}`)
  if (xi) parts.push(`XI: ${xi}`)
  if (ri) parts.push(`RI: ${ri}`)
  setChildText(jb, "BindName", parts.join(" | "))
}

/**
 * Applies a bulk control-binding update across several UserProfiles. For each
 * profile, every input binding whose ButtonName OR InputMapping matches an
 * update has the update's captures written and its listed APIs cleared, then
 * its composite BindName recomputed. Element order is preserved so C#'s
 * XmlSerializer still deserializes the file. Profiles that aren't installed, or
 * contain no matching control, are left untouched (reported as 0 updates).
 */
export function writeControlBindings(
  root: string,
  payload: BulkControlUpdate,
): BulkControlResult[] {
  return payload.profileNames.map((profileName) => {
    const file = userProfilePath(root, profileName)
    if (!existsSync(file)) return { profileName, updated: 0 }

    const doc = parseXmlFile(file)
    const outer = child(doc, "JoystickButtons")
    if (!outer) return { profileName, updated: 0 }

    let updated = 0
    for (const jb of childrenByTag(outer, "JoystickButtons")) {
      const buttonName = childText(jb, "ButtonName")
      const inputMapping = childText(jb, "InputMapping")
      const match = payload.updates.find(
        (u) => u.buttonNames.includes(buttonName) || u.inputMappings.includes(inputMapping),
      )
      if (!match) continue

      let changed = false
      for (const captured of match.captures ?? []) changed = applyCapture(jb, captured) || changed
      for (const api of match.clearApis ?? []) changed = clearApi(jb, api) || changed
      if (changed) {
        recomputeBindName(jb)
        updated++
      }
    }

    if (updated > 0) writeXmlFile(file, doc)
    return { profileName, updated }
  })
}
