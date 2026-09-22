import type { WidgetContent } from '@gladysassistant/integration-sdk';
import { dayLabel, entryTypeLabel, toLang } from '../../domain/meal/labels.ts';
import type { NextMeal } from '../../domain/meal/nextMeal.ts';
import {
  TTL_SECONDS,
  buildMessageContent,
  httpsOnly,
  mealCard,
  openBonapButton,
} from './common.ts';

export const NEXT_MEAL_WIDGET = 'next_meal';

/** `meal_types` setting of the widget: an empty selection means every type. */
export function readMealTypes(settings: Record<string, unknown>): string[] {
  const value = settings.meal_types;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function buildNextMealContent(
  next: NextMeal | null,
  now: Date,
  language: string | undefined,
  { bonapUrl }: { bonapUrl?: string } = {},
): WidgetContent {
  const l = toLang(language);
  if (!next) {
    return buildMessageContent(
      {
        en: 'No meal planned for the next 7 days.',
        fr: 'Aucun repas prévu dans les 7 prochains jours.',
      },
      language,
      TTL_SECONDS,
    );
  }

  const bonapLink = httpsOnly(bonapUrl);
  const content: WidgetContent = {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: `${dayLabel(next.date, now, l)} · ${entryTypeLabel(next.entryType, l)}`,
      },
      {
        type: 'card-list',
        display: 'list',
        items: next.entries.slice(0, 8).map((entry) => mealCard(entry, l, { bonapLink })),
      },
    ],
  };
  if (bonapLink) content.components.push(openBonapButton(bonapLink));
  return content;
}
