import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeConfig } from '../src/domain/config/config.ts';
import { INTERNAL_MEALIE_URL, reconcileStack } from '../src/application/stack/reconcileStack.ts';
import type { ContainerGateway } from '../src/application/stack/containers.ts';
import { MEALIE_DEFAULT_PASSWORD } from '../src/application/mealie/bootstrapMealie.ts';
import { MealieApiError, type MealieClient } from '../src/infrastructure/mealie/MealieClient.ts';
import { StateStore } from '../src/infrastructure/state/StateStore.ts';

/** In-memory sub-containers: records every start/stop. */
function fakeGateway() {
  const running = new Map<string, Record<string, string>>();
  const calls: string[] = [];
  const gateway: ContainerGateway = {
    async getContainers() {
      return ['mealie', 'bonap'].map((name) => ({
        name,
        status: running.has(name) ? 'running' : 'stopped',
        desired: running.has(name) ? 'running' : 'stopped',
      }));
    },
    async startContainer(name, options) {
      calls.push(`start:${name}`);
      running.set(name, options?.env ?? {});
    },
    async stopContainer(name) {
      calls.push(`stop:${name}`);
      running.delete(name);
    },
  };
  return { gateway, running, calls };
}

/** Fake Mealie API: default admin until the password changes. */
function fakeMealie({ validToken = 'api-token' } = {}) {
  const server = { password: MEALIE_DEFAULT_PASSWORD, tokensCreated: 0 };
  const client = (baseUrl: string, token?: string): MealieClient =>
    ({
      baseUrl,
      async isAlive() {
        return true;
      },
      async login(_email: string, password: string) {
        if (password !== server.password) throw new MealieApiError('401', 401);
        return 'session';
      },
      withToken(t: string) {
        return client(baseUrl, t);
      },
      async createApiToken() {
        server.tokensCreated += 1;
        return validToken;
      },
      async changePassword(_current: string, next: string) {
        server.password = next;
      },
      async getSelf() {
        if (token !== validToken) throw new MealieApiError('401', 401);
        return { email: 'changeme@example.com', username: 'admin' };
      },
    }) as unknown as MealieClient;
  return { server, client };
}

async function setup() {
  const dataRoot = await mkdtemp(join(tmpdir(), 'gladys-bonap-'));
  return { dataRoot, store: new StateStore(join(dataRoot, 'state.json')) };
}

test('install mode: starts Mealie, bootstraps it, then starts Bonap with the token', async () => {
  const { dataRoot, store } = await setup();
  const { gateway, running } = fakeGateway();
  const { server, client } = fakeMealie();

  const result = await reconcileStack(normalizeConfig({}), {
    containers: gateway,
    store,
    dataRoot,
    mealieBootTimeoutMs: 1_000,
    createMealieClient: client,
  });

  assert.equal(result.ok, true);
  assert.notEqual(server.password, MEALIE_DEFAULT_PASSWORD);
  const state = await store.read();
  assert.equal(state.mealie?.password, server.password);
  assert.deepEqual(running.get('bonap'), {
    VITE_MEALIE_URL: INTERNAL_MEALIE_URL,
    VITE_MEALIE_TOKEN: 'api-token',
  });
  const volume = await stat(join(dataRoot, 'containers', 'mealie', 'app', 'data'));
  assert.ok(volume.isDirectory());
});

test('a second reconciliation does not restart anything nor re-bootstrap', async () => {
  const { dataRoot, store } = await setup();
  const { gateway, calls } = fakeGateway();
  const { server, client } = fakeMealie();
  const deps = {
    containers: gateway,
    store,
    dataRoot,
    mealieBootTimeoutMs: 1_000,
    createMealieClient: client,
  };

  await reconcileStack(normalizeConfig({}), deps);
  await reconcileStack(normalizeConfig({}), deps);

  assert.deepEqual(calls, ['start:mealie', 'start:bonap']);
  assert.equal(server.tokensCreated, 1);
});

test('existing mode: stops the managed Mealie and uses the given URL and token', async () => {
  const { dataRoot, store } = await setup();
  const { gateway, running } = fakeGateway();
  running.set('mealie', {});
  const { client } = fakeMealie({ validToken: 'user-token' });

  const result = await reconcileStack(
    normalizeConfig({
      mealie_mode: 'existing',
      mealie_url: 'https://mealie.example.com/',
      mealie_token: 'user-token',
      bonap_mode: 'none',
    }),
    {
      containers: gateway,
      store,
      dataRoot,
      mealieBootTimeoutMs: 1_000,
      createMealieClient: client,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.mealie?.baseUrl, 'https://mealie.example.com');
  assert.equal(running.has('mealie'), false);
  assert.equal(running.has('bonap'), false);
});

test('existing mode without URL/token or with a bad token reports it', async () => {
  const { dataRoot, store } = await setup();
  const { gateway } = fakeGateway();
  const { client } = fakeMealie({ validToken: 'user-token' });
  const deps = {
    containers: gateway,
    store,
    dataRoot,
    mealieBootTimeoutMs: 1_000,
    createMealieClient: client,
  };

  const missing = await reconcileStack(normalizeConfig({ mealie_mode: 'existing' }), deps);
  assert.equal(missing.ok, false);

  const rejected = await reconcileStack(
    normalizeConfig({ mealie_mode: 'existing', mealie_url: 'http://m:9000', mealie_token: 'bad' }),
    deps,
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.message.fr, /token/);
});

test('a Mealie initialized outside the integration is reported, not overwritten', async () => {
  const { dataRoot, store } = await setup();
  const { gateway } = fakeGateway();
  const { server, client } = fakeMealie();
  server.password = 'someone-else';

  const result = await reconcileStack(normalizeConfig({ bonap_mode: 'none' }), {
    containers: gateway,
    store,
    dataRoot,
    mealieBootTimeoutMs: 1_000,
    createMealieClient: client,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message.fr, /déjà été initialisé/);
});
