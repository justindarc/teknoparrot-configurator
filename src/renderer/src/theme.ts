import { createTheme, type Theme } from "@mui/material/styles"

/**
 * Builds an MUI theme for the requested colour mode. Centralising theme
 * creation keeps palette and typography decisions in one place.
 */
export function buildTheme(mode: "light" | "dark"): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: "#2e7d32" },
      secondary: { main: "#f9a825" },
      ...(mode === "dark"
        ? { background: { default: "#121212", paper: "#1e1e1e" } }
        : { background: { default: "#f5f5f5", paper: "#ffffff" } }),
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
      h6: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
    },
  })
}
