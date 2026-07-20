import type { RawInputDeviceInfo } from "@shared/teknoparrot"

/**
 * Enumerates RawInput-capable devices (keyboards and mice) so the controls
 * editor can record a real `<RawInputButton>` DevicePath. TeknoParrot derives a
 * friendly device name from VID/PID and the product/manufacturer strings; we
 * reproduce that logic (see JoystickControlRawInput.GetFancyDeviceName) so the
 * captured BindName matches what TeknoParrot itself would show.
 *
 * node-hid is a Windows-friendly, N-API (ABI-stable) module; it is loaded
 * lazily and guarded so the rest of the app keeps working if it is missing.
 */

interface HidDevice {
  path?: string
  vendorId: number
  productId: number
  manufacturer?: string
  product?: string
  usagePage?: number
  usage?: number
}

interface NodeHid {
  devices(): HidDevice[]
}

let hid: NodeHid | null = null
let loadFailed = false

async function loadHid(): Promise<NodeHid | null> {
  if (hid || loadFailed) return hid
  try {
    // node-hid is CommonJS; unwrap the dynamic-import namespace's `default`.
    const mod = (await import("node-hid")) as { default?: NodeHid } & NodeHid
    hid = (mod.default ?? mod) as NodeHid
  } catch (err) {
    loadFailed = true
    console.warn("[rawInputDevices] node-hid unavailable:", (err as Error).message)
  }
  return hid
}

/** Reproduces TeknoParrot's GetFancyDeviceName for the special-cased devices. */
function fancyName(device: HidDevice): string {
  const { vendorId: vid, productId: pid, path } = device

  // Ultimarc AimTrak lightguns.
  if (vid === 0xd209 && pid >= 0x1601 && pid <= 0x1608) {
    return `Ultimarc AimTrak #${pid - 0x1600}`
  }
  // Sinden lightguns.
  if (vid === 0x16c0) {
    if (pid === 0x0f01) return "Sinden Lightgun Blue"
    if (pid === 0x0f02) return "Sinden Lightgun Red"
    if (pid === 0x0f38) return "Sinden Lightgun Black"
    if (pid === 0x0f39) return "Sinden Lightgun Player 2"
  }
  // Mayflash DolphinBar (CRC segment of the device path keeps it unique).
  if (vid === 0x0079 && pid === 0x1802 && path) {
    const parts = path.split("#")
    if (parts.length > 2) {
      const sub = parts[2].split("&")
      if (sub.length > 1) return `Mayflash DolphinBar ${sub[1].toUpperCase()}`
    }
  }

  // Otherwise fall back to the product/manufacturer strings.
  const manufacturer = device.manufacturer?.trim() ?? ""
  const product = device.product?.trim() ?? ""
  if (path?.includes("Microsoft Mouse RID")) return "Emulated Device"
  if (!product) return manufacturer || "Unknown Product"
  if (manufacturer === "(Standard keyboards)" || product.includes(manufacturer)) return product
  return manufacturer ? `${manufacturer} ${product}` : product
}

/** Lists connected keyboards and mice with TeknoParrot-style names. */
export async function listRawInputDevices(): Promise<RawInputDeviceInfo[]> {
  const mod = await loadHid()
  if (!mod) return []

  const out: RawInputDeviceInfo[] = []
  const seen = new Set<string>()
  for (const device of mod.devices()) {
    if (!device.path || device.usagePage !== 0x01) continue
    // Generic Desktop usage: 6 = keyboard, 2 = mouse.
    const type = device.usage === 0x06 ? "Keyboard" : device.usage === 0x02 ? "Mouse" : null
    if (!type) continue
    if (seen.has(device.path)) continue
    seen.add(device.path)
    out.push({ path: device.path, name: fancyName(device), type })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
