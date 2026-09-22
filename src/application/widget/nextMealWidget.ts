import { createHash } from 'node:crypto';
import type { WidgetCardListItem, WidgetContent } from '@gladysassistant/integration-sdk';
import type { MealRecipe } from '../../domain/meal/MealPlanEntry.ts';
import { addDays, toLocalDay, type NextMeal } from '../../domain/meal/nextMeal.ts';
import type { Message } from '../stack/reconcileStack.ts';

export const NEXT_MEAL_WIDGET = 'next_meal';

/** The meal plan changes rarely: re-pulled every 15 min (plus nudges). */
const TTL_SECONDS = 900;
const TITLE_MAX = 60;

type Lang = 'en' | 'fr';

const ENTRY_TYPE_LABELS: Record<string, Message> = {
  breakfast: { en: 'Breakfast', fr: 'Petit-déjeuner' },
  lunch: { en: 'Lunch', fr: 'Déjeuner' },
  dinner: { en: 'Dinner', fr: 'Dîner' },
  side: { en: 'Side', fr: 'Accompagnement' },
  snack: { en: 'Snack', fr: 'Goûter' },
  dessert: { en: 'Dessert', fr: 'Dessert' },
  drink: { en: 'Drink', fr: 'Boisson' },
};

const NOTHING_PLANNED: Message = {
  en: 'No meal planned for the next 7 days.',
  fr: 'Aucun repas prévu dans les 7 prochains jours.',
};

function lang(language: string | undefined): Lang {
  return language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function entryTypeLabel(entryType: string, l: Lang): string {
  return ENTRY_TYPE_LABELS[entryType]?.[l] ?? entryType;
}

function dayLabel(day: string, now: Date, l: Lang): string {
  if (day === toLocalDay(now)) return l === 'fr' ? "Aujourd'hui" : 'Today';
  if (day === toLocalDay(addDays(now, 1))) return l === 'fr' ? 'Demain' : 'Tomorrow';
  const label = new Date(`${day}T12:00:00`).toLocaleDateString(l, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Image keys must match `^[a-z0-9][a-z0-9-]{0,63}$` and change when the bytes
 * change (the core caches an image one hour per key): recipe id + a hash of
 * Mealie's image id, which changes on every upload.
 */
export function recipeImageKey(recipe: MealRecipe): string | undefined {
  if (!recipe.image || !/^[0-9a-f-]{36}$/i.test(recipe.id)) return undefined;
  const version = createHash('sha1').update(recipe.image).digest('hex').slice(0, 8);
  return `r-${recipe.id.toLowerCase()}-${version}`;
}

/** Recipe id carried by a key built by recipeImageKey, null otherwise. */
export function parseRecipeImageKey(key: string): string | null {
  return /^r-([0-9a-f-]{36})-[0-9a-f]{8}$/.exec(key)?.[1] ?? null;
}

/** Plain message content (not configured, Mealie unreachable…). */
export function buildMessageContent(message: Message, language: string | undefined): WidgetContent {
  return {
    ttl_seconds: 60,
    components: [{ type: 'text', variant: 'body', text: message[lang(language)] }],
  };
}

export function buildNextMealContent(
  next: NextMeal | null,
  now: Date,
  language: string | undefined,
  { bonapUrl }: { bonapUrl?: string } = {},
): WidgetContent {
  const l = lang(language);
  if (!next) return { ...buildMessageContent(NOTHING_PLANNED, language), ttl_seconds: TTL_SECONDS };

  // Widget links must be https: a LAN http:// Bonap cannot be linked.
  const bonapLink = bonapUrl?.startsWith('https://') ? bonapUrl : undefined;

  const items: WidgetCardListItem[] = next.entries.slice(0, 8).map((entry) => {
    const recipe = entry.recipe;
    const item: WidgetCardListItem = {
      title: truncate(recipe?.name || entry.title || entryTypeLabel(entry.entryType, l), TITLE_MAX),
      badge: { text: entryTypeLabel(entry.entryType, l), color: 'primary' },
    };
    const image = recipe ? recipeImageKey(recipe) : undefined;
    if (image) item.image = image;
    if (recipe?.description) item.description = truncate(recipe.description, 2000);
    if (bonapLink)
      item.links = [{ url: bonapLink, label: { en: 'Open Bonap', fr: 'Ouvrir Bonap' } }];
    return item;
  });

  const content: WidgetContent = {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: `${dayLabel(next.date, now, l)} · ${entryTypeLabel(next.entryType, l)}`,
      },
      { type: 'card-list', display: 'list', items },
    ],
  };
  if (bonapLink) {
    content.components.push({
      type: 'button',
      label: { en: 'Open Bonap', fr: 'Ouvrir Bonap' },
      style: 'secondary',
      link: { url: bonapLink },
    });
  }
  return content;
}
