import { useCallback, useEffect, useMemo, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Drawer from "@mui/material/Drawer"
import Toolbar from "@mui/material/Toolbar"
import type { BulkSettingsUpdate, GameConfig, GameSummary } from "@shared/teknoparrot"
import { useNotify } from "../hooks/useNotify"
import GameMultiSelect from "./settings/GameMultiSelect"
import BulkSettingsEditor from "./settings/BulkSettingsEditor"

interface SettingsViewProps {
  games: GameSummary[]
  loading: boolean
  error: string | null
  drawerWidth: number
  onFixPath: () => void
}

/**
 * Bulk settings screen: pick any set of installed games on the left, edit the
 * union of their ConfigValues on the right. Mirrors the controls screen, which
 * does the same for input bindings.
 */
export default function SettingsView({
  games,
  loading,
  error,
  drawerWidth,
  onFixPath,
}: SettingsViewProps): JSX.Element {
  const notify = useNotify()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [cache, setCache] = useState<Map<string, GameConfig>>(new Map())

  const installed = useMemo(() => games.filter((g) => g.installed), [games])

  // Fetch the config for a game and store it; overwrites any cached copy.
  const fetchConfig = useCallback(async (profileName: string): Promise<void> => {
    try {
      const cfg = await window.api.getGameConfig(profileName)
      setCache((prev) => new Map(prev).set(profileName, cfg))
    } catch {
      // Leave it absent; the editor simply omits games it couldn't load.
    }
  }, [])

  // Load configs for any checked game we don't have yet.
  useEffect(() => {
    for (const profileName of checked) {
      if (!cache.has(profileName)) void fetchConfig(profileName)
    }
  }, [checked, cache, fetchConfig])

  const handleToggle = (profileName: string): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(profileName)) next.delete(profileName)
      else next.add(profileName)
      return next
    })
  }

  const handleSetAll = (profileNames: string[], check: boolean): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      for (const profileName of profileNames) {
        if (check) next.add(profileName)
        else next.delete(profileName)
      }
      return next
    })
  }

  const checkedList = useMemo(() => [...checked], [checked])
  const checkedConfigs = useMemo(
    () => checkedList.map((p) => cache.get(p)).filter((c): c is GameConfig => Boolean(c)),
    [checkedList, cache],
  )
  const loadingConfigs = checkedList.some((p) => !cache.has(p))

  const handleApply = async (payload: Omit<BulkSettingsUpdate, "profileNames">): Promise<void> => {
    try {
      const results = await window.api.saveGameSettings({
        profileNames: checkedList,
        ...payload,
      })
      const changed = results.reduce((sum, r) => sum + r.updated, 0)
      const touched = results.filter((r) => r.updated > 0).length
      notify(
        `Updated ${changed} setting${changed === 1 ? "" : "s"} across ${touched} game${
          touched === 1 ? "" : "s"
        }.`,
        "success",
      )
      // Refresh cached configs so the editor reflects the saved values.
      await Promise.all(checkedList.map(fetchConfig))
    } catch (e) {
      notify((e as Error).message, "error")
    }
  }

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            position: "relative",
          },
        }}
      >
        <Toolbar variant="dense" />
        <Box sx={{ height: "calc(100% - 48px)" }}>
          <GameMultiSelect
            games={installed}
            checked={checked}
            onToggle={handleToggle}
            onSetAll={handleSetAll}
          />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, overflow: "hidden" }}>
        <Toolbar variant="dense" />
        <Box sx={{ height: "calc(100% - 48px)" }}>
          {error ? (
            <Box sx={{ p: 3 }}>
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={onFixPath}>
                    Fix path
                  </Button>
                }
              >
                Couldn&apos;t read the TeknoParrot installation: {error}
              </Alert>
            </Box>
          ) : (
            <BulkSettingsEditor
              configs={checkedConfigs}
              checkedCount={checkedList.length}
              loadingConfigs={!loading && loadingConfigs}
              onApply={handleApply}
            />
          )}
        </Box>
      </Box>
    </>
  )
}
