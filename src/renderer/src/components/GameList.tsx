import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react"
import { styled } from "@mui/material"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import List from "@mui/material/List"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import TextField from "@mui/material/TextField"
import InputAdornment from "@mui/material/InputAdornment"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Typography from "@mui/material/Typography"
import Stack from "@mui/material/Stack"
import SearchIcon from "@mui/icons-material/Search"
import VideogameAssetIcon from "@mui/icons-material/VideogameAsset"
import type { GameSummary } from "@shared/teknoparrot"
import { iconUrl } from "../util/icon"

type Filter = "installed" | "not-installed" | "all"

interface GameListProps {
  games: GameSummary[]
  selected: string | null
  onSelect: (profileName: string) => void
}

const StyledToggleButton = styled(ToggleButton)`
  font-size: 11px;
`

/**
 * How long arrow-key navigation coalesces before telling the parent. Long
 * enough that holding a key doesn't load a config per row, short enough that a
 * single press still feels immediate.
 */
const SELECT_DEBOUNCE_MS = 50

interface GameListItemProps {
  game: GameSummary
  selected: boolean
  onSelect: (profileName: string) => void
  registerRef: (profileName: string, el: HTMLDivElement | null) => void
}

/**
 * One row, memoised so an arrow keypress re-renders only the two rows whose
 * highlight changed. Rendering every row's avatar and emotion styles on each
 * keypress is what makes held-down navigation stutter on a long list, so every
 * prop here has to keep a stable identity between renders.
 */
const GameListItem = memo(function GameListItem({
  game,
  selected,
  onSelect,
  registerRef,
}: GameListItemProps): JSX.Element {
  const { profileName } = game
  const setRef = useCallback(
    (el: HTMLDivElement | null) => registerRef(profileName, el),
    [registerRef, profileName],
  )
  const handleClick = useCallback(() => onSelect(profileName), [onSelect, profileName])

  return (
    <ListItemButton ref={setRef} tabIndex={-1} selected={selected} onClick={handleClick}>
      <ListItemAvatar>
        <Avatar variant="rounded" src={iconUrl(game.iconFile)} sx={{ bgcolor: "action.hover" }}>
          <VideogameAssetIcon fontSize="small" />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={game.name}
        secondary={game.metadata?.platform || game.emulator || game.genre}
        slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
      />
      {!game.installed && <Chip label="Not installed" size="small" variant="outlined" />}
    </ListItemButton>
  )
})

export default function GameList({ games, selected, onSelect }: GameListProps): JSX.Element {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("installed")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter((g) => {
      if (filter === "installed" && !g.installed) return false
      if (filter === "not-installed" && g.installed) return false
      if (!q) return true
      return (
        g.name.toLowerCase().includes(q) ||
        (g.emulator?.toLowerCase().includes(q) ?? false) ||
        (g.metadata?.platform?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [games, query, filter])

  const itemRefs = useRef(new Map<string, HTMLDivElement>())

  const registerRef = useCallback((profileName: string, el: HTMLDivElement | null): void => {
    if (el) itemRefs.current.set(profileName, el)
    else itemRefs.current.delete(profileName)
  }, [])

  /**
   * The row the user is on, ahead of the parent. Highlighting from local state
   * keeps arrow keys instant while the detail panel — which reloads a config
   * per selection — lags behind by the debounce.
   */
  const [pending, setPending] = useState<string | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = pending ?? selected

  // Once the parent has caught up the override is redundant. Only drop it on an
  // exact match: a later keypress may already have moved `pending` past the
  // selection being committed here.
  useEffect(() => {
    if (pending !== null && pending === selected) setPending(null)
  }, [pending, selected])

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current)
    }
  }, [])

  /**
   * Highlight `profileName` now, hand it to the parent later. The parent update
   * is a transition so React can interrupt the detail panel's render to keep up
   * with further keypresses.
   */
  const select = useCallback(
    (profileName: string, immediate: boolean): void => {
      setPending(profileName)
      if (commitTimer.current) clearTimeout(commitTimer.current)
      const commit = (): void => {
        commitTimer.current = null
        startTransition(() => onSelect(profileName))
      }
      if (immediate) commit()
      else commitTimer.current = setTimeout(commit, SELECT_DEBOUNCE_MS)
    },
    [onSelect],
  )

  // A click is one deliberate pick — no reason to make it wait.
  const selectByClick = useCallback((profileName: string) => select(profileName, true), [select])

  const focusItem = (profileName: string): void => {
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(profileName)
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: "nearest" })
    })
  }

  /** Tabbing to the list hands focus straight to a row, so the ring is visible. */
  const handleFocus = (e: FocusEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    const name =
      filtered.find((g) => g.profileName === active)?.profileName ?? filtered[0]?.profileName
    if (name) focusItem(name)
  }

  /**
   * Arrow keys move the selection through the filtered list. Selection stops at
   * either end rather than wrapping, and takes DOM focus with it so the focus
   * ring and the highlighted row stay on the same game.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    if (filtered.length === 0) return
    e.preventDefault()

    // With nothing selected yet, either arrow starts at the first game.
    const current = filtered.findIndex((g) => g.profileName === active)
    const next =
      e.key === "ArrowDown" ? Math.min(current + 1, filtered.length - 1) : Math.max(current - 1, 0)
    const target = filtered[next]
    if (target.profileName === active) return

    select(target.profileName, false)
    focusItem(target.profileName)
  }

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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filter}
          onChange={(_e, v: Filter | null) => v && setFilter(v)}
          fullWidth
        >
          <StyledToggleButton value="installed">Installed</StyledToggleButton>
          <StyledToggleButton value="not-installed">Not installed</StyledToggleButton>
          <StyledToggleButton value="all">All games</StyledToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* One tab stop for the whole list (items use a roving tabIndex), so Tab
          reaches it and the arrow keys take over from there. */}
      <Box
        tabIndex={0}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        sx={{ flexGrow: 1, overflow: "auto" }}
      >
        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            No games match.
          </Typography>
        ) : (
          <List disablePadding dense>
            {filtered.map((game) => (
              <GameListItem
                key={game.profileName}
                game={game}
                selected={game.profileName === active}
                onSelect={selectByClick}
                registerRef={registerRef}
              />
            ))}
          </List>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
        {filtered.length} of {games.length} games
      </Typography>
    </Box>
  )
}
