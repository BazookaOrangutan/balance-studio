// Dataset schemas: which columns are required, numeric, and how rows are keyed.

export const SCHEMAS = {
  units: {
    label: 'Юниты',
    key: ['id'],
    keyLabel: 'id',
    required: ['id', 'name', 'hp', 'attack', 'defense', 'cost'],
    optional: ['crit_chance', 'crit_mult', 'attack_speed'],
    numeric: ['hp', 'attack', 'defense', 'cost', 'crit_chance', 'crit_mult', 'attack_speed'],
    ranges: {
      hp: { min: 1 },
      attack: { min: 0 },
      defense: { min: 0 },
      cost: { min: 0 },
      crit_chance: { min: 0, max: 1 },
      crit_mult: { min: 1 },
      attack_speed: { min: 0.01 },
    },
    descriptions: {
      id: 'уникальный идентификатор',
      name: 'название',
      hp: 'здоровье, ≥ 1',
      attack: 'атака, ≥ 0',
      defense: 'защита, ≥ 0',
      cost: 'цена, ≥ 0',
      crit_chance: 'шанс крита 0…1 (необязательно)',
      crit_mult: 'множитель крита ≥ 1 (необязательно)',
      attack_speed: 'атак в секунду (необязательно)',
    },
  },
  loot: {
    label: 'Лут',
    key: ['table', 'item'],
    keyLabel: 'пары table/item',
    required: ['table', 'item', 'chance'],
    optional: ['min_qty', 'max_qty'],
    numeric: ['chance', 'min_qty', 'max_qty'],
    ranges: {
      chance: { min: 0, max: 100 },
      min_qty: { min: 0 },
      max_qty: { min: 0 },
    },
    descriptions: {
      table: 'имя таблицы дропа (сундук, моб)',
      item: 'предмет; «ничего» тоже строка',
      chance: 'вероятность в %, сумма по таблице = 100',
      min_qty: 'мин. количество (необязательно)',
      max_qty: 'макс. количество (необязательно)',
    },
  },
};

export const DATASET_TYPES = Object.keys(SCHEMAS);

/** Guesses the dataset type from column names, or returns null. */
export function detectDatasetType(columns) {
  const set = new Set(columns.map((c) => c.toLowerCase()));
  if (set.has('chance') && set.has('item')) return 'loot';
  if (set.has('hp') || set.has('attack')) return 'units';
  return null;
}

/** Renames schema columns written in another case ("HP" → "hp"); other columns stay as is. */
export function canonicalizeColumns(columns, type) {
  const schema = SCHEMAS[type];
  const known = [...schema.required, ...schema.optional];
  return columns.map((column) => known.find((k) => k === column.trim().toLowerCase()) ?? column.trim());
}
