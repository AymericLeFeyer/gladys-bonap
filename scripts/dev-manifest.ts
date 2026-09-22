// Prints the manifest pointing at locally built images, to paste into Gladys:
// Integrations > Install from GitHub > Developer mode. Gladys falls back to a
// local image when the pull fails, for developer installs only.
// Usage: npm run manifest:dev [-- <tag>]   (default tag: dev)

import { readFile } from 'node:fs/promises';

const tag = process.argv[2] ?? 'dev';
const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
) as { docker_image: string; containers: Array<{ name: string; docker_image: string }> };

manifest.docker_image = `gladys-bonap:${tag}`;
for (const container of manifest.containers) {
  if (container.name === 'bonap') container.docker_image = `gladys-bonap-web:${tag}`;
}

console.log(JSON.stringify(manifest, null, 2));
