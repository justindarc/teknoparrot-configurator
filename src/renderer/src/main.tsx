import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"
import App from "./App"

const container = document.getElementById("root")
if (!container) {
  throw new Error("Root container #root was not found in the document.")
}

function renderApp(): void {
  createRoot(container!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// The bundled @fontsource Roboto faces use `font-display: swap`, so the first
// paint uses fallback-font metrics ("Helvetica Neue"/Arial) and then visibly
// reflows when Roboto swaps in. Preload the weights the UI relies on and hold
// the initial render until they're ready, with a timeout so a font-loading
// failure can never block startup.
function renderWhenFontsReady(): void {
  if (typeof document.fonts?.load !== "function") {
    renderApp()
    return
  }

  const fontsLoaded = Promise.all(
    ["300 1em Roboto", "400 1em Roboto", "500 1em Roboto", "700 1em Roboto"].map((font) =>
      document.fonts.load(font),
    ),
  )
  const timeout = new Promise((resolve) => setTimeout(resolve, 1000))

  void Promise.race([fontsLoaded, timeout]).finally(renderApp)
}

renderWhenFontsReady()
