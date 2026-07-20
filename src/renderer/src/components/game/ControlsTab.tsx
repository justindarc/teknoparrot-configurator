import type { BulkControlUpdate, GameConfig } from "@shared/teknoparrot"
import BulkControlsEditor from "../controls/BulkControlsEditor"

interface ControlsTabProps {
  config: GameConfig
  onApply: (payload: Omit<BulkControlUpdate, "profileNames">) => Promise<void>
}

/**
 * The game's controls, edited with the same table the Controls screen uses for
 * bulk edits — scoped to this one game.
 */
export default function ControlsTab({ config, onApply }: ControlsTabProps): JSX.Element {
  return (
    <BulkControlsEditor
      configs={[config]}
      checkedCount={1}
      loadingConfigs={false}
      onApply={onApply}
      singleGame
    />
  )
}
