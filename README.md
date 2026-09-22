# Bonap — intégration Gladys Assistant

Intégration externe [Gladys Assistant](https://gladysassistant.com) (≥ 5.1) pour [Bonap](https://github.com/AymericLeFeyer/bonap) et [Mealie](https://mealie.io) :

- demande à la configuration si l'utilisateur a déjà Mealie (URL + token) et Bonap (URL) ; **sinon, les installe dans Gladys** comme sous-conteneurs ;
- ajoute deux widgets de tableau de bord, **« Prochain repas »** et **« Planning des repas »** ;
- ajoute deux actions de scène, **« Obtenir le prochain repas »** et **« Obtenir les repas du jour »**.

```
┌──────────── réseau privé gladys-int-<selector> ──────────────┐
│  gladys-bonap (principal, Node 24 + SDK)                     │
│    ├─ réconcilie la config → start/stop des sous-conteneurs  │
│    ├─ bootstrap Mealie (token API + mot de passe aléatoire)  │
│    └─ widgets + actions de scène ──► API Mealie              │
│  mealie  (ghcr.io/mealie-recipes/mealie, port 9000)          │
│  bonap   (gladys-bonap-web = Bonap sans root, port 8080)     │
└──────────────────────────────────────────────────────────────┘
```

Doc utilisateur : [docs/fr.md](docs/fr.md) · [docs/en.md](docs/en.md). Doc technique : [CLAUDE.md](CLAUDE.md).

## Développement

```sh
npm install
npm test            # node --test (TypeScript exécuté directement par Node 24)
npm run typecheck   # tsc --noEmit
npm run lint
```

## Tester

### Étape 1 — Mealie et Bonap dans le sandbox Gladys (sans Gladys)

Le point le plus risqué est de savoir si Mealie et Bonap démarrent **sans aucune capability Linux**, comme Gladys lance ses sous-conteneurs. `docker-compose.sandbox.yml` reproduit ces contraintes (`cap_drop: ALL`, `no-new-privileges`, 100 pids, `/tmp` noexec).

Sur une machine Linux avec Docker (ou WSL / Docker Desktop) :

```sh
./scripts/sandbox.sh up            # lance Mealie dans le sandbox
npm run sandbox:bootstrap          # bootstrap de l'intégration : token + mot de passe aléatoire,
                                   # puis affiche le contenu du widget
MEALIE_TOKEN=<token affiché> ./scripts/sandbox.sh bonap   # build + lance Bonap sans root
```

À vérifier :

- `docker compose -f docker-compose.sandbox.yml logs mealie` : pas d'erreur `Operation not permitted` / `Permission denied`, Mealie répond sur http://localhost:9000 ;
- connexion à Mealie avec les identifiants affichés par le bootstrap, ajout d'une recette au planning, puis relance de `npm run sandbox:bootstrap` → le widget affiche ce repas ;
- Bonap répond sur http://localhost:8080 et affiche les recettes de Mealie.

`./scripts/sandbox.sh down` pour arrêter ; `sandbox-data/` contient les données (à supprimer pour repartir de zéro).

### Étape 2 — Dans Gladys (≥ 5.1), en mode développeur

Gladys utilise une image locale quand le pull échoue, **pour les installations en mode développeur uniquement**. Sur la machine qui fait tourner Gladys :

```sh
docker build -t gladys-bonap:dev .
docker build -t gladys-bonap-web:dev docker/bonap
npm run manifest:dev               # affiche le manifeste qui pointe vers ces images locales
```

Plus simple, si le repo et les images sont publiés : **Intégrations → Installer depuis GitHub**, URL `https://github.com/AymericLeFeyer/gladys-bonap` (Gladys lit le manifeste sur `main` et tire les images de ghcr — pas d'image locale dans ce mode).

Sinon, sans builder sur la machine Gladys : pousser le repo sur GitHub, lancer **Actions → Build and publish images → Run workflow** et copier le manifeste affiché dans le résumé du run.

Puis dans Gladys : **Intégrations → Installer depuis GitHub → Mode développeur**, coller l'image (`gladys-bonap:dev`) et le manifeste.

Scénarios à dérouler :

1. **Tout installer** (configuration par défaut) → statut « Démarrage de Mealie… » puis connecté ; dans Supervision, les conteneurs `mealie` et `bonap` tournent, avec les liens « Ouvrir » ; le bouton « Afficher les identifiants Mealie » donne email + mot de passe.
2. **Widget** → Tableau de bord → éditer → ajouter « Prochain repas » ; planifier un repas dans Mealie ou Bonap → il s'affiche (au plus tard 15 min après, ou tout de suite en rechargeant après une modification de config).
3. **Mealie existant** → passer en « J'ai déjà Mealie », URL + token d'un autre Mealie → le conteneur `mealie` s'arrête, le widget lit l'autre Mealie, Bonap est recréé vers cette URL.
4. **Pas de Bonap** → le conteneur `bonap` s'arrête, le widget fonctionne toujours.
5. **Redémarrer l'intégration** → aucun conteneur n'est relancé inutilement (les logs indiquent seulement « Stack ready »).
6. **Planning des repas** → ajouter le widget, régler 1 puis 7 jours.
7. **Scène** → déclencheur manuel → « Obtenir les repas du jour » → « Envoyer un message » avec la variable « Résumé ».

## Publication

1. Ajouter le topic GitHub `gladys-assistant-integration` au repo.
2. **Actions → Release → Run workflow** (patch / minor / major) : met à jour la version et les deux images dans `package.json` et le manifeste, crée le tag, publie `ghcr.io/aymericlefeyer/gladys-bonap` et `ghcr.io/aymericlefeyer/gladys-bonap-web` (amd64 + arm64).
3. Les packages ghcr doivent être **publics** (c'est le cas : ils héritent de la visibilité du repo public).

L'indexeur Gladys passe toutes les heures.
