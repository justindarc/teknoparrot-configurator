import { useState } from "react"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import FolderOpenIcon from "@mui/icons-material/FolderOpen"
import SportsEsportsIcon from "@mui/icons-material/SportsEsports"
import type { InstallInfo } from "@shared/ipc"

interface SetupScreenProps {
  onConfirm: (path: string) => Promise<void>
}

export default function SetupScreen({ onConfirm }: SetupScreenProps): JSX.Element {
  const [path, setPath] = useState<string>("")
  const [info, setInfo] = useState<InstallInfo | null>(null)
  const [checking, setChecking] = useState(false)

  const handleBrowse = async (): Promise<void> => {
    const dir = await window.api.pickDirectory()
    if (!dir) return
    setPath(dir)
    setChecking(true)
    try {
      setInfo(await window.api.validateInstall(dir))
    } finally {
      setChecking(false)
    }
  }

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 520, width: "100%" }}>
        <Stack spacing={2.5} alignItems="flex-start">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SportsEsportsIcon color="primary" fontSize="large" />
            <Typography variant="h5">Welcome</Typography>
          </Stack>
          <Typography color="text.secondary">
            To get started, choose your TeknoParrot installation folder — the one containing{" "}
            <code>TeknoParrotUi.exe</code> and the <code>UserProfiles</code> directory.
          </Typography>

          <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={handleBrowse}>
            Choose folder…
          </Button>

          {path && (
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {path}
            </Typography>
          )}

          {checking && <Typography variant="body2">Checking…</Typography>}

          {info && !info.valid && (
            <Alert severity="error" sx={{ width: "100%" }}>
              This folder doesn&apos;t look like a TeknoParrot installation
              {info.hasParrotData ? "" : " (ParrotData.xml missing)"}.
            </Alert>
          )}

          {info?.valid && (
            <>
              <Alert severity="success" sx={{ width: "100%" }}>
                Found {info.gameProfileCount} game profiles and {info.userProfileCount} installed
                games.
              </Alert>
              <Button variant="contained" color="primary" onClick={() => onConfirm(path)}>
                Continue
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
