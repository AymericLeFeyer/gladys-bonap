# Bonap — intégration Gladys Assistant

<p align="center"><img src="cover.png" alt="Bonap" width="480"></p>

**[Bonap](https://github.com/AymericLeFeyer/bonap), l'interface conviviale pour [Mealie](https://mealie.io), dans [Gladys Assistant](https://gladysassistant.com) (≥ 5.1).** Planning des repas en quelques clics, recettes, liste de courses avec « Habituels », statistiques et suggestions IA.

- **installe Bonap dans Gladys** comme sous-conteneur, relié à un Mealie (URL + token), ou se branche sur un Bonap existant ;
- widget de tableau de bord **« Liste de courses »** ;
- actions de scène **« Ajouter à la liste de courses »** et **« Obtenir la liste de courses »**.

> 🥕 **Pas encore de Mealie ?** L'intégration sœur [gladys-mealie](https://github.com/AymericLeFeyer/gladys-mealie) l'installe en un clic (et ajoute les widgets « Prochain repas » / « Planning des repas »). Son bouton **« Créer un token pour Bonap »** donne l'URL et le token à coller ici.

```
┌── intégration Mealie ──────────┐        ┌── intégration Bonap (ce repo) ───────────┐
│ mealie (port publié par Gladys)│◄───────│ gladys-bonap (principal)                 │
│ widgets repas, scènes menus    │ http:// │   ├─ vérifie Mealie, pilote le conteneur │
└────────────────────────────────┘ <IP>:  │   └─ widget + scènes liste de courses    │
                                    port  │ bonap (gladys-bonap-web, port 8080)      │
                                          └──────────────────────────────────────────┘
```

Deux intégrations Gladys ne peuvent pas se parler directement (réseaux privés séparés) : Bonap joint Mealie par l'IP de la machine et le port publié.

Doc utilisateur : [docs/fr.md](docs/fr.md) · [docs/en.md](docs/en.md). Doc technique : [CLAUDE.md](CLAUDE.md).

## Développement

```sh
npm install
npm test            # node --test (TypeScript exécuté directement par Node 24)
npm run typecheck   # tsc --noEmit
npm run lint
```

## Tester

**Sans Gladys** : `docker-compose.sandbox.yml` reproduit le sandbox des sous-conteneurs Gladys (`cap_drop: ALL`, `no-new-privileges`, 100 pids, `/tmp` noexec) avec un Mealie de test.

```sh
./scripts/sandbox.sh up                             # Mealie → http://localhost:9000 (changeme@example.com / MyPassword)
MEALIE_TOKEN=<token créé dans Mealie> ./scripts/sandbox.sh bonap   # Bonap sans root → http://localhost:8080
```

**Dans Gladys** :

1. installer l'intégration Mealie (`https://github.com/AymericLeFeyer/gladys-mealie`) et cliquer sur « Créer un token pour Bonap » ;
2. **Intégrations → Installer depuis GitHub**, URL `https://github.com/AymericLeFeyer/gladys-bonap` (manifeste lu sur `main`, images tirées de ghcr : publier une release d'abord) ;
3. coller l'URL (avec l'IP de la machine Gladys) et le token ; le statut passe à connecté, Supervision montre `bonap` avec « Ouvrir Bonap » ;
4. ajouter le widget « Liste de courses », puis une scène manuelle « Ajouter à la liste de courses » → l'article apparaît dans Bonap et dans le widget.

Pour des images construites localement : `docker build -t gladys-bonap:dev .`, `docker build -t gladys-bonap-web:dev docker/bonap`, `npm run manifest:dev`, puis **Mode développeur** dans la même fenêtre.

## Publication

1. **Actions → Release → Run workflow** (patch / minor / major) : met à jour la version et les deux images dans `package.json` et le manifeste, crée le tag, publie `ghcr.io/aymericlefeyer/gladys-bonap` et `ghcr.io/aymericlefeyer/gladys-bonap-web` (amd64 + arm64).
2. Topic GitHub `gladys-assistant-integration` pour apparaître dans le catalogue Gladys (indexeur horaire).
