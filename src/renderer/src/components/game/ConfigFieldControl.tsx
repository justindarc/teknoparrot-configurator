import Box from "@mui/material/Box"
import FormControlLabel from "@mui/material/FormControlLabel"
import MenuItem from "@mui/material/MenuItem"
import Slider from "@mui/material/Slider"
import Switch from "@mui/material/Switch"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import Stack from "@mui/material/Stack"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import type { ConfigField } from "@shared/teknoparrot"
import { boolValue, isBoolOn } from "../../util/fieldValue"

interface ConfigFieldControlProps {
  field: ConfigField
  onChange: (value: string) => void
}

function Hint({ hint }: { hint?: string }): JSX.Element | null {
  if (!hint) return null
  return (
    <Tooltip title={hint}>
      <HelpOutlineIcon fontSize="small" color="disabled" sx={{ ml: 0.5, cursor: "help" }} />
    </Tooltip>
  )
}

export default function ConfigFieldControl({
  field,
  onChange,
}: ConfigFieldControlProps): JSX.Element {
  const label = (
    <Stack direction="row" alignItems="center" component="span">
      {field.name}
      <Hint hint={field.hint} />
    </Stack>
  )

  switch (field.type) {
    case "Bool":
      return (
        <FormControlLabel
          control={
            <Switch
              checked={isBoolOn(field.value)}
              onChange={(e) => onChange(boolValue(field.value, e.target.checked))}
            />
          }
          label={label}
        />
      )

    case "Dropdown":
    case "DropdownIndex":
      return (
        <TextField
          select
          label={label}
          value={field.options.includes(field.value) ? field.value : ""}
          onChange={(e) => onChange(e.target.value)}
          fullWidth
          size="small"
          helperText={field.hint}
        >
          {/* Preserve an unrecognised current value so it isn't silently lost. */}
          {!field.options.includes(field.value) && field.value !== "" && (
            <MenuItem value="">{`(current: ${field.value})`}</MenuItem>
          )}
          {field.options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
      )

    case "Slider": {
      const numeric = Number(field.value) || 0
      const max = field.max > field.min ? field.max : 100
      return (
        <Box>
          <Typography variant="body2" gutterBottom>
            {field.name}: <strong>{field.value}</strong>
            <Hint hint={field.hint} />
          </Typography>
          <Slider
            value={numeric}
            min={field.min}
            max={max}
            step={field.step || 1}
            valueLabelDisplay="auto"
            onChange={(_e, v) => onChange(String(v))}
          />
        </Box>
      )
    }

    case "KeyCapture":
    case "Text":
    default:
      return (
        <TextField
          label={label}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          fullWidth
          size="small"
          helperText={
            field.type === "KeyCapture" ? (field.hint ?? "Key code (e.g. 0x60)") : field.hint
          }
        />
      )
  }
}
