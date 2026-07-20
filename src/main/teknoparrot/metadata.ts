import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { GameMetadata } from "@shared/teknoparrot"
import { tpPaths } from "./paths"

/** Shape of a raw Metadata/*.json file. */
interface RawMetadata {
  game_name?: string
  game_genre?: string
  icon_name?: string
  platform?: string
  release_year?: string
  wheel_rotation?: string
  supported_versions?: string[] | null
  general_issues?: string | null
  nvidia?: string
  nvidia_issues?: string | null
  amd?: string
  amd_issues?: string | null
  intel?: string
  intel_issues?: string | null
}

/** Reads and normalises a game's metadata JSON, or undefined if absent. */
export function readMetadata(root: string, profileName: string): GameMetadata | undefined {
  const file = join(tpPaths(root).metadata, `${profileName}.json`)
  if (!existsSync(file)) return undefined

  let raw: RawMetadata
  try {
    raw = JSON.parse(readFileSync(file, "utf8")) as RawMetadata
  } catch {
    return undefined
  }

  return {
    platform: raw.platform || undefined,
    releaseYear: raw.release_year || undefined,
    wheelRotation: raw.wheel_rotation || undefined,
    supportedVersions: Array.isArray(raw.supported_versions) ? raw.supported_versions : [],
    generalIssues: raw.general_issues ?? null,
    nvidia: { status: raw.nvidia || undefined, issues: raw.nvidia_issues ?? null },
    amd: { status: raw.amd || undefined, issues: raw.amd_issues ?? null },
    intel: { status: raw.intel || undefined, issues: raw.intel_issues ?? null },
  }
}
