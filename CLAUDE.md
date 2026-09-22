# CLAUDE.md — gladys-bonap

Dernière mise à jour : 2026-09-22. État : **v0.3** — Bonap seul (Mealie déplacé dans [gladys-mealie](https://github.com/AymericLeFeyer/gladys-mealie)). L'image `gladys-bonap-web` sans root a été validée sur un vrai Gladys en 0.2.0 ; la liste de courses n'a pas encore été testée en réel.

## 1. Projet

Intégration externe Gladys Assistant (≥ 5.1.0, type `provider`) nommée **Bonap**. Conteneur principal Node qui vérifie la connexion à un Mealie (URL + token saisis) et pilote le sous-conteneur `bonap` (image `gladys-bonap-web`), ou se branche sur un Bonap existant. Fournit le widget `shopping_list` et les actions de scène `add_to_shopping_list` / `get_shopping_list` sur la liste Mealie « Bonap » (celle que Bonap crée et utilise).

**Projet frère** : `gladys-mealie` (`C:\Users\lefey\Git\gladys-mealie`) installe Mealie, ses widgets repas et scènes menus, et fait la promo de Bonap (section `bonap`, action `bonap_token` qui donne URL + token à coller ici). `MealieClient`, `StateStore`, `containers.ts` sont **dupliqués** entre les deux repos (le client est réduit à la liste de courses ici).

Références : doc dev https://gladysassistant.com/docs/dev/external-integrations/ · SDK `@gladysassistant/integration-sdk` (README + `index.d.ts`) · specs du core dans `GladysAssistant/Gladys:docs/specs/external-integrations/` · Bonap : `C:\Users\lefey\Git\bonap` (liste « Bonap » : `ShoppingRepository.getOrCreateDefaultList`, ajout libre : `AddItemUseCase`).

## 2. Stack

Node 24 exécute le **TypeScript directement** (type stripping) : pas de build. `tsc --noEmit` pour le typecheck → **syntaxe effaçable seulement** (`erasableSyntaxOnly`), imports relatifs **avec l'extension `.ts`**. Tests `node --test "test/**/*.test.ts"`. ESLint + typescript-eslint + Prettier.

## 3. Structure (DDD léger)

```
index.ts                                     # câblage SDK : handlers, file de réconciliation sérialisée
src/domain/config/config.ts                  # BonapConfig { mealieUrl, mealieToken, bonapMode, bonapUrl }, normalizeConfig, MANIFEST_DEFAULTS
src/domain/shopping/ShoppingItem.ts          # ShoppingItem { id, text, checked, position, label }, BONAP_LIST_NAME, itemsToBuy
src/application/stack/containers.ts          # ContainerGateway, ensureRunning / ensureStopped ('bonap')
src/application/stack/reconcileStack.ts      # reconcileStack(config, { containers, store, createMealieClient? }) → { ok, mealie } | { ok: false, message }
src/application/shopping/shoppingList.ts     # readListName, readShoppingList, addToShoppingList, shoppingListOutputs
src/application/widget/common.ts             # toLang, truncate, httpsOnly, buildMessageContent, openBonapButton
src/application/widget/shoppingListWidget.ts # SHOPPING_LIST_WIDGET, buildShoppingListContent(items|null, listName, language, { bonapUrl })
src/infrastructure/mealie/MealieClient.ts    # getSelf, getShoppingLists, createShoppingList, getShoppingItems, addShoppingItem
src/infrastructure/state/StateStore.ts       # /data/state.json : hash d'env du conteneur bonap
docker/bonap/Dockerfile                      # image gladys-bonap-web (FROM ghcr.io/aymericlefeyer/bonap:<BONAP_VERSION>)
docker-compose.sandbox.yml + scripts/        # sandbox Gladys sans Gladys (Mealie de test + Bonap), manifeste dev
```

## 4. Manifeste

- `config_schema` : `intro` (promo Bonap + lien), `mealie_help` (section → intégration Mealie + bouton « Créer un token pour Bonap »), `mealie_url` (**required**), `mealie_token` (secret, **required**), `bonap_mode` radio `install` (défaut) | `existing`, `bonap_url`, `access` (`{{port:bonap_ui}}`).
- `actions` : `test_connection`.
- `widgets` : `shopping_list` (icône `shopping-cart`, setting `list_name` string défaut `Bonap`).
- `scene_actions` : `add_to_shopping_list` (fields `item` string required — variables de scène acceptées —, `quantity` number, `list_name` → outputs `added`, `count`), `get_shopping_list` (field `list_name` → `count`, `summary` « • article » par ligne).
- `containers` : `bonap` (`ghcr.io/aymericlefeyer/gladys-bonap-web:<version>`, manual, volume `/data`, 256 Mo, port 8080 nommé `bonap_ui`).

**Clés publiées = définitives.** Nouveau champ `required` d'une action de scène → toujours avec `default`.

## 5. Use cases

- `reconcileStack` : URL/token manquants → message qui renvoie vers l'intégration Mealie ; hôte `localhost` / `127.0.0.1` / `mealie` → refus expliqué (réseaux Gladys séparés) ; `getSelf()` (401 → token refusé) ; puis `ensureRunning('bonap', { VITE_MEALIE_URL, VITE_MEALIE_TOKEN })` ou `ensureStopped('bonap')`.
- `readShoppingList(mealie, listName)` → articles non cochés triés par `position`, **null si la liste n'existe pas** (le widget affiche alors l'état vide).
- `addToShoppingList(mealie, fields)` : crée la liste si absente (comme Bonap), ajoute un article libre (`isFood: false`, `quantity` seulement si > 0), renvoie `{ added: true, count }`. Article vide → throw (échec de cette action seulement).

## 6. Endpoints Mealie utilisés

| Méthode | Endpoint                                                                                                            | Usage                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET     | `/api/users/self`                                                                                                   | test du token                                                                                         |
| GET     | `/api/households/shopping/lists?page=1&perPage=-1`                                                                  | listes → `{ items: [{ id, name }] }`                                                                  |
| POST    | `/api/households/shopping/lists` `{ name }`                                                                         | création de la liste                                                                                  |
| GET     | `/api/households/shopping/lists/{id}`                                                                               | `listItems[]` (`display`, `note`, `checked`, `position`, `label.name`) — filtrer sur `shoppingListId` |
| POST    | `/api/households/shopping/items/create-bulk` `[{ shoppingListId, note, isFood: false, checked: false, quantity? }]` | ajout                                                                                                 |

## 7. Points d'attention

- **Bonap sans capabilities** : nginx root → `setuid`/`initgroups` impossibles sans capabilities → `docker/bonap/Dockerfile` retire `user`, pid dans `/tmp`, écoute sur **8080**, `chown 1000` de conf.d / html / cache / `/data`, `USER 1000`. Validé sur un vrai Gladys. Mettre à jour `BONAP_VERSION` à chaque version de Bonap.
- **Intégrations isolées** : Bonap ne résout pas `mealie:9000` de l'intégration Mealie → `http://<IP de la machine>:<port publié>`. Le conteneur Bonap (bridge Docker) joint ce port publié via l'IP LAN de l'hôte.
- **Port hôte choisi par Gladys** (pas 8080) : Supervision (« Ouvrir Bonap »), section `access` (résolue au chargement de l'écran seulement).
- **`startContainer` redémarre toujours** → `ensureRunning` compare un hash de l'env + `status === 'running'`.
- **Secrets** : le token Mealie passe par l'`env` runtime de `startContainer`, jamais par le manifeste. Bonap l'injecte côté nginx : **Bonap installé = accès complet à Mealie sans authentification sur le LAN** (documenté).
- **Widget** : TTL 300 s + `requestWidgetRefresh` après un ajout par scène ; liens **https uniquement** ; `value` tile + card-list (≤ 8 lignes) + caption de débordement ; `validateWidgetContent` dans les tests.
- **Migration depuis 0.2.0** (Mealie + Bonap dans la même intégration) : le sous-conteneur `mealie` a disparu du manifeste → désinstaller l'ancienne intégration puis installer Mealie + Bonap (les données du Mealie de test sont perdues).
- **Versions** : `package.json`, `version` du manifeste, tag de `docker_image` et tag de l'image `bonap` doivent être identiques (test + release.yml).
- **Install depuis GitHub** : manifeste lu sur `main`, images **obligatoirement tirées** du registre → publier la release avant de pousser un manifeste qui les référence.
