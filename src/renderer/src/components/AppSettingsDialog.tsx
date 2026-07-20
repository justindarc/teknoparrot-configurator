import { useEffect, useState } from "react"
import Button from "@mui/material/Button"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogTitle from "@mui/material/DialogTitle"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import InputAdornment from "@mui/material/InputAdornment"
import type { AppSettings } from "@shared/types"

interface AppSettingsDialogProps {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => Promise<void>
}

export default function AppSettingsDialog({
  open,
  settings,
  onClose,
  onSave,
}: AppSettingsDialogProps): JSX.Element {
  const [draft, setDraft] = useState<AppSettings>(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleBrowse = async (): Promise<void> => {
    const dir = await window.api.pickDirectory()
    if (dir) update("teknoParrotPath", dir)
  }

  const handleSave = async (): Promise<void> => {
    await onSave(draft)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Application settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="TeknoParrot folder"
            value={draft.teknoParrotPath}
            onChange={(e) => update("teknoParrotPath", e.target.value)}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" onClick={handleBrowse}>
                    Browse
                  </Button>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Theme"
            value={draft.themeMode}
            onChange={(e) => update("themeMode", e.target.value as AppSettings["themeMode"])}
            fullWidth
          >
            <MenuItem value="system">Match system</MenuItem>
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
