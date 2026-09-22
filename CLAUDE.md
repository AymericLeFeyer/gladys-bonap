# CLAUDE.md — gladys-bonap

Dernière mise à jour : 2026-09-22. État : **POC** (non testé dans un vrai Gladys).

## 1. Projet

Intégration externe Gladys Assistant (≥ 5.1.0, type `provider`) nommée **Bonap**. Conteneur principal Node qui pilote deux sous-conteneurs déclarés dans le manifeste : `mealie` (image officielle) et `bonap` (image `gladys-bonap-web`, Bonap adapté au sandbox). Fournit le widget dashboard `next_meal`.

Références : doc dev https://gladysassistant.com/docs/dev/external-integrations/ · SDK `@gladysassistant/integration-sdk` (README = doc la plus complète, types dans `index.d.ts`) · specs du core dans `GladysAssistant/Gladys:docs/specs/external-integrations/` (contrats manifeste, descripteur de conteneur, superviseur).

## 2. Stack

Node 24 exécute le **TypeScript directement** (type stripping) : pas de build. `tsc --noEmit` uniquement pour le typecheck → **syntaxe effaçable seulement** (`erasableSyntaxOnly` : pas d'enum, pas de parameter properties, pas de namespace), imports relatifs **avec l'extension `.ts`**. Tests `node --test "test/**/*.test.ts"`. ESLint 10 + typescript-eslint + Prettier (config du template officiel).

## 3. Structure (DDD léger)

```
index.ts                                   # câblage SDK : handlers, file de réconciliation sérialisée
src/domain/config/config.ts                # BonapConfig, normalizeConfig(raw), MANIFEST_DEFAULTS
src/domain/meal/MealPlanEntry.ts           # MealPlanEntry { id, date YYYY-MM-DD, entryType, title, recipe: MealRecipe|null }
src/domain/meal/nextMeal.ts                # findNextMeal(entries, now), toLocalDay, addDays (pur)
src/application/stack/containers.ts        # ContainerGateway (sous-ensemble SDK), ensureRunning / ensureStopped
src/application/stack/reconcileStack.ts    # reconcileStack(config, deps) → StackResult
src/application/mealie/bootstrapMealie.ts  # prepareMealieDataDir, waitForMealie, bootstrapMealie
src/application/widget/nextMealWidget.ts   # buildNextMealContent, buildMessageContent, recipeImageKey/parseRecipeImageKey
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

## 6. Endpoints Mealie utilisés

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

`getConfig`, `onConfigUpdated`, `setConnectionStatus(bool, {en, fr})`, `getContainers` (`{ name, status, desired, ports }`), `startContainer(name, { env })`, `stopContainer`, `onAction`, `onWidgetGet('next_meal')`, `onWidgetGetImage`, `requestWidgetRefresh` (1 / 10 s max, lève si déconnecté → try/catch), `handleShutdown`, `createLogger`.

## 8. Points d'attention

- **Sandbox des sous-conteneurs** : `CapDrop ALL` + `no-new-privileges`, réseau privé `gladys-int-<selector>` (alias DNS = `name`, d'où `http://mealie:9000`), pas de variables `GLADYS_*`, rootfs read-only par défaut (`read_only: false` pour mealie et bonap). Volumes montés depuis `<base>/external-integrations/<selector>/containers/<name><path>` → visibles par le principal sous `/data/containers/<name>/…`.
- **Mealie** : l'entrypoint officiel fait `chown` + `gosu` vers PUID quand il tourne en root → impossible sans capabilities. `PUID=PGID=0` dans le manifeste fait sauter ce changement d'utilisateur (`[ "$(id -u)" = $PUID ]`). Root sans `CAP_DAC_OVERRIDE` ne peut pas écrire dans le dossier uid 1000 créé par Gladys → `prepareMealieDataDir` fait `chmod 777` sur `/data/containers/mealie/app/data` **avant** le start. Si ça casse avec une future image Mealie : image dérivée avec `USER 1000` + `PUID=1000`.
- **Bonap** : nginx root → workers `setuid(nginx)`/`initgroups` impossibles sans capabilities. `docker/bonap/Dockerfile` retire `user`, met le pid dans `/tmp`, écoute sur **8080**, `chown 1000` de conf.d / html / cache / `/data` (settings BFF), `USER 1000`. Mettre à jour `BONAP_VERSION` quand Bonap sort une version.
- **`startContainer` redémarre toujours** (et recrée si l'env change) → `ensureRunning` compare un hash de l'env stocké dans state.json + `status === 'running'` pour ne pas relancer Mealie/Bonap à chaque reconnexion.
- **Secrets** : jamais dans le manifeste (public). Token Mealie → `env` runtime de `startContainer` ; identifiants gérés → `/data/state.json`.
- **Widget** : images ≤ 300 Ko, clé `^[a-z0-9][a-z0-9-]{0,63}$` et cache 1 h par clé → clé `r-<recipeId>-<sha1(image)[0:8]>` ; liens et boutons **https uniquement** (une URL Bonap en http n'est jamais liée) ; budget 8 composants / 1 focal. `validateWidgetContent` du SDK est utilisé dans les tests.
- **Désinstallation = suppression de `/data`, donc de la base Mealie**. Documenté dans docs/*.md.
- **Versions** : `package.json`, `version` du manifeste, tag de `docker_image` et tag de l'image `bonap` du manifeste doivent être identiques (test `manifest.test.ts`, bumpés ensemble par release.yml).
- Messages affichés par Gladys = texte brut échappé, seuls les `\n` sont interprétés.
