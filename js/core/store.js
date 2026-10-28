// Application state with autosave to localStorage and change notifications.
//
// Every change goes through update(); listeners receive the "source" of the change
// so a component can skip re-rendering itself while the user is typing in it.

import { SAMPLE_UNITS, SAMPLE_LOOT } from './samples.js';
import { DEFAULT_COMBAT } from '../domain/damage.js';
import { DEFAULT_PROGRESSION } from '../domain/progression.js';
import { DEFAULT_AUDIT } from '../domain/audit.js';
import { debounce } from './dom.js';

const STORAGE_KEY = 'bps:project:v1';
const SAVE_DELAY_MS = 400;

export const PROJECT_FORMAT = 'balance-progression-studio';
export const PROJECT_VERSION = 1;

function defaultState() {
  return {
    units: structuredClone(SAMPLE_UNITS),
    loot: structuredClone(SAMPLE_LOOT),
    settings: {
      combat: { ...DEFAULT_COMBAT },
      progression: { ...DEFAULT_PROGRESSION },
      audit: { ...DEFAULT_AUDIT },
      ttk: { attackerId: '', targetId: '' },
    },
  };
}

/** Fills in fields missing from older saves or hand-written project files. */
function withDefaults(data) {
  const base = defaultState();
  const dataset = (d, fallback) => (d && Array.isArray(d.columns) && Array.isArray(d.rows) ? d : fallback);
  return {
    units: dataset(data?.units, base.units),
    loot: dataset(data?.loot, base.loot),
    settings: {
      combat: { ...base.settings.combat, ...data?.settings?.combat },
      progression: { ...base.settings.progression, ...data?.settings?.progression },
      audit: { ...base.settings.audit, ...data?.settings?.audit },
      ttk: { ...base.settings.ttk, ...data?.settings?.ttk },
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

let state = load() ?? defaultState();
const listeners = new Set();
const saveListeners = new Set();

const save = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveListeners.forEach((fn) => fn({ ok: true, at: new Date() }));
  } catch (error) {
    saveListeners.forEach((fn) => fn({ ok: false, error }));
  }
}, SAVE_DELAY_MS);

window.addEventListener('beforeunload', () => save.flush());

export function getState() {
  return state;
}

/** Mutates the state via `mutator(state)`, schedules autosave and notifies listeners. */
export function update(mutator, source = null) {
  mutator(state);
  save();
  listeners.forEach((fn) => fn({ source }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onSave(fn) {
  saveListeners.add(fn);
}

export function saveNow() {
  save.flush();
}

export function replaceDataset(type, columns, rows) {
  update((s) => {
    s[type] = { columns: [...columns], rows: rows.map((r) => ({ ...r })) };
  }, 'import');
}

export function exportProject() {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    ...structuredClone(state),
  };
}

export function loadProject(project) {
  update((s) => Object.assign(s, withDefaults(project)), 'import');
}

export function resetToSamples() {
  update((s) => Object.assign(s, defaultState()), 'import');
}
