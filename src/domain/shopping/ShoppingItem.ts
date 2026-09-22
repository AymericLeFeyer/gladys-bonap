/** Name of the Mealie shopping list Bonap uses (auto-created by Bonap too). */
export const BONAP_LIST_NAME = 'Bonap';

/** One line of a Mealie shopping list. */
export interface ShoppingItem {
  id: string;
  /** Text as Mealie renders it ("2 kg pommes de terre", "lait"…). */
  text: string;
  checked: boolean;
  position: number;
  /** Mealie label (rayon), null without label. */
  label: string | null;
}

/** Items still to buy, in the list order. */
export function itemsToBuy(items: ShoppingItem[]): ShoppingItem[] {
  return items.filter((i) => !i.checked).sort((a, b) => a.position - b.position);
}
