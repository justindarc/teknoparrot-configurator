import { existsSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import type { GameSummary } from "@shared/teknoparrot"
import { classifyControls, type ControlBinding } from "@shared/controlScheme"
import { tpPaths } from "./paths"
import { readMetadata } from "./metadata"
import { child, childrenByTag, childBool, childText, parseXmlFile, type Document } from "./xml"

/**
 * Reads the input bindings from a profile document. The outer `<JoystickButtons>`
 * wraps one nested `<JoystickButtons>` per binding (a C# XmlSerializer artefact);
 * this mirrors the reader in userProfile.ts but returns only what the control
 * classifier needs.
 */
function readBindings(doc: Document): ControlBinding[] {
  const outer = child(doc, "JoystickButtons")
  if (!outer) return []
  return childrenByTag(outer, "JoystickButtons")
    .map((jb) => ({
      buttonName: childText(jb, "ButtonName"),
      inputMapping: childText(jb, "InputMapping"),
      analogType: childText(jb, "AnalogType"),
    }))
    .filter((b) => b.buttonName.length > 0)
}

/** Extracts the icon file name from an IconName element ("Icons/foo.png" -> "foo.png"). */
function iconFileFrom(iconName: string): string | undefined {
  const name = basename(iconName.trim())
  return name || undefined
}

/**
 * Builds the full game catalog: the union of GameProfiles (every known game)
 * and UserProfiles (installed games), enriched with metadata and icons. When a
 * UserProfile exists it takes precedence, since it carries the real GamePath.
 */
export function listGames(root: string): GameSummary[] {
  const paths = tpPaths(root)
  if (!existsSync(paths.gameProfiles)) return []

  const names = new Set<string>()
  for (const f of readdirSync(paths.gameProfiles)) {
    if (f.toLowerCase().endsWith(".xml")) names.add(f.slice(0, -4))
  }

  const summaries: GameSummary[] = []
  for (const profileName of names) {
    const userFile = join(paths.userProfiles, `${profileName}.xml`)
    const hasUser = existsSync(userFile)
    const sourceFile = hasUser ? userFile : join(paths.gameProfiles, `${profileName}.xml`)

    let doc
    try {
      doc = parseXmlFile(sourceFile)
    } catch {
      continue
    }

    const gamePath = childText(doc, "GamePath")
    const metadata = readMetadata(root, profileName)

    const iconFile =
      iconFileFrom(childText(doc, "IconName")) || resolveDefaultIcon(paths.icons, profileName)

    const { controlScheme, players, buttonsPerPlayer } = classifyControls(readBindings(doc))

    summaries.push({
      profileName,
      name: childText(doc, "GameNameInternal") || profileName,
      genre: childText(doc, "GameGenreInternal") || undefined,
      emulator: childText(doc, "EmulatorType") || undefined,
      iconFile,
      installed: hasUser && gamePath.length > 0,
      gamePath: gamePath || undefined,
      requiresAdmin: childBool(doc, "RequiresAdmin"),
      patreon: childBool(doc, "Patreon"),
      is64Bit: childBool(doc, "Is64Bit"),
      metadata,
      controlScheme,
      players,
      buttonsPerPlayer,
    })
  }

  summaries.sort((a, b) => a.name.localeCompare(b.name))
  return summaries
}

/** Falls back to `<profileName>.png` in the Icons folder if it exists. */
function resolveDefaultIcon(iconsDir: string, profileName: string): string | undefined {
  return existsSync(join(iconsDir, `${profileName}.png`)) ? `${profileName}.png` : undefined
}

/** Reads a single top-level field from a game's authoritative profile file. */
export function readProfileField(root: string, profileName: string, tag: string): string {
  const paths = tpPaths(root)
  const userFile = join(paths.userProfiles, `${profileName}.xml`)
  const file = existsSync(userFile) ? userFile : join(paths.gameProfiles, `${profileName}.xml`)
  if (!existsSync(file)) return ""
  const doc = parseXmlFile(file)
  return child(doc, tag)?.textContent?.trim() ?? ""
}
