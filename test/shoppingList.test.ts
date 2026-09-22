import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { itemsToBuy, type ShoppingItem } from '../src/domain/shopping/ShoppingItem.ts';
import {
  addToShoppingList,
  readListName,
  readShoppingList,
  shoppingListOutputs,
} from '../src/application/shopping/shoppingList.ts';
import { buildShoppingListContent } from '../src/application/widget/shoppingListWidget.ts';
import type { MealieClient } from '../src/infrastructure/mealie/MealieClient.ts';

function item(id: string, text: string, position: number, label: string | null = null) {
  return { id, text, position, checked: false, label } satisfies ShoppingItem;
}

/** Fake Mealie shopping API, lists keyed by id. */
function fakeMealie() {
  const lists = new Map<string, { name: string; items: ShoppingItem[] }>();
  const client = {
    baseUrl: 'http://m',
    async getShoppingLists() {
      return [...lists].map(([id, l]) => ({ id, name: l.name }));
    },
    async createShoppingList(name: string) {
      const id = `l${lists.size}`;
      lists.set(id, { name, items: [] });
      return { id, name };
    },
    async getShoppingItems(id: string) {
      return lists.get(id)?.items ?? [];
    },
    async addShoppingItem(id: string, note: string, quantity?: number) {
      const list = lists.get(id);
      if (!list) throw new Error('unknown list');
      const text = quantity ? `${quantity} ${note}` : note;
      list.items.push(item(`i${list.items.length}`, text, list.items.length));
    },
  } as unknown as MealieClient;
  return { client, lists };
}

test('items to buy: unchecked, in list order', () => {
  const items = [
    item('a', 'Pain', 2),
    item('b', 'Lait', 1),
    { ...item('c', 'Oeufs', 0), checked: true },
  ];
  assert.deepEqual(
    itemsToBuy(items).map((i) => i.text),
    ['Lait', 'Pain'],
  );
});

test('the list name defaults to Bonap', () => {
  assert.equal(readListName({}), 'Bonap');
  assert.equal(readListName({ list_name: '  ' }), 'Bonap');
  assert.equal(readListName({ list_name: 'Maison' }), 'Maison');
});

test('reading a list that does not exist yet gives null', async () => {
  const { client } = fakeMealie();
  assert.equal(await readShoppingList(client, 'Bonap'), null);
});

test('adding creates the Bonap list when needed', async () => {
  const { client, lists } = fakeMealie();
  const outputs = await addToShoppingList(client, { item: ' Lait ', quantity: 2 });
  assert.deepEqual(outputs, { added: true, count: 1 });
  assert.deepEqual([...lists.values()], [{ name: 'Bonap', items: [item('i0', '2 Lait', 0)] }]);
});

test('adding an empty item fails the action', async () => {
  const { client } = fakeMealie();
  await assert.rejects(addToShoppingList(client, { item: '   ' }));
});

test('scene outputs list one item per line', () => {
  assert.deepEqual(shoppingListOutputs([item('a', 'Lait', 0), item('b', 'Pain', 1)]), {
    count: 2,
    summary: '• Lait\n• Pain',
  });
  assert.deepEqual(shoppingListOutputs(null), { count: 0, summary: '' });
});

test('widget: count tile, rows with labels, overflow caption, https link', () => {
  const items = Array.from({ length: 10 }, (_, i) =>
    item(`i${i}`, `Article ${i}`, i, i === 0 ? 'Crèmerie' : null),
  );
  const content = buildShoppingListContent(items, 'Bonap', 'fr', {
    bonapUrl: 'https://bonap.example.com',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(content.components[0], {
    type: 'value',
    value: 10,
    label: 'À acheter',
    icon: 'shopping-cart',
    color: 'primary',
  });
  const list = content.components[1];
  assert.ok(list?.type === 'card-list');
  assert.equal(list.items.length, 8);
  assert.deepEqual(list.items[0]?.badge, { text: 'Crèmerie', color: 'neutral' });
  assert.ok(
    content.components.some((c) => c.type === 'text' && String(c.text).includes('2 autres')),
  );
  assert.ok(content.components.some((c) => c.type === 'button'));
});

test('widget: empty list, http Bonap URL never linked', () => {
  const content = buildShoppingListContent([], 'Bonap', 'en', {
    bonapUrl: 'http://192.168.1.10:8080',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components.length, 1);
  const [text] = content.components;
  assert.ok(text?.type === 'text' && String(text.text).startsWith('Nothing to buy'));
});
