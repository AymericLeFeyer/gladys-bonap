import type { MealPlanEntry } from './MealPlanEntry.ts';
import { addDays, toLocalDay } from './nextMeal.ts';

export type Lang = 'en' | 'fr';

/** French for any `fr*` language, English otherwise. */
export function toLang(language: string | undefined): Lang {
  return language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const ENTRY_TYPE_LABELS: Record<string, Record<Lang, string>> = {
  breakfast: { en: 'Breakfast', fr: 'Petit-déjeuner' },
  lunch: { en: 'Lunch', fr: 'Déjeuner' },
  dinner: { en: 'Dinner', fr: 'Dîner' },
  side: { en: 'Side', fr: 'Accompagnement' },
  snack: { en: 'Snack', fr: 'Goûter' },
  dessert: { en: 'Dessert', fr: 'Dessert' },
  drink: { en: 'Drink', fr: 'Boisson' },
};

export function entryTypeLabel(entryType: string, l: Lang): string {
  return ENTRY_TYPE_LABELS[entryType]?.[l] ?? entryType;
}

/** Recipe name, else the free-text title, else the slot label. */
export function mealName(entry: MealPlanEntry, l: Lang): string {
  return entry.recipe?.name || entry.title || entryTypeLabel(entry.entryType, l);
}

/** "Aujourd'hui", "Demain", else "Jeudi 24 septembre". */
export function dayLabel(day: string, now: Date, l: Lang): string {
  if (day === toLocalDay(now)) return l === 'fr' ? "Aujourd'hui" : 'Today';
  if (day === toLocalDay(addDays(now, 1))) return l === 'fr' ? 'Demain' : 'Tomorrow';
  const label = new Date(`${day}T12:00:00`).toLocaleDateString(l, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
