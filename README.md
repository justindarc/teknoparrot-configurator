# TeknoParrot Configurator

A cross-platform desktop app for managing and launching TeknoParrot arcade game
profiles.

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------ |
| Shell          | [Electron](https://www.electronjs.org/)                     |
| Build tooling  | [electron-vite](https://electron-vite.org/) (Vite + Rollup) |
| Language       | TypeScript (strict)                                          |
| UI             | React 18 + [MUI](https://mui.com/) 6                         |
| App settings   | [electron-store](https://github.com/sindresorhus/electron-store) |
| XML I/O        | [@xmldom/xmldom](https://github.com/xmldom/xmldom) (in-place DOM round-trip) |
| Packaging      | [electron-builder](https://www.electron.build/)             |

## Project structure

```
src/
├── main/                  # Main process
│   ├── index.ts           #   window lifecycle + protocol registration
│   ├── ipc.ts             #   IPC handlers (the trust boundary)
│   ├── store.ts           #   this app's own settings (electron-store)
│   └── teknoparrot/       #   TeknoParrot data layer (electron-free, unit-testable)
│       ├── paths.ts       #     install detection + path-traversal-safe icon resolve
│       ├── xml.ts         #     BOM-aware XML DOM read/write helpers
│       ├── parrotData.ts  #     ParrotData.xml  <-> GlobalSettings
│       ├── games.ts       #     catalog merge (GameProfiles + UserProfiles + Metadata)
│       ├── userProfile.ts #     UserProfiles/*.xml read + in-place write
│       ├── metadata.ts    #     Metadata/*.json
│       └── iconProtocol.ts#     tpasset:// icon server
├── preload/               # Sandboxed bridge — exposes a typed `window.api`
├── renderer/              # React + MUI frontend
│   └── src/
│       ├── components/    #   GameList, GameDetail, tabs, dialogs, SetupScreen
│       ├── hooks/         #   useSettings, useGames, useNotify
│       ├── util/          #   icon URL helper
│       ├── theme.ts, App.tsx, main.tsx
└── shared/                # Types + IPC contract shared across all processes
    ├── ipc.ts
    ├── types.ts           #   app settings
    └── teknoparrot.ts     #   TeknoParrot domain model
```

## TeknoParrot integration

The app reads and writes TeknoParrot's own on-disk files in place, so changes are
picked up by TeknoParrot itself:

| File                | Purpose                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `ParrotData.xml`    | Global settings (hotkeys, Discord RPC, driving hacks, …)          |
| `UserProfiles/*.xml`| Per-game configuration — `ConfigValues` (grouped, typed) + inputs |
| `GameProfiles/*.xml`| Profile templates + non-configurable flags (emulator, admin, …)   |
| `Metadata/*.json`   | Platform, release year, GPU compatibility, supported versions     |
| `Icons/*.png`       | Game icons, served to the UI via the `tpasset://` protocol        |

Writes **mutate the existing XML DOM** rather than regenerating the document, so
every element TeknoParrot wrote (input bindings, flags, and settings this app
doesn't surface) is preserved byte-for-byte, including the UTF-8 BOM. The parsers
are electron-free and validated against the full data set via
`scripts/validate-parsers.ts`.

## Security model

The scaffold follows Electron's recommended hardening:

- **Context isolation** and **sandbox** are enabled; `nodeIntegration` is off.
- The renderer talks to the main process only through a typed, allow-listed
  `contextBridge` API (`window.api`) — no Node primitives leak into the UI.
- A restrictive **Content Security Policy** is set in `index.html`.
- External links open in the system browser, never inside the app.
- Only a single instance of the app can run at a time.

## Getting started

```bash
npm install      # install dependencies (downloads the Electron binary)
npm run dev      # launch with hot-reload
```

## Scripts

| Script               | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Run the app in development with HMR            |
| `npm run build`      | Type-check and produce a production bundle     |
| `npm run typecheck`  | Type-check node + web configs                  |
| `npm run lint`       | Lint with ESLint                               |
| `npm run format`     | Format the source with Prettier                |
| `npm run pack`       | Build an unpacked app directory (no installer) |
| `npm run dist`       | Build a distributable installer for your OS    |
| `npm run dist:win`   | Build the Windows (NSIS) installer             |
| `npm run dist:win-zip` | Build a portable Windows `.zip` (no installer) |
| `npm run classify`   | Export control-scheme classification to JSON   |

## Building

`npm run dist` builds an installer for the OS you run it on. `npm run dist:win`
targets the Windows NSIS installer specifically, and `npm run dist:win-zip`
produces a portable Windows `.zip` (no installer).

**Build the Windows installer on Windows** (or in Windows CI). The input-capture
feature relies on native modules:

| Module       | Role                                    | Cross-build notes                        |
| ------------ | --------------------------------------- | ---------------------------------------- |
| `koffi`      | DirectInput capture (dinput8.dll COM)   | Ships prebuilt binaries for all platforms — cross-packs fine |
| `node-hid`   | RawInput device enumeration             | `prebuild-install` fetches a **per-platform** binary at `npm install` time |
| `xinput-ffi` | XInput capture (via koffi)              | Inherits koffi's prebuilts               |

Because `node-hid` only pulls the current platform's binary during
`npm install`, a Windows package built on macOS/Linux would ship the wrong
`node-hid` binary and RawInput enumeration would fail at runtime. Cross-building
Windows from macOS also needs `wine` for the NSIS step. Running `npm install`
followed by `npm run dist:win` **on Windows** avoids both problems.

Input capture itself (DirectInput / XInput / RawInput) is Windows-only at
runtime; on other platforms the app still runs and keyboard capture works via the
DOM, but the native APIs are unavailable.

## License

MIT
