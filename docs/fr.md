# Bonap pour Gladys Assistant

Bonap est un planificateur de repas construit sur [Mealie](https://mealie.io) (recettes et planning). Cette intégration :

- **installe Mealie et Bonap dans Gladys** si vous ne les avez pas encore, ou se connecte à ceux que vous avez déjà ;
- ajoute deux **widgets** au tableau de bord : « Prochain repas » et « Planning des repas » ;
- ajoute des **actions de scène** pour utiliser le menu dans vos scènes (message Telegram, annonce…).

## Configuration

### Mealie

- **Installer Mealie dans Gladys** (par défaut) : Gladys lance Mealie, crée un token API et remplace le mot de passe administrateur par défaut par un mot de passe aléatoire. Le bouton **« Afficher les identifiants Mealie »** vous donne l'email et le mot de passe pour vous connecter. Le premier démarrage peut prendre quelques minutes.
- **J'ai déjà Mealie** : renseignez l'URL de votre Mealie (joignable depuis la machine Gladys, donc pas `localhost`) et un token API (Mealie → Profil → Tokens API).

### Bonap

- **Installer Bonap dans Gladys** : Bonap est lancé et relié automatiquement à Mealie.
- **J'ai déjà Bonap** : renseignez son URL. Si elle est en `https://`, le widget propose un lien « Ouvrir Bonap ».
- **Pas de Bonap** : seul le widget est utilisé.

Les adresses de Mealie et de Bonap installés par Gladys sont affichées dans la section « Accès » et dans l'écran Supervision (liens « Ouvrir »).

## Widgets

Dans le tableau de bord, passez en édition et ajoutez un widget de la section Extensions :

- **Prochain repas** : le prochain créneau du planning Mealie (petit-déjeuner jusqu'à 10 h, déjeuner jusqu'à 14 h, goûter jusqu'à 17 h, dîner jusqu'à 21 h), avec la photo et la description de la recette. Réglage « Repas à afficher » : cochez par exemple seulement « Dîner » (vide = tous les repas).
- **Planning des repas** : les repas à venir sur 1 à 7 jours (réglage « Jours », 3 par défaut), 8 lignes au maximum.

Les widgets se mettent à jour toutes les 15 minutes.

## Scènes

Deux actions sont disponibles dans l'éditeur de scènes (carte « Bonap ») :

- **Obtenir le prochain repas** (champs : type de repas, langue) → résultats : `Repas trouvé`, `Nom du repas`, `Type de repas`, `Jour`, `Date`, `Résumé` (ex. « Aujourd'hui · Dîner : Poulet rôti »).
- **Obtenir les repas du jour** (champs : aujourd'hui ou demain, langue) → résultats : `Nombre de repas`, `Noms des repas`, `Résumé` (une ligne par repas, ex. « Déjeuner : Quiche »).

Exemple : déclencheur « Tous les jours à 11 h » → « Obtenir les repas du jour » → « Envoyer un message » avec le résumé en variable.

## Bon à savoir

- Mealie et Bonap installés par Gladys sont accessibles sur votre réseau local, **sans authentification côté Bonap** : n'exposez pas ces ports sur Internet.
- **Désinstaller l'intégration supprime toutes ses données, y compris la base Mealie.** Faites une sauvegarde depuis Mealie (Paramètres → Sauvegardes) avant.
- Mealie a besoin d'environ 1 Go de mémoire.
