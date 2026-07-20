/**
 * Classifies a TeknoParrot game by its physical control scheme, purely from the
 * input bindings declared in its profile (`JoystickButtons`). This module is the
 * single source of truth shared by:
 *
 *   - the main process, which tags every `GameSummary` during `listGames`, and
 *   - `scripts/classify-controls.mts`, the standalone catalog exporter.
 *
 * The genre metadata TeknoParrot ships is deliberately ignored: it is
 * inconsistent and does not reliably describe the control hardware. Only the
 * input bindings are used.
 *
 * Keep this file free of Node/Electron imports so it bundles into the sandboxed
 * renderer. It intentionally does not import `InputBinding` from
 * "./teknoparrot" (which would be a circular type reference); the structurally
 * compatible `ControlBinding` below is all the classifier needs.
 */

/** The subset of an input binding the classifier reads. */
export interface ControlBinding {
  buttonName: string
  inputMapping: string
  analogType: string
}

/** The physical control schemes a game is classified into (one primary each). */
export type ControlScheme =
  | "steeringWheel"
  | "lightGun"
  | "touchscreen"
  | "trackball"
  | "spinner"
  | "guitar"
  | "analogJoystick"
  | "joystick8Way"
  | "buttons"
  | "keyboard"
  | "unknown"

/** Display order + human-readable labels for the schemes. */
export const CONTROL_SCHEME_LABELS: Record<ControlScheme, string> = {
  joystick8Way: "8-way joystick",
  analogJoystick: "Analog joystick",
  steeringWheel: "Steering wheel",
  lightGun: "Light gun",
  trackball: "Trackball",
  spinner: "Spinner",
  guitar: "Guitar",
  touchscreen: "Touchscreen",
  buttons: "Buttons only",
  keyboard: "Keyboard / mouse",
  unknown: "Unknown",
}

/** All schemes in display order (keys of the label map). */
export const CONTROL_SCHEMES = Object.keys(CONTROL_SCHEME_LABELS) as ControlScheme[]

/** Raw, transparent evidence extracted from a profile's bindings. */
export interface ControlSignals {
  /** Distinct non-"None" AnalogType values present (e.g. Wheel, AnalogJoystick). */
  analogTypes: string[]
  hasWheel: boolean
  /**
   * A Wheel-typed axis is labelled like a real driving/motion control
   * (wheel / handle / handlebar / leaning / swing). When false despite `hasWheel`
   * the "Wheel" type is being reused for a plain analog stick (e.g. an axis
   * named "Left-Right Move"), so the game is analog, not a steering cabinet.
   */
  hasSteeringLabel: boolean
  hasGasOrBrake: boolean
  hasGearChange: boolean
  hasLightGunMapping: boolean
  hasTrackballMapping: boolean
  hasRotaryMapping: boolean
  hasRelativeMapping: boolean
  hasAnalogStick: boolean
  /** Any button-name mentions a gun / touch / spinner / dial (semantic hints). */
  mentionsGun: boolean
  /**
   * A gun label sits on an *aiming* control — a light-gun mapping, a relative
   * pointer, or the directional stick itself (e.g. "Player 1 Gun Up"). This is
   * a real light gun, unlike a lone weapon button ("Gun Cannon") on a movement
   * game, which sets `mentionsGun` but not this.
   */
  gunAim: boolean
  mentionsTouch: boolean
  mentionsSpinner: boolean
  mentionsDial: boolean
  /**
   * A button-name mentions a trackball. Some profiles model a trackball through
   * the absolute-pointer (P#LightGun) slot but label it "Trackball" (e.g.
   * FamilyGuyBowling), so the label reveals the real device.
   */
  mentionsTrackball: boolean
  /** A button-name mentions a guitar controller ("Fret"/"Guitar"). */
  mentionsGuitar: boolean
  /**
   * Player keys ("<board>:<player>", e.g. "1:1", "2:1" for a JvsTwo second
   * board) that have a full 4-direction digital stick (from mappings OR names).
   */
  playersWithFullStick: string[]
  /** Player keys that have at least one digital direction button. */
  playersWithAnyDirection: string[]
  /**
   * True if some player has a full stick from *structural* direction mappings
   * (P#ButtonUp/…), not merely inferred from button names. A real digital stick
   * outranks a touch panel; a name-only stick (e.g. Otomedius, whose "Player 1
   * Up" is on P2Button slots) does not, so touch stays primary there.
   */
  hasStructuralFullStick: boolean
  /** Total distinct playable input mappings (excludes Test/Service/Coin/card/etc.). */
  playableMappingCount: number
}

/** A game's complete control classification. */
export interface ControlClassification {
  controlScheme: ControlScheme
  /** Best-effort simultaneous-player count (heuristic; see `countPlayers`). */
  players: number
  /**
   * Action buttons for a player, excluding Start/Coin/Service and the
   * directional stick. Null when not meaningfully countable (keyboard games).
   * Most useful for `joystick8Way` games (e.g. 4- vs 6-button fighters).
   */
  buttonsPerPlayer: number | null
  signals: ControlSignals
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

/** Mappings that are cabinet plumbing, not a player-facing control. */
const NON_PLAYABLE = new Set(["Test", "Service1", "Service2", "Coin1", "Coin2"])

/**
 * A binding counts as "playable" only if it drives gameplay. Test/Service/Coin,
 * card/AIME readers and system slots are cabinet plumbing: a profile whose only
 * bindings are these has no configurable controls at all (a keyboard game).
 */
function isPlayable(b: ControlBinding): boolean {
  const map = b.inputMapping
  if (!map) return false
  if (NON_PLAYABLE.has(map)) return false
  if (/^(JvsTwo)?Service\d*$/.test(map)) return false
  if (/^Card\d*$/.test(map)) return false
  if (/^TPSystem\d*$/.test(map)) return false
  if (/InsertCard$/.test(map)) return false
  if (/\b(card|aime)\b/i.test(b.buttonName)) return false
  return true
}

const DIRS = ["Up", "Down", "Left", "Right"] as const

/**
 * A stable player identity keyed by JVS board and player index ("1:2" =
 * board 1, player 2; "2:1" = a linked JvsTwo second board's player 1). Board
 * awareness matters: a 4-player linked cabinet reuses P1/P2 mapping names on a
 * second board, so keying by index alone would collapse 4 players into 2.
 */
function playerKeyOf(mapping: string): string | null {
  const m = /^(JvsTwo)?P(\d+)(?:Button|Relative|LightGun|Trackball)/.exec(mapping)
  if (m) return `${m[1] ? 2 : 1}:${m[2]}`
  if (/^Pokken/.test(mapping)) return "1:1"
  return null
}

/** Extracts (player key, direction) from a directional-button mapping. */
function directionOf(mapping: string): { key: string; dir: string } | null {
  let m = /^(JvsTwo)?P(\d+)Button(Up|Down|Left|Right)$/.exec(mapping)
  if (m) return { key: `${m[1] ? 2 : 1}:${m[2]}`, dir: m[3] }
  m = /^PokkenButton(Up|Down|Left|Right)$/.exec(mapping)
  if (m) return { key: "1:1", dir: m[1] }
  return null
}

/**
 * A direction inferred from a *button name*, for profiles that wire a movement
 * stick to numeric/renamed slots (e.g. Rampage "P1 UP", zoids "Move Up", Sega
 * Olympic "Left Lever Up"). After stripping an optional player prefix and an
 * optional movement-control descriptor (a stick/lever/move word, optionally
 * side-qualified), the remainder must be exactly a direction word — so "Volume
 * Up", "Menu Up", "Gun Y Up", "Strum Up" and "Jump Right" do NOT count.
 */
function directionFromName(name: string): string | null {
  let s = name.trim().toLowerCase()
  s = s.replace(/^(?:p\d+|player\s*\d+|\d+p)\s+/, "")
  s = s.replace(/^(?:(?:left|right)\s+)?(?:lever|stick|joystick|move|d-?pad|analog)\s+/, "")
  return /^(up|down|left|right)$/.test(s) ? s[0].toUpperCase() + s.slice(1) : null
}

/** A player index derived from a button-name prefix ("Player 3 …" -> "1:3"). */
function playerKeyFromName(name: string): string | null {
  const m = /\b(?:p|player\s*)(\d+)\b/.exec(name)
  return m ? `1:${m[1]}` : null
}

/** (player key) for a numeric *action* button (P1Button3), else null. */
function actionButtonOf(mapping: string): string | null {
  const m = /^(JvsTwo)?P(\d+)Button\d+$/.exec(mapping)
  if (m) return `${m[1] ? 2 : 1}:${m[2]}`
  // Pokken labels its face buttons A/B/X/Y/L/R rather than numerically.
  if (/^PokkenButton(A|B|X|Y|L|R)$/.test(mapping)) return "1:1"
  return null
}

export function extractSignals(bindings: ControlBinding[]): ControlSignals {
  const analogTypes = new Set<string>()
  const dirsByPlayer = new Map<string, Set<string>>()
  const structDirsByPlayer = new Map<string, Set<string>>()
  let hasWheel = false
  let hasSteeringLabel = false
  let hasGasOrBrake = false
  let hasGearChange = false
  let hasLightGun = false
  let hasTrackball = false
  let hasRotary = false
  let hasRelative = false
  let hasAnalogStick = false
  let mentionsGun = false
  let gunAim = false
  let mentionsTouch = false
  let mentionsSpinner = false
  let mentionsDial = false
  let mentionsTrackball = false
  let mentionsGuitar = false
  let playableCount = 0

  for (const b of bindings) {
    const map = b.inputMapping
    const at = b.analogType
    const name = b.buttonName.toLowerCase()

    if (isPlayable(b)) playableCount++

    if (at && at !== "None") analogTypes.add(at)
    if (at === "Wheel") {
      hasWheel = true
      if (/wheel|steer|handle|lean|swing/.test(name)) hasSteeringLabel = true
    }
    if (at === "Gas" || at === "Brake") hasGasOrBrake = true
    if (
      at === "AnalogJoystick" ||
      at === "AnalogJoystickReverse" ||
      at === "AnalogJoystickY" ||
      at === "SWThrottle"
    ) {
      hasAnalogStick = true
    }

    if (/GearChange/.test(map)) hasGearChange = true
    if (/^(JvsTwo)?P\d+LightGun$/.test(map)) hasLightGun = true
    if (/^(JvsTwo)?P\d+Trackball$/.test(map)) hasTrackball = true
    if (/^Rotary/.test(map)) hasRotary = true
    if (/^(JvsTwo)?P\d+Relative/.test(map)) hasRelative = true

    const d = directionOf(map)

    if (name.includes("gun")) {
      mentionsGun = true
      // Gun on an aiming control (pointer / relative / the stick itself) is a
      // real light gun; gun on a plain action button is just a weapon.
      if (/^(JvsTwo)?P\d+(LightGun|Relative)/.test(map) || d) gunAim = true
    }
    if (name.includes("touch")) mentionsTouch = true
    if (name.includes("spinner")) mentionsSpinner = true
    if (/\bdial\b/.test(name)) mentionsDial = true
    if (/track\s?ball/.test(name)) mentionsTrackball = true
    if (/fret|guitar/.test(name)) mentionsGuitar = true

    const addDir = (key: string, dir: string): void => {
      let set = dirsByPlayer.get(key)
      if (!set) dirsByPlayer.set(key, (set = new Set()))
      set.add(dir)
    }
    // Record BOTH the structural direction (from the mapping) and any direction
    // read from the button name. They are unioned because profiles sometimes
    // scramble the two (e.g. zoids "Move Up" -> P1ButtonDown), so each source
    // may supply a slot the other is missing.
    if (d) {
      addDir(d.key, d.dir)
      let s = structDirsByPlayer.get(d.key)
      if (!s) structDirsByPlayer.set(d.key, (s = new Set()))
      s.add(d.dir)
    }
    const nd = directionFromName(name)
    if (nd) addDir(playerKeyOf(map) ?? playerKeyFromName(name) ?? "1:1", nd)
  }

  const playersWithFullStick: string[] = []
  const playersWithAnyDirection: string[] = []
  for (const [key, dirs] of [...dirsByPlayer.entries()].sort()) {
    playersWithAnyDirection.push(key)
    if (DIRS.every((dir) => dirs.has(dir))) playersWithFullStick.push(key)
  }
  let hasStructuralFullStick = false
  for (const dirs of structDirsByPlayer.values()) {
    if (DIRS.every((dir) => dirs.has(dir))) hasStructuralFullStick = true
  }

  return {
    analogTypes: [...analogTypes].sort(),
    hasWheel,
    hasSteeringLabel,
    hasGasOrBrake,
    hasGearChange,
    hasLightGunMapping: hasLightGun,
    hasTrackballMapping: hasTrackball,
    hasRotaryMapping: hasRotary,
    hasRelativeMapping: hasRelative,
    hasAnalogStick,
    mentionsGun,
    gunAim,
    mentionsTouch,
    mentionsSpinner,
    mentionsDial,
    mentionsTrackball,
    mentionsGuitar,
    playersWithFullStick,
    playersWithAnyDirection,
    hasStructuralFullStick,
    playableMappingCount: playableCount,
  }
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Assigns one primary control scheme, checked in priority order so the most
 * defining piece of hardware wins for hybrid cabinets:
 *
 *  1. keyboard       - no player-facing bindings at all (keyboard/mouse game).
 *  1b. guitar        - a guitar controller ("Fret"/"Guitar" labels). Checked
 *                      early because the specialised label is unambiguous and
 *                      overrides the tilt axis / fret buttons underneath it.
 *  2. steeringWheel  - a Wheel axis LABELLED as a driving/motion control
 *                      (wheel/handle/handlebar/leaning/swing), or a gear-shift
 *                      mapping. A Wheel type reused for a plain "move" axis
 *                      (JusticeLeague) is not steering.
 *  3. lightGun       - an absolute-pointer shooter: gun-labelled AIMING
 *                      (a light-gun mapping, relative pointer, or the stick used
 *                      to aim), or a bare P#LightGun pointer. A lone weapon
 *                      button named "gun" on a movement game is NOT a light gun,
 *                      nor is a "trackball"-labelled pointer. Ranked above
 *                      spinner/trackball so an auxiliary rotary/ball (e.g. DSPS)
 *                      can't outrank the gun.
 *  4. touchscreen    - "touch"-labelled bindings, and only when touch is the
 *                      PRIMARY control (no full digital stick alongside it — that
 *                      rules out stick games that merely expose a touch menu).
 *  5. spinner        - a single-axis rotary control (a Rotary mapping, or a
 *                      Trackball mapping the profile explicitly calls a spinner,
 *                      or a "dial"/"spinner" label).
 *  6. trackball      - a P#Trackball mapping, or a "trackball"-labelled pointer
 *                      that reuses the light-gun slot (FamilyGuyBowling).
 *  7. analogJoystick - AnalogJoystick / throttle axes drive movement. Checked
 *                      before the digital-stick rule because many analog games
 *                      (e.g. Blazing Angels, flight/mech titles) ALSO expose the
 *                      stick's Up/Down/Left/Right as digital fallbacks; the
 *                      analog axis is the real control. TeknoParrot likewise
 *                      models some inherently-8-way cabinets (TMNT, Virtua
 *                      Striker) as analog axes, so this bucket means "movement is
 *                      bound to an analog axis", which is also how you bind it.
 *  8. joystick8Way   - a full 4-direction digital stick and no analog axis.
 *  9. buttons        - action buttons only, no stick/axis (rhythm games, pop'n /
 *                      Taiko, mahjong and card-battle panels).
 * 10. unknown        - has playable input that matched none of the above.
 */
export function classifyControlScheme(sig: ControlSignals): ControlScheme {
  if (sig.playableMappingCount === 0) return "keyboard"

  if (sig.mentionsGuitar) return "guitar"

  if (sig.hasGearChange || (sig.hasWheel && sig.hasSteeringLabel)) return "steeringWheel"

  const hasFullStick = sig.playersWithFullStick.length > 0
  // Touch is primary unless a REAL (structural) digital stick sits alongside it.
  // A name-only stick (Otomedius' "Player 1 Up" on a P2Button slot) doesn't
  // demote the touch panel; a wired P#ButtonUp stick (WinningEleven08) does.
  const touchPrimary = sig.mentionsTouch && !sig.hasStructuralFullStick
  // Light guns and touch panels share the absolute-pointer (P#LightGun) slot,
  // disambiguated by label. A gun label must sit on an aiming control to count.
  // Checked before spinner/trackball so an auxiliary rotary or ball (e.g. DSPS's
  // "Wheel Rotary Encoder") doesn't outrank the gun that defines the cabinet.
  if (sig.hasLightGunMapping || sig.gunAim) {
    // A "trackball"-labelled pointer is a trackball, not a gun (the profile just
    // reuses the light-gun slot for the ball, e.g. FamilyGuyBowling / GoGoStrike).
    if (sig.gunAim && !sig.mentionsTrackball) return "lightGun"
    if (touchPrimary) return "touchscreen"
    if (sig.mentionsTrackball) return "trackball"
    // A bare pointer with no gun/touch label is a light gun, unless a full
    // digital stick shows the slot is only a secondary aim on a stick game.
    if (!hasFullStick) return "lightGun"
  }
  if (touchPrimary) return "touchscreen"

  if (sig.hasRotaryMapping) return "spinner"
  if (sig.hasTrackballMapping) return sig.mentionsSpinner ? "spinner" : "trackball"
  if (sig.mentionsTrackball && !sig.mentionsSpinner) return "trackball"
  if (sig.mentionsSpinner || sig.mentionsDial) return "spinner"

  // Analog axes win over a digital stick: games like Blazing Angels expose the
  // stick's directions as digital fallbacks, but the analog axis is the control.
  // A Wheel type reused for a plain movement axis (no steering label) is analog.
  if (sig.hasAnalogStick || (sig.hasWheel && !sig.hasSteeringLabel)) return "analogJoystick"
  if (hasFullStick) return "joystick8Way"
  if (sig.playableMappingCount > 0) return "buttons"
  return "unknown"
}

/**
 * Best-effort simultaneous-player count. Player identity from raw bindings is
 * inherently fuzzy (single-panel games sometimes borrow a second player's
 * mapping slots for extra functions), so this leans on the most reliable signal
 * for the game's hardware and falls back progressively:
 *
 *  - light-gun games: distinct gun ports (+ analog "Player N Gun" axes),
 *  - stick games:     distinct players with a directional stick,
 *  - everything else: distinct players that own a Start button,
 *  - final fallback:  1 if the game has any playable control.
 */
export function countPlayers(
  bindings: ControlBinding[],
  sig: ControlSignals,
  scheme: ControlScheme,
): number {
  const distinctKeys = (pred: (m: string) => boolean): number => {
    const keys = new Set<string>()
    for (const b of bindings) {
      if (!pred(b.inputMapping)) continue
      const key = playerKeyOf(b.inputMapping)
      if (key) keys.add(key)
    }
    return keys.size
  }

  if (scheme === "lightGun") {
    const gunPorts = distinctKeys((m) => /^(JvsTwo)?P\d+LightGun$/.test(m))
    const named = new Set<number>()
    for (const b of bindings) {
      const m = /\b(?:player|p)\s*(\d+)\b.*gun/.exec(b.buttonName.toLowerCase())
      if (m) named.add(Number(m[1]))
    }
    return Math.max(gunPorts, named.size, 1)
  }

  if (sig.playersWithFullStick.length > 0) return sig.playersWithFullStick.length
  if (sig.playersWithAnyDirection.length > 0) return sig.playersWithAnyDirection.length

  const starts = distinctKeys((m) => /^(JvsTwo)?P\d+ButtonStart$/.test(m))
  if (starts > 0) return starts

  return sig.playableMappingCount > 0 ? 1 : 0
}

/**
 * Action buttons per player, excluding Start/Coin/Service and the directional
 * stick. Computed as the maximum numeric action-button count across all player
 * keys, since profiles occasionally populate only one player's slots (or split
 * a single player's controls across board slots).
 */
export function countButtonsPerPlayer(
  bindings: ControlBinding[],
  scheme: ControlScheme,
): number | null {
  if (scheme === "keyboard") return null
  const perPlayer = new Map<string, Set<string>>()
  for (const b of bindings) {
    const key = actionButtonOf(b.inputMapping)
    if (!key) continue
    // Skip numeric slots that a profile reuses for a direction or a
    // coin/volume/start function (e.g. Rampage maps "P1 UP" to P1Button1).
    const name = b.buttonName.toLowerCase()
    if (directionFromName(name)) continue
    if (/\b(coin|coins|start|service|test|volume)\b/.test(name)) continue
    let set = perPlayer.get(key)
    if (!set) perPlayer.set(key, (set = new Set()))
    set.add(b.inputMapping)
  }
  let max = 0
  for (const set of perPlayer.values()) max = Math.max(max, set.size)
  return max
}

/** Runs the full classification pipeline over a profile's input bindings. */
export function classifyControls(bindings: ControlBinding[]): ControlClassification {
  const signals = extractSignals(bindings)
  const controlScheme = classifyControlScheme(signals)
  return {
    controlScheme,
    players: countPlayers(bindings, signals, controlScheme),
    buttonsPerPlayer: countButtonsPerPlayer(bindings, controlScheme),
    signals,
  }
}
