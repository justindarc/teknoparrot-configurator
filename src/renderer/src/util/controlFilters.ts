import type { GameSummary } from "@shared/teknoparrot"
import { CONTROL_SCHEME_LABELS, CONTROL_SCHEMES, type ControlScheme } from "@shared/controlScheme"

/**
 * The Controls view lets the user narrow the game catalog by control scheme
 * (the primary filter) and then optionally by genre, player count and buttons
 * per player. These sub-filters cascade: each one's available options are
 * computed from the games that already match the filters above it, so a user
 * can never land on a combination that matches nothing by accident.
 */
export interface ControlFilters {
  /** "" means no scheme chosen yet (nothing is listed). */
  scheme: ControlScheme | ""
  /** "" means "any genre". */
  genre: string
  /** "any" disables the player-count filter. */
  players: number | "any"
  /** "any" disables the buttons-per-player filter. */
  buttons: number | "any"
}

export const emptyFilters: ControlFilters = {
  scheme: "",
  genre: "",
  players: "any",
  buttons: "any",
}

/** One selectable value plus the number of games it would match. */
export interface FacetOption<T> {
  value: T
  label: string
  count: number
}

/** The option lists for each dropdown, plus the fully-filtered game list. */
export interface ControlFacets {
  schemeOptions: FacetOption<ControlScheme>[]
  genreOptions: FacetOption<string>[]
  playerOptions: FacetOption<number>[]
  buttonOptions: FacetOption<number>[]
  visibleGames: GameSummary[]
}

const playersLabel = (n: number): string => `${n} player${n === 1 ? "" : "s"}`
const buttonsLabel = (n: number): string => `${n} button${n === 1 ? "" : "s"}`

/** Distinct values of `pick` across `games`, with match counts, sorted numerically. */
function countBy<T extends string | number>(
  games: GameSummary[],
  pick: (g: GameSummary) => T | null | undefined,
  label: (v: T) => string,
  sort: (a: T, b: T) => number,
): FacetOption<T>[] {
  const counts = new Map<T, number>()
  for (const g of games) {
    const v = pick(g)
    if (v === null || v === undefined) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => sort(a[0], b[0]))
    .map(([value, count]) => ({ value, label: label(value), count }))
}

/**
 * Computes the dropdown options and the visible game list for the current
 * filter state. Only installed games are considered. Options cascade in the
 * order scheme → genre → players → buttons.
 */
export function computeFacets(installed: GameSummary[], f: ControlFilters): ControlFacets {
  const schemeOptions = countBy(
    installed,
    (g) => g.controlScheme,
    (s) => CONTROL_SCHEME_LABELS[s] ?? s,
    (a, b) => CONTROL_SCHEMES.indexOf(a) - CONTROL_SCHEMES.indexOf(b),
  )

  const afterScheme = f.scheme ? installed.filter((g) => g.controlScheme === f.scheme) : []
  const genreOptions = countBy(
    afterScheme,
    (g) => g.genre,
    (s) => s,
    (a, b) => a.localeCompare(b),
  )

  const afterGenre = f.genre ? afterScheme.filter((g) => g.genre === f.genre) : afterScheme
  const playerOptions = countBy(
    afterGenre,
    (g) => g.players,
    playersLabel,
    (a, b) => a - b,
  )

  const afterPlayers =
    f.players === "any" ? afterGenre : afterGenre.filter((g) => g.players === f.players)
  const buttonOptions = countBy(
    afterPlayers,
    (g) => g.buttonsPerPlayer,
    buttonsLabel,
    (a, b) => a - b,
  )

  const visibleGames =
    f.buttons === "any"
      ? afterPlayers
      : afterPlayers.filter((g) => g.buttonsPerPlayer === f.buttons)

  return { schemeOptions, genreOptions, playerOptions, buttonOptions, visibleGames }
}
