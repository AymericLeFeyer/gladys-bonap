import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/domain/config/config.ts';

test('defaults to installing Bonap', () => {
  assert.equal(normalizeConfig().bonapMode, 'install');
});

test('trims URLs and the token, drops trailing slashes', () => {
  const config = normalizeConfig({
    mealie_url: ' http://192.168.1.10:9000/ ',
    mealie_token: ' abc ',
    bonap_url: 'https://bonap.example.com//',
  });
  assert.equal(config.mealieUrl, 'http://192.168.1.10:9000');
  assert.equal(config.mealieToken, 'abc');
  assert.equal(config.bonapUrl, 'https://bonap.example.com');
});

test('an unknown mode falls back to the default', () => {
  assert.equal(normalizeConfig({ bonap_mode: 'none' }).bonapMode, 'install');
});
