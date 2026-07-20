import type { GlobalSettings } from "@shared/teknoparrot"
import { tpPaths } from "./paths"
import { childBool, childNumber, childText, parseXmlFile, setChildText, writeXmlFile } from "./xml"

/**
 * Maps each GlobalSettings key to its ParrotData.xml element name. This single
 * table drives both reading and writing, keeping them in sync.
 */
const BOOL_FIELDS: Record<string, keyof GlobalSettings> = {
  SaveLastPlayed: "saveLastPlayed",
  UseDiscordRPC: "useDiscordRPC",
  SilentMode: "silentMode",
  CheckForUpdates: "checkForUpdates",
  ConfirmExit: "confirmExit",
  ConfirmGameDeletion: "confirmGameDeletion",
  DownloadIcons: "downloadIcons",
  UiDarkMode: "uiDarkMode",
  UseSto0ZDrivingHack: "useSto0ZDrivingHack",
  FullAxisGas: "fullAxisGas",
  FullAxisBrake: "fullAxisBrake",
  ReverseAxisGas: "reverseAxisGas",
  ReverseAxisBrake: "reverseAxisBrake",
}

const TEXT_FIELDS: Record<string, keyof GlobalSettings> = {
  LastPlayed: "lastPlayed",
  Language: "language",
  ExitGameKey: "exitGameKey",
  PauseGameKey: "pauseGameKey",
  UiColour: "uiColour",
  DatXmlLocation: "datXmlLocation",
}

const NUMBER_FIELDS: Record<string, keyof GlobalSettings> = {
  StoozPercent: "stoozPercent",
}

export function readGlobalSettings(root: string): GlobalSettings {
  const doc = parseXmlFile(tpPaths(root).parrotData)
  const settings = {} as GlobalSettings

  for (const [element, key] of Object.entries(BOOL_FIELDS)) {
    ;(settings[key] as boolean) = childBool(doc, element)
  }
  for (const [element, key] of Object.entries(TEXT_FIELDS)) {
    ;(settings[key] as string) = childText(doc, element)
  }
  for (const [element, key] of Object.entries(NUMBER_FIELDS)) {
    ;(settings[key] as number) = childNumber(doc, element)
  }

  return settings
}

/**
 * Writes changed global settings back into ParrotData.xml by mutating the
 * existing document in place, so every element TeknoParrot wrote is preserved.
 */
export function writeGlobalSettings(root: string, settings: GlobalSettings): GlobalSettings {
  const file = tpPaths(root).parrotData
  const doc = parseXmlFile(file)

  for (const [element, key] of Object.entries(BOOL_FIELDS)) {
    setChildText(doc, element, settings[key] ? "true" : "false")
  }
  for (const [element, key] of Object.entries(TEXT_FIELDS)) {
    setChildText(doc, element, String(settings[key] ?? ""))
  }
  for (const [element, key] of Object.entries(NUMBER_FIELDS)) {
    setChildText(doc, element, String(settings[key] ?? 0))
  }

  writeXmlFile(file, doc)
  return readGlobalSettings(root)
}
