/** Builds a tpasset:// URL for a game icon, served by the main process. */
export function iconUrl(iconFile?: string): string | undefined {
  return iconFile ? `tpasset://icon/${encodeURIComponent(iconFile)}` : undefined
}
