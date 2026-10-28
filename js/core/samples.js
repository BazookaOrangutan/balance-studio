// Data shown on first launch (from the case description), so every tab works immediately.

export const SAMPLE_UNITS = {
  columns: ['id', 'name', 'hp', 'attack', 'defense', 'cost'],
  rows: [
    { id: 1, name: 'Мечник', hp: 120, attack: 25, defense: 10, cost: 100 },
    { id: 2, name: 'Копейщик', hp: 100, attack: 30, defense: 8, cost: 110 },
    { id: 3, name: 'Лучник', hp: 80, attack: 35, defense: 5, cost: 120 },
    { id: 4, name: 'Рыцарь', hp: 180, attack: 20, defense: 20, cost: 200 },
    { id: 5, name: 'Маг', hp: 70, attack: 45, defense: 3, cost: 150 },
  ],
};

export const SAMPLE_LOOT = {
  columns: ['table', 'item', 'chance', 'min_qty', 'max_qty'],
  rows: [
    { table: 'goblin', item: 'Ничего', chance: 40, min_qty: 0, max_qty: 0 },
    { table: 'goblin', item: 'Золото', chance: 45, min_qty: 5, max_qty: 15 },
    { table: 'goblin', item: 'Зелье лечения', chance: 12, min_qty: 1, max_qty: 1 },
    { table: 'goblin', item: 'Ржавый кинжал', chance: 3, min_qty: 1, max_qty: 1 },
    { table: 'boss_chest', item: 'Золото', chance: 50, min_qty: 100, max_qty: 200 },
    { table: 'boss_chest', item: 'Редкий меч', chance: 30, min_qty: 1, max_qty: 1 },
    { table: 'boss_chest', item: 'Эпический щит', chance: 15, min_qty: 1, max_qty: 1 },
    { table: 'boss_chest', item: 'Легендарное кольцо', chance: 5, min_qty: 1, max_qty: 1 },
  ],
};
