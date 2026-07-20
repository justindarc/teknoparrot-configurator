import { useState } from "react"
import AppBar from "@mui/material/AppBar"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import SettingsIcon from "@mui/icons-material/Settings"
import DisplaySettingsIcon from "@mui/icons-material/DisplaySettings"
import TuneIcon from "@mui/icons-material/Tune"
import RefreshIcon from "@mui/icons-material/Refresh"
import SportsEsportsIcon from "@mui/icons-material/SportsEsports"
import HomeIcon from "@mui/icons-material/Home"
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset"
import type { AppSettings } from "@shared/types"
import { useGames } from "../hooks/useGames"
import HomeView from "./HomeView"
import SettingsView from "./SettingsView"
import ControlsView from "./ControlsView"
import AppSettingsDialog from "./AppSettingsDialog"
import GlobalSettingsDialog from "./GlobalSettingsDialog"

const RAIL_WIDTH = 72
const DRAWER_WIDTH = 320

type View = "home" | "settings" | "controls"

const NAV_ITEMS: { view: View; label: string; icon: JSX.Element }[] = [
  { view: "home", label: "Home", icon: <HomeIcon /> },
  { view: "settings", label: "Settings", icon: <DisplaySettingsIcon /> },
  { view: "controls", label: "Controls", icon: <VideogameAssetIcon /> },
]

interface AppLayoutProps {
  settings: AppSettings
  onSaveSettings: (settings: AppSettings) => Promise<void>
}

export default function AppLayout({ settings, onSaveSettings }: AppLayoutProps): JSX.Element {
  const { games, loading, error, reload } = useGames(true)
  const [view, setView] = useState<View>("home")
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <SportsEsportsIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            TeknoParrot Configurator
          </Typography>
          <Tooltip title="Reload games">
            <IconButton color="inherit" onClick={() => void reload()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="TeknoParrot settings">
            <IconButton color="inherit" onClick={() => setGlobalSettingsOpen(true)}>
              <TuneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Application settings">
            <IconButton color="inherit" onClick={() => setAppSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Mini-variant navigation rail. */}
      <Drawer
        variant="permanent"
        sx={{
          width: RAIL_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: RAIL_WIDTH,
            boxSizing: "border-box",
            position: "relative",
          },
        }}
      >
        <Toolbar variant="dense" />
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.view}
              selected={view === item.view}
              onClick={() => setView(item.view)}
              sx={{ flexDirection: "column", gap: 0.5, py: 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: "center" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { variant: "caption", noWrap: true } }}
                sx={{ flexGrow: 0, m: 0, textAlign: "center" }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {view === "home" && (
        <HomeView
          games={games}
          loading={loading}
          error={error}
          drawerWidth={DRAWER_WIDTH}
          onFixPath={() => setAppSettingsOpen(true)}
        />
      )}
      {view === "settings" && (
        <SettingsView
          games={games}
          loading={loading}
          error={error}
          drawerWidth={DRAWER_WIDTH}
          onFixPath={() => setAppSettingsOpen(true)}
        />
      )}
      {view === "controls" && (
        <ControlsView
          games={games}
          loading={loading}
          error={error}
          drawerWidth={DRAWER_WIDTH}
          onFixPath={() => setAppSettingsOpen(true)}
        />
      )}

      <AppSettingsDialog
        open={appSettingsOpen}
        settings={settings}
        onClose={() => setAppSettingsOpen(false)}
        onSave={async (next) => {
          await onSaveSettings(next)
          await reload()
        }}
      />
      <GlobalSettingsDialog
        open={globalSettingsOpen}
        onClose={() => setGlobalSettingsOpen(false)}
      />
    </Box>
  )
}
