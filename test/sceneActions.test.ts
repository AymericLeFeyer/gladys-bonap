import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GET_DAY_MEALS_ACTION,
  GET_NEXT_MEAL_ACTION,
  getDayMealsOutputs,
  getNextMealOutputs,
} from '../src/application/scene/sceneActions.ts';
import type { MealPlanEntry } from '../src/domain/meal/MealPlanEntry.ts';

const now = new Date('2026-09-22T15:00:00');

function entry(id: number, date: string, entryType: string, name: string): MealPlanEntry {
  return {
    id,
    date,
    entryType,
    title: '',
    recipe: { id: `r${id}`, slug: name, name, description: '', image: null },
  };
}

const entries = [
  entry(1, '2026-09-22', 'lunch', 'Quiche'),
  entry(2, '2026-09-22', 'dinner', 'Poulet rôti'),
  entry(3, '2026-09-22', 'dinner', 'Salade'),
  entry(4, '2026-09-23', 'lunch', 'Lasagnes'),
];

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
) as { scene_actions: Array<{ key: string; outputs: Array<{ key: string }> }> };
const declaredOutputs = (key: string) =>
  manifest.scene_actions
    .find((a) => a.key === key)
    ?.outputs.map((o) => o.key)
    .sort();

test('get_next_meal returns the next slot with every dish', () => {
  assert.deepEqual(getNextMealOutputs(entries, now, { meal_type: 'any', language: 'fr' }), {
    found: true,
    name: 'Poulet rôti + Salade',
    meal_type: 'Dîner',
    date: '2026-09-22',
    day: "Aujourd'hui",
    summary: "Aujourd'hui · Dîner : Poulet rôti + Salade",
  });
});

test('get_next_meal can target one meal type', () => {
  const outputs = getNextMealOutputs(entries, now, { meal_type: 'lunch', language: 'en' });
  assert.equal(outputs.summary, 'Tomorrow · Lunch: Lasagnes');
});

test('get_next_meal without any planned meal', () => {
  const outputs = getNextMealOutputs([], now, { meal_type: 'any', language: 'fr' });
  assert.equal(outputs.found, false);
  assert.equal(outputs.summary, 'Aucun repas prévu.');
});

test('get_day_meals summarizes one line per slot, past slots included', () => {
  assert.deepEqual(getDayMealsOutputs(entries, now, { day: 'today', language: 'fr' }), {
    count: 3,
    names: 'Quiche, Poulet rôti, Salade',
    summary: 'Déjeuner : Quiche\nDîner : Poulet rôti + Salade',
  });
  assert.equal(
    getDayMealsOutputs(entries, now, { day: 'tomorrow' }).summary,
    'Déjeuner : Lasagnes',
  );
});

test('outputs match the keys declared in the manifest', () => {
  assert.deepEqual(
    Object.keys(getNextMealOutputs(entries, now, {})).sort(),
    declaredOutputs(GET_NEXT_MEAL_ACTION),
  );
  assert.deepEqual(
    Object.keys(getDayMealsOutputs(entries, now, {})).sort(),
    declaredOutputs(GET_DAY_MEALS_ACTION),
  );
  assert.deepEqual(
    Object.keys(getDayMealsOutputs([], now, {})).sort(),
    declaredOutputs(GET_DAY_MEALS_ACTION),
  );
});
