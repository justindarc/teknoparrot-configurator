import { useMemo, useState } from "react"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Checkbox from "@mui/material/Checkbox"
import InputAdornment from "@mui/material/InputAdornment"
import List from "@mui/material/List"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import MenuItem from "@mui/material/MenuItem"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import SearchIcon from "@mui/icons-material/Search"
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset"
import type { GameSummary } from "@shared/teknoparrot"
import { iconUrl } from "../../util/icon"

interface GameMultiSelectProps {
  /** Installed games to choose from. */
  games: GameSummary[]
  checked: Set<string>
  onToggle: (profileName: string) => void
  /** Checks or clears every currently visible game. */
  onSetAll: (profileNames: string[], checked: boolean) => void
}

/**
 * Game picker for the bulk settings screen. Settings vary mostly by emulator
 * backend, so that — plus a name search — is the filtering worth offering here;
 * the control-scheme facets the controls screen uses don't say anything about
 * which settings a game exposes.
 */
export default function GameMultiSelect({
  games,
  checked,
  onToggle,
  onSetAll,
}: GameMultiSelectProps): JSX.Element {
  const [query, setQuery] = useState("")
  const [emulator, setEmulator] = useState("")

  const emulatorOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const game of games) {
      const key = game.emulator || "Unknown"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [games])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter((game) => {
      if (emulator && (game.emulator || "Unknown") !== emulator) return false
      if (!q) return true
      return (
        game.name.toLowerCase().includes(q) ||
        (game.metadata?.platform?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [games, query, emulator])

  const checkedVisible = visible.filter((g) => checked.has(g.profileName)).length
  const allChecked = visible.length > 0 && checkedVisible === visible.length

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <TextField
          size="small"
          placeholder="Search games…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          select
          size="small"
          label="Emulator"
          value={emulator}
          onChange={(e) => setEmulator(e.target.value)}
          fullWidth
        >
          <MenuItem value="">Any emulator</MenuItem>
          {emulatorOptions.map(([name, count]) => (
            <MenuItem key={name} value={name}>
              {name} ({count})
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            disabled={allChecked || visible.length === 0}
            onClick={() =>
              onSetAll(
                visible.map((g) => g.profileName),
                true,
              )
            }
          >
            Select all
          </Button>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            disabled={checkedVisible === 0}
            onClick={() =>
              onSetAll(
                visible.map((g) => g.profileName),
                false,
              )
            }
          >
            Select none
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            No installed games match.
          </Typography>
        ) : (
          <List disablePadding dense>
            {visible.map((game) => (
              <ListItemButton
                key={game.profileName}
                onClick={() => onToggle(game.profileName)}
                dense
              >
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <Checkbox
                    edge="start"
                    tabIndex={-1}
                    disableRipple
                    checked={checked.has(game.profileName)}
                  />
                </ListItemIcon>
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar
                    variant="rounded"
                    src={iconUrl(game.iconFile)}
                    sx={{ width: 32, height: 32, bgcolor: "action.hover" }}
                  >
                    <VideogameAssetIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={game.name}
                  secondary={game.emulator}
                  slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
        {checkedVisible} of {visible.length} selected
        {checked.size > checkedVisible ? ` (${checked.size} total)` : ""}
      </Typography>
    </Box>
  )
}
