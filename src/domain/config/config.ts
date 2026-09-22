// Integration configuration, filled in by the user through the manifest
// `config_schema`. Gladys has no conditional fields: every field is always
// shown, the modes decide which ones are read.

export type MealieMode = 'install' | 'existing';
export type BonapMode = 'install' | 'existing' | 'none';

export interface BonapConfig {
  mealieMode: MealieMode;
  /** Existing Mealie only, without trailing slash. */
  mealieUrl: string;
  /** Existing Mealie only. */
  mealieToken: string;
  bonapMode: BonapMode;
  /** Existing Bonap only, without trailing slash. */
  bonapUrl: string;
}

/** Must match the `default` values of the manifest `config_schema`. */
export const MANIFEST_DEFAULTS = {
  mealie_mode: 'install',
  bonap_mode: 'install',
} as const;

const MEALIE_MODES: readonly MealieMode[] = ['install', 'existing'];
const BONAP_MODES: readonly BonapMode[] = ['install', 'existing', 'none'];

export function normalizeConfig(raw: Record<string, unknown> = {}): BonapConfig {
  return {
    mealieMode: pick(raw.mealie_mode, MEALIE_MODES, MANIFEST_DEFAULTS.mealie_mode),
    mealieUrl: normalizeUrl(raw.mealie_url),
    mealieToken: typeof raw.mealie_token === 'string' ? raw.mealie_token.trim() : '',
    bonapMode: pick(raw.bonap_mode, BONAP_MODES, MANIFEST_DEFAULTS.bonap_mode),
    bonapUrl: normalizeUrl(raw.bonap_url),
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}
