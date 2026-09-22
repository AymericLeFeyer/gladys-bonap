// Integration configuration, filled in by the user through the manifest
// `config_schema`. Gladys has no conditional fields: every field is always
// shown, the mode decides which ones are read.

export type BonapMode = 'install' | 'existing';

export interface BonapConfig {
  /** Mealie Bonap talks to, without trailing slash. */
  mealieUrl: string;
  mealieToken: string;
  bonapMode: BonapMode;
  /** Existing Bonap only, without trailing slash. */
  bonapUrl: string;
}

/** Must match the `default` values of the manifest `config_schema`. */
export const MANIFEST_DEFAULTS = {
  bonap_mode: 'install',
} as const;

const BONAP_MODES: readonly BonapMode[] = ['install', 'existing'];

export function normalizeConfig(raw: Record<string, unknown> = {}): BonapConfig {
  return {
    mealieUrl: normalizeUrl(raw.mealie_url),
    mealieToken: typeof raw.mealie_token === 'string' ? raw.mealie_token.trim() : '',
    bonapMode: BONAP_MODES.includes(raw.bonap_mode as BonapMode)
      ? (raw.bonap_mode as BonapMode)
      : MANIFEST_DEFAULTS.bonap_mode,
    bonapUrl: normalizeUrl(raw.bonap_url),
  };
}

function normalizeUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}
