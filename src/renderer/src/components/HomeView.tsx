import { useMemo, useState } from "react"
import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import type { GameSummary } from "@shared/teknoparrot"
import GameList from "./GameList"
import GameDetail from "./GameDetail"

interface HomeViewProps {
  games: GameSummary[]
  loading: boolean
  error: string | null
  drawerWidth: number
  onFixPath: () => void
}

/** The original single-game browsing experience: game list + detail panel. */
export default function HomeView({
  games,
  loading,
  error,
  drawerWidth,
  onFixPath,
}: HomeViewProps): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)

  const selectedGame = useMemo(
    () => games.find((g) => g.profileName === selected) ?? null,
    [games, selected],
  )

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
          {loading ? (
            <Stack alignItems="center" sx={{ pt: 6 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <GameList games={games} selected={selected} onSelect={setSelected} />
          )}
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
          ) : selectedGame ? (
            <GameDetail game={selectedGame} />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
              }}
            >
              <Typography>Select a game to view its details and settings.</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </>
  )
}
