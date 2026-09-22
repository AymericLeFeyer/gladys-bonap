import type { MealPlanEntry } from '../../domain/meal/MealPlanEntry.ts';

export class MealieApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'MealieApiError';
    this.status = status;
  }
}

interface RawMealPlan {
  id: number;
  date: string;
  entryType?: string;
  title?: string;
  recipe?: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    image?: string | null;
  } | null;
}

const TIMEOUT_MS = 10_000;

/** Minimal HTTP client of the Mealie API (v2/v3). */
export class MealieClient {
  readonly baseUrl: string;
  private readonly token: string | null;

  constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  withToken(token: string): MealieClient {
    return new MealieClient(this.baseUrl, token);
  }

  /** true as soon as the API answers (used while Mealie boots). */
  async isAlive(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/app/about`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Password login, returns a short-lived access token. */
  async login(email: string, password: string): Promise<string> {
    const body = new URLSearchParams({ username: email, password });
    const data = await this.request<{ access_token: string }>('POST', '/api/auth/token', {
      body,
      auth: false,
    });
    return data.access_token;
  }

  /** Creates a long-lived API token for the authenticated user. */
  async createApiToken(name: string): Promise<string> {
    const data = await this.request<{ token: string }>('POST', '/api/users/api-tokens', {
      json: { name },
    });
    return data.token;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('PUT', '/api/users/password', {
      json: { currentPassword, newPassword },
    });
  }

  async getSelf(): Promise<{ email: string; username: string }> {
    return this.request('GET', '/api/users/self');
  }

  /** Meal plan entries between two local days (`YYYY-MM-DD`, inclusive). */
  async getMealPlans(startDate: string, endDate: string): Promise<MealPlanEntry[]> {
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      page: '1',
      perPage: '-1',
      orderBy: 'date',
      orderDirection: 'asc',
    });
    const data = await this.request<{ items: RawMealPlan[] }>(
      'GET',
      `/api/households/mealplans?${query}`,
    );
    return data.items.map(toMealPlanEntry);
  }

  /** Small WebP thumbnail of a recipe (Mealie's `min-original`). */
  async getRecipeThumbnail(recipeId: string): Promise<Buffer> {
    const res = await this.fetch(
      'GET',
      `/api/media/recipes/${encodeURIComponent(recipeId)}/images/min-original.webp`,
      {},
    );
    return Buffer.from(await res.arrayBuffer());
  }

  private async request<T>(
    method: string,
    path: string,
    options: { json?: unknown; body?: URLSearchParams; auth?: boolean } = {},
  ): Promise<T> {
    const res = await this.fetch(method, path, options);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async fetch(
    method: string,
    path: string,
    { json, body, auth = true }: { json?: unknown; body?: URLSearchParams; auth?: boolean },
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (json !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : body,
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
    return res;
  }
}

function toMealPlanEntry(raw: RawMealPlan): MealPlanEntry {
  return {
    id: raw.id,
    date: raw.date,
    entryType: raw.entryType ?? 'dinner',
    title: raw.title ?? '',
    recipe: raw.recipe
      ? {
          id: raw.recipe.id,
          slug: raw.recipe.slug,
          name: raw.recipe.name,
          description: raw.recipe.description ?? '',
          image: raw.recipe.image ?? null,
        }
      : null,
  };
}
