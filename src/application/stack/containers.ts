import { createHash } from 'node:crypto';
import type { StateStore } from '../../infrastructure/state/StateStore.ts';

/** The subset of the SDK the stack needs (GladysIntegration satisfies it). */
export interface ContainerGateway {
  getContainers(): Promise<Array<{ name: string; status: string; desired: string }>>;
  startContainer(name: string, options?: { env?: Record<string, string> }): Promise<unknown>;
  stopContainer(name: string): Promise<unknown>;
}

export type ContainerName = 'mealie' | 'bonap';

function envHash(env: Record<string, string>): string {
  const sorted = Object.fromEntries(Object.entries(env).sort(([a], [b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Starts a sub-container unless it already runs with the same env.
 * `startContainer` always restarts the container (and recreates it when the
 * env changed), so calling it blindly on every reconnection would bounce
 * Mealie and Bonap for nothing.
 * @returns true when the container was (re)started.
 */
export async function ensureRunning(
  gateway: ContainerGateway,
  store: StateStore,
  name: ContainerName,
  env: Record<string, string>,
): Promise<boolean> {
  const hash = envHash(env);
  const [containers, state] = await Promise.all([gateway.getContainers(), store.read()]);
  const current = containers.find((c) => c.name === name);
  if (current?.status === 'running' && state.containerEnvHashes?.[name] === hash) {
    return false;
  }
  await gateway.startContainer(name, { env });
  await store.update((s) => ({
    ...s,
    containerEnvHashes: { ...s.containerEnvHashes, [name]: hash },
  }));
  return true;
}

/** Stops a sub-container if it runs (or is expected to). Its data is kept. */
export async function ensureStopped(gateway: ContainerGateway, name: ContainerName): Promise<void> {
  const current = (await gateway.getContainers()).find((c) => c.name === name);
  if (current && (current.status === 'running' || current.desired === 'running')) {
    await gateway.stopContainer(name);
  }
}
