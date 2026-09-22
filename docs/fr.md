# Bonap pour Gladys Assistant

Bonap est un planificateur de repas construit sur [Mealie](https://mealie.io) (recettes et planning). Cette intégration :

- **installe Mealie et Bonap dans Gladys** si vous ne les avez pas encore, ou se connecte à ceux que vous avez déjà ;
- ajoute un **widget « Prochain repas »** à votre tableau de bord.

## Configuration

### Mealie

- **Installer Mealie dans Gladys** (par défaut) : Gladys lance Mealie, crée un token API et remplace le mot de passe administrateur par défaut par un mot de passe aléatoire. Le bouton **« Afficher les identifiants Mealie »** vous donne l'email et le mot de passe pour vous connecter. Le premier démarrage peut prendre quelques minutes.
- **J'ai déjà Mealie** : renseignez l'URL de votre Mealie (joignable depuis la machine Gladys, donc pas `localhost`) et un token API (Mealie → Profil → Tokens API).

### Bonap

- **Installer Bonap dans Gladys** : Bonap est lancé et relié automatiquement à Mealie.
- **J'ai déjà Bonap** : renseignez son URL. Si elle est en `https://`, le widget propose un lien « Ouvrir Bonap ».
- **Pas de Bonap** : seul le widget est utilisé.

Les adresses de Mealie et de Bonap installés par Gladys sont affichées dans la section « Accès » et dans l'écran Supervision (liens « Ouvrir »).

## Widget « Prochain repas »

Dans le tableau de bord, ajoutez le widget **Prochain repas** (section Extensions). Il affiche le prochain créneau du planning Mealie (petit-déjeuner jusqu'à 10 h, déjeuner jusqu'à 14 h, dîner jusqu'à 21 h), avec la photo et la description de la recette.

## Bon à savoir

- Mealie et Bonap installés par Gladys sont accessibles sur votre réseau local, **sans authentification côté Bonap** : n'exposez pas ces ports sur Internet.
- **Désinstaller l'intégration supprime toutes ses données, y compris la base Mealie.** Faites une sauvegarde depuis Mealie (Paramètres → Sauvegardes) avant.
- Mealie a besoin d'environ 1 Go de mémoire.
