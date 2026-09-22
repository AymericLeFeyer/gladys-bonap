import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Credentials of the Mealie instance installed (and bootstrapped) by the integration. */
export interface ManagedMealieCredentials {
  email: string;
  password: string;
  apiToken: string;
}

/**
 * Private state of the integration, persisted in its `/data` volume (never
 * shown to Gladys, removed with the integration).
 */
export interface IntegrationState {
  mealie?: ManagedMealieCredentials;
  /** Hash of the env each sub-container was last started with. */
  containerEnvHashes?: Record<string, string>;
}

export class StateStore {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
  }

  async read(): Promise<IntegrationState> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as IntegrationState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }
  }

  async update(patch: (state: IntegrationState) => IntegrationState): Promise<IntegrationState> {
    const next = patch(await this.read());
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
    return next;
  }
}
