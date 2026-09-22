import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNextMeal, toLocalDay } from '../src/domain/meal/nextMeal.ts';
import type { MealPlanEntry } from '../src/domain/meal/MealPlanEntry.ts';

let nextId = 1;
function meal(date: string, entryType: string, name = `${entryType} ${date}`): MealPlanEntry {
  return {
    id: nextId++,
    date,
    entryType,
    title: '',
    recipe: { id: `id-${nextId}`, slug: name, name, description: '', image: null },
  };
}

const at = (iso: string) => new Date(iso);

test('toLocalDay formats the local day', () => {
  assert.equal(toLocalDay(at('2026-09-22T08:05:00')), '2026-09-22');
});

test('returns null when nothing is planned', () => {
  assert.equal(findNextMeal([], at('2026-09-22T08:00:00')), null);
});

test('picks lunch in the morning, dinner in the afternoon', () => {
  const entries = [meal('2026-09-22', 'dinner'), meal('2026-09-22', 'lunch')];
  assert.equal(findNextMeal(entries, at('2026-09-22T09:00:00'))?.entryType, 'lunch');
  assert.equal(findNextMeal(entries, at('2026-09-22T15:00:00'))?.entryType, 'dinner');
});

test('a meal stays "next" until its slot is over', () => {
  const entries = [meal('2026-09-22', 'dinner')];
  assert.equal(findNextMeal(entries, at('2026-09-22T20:30:00'))?.entryType, 'dinner');
  assert.equal(findNextMeal(entries, at('2026-09-22T21:30:00')), null);
});

test('moves to the following days once today is over', () => {
  const entries = [
    meal('2026-09-22', 'dinner'),
    meal('2026-09-24', 'lunch'),
    meal('2026-09-23', 'dinner'),
  ];
  const next = findNextMeal(entries, at('2026-09-22T22:00:00'));
  assert.deepEqual([next?.date, next?.entryType], ['2026-09-23', 'dinner']);
});

test('ignores past days', () => {
  const entries = [meal('2026-09-21', 'dinner'), meal('2026-09-25', 'lunch')];
  assert.equal(findNextMeal(entries, at('2026-09-22T08:00:00'))?.date, '2026-09-25');
});

test('groups every entry of the same slot', () => {
  const entries = [meal('2026-09-22', 'dinner', 'Soup'), meal('2026-09-22', 'dinner', 'Salad')];
  const next = findNextMeal(entries, at('2026-09-22T15:00:00'));
  assert.deepEqual(
    next?.entries.map((e) => e.recipe?.name),
    ['Soup', 'Salad'],
  );
});
