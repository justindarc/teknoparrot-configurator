import type { WebContents } from "electron"
import { BrowserWindow } from "electron"
import { IpcChannels } from "@shared/ipc"
import type { CapturedBinding, DirectInputButtonData } from "@shared/teknoparrot"

/**
 * DirectInput joystick/wheel capture, matching what TeknoParrot (SharpDX)
 * records: the device's DirectInput **InstanceGuid** plus the DIJOYSTATE2
 * object offset. No npm package exposes the InstanceGuid, so we drive
 * dinput8.dll's COM API directly through koffi:
 *
 *   DirectInput8Create -> IDirectInput8::EnumDevices (collect GUID + type)
 *   -> CreateDevice -> SetDataFormat -> SetCooperativeLevel -> Acquire
 *   -> poll GetDeviceState (DIJOYSTATE2) and diff against a baseline.
 *
 * Windows-only. Keyboards use the DOM path instead (fixed SysKeyboard GUID),
 * so this module only enumerates game controllers (DI8DEVCLASS_GAMECTRL).
 *
 * koffi pointers are opaque "external" values (never BigInt): all pointers we
 * read from output buffers or COM vtables go through koffi.decode(..,'void *').
 * Named koffi types/prototypes are created exactly once (koffi registers names
 * globally and rejects duplicates), then reused across capture sessions.
 *
 * NOTE: this cannot be tested off-Windows. Set TP_INPUT_DEBUG=1 to log the
 * enumerated devices and raw state deltas when verifying on a real machine.
 */

const DEBUG = process.env.TP_INPUT_DEBUG === "1"
const log = (...a: unknown[]): void => {
  if (DEBUG) console.log("[directInput]", ...a)
}

// --- DirectInput constants ---
const DIRECTINPUT_VERSION = 0x0800
const DI8DEVCLASS_GAMECTRL = 4
const DIEDFL_ATTACHEDONLY = 1
const DIDF_ABSAXIS = 1
const DISCL_BACKGROUND = 0x8
const DISCL_NONEXCLUSIVE = 0x2
const DIENUM_CONTINUE = 1
// DIDFT object-type flags.
const DIDFT_AXIS = 0x00000003
const DIDFT_PSHBUTTON = 0x00000004
const DIDFT_POV = 0x00000010
const DIDFT_ANYINSTANCE = 0x00ffff00
const DIDFT_OPTIONAL = 0x80000000
// IID_IDirectInput8W = {BF798031-483A-4DA2-AA99-5D64ED369700}
const IID_IDIRECTINPUT8W = [
  0x31, 0x80, 0x79, 0xbf, 0x3a, 0x48, 0xa2, 0x4d, 0xaa, 0x99, 0x5d, 0x64, 0xed, 0x36, 0x97, 0x00,
]

// IDirectInput8 vtable indices.
const IDI_Release = 2
const IDI_CreateDevice = 3
const IDI_EnumDevices = 4
// IDirectInputDevice8 vtable indices.
const IDID_Release = 2
const IDID_Acquire = 7
const IDID_Unacquire = 8
const IDID_GetDeviceState = 9
const IDID_SetDataFormat = 11
const IDID_SetCooperativeLevel = 13
const IDID_Poll = 25

// DIJOYSTATE2 layout (first 176 bytes we care about).
const OFS_AXES = [0, 4, 8, 12, 16, 20, 24, 28] // X Y Z Rx Ry Rz Slider0 Slider1
const AXIS_NAMES = ["X", "Y", "Z", "RotationX", "RotationY", "RotationZ", "Sliders0", "Sliders1"]

// DirectInput object GUIDs are all A36D02xx-C9F3-11CF-BFC7-444553540000; only
// the first (little-endian) byte varies. Pinning each axis to its GUID makes
// DInput map objects to the canonical DIJOYSTATE2 offsets (so offset 0 is
// really the X axis) instead of packing them in enumeration order.
const GUID_TAIL = [
  0x02, 0x6d, 0xa3, 0xf3, 0xc9, 0xcf, 0x11, 0xbf, 0xc7, 0x44, 0x45, 0x53, 0x54, 0x00, 0x00,
]
const objectGuid = (first: number): Buffer => Buffer.from([first, ...GUID_TAIL])
// First byte per object type: X E0, Y E1, Z E2, Rx F4, Ry F5, Rz E3, Slider E4, POV F2.
const AXIS_GUID_FIRST = [0xe0, 0xe1, 0xe2, 0xf4, 0xf5, 0xe3, 0xe4, 0xe4]
const POV_GUID_FIRST = 0xf2
const OFS_POV = [32, 36, 40, 44]
const OFS_BUTTONS = 48
const BUTTON_COUNT = 128
const STATE_SIZE = 176
// Axis deflection from rest that counts as a press, with hysteresis so a noisy
// axis doesn't chatter around the boundary.
const AXIS_ON = 12000
const AXIS_OFF = 7000
// Successful polls used to settle the resting baseline before detecting input.
// The first reads after Acquire can be zeroed/transient, which would make a
// centered or trigger axis look permanently deflected.
const WARMUP_POLLS = 4

// SharpDX DeviceType names by DI8DEVTYPE low byte, used for the label prefix.
const DEVICE_TYPE_NAMES: Record<number, string> = {
  1: "Device",
  2: "Mouse",
  3: "Keyboard",
  4: "Joystick",
  5: "Gamepad",
  6: "Driving",
  7: "Flight",
  8: "FirstPerson",
  9: "ControlDevice",
  10: "ScreenPointer",
  11: "Remote",
  12: "Supplemental",
}

/** koffi pointers are opaque externals. */
type Ptr = unknown

interface Koffi {
  load(name: string): { func(signature: string): (...args: unknown[]) => unknown }
  struct(name: string, def: Record<string, unknown>): unknown
  array(type: unknown, len: number): unknown
  pointer(type: unknown): unknown
  proto(signature: string): unknown
  sizeof(type: unknown): number
  decode(value: unknown, offset: unknown, type?: unknown, len?: unknown): unknown
  encode(buffer: Buffer, offset: number, type: unknown, value: unknown): void
  call(ptr: unknown, proto: unknown, ...args: unknown[]): unknown
  register(fn: (...args: unknown[]) => unknown, type: unknown): Ptr
  unregister(handle: unknown): void
}

interface DiDevice {
  guidBytes: Buffer
  guid: string
  typeName: string
  instanceName: string
}

interface AcquiredDevice {
  device: DiDevice
  ptr: Ptr
  /** Resting state, settled over the first few polls (null until warmed up). */
  rest: Buffer | null
  warmup: number
  /** Rising-edge tracking so held/resting inputs don't re-fire. */
  axisActive: boolean[]
  povActive: boolean[]
  buttonActive: boolean[]
}

let koffi: Koffi | null = null
let loadFailed = false
let dinput: Ptr = null
let acquired: AcquiredDevice[] = []
let timer: ReturnType<typeof setInterval> | null = null
let polling = false
let sender: WebContents | null = null

// --- koffi types / prototypes, created once ---
let typesReady = false
let GUID: unknown
let OBJDF: unknown
let DATAFMT: unknown
let ProtoEnum: unknown
let ProtoEnumCbPtr: unknown
let ProtoEnumCb: unknown
let ProtoCreate: unknown
let ProtoCoop: unknown
let ProtoGetState: unknown
const ProtoVoid = new Map<number, unknown>()

// Data format buffers, built once and retained (dataFormatBuf.rgodf points into
// rgodfBuf, whose entries point at the GUID buffers, so all must stay alive).
let dataFormatBuf: Buffer | null = null
let rgodfBuf: Buffer | null = null
let guidBufs: Buffer[] = []

async function loadKoffi(): Promise<Koffi | null> {
  if (koffi || loadFailed) return koffi
  if (process.platform !== "win32") {
    loadFailed = true
    return null
  }
  try {
    // koffi is CommonJS; a dynamic import wraps it in a namespace whose
    // `default` holds the actual module (where .struct/.array/etc. live).
    const mod = (await import("koffi")) as { default?: Koffi } & Koffi
    koffi = (mod.default ?? mod) as Koffi
  } catch (err) {
    loadFailed = true
    console.warn("[directInput] koffi unavailable:", (err as Error).message)
  }
  return koffi
}

/** Registers the named koffi structs/prototypes we reuse — exactly once. */
function ensureTypes(k: Koffi): void {
  if (typesReady) return
  GUID = k.struct("DI_GUID", {
    Data1: "uint32",
    Data2: "uint16",
    Data3: "uint16",
    Data4: k.array("uint8", 8),
  })
  OBJDF = k.struct("DIOBJECTDATAFORMAT", {
    pguid: "void *",
    dwOfs: "uint32",
    dwType: "uint32",
    dwFlags: "uint32",
  })
  DATAFMT = k.struct("DIDATAFORMAT", {
    dwSize: "uint32",
    dwObjSize: "uint32",
    dwFlags: "uint32",
    dwDataSize: "uint32",
    dwNumObjs: "uint32",
    rgodf: "void *",
  })
  ProtoEnumCb = k.proto("int __stdcall DIEnumCb(void *lpddi, void *pvRef)")
  ProtoEnumCbPtr = k.pointer(ProtoEnumCb)
  ProtoEnum = k.proto(
    "int __stdcall DIEnumDevices(void *self, uint dwDevClass, void *cb, void *ref, uint flags)",
  )
  ProtoCreate = k.proto(
    "int __stdcall DICreateDevice(void *self, void *guid, void **out, void *outer)",
  )
  ProtoCoop = k.proto("int __stdcall DISetCoop(void *self, void *hwnd, uint flags)")
  ProtoGetState = k.proto("int __stdcall DIGetDeviceState(void *self, uint size, void *data)")
  typesReady = true
}

/** Prototype for a COM method taking `self` + N pointer args, returning HRESULT. */
function voidProto(k: Koffi, arity: number): unknown {
  let proto = ProtoVoid.get(arity)
  if (!proto) {
    const params = Array(arity).fill("void *").join(", ")
    proto = k.proto(`int __stdcall DIVoid${arity}(void *self${params ? ", " + params : ""})`)
    ProtoVoid.set(arity, proto)
  }
  return proto
}

/** Reads a pointer stored at (ptr + offset) as a koffi external. */
function readPtr(k: Koffi, ptr: Ptr, offset: number): Ptr {
  return k.decode(ptr, offset, "void *")
}

/** Returns the COM method pointer at vtable slot `index` of interface `ptr`. */
function vtblMethod(k: Koffi, ptr: Ptr, index: number): Ptr {
  const vtbl = readPtr(k, ptr, 0)
  return readPtr(k, vtbl, index * 8)
}

/** Calls a COM method that takes `self` + N pointer args and returns HRESULT. */
function callVoid(k: Koffi, self: Ptr, index: number, ...args: Ptr[]): number {
  return k.call(vtblMethod(k, self, index), voidProto(k, args.length), self, ...args) as number
}

/** Builds the custom DIJOYSTATE2-compatible data format once. */
function buildDataFormat(k: Koffi): Buffer {
  if (dataFormatBuf && rgodfBuf && guidBufs.length) return dataFormatBuf
  const objSize = k.sizeof(OBJDF)
  const entries: Array<{ dwOfs: number; dwType: number; pguid: Buffer | null }> = []
  OFS_AXES.forEach((ofs, i) => {
    entries.push({
      dwOfs: ofs,
      dwType: DIDFT_AXIS | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
      pguid: objectGuid(AXIS_GUID_FIRST[i]),
    })
  })
  for (const ofs of OFS_POV)
    entries.push({
      dwOfs: ofs,
      dwType: DIDFT_POV | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
      pguid: objectGuid(POV_GUID_FIRST),
    })
  for (let i = 0; i < BUTTON_COUNT; i++)
    entries.push({
      dwOfs: OFS_BUTTONS + i,
      dwType: DIDFT_PSHBUTTON | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
      pguid: null,
    })

  // Retain the GUID buffers; rgodf stores raw pointers into them.
  guidBufs = entries.map((e) => e.pguid).filter((g): g is Buffer => g !== null)

  const rgodf = Buffer.alloc(objSize * entries.length)
  entries.forEach((e, i) => {
    k.encode(rgodf, i * objSize, OBJDF, {
      pguid: e.pguid,
      dwOfs: e.dwOfs,
      dwType: e.dwType,
      dwFlags: 0,
    })
  })
  rgodfBuf = rgodf

  const fmtSize = k.sizeof(DATAFMT)
  const buf = Buffer.alloc(fmtSize)
  k.encode(buf, 0, DATAFMT, {
    dwSize: fmtSize,
    dwObjSize: objSize,
    dwFlags: DIDF_ABSAXIS,
    dwDataSize: STATE_SIZE,
    dwNumObjs: entries.length,
    rgodf,
  })
  dataFormatBuf = buf
  return buf
}

function guidToString(k: Koffi, bytes: Buffer): string {
  const g = k.decode(bytes, 0, GUID) as {
    Data1: number
    Data2: number
    Data3: number
    Data4: number[]
  }
  const h = (n: number, w: number): string => (n >>> 0).toString(16).padStart(w, "0")
  const d = g.Data4
  return (
    `${h(g.Data1, 8)}-${h(g.Data2, 4)}-${h(g.Data3, 4)}-` +
    `${h(d[0], 2)}${h(d[1], 2)}-${h(d[2], 2)}${h(d[3], 2)}${h(d[4], 2)}${h(d[5], 2)}${h(d[6], 2)}${h(d[7], 2)}`
  )
}

/** Reads the main window's HWND as a koffi external. */
function getMainHwnd(k: Koffi): Ptr {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return null
  return readPtr(k, win.getNativeWindowHandle(), 0)
}

/** Enumerates attached game controllers, returning their GUID + type. */
function enumerateDevices(k: Koffi, pDI: Ptr): DiDevice[] {
  const devices: DiDevice[] = []
  const cb = k.register((lpddiArg: unknown) => {
    const lpddi = lpddiArg as Ptr
    try {
      const guidBytes = Buffer.from(k.decode(lpddi, 4, k.array("uint8", 16)) as number[])
      const dwDevType = k.decode(lpddi, 36, "uint32") as number
      const nameChars = k.decode(lpddi, 40, k.array("uint16", 260)) as number[]
      let instanceName = ""
      for (const c of nameChars) {
        if (c === 0) break
        instanceName += String.fromCharCode(c)
      }
      const typeName = DEVICE_TYPE_NAMES[dwDevType & 0xff] ?? "Joystick"
      devices.push({ guidBytes, guid: guidToString(k, guidBytes), typeName, instanceName })
    } catch (err) {
      log("enum callback error", (err as Error).message)
    }
    return DIENUM_CONTINUE
  }, ProtoEnumCbPtr)

  const rc = k.call(
    vtblMethod(k, pDI, IDI_EnumDevices),
    ProtoEnum,
    pDI,
    DI8DEVCLASS_GAMECTRL,
    cb,
    null,
    DIEDFL_ATTACHEDONLY,
  ) as number
  k.unregister(cb)
  log(
    "EnumDevices rc",
    rc,
    "found",
    devices.length,
    devices.map((d) => `${d.typeName}:${d.instanceName}:${d.guid}`),
  )
  return devices
}

function acquireDevice(k: Koffi, pDI: Ptr, device: DiDevice, hwnd: Ptr): AcquiredDevice | null {
  const outBuf = Buffer.alloc(8)
  let rc = k.call(
    vtblMethod(k, pDI, IDI_CreateDevice),
    ProtoCreate,
    pDI,
    device.guidBytes,
    outBuf,
    null,
  ) as number
  if (rc !== 0) {
    log("CreateDevice failed", device.instanceName, rc)
    return null
  }
  const pDevice = readPtr(k, outBuf, 0)

  const fmt = buildDataFormat(k)
  rc = callVoid(k, pDevice, IDID_SetDataFormat, fmt)
  if (rc !== 0) log("SetDataFormat rc", rc, device.instanceName)
  rc = k.call(
    vtblMethod(k, pDevice, IDID_SetCooperativeLevel),
    ProtoCoop,
    pDevice,
    hwnd,
    DISCL_BACKGROUND | DISCL_NONEXCLUSIVE,
  ) as number
  if (rc !== 0) log("SetCooperativeLevel rc", rc, device.instanceName)
  callVoid(k, pDevice, IDID_Acquire)

  return {
    device,
    ptr: pDevice,
    rest: null,
    warmup: 0,
    axisActive: new Array(OFS_AXES.length).fill(false),
    povActive: new Array(OFS_POV.length).fill(false),
    buttonActive: new Array(BUTTON_COUNT).fill(false),
  }
}

function readState(k: Koffi, pDevice: Ptr, buf: Buffer): boolean {
  callVoid(k, pDevice, IDID_Poll)
  const rc = k.call(
    vtblMethod(k, pDevice, IDID_GetDeviceState),
    ProtoGetState,
    pDevice,
    STATE_SIZE,
    buf,
  ) as number
  if (rc !== 0) {
    // Likely input lost — try to re-acquire for the next tick.
    callVoid(k, pDevice, IDID_Acquire)
    return false
  }
  return true
}

function emit(binding: CapturedBinding): void {
  if (sender && !sender.isDestroyed()) sender.send(IpcChannels.captureEvent, binding)
}

function makeButton(guid: string, patch: Partial<DirectInputButtonData>): DirectInputButtonData {
  return {
    button: 0,
    isAxis: false,
    isAxisMinus: false,
    isFullAxis: false,
    povDirection: 0,
    isReverseAxis: false,
    joystickGuid: guid,
    ...patch,
  }
}

/**
 * Diffs a fresh state against the device's resting baseline and emits the first
 * input that just *became* active (rising edge). Edge tracking + hysteresis
 * mean a held button, a held direction, or a slightly noisy axis won't re-fire
 * every poll — so an idle axis can never mask a deliberate button press.
 */
function diffAndEmit(dev: AcquiredDevice, state: Buffer): void {
  const { guid, typeName } = dev.device
  const rest = dev.rest as Buffer
  let pending: CapturedBinding | null = null

  for (let i = 0; i < OFS_AXES.length; i++) {
    const ofs = OFS_AXES[i]
    const delta = state.readInt32LE(ofs) - rest.readInt32LE(ofs)
    const mag = Math.abs(delta)
    const was = dev.axisActive[i]
    const active = was ? mag > AXIS_OFF : mag > AXIS_ON
    if (active && !was && !pending) {
      pending = {
        api: "DirectInput",
        label: `${typeName} ${AXIS_NAMES[i]} ${delta < 0 ? "-" : "+"}`,
        directInputButton: makeButton(guid, { button: ofs, isAxis: true, isAxisMinus: delta < 0 }),
      }
    }
    dev.axisActive[i] = active
  }

  for (let i = 0; i < OFS_POV.length; i++) {
    const now = state.readUInt32LE(OFS_POV[i])
    // Centered POV reads as 0xFFFF / 0xFFFFFFFF.
    const active = (now & 0xffff) !== 0xffff
    if (active && !dev.povActive[i] && !pending) {
      // Snap the angle (centidegrees) to the nearest cardinal so diagonals
      // like 31500 resolve to a single direction.
      const idx = Math.round(now / 9000) % 4 // 0=Up 1=Right 2=Down 3=Left
      pending = {
        api: "DirectInput",
        label: `${typeName} PointOfViewControllers${i} ${["Up", "Right", "Down", "Left"][idx]}`,
        directInputButton: makeButton(guid, { button: OFS_POV[i], povDirection: idx * 9000 }),
      }
    }
    dev.povActive[i] = active
  }

  for (let i = 0; i < BUTTON_COUNT; i++) {
    const active = (state.readUInt8(OFS_BUTTONS + i) & 0x80) !== 0
    if (active && !dev.buttonActive[i] && !pending) {
      pending = {
        api: "DirectInput",
        label: `${typeName} Buttons${i}`,
        directInputButton: makeButton(guid, { button: OFS_BUTTONS + i }),
      }
    }
    dev.buttonActive[i] = active
  }

  if (pending) emit(pending)
}

function poll(): void {
  if (polling || !koffi) return
  polling = true
  try {
    const buf = Buffer.alloc(STATE_SIZE)
    for (const dev of acquired) {
      buf.fill(0)
      if (!readState(koffi, dev.ptr, buf)) continue
      // Settle the resting baseline before detecting input; keep the latest
      // reading as rest until warmed up.
      if (dev.warmup < WARMUP_POLLS) {
        dev.rest = Buffer.from(buf)
        dev.warmup++
        continue
      }
      diffAndEmit(dev, buf)
    }
  } finally {
    polling = false
  }
}

/** Starts polling DirectInput controllers. Returns false when unavailable. */
export async function startDirectInputCapture(webContents: WebContents): Promise<boolean> {
  const k = await loadKoffi()
  if (!k) return false
  stopDirectInputCapture()
  try {
    ensureTypes(k)

    const kernel32 = k.load("kernel32.dll")
    const GetModuleHandleW = kernel32.func("void* __stdcall GetModuleHandleW(void *name)")
    const hinst = GetModuleHandleW(null) as Ptr

    const dinput8 = k.load("dinput8.dll")
    const DirectInput8Create = dinput8.func(
      "int __stdcall DirectInput8Create(void *hinst, uint version, void *riid, void **out, void *outer)",
    )
    const riid = Buffer.from(IID_IDIRECTINPUT8W)
    const outBuf = Buffer.alloc(8)
    const rc = DirectInput8Create(hinst, DIRECTINPUT_VERSION, riid, outBuf, null) as number
    if (rc !== 0) {
      log("DirectInput8Create failed", rc)
      return false
    }
    dinput = readPtr(k, outBuf, 0)

    const hwnd = getMainHwnd(k)
    const devices = enumerateDevices(k, dinput)
    acquired = devices
      .map((d) => acquireDevice(k, dinput, d, hwnd))
      .filter((d): d is AcquiredDevice => d !== null)

    if (acquired.length === 0) log("no DirectInput controllers acquired")
    sender = webContents
    timer = setInterval(poll, 25)
    return true
  } catch (err) {
    console.warn("[directInput] capture failed:", (err as Error).message)
    stopDirectInputCapture()
    return false
  }
}

export function stopDirectInputCapture(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (koffi) {
    for (const dev of acquired) {
      try {
        callVoid(koffi, dev.ptr, IDID_Unacquire)
        callVoid(koffi, dev.ptr, IDID_Release)
      } catch {
        /* ignore cleanup errors */
      }
    }
    if (dinput !== null) {
      try {
        callVoid(koffi, dinput, IDI_Release)
      } catch {
        /* ignore */
      }
    }
  }
  acquired = []
  dinput = null
  sender = null
}
