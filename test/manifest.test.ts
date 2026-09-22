// Consistency checks between the manifest and the code: the indexer validates
// the manifest shape, not which handlers the code registers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MANIFEST_DEFAULTS } from '../src/domain/config/config.ts';
import { NEXT_MEAL_WIDGET } from '../src/application/widget/nextMealWidget.ts';

interface Field {
  key: string;
  type: string;
  default?: unknown;
  description?: Record<string, string>;
}
const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
) as {
  name: string;
  version: string;
  docker_image: string;
  description: Record<string, string>;
  config_schema: Field[];
  actions: Array<{ key: string }>;
  widgets: Array<{ key: string }>;
  containers: Array<{ name: string; docker_image: string; ports?: Array<{ name?: string }> }>;
};
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const index = await readFile(new URL('../index.ts', import.meta.url), 'utf8');

test('every manifest action and widget has a handler in index.ts', () => {
  for (const { key } of manifest.actions) {
    assert.ok(index.includes(`onAction('${key}'`), `action "${key}" has no handler`);
  }
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    [NEXT_MEAL_WIDGET],
  );
});

test('config_schema defaults match the code defaults', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(MANIFEST_DEFAULTS[field.key as keyof typeof MANIFEST_DEFAULTS], field.default);
    }
  }
});

test('{{port:<name>}} placeholders reference declared ports', () => {
  const ports = new Set(manifest.containers.flatMap((c) => (c.ports ?? []).map((p) => p.name)));
  for (const field of manifest.config_schema.filter((f) => f.type === 'section')) {
    for (const text of Object.values(field.description ?? {})) {
      for (const [, name] of text.matchAll(/\{\{port:([a-z0-9_]+)\}\}/g)) {
        assert.ok(ports.has(name), `unknown port "${name}"`);
      }
    }
  }
});

test('catalog bounds: name 3-30, description 10-100', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const text of Object.values(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description too long: ${text.length}`);
  }
});

test('the version is in lockstep across package.json and our images', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${pkg.version}`));
  const web = manifest.containers.find((c) => c.name === 'bonap');
  assert.ok(web?.docker_image.endsWith(`:${pkg.version}`));
});
