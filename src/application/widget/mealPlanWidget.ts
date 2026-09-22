import type { WidgetContent } from '@gladysassistant/integration-sdk';
import type { MealPlanEntry } from '../../domain/meal/MealPlanEntry.ts';
import { dayLabel, toLang } from '../../domain/meal/labels.ts';
import { addDays, toLocalDay, upcomingEntries } from '../../domain/meal/nextMeal.ts';
import {
  TTL_SECONDS,
  buildMessageContent,
  httpsOnly,
  mealCard,
  openBonapButton,
} from './common.ts';

export const MEAL_PLAN_WIDGET = 'meal_plan';

/** A `list` card-list holds at most 8 rows. */
const MAX_ROWS = 8;
export const DEFAULT_PLAN_DAYS = 3;

/** `days` setting of the widget (select of strings "1".."7"). */
export function readPlanDays(settings: Record<string, unknown>): number {
  const days = Number(settings.days);
  return Number.isInteger(days) && days >= 1 && days <= 7 ? days : DEFAULT_PLAN_DAYS;
}

/**
 * The meals of the next `days` days (today included, past slots of today
 * excluded), as rows "Demain · Poulet rôti".
 */
export function buildMealPlanContent(
  entries: MealPlanEntry[],
  now: Date,
  days: number,
  language: string | undefined,
  { bonapUrl }: { bonapUrl?: string } = {},
): WidgetContent {
  const l = toLang(language);
  const until = toLocalDay(addDays(now, days - 1));
  const rows = upcomingEntries(entries, now).filter((e) => e.date <= until);
  if (rows.length === 0) {
    return buildMessageContent(
      {
        en: days === 1 ? 'No meal planned today.' : `No meal planned for the next ${days} days.`,
        fr:
          days === 1
            ? "Aucun repas prévu aujourd'hui."
            : `Aucun repas prévu dans les ${days} prochains jours.`,
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
        type: 'card-list',
        display: 'list',
        items: rows
          .slice(0, MAX_ROWS)
          .map((entry) =>
            mealCard(entry, l, { subtitle: dayLabel(entry.date, now, l), bonapLink }),
          ),
      },
    ],
  };
  if (rows.length > MAX_ROWS) {
    content.components.unshift({
      type: 'text',
      variant: 'caption',
      text:
        l === 'fr'
          ? `${MAX_ROWS} premiers repas sur ${rows.length}`
          : `First ${MAX_ROWS} of ${rows.length} meals`,
    });
  }
  if (bonapLink) content.components.push(openBonapButton(bonapLink));
  return content;
}
