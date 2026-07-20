/**
 * Value helpers for TeknoParrot's Bool fields, which are stored as either
 * "1"/"0" or "true"/"false" depending on the profile. Shared by the per-game
 * settings tab and the bulk settings editor so both speak the same vocabulary.
 */

/** True when a Bool field's raw value represents "on". */
export function isBoolOn(value: string): boolean {
  return value === "1" || value.toLowerCase() === "true"
}

/** Emits a Bool value in the same vocabulary the field already used. */
export function boolValue(previous: string, next: boolean): string {
  const usesWords = previous.toLowerCase() === "true" || previous.toLowerCase() === "false"
  if (usesWords) return next ? "true" : "false"
  return next ? "1" : "0"
}
