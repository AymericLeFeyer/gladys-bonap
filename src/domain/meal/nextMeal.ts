import type { MealPlanEntry } from './MealPlanEntry.ts';

/**
 * Hour (local time) after which a slot of the day is considered over, and the
 * order of the slots within a day. Unknown entry types sort last and end with
 * the day.
 */
const SLOTS: Record<string, { order: number; endsAt: number }> = {
  breakfast: { order: 0, endsAt: 10 },
  lunch: { order: 1, endsAt: 14 },
  snack: { order: 2, endsAt: 17 },
  dinner: { order: 3, endsAt: 21 },
  side: { order: 4, endsAt: 21 },
  dessert: { order: 5, endsAt: 21 },
  drink: { order: 6, endsAt: 24 },
};
const UNKNOWN_SLOT = { order: 99, endsAt: 24 };

export interface NextMeal {
  date: string;
  entryType: string;
  /** Every entry planned for that day and slot (e.g. a main dish and a side). */
  entries: MealPlanEntry[];
}

/** Local `YYYY-MM-DD` of a date (the container runs with the Gladys `TZ`). */
export function toLocalDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function slotOf(entryType: string) {
  return SLOTS[entryType] ?? UNKNOWN_SLOT;
}

/** The first meal slot that is not over yet, or null when nothing is planned. */
export function findNextMeal(entries: MealPlanEntry[], now: Date): NextMeal | null {
  const today = toLocalDay(now);
  const hour = now.getHours() + now.getMinutes() / 60;

  const upcoming = entries
    .filter((e) => e.date > today || (e.date === today && hour < slotOf(e.entryType).endsAt))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        slotOf(a.entryType).order - slotOf(b.entryType).order ||
        a.id - b.id,
    );

  const first = upcoming[0];
  if (!first) return null;
  return {
    date: first.date,
    entryType: first.entryType,
    entries: upcoming.filter((e) => e.date === first.date && e.entryType === first.entryType),
  };
}
