import { useCallback, useEffect, useState } from "react"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset"
import type { BulkControlUpdate, GameConfig, GameSummary } from "@shared/teknoparrot"
import { useNotify } from "../hooks/useNotify"
import { iconUrl } from "../util/icon"
import InfoTab from "./game/InfoTab"
import SettingsTab from "./game/SettingsTab"
import ControlsTab from "./game/ControlsTab"

interface GameDetailProps {
  game: GameSummary
}

type TabKey = "info" | "settings" | "controls"

export default function GameDetail({ game }: GameDetailProps): JSX.Element {
  const notify = useNotify()
  const [tab, setTab] = useState<TabKey>("info")
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Keep the selected tab when switching games; Settings/Controls are
    // disabled for uninstalled games, so those fall back to Info.
    if (!game.installed) setTab("info")
    setConfig(null)
    setError(null)
    if (!game.installed) return

    let active = true
    setLoading(true)
    window.api
      .getGameConfig(game.profileName)
      .then((cfg) => active && setConfig(cfg))
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [game.profileName, game.installed])

  const reloadConfig = useCallback(async (): Promise<void> => {
    setConfig(await window.api.getGameConfig(game.profileName))
  }, [game.profileName])

  const handleSaveFields = async (fieldValues: Record<string, string>): Promise<void> => {
    try {
      const saved = await window.api.saveGameConfig({ profileName: game.profileName, fieldValues })
      setConfig(saved)
      notify("Settings saved.", "success")
    } catch (e) {
      notify((e as Error).message, "error")
    }
  }

  const handleApplyControls = async (
    payload: Omit<BulkControlUpdate, "profileNames">,
  ): Promise<void> => {
    try {
      const [result] = await window.api.saveControlBindings({
        profileNames: [game.profileName],
        updates: payload.updates,
      })
      const changed = result?.updated ?? 0
      notify(`Updated ${changed} binding${changed === 1 ? "" : "s"}.`, "success")
      // Refresh so the editor shows the saved values rather than pending edits.
      await reloadConfig()
    } catch (e) {
      notify((e as Error).message, "error")
    }
  }

  const handleLaunch = async (): Promise<void> => {
    const result = await window.api.launchGame(game.profileName)
    notify(
      result.ok ? `Launching ${game.name}…` : (result.message ?? "Launch failed."),
      result.ok ? "success" : "error",
    )
  }

  const showControlsEditor =
    tab === "controls" && game.installed && !loading && !error && config !== null

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            variant="rounded"
            src={iconUrl(game.iconFile)}
            sx={{ width: 56, height: 56, bgcolor: "action.hover" }}
          >
            <VideogameAssetIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {game.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {[game.metadata?.platform, game.emulator].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleLaunch}
            disabled={!game.installed}
          >
            Launch
          </Button>
        </Stack>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v: TabKey) => setTab(v)}
        sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Info" value="info" />
        <Tab label="Settings" value="settings" disabled={!game.installed} />
        <Tab label="Controls" value="controls" disabled={!game.installed} />
      </Tabs>

      {/* The controls editor manages its own padding and scrolling so its Apply
          button stays pinned above the table. */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          ...(showControlsEditor ? { overflow: "hidden" } : { overflow: "auto", p: 3 }),
        }}
      >
        {tab === "info" && <InfoTab game={game} />}

        {tab !== "info" && !game.installed && (
          <Alert severity="info">Install this game in TeknoParrot to configure it.</Alert>
        )}

        {tab !== "info" && game.installed && loading && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        )}

        {tab !== "info" && error && <Alert severity="error">{error}</Alert>}

        {/* Keyed by game so a switch discards the previous game's unsaved
            drafts instead of carrying them into the new one. */}
        {tab === "settings" && config && (
          <SettingsTab key={game.profileName} config={config} onSave={handleSaveFields} />
        )}
        {showControlsEditor && config && (
          <ControlsTab key={game.profileName} config={config} onApply={handleApplyControls} />
        )}
      </Box>
    </Box>
  )
}
