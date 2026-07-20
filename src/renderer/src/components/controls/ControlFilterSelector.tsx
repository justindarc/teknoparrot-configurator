import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Checkbox from "@mui/material/Checkbox"
import List from "@mui/material/List"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import MenuItem from "@mui/material/MenuItem"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset"
import type { ControlScheme } from "@shared/controlScheme"
import type { ControlFacets, ControlFilters } from "../../util/controlFilters"
import { iconUrl } from "../../util/icon"

interface ControlFilterSelectorProps {
  filters: ControlFilters
  facets: ControlFacets
  onSchemeChange: (scheme: ControlScheme | "") => void
  onGenreChange: (genre: string) => void
  onPlayersChange: (players: number | "any") => void
  onButtonsChange: (buttons: number | "any") => void
  checked: Set<string>
  onToggle: (profileName: string) => void
  onSetAll: (all: boolean) => void
}

/** Renders a "<label> (<count>)" option row. */
const optionLabel = (label: string, count: number): string => `${label} (${count})`

export default function ControlFilterSelector({
  filters,
  facets,
  onSchemeChange,
  onGenreChange,
  onPlayersChange,
  onButtonsChange,
  checked,
  onToggle,
  onSetAll,
}: ControlFilterSelectorProps): JSX.Element {
  const { schemeOptions, genreOptions, playerOptions, buttonOptions, visibleGames } = facets

  const checkedVisible = visibleGames.filter((g) => checked.has(g.profileName)).length
  const allChecked = visibleGames.length > 0 && checkedVisible === visibleGames.length
  const noneChecked = checkedVisible === 0

  // Sub-filters are only worth showing when they can actually narrow the list.
  const showGenre = genreOptions.length >= 2
  const showPlayers = playerOptions.length >= 2
  const showButtons = buttonOptions.length >= 2

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <TextField
          select
          size="small"
          label="Control scheme"
          value={filters.scheme}
          onChange={(e) => onSchemeChange(e.target.value as ControlScheme | "")}
          fullWidth
        >
          <MenuItem value="">
            <em>Choose a control scheme…</em>
          </MenuItem>
          {schemeOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {optionLabel(o.label, o.count)}
            </MenuItem>
          ))}
        </TextField>

        {filters.scheme && (showGenre || showPlayers || showButtons) && (
          <Stack spacing={1.5}>
            {showGenre && (
              <TextField
                select
                size="small"
                label="Genre"
                value={filters.genre}
                onChange={(e) => onGenreChange(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Any genre</MenuItem>
                {genreOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {optionLabel(o.label, o.count)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {showPlayers && (
              <TextField
                select
                size="small"
                label="Players"
                value={filters.players === "any" ? "any" : String(filters.players)}
                onChange={(e) =>
                  onPlayersChange(e.target.value === "any" ? "any" : Number(e.target.value))
                }
                fullWidth
              >
                <MenuItem value="any">Any players</MenuItem>
                {playerOptions.map((o) => (
                  <MenuItem key={o.value} value={String(o.value)}>
                    {optionLabel(o.label, o.count)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {showButtons && (
              <TextField
                select
                size="small"
                label="Buttons per player"
                value={filters.buttons === "any" ? "any" : String(filters.buttons)}
                onChange={(e) =>
                  onButtonsChange(e.target.value === "any" ? "any" : Number(e.target.value))
                }
                fullWidth
              >
                <MenuItem value="any">Any buttons</MenuItem>
                {buttonOptions.map((o) => (
                  <MenuItem key={o.value} value={String(o.value)}>
                    {optionLabel(o.label, o.count)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            disabled={allChecked || visibleGames.length === 0}
            onClick={() => onSetAll(true)}
          >
            Select all
          </Button>
          <Button
            size="small"
            variant="outlined"
            fullWidth
            disabled={noneChecked}
            onClick={() => onSetAll(false)}
          >
            Select none
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {!filters.scheme ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            Choose a control scheme to list its installed games.
          </Typography>
        ) : visibleGames.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            No installed games match these filters.
          </Typography>
        ) : (
          <List disablePadding dense>
            {visibleGames.map((game) => (
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
                <ListItemText primary={game.name} slotProps={{ primary: { noWrap: true } }} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
        {checkedVisible} of {visibleGames.length} selected
      </Typography>
    </Box>
  )
}
