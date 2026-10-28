// Tab 3 — damage / TTK calculator: step-by-step breakdown, simulation check and TTK matrix.

import { h, clear, fmt, field, numberInput, select, badge } from '../core/dom.js';
import { getState, update } from '../core/store.js';
import { validRows } from '../core/validate.js';
import { downloadCSV } from '../core/io.js';
import { computeTTK, simulateTTK, duel } from '../domain/damage.js';

const SIMULATION_RUNS = 10000;

const sec = (v) => (v === Infinity ? 'никогда (урон 0)' : `${fmt(v)} с`);
const hits = (v) => (v === Infinity ? '∞' : fmt(v));

export function createTtkTab() {
  const settingsCard = h('div', { class: 'card' });
  const resultCard = h('div', { class: 'card' });
  const matrixCard = h('div', { class: 'card' });

  const units = () => validRows('units', getState().units);
  const findUnit = (list, id) => list.find((u) => String(u.id) === String(id));

  /** Keeps the selected pair valid when units are deleted or re-imported. */
  function selection(list) {
    const ttk = getState().settings.ttk;
    const attacker = findUnit(list, ttk.attackerId) ?? list[0];
    const target = findUnit(list, ttk.targetId) ?? list.find((u) => u !== attacker) ?? list[0];
    return { attacker, target };
  }

  function setPair(attackerId, targetId) {
    update((s) => {
      s.settings.ttk.attackerId = attackerId;
      s.settings.ttk.targetId = targetId;
    }, 'ttk');
    renderSettings();
    renderResult();
    renderMatrix();
  }

  function setCombat(key, value) {
    update((s) => { s.settings.combat[key] = value; }, 'ttk');
    renderResult();
    renderMatrix();
  }

  function renderSettings() {
    const list = units();
    const c = getState().settings.combat;
    clear(settingsCard).append(h('h2', {}, 'Пара и параметры'));
    if (list.length < 1) {
      settingsCard.append(h('div', { class: 'alert alert--warn' }, 'Нет корректных юнитов. Импортируйте данные или исправьте ошибки во вкладке «Таблица».'));
      return;
    }
    const { attacker, target } = selection(list);
    const options = list.map((u) => ({ value: u.id, label: `${u.name} (#${u.id})` }));
    const attackerSelect = select(options, attacker.id, (v) => setPair(v, target.id));
    const targetSelect = select(options, target.id, (v) => setPair(attacker.id, v));

    settingsCard.append(
      h('div', { class: 'versus', style: 'margin-bottom:16px' },
        field('Атакующий', attackerSelect),
        h('button', { class: 'btn btn--ghost btn--icon', title: 'Поменять местами', onClick: () => {
          setPair(target.id, attacker.id);
        } }, '⇄'),
        field('Цель', targetSelect),
      ),
      h('h3', {}, 'Формула'),
      h('div', { class: 'fields-2', style: 'margin-top:8px' },
        field('Множитель урона M', numberInput({ value: c.multiplier, min: 0, onChange: (v) => setCombat('multiplier', v) })),
        field('Мин. доля урона k', numberInput({ value: c.minDamageRatio, min: 0, max: 1, onChange: (v) => setCombat('minDamageRatio', v) }), 'урон ≥ A × k'),
      ),
      h('h3', {}, 'Значения по умолчанию'),
      h('p', { class: 'hint' }, 'Используются, если у юнита нет колонок crit_chance, crit_mult, attack_speed.'),
      h('div', { class: 'fields-2', style: 'margin-top:8px' },
        field('Шанс крита (0…1)', numberInput({ value: c.critChance, min: 0, max: 1, onChange: (v) => setCombat('critChance', v) })),
        field('Множитель крита', numberInput({ value: c.critMult, min: 1, onChange: (v) => setCombat('critMult', v) })),
        field('Атак в секунду', numberInput({ value: c.attackSpeed, min: 0.01, onChange: (v) => setCombat('attackSpeed', v) })),
      ),
    );
  }

  function step(title, formula, value) {
    return h('li', {}, title, ': ', h('span', { class: 'value' }, value), h('span', { class: 'formula' }, formula));
  }

  function renderResult() {
    const list = units();
    clear(resultCard).append(h('h2', {}, 'Расчёт'));
    if (!list.length) return;
    const { attacker, target } = selection(list);
    const settings = getState().settings.combat;
    const r = computeTTK(attacker, target, settings);
    const sim = simulateTTK(attacker, target, settings, { runs: SIMULATION_RUNS });
    const d = duel(attacker, target, settings);
    const a = r.attacker;

    const winner = d.winner === 'a' ? attacker.name : d.winner === 'b' ? target.name : null;

    resultCard.append(
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'TTK (ожидаемый)'), h('div', { class: 'stat__value' }, sec(r.ttkExpected))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Ударов'), h('div', { class: 'stat__value' }, hits(r.hitsExpected))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Урон за удар'), h('div', { class: 'stat__value' }, fmt(r.expected))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'DPS'), h('div', { class: 'stat__value' }, fmt(r.dps))),
      ),
      h('ol', { class: 'calc-steps' },
        step('Базовый урон',
          `max(A − D, A × k) × M = max(${a.attack} − ${r.target.defense}, ${a.attack} × ${settings.minDamageRatio}) × ${settings.multiplier} = max(${fmt(r.rawDiff)}, ${fmt(r.floor)}) × ${settings.multiplier}`,
          fmt(r.base)),
        step('Урон крита',
          `база × critMult = ${fmt(r.base)} × ${a.critMult}`,
          fmt(r.crit)),
        step('Ожидаемый урон за удар',
          `база × (1 + crit × (critMult − 1)) = ${fmt(r.base)} × (1 + ${a.critChance} × (${a.critMult} − 1))`,
          fmt(r.expected)),
        step('Ударов до убийства',
          `ceil(HP / урон) = ceil(${r.target.hp} / ${fmt(r.expected)})`,
          hits(r.hitsExpected)),
        step('Время до убийства (TTK)',
          `удары / атак в секунду = ${hits(r.hitsExpected)} / ${a.attackSpeed}`,
          sec(r.ttkExpected)),
        step('Разброс из-за критов',
          `все удары критуют: ${hits(r.hitsBest)} ударов; ни одного крита: ${hits(r.hitsWorst)} ударов`,
          `${sec(r.ttkBest)} … ${sec(r.ttkWorst)}`),
        step(`Проверка симуляцией (${fmt(sim.runs)} боёв, каждый крит бросается отдельно)`,
          `P10 = ${sec(sim.p10)}, медиана = ${sec(sim.p50)}, P90 = ${sec(sim.p90)}`,
          `среднее ${sec(sim.mean)}`),
      ),
      h('p', { style: 'margin-top:14px' },
        'Дуэль: ', h('b', {}, attacker.name), ` убивает за ${sec(d.aToB.ttkExpected)}, `,
        h('b', {}, target.name), ` — за ${sec(d.bToA.ttkExpected)}. `,
        winner ? badge(`Побеждает: ${winner}`, 'ok') : badge('Ничья', 'neutral')),
      h('p', { class: 'hint' },
        'Ожидаемое число ударов считается по среднему урону, поэтому может отличаться от среднего симуляции на один удар — это нормально: ceil(HP / средний урон) ≠ среднее от ceil.'),
    );
  }

  function renderMatrix() {
    const list = units();
    clear(matrixCard);
    if (list.length < 2) return;
    const settings = getState().settings.combat;
    const { attacker, target } = selection(list);

    const cells = list.map((a) => list.map((t) => (a === t ? null : computeTTK(a, t, settings).ttkExpected)));
    const finite = cells.flat().filter((v) => v != null && Number.isFinite(v));
    const min = Math.min(...finite);
    const max = Math.max(...finite);

    const color = (v) => {
      if (v === Infinity) return 'var(--error-bg)';
      const t = max > min ? (v - min) / (max - min) : 0;
      return `color-mix(in srgb, var(--ok-bg) ${Math.round((1 - t) * 100)}%, var(--error-bg))`;
    };

    const exportMatrix = () => {
      const columns = ['attacker', ...list.map((u) => u.name)];
      const rows = list.map((a, i) => ({ attacker: a.name, ...Object.fromEntries(list.map((t, j) => [t.name, cells[i][j] == null ? '' : cells[i][j]])) }));
      downloadCSV('ttk_matrix', columns, rows);
    };

    matrixCard.append(
      h('div', { class: 'card__head' },
        h('h2', {}, 'Матрица TTK, с'),
        h('button', { class: 'btn btn--ghost btn--small', onClick: exportMatrix }, 'Экспорт CSV'),
      ),
      h('p', { class: 'muted' }, 'Строка — атакующий, колонка — цель. Зелёный — убивает быстро, красный — долго. Клик по ячейке выбирает пару.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table matrix' },
        h('thead', {}, h('tr', {}, h('th', {}, 'атакует ↓ / цель →'), list.map((u) => h('th', {}, u.name)))),
        h('tbody', {}, list.map((a, i) => h('tr', {},
          h('th', {}, a.name),
          list.map((t, j) => {
            const v = cells[i][j];
            if (v == null) return h('td', { class: 'matrix__self' }, '—');
            const selected = a === attacker && t === target;
            return h('td', {
              class: selected ? 'matrix__selected' : '',
              style: `background:${color(v)}`,
              title: `${a.name} → ${t.name}`,
              onClick: () => {
                setPair(a.id, t.id);
              },
            }, v === Infinity ? '∞' : fmt(v, 1));
          }),
        ))),
      )),
    );
  }

  return {
    id: 'ttk',
    title: 'TTK',
    mount(panel) {
      panel.append(h('div', { class: 'stack' },
        h('div', { class: 'grid grid--sidebar' }, settingsCard, resultCard),
        matrixCard,
        h('div', { class: 'card' },
          h('h2', {}, 'Почему такая формула'),
          h('p', {}, h('code', {}, 'урон = max(A − D, A × k) × M'), ' — вычитание защиты легко читать: каждая единица защиты блокирует единицу урона, дизайнер сразу видит эффект изменения стата.'),
          h('p', {}, 'Нижняя граница ', h('code', {}, 'A × k'), ' (по умолчанию 10% атаки) не даёт урону упасть до нуля, когда защита цели выше атаки — иначе слабый юнит никогда не убьёт танка и TTK станет бесконечным.'),
          h('p', {}, 'Криты учитываются через ожидаемое значение: ', h('code', {}, '1 + шанс × (множитель − 1)'), '. Это среднее по большому числу ударов; симуляция ниже расчёта проверяет, что оценка близка к реальности.'),
        ),
      ));
    },
    render() {
      renderSettings();
      renderResult();
      renderMatrix();
    },
  };
}
