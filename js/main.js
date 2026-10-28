// Entry point: builds tabs, wires header actions, theme and hotkeys.

import { h, toast } from './core/dom.js';
import { subscribe, onSave, saveNow, exportProject } from './core/store.js';
import { downloadJSON } from './core/io.js';
import { createImportTab } from './ui/importTab.js';
import { createTableTab } from './ui/tableTab.js';
import { createTtkTab } from './ui/ttkTab.js';
import { createProgressionTab } from './ui/progressionTab.js';
import { createLootTab } from './ui/lootTab.js';
import { initTheme } from './ui/theme.js';

const TAB_STORAGE_KEY = 'bps:active-tab';

const tabs = [createImportTab(), createTableTab(), createTtkTab(), createProgressionTab(), createLootTab()];
let activeTab = null;

function readStoredTab() {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  const panels = document.getElementById('panels');

  tabs.forEach((tab, index) => {
    tab.button = h('button', {
      class: 'tab', role: 'tab', id: `tab-${tab.id}`, 'aria-controls': `panel-${tab.id}`,
      onClick: () => showTab(tab.id),
    }, tab.title, h('span', { class: 'tab__key' }, `Alt+${index + 1}`));
    tab.panel = h('section', { class: 'tab-panel', role: 'tabpanel', id: `panel-${tab.id}`, 'aria-labelledby': `tab-${tab.id}`, hidden: true });
    nav.append(tab.button);
    panels.append(tab.panel);
    tab.mount(tab.panel);
  });
}

export function showTab(id) {
  const next = tabs.find((t) => t.id === id) ?? tabs[0];
  for (const tab of tabs) {
    const selected = tab === next;
    tab.button.setAttribute('aria-selected', String(selected));
    tab.panel.hidden = !selected;
  }
  activeTab = next;
  next.render();
  try {
    localStorage.setItem(TAB_STORAGE_KEY, next.id);
  } catch { /* per-viewer convenience only */ }
}

function exportWholeProject() {
  downloadJSON('balance_project', exportProject());
  toast('Проект экспортирован в JSON', 'ok');
}

function initSaveStatus() {
  const status = document.getElementById('save-status');
  onSave(({ ok, at, error }) => {
    if (ok) status.textContent = `Сохранено ${at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    else {
      status.textContent = 'Ошибка сохранения';
      toast(`Не удалось сохранить в localStorage: ${error.message}`, 'error', 6000);
    }
  });
}

function isTyping(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function initHotkeys() {
  const help = document.getElementById('help-dialog');
  document.getElementById('btn-help').addEventListener('click', () => help.showModal());
  document.getElementById('btn-export-project').addEventListener('click', exportWholeProject);

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.altKey && /^Digit[1-9]$/.test(event.code)) {
      const tab = tabs[Number(event.code.slice(5)) - 1];
      if (tab) {
        event.preventDefault();
        showTab(tab.id);
      }
    } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
      event.preventDefault();
      saveNow();
      toast('Сохранено', 'ok', 1500);
    } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyE') {
      event.preventDefault();
      exportWholeProject();
    } else if (event.altKey && event.code === 'KeyN') {
      event.preventDefault();
      activeTab?.addRow?.();
    } else if (key === '?' && !isTyping(event)) {
      help.showModal();
    }
  });
}

buildTabs();
initTheme(document.getElementById('btn-theme'));
initSaveStatus();
initHotkeys();
subscribe(({ source }) => {
  if (activeTab && source !== activeTab.id) activeTab.render();
});
showTab(readStoredTab());
