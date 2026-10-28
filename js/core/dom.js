// Small DOM helpers so UI modules don't repeat createElement boilerplate.

/**
 * Creates an element: h('button', { class: 'btn', onClick: fn }, 'Text').
 * Props starting with "on" become event listeners, known DOM properties are
 * assigned directly, everything else becomes an attribute.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && !key.includes('-')) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function toast(message, kind = 'info', timeout = 3500) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = h('div', { class: `toast toast--${kind}`, role: 'status' }, message);
  host.append(node);
  setTimeout(() => node.remove(), timeout);
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function fmt(value, digits) {
  if (value === Infinity) return '∞';
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (digits == null) return numberFormat.format(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return debounced;
}

/** Labeled form field: field('Атака', input). */
export function field(label, control, hint) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
}

/** Numeric input bound to a getter/setter; invalid input is highlighted, not saved. */
export function numberInput({ value, onChange, min, max, step = 'any' }) {
  const input = h('input', { class: 'input', type: 'number', value, min, max, step, inputMode: 'decimal' });
  input.addEventListener('input', () => {
    const num = input.valueAsNumber;
    const valid = Number.isFinite(num) && (min == null || num >= min) && (max == null || num <= max);
    input.classList.toggle('input--invalid', !valid);
    if (valid) onChange(num);
  });
  return input;
}

export function select(options, value, onChange) {
  const el = h('select', { class: 'input' },
    options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)),
  );
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

export function badge(text, kind = 'neutral', title) {
  return h('span', { class: `badge badge--${kind}`, title }, text);
}
