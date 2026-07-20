/**
 * Classifies every TeknoParrot game by its physical control scheme, purely from
 * the input bindings declared in `GameProfiles/*.xml`, and writes the result to
 * a JSON file for downstream consumption.
 *
 * The classification logic itself lives in `src/shared/controlScheme.ts` so the
 * app (which tags every game during `listGames`) and this exporter stay in
 * lock-step. This script is just the batch driver: read files, parse XML into
 * bindings, classify, summarise, write JSON.
 *
 * Why GameProfiles (not UserProfiles): GameProfiles is the authoritative
 * template shipped for *every* known game, so the export covers the whole
 * catalog regardless of what is installed. A friendly display name is pulled
 * from the Metadata JSON (`game_name`) when available, but that is cosmetic; the
 * genre metadata TeknoParrot ships is inconsistent and is not used.
 *
 * Run it directly with Node (>= 22, which strips TypeScript types natively):
 *
 *   node scripts/classify-controls.mts [teknoParrotRoot] [outFile]
 *   npm run classify
 *
 * Defaults: root = "<cwd>/TeknoParrot", outFile = "<cwd>/control-classification.json".
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { DOMParser, type Element } from "@xmldom/xmldom"
import {
  classifyControls,
  CONTROL_SCHEME_LABELS,
  type ControlBinding,
  type ControlClassification,
  type ControlScheme,
} from "../src/shared/controlScheme.ts"

interface GameClassification extends ControlClassification {
  profileName: string
  name: string
}

interface Output {
  generatedFrom: string
  generatedAt: string
  totalGames: number
  summary: {
    byScheme: Record<string, number>
    joystick8WayByButtons: Record<string, number>
    byPlayers: Record<string, number>
  }
  games: GameClassification[]
}

// --- XML helpers (standalone; the app uses src/main/teknoparrot/xml.ts) -----

function childrenByTag(parent: Element, tag: string): Element[] {
  const out: Element[] = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i]
    if (node.nodeType === 1 && (node as Element).tagName === tag) out.push(node as Element)
  }
  return out
}

function childText(parent: Element, tag: string): string {
  return childrenByTag(parent, tag)[0]?.textContent?.trim() ?? ""
}

/**
 * Reads the input bindings from a GameProfile document. The outer
 * `<JoystickButtons>` wraps one nested `<JoystickButtons>` per binding (an
 * artefact of C#'s XmlSerializer). Bindings with an empty ButtonName are
 * skipped, matching the app's reader.
 */
function readBindings(xml: string): ControlBinding[] {
  const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ""), "text/xml")
  const outer = doc.getElementsByTagName("JoystickButtons")[0]
  if (!outer) return []
  return childrenByTag(outer as unknown as Element, "JoystickButtons")
    .map((jb) => ({
      buttonName: childText(jb, "ButtonName"),
      inputMapping: childText(jb, "InputMapping"),
      analogType: childText(jb, "AnalogType"),
    }))
    .filter((b) => b.buttonName.length > 0)
}

/** Friendly display name from Metadata JSON (cosmetic only). */
function readDisplayName(metadataDir: string, profileName: string): string {
  const file = join(metadataDir, `${profileName}.json`)
  if (!existsSync(file)) return profileName
  try {
    const json = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))
    const name = typeof json?.game_name === "string" ? json.game_name.trim() : ""
    return name || profileName
  } catch {
    return profileName
  }
}

// --- Main -------------------------------------------------------------------

function main(): void {
  const root = process.argv[2] || join(process.cwd(), "TeknoParrot")
  const outFile = process.argv[3] || join(process.cwd(), "control-classification.json")
  const gameProfilesDir = join(root, "GameProfiles")
  const metadataDir = join(root, "Metadata")

  if (!existsSync(gameProfilesDir)) {
    console.error(`GameProfiles directory not found: ${gameProfilesDir}`)
    console.error("Usage: node scripts/classify-controls.mts [teknoParrotRoot] [outFile]")
    process.exit(1)
  }

  const files = readdirSync(gameProfilesDir)
    .filter((f) => f.toLowerCase().endsWith(".xml"))
    .sort()

  const games: GameClassification[] = []
  for (const file of files) {
    const profileName = file.slice(0, -4)
    let bindings: ControlBinding[]
    try {
      bindings = readBindings(readFileSync(join(gameProfilesDir, file), "utf8"))
    } catch (e) {
      console.warn(`  skipped ${profileName}: ${(e as Error).message}`)
      continue
    }
    games.push({
      profileName,
      name: readDisplayName(metadataDir, profileName),
      ...classifyControls(bindings),
    })
  }

  games.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  // Summaries.
  const byScheme: Record<string, number> = {}
  const joystick8WayByButtons: Record<string, number> = {}
  const byPlayers: Record<string, number> = {}
  for (const g of games) {
    byScheme[g.controlScheme] = (byScheme[g.controlScheme] ?? 0) + 1
    byPlayers[String(g.players)] = (byPlayers[String(g.players)] ?? 0) + 1
    if (g.controlScheme === "joystick8Way" && g.buttonsPerPlayer != null) {
      const key = `${g.buttonsPerPlayer}`
      joystick8WayByButtons[key] = (joystick8WayByButtons[key] ?? 0) + 1
    }
  }

  const output: Output = {
    generatedFrom: gameProfilesDir,
    generatedAt: new Date().toISOString(),
    totalGames: games.length,
    summary: { byScheme, joystick8WayByButtons, byPlayers },
    games,
  }

  writeFileSync(outFile, JSON.stringify(output, null, 2) + "\n", "utf8")

  console.log(`Classified ${games.length} games -> ${outFile}\n`)
  console.log("By control scheme:")
  for (const [scheme, n] of Object.entries(byScheme).sort((a, b) => b[1] - a[1])) {
    const label = CONTROL_SCHEME_LABELS[scheme as ControlScheme] ?? scheme
    console.log(`  ${label.padEnd(18)} ${n}`)
  }
  console.log("\n8-way joystick, buttons per player:")
  for (const [n, c] of Object.entries(joystick8WayByButtons).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    console.log(`  ${n} buttons: ${c}`)
  }
}

main()
