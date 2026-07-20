import Checkbox from "@mui/material/Checkbox"
import MenuItem from "@mui/material/MenuItem"
import Slider from "@mui/material/Slider"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import type { SettingGroup } from "../../util/settingGroups"
import { boolValue, isBoolOn } from "../../util/fieldValue"

interface BulkFieldControlProps {
  group: SettingGroup
  /** The value to display, or null when the selected games disagree. */
  value: string | null
  onChange: (value: string) => void
}

const MIXED = "(multiple values)"

/**
 * A single setting's editor for the bulk table: the same field types as the
 * per-game settings tab, minus the labels (the table's first column already
 * names the setting) and with a "multiple values" state for when the selected
 * games currently disagree.
 */
export default function BulkFieldControl({
  group,
  value,
  onChange,
}: BulkFieldControlProps): JSX.Element {
  const mixed = value === null
  const current = value ?? ""

  switch (group.type) {
    case "Bool":
      return (
        <Checkbox
          size="small"
          // Indeterminate reads as "some games on, some off" — clicking it
          // resolves every selected game to on.
          indeterminate={mixed}
          checked={!mixed && isBoolOn(current)}
          onChange={(e) => onChange(boolValue(current, e.target.checked))}
        />
      )

    case "Dropdown":
    case "DropdownIndex": {
      const known = group.options.includes(current)
      return (
        <TextField
          select
          size="small"
          fullWidth
          value={known ? current : ""}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ select: { displayEmpty: true } }}
        >
          {!known && (
            <MenuItem value="" disabled>
              <Typography variant="body2" color="text.disabled">
                {mixed ? MIXED : current === "" ? "Unset" : `(current: ${current})`}
              </Typography>
            </MenuItem>
          )}
          {group.options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      )
    }

    case "Slider": {
      const max = group.max > group.min ? group.max : 100
      return (
        <Stack direction="row" alignItems="center" spacing={2}>
          <Slider
            size="small"
            value={Number(current) || 0}
            min={group.min}
            max={max}
            step={group.step || 1}
            valueLabelDisplay="auto"
            onChange={(_e, v) => onChange(String(v))}
            sx={{ flexGrow: 1, minWidth: 120 }}
          />
          <Typography
            variant="body2"
            color={mixed ? "text.disabled" : "text.primary"}
            sx={{ minWidth: 96, textAlign: "right" }}
          >
            {mixed ? MIXED : current}
          </Typography>
        </Stack>
      )
    }

    case "KeyCapture":
    case "Text":
    default:
      return (
        <TextField
          size="small"
          fullWidth
          value={current}
          placeholder={mixed ? MIXED : group.type === "KeyCapture" ? "Key code (e.g. 0x60)" : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
