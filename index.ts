// Entry point of the Bonap integration for Gladys: wires the SDK handlers to
// the use cases. Bonap (sub-container) is reconciled with its Mealie on every
// connection and configuration change; the shopping list widget and scene
// actions read and write the Bonap list in Mealie.

import { GladysIntegration, createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, type BonapConfig } from './src/domain/config/config.ts';
import { reconcileStack, type Message } from './src/application/stack/reconcileStack.ts';
import {
  ADD_TO_SHOPPING_LIST_ACTION,
  GET_SHOPPING_LIST_ACTION,
  addToShoppingList,
  readListName,
  readShoppingList,
  shoppingListOutputs,
} from './src/application/shopping/shoppingList.ts';
import { buildMessageContent } from './src/application/widget/common.ts';
import {
  SHOPPING_LIST_WIDGET,
  buildShoppingListContent,
} from './src/application/widget/shoppingListWidget.ts';
import type { MealieClient } from './src/infrastructure/mealie/MealieClient.ts';
import { StateStore } from './src/infrastructure/state/StateStore.ts';

const log = createLogger({ name: 'bonap' });
const gladys = new GladysIntegration();

const DATA_ROOT = process.env.BONAP_DATA_ROOT ?? '/data';
const store = new StateStore(`${DATA_ROOT}/state.json`);

let config: BonapConfig = normalizeConfig();
/** Authenticated Mealie client, null until the connection is checked. */
let mealie: MealieClient | null = null;
let reconciling: Promise<void> = Promise.resolve();

const NOT_READY: Message = {
  en: 'Bonap is not ready yet: check the integration configuration.',
  fr: "Bonap n'est pas encore prêt : vérifiez la configuration de l'intégration.",
};

/** Widget links need https: only an existing Bonap can have such a URL. */
function bonapUrl(): string | undefined {
  return config.bonapMode === 'existing' ? config.bonapUrl : undefined;
}

// --- Reconciliation ------------------------------------------------------------
// Serialized, and never awaited by the handlers (their ack must come back
// within 5 s).
function scheduleReconcile(reason: string): void {
  reconciling = reconciling
    .then(async () => {
      log.info(`Reconciling (${reason})`);
      const result = await reconcileStack(config, { containers: gladys, store });
      mealie = result.mealie;
      if (result.ok) {
        log.info(`Ready, Mealie at ${result.mealie.baseUrl}`);
        await gladys.setConnectionStatus(true);
      } else {
        log.warn(`Not ready: ${result.message.en}`);
        await gladys.setConnectionStatus(false, result.message);
      }
      refreshWidget();
    })
    .catch(async (err: unknown) => {
      log.error('Reconciliation failed', err);
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
    gladys.requestWidgetRefresh(SHOPPING_LIST_WIDGET);
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

// --- Dashboard widget ----------------------------------------------------------
gladys.onWidgetGet(SHOPPING_LIST_WIDGET, async ({ settings, language }) => {
  if (!mealie) return buildMessageContent(NOT_READY, language);
  const listName = readListName(settings);
  try {
    const items = await readShoppingList(mealie, listName);
    return buildShoppingListContent(items, listName, language, { bonapUrl: bonapUrl() });
  } catch (err) {
    log.warn('Unable to read the shopping list', err);
    return buildMessageContent(
      { en: 'Mealie is unreachable right now.', fr: 'Mealie est injoignable pour le moment.' },
      language,
    );
  }
});

// --- Scene actions -----------------------------------------------------------
// Throwing fails only this action: the scene logs it and goes on.
gladys.onSceneAction(ADD_TO_SHOPPING_LIST_ACTION, async (fields) => {
  if (!mealie) throw new Error(NOT_READY.en);
  const outputs = await addToShoppingList(mealie, fields);
  refreshWidget();
  return outputs;
});

gladys.onSceneAction(GET_SHOPPING_LIST_ACTION, async (fields) => {
  if (!mealie) throw new Error(NOT_READY.en);
  return shoppingListOutputs(await readShoppingList(mealie, readListName(fields)));
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
