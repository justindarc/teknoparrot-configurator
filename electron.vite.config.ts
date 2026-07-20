import { resolve } from "node:path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"

const sharedAlias = { "@shared": resolve(__dirname, "src/shared") }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
      },
    },
  },
  preload: {
    // The preload runs sandboxed, so it can only require Electron built-ins at
    // runtime. Any other dependency must be bundled in rather than externalized.
    plugins: [externalizeDepsPlugin({ exclude: ["@electron-toolkit/preload"] })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
        ...sharedAlias,
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") },
      },
    },
    plugins: [react()],
  },
})
