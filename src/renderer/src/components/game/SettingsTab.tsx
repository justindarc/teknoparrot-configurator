import { useMemo, useState } from "react"
import Accordion from "@mui/material/Accordion"
import AccordionDetails from "@mui/material/AccordionDetails"
import AccordionSummary from "@mui/material/AccordionSummary"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import type { ConfigField, GameConfig } from "@shared/teknoparrot"
import { fieldKey } from "@shared/teknoparrot"
import ConfigFieldControl from "./ConfigFieldControl"

interface SettingsTabProps {
  config: GameConfig
  onSave: (fieldValues: Record<string, string>) => Promise<void>
}

/** Groups fields by their CategoryName, preserving first-seen order. */
function groupByCategory(fields: ConfigField[]): [string, ConfigField[]][] {
  const groups = new Map<string, ConfigField[]>()
  for (const f of fields) {
    const list = groups.get(f.category) ?? []
    list.push(f)
    groups.set(f.category, list)
  }
  return [...groups.entries()]
}

export default function SettingsTab({ config, onSave }: SettingsTabProps): JSX.Element {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const groups = useMemo(() => groupByCategory(config.fields), [config.fields])
  const dirty = Object.keys(edits).length > 0

  const valueFor = (field: ConfigField): string => {
    const key = fieldKey(field.category, field.name)
    return key in edits ? edits[key] : field.value
  }

  const setValue = (field: ConfigField, value: string): void => {
    const key = fieldKey(field.category, field.name)
    setEdits((prev) => {
      const next = { ...prev }
      if (value === field.value) delete next[key]
      else next[key] = value
      return next
    })
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await onSave(edits)
      setEdits({})
    } finally {
      setSaving(false)
    }
  }

  if (config.fields.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        This game exposes no configurable settings.
      </Typography>
    )
  }

  return (
    <Box>
      {groups.map(([category, fields]) => (
        <Accordion key={category} defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600 }}>{category}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
              {fields.map((field) => (
                <ConfigFieldControl
                  key={fieldKey(field.category, field.name)}
                  field={{ ...field, value: valueFor(field) }}
                  onChange={(v) => setValue(field, v)}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          mt: 2,
          py: 1.5,
          bgcolor: "background.default",
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button variant="contained" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : `Save changes${dirty ? ` (${Object.keys(edits).length})` : ""}`}
        </Button>
      </Box>
    </Box>
  )
}
