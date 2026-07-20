import { existsSync, readdirSync, statSync } from "node:fs"
import { basename, join } from "node:path"
import type { InstallInfo } from "@shared/ipc"

/** Resolves the well-known sub-paths within a TeknoParrot installation. */
export function tpPaths(root: string): {
  parrotData: string
  userProfiles: string
  gameProfiles: string
  metadata: string
  icons: string
} {
  return {
    parrotData: join(root, "ParrotData.xml"),
    userProfiles: join(root, "UserProfiles"),
    gameProfiles: join(root, "GameProfiles"),
    metadata: join(root, "Metadata"),
    icons: join(root, "Icons"),
  }
}

function countXml(dir: string): number {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return 0
  return readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml")).length
}

/**
 * Inspects a candidate directory and reports whether it looks like a valid
 * TeknoParrot installation.
 */
export function validateInstall(root: string): InstallInfo {
  const p = tpPaths(root)
  const hasParrotData = existsSync(p.parrotData)
  const userProfileCount = countXml(p.userProfiles)
  const gameProfileCount = countXml(p.gameProfiles)
  return {
    valid: hasParrotData && gameProfileCount > 0,
    hasParrotData,
    userProfileCount,
    gameProfileCount,
  }
}

/**
 * Resolves a requested icon file to an absolute path inside the Icons folder,
 * guarding against path-traversal. Returns undefined if the file is outside the
 * Icons directory or does not exist.
 */
export function resolveIconPath(root: string, iconFile: string): string | undefined {
  const safe = basename(iconFile) // strip any directory components (traversal guard)
  if (!safe) return undefined
  const full = join(tpPaths(root).icons, safe)
  return existsSync(full) ? full : undefined
}
