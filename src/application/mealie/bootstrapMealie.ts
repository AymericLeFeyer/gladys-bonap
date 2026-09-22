import { chmod, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { MealieApiError, type MealieClient } from '../../infrastructure/mealie/MealieClient.ts';
import type {
  ManagedMealieCredentials,
  StateStore,
} from '../../infrastructure/state/StateStore.ts';

/** Admin account Mealie seeds on an empty database. */
export const MEALIE_DEFAULT_EMAIL = 'changeme@example.com';
export const MEALIE_DEFAULT_PASSWORD = 'MyPassword';
export const MEALIE_API_TOKEN_NAME = 'Gladys Bonap';

export class MealieAlreadyInitializedError extends Error {
  constructor() {
    super('Mealie already has an admin password that this integration does not know');
    this.name = 'MealieAlreadyInitializedError';
  }
}

/**
 * Prepares the Mealie volume, seen by this container under
 * `/data/containers/mealie/app/data`.
 *
 * Gladys runs sub-containers with every capability dropped. The official
 * Mealie image starts as root and would `chown` + `gosu` to uid 911, which
 * fails without CAP_CHOWN/CAP_SETUID: the manifest sets PUID=PGID=0 so the
 * entrypoint skips the user switch. Root without CAP_DAC_OVERRIDE cannot write
 * into a folder owned by uid 1000 (the supervisor's convention), hence the
 * world-writable volume root. The folder is private to the integration.
 */
export async function prepareMealieDataDir(dataRoot: string): Promise<void> {
  const dir = join(dataRoot, 'containers', 'mealie', 'app', 'data');
  await mkdir(dir, { recursive: true });
  await chmod(dir, 0o777);
}

export async function waitForMealie(
  client: MealieClient,
  { timeoutMs, intervalMs = 3_000 }: { timeoutMs: number; intervalMs?: number },
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await client.isAlive()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

/**
 * First start of a Mealie installed by the integration: logs in with the
 * seeded admin, creates a long-lived API token, then replaces the well-known
 * default password by a random one. Idempotent: returns the stored
 * credentials when the bootstrap already ran.
 */
export async function bootstrapMealie(
  client: MealieClient,
  store: StateStore,
  generatePassword: () => string = () => randomBytes(18).toString('base64url'),
): Promise<ManagedMealieCredentials> {
  const existing = (await store.read()).mealie;
  if (existing) return existing;

  let accessToken: string;
  try {
    accessToken = await client.login(MEALIE_DEFAULT_EMAIL, MEALIE_DEFAULT_PASSWORD);
  } catch (err) {
    if (err instanceof MealieApiError && err.status === 401) {
      throw new MealieAlreadyInitializedError();
    }
    throw err;
  }
  const authed = client.withToken(accessToken);

  // Persist the token before touching the password: a crash in between
  // leaves a working token and the (still valid) default password on disk.
  const apiToken = await authed.createApiToken(MEALIE_API_TOKEN_NAME);
  await store.update((s) => ({
    ...s,
    mealie: { email: MEALIE_DEFAULT_EMAIL, password: MEALIE_DEFAULT_PASSWORD, apiToken },
  }));

  const password = generatePassword();
  await authed.changePassword(MEALIE_DEFAULT_PASSWORD, password);
  const state = await store.update((s) => ({
    ...s,
    mealie: { email: MEALIE_DEFAULT_EMAIL, password, apiToken },
  }));
  return state.mealie as ManagedMealieCredentials;
}
