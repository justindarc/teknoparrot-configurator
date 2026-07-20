import { useCallback, useEffect, useMemo, useState } from "react"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Drawer from "@mui/material/Drawer"
import Toolbar from "@mui/material/Toolbar"
import type { BulkControlUpdate, GameConfig, GameSummary } from "@shared/teknoparrot"
import type { ControlScheme } from "@shared/controlScheme"
import { useNotify } from "../hooks/useNotify"
import { computeFacets, emptyFilters, type ControlFilters } from "../util/controlFilters"
import ControlFilterSelector from "./controls/ControlFilterSelector"
import BulkControlsEditor from "./controls/BulkControlsEditor"

interface ControlsViewProps {
  games: GameSummary[]
  loading: boolean
  error: string | null
  drawerWidth: number
  onFixPath: () => void
}

export default function ControlsView({
  games,
  loading,
  error,
  drawerWidth,
  onFixPath,
}: ControlsViewProps): JSX.Element {
  const notify = useNotify()
  const [filters, setFilters] = useState<ControlFilters>(emptyFilters)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [cache, setCache] = useState<Map<string, GameConfig>>(new Map())

  const installed = useMemo(() => games.filter((g) => g.installed), [games])
  const facets = useMemo(() => computeFacets(installed, filters), [installed, filters])

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

  // Selection is scoped to the visible list, so any filter change clears it.
  // Sub-filters cascade, so changing one resets the ones below it to "any".
  const handleSchemeChange = (scheme: ControlScheme | ""): void => {
    setFilters({ scheme, genre: "", players: "any", buttons: "any" })
    setChecked(new Set())
  }
  const handleGenreChange = (genre: string): void => {
    setFilters((prev) => ({ ...prev, genre, players: "any", buttons: "any" }))
    setChecked(new Set())
  }
  const handlePlayersChange = (players: number | "any"): void => {
    setFilters((prev) => ({ ...prev, players, buttons: "any" }))
    setChecked(new Set())
  }
  const handleButtonsChange = (buttons: number | "any"): void => {
    setFilters((prev) => ({ ...prev, buttons }))
    setChecked(new Set())
  }

  const handleToggle = (profileName: string): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(profileName)) next.delete(profileName)
      else next.add(profileName)
      return next
    })
  }

  const handleSetAll = (all: boolean): void => {
    setChecked(() => (all ? new Set(facets.visibleGames.map((g) => g.profileName)) : new Set()))
  }

  const checkedList = useMemo(() => [...checked], [checked])
  const checkedConfigs = useMemo(
    () => checkedList.map((p) => cache.get(p)).filter((c): c is GameConfig => Boolean(c)),
    [checkedList, cache],
  )
  const loadingConfigs = checkedList.some((p) => !cache.has(p))

  const handleApply = async (payload: Omit<BulkControlUpdate, "profileNames">): Promise<void> => {
    try {
      const results = await window.api.saveControlBindings({
        profileNames: checkedList,
        updates: payload.updates,
      })
      const changed = results.reduce((sum, r) => sum + r.updated, 0)
      notify(`Updated ${changed} binding${changed === 1 ? "" : "s"}.`, "success")
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
          <ControlFilterSelector
            filters={filters}
            facets={facets}
            onSchemeChange={handleSchemeChange}
            onGenreChange={handleGenreChange}
            onPlayersChange={handlePlayersChange}
            onButtonsChange={handleButtonsChange}
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
            <BulkControlsEditor
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
