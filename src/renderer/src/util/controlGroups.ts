import type { GameConfig, InputApi } from "@shared/teknoparrot"

/** A game that uses a particular (InputMapping, ButtonName) combination. */
export interface ControlLabelGame {
  profileName: string
  name: string
}

/** One ButtonName label within a control group, plus the games that use it. */
export interface ControlLabel {
  label: string
  games: ControlLabelGame[]
}

/**
 * A de-duplicated control shared across a set of games.
 *
 * Controls are grouped by their **InputMapping** — the profile's underlying
 * control id (e.g. "P1Button1", "Test"). One row per mapping. Each distinct
 * ButtonName games attach to that mapping becomes a `ControlLabel` carrying the
 * games that use that exact (mapping, name) pair, so the UI can reveal outliers.
 * Bindings without an InputMapping fall back to being keyed by ButtonName.
 */
export interface ControlGroup {
  /** Stable key for React lists and dirty-tracking. */
  id: string
  /** Primary display text — the InputMapping id (or ButtonName when unmapped). */
  mapping: string
  /** The distinct ButtonName labels for this mapping, each with its games. */
  labels: ControlLabel[]
  /** The InputMapping this row represents; the save match key for mapped rows. */
  inputMappings: string[]
  /** ButtonNames used as the save match key for unmapped fallback rows. */
  buttonNames: string[]
  /** Current composite BindName for each contributing binding (may duplicate). */
  currentValues: string[]
  /** Current per-API BindName labels for each contributing binding. */
  currentDi: string[]
  currentXi: string[]
  currentRi: string[]
  /** Profile names of games that contain this control. */
  profileNames: string[]
}

interface Bucket {
  mapping: string
  isMapping: boolean
  /** label -> (profileName -> display name) */
  labelGames: Map<string, Map<string, string>>
  currentValues: string[]
  currentDi: string[]
  currentXi: string[]
  currentRi: string[]
  profileNames: Set<string>
}

const natural = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true })

/**
 * Builds the merged control list across the given game configs. Bindings with
 * an empty ButtonName are ignored. Group and label order follows first
 * appearance in the profile XML (Map insertion order), not an imposed sort.
 */
export function buildControlGroups(configs: GameConfig[]): ControlGroup[] {
  const buckets = new Map<string, Bucket>()

  for (const cfg of configs) {
    for (const binding of cfg.inputs) {
      if (!binding.buttonName) continue
      // Skip bindings TeknoParrot only shows in a non-default mode (e.g. the
      // keyboard-for-axis "Left"/"Right" halves of an analog control), so each
      // control surfaces just its canonical binding.
      if (binding.hiddenByDefault) continue

      const isMapping = binding.inputMapping.length > 0
      const mapping = isMapping ? binding.inputMapping : binding.buttonName
      const key = isMapping ? `map:${mapping}` : `btn:${mapping}`

      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = {
          mapping,
          isMapping,
          labelGames: new Map(),
          currentValues: [],
          currentDi: [],
          currentXi: [],
          currentRi: [],
          profileNames: new Set(),
        }
        buckets.set(key, bucket)
      }
      let games = bucket.labelGames.get(binding.buttonName)
      if (!games) {
        games = new Map()
        bucket.labelGames.set(binding.buttonName, games)
      }
      games.set(cfg.profileName, cfg.name)
      bucket.currentValues.push(binding.bindName)
      bucket.currentDi.push(binding.bindNameDi)
      bucket.currentXi.push(binding.bindNameXi)
      bucket.currentRi.push(binding.bindNameRi)
      bucket.profileNames.add(cfg.profileName)
    }
  }

  const groups: ControlGroup[] = []
  for (const [key, bucket] of buckets) {
    // Preserve first-appearance order for labels; only game lists (shown in a
    // popover) are sorted for readability.
    const labels: ControlLabel[] = [...bucket.labelGames.entries()].map(([label, games]) => ({
      label,
      games: [...games.entries()]
        .map(([profileName, name]) => ({ profileName, name }))
        .sort((a, b) => natural(a.name, b.name)),
    }))

    groups.push({
      id: key,
      mapping: bucket.mapping,
      labels,
      inputMappings: bucket.isMapping ? [bucket.mapping] : [],
      buttonNames: bucket.isMapping ? [] : labels.map((l) => l.label),
      currentValues: bucket.currentValues,
      currentDi: bucket.currentDi,
      currentXi: bucket.currentXi,
      currentRi: bucket.currentRi,
      profileNames: [...bucket.profileNames],
    })
  }

  return groups
}

/**
 * The single shared value across a set of per-binding values, or `null` when
 * they disagree (a "multiple values" state).
 */
export function sharedOf(values: string[]): string | null {
  const first = values[0] ?? ""
  return values.every((v) => v === first) ? first : null
}

/** The current per-API values array for a group. */
export function apiValues(group: ControlGroup, api: InputApi): string[] {
  return api === "DirectInput"
    ? group.currentDi
    : api === "XInput"
      ? group.currentXi
      : group.currentRi
}
