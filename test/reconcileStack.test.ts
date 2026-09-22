import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeConfig } from '../src/domain/config/config.ts';
import { reconcileStack } from '../src/application/stack/reconcileStack.ts';
import type { ContainerGateway } from '../src/application/stack/containers.ts';
import { MealieApiError, type MealieClient } from '../src/infrastructure/mealie/MealieClient.ts';
import { StateStore } from '../src/infrastructure/state/StateStore.ts';

/** In-memory sub-container: records every start/stop. */
function fakeGateway() {
  const running = new Map<string, Record<string, string>>();
  const calls: string[] = [];
  const gateway: ContainerGateway = {
    async getContainers() {
      const state = running.has('bonap') ? 'running' : 'stopped';
      return [{ name: 'bonap', status: state, desired: state }];
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

/** Fake Mealie accepting one token. */
function fakeMealie(baseUrl: string, token: string): MealieClient {
  return {
    baseUrl,
    async getSelf() {
      if (token !== 'tok') throw new MealieApiError('401', 401);
      return { email: 'a@b.c', username: 'admin' };
    },
  } as unknown as MealieClient;
}

async function deps(gateway: ContainerGateway) {
  const dir = await mkdtemp(join(tmpdir(), 'gladys-bonap-'));
  return {
    containers: gateway,
    store: new StateStore(join(dir, 'state.json')),
    createMealieClient: fakeMealie,
  };
}

const MEALIE = { mealie_url: 'http://192.168.1.10:38123', mealie_token: 'tok' };

test('install mode: starts Bonap wired to Mealie, once', async () => {
  const { gateway, running, calls } = fakeGateway();
  const d = await deps(gateway);

  const result = await reconcileStack(normalizeConfig(MEALIE), d);
  await reconcileStack(normalizeConfig(MEALIE), d);

  assert.equal(result.ok, true);
  assert.deepEqual(running.get('bonap'), {
    VITE_MEALIE_URL: 'http://192.168.1.10:38123',
    VITE_MEALIE_TOKEN: 'tok',
  });
  assert.deepEqual(calls, ['start:bonap']);
});

test('existing Bonap: the sub-container is stopped', async () => {
  const { gateway, running } = fakeGateway();
  running.set('bonap', {});
  const result = await reconcileStack(
    normalizeConfig({ ...MEALIE, bonap_mode: 'existing' }),
    await deps(gateway),
  );
  assert.equal(result.ok, true);
  assert.equal(running.has('bonap'), false);
});

test('missing Mealie settings point to the Mealie integration', async () => {
  const { gateway, calls } = fakeGateway();
  const result = await reconcileStack(normalizeConfig({}), await deps(gateway));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message.fr, /intégration Mealie/);
  assert.deepEqual(calls, []);
});

test('localhost and mealie:9000 are refused with an explanation', async () => {
  const { gateway } = fakeGateway();
  for (const url of ['http://localhost:9000', 'http://mealie:9000']) {
    const result = await reconcileStack(
      normalizeConfig({ mealie_url: url, mealie_token: 'tok' }),
      await deps(gateway),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message.en, /IP address/);
  }
});

test('a rejected token is reported and Bonap is not started', async () => {
  const { gateway, calls } = fakeGateway();
  const result = await reconcileStack(
    normalizeConfig({ ...MEALIE, mealie_token: 'bad' }),
    await deps(gateway),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message.fr, /refusé le token/);
  assert.deepEqual(calls, []);
});
