import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/domain/config/config.ts';

test('defaults to installing Mealie and Bonap', () => {
  const config = normalizeConfig();
  assert.equal(config.mealieMode, 'install');
  assert.equal(config.bonapMode, 'install');
});

test('trims URLs and tokens, drops trailing slashes', () => {
  const config = normalizeConfig({
    mealie_mode: 'existing',
    mealie_url: ' http://192.168.1.10:9000/ ',
    mealie_token: ' abc ',
    bonap_url: 'https://bonap.example.com//',
  });
  assert.equal(config.mealieUrl, 'http://192.168.1.10:9000');
  assert.equal(config.mealieToken, 'abc');
  assert.equal(config.bonapUrl, 'https://bonap.example.com');
});

test('unknown modes fall back to the defaults', () => {
  const config = normalizeConfig({ mealie_mode: 'cloud', bonap_mode: 42 });
  assert.equal(config.mealieMode, 'install');
  assert.equal(config.bonapMode, 'install');
});
