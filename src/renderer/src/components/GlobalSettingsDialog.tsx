import { useEffect, useState } from "react"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import FormControlLabel from "@mui/material/FormControlLabel"
import Switch from "@mui/material/Switch"
import Divider from "@mui/material/Divider"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import type { GlobalSettings } from "@shared/teknoparrot"
import { useNotify } from "../hooks/useNotify"

interface GlobalSettingsDialogProps {
  open: boolean
  onClose: () => void
}

const TOGGLES: { key: keyof GlobalSettings; label: string }[] = [
  { key: "silentMode", label: "Silent mode (suppress console output)" },
  { key: "saveLastPlayed", label: "Remember last played game" },
  { key: "useDiscordRPC", label: "Discord Rich Presence" },
  { key: "checkForUpdates", label: "Check for updates on launch" },
  { key: "confirmExit", label: "Confirm before exiting a game" },
  { key: "confirmGameDeletion", label: "Confirm before deleting a game" },
  { key: "downloadIcons", label: "Download missing game icons" },
]

export default function GlobalSettingsDialog({
  open,
  onClose,
}: GlobalSettingsDialogProps): JSX.Element {
  const notify = useNotify()
  const [draft, setDraft] = useState<GlobalSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(null)
    window.api
      .getGlobalSettings()
      .then(setDraft)
      .catch((e) => notify((e as Error).message, "error"))
  }, [open, notify])

  const update = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]): void =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSave = async (): Promise<void> => {
    if (!draft) return
    setSaving(true)
    try {
      await window.api.saveGlobalSettings(draft)
      notify("TeknoParrot settings saved.", "success")
      onClose()
    } catch (e) {
      notify((e as Error).message, "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>TeknoParrot settings</DialogTitle>
      <DialogContent>
        {!draft ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {TOGGLES.map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={draft[key] as boolean}
                    onChange={(e) => update(key, e.target.checked as never)}
                  />
                }
                label={label}
              />
            ))}

            <Divider />
            <Typography variant="subtitle2">Hotkeys &amp; general</Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Exit game key"
                value={draft.exitGameKey}
                onChange={(e) => update("exitGameKey", e.target.value)}
                fullWidth
                size="small"
                helperText="Virtual-key code, e.g. 0x1B (Esc)"
              />
              <TextField
                label="Pause game key"
                value={draft.pauseGameKey}
                onChange={(e) => update("pauseGameKey", e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <TextField
              label="Language"
              value={draft.language}
              onChange={(e) => update("language", e.target.value)}
              size="small"
              sx={{ maxWidth: 160 }}
            />

            <Divider />
            <Typography variant="subtitle2">Driving games</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.useSto0ZDrivingHack}
                  onChange={(e) => update("useSto0ZDrivingHack", e.target.checked)}
                />
              }
              label="Enable STOOZ driving hack"
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.fullAxisGas}
                    onChange={(e) => update("fullAxisGas", e.target.checked)}
                  />
                }
                label="Full axis gas"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.fullAxisBrake}
                    onChange={(e) => update("fullAxisBrake", e.target.checked)}
                  />
                }
                label="Full axis brake"
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!draft || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
