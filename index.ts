// Entry point of the Bonap integration for Gladys: wires the SDK handlers to
// the use cases. The stack (Mealie + Bonap sub-containers) is reconciled on
// every connection and configuration change; the widget reads the meal plan.

import { GladysIntegration, createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, type BonapConfig } from './src/domain/config/config.ts';
import { addDays, findNextMeal, toLocalDay } from './src/domain/meal/nextMeal.ts';
import { reconcileStack, type Message } from './src/application/stack/reconcileStack.ts';
import {
  NEXT_MEAL_WIDGET,
  buildMessageContent,
  buildNextMealContent,
  parseRecipeImageKey,
} from './src/application/widget/nextMealWidget.ts';
import type { MealieClient } from './src/infrastructure/mealie/MealieClient.ts';
import { StateStore } from './src/infrastructure/state/StateStore.ts';

const log = createLogger({ name: 'bonap' });
const gladys = new GladysIntegration();

const DATA_ROOT = process.env.BONAP_DATA_ROOT ?? '/data';
const store = new StateStore(`${DATA_ROOT}/state.json`);
const MAX_IMAGE_BYTES = 300 * 1024;

let config: BonapConfig = normalizeConfig();
/** Authenticated Mealie client, null until the stack is ready. */
let mealie: MealieClient | null = null;
let reconciling: Promise<void> = Promise.resolve();

const NOT_READY: Message = {
  en: 'Bonap is not ready yet: check the integration configuration.',
  fr: "Bonap n'est pas encore prêt : vérifiez la configuration de l'intégration.",
};

// --- Stack reconciliation ------------------------------------------------------
// Serialized: a config change during a (long) first Mealie boot waits for the
// current run instead of racing it. Never awaited by the handlers, whose ack
// must come back within 5 s.
function scheduleReconcile(reason: string): void {
  reconciling = reconciling
    .then(async () => {
      log.info(`Reconciling the stack (${reason})`);
      const result = await reconcileStack(config, {
        containers: gladys,
        store,
        dataRoot: DATA_ROOT,
        mealieBootTimeoutMs: 10 * 60_000,
        onProgress: (message) => gladys.setConnectionStatus(false, message).then(() => {}),
      });
      mealie = result.mealie;
      if (result.ok) {
        log.info(`Stack ready, Mealie at ${result.mealie.baseUrl}`);
        await gladys.setConnectionStatus(true);
      } else {
        log.warn(`Stack not ready: ${result.message.en}`);
        await gladys.setConnectionStatus(false, result.message);
      }
      refreshWidget();
    })
    .catch(async (err: unknown) => {
      log.error('Stack reconciliation failed', err);
      mealie = null;
      await gladys
        .setConnectionStatus(false, {
          en: 'Setup failed, check the integration logs.',
          fr: "L'installation a échoué, consultez les logs de l'intégration.",
        })
        .catch(() => {});
    });
}

function refreshWidget(): void {
  try {
    gladys.requestWidgetRefresh(NEXT_MEAL_WIDGET);
  } catch (err) {
    log.debug('Widget refresh nudge dropped', err);
  }
}

gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
  } catch (err) {
    log.error('Unable to read the configuration', err);
  }
  scheduleReconcile('connected');
});

gladys.onConfigUpdated((newConfig) => {
  config = normalizeConfig(newConfig);
  scheduleReconcile('configuration updated');
});

// --- Configuration screen actions ---------------------------------------------
gladys.onAction('test_connection', async () => {
  if (!mealie) return NOT_READY;
  const self = await mealie.getSelf();
  return {
    en: `Connected to Mealie (${mealie.baseUrl}) as ${self.username || self.email}.`,
    fr: `Connecté à Mealie (${mealie.baseUrl}) en tant que ${self.username || self.email}.`,
  };
});

gladys.onAction('mealie_credentials', async () => {
  const credentials = (await store.read()).mealie;
  if (config.mealieMode !== 'install' || !credentials) {
    return {
      en: 'No Mealie installed by Gladys: use the credentials of your own Mealie.',
      fr: 'Aucun Mealie installé par Gladys : utilisez les identifiants de votre Mealie.',
    };
  }
  return {
    en: `Email: ${credentials.email}\nPassword: ${credentials.password}\nYou can change them in Mealie > Profile.`,
    fr: `Email : ${credentials.email}\nMot de passe : ${credentials.password}\nVous pouvez les modifier dans Mealie > Profil.`,
  };
});

// --- Dashboard widget ----------------------------------------------------------
gladys.onWidgetGet(NEXT_MEAL_WIDGET, async ({ language }) => {
  if (!mealie) return buildMessageContent(NOT_READY, language);
  const now = new Date();
  try {
    const entries = await mealie.getMealPlans(toLocalDay(now), toLocalDay(addDays(now, 7)));
    return buildNextMealContent(findNextMeal(entries, now), now, language, {
      bonapUrl: config.bonapMode === 'existing' ? config.bonapUrl : undefined,
    });
  } catch (err) {
    log.warn('Unable to read the meal plan', err);
    return buildMessageContent(
      { en: 'Mealie is unreachable right now.', fr: 'Mealie est injoignable pour le moment.' },
      language,
    );
  }
});

gladys.onWidgetGetImage(async (imageKey) => {
  const recipeId = parseRecipeImageKey(imageKey);
  if (!recipeId || !mealie) throw new Error(`Unknown image ${imageKey}`);
  const image = await mealie.getRecipeThumbnail(recipeId);
  if (image.length > MAX_IMAGE_BYTES) throw new Error(`Image ${imageKey} too large`);
  return image.toString('base64');
});

// --- Lifecycle -----------------------------------------------------------------
gladys.handleShutdown((signal) => {
  log.info(`Received ${signal}, shutting down`);
});

log.info('Starting the Bonap integration…');
gladys.connect().catch((err: unknown) => {
  log.error('Initial connection failed', err);
  process.exit(1);
});
