import type { ShoppingItem } from '../../domain/shopping/ShoppingItem.ts';

export class MealieApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'MealieApiError';
    this.status = status;
  }
}

interface RawShoppingItem {
  id: string;
  shoppingListId: string;
  checked: boolean;
  position?: number;
  display?: string | null;
  note?: string | null;
  quantity?: number | null;
  food?: { name: string } | null;
  label?: { name: string } | null;
}

const TIMEOUT_MS = 10_000;

/** Minimal HTTP client of the Mealie API (v2/v3), shopping lists only. */
export class MealieClient {
  readonly baseUrl: string;
  private readonly token: string | null;

  constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async getSelf(): Promise<{ email: string; username: string }> {
    return this.request('GET', '/api/users/self');
  }

  async getShoppingLists(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.request<{ items: Array<{ id: string; name: string }> }>(
      'GET',
      '/api/households/shopping/lists?page=1&perPage=-1',
    );
    return data.items;
  }

  async createShoppingList(name: string): Promise<{ id: string; name: string }> {
    return this.request('POST', '/api/households/shopping/lists', { json: { name } });
  }

  async getShoppingItems(listId: string): Promise<ShoppingItem[]> {
    const data = await this.request<{ listItems?: RawShoppingItem[] }>(
      'GET',
      `/api/households/shopping/lists/${encodeURIComponent(listId)}`,
    );
    return (data.listItems ?? [])
      .filter((i) => i.shoppingListId === listId)
      .map((i) => ({
        id: i.id,
        text: (i.display || i.note || i.food?.name || '').trim(),
        checked: i.checked,
        position: i.position ?? 0,
        label: i.label?.name ?? null,
      }));
  }

  /** Free-text item, the way Bonap adds one (`isFood: false`). */
  async addShoppingItem(listId: string, note: string, quantity?: number): Promise<void> {
    await this.request('POST', '/api/households/shopping/items/create-bulk', {
      json: [
        {
          shoppingListId: listId,
          note,
          checked: false,
          isFood: false,
          ...(quantity && quantity > 0 ? { quantity } : {}),
        },
      ],
    });
  }

  private async request<T>(
    method: string,
    path: string,
    { json }: { json?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (json !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new MealieApiError(
        `Mealie unreachable at ${this.baseUrl}: ${(err as Error).message}`,
        null,
      );
    }
    if (!res.ok) {
      throw new MealieApiError(
        `Mealie ${method} ${path.split('?')[0]} -> HTTP ${res.status}`,
        res.status,
      );
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
