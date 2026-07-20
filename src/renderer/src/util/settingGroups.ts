import type { ConfigField, FieldType, GameConfig } from "@shared/teknoparrot"
import { fieldKey } from "@shared/teknoparrot"

/** A game that exposes a particular setting. */
export interface SettingGame {
  profileName: string
  name: string
  /** That game's current value for the setting. */
  value: string
  /** That game's GameProfiles default, absent when the template lacks the field. */
  defaultValue?: string
}

/**
 * One setting shared across a set of games, keyed by `Category::FieldName`.
 *
 * Games rarely agree on a field's full definition — the same setting can offer
 * different dropdown options or slider bounds per game — so the merged
 * definition is permissive: the first-seen type wins, options are unioned and
 * slider bounds widened, and `mixedDefinition` flags the disagreement so the UI
 * can warn. The saved value is a plain string either way, which is all a
 * UserProfile stores.
 */
export interface SettingGroup {
  /** `fieldKey(category, name)` — stable key for React lists and edits. */
  id: string
  category: string
  name: string
  type: FieldType
  min: number
  max: number
  step: number
  options: string[]
  hint?: string
  /** The games defining this setting, in natural name order. */
  games: SettingGame[]
  /** True when contributing games describe the field differently. */
  mixedDefinition: boolean
}

interface Bucket {
  category: string
  name: string
  type: FieldType
  min: number
  max: number
  step: number
  options: string[]
  optionSet: Set<string>
  hint?: string
  games: SettingGame[]
  /** Guards the badge count against a profile listing the same field twice. */
  seen: Set<string>
  mixedDefinition: boolean
}

const natural = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true })

/** True when a later game's definition of the same field disagrees materially. */
function conflicts(bucket: Bucket, field: ConfigField): boolean {
  if (bucket.type !== field.type) return true
  if (field.type === "Slider") return bucket.min !== field.min || bucket.max !== field.max
  if (field.type === "Dropdown" || field.type === "DropdownIndex") {
    return (
      field.options.some((o) => !bucket.optionSet.has(o)) ||
      field.options.length !== bucket.options.length
    )
  }
  return false
}

/**
 * Builds the merged settings list across the given game configs. Category order
 * and, within a category, field order follow first appearance in the profile
 * XML rather than an imposed sort — that ordering is meaningful to TeknoParrot.
 */
export function buildSettingGroups(configs: GameConfig[]): SettingGroup[] {
  const buckets = new Map<string, Bucket>()

  for (const cfg of configs) {
    for (const field of cfg.fields) {
      if (!field.name) continue
      const key = fieldKey(field.category, field.name)

      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = {
          category: field.category,
          name: field.name,
          type: field.type,
          min: field.min,
          max: field.max,
          step: field.step,
          options: [...field.options],
          optionSet: new Set(field.options),
          hint: field.hint,
          games: [],
          seen: new Set(),
          mixedDefinition: false,
        }
        buckets.set(key, bucket)
      } else {
        if (conflicts(bucket, field)) bucket.mixedDefinition = true
        // Widen rather than narrow: a value valid in one game stays selectable.
        for (const option of field.options) {
          if (bucket.optionSet.has(option)) continue
          bucket.optionSet.add(option)
          bucket.options.push(option)
        }
        bucket.min = Math.min(bucket.min, field.min)
        bucket.max = Math.max(bucket.max, field.max)
        if (!bucket.step) bucket.step = field.step
        bucket.hint ??= field.hint
      }

      if (bucket.seen.has(cfg.profileName)) continue
      bucket.seen.add(cfg.profileName)
      bucket.games.push({
        profileName: cfg.profileName,
        name: cfg.name,
        value: field.value,
        defaultValue: field.defaultValue,
      })
    }
  }

  return [...buckets.entries()].map(([id, bucket]) => ({
    id,
    category: bucket.category,
    name: bucket.name,
    type: bucket.type,
    min: bucket.min,
    max: bucket.max,
    step: bucket.step,
    options: bucket.options,
    hint: bucket.hint,
    games: [...bucket.games].sort((a, b) => natural(a.name, b.name)),
    mixedDefinition: bucket.mixedDefinition,
  }))
}

/**
 * The value every game agrees on, or `null` when they differ (a "multiple
 * values" state).
 */
export function sharedValue(group: SettingGroup): string | null {
  const first = group.games[0]?.value ?? ""
  return group.games.every((g) => g.value === first) ? first : null
}

/**
 * The default every game agrees on, or `null` when their templates differ.
 * `undefined` means no selected game ships a default for this setting, so
 * there's nothing to reset to.
 */
export function sharedDefault(group: SettingGroup): string | null | undefined {
  const withDefault = group.games.filter((g) => g.defaultValue !== undefined)
  if (withDefault.length === 0) return undefined
  const first = withDefault[0].defaultValue as string
  return withDefault.every((g) => g.defaultValue === first) ? first : null
}

/**
 * True when resetting would actually change something — at least one game has a
 * default and is not already sitting on it.
 */
export function canResetToDefault(group: SettingGroup): boolean {
  return group.games.some((g) => g.defaultValue !== undefined && g.defaultValue !== g.value)
}

/** Groups settings by category, preserving first-seen order. */
export function byCategory(groups: SettingGroup[]): [string, SettingGroup[]][] {
  const categories = new Map<string, SettingGroup[]>()
  for (const group of groups) {
    const list = categories.get(group.category) ?? []
    list.push(group)
    categories.set(group.category, list)
  }
  return [...categories.entries()]
}
