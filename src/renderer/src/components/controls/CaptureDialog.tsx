import { useEffect, useMemo, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import MenuItem from "@mui/material/MenuItem"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import type { CapturedBinding, InputApi, RawInputDeviceInfo } from "@shared/teknoparrot"
import { capturedFromKey, capturedFromMouse } from "../../util/keyMap"

interface CaptureDialogProps {
  api: InputApi
  /** Display name of the control being bound. */
  controlName: string
  onCapture: (binding: CapturedBinding) => void
  onClose: () => void
}

const API_LABEL: Record<InputApi, string> = {
  DirectInput: "DirectInput",
  XInput: "XInput",
  RawInput: "RawInput",
}

const PROMPT: Record<InputApi, string> = {
  DirectInput: "Press a key, or move/press a control on your joystick…",
  XInput: "Press a button or move a stick on your controller…",
  RawInput: "Press a key or a mouse button…",
}

export default function CaptureDialog({
  api,
  controlName,
  onCapture,
  onClose,
}: CaptureDialogProps): JSX.Element {
  const [captured, setCaptured] = useState<CapturedBinding | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [devices, setDevices] = useState<RawInputDeviceInfo[]>([])
  const [devicePath, setDevicePath] = useState<string>("")

  const selectedDevice = useMemo(
    () => devices.find((d) => d.path === devicePath),
    [devices, devicePath],
  )

  // Native polling paths (main process): XInput controllers, and DirectInput
  // joysticks/wheels. DirectInput keyboards still use the DOM path below.
  useEffect(() => {
    if (api === "RawInput") return
    let cancelled = false
    const unsubscribe = window.api.onCaptureEvent((binding) => {
      if (binding.api === api) setCaptured(binding)
    })
    const start =
      api === "XInput" ? window.api.startXInputCapture : window.api.startDirectInputCapture
    void start().then((ok) => {
      // XInput is all-or-nothing; DirectInput can still capture the keyboard via
      // the DOM even when no joystick backend is available, so don't block it.
      if (!cancelled && !ok && api === "XInput") setUnavailable(true)
    })
    return () => {
      cancelled = true
      unsubscribe()
      void (api === "XInput" ? window.api.stopXInputCapture() : window.api.stopDirectInputCapture())
    }
  }, [api])

  // RawInput: enumerate keyboards/mice to pick the exact device to bind.
  useEffect(() => {
    if (api !== "RawInput") return
    let cancelled = false
    void window.api.listRawInputDevices().then((list) => {
      if (cancelled) return
      setDevices(list)
      if (list.length > 0) setDevicePath(list[0].path)
    })
    return () => {
      cancelled = true
    }
  }, [api])

  // DirectInput / RawInput: capture keyboard (and mouse buttons for RawInput)
  // via DOM events while the dialog is open.
  useEffect(() => {
    if (api === "XInput") return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const binding = capturedFromKey(
        e.code,
        api === "RawInput" ? "RawInput" : "DirectInput",
        selectedDevice,
      )
      if (binding) setCaptured(binding)
    }
    const onMouseDown = (e: MouseEvent): void => {
      const binding = capturedFromMouse(e.button, selectedDevice)
      if (binding) {
        e.preventDefault()
        setCaptured(binding)
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    if (api === "RawInput") window.addEventListener("mousedown", onMouseDown, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("mousedown", onMouseDown, true)
    }
  }, [api, selectedDevice])

  const handleUse = (): void => {
    if (captured) onCapture(captured)
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Capture {API_LABEL[api]} input
        <Typography variant="body2" color="text.secondary">
          {controlName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {unavailable ? (
          <Alert severity="warning">
            XInput isn&apos;t available on this system (it requires Windows with the native module
            installed). Try DirectInput or RawInput instead.
          </Alert>
        ) : (
          <Box sx={{ py: 2 }}>
            {api === "RawInput" && (
              <TextField
                select
                fullWidth
                size="small"
                label="Device"
                value={devicePath}
                onChange={(e) => setDevicePath(e.target.value)}
                helperText={
                  devices.length === 0
                    ? "No RawInput devices enumerated (this list is Windows-only)."
                    : "Pick the device, then press its key or button."
                }
                sx={{ mb: 2 }}
              >
                {devices.map((d) => (
                  <MenuItem key={d.path} value={d.path}>
                    {d.name} ({d.type})
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Box sx={{ textAlign: "center" }}>
              <Typography color="text.secondary" gutterBottom>
                {PROMPT[api]}
              </Typography>
              <Typography variant="h6" sx={{ minHeight: 32, mt: 1 }}>
                {captured?.label ?? "…"}
              </Typography>
              {api === "DirectInput" && (
                <Typography variant="caption" color="text.secondary">
                  Keyboard and joystick captures are recorded exactly.
                </Typography>
              )}
              {api === "RawInput" && (
                <Typography variant="caption" color="text.secondary">
                  Device paths are read via HID; verify the binding in TeknoParrot if a device
                  doesn&apos;t match.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!captured} onClick={handleUse}>
          Use this input
        </Button>
      </DialogActions>
    </Dialog>
  )
}
