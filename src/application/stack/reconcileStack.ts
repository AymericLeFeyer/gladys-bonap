import type { BonapConfig } from '../../domain/config/config.ts';
import { MealieApiError, MealieClient } from '../../infrastructure/mealie/MealieClient.ts';
import type { StateStore } from '../../infrastructure/state/StateStore.ts';
import { type ContainerGateway, ensureRunning, ensureStopped } from './containers.ts';

// A type alias (not an interface) so it stays assignable to the SDK's
// MultiLanguageMessage (Record<string, string>).
export type Message = {
  en: string;
  fr: string;
};

export interface StackDeps {
  containers: ContainerGateway;
  store: StateStore;
  createMealieClient?: (url: string, token: string) => MealieClient;
}

export type StackResult =
  { ok: true; mealie: MealieClient } | { ok: false; message: Message; mealie: null };

const fail = (message: Message): StackResult => ({ ok: false, message, mealie: null });

/**
 * Addresses that cannot work from the Bonap container: `localhost` is the
 * container itself, and `mealie` only resolves on the private network of the
 * Mealie integration — each Gladys integration has its own.
 */
function unreachableByDesign(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ['localhost', '127.0.0.1', '::1', 'mealie'].includes(hostname);
  } catch {
    return true;
  }
}

/**
 * Checks the Mealie connection, then converges the Bonap sub-container:
 * started with that Mealie (install mode) or stopped (existing Bonap).
 */
export async function reconcileStack(config: BonapConfig, deps: StackDeps): Promise<StackResult> {
  const createClient =
    deps.createMealieClient ?? ((url: string, token: string) => new MealieClient(url, token));

  if (!config.mealieUrl || !config.mealieToken) {
    return fail({
      en: 'Enter the URL and API token of your Mealie. No Mealie yet? Install the Mealie integration, then use its "Create a token for Bonap" button.',
      fr: "Renseignez l'URL et le token API de votre Mealie. Pas encore de Mealie ? Installez l'intégration Mealie, puis utilisez son bouton « Créer un token pour Bonap ».",
    });
  }
  if (unreachableByDesign(config.mealieUrl)) {
    return fail({
      en: 'This Mealie URL cannot be reached from Bonap: use the IP address of the machine running Mealie (e.g. http://192.168.1.10:38123), not localhost nor mealie:9000.',
      fr: "Cette URL de Mealie n'est pas joignable depuis Bonap : utilisez l'adresse IP de la machine qui fait tourner Mealie (ex. http://192.168.1.10:38123), pas localhost ni mealie:9000.",
    });
  }

  const mealie = createClient(config.mealieUrl, config.mealieToken);
  try {
    await mealie.getSelf();
  } catch (err) {
    if (err instanceof MealieApiError && err.status === 401) {
      return fail({ en: 'Mealie rejected the API token.', fr: 'Mealie a refusé le token API.' });
    }
    return fail({
      en: `Mealie is unreachable at ${config.mealieUrl}.`,
      fr: `Mealie est injoignable à l'adresse ${config.mealieUrl}.`,
    });
  }

  if (config.bonapMode === 'install') {
    // Runtime env: the token never goes through the (public) manifest.
    await ensureRunning(deps.containers, deps.store, 'bonap', {
      VITE_MEALIE_URL: config.mealieUrl,
      VITE_MEALIE_TOKEN: config.mealieToken,
    });
  } else {
    await ensureStopped(deps.containers, 'bonap');
  }

  return { ok: true, mealie };
}
