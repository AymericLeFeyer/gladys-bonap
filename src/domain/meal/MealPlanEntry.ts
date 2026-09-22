export interface MealRecipe {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Mealie image id: changes when a new image is uploaded, null without image. */
  image: string | null;
}

/** One entry of the Mealie meal plan (`/api/households/mealplans`). */
export interface MealPlanEntry {
  id: number;
  /** Local day, `YYYY-MM-DD`. */
  date: string;
  /** Mealie entry type: breakfast, lunch, dinner, side, snack, drink, dessert… */
  entryType: string;
  /** Free-text title, used when no recipe is linked. */
  title: string;
  recipe: MealRecipe | null;
}
