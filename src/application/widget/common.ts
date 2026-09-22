import { createHash } from 'node:crypto';
import type { WidgetCardListItem, WidgetContent } from '@gladysassistant/integration-sdk';
import type { MealPlanEntry, MealRecipe } from '../../domain/meal/MealPlanEntry.ts';
import { entryTypeLabel, mealName, toLang, type Lang } from '../../domain/meal/labels.ts';
import type { Message } from '../stack/reconcileStack.ts';

/** The meal plan changes rarely: re-pulled every 15 min (plus nudges). */
export const TTL_SECONDS = 900;
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 2000;

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Widget links must be https: a LAN http:// Bonap is never linked. */
export function httpsOnly(url: string | undefined): string | undefined {
  return url?.startsWith('https://') ? url : undefined;
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

/** Plain message content (not configured, Mealie unreachable, empty plan…). */
export function buildMessageContent(
  message: Message,
  language: string | undefined,
  ttlSeconds = 60,
): WidgetContent {
  return {
    ttl_seconds: ttlSeconds,
    components: [{ type: 'text', variant: 'body', text: message[toLang(language)] }],
  };
}

/** One card of a `card-list`: recipe name, picture, description. */
export function mealCard(
  entry: MealPlanEntry,
  l: Lang,
  { subtitle, bonapLink }: { subtitle?: string; bonapLink?: string } = {},
): WidgetCardListItem {
  const item: WidgetCardListItem = {
    title: truncate(mealName(entry, l), TITLE_MAX),
    badge: { text: entryTypeLabel(entry.entryType, l), color: 'primary' },
  };
  if (subtitle) item.subtitle = subtitle;
  const image = entry.recipe ? recipeImageKey(entry.recipe) : undefined;
  if (image) item.image = image;
  if (entry.recipe?.description) {
    item.description = truncate(entry.recipe.description, DESCRIPTION_MAX);
  }
  if (bonapLink) item.links = [{ url: bonapLink, label: { en: 'Open Bonap', fr: 'Ouvrir Bonap' } }];
  return item;
}

export function openBonapButton(bonapLink: string): WidgetContent['components'][number] {
  return {
    type: 'button',
    label: { en: 'Open Bonap', fr: 'Ouvrir Bonap' },
    style: 'secondary',
    link: { url: bonapLink },
  };
}
