import { Fragment, useMemo, useState } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import CircularProgress from "@mui/material/CircularProgress"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import Paper from "@mui/material/Paper"
import Popover from "@mui/material/Popover"
import Stack from "@mui/material/Stack"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore"
import UndoIcon from "@mui/icons-material/Undo"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import type { BulkSettingsUpdate, GameConfig } from "@shared/teknoparrot"
import {
  buildSettingGroups,
  byCategory,
  canResetToDefault,
  sharedDefault,
  sharedValue,
  type SettingGroup,
} from "../../util/settingGroups"
import BulkFieldControl from "./BulkFieldControl"

interface GamesPopover {
  anchor: HTMLElement
  group: SettingGroup
}

/** Per-setting pending change: either an explicit value or a reset-to-default. */
interface SettingEdit {
  value?: string
  reset?: boolean
}

interface BulkSettingsEditorProps {
  /** Loaded configs for the currently checked games. */
  configs: GameConfig[]
  /** Number of games checked (may exceed configs.length while loading). */
  checkedCount: number
  /** True while one or more checked games' configs are still loading. */
  loadingConfigs: boolean
  /** Applies the pending edits, keyed by `Category::FieldName`. */
  onApply: (payload: Omit<BulkSettingsUpdate, "profileNames">) => Promise<void>
}

/**
 * The bulk settings table: one row per distinct setting across the selected
 * games, with a badge counting how many of them expose it. A change is written
 * only to the games that actually define that setting.
 */
export default function BulkSettingsEditor({
  configs,
  checkedCount,
  loadingConfigs,
  onApply,
}: BulkSettingsEditorProps): JSX.Element {
  const [edits, setEdits] = useState<Record<string, SettingEdit>>({})
  const [applying, setApplying] = useState(false)
  const [gamesPopover, setGamesPopover] = useState<GamesPopover | null>(null)

  const groups = useMemo(() => buildSettingGroups(configs), [configs])
  const categories = useMemo(() => byCategory(groups), [groups])
  const dirtyCount = Object.keys(edits).length

  /** Every setting a reset would actually change. */
  const resettable = useMemo(() => groups.filter(canResetToDefault), [groups])

  const setValue = (group: SettingGroup, value: string): void => {
    setEdits((prev) => {
      const next = { ...prev }
      // Re-selecting the value every game already has isn't a change; with
      // mixed values there is nothing to fall back to, so it stays an edit.
      if (value === sharedValue(group)) delete next[group.id]
      else next[group.id] = { value }
      return next
    })
  }

  const revert = (group: SettingGroup): void => {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[group.id]
      return next
    })
  }

  const resetToDefault = (group: SettingGroup): void => {
    setEdits((prev) => ({ ...prev, [group.id]: { reset: true } }))
  }

  const resetAllToDefault = (): void => {
    setEdits((prev) => {
      const next = { ...prev }
      for (const group of resettable) next[group.id] = { reset: true }
      return next
    })
  }

  const handleApply = async (): Promise<void> => {
    setApplying(true)
    try {
      const fieldValues: Record<string, string> = {}
      const resetKeys: string[] = []
      for (const [id, edit] of Object.entries(edits)) {
        if (edit.reset) resetKeys.push(id)
        else if (edit.value !== undefined) fieldValues[id] = edit.value
      }
      await onApply({ fieldValues, resetKeys })
      setEdits({})
    } finally {
      setApplying(false)
    }
  }

  if (checkedCount === 0) {
    return (
      <Box sx={{ height: "100%", display: "grid", placeItems: "center", color: "text.secondary" }}>
        <Typography>Select one or more games to edit their settings.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ flexGrow: 1, minWidth: 0, p: 2 }}>
        <Typography variant="h6">Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          {groups.length} setting{groups.length === 1 ? "" : "s"} across {checkedCount} selected
          game{checkedCount === 1 ? "" : "s"}. Each change applies only to games that have that
          setting.
        </Typography>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ px: 2, pb: 2, flexWrap: "wrap" }}
      >
        <Button
          variant="outlined"
          color="error"
          disabled={resettable.length === 0 || applying}
          onClick={resetAllToDefault}
        >
          Reset all to default
        </Button>
        <Button
          variant="outlined"
          disabled={dirtyCount === 0 || applying}
          onClick={() => setEdits({})}
        >
          Discard changes
        </Button>
        <Button
          variant="contained"
          disabled={dirtyCount === 0 || applying}
          onClick={() => void handleApply()}
        >
          {applying ? "Applying…" : `Apply changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
        </Button>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: "auto", px: 2, pb: 2 }}>
        {loadingConfigs && (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        )}

        {!loadingConfigs && groups.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            The selected games expose no configurable settings.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Setting</TableCell>
                  <TableCell sx={{ width: "55%" }}>Value</TableCell>
                  <TableCell align="right">Games</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map(([category, settings]) => (
                  <Fragment key={category}>
                    <TableRow>
                      <TableCell colSpan={3} sx={{ bgcolor: "action.hover", py: 0.75 }}>
                        <Typography variant="subtitle2">{category}</Typography>
                      </TableCell>
                    </TableRow>
                    {settings.map((group) => {
                      const edit = edits[group.id]
                      const edited = Boolean(edit)
                      // A pending reset previews the default; when the games'
                      // templates disagree there's no single value to show.
                      const groupDefault = sharedDefault(group)
                      const value = edit?.reset
                        ? (groupDefault ?? null)
                        : (edit?.value ?? sharedValue(group))
                      const canReset = canResetToDefault(group)
                      return (
                        <TableRow key={group.id} hover selected={edited}>
                          <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography
                                variant="body2"
                                color={edited ? "primary" : "text.primary"}
                              >
                                {group.name}
                              </Typography>
                              {group.hint && (
                                <Tooltip title={group.hint}>
                                  <HelpOutlineIcon
                                    fontSize="small"
                                    color="disabled"
                                    sx={{ cursor: "help" }}
                                  />
                                </Tooltip>
                              )}
                              {group.mixedDefinition && (
                                <Tooltip title="These games describe this setting differently (type, options or range). The merged editor writes the same raw value to all of them.">
                                  <WarningAmberIcon
                                    fontSize="small"
                                    color="warning"
                                    sx={{ cursor: "help" }}
                                  />
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <BulkFieldControl
                                  group={group}
                                  value={value}
                                  onChange={(v) => setValue(group, v)}
                                />
                              </Box>
                              <Tooltip
                                title={
                                  groupDefault === undefined
                                    ? "No default in these games' profiles"
                                    : canReset
                                      ? "Reset to default"
                                      : "Already at its default"
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={edit?.reset || !canReset}
                                    onClick={() => resetToDefault(group)}
                                  >
                                    <SettingsBackupRestoreIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Discard this pending change">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={!edited}
                                    onClick={() => revert(group)}
                                  >
                                    <UndoIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                          <TableCell align="right" sx={{ verticalAlign: "top", pt: 2 }}>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={group.games.length}
                              onClick={(e) => setGamesPopover({ anchor: e.currentTarget, group })}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Popover
        open={Boolean(gamesPopover)}
        anchorEl={gamesPopover?.anchor ?? null}
        onClose={() => setGamesPopover(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {gamesPopover && (
          <Box sx={{ p: 1.5, maxWidth: 360 }}>
            <Typography variant="subtitle2">{gamesPopover.group.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {gamesPopover.group.category} · {gamesPopover.group.games.length} game
              {gamesPopover.group.games.length === 1 ? "" : "s"}
            </Typography>
            <List dense sx={{ pt: 0.5, maxHeight: 320, overflow: "auto" }}>
              {gamesPopover.group.games.map((game) => (
                <ListItem key={game.profileName} disableGutters sx={{ py: 0 }}>
                  <ListItemText
                    primary={game.name}
                    secondary={
                      (game.value === "" ? "(empty)" : game.value) +
                      // Only worth showing where it differs from the current value.
                      (game.defaultValue !== undefined && game.defaultValue !== game.value
                        ? ` · default: ${game.defaultValue === "" ? "(empty)" : game.defaultValue}`
                        : "")
                    }
                    slotProps={{
                      primary: { variant: "body2", noWrap: true },
                      secondary: { variant: "caption", noWrap: true },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Popover>
    </Box>
  )
}
