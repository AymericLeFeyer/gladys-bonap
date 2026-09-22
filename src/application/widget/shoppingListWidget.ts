import type { WidgetContent } from '@gladysassistant/integration-sdk';
import type { ShoppingItem } from '../../domain/shopping/ShoppingItem.ts';
import { buildMessageContent, httpsOnly, openBonapButton, toLang, truncate } from './common.ts';

export const SHOPPING_LIST_WIDGET = 'shopping_list';

/** The list changes while shopping: re-pulled every 5 min (plus nudges). */
const TTL_SECONDS = 300;
/** A `list` card-list holds at most 8 rows. */
const MAX_ROWS = 8;

export function buildShoppingListContent(
  items: ShoppingItem[] | null,
  listName: string,
  language: string | undefined,
  { bonapUrl }: { bonapUrl?: string } = {},
): WidgetContent {
  const l = toLang(language);
  const link = httpsOnly(bonapUrl);

  if (!items || items.length === 0) {
    const content = buildMessageContent(
      {
        en: `Nothing to buy on the "${listName}" list. Add items from Bonap or a Gladys scene.`,
        fr: `Rien à acheter sur la liste « ${listName} ». Ajoutez des articles depuis Bonap ou une scène Gladys.`,
      },
      language,
      TTL_SECONDS,
    );
    if (link) content.components.push(openBonapButton(link));
    return content;
  }

  const content: WidgetContent = {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'value',
        value: items.length,
        label: l === 'fr' ? 'À acheter' : 'To buy',
        icon: 'shopping-cart',
        color: 'primary',
      },
      {
        type: 'card-list',
        display: 'list',
        items: items.slice(0, MAX_ROWS).map((item) => ({
          title: truncate(item.text || '—', 60),
          ...(item.label
            ? { badge: { text: truncate(item.label, 16), color: 'neutral' as const } }
            : {}),
        })),
      },
    ],
  };
  if (items.length > MAX_ROWS) {
    content.components.push({
      type: 'text',
      variant: 'caption',
      text:
        l === 'fr'
          ? `+ ${items.length - MAX_ROWS} autres articles dans Bonap`
          : `+ ${items.length - MAX_ROWS} more items in Bonap`,
    });
  }
  if (link) content.components.push(openBonapButton(link));
  return content;
}
