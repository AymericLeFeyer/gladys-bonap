# CLAUDE.md — gladys-bonap

Dernière mise à jour : 2026-09-22. État : **v0.2** — installation Mealie par Gladys et mode « Mealie existant » validés sur un vrai Gladys le 2026-09-22 ; widgets `meal_plan` et actions de scène pas encore testés en réel.

## 1. Projet

Intégration externe Gladys Assistant (≥ 5.1.0, type `provider`) nommée **Bonap**. Conteneur principal Node qui pilote deux sous-conteneurs déclarés dans le manifeste : `mealie` (image officielle) et `bonap` (image `gladys-bonap-web`, Bonap adapté au sandbox). Fournit les widgets dashboard `next_meal` et `meal_plan`, et les actions de scène `get_next_meal` et `get_day_meals`.

Références : doc dev https://gladysassistant.com/docs/dev/external-integrations/ · SDK `@gladysassistant/integration-sdk` (README = doc la plus complète, types dans `index.d.ts`) · specs du core dans `GladysAssistant/Gladys:docs/specs/external-integrations/` (contrats manifeste, descripteur de conteneur, superviseur).

## 2. Stack

Node 24 exécute le **TypeScript directement** (type stripping) : pas de build. `tsc --noEmit` uniquement pour le typecheck → **syntaxe effaçable seulement** (`erasableSyntaxOnly` : pas d'enum, pas de parameter properties, pas de namespace), imports relatifs **avec l'extension `.ts`**. Tests `node --test "test/**/*.test.ts"`. ESLint 10 + typescript-eslint + Prettier (config du template officiel).

## 3. Structure (DDD léger)

```
index.ts                                   # câblage SDK : handlers, file de réconciliation sérialisée
src/domain/config/config.ts                # BonapConfig, normalizeConfig(raw), MANIFEST_DEFAULTS
src/domain/meal/MealPlanEntry.ts           # MealPlanEntry { id, date YYYY-MM-DD, entryType, title, recipe: MealRecipe|null }
src/domain/meal/nextMeal.ts                # findNextMeal(entries, now, types?), upcomingEntries, mealsOfDay, sortEntries, toLocalDay, addDays (pur)
src/domain/meal/labels.ts                  # toLang(language), entryTypeLabel, mealName, dayLabel ("Aujourd'hui" / "Demain" / "Jeudi 24 septembre")
src/application/stack/containers.ts        # ContainerGateway (sous-ensemble SDK), ensureRunning / ensureStopped
src/application/stack/reconcileStack.ts    # reconcileStack(config, deps) → StackResult
src/application/mealie/bootstrapMealie.ts  # prepareMealieDataDir, waitForMealie, bootstrapMealie
src/application/widget/common.ts           # TTL_SECONDS (900), mealCard, buildMessageContent, httpsOnly, recipeImageKey/parseRecipeImageKey, openBonapButton
src/application/widget/nextMealWidget.ts   # NEXT_MEAL_WIDGET, buildNextMealContent(next, now, language, {bonapUrl}), readMealTypes(settings)
src/application/widget/mealPlanWidget.ts   # MEAL_PLAN_WIDGET, buildMealPlanContent(entries, now, days, language, {bonapUrl}), readPlanDays(settings)
src/application/scene/sceneActions.ts      # GET_NEXT_MEAL_ACTION / GET_DAY_MEALS_ACTION, getNextMealOutputs / getDayMealsOutputs (entries, now, fields)
src/infrastructure/mealie/MealieClient.ts  # client HTTP Mealie (fetch, timeout 10 s), MealieApiError(status)
src/infrastructure/state/StateStore.ts     # /data/state.json (0600) : identifiants Mealie gérés + hash d'env des conteneurs
docker/bonap/Dockerfile                    # image gladys-bonap-web (FROM ghcr.io/aymericlefeyer/bonap:<BONAP_VERSION>)
docker-compose.sandbox.yml + scripts/      # reproduction du sandbox Gladys sans Gladys, bootstrap, manifeste dev
```

## 4. Configuration (`config_schema`)

| Clé                          | Type                                                    | Rôle                                                                            |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `mealie_mode`                | select radio `install` (défaut) \| `existing`           | Mealie installé par Gladys ou existant                                          |
| `mealie_url`, `mealie_token` | string, secret                                          | lus seulement en `existing`                                                     |
| `bonap_mode`                 | select radio `install` (défaut) \| `existing` \| `none` |                                                                                 |
| `bonap_url`                  | string                                                  | `existing` seulement ; sert de lien du widget **si https**                      |
| `intro`, `access`            | section                                                 | `access` utilise `{{gladys_host}}` + `{{port:mealie_ui}}` / `{{port:bonap_ui}}` |

Gladys **n'a pas de champs conditionnels** : tous les champs sont toujours affichés, les libellés disent quand les remplir.

Actions : `test_connection` (getSelf), `mealie_credentials` (email + mot de passe du Mealie géré, lus dans state.json).

## 5. Use cases

- `reconcileStack(config, { containers, store, dataRoot, mealieBootTimeoutMs, createMealieClient?, onProgress? })` → `{ ok: true, mealie }` | `{ ok: false, message: {en, fr}, mealie: null }`. Ordre : Mealie (install → `prepareMealieDataDir` + `ensureRunning('mealie', {})` + `waitForMealie` + `bootstrapMealie` ; existing → `ensureStopped('mealie')`) → `getSelf()` → Bonap (`ensureRunning('bonap', { VITE_MEALIE_URL, VITE_MEALIE_TOKEN })` ou `ensureStopped`). Appelé sur `connected` et `onConfigUpdated`, **jamais awaité dans un handler** (ack 5 s), sérialisé par une promesse chaînée dans index.ts.
- `bootstrapMealie(client, store, generatePassword?)` : idempotent (retourne state.mealie s'il existe). Login `changeme@example.com` / `MyPassword` → `POST /api/users/api-tokens` → **persiste le token avant** de changer le mot de passe → `PUT /api/users/password`. 401 au login → `MealieAlreadyInitializedError`.
- `findNextMeal(entries, now)` : créneaux `breakfast` <10 h, `lunch` <14 h, `snack` <17 h, `dinner`/`side`/`dessert` <21 h, `drink`/inconnu → fin de journée ; regroupe toutes les entrées du même (jour, créneau).

- `getNextMealOutputs(entries, now, { meal_type: 'any'|<entryType>, language: 'fr'|'en' })` → `{ found, name, meal_type, day, date, summary }` (plusieurs plats du même créneau joints par « + »).
- `getDayMealsOutputs(entries, now, { day: 'today'|'tomorrow', language })` → `{ count, names, summary }` (une ligne « Créneau : plats » par créneau, créneaux passés inclus).
- Widgets et actions de scène lisent tous le planning **aujourd'hui → aujourd'hui + 7** (`fetchMealPlan` dans index.ts).

## 6. Widgets et actions de scène (manifeste)

| Clé             | Type                      | Réglages / champs                                           | Sortie                                                                     |
| --------------- | ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `next_meal`     | widget (icône `coffee`)   | `meal_types` multi_select (vide = tous)                     | texte caption « Jour · Créneau » + card-list (≤ 8) + bouton Bonap si https |
| `meal_plan`     | widget (icône `calendar`) | `days` select `"1"`…`"7"`, défaut `"3"`                     | card-list list ≤ 8 lignes (sous-titre = jour) + caption si tronqué         |
| `get_next_meal` | scene action (20 s)       | `meal_type` select (défaut `any`), `language` (défaut `fr`) | found, name, meal_type, day, date, summary                                 |
| `get_day_meals` | scene action (20 s)       | `day` today/tomorrow, `language`                            | count, names, summary                                                      |

**Les clés publiées sont définitives** (renommer = casser les scènes/dashboards existants). Ajouter un champ `required` sans `default` à une action = breaking. Valeurs de settings de widget = chaînes (d'où `"3"`). Pas de scene trigger : un déclencheur horaire Gladys + une action suffit.

## 6 bis. Endpoints Mealie utilisés

| Méthode | Endpoint                                                            | Usage                                   |
| ------- | ------------------------------------------------------------------- | --------------------------------------- |
| GET     | `/api/app/about`                                                    | sonde de démarrage (sans auth)          |
| POST    | `/api/auth/token` (form `username`, `password`)                     | login admin par défaut → `access_token` |
| POST    | `/api/users/api-tokens` `{ name }`                                  | → `{ token }`                           |
| PUT     | `/api/users/password` `{ currentPassword, newPassword ≥ 8 }`        |                                         |
| GET     | `/api/users/self`                                                   | test du token                           |
| GET     | `/api/households/mealplans?start_date=&end_date=&page=1&perPage=-1` | planning → `{ items }`                  |
| GET     | `/api/media/recipes/{id}/images/min-original.webp`                  | vignette du widget                      |

## 7. SDK Gladys utilisé

`getConfig`, `onConfigUpdated`, `setConnectionStatus(bool, {en, fr})`, `getContainers` (`{ name, status, desired, ports }`), `startContainer(name, { env })`, `stopContainer`, `onAction`, `onWidgetGet(key)` (`{ settings, language }`), `onWidgetGetImage`, `onSceneAction(key)` (throw = échec de cette action seulement), `requestWidgetRefresh` (1 / 10 s max, lève si déconnecté → try/catch), `handleShutdown`, `createLogger`.

## 8. Points d'attention

- **Sandbox des sous-conteneurs** : `CapDrop ALL` + `no-new-privileges`, réseau privé `gladys-int-<selector>` (alias DNS = `name`, d'où `http://mealie:9000`), pas de variables `GLADYS_*`, rootfs read-only par défaut (`read_only: false` pour mealie et bonap). Volumes montés depuis `<base>/external-integrations/<selector>/containers/<name><path>` → visibles par le principal sous `/data/containers/<name>/…`.
- **Mealie** : l'entrypoint officiel fait `chown` + `gosu` vers PUID quand il tourne en root → impossible sans capabilities. `PUID=PGID=0` dans le manifeste fait sauter ce changement d'utilisateur (`[ "$(id -u)" = $PUID ]`). Root sans `CAP_DAC_OVERRIDE` ne peut pas écrire dans le dossier uid 1000 créé par Gladys → `prepareMealieDataDir` fait `chmod 777` sur `/data/containers/mealie/app/data` **avant** le start. Si ça casse avec une future image Mealie : image dérivée avec `USER 1000` + `PUID=1000`.
- **Bonap** : nginx root → workers `setuid(nginx)`/`initgroups` impossibles sans capabilities. `docker/bonap/Dockerfile` retire `user`, met le pid dans `/tmp`, écoute sur **8080**, `chown 1000` de conf.d / html / cache / `/data` (settings BFF), `USER 1000`. Mettre à jour `BONAP_VERSION` quand Bonap sort une version.
- **`startContainer` redémarre toujours** (et recrée si l'env change) → `ensureRunning` compare un hash de l'env stocké dans state.json + `status === 'running'` pour ne pas relancer Mealie/Bonap à chaque reconnexion.
- **Secrets** : jamais dans le manifeste (public). Token Mealie → `env` runtime de `startContainer` ; identifiants gérés → `/data/state.json`.
- **Widgets** : images ≤ 300 Ko, clé `^[a-z0-9][a-z0-9-]{0,63}$` et cache 1 h par clé → clé `r-<recipeId>-<sha1(image)[0:8]>` ; liens et boutons **https uniquement** (une URL Bonap en http n'est jamais liée) ; budget 8 composants / 1 focal. `validateWidgetContent` du SDK est utilisé dans les tests.
- **Désinstallation = suppression de `/data`, donc de la base Mealie**. Documenté dans docs/*.md.
- **Versions** : `package.json`, `version` du manifeste, tag de `docker_image` et tag de l'image `bonap` du manifeste doivent être identiques (test `manifest.test.ts`, bumpés ensemble par release.yml).
- Messages affichés par Gladys = texte brut échappé, seuls les `\n` sont interprétés.
- **Scene actions** : outputs = scalaires uniquement, filtrés par la liste `outputs` du manifeste (test `sceneActions.test.ts` vérifie que les clés retournées = clés déclarées, y compris l'état vide).
- **Cover** : `cover.png` (800×534, < 150 Ko, logo Bonap sur fond #FFF4E6) servie depuis `raw.githubusercontent.com/.../main/cover.png`.
- **Install depuis GitHub (repo_url)** : Gladys lit le manifeste sur la branche par défaut et **pull obligatoirement** les images (pas de repli sur une image locale, contrairement au mode développeur) → toujours publier les images (release) avant de pousser un manifeste qui les référence.
