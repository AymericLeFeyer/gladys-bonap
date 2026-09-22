// Scene actions declared in the manifest (`scene_actions`). Pure builders: the
// handler in index.ts fetches the meal plan, these turn it into the declared
// outputs (flat scalars, reusable as variables by the following scene actions,
// e.g. "send a message": "Ce soir : {{…summary}}").

import type { SceneActionOutputs } from '@gladysassistant/integration-sdk';
import type { MealPlanEntry } from '../../domain/meal/MealPlanEntry.ts';
import { dayLabel, entryTypeLabel, mealName, toLang, type Lang } from '../../domain/meal/labels.ts';
import { addDays, findNextMeal, mealsOfDay, toLocalDay } from '../../domain/meal/nextMeal.ts';

export const GET_NEXT_MEAL_ACTION = 'get_next_meal';
export const GET_DAY_MEALS_ACTION = 'get_day_meals';

function fieldLang(fields: Record<string, unknown>): Lang {
  return toLang(typeof fields.language === 'string' ? fields.language : 'fr');
}

/** French puts a space before the colon, English does not. */
function colon(l: Lang): string {
  return l === 'fr' ? ' : ' : ': ';
}

function joinNames(entries: MealPlanEntry[], l: Lang): string {
  return entries.map((e) => mealName(e, l)).join(' + ');
}

/**
 * Fields: `meal_type` ("any" or a Mealie entry type), `language` (fr | en).
 * Outputs: found, name, meal_type, date, day, summary.
 */
export function getNextMealOutputs(
  entries: MealPlanEntry[],
  now: Date,
  fields: Record<string, unknown>,
): SceneActionOutputs {
  const l = fieldLang(fields);
  const type =
    typeof fields.meal_type === 'string' && fields.meal_type !== 'any' ? fields.meal_type : null;
  const next = findNextMeal(entries, now, type ? [type] : []);
  if (!next) {
    return {
      found: false,
      name: '',
      meal_type: '',
      date: '',
      day: '',
      summary: l === 'fr' ? 'Aucun repas prévu.' : 'No meal planned.',
    };
  }
  const name = joinNames(next.entries, l);
  const day = dayLabel(next.date, now, l);
  const mealType = entryTypeLabel(next.entryType, l);
  return {
    found: true,
    name,
    meal_type: mealType,
    date: next.date,
    day,
    summary: `${day} · ${mealType}${colon(l)}${name}`,
  };
}

/**
 * Fields: `day` (today | tomorrow), `language` (fr | en).
 * Outputs: count, names, summary (one "Slot : name" line per slot).
 */
export function getDayMealsOutputs(
  entries: MealPlanEntry[],
  now: Date,
  fields: Record<string, unknown>,
): SceneActionOutputs {
  const l = fieldLang(fields);
  const day = toLocalDay(fields.day === 'tomorrow' ? addDays(now, 1) : now);
  const meals = mealsOfDay(entries, day);
  if (meals.length === 0) {
    return {
      count: 0,
      names: '',
      summary: l === 'fr' ? 'Aucun repas prévu.' : 'No meal planned.',
    };
  }

  const bySlot = new Map<string, MealPlanEntry[]>();
  for (const meal of meals)
    bySlot.set(meal.entryType, [...(bySlot.get(meal.entryType) ?? []), meal]);
  const lines = [...bySlot].map(
    ([entryType, slotMeals]) =>
      `${entryTypeLabel(entryType, l)}${colon(l)}${joinNames(slotMeals, l)}`,
  );

  return {
    count: meals.length,
    names: meals.map((e) => mealName(e, l)).join(', '),
    summary: lines.join('\n'),
  };
}
