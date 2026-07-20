/* Standalone validation of the TeknoParrot parsers against the bundled data. */
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateInstall } from "../src/main/teknoparrot/paths"
import { readGlobalSettings, writeGlobalSettings } from "../src/main/teknoparrot/parrotData"
import { listGames } from "../src/main/teknoparrot/games"
import { readGameConfig, writeGameConfig } from "../src/main/teknoparrot/userProfile"
import { fieldKey } from "../src/shared/teknoparrot"

const ROOT = join(process.cwd(), "TeknoParrot")

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error("ASSERT FAILED: " + msg)
}

console.log("== validateInstall ==")
const info = validateInstall(ROOT)
console.log(info)
assert(info.valid, "install should be valid")

console.log("\n== global settings ==")
const gs = readGlobalSettings(ROOT)
console.log({ language: gs.language, silentMode: gs.silentMode, exitGameKey: gs.exitGameKey })
assert(typeof gs.silentMode === "boolean", "silentMode is boolean")

console.log("\n== catalog ==")
const games = listGames(ROOT)
const installed = games.filter((g) => g.installed)
const withIcon = games.filter((g) => g.iconFile)
const withMeta = games.filter((g) => g.metadata)
console.log(
  "total:",
  games.length,
  "installed:",
  installed.length,
  "withIcon:",
  withIcon.length,
  "withMeta:",
  withMeta.length,
)
assert(games.length > 500, "should list >500 games")
console.log(
  "sample:",
  JSON.stringify(
    games.find((g) => g.profileName === "acedriv3"),
    null,
    2,
  ),
)

console.log("\n== read every installed config (fields + inputs) ==")
let totalFields = 0
let totalInputs = 0
let failures = 0
for (const g of installed) {
  try {
    const cfg = readGameConfig(ROOT, g.profileName)
    totalFields += cfg.fields.length
    totalInputs += cfg.inputs.length
    for (const f of cfg.fields) {
      assert(typeof f.name === "string", `${g.profileName} field name`)
      assert(f.type, `${g.profileName} field type`)
    }
  } catch (e) {
    failures++
    if (failures <= 5) console.log("  FAIL", g.profileName, (e as Error).message)
  }
}
console.log(
  "configs read:",
  installed.length - failures,
  "failures:",
  failures,
  "totalFields:",
  totalFields,
  "totalInputs:",
  totalInputs,
)
assert(failures === 0, "no config read failures")

console.log("\n== round-trip write test (isolated temp copy) ==")
const tmp = mkdtempSync(join(tmpdir(), "tp-"))
for (const sub of ["UserProfiles", "GameProfiles", "Metadata"]) mkdirSync(join(tmp, sub))
copyFileSync(join(ROOT, "ParrotData.xml"), join(tmp, "ParrotData.xml"))
const sample = "acedriv3"
copyFileSync(
  join(ROOT, "UserProfiles", sample + ".xml"),
  join(tmp, "UserProfiles", sample + ".xml"),
)
copyFileSync(
  join(ROOT, "GameProfiles", sample + ".xml"),
  join(tmp, "GameProfiles", sample + ".xml"),
)

// Mutate one field and GamePath, then confirm it round-trips and other fields survive.
const before = readGameConfig(tmp, sample)
const target = before.fields.find((f) => f.type === "Bool")!
const key = fieldKey(target.category, target.name)
const newVal = target.value === "1" ? "0" : "1"
const beforeCount = before.fields.length
const beforeInputs = before.inputs.length
writeGameConfig(tmp, {
  profileName: sample,
  gamePath: "X:\\test\\game.exe",
  fieldValues: { [key]: newVal },
})
const after = readGameConfig(tmp, sample)
assert(after.gamePath === "X:\\test\\game.exe", "gamePath updated")
assert(
  after.fields.find((f) => fieldKey(f.category, f.name) === key)!.value === newVal,
  "field updated",
)
assert(after.fields.length === beforeCount, "no fields lost")
assert(
  after.inputs.length === beforeInputs,
  "inputs preserved: " + after.inputs.length + " vs " + beforeInputs,
)
console.log(
  "field/gamepath round-trip OK; fields:",
  after.fields.length,
  "inputs:",
  after.inputs.length,
)

// Global settings round-trip.
const gsBefore = readGlobalSettings(tmp)
writeGlobalSettings(tmp, { ...gsBefore, silentMode: !gsBefore.silentMode, language: "jp" })
const gsAfter = readGlobalSettings(tmp)
assert(gsAfter.silentMode === !gsBefore.silentMode, "silentMode toggled")
assert(gsAfter.language === "jp", "language updated")
// Ensure unrelated element preserved (SegaId is not in our map).
const rawAfter = readFileSync(join(tmp, "ParrotData.xml"), "utf8")
assert(rawAfter.includes("<SegaId>"), "unmapped element SegaId preserved")
console.log("global settings round-trip OK; SegaId preserved:", rawAfter.includes("<SegaId>"))

console.log("\nALL CHECKS PASSED ✅")
