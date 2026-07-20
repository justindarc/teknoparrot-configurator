import { readFile } from "node:fs/promises"
import { protocol } from "electron"
import { resolveIconPath } from "./paths"
import { getTeknoParrotPath } from "../store"

export const TP_ASSET_SCHEME = "tpasset"

/**
 * Must be called before `app.whenReady()`. Registers the custom scheme as
 * privileged so the sandboxed renderer may load icons via
 * `tpasset://icon/<file>.png` under a strict CSP.
 */
export function registerIconScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: TP_ASSET_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ])
}

/**
 * Must be called after the app is ready. Serves PNG icons from the currently
 * configured TeknoParrot Icons directory. Path-traversal is prevented by
 * `resolveIconPath`, which reduces the request to a bare file name.
 */
export function handleIconProtocol(): void {
  protocol.handle(TP_ASSET_SCHEME, async (request) => {
    const url = new URL(request.url)
    // URL form: tpasset://icon/<file>.png  -> host "icon", pathname "/<file>.png"
    if (url.hostname !== "icon") return new Response("Not found", { status: 404 })

    const root = getTeknoParrotPath()
    if (!root) return new Response("No TeknoParrot path configured", { status: 404 })

    const iconFile = decodeURIComponent(url.pathname.replace(/^\//, ""))
    const full = resolveIconPath(root, iconFile)
    if (!full) return new Response("Not found", { status: 404 })

    try {
      const data = await readFile(full)
      return new Response(data, { headers: { "Content-Type": "image/png" } })
    } catch {
      return new Response("Not found", { status: 404 })
    }
  })
}
