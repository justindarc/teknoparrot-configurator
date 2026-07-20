import { useMemo } from "react"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import CssBaseline from "@mui/material/CssBaseline"
import useMediaQuery from "@mui/material/useMediaQuery"
import { ThemeProvider } from "@mui/material/styles"
import { buildTheme } from "./theme"
import { useSettings } from "./hooks/useSettings"
import { NotificationProvider } from "./hooks/useNotify"
import AppLayout from "./components/AppLayout"
import SetupScreen from "./components/SetupScreen"

export default function App(): JSX.Element {
  const { settings, loading, saveSettings } = useSettings()
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)")

  const resolvedMode = useMemo<"light" | "dark">(() => {
    if (settings.themeMode === "system") return prefersDark ? "dark" : "light"
    return settings.themeMode
  }, [settings.themeMode, prefersDark])

  const theme = useMemo(() => buildTheme(resolvedMode), [resolvedMode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        {loading ? (
          <Box sx={{ height: "100vh", display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Box>
        ) : settings.teknoParrotPath ? (
          <AppLayout settings={settings} onSaveSettings={saveSettings} />
        ) : (
          <SetupScreen onConfirm={(path) => saveSettings({ ...settings, teknoParrotPath: path })} />
        )}
      </NotificationProvider>
    </ThemeProvider>
  )
}
