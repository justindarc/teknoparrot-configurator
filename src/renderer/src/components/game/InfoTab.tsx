import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import Grid from "@mui/material/Grid2"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import type { GameSummary, GpuCompatibility } from "@shared/teknoparrot"

interface InfoTabProps {
  game: GameSummary
}

function Fact({ label, value }: { label: string; value?: string }): JSX.Element | null {
  if (!value) return null
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  )
}

function gpuColor(status?: string): "success" | "warning" | "error" | "default" {
  const s = status?.toLowerCase() ?? ""
  if (s === "ok") return "success"
  if (s.includes("issue") || s.includes("playable")) return "warning"
  if (s === "broken" || s.includes("no")) return "error"
  return "default"
}

function GpuRow({ vendor, compat }: { vendor: string; compat: GpuCompatibility }): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ width: 72 }}>
        {vendor}
      </Typography>
      <Chip size="small" label={compat.status || "Unknown"} color={gpuColor(compat.status)} />
      {compat.issues && (
        <Typography variant="caption" color="text.secondary">
          {compat.issues}
        </Typography>
      )}
    </Stack>
  )
}

export default function InfoTab({ game }: InfoTabProps): JSX.Element {
  const meta = game.metadata
  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Grid container spacing={2}>
        <Fact label="Platform" value={meta?.platform} />
        <Fact label="Release year" value={meta?.releaseYear} />
        <Fact label="Genre" value={game.genre} />
        <Fact label="Emulator" value={game.emulator} />
        <Fact label="Architecture" value={game.is64Bit ? "64-bit" : "32-bit"} />
        <Fact label="Wheel rotation" value={meta?.wheelRotation} />
      </Grid>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {game.installed ? (
          <Chip size="small" color="success" label="Installed" />
        ) : (
          <Chip size="small" variant="outlined" label="Not installed" />
        )}
        {game.requiresAdmin && <Chip size="small" color="warning" label="Requires admin" />}
        {game.patreon && <Chip size="small" color="secondary" label="Patreon" />}
      </Stack>

      {game.gamePath && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Game path
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            {game.gamePath}
          </Typography>
        </Box>
      )}

      {meta && (
        <>
          <Divider />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              GPU compatibility
            </Typography>
            <Stack spacing={1}>
              <GpuRow vendor="NVIDIA" compat={meta.nvidia} />
              <GpuRow vendor="AMD" compat={meta.amd} />
              <GpuRow vendor="Intel" compat={meta.intel} />
            </Stack>
          </Box>

          {meta.supportedVersions.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Supported versions
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {meta.supportedVersions.map((v) => (
                  <Chip key={v} size="small" variant="outlined" label={v} />
                ))}
              </Stack>
            </Box>
          )}

          {meta.generalIssues && <Alert severity="info">{meta.generalIssues}</Alert>}
        </>
      )}
    </Stack>
  )
}
