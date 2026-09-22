import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  buildMessageContent,
  parseRecipeImageKey,
  recipeImageKey,
} from '../src/application/widget/common.ts';
import { buildNextMealContent, readMealTypes } from '../src/application/widget/nextMealWidget.ts';
import { buildMealPlanContent, readPlanDays } from '../src/application/widget/mealPlanWidget.ts';
import type { MealPlanEntry } from '../src/domain/meal/MealPlanEntry.ts';
import type { NextMeal } from '../src/domain/meal/nextMeal.ts';

const RECIPE_ID = '0f9e8d7c-6b5a-4321-9fed-cba987654321';
const now = new Date('2026-09-22T15:00:00');

const next: NextMeal = {
  date: '2026-09-22',
  entryType: 'dinner',
  entries: [
    {
      id: 1,
      date: '2026-09-22',
      entryType: 'dinner',
      title: '',
      recipe: {
        id: RECIPE_ID,
        slug: 'poulet-roti',
        name: 'Poulet rôti',
        description: 'Un classique du dimanche.',
        image: 'aB3x',
      },
    },
    { id: 2, date: '2026-09-22', entryType: 'dinner', title: 'Restes', recipe: null },
  ],
};

test('next meal content fits the Gladys widget vocabulary', () => {
  const content = buildNextMealContent(next, now, 'fr', { bonapUrl: 'https://bonap.example.com' });
  assert.deepEqual(validateWidgetContent(content), []);
});

test('next meal content shows day, slot, recipe and free-text entries', () => {
  const content = buildNextMealContent(next, now, 'fr');
  assert.deepEqual(content.components[0], {
    type: 'text',
    variant: 'caption',
    text: "Aujourd'hui · Dîner",
  });
  const list = content.components[1];
  assert.equal(list?.type, 'card-list');
  if (list?.type !== 'card-list') return;
  assert.deepEqual(
    list.items.map((i) => i.title),
    ['Poulet rôti', 'Restes'],
  );
  assert.equal(list.items[0]?.image, recipeImageKey(next.entries[0]!.recipe!));
});

test('http Bonap URLs are never linked (widget links must be https)', () => {
  const content = buildNextMealContent(next, now, 'en', { bonapUrl: 'http://192.168.1.10:3000' });
  assert.equal(
    content.components.some((c) => c.type === 'button'),
    false,
  );
});

test('empty and message states are valid contents', () => {
  assert.deepEqual(validateWidgetContent(buildNextMealContent(null, now, 'fr')), []);
  assert.deepEqual(validateWidgetContent(buildMessageContent({ en: 'x', fr: 'y' }, 'fr')), []);
});

test('image keys match the Gladys pattern and round-trip to the recipe id', () => {
  const key = recipeImageKey(next.entries[0]!.recipe!);
  assert.ok(key);
  assert.match(key, /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.equal(parseRecipeImageKey(key), RECIPE_ID);
  assert.equal(parseRecipeImageKey('something-else'), null);
});

test('the image key changes when Mealie gets a new image', () => {
  const recipe = next.entries[0]!.recipe!;
  assert.notEqual(recipeImageKey(recipe), recipeImageKey({ ...recipe, image: 'zZ9q' }));
  assert.equal(recipeImageKey({ ...recipe, image: null }), undefined);
});

test('widget settings are read defensively', () => {
  assert.deepEqual(readMealTypes({ meal_types: ['dinner', 3] }), ['dinner']);
  assert.deepEqual(readMealTypes({}), []);
  assert.equal(readPlanDays({ days: '5' }), 5);
  assert.equal(readPlanDays({ days: '42' }), 3);
  assert.equal(readPlanDays({}), 3);
});

function planEntry(id: number, date: string, entryType: string, name: string): MealPlanEntry {
  return { id, date, entryType, title: name, recipe: null };
}

test('meal plan widget lists the upcoming meals of the requested days', () => {
  const entries = [
    planEntry(1, '2026-09-22', 'lunch', 'Past lunch'),
    planEntry(2, '2026-09-22', 'dinner', 'Soupe'),
    planEntry(3, '2026-09-23', 'dinner', 'Gratin'),
    planEntry(4, '2026-09-25', 'dinner', 'Too far'),
  ];
  const content = buildMealPlanContent(entries, now, 3, 'fr');
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components.find((c) => c.type === 'card-list');
  assert.ok(list?.type === 'card-list');
  assert.deepEqual(
    list.items.map((i) => [i.title, i.subtitle]),
    [
      ['Soupe', "Aujourd'hui"],
      ['Gratin', 'Demain'],
    ],
  );
});

test('meal plan widget caps the list at 8 rows and says so', () => {
  const entries = Array.from({ length: 10 }, (_, i) =>
    planEntry(i, `2026-09-2${3 + (i % 5)}`, i % 2 ? 'lunch' : 'dinner', `Meal ${i}`),
  );
  const content = buildMealPlanContent(entries, now, 7, 'en');
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(content.components[0], {
    type: 'text',
    variant: 'caption',
    text: 'First 8 of 10 meals',
  });
});

test('meal plan widget empty state', () => {
  const content = buildMealPlanContent([], now, 1, 'fr');
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(content.components[0], {
    type: 'text',
    variant: 'body',
    text: "Aucun repas prévu aujourd'hui.",
  });
});
