import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, toCSV, detectDelimiter, CsvError } from '../js/core/csv.js';
import { validateDataset, parseNumber } from '../js/core/validate.js';

const read = (name) => readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8');

test('parses quotes, escaped quotes, CRLF and BOM', () => {
  const text = '﻿id,name,note\r\n1,"Жрица, целитель","сказала ""привет"""\r\n2,Маг,\r\n';
  const { columns, rows } = parseCSV(text);
  assert.deepEqual(columns, ['id', 'name', 'note']);
  assert.equal(rows[0].name, 'Жрица, целитель');
  assert.equal(rows[0].note, 'сказала "привет"');
  assert.equal(rows[1].note, '');
});

test('detects semicolon delimiter', () => {
  assert.equal(detectDelimiter('id;name;hp\n1;a;2'), ';');
  assert.equal(detectDelimiter('a\tb\tc'), '\t');
});

test('empty file and unclosed quote are reported, not crashing', () => {
  assert.throws(() => parseCSV(''), CsvError);
  assert.throws(() => parseCSV('id,name\n1,"oops'), CsvError);
});

test('CSV → objects → CSV round trip is lossless', () => {
  const text = read('units.csv');
  const { columns, rows } = parseCSV(text);
  const result = validateDataset('units', columns, rows);
  assert.equal(result.ok, true);
  const again = parseCSV(toCSV(columns, result.rows));
  const result2 = validateDataset('units', again.columns, again.rows);
  assert.deepEqual(result2.rows, result.rows);
});

test('JSON → CSV → JSON keeps types', () => {
  const rows = JSON.parse(read('units.json'));
  const columns = Object.keys(rows[0]);
  const parsed = parseCSV(toCSV(columns, rows));
  assert.deepEqual(validateDataset('units', parsed.columns, parsed.rows).rows, rows);
});

test('parseNumber accepts comma decimals and rejects text', () => {
  assert.equal(parseNumber('24,5'), 24.5);
  assert.equal(parseNumber(' 1 000 '), 1000);
  assert.ok(Number.isNaN(parseNumber('восемьдесят')));
  assert.ok(Number.isNaN(parseNumber('12abc')));
});

test('units_with_errors.csv: every planted error is found', () => {
  const { columns, rows, structural } = parseCSV(read('units_with_errors.csv'));
  const { issues, invalid } = validateDataset('units', columns, rows, structural);
  const messages = issues.map((i) => `${i.index + 1}:${i.column}`);
  assert.ok(messages.includes('3:hp'), 'text in hp');
  assert.ok(messages.includes('5:id'), 'duplicate id');
  assert.ok(messages.includes('6:defense'), 'negative defense');
  assert.ok(messages.includes('7:name'), 'empty name');
  assert.ok(messages.includes('9:cost'), 'short row: required cost is missing');
  assert.ok(messages.includes('11:hp'), 'hp = 0');
  assert.ok(!invalid.has(7), '24,5 is a valid number');
});

test('rows may omit trailing optional values', () => {
  const text = 'id,name,hp,attack,defense,cost,crit_chance,crit_mult\n1,Мечник,120,25,10,100\n5,Маг,70,45,3,150,0.2,1.5\n';
  const { columns, rows, structural } = parseCSV(text);
  assert.equal(structural.length, 0);
  const result = validateDataset('units', columns, rows, structural);
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].crit_chance, '');
  assert.equal(result.rows[1].crit_chance, 0.2);
});

test('extra values beyond the header are reported', () => {
  const { structural } = parseCSV('id,name\n1,a,lost\n');
  assert.equal(structural.length, 1);
  assert.equal(structural[0].index, 0);
});

test('missing required columns are fatal', () => {
  const { fatal } = validateDataset('units', ['id', 'name'], [{ id: 1, name: 'x' }]);
  assert.match(fatal[0], /hp, attack, defense, cost/);
});

test('loot_with_errors.csv: duplicate item, bad number, min > max', () => {
  const { columns, rows } = parseCSV(read('loot_with_errors.csv'));
  const { issues } = validateDataset('loot', columns, rows);
  const messages = issues.map((i) => `${i.index + 1}:${i.column}`);
  assert.ok(messages.includes('9:max_qty'));
  assert.ok(messages.includes('11:item'));
  assert.ok(messages.includes('12:chance'));
});
