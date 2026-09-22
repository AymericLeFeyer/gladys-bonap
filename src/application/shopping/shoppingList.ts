// Use cases around the Bonap shopping list (a Mealie shopping list, "Bonap"
// by default): read it for the widget and the scenes, add to it from a scene.

import type { SceneActionOutputs } from '@gladysassistant/integration-sdk';
import {
  BONAP_LIST_NAME,
  itemsToBuy,
  type ShoppingItem,
} from '../../domain/shopping/ShoppingItem.ts';
import type { MealieClient } from '../../infrastructure/mealie/MealieClient.ts';

export const ADD_TO_SHOPPING_LIST_ACTION = 'add_to_shopping_list';
export const GET_SHOPPING_LIST_ACTION = 'get_shopping_list';

/** `list_name` setting / field: the Bonap list unless another one is named. */
export function readListName(values: Record<string, unknown>): string {
  const name = typeof values.list_name === 'string' ? values.list_name.trim() : '';
  return name || BONAP_LIST_NAME;
}

/** Items to buy of the named list, or null when the list does not exist yet. */
export async function readShoppingList(
  mealie: MealieClient,
  listName: string,
): Promise<ShoppingItem[] | null> {
  const list = (await mealie.getShoppingLists()).find((l) => l.name === listName);
  return list ? itemsToBuy(await mealie.getShoppingItems(list.id)) : null;
}

/**
 * Scene action `add_to_shopping_list`: fields `item` (required, scene
 * variables allowed), `quantity`, `list_name`. Creates the list like Bonap
 * does when it does not exist yet.
 */
export async function addToShoppingList(
  mealie: MealieClient,
  fields: Record<string, unknown>,
): Promise<SceneActionOutputs> {
  const item = typeof fields.item === 'string' ? fields.item.trim() : '';
  if (!item) throw new Error('The item to add is empty');
  const listName = readListName(fields);
  const quantity = Number(fields.quantity);

  const lists = await mealie.getShoppingLists();
  const list =
    lists.find((l) => l.name === listName) ?? (await mealie.createShoppingList(listName));
  await mealie.addShoppingItem(list.id, item, Number.isFinite(quantity) ? quantity : undefined);

  const items = itemsToBuy(await mealie.getShoppingItems(list.id));
  return { added: true, count: items.length };
}

/** Scene action `get_shopping_list` outputs: count, summary ("• lait" lines). */
export function shoppingListOutputs(items: ShoppingItem[] | null): SceneActionOutputs {
  const toBuy = items ?? [];
  return {
    count: toBuy.length,
    summary: toBuy.map((i) => `• ${i.text}`).join('\n'),
  };
}
