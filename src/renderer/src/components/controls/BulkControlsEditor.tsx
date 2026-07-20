import { useMemo, useState } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
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
import CircularProgress from "@mui/material/CircularProgress"
import SportsEsportsIcon from "@mui/icons-material/SportsEsports"
import ClearIcon from "@mui/icons-material/Clear"
import type { BulkControlUpdate, CapturedBinding, GameConfig, InputApi } from "@shared/teknoparrot"
import {
  apiValues,
  buildControlGroups,
  sharedOf,
  type ControlLabel,
} from "../../util/controlGroups"
import CaptureDialog from "./CaptureDialog"

interface LabelPopover {
  anchor: HTMLElement
  mapping: string
  label: ControlLabel
}

interface ActiveCapture {
  groupId: string
  controlName: string
  api: InputApi
}

/** Per-(control, API) pending change: either a structured capture or an unbind. */
interface ApiEdit {
  captured?: CapturedBinding
  cleared?: boolean
}

const CAPTURE_APIS: ReadonlyArray<{ api: InputApi; tag: string }> = [
  { api: "DirectInput", tag: "DI" },
  { api: "XInput", tag: "XI" },
  { api: "RawInput", tag: "RI" },
]

const editKey = (id: string, api: InputApi): string => `${id}::${api}`

/** A binding can be cleared when it is (or is about to be) bound in some game. */
const isClearable = (edit: ApiEdit | undefined, shared: string | null): boolean =>
  Boolean(edit?.captured) || (!edit?.cleared && shared !== "")

interface BulkControlsEditorProps {
  /** Loaded configs for the currently checked games. */
  configs: GameConfig[]
  /** Number of games checked (may exceed configs.length while loading). */
  checkedCount: number
  /** True while one or more checked games' configs are still loading. */
  loadingConfigs: boolean
  onApply: (payload: Omit<BulkControlUpdate, "profileNames">) => Promise<void>
  /**
   * Editing a single game inside the game detail screen: drops the redundant
   * heading, the per-game breakdown of each label, and the games-count column.
   */
  singleGame?: boolean
}

export default function BulkControlsEditor({
  configs,
  checkedCount,
  loadingConfigs,
  onApply,
  singleGame = false,
}: BulkControlsEditorProps): JSX.Element {
  const [edits, setEdits] = useState<Map<string, ApiEdit>>(new Map())
  const [applying, setApplying] = useState(false)
  const [labelPopover, setLabelPopover] = useState<LabelPopover | null>(null)
  const [activeCapture, setActiveCapture] = useState<ActiveCapture | null>(null)

  const groups = useMemo(() => buildControlGroups(configs), [configs])

  const dirtyGroups = useMemo(
    () => groups.filter((g) => CAPTURE_APIS.some(({ api }) => edits.has(editKey(g.id, api)))),
    [groups, edits],
  )

  /** Every (control, API) pair that still has a binding to clear. */
  const clearableApis = useMemo(() => {
    const out: Array<{ id: string; api: InputApi }> = []
    for (const g of groups) {
      for (const { api } of CAPTURE_APIS) {
        if (isClearable(edits.get(editKey(g.id, api)), sharedOf(apiValues(g, api)))) {
          out.push({ id: g.id, api })
        }
      }
    }
    return out
  }, [groups, edits])

  const setApiEdit = (id: string, api: InputApi, edit: ApiEdit): void => {
    setEdits((prev) => new Map(prev).set(editKey(id, api), edit))
  }

  const handleClearAll = (): void => {
    setEdits((prev) => {
      const next = new Map(prev)
      for (const { id, api } of clearableApis) next.set(editKey(id, api), { cleared: true })
      return next
    })
  }

  const handleApply = async (): Promise<void> => {
    setApplying(true)
    try {
      await onApply({
        // Match by InputMapping (the control identity); fall back to ButtonName
        // only for unmapped bindings.
        updates: dirtyGroups.map((g) => {
          const captures: CapturedBinding[] = []
          const clearApis: InputApi[] = []
          for (const { api } of CAPTURE_APIS) {
            const edit = edits.get(editKey(g.id, api))
            if (!edit) continue
            if (edit.captured) captures.push(edit.captured)
            else if (edit.cleared) clearApis.push(api)
          }
          return {
            buttonNames: g.buttonNames,
            inputMappings: g.inputMappings,
            ...(captures.length ? { captures } : {}),
            ...(clearApis.length ? { clearApis } : {}),
          }
        }),
      })
      setEdits(new Map())
    } finally {
      setApplying(false)
    }
  }

  if (checkedCount === 0) {
    return (
      <Box sx={{ height: "100%", display: "grid", placeItems: "center", color: "text.secondary" }}>
        <Typography>Select one or more games to edit their controls.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ flexGrow: 1, minWidth: 0, p: 2 }}>
        {!singleGame && <Typography variant="h6">Controls</Typography>}
        <Typography variant="body2" color="text.secondary">
          {singleGame ? (
            <>
              {groups.length} control{groups.length === 1 ? "" : "s"}. Capture a new binding per
              input API, or clear one to leave it unbound.
            </>
          ) : (
            <>
              {groups.length} control{groups.length === 1 ? "" : "s"} across {checkedCount} selected
              game{checkedCount === 1 ? "" : "s"}. Each change applies only to games that have that
              control.
            </>
          )}
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
          disabled={clearableApis.length === 0 || applying}
          onClick={handleClearAll}
        >
          Clear all inputs
        </Button>
        <Button
          variant="outlined"
          disabled={dirtyGroups.length === 0 || applying}
          onClick={() => setEdits(new Map())}
        >
          Discard changes
        </Button>
        <Button
          variant="contained"
          disabled={dirtyGroups.length === 0 || applying}
          onClick={() => void handleApply()}
        >
          {applying
            ? "Applying…"
            : `Apply changes${dirtyGroups.length ? ` (${dirtyGroups.length})` : ""}`}
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
            {singleGame
              ? "This game defines no input bindings."
              : "The selected games define no input bindings."}
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Control</TableCell>
                  <TableCell sx={{ width: "55%" }}>Bindings</TableCell>
                  {!singleGame && <TableCell align="right">Games</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map((g) => {
                  const rowDirty = CAPTURE_APIS.some(({ api }) => edits.has(editKey(g.id, api)))
                  return (
                    <TableRow key={g.id} hover selected={rowDirty}>
                      <TableCell sx={{ verticalAlign: "top" }}>
                        <Typography variant="body2">{g.mapping}</Typography>
                        {g.labels.length > 0 && (
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                            {g.labels.map((l) => (
                              <Chip
                                key={l.label}
                                label={l.label}
                                size="small"
                                variant="outlined"
                                // With one game there's no per-game breakdown to reveal.
                                onClick={
                                  singleGame
                                    ? undefined
                                    : (e) =>
                                        setLabelPopover({
                                          anchor: e.currentTarget,
                                          mapping: g.mapping,
                                          label: l,
                                        })
                                }
                              />
                            ))}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          {CAPTURE_APIS.map(({ api, tag }) => {
                            const edit = edits.get(editKey(g.id, api))
                            const shared = sharedOf(apiValues(g, api))
                            // Effective displayed value for this API.
                            let text: string | null
                            if (edit?.captured) text = edit.captured.label
                            else if (edit?.cleared) text = ""
                            else text = shared
                            const edited = Boolean(edit)
                            const canClear = isClearable(edit, shared)
                            return (
                              <Stack key={api} direction="row" alignItems="center" spacing={1}>
                                <Chip label={tag} size="small" sx={{ minWidth: 40 }} />
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{ flexGrow: 1, minWidth: 0 }}
                                  color={
                                    text === null || text === ""
                                      ? "text.disabled"
                                      : edited
                                        ? "primary"
                                        : "text.primary"
                                  }
                                >
                                  {text === null
                                    ? "(multiple values)"
                                    : text === ""
                                      ? "Unbound"
                                      : text}
                                </Typography>
                                <Tooltip title={`Capture ${api}`}>
                                  <Button
                                    size="small"
                                    color="inherit"
                                    startIcon={<SportsEsportsIcon fontSize="small" />}
                                    sx={{
                                      minWidth: 0,
                                      px: 1,
                                      "& .MuiButton-startIcon": { mr: 0.5 },
                                    }}
                                    onClick={() =>
                                      setActiveCapture({
                                        groupId: g.id,
                                        controlName: g.mapping,
                                        api,
                                      })
                                    }
                                  >
                                    {tag}
                                  </Button>
                                </Tooltip>
                                <Tooltip title={`Clear ${api}`}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={!canClear}
                                      onClick={() => setApiEdit(g.id, api, { cleared: true })}
                                    >
                                      <ClearIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                            )
                          })}
                        </Stack>
                      </TableCell>
                      {!singleGame && (
                        <TableCell align="right" sx={{ verticalAlign: "top" }}>
                          <Chip size="small" variant="outlined" label={g.profileNames.length} />
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {activeCapture && (
        <CaptureDialog
          api={activeCapture.api}
          controlName={activeCapture.controlName}
          onCapture={(binding) => {
            setApiEdit(activeCapture.groupId, activeCapture.api, { captured: binding })
            setActiveCapture(null)
          }}
          onClose={() => setActiveCapture(null)}
        />
      )}

      <Popover
        open={Boolean(labelPopover)}
        anchorEl={labelPopover?.anchor ?? null}
        onClose={() => setLabelPopover(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {labelPopover && (
          <Box sx={{ p: 1.5, maxWidth: 320 }}>
            <Typography variant="subtitle2">{labelPopover.label.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {labelPopover.mapping} · {labelPopover.label.games.length} game
              {labelPopover.label.games.length === 1 ? "" : "s"}
            </Typography>
            <List dense sx={{ pt: 0.5, maxHeight: 320, overflow: "auto" }}>
              {labelPopover.label.games.map((gm) => (
                <ListItem key={gm.profileName} disableGutters sx={{ py: 0 }}>
                  <ListItemText
                    primary={gm.name}
                    slotProps={{ primary: { variant: "body2", noWrap: true } }}
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
