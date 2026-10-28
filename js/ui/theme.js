// Theme switcher: system → light → dark. The choice is a per-viewer convenience in localStorage.

const STORAGE_KEY = 'bps:theme';
const ORDER = ['system', 'light', 'dark'];
const ICONS = { system: '◐', light: '☀', dark: '☾' };
const LABELS = { system: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' };

const themeListeners = new Set();

/** Charts read colors from CSS variables, so they subscribe to re-render on theme change. */
export function onThemeChange(fn) {
  themeListeners.add(fn);
}

function apply(theme, button) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  button.textContent = ICONS[theme];
  button.title = LABELS[theme];
  themeListeners.forEach((fn) => fn());
}

export function initTheme(button) {
  let theme = 'system';
  try {
    theme = localStorage.getItem(STORAGE_KEY) ?? 'system';
  } catch { /* storage may be unavailable */ }
  if (!ORDER.includes(theme)) theme = 'system';
  apply(theme, button);

  button.addEventListener('click', () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* storage may be unavailable */ }
    apply(theme, button);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') apply(theme, button);
  });
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
