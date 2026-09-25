export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "outrun-theme";

// Runs before hydration (see ThemeInitScript, strategy="beforeInteractive")
// so the correct theme is on <html> before first paint — no flash of the
// wrong theme. Light is the default; only an explicit "dark" in
// localStorage switches it, so a first-time visitor always sees the
// light theme regardless of their OS preference (docs/outrun/01: light
// grey/white is the baseline, dark is an opt-in).
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (localStorage.getItem("${THEME_STORAGE_KEY}") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();
`;
