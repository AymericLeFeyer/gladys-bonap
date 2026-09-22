import type { BonapConfig } from '../../domain/config/config.ts';
import { MealieApiError, MealieClient } from '../../infrastructure/mealie/MealieClient.ts';
import type { StateStore } from '../../infrastructure/state/StateStore.ts';
import {
  MealieAlreadyInitializedError,
  bootstrapMealie,
  prepareMealieDataDir,
  waitForMealie,
} from '../mealie/bootstrapMealie.ts';
import { type ContainerGateway, ensureRunning, ensureStopped } from './containers.ts';

// A type alias (not an interface) so it stays assignable to the SDK's
// MultiLanguageMessage (Record<string, string>).
export type Message = {
  en: string;
  fr: string;
};

/** DNS alias of the Mealie sub-container on the integration's private network. */
export const INTERNAL_MEALIE_URL = 'http://mealie:9000';

export interface StackDeps {
  containers: ContainerGateway;
  store: StateStore;
  /** Root of the integration volume (`/data` in the container). */
  dataRoot: string;
  /** How long to wait for a fresh Mealie (first boot runs migrations). */
  mealieBootTimeoutMs: number;
  createMealieClient?: (url: string, token?: string) => MealieClient;
  /** Progress shown while the stack converges (status stays "disconnected"). */
  onProgress?: (message: Message) => Promise<void>;
}

export type StackResult =
  { ok: true; mealie: MealieClient } | { ok: false; message: Message; mealie: null };

const fail = (message: Message): StackResult => ({ ok: false, message, mealie: null });

/**
 * Converges the containers towards the configuration: Mealie installed or
 * reached remotely, Bonap installed or not, then checks the Mealie API.
 */
export async function reconcileStack(config: BonapConfig, deps: StackDeps): Promise<StackResult> {
  const createClient =
    deps.createMealieClient ?? ((url: string, token?: string) => new MealieClient(url, token));

  let mealieUrl: string;
  let mealieToken: string;

  if (config.mealieMode === 'install') {
    await prepareMealieDataDir(deps.dataRoot);
    const restarted = await ensureRunning(deps.containers, deps.store, 'mealie', {});
    if (restarted) {
      await deps.onProgress?.({
        en: 'Starting Mealie (the first start can take a few minutes)…',
        fr: 'Démarrage de Mealie (le premier lancement peut prendre quelques minutes)…',
      });
    }
    const anonymous = createClient(INTERNAL_MEALIE_URL);
    if (!(await waitForMealie(anonymous, { timeoutMs: deps.mealieBootTimeoutMs }))) {
      return fail({
        en: 'Mealie did not start in time. Check the "mealie" container logs in Supervision.',
        fr: "Mealie n'a pas démarré à temps. Consultez les logs du conteneur « mealie » dans Supervision.",
      });
    }
    try {
      const credentials = await bootstrapMealie(anonymous, deps.store);
      mealieToken = credentials.apiToken;
    } catch (err) {
      if (err instanceof MealieAlreadyInitializedError) {
        return fail({
          en: 'This Mealie was already initialized outside the integration: switch to "I already have Mealie" and enter a token.',
          fr: "Ce Mealie a déjà été initialisé hors de l'intégration : passez en « J'ai déjà Mealie » et saisissez un token.",
        });
      }
      throw err;
    }
    mealieUrl = INTERNAL_MEALIE_URL;
  } else {
    await ensureStopped(deps.containers, 'mealie');
    if (!config.mealieUrl || !config.mealieToken) {
      return fail({
        en: 'Enter the URL and API token of your Mealie.',
        fr: "Renseignez l'URL et le token API de votre Mealie.",
      });
    }
    mealieUrl = config.mealieUrl;
    mealieToken = config.mealieToken;
  }

  const mealie = createClient(mealieUrl, mealieToken);
  try {
    await mealie.getSelf();
  } catch (err) {
    if (err instanceof MealieApiError && err.status === 401) {
      return fail({
        en: 'Mealie rejected the API token.',
        fr: 'Mealie a refusé le token API.',
      });
    }
    return fail({
      en: `Mealie is unreachable at ${mealieUrl}.`,
      fr: `Mealie est injoignable à l'adresse ${mealieUrl}.`,
    });
  }

  if (config.bonapMode === 'install') {
    // Runtime env: the token never goes through the (public) manifest.
    await ensureRunning(deps.containers, deps.store, 'bonap', {
      VITE_MEALIE_URL: mealieUrl,
      VITE_MEALIE_TOKEN: mealieToken,
    });
  } else {
    await ensureStopped(deps.containers, 'bonap');
  }

  return { ok: true, mealie };
}
