# Bonap pour Gladys Assistant

**[Bonap](https://github.com/AymericLeFeyer/bonap) est l'interface conviviale pour [Mealie](https://mealie.io)** : planning des repas de la semaine en quelques clics, recettes avec photos, liste de courses avec vos « Habituels », statistiques et suggestions de repas par IA. Cette intégration :

- **installe Bonap dans Gladys**, relié à votre Mealie (ou se branche sur un Bonap que vous avez déjà) ;
- ajoute le widget **« Liste de courses »** au tableau de bord ;
- ajoute des **actions de scène** : ajouter un article à la liste de courses, obtenir la liste (pour l'envoyer par message, par exemple).

## Avant de commencer : Mealie

Bonap enregistre tout dans Mealie. **Pas encore de Mealie ?** Installez l'[intégration Mealie](https://github.com/AymericLeFeyer/gladys-mealie) depuis le catalogue Gladys : elle installe Mealie en un clic et ajoute les widgets « Prochain repas » et « Planning des repas ». Dans sa configuration, cliquez sur **« Créer un token pour Bonap »** : elle affiche l'URL de Mealie et un token API à coller ici.

## Configuration

- **URL de Mealie** : joignable depuis la machine Gladys, donc une adresse IP (ex. `http://192.168.1.10:38123`), **pas** `localhost` ni `mealie:9000` (chaque intégration Gladys a son propre réseau). Avec l'intégration Mealie, remplacez `<adresse IP de Gladys>` par l'adresse de votre machine Gladys.
- **Token API Mealie** : Mealie → Profil → Tokens API, ou le bouton de l'intégration Mealie.
- **Bonap** :
  - **Installer Bonap dans Gladys** (par défaut) : Bonap est lancé et relié à Mealie. Son adresse est affichée dans la section « Accès » et dans l'écran Supervision (lien « Ouvrir Bonap ») : Gladys choisit lui-même le port.
  - **J'ai déjà Bonap** : renseignez son URL. Si elle est en `https://`, le widget propose un lien « Ouvrir Bonap ».

## Widget « Liste de courses »

Dans le tableau de bord, passez en édition et ajoutez **Liste de courses** (section Extensions) : le nombre d'articles à acheter et les 8 premiers, avec leur rayon. Réglage « Liste de courses » : le nom de la liste Mealie (« Bonap » par défaut, celle qu'utilise Bonap). Mise à jour toutes les 5 minutes et après chaque ajout par une scène.

## Scènes

- **Ajouter à la liste de courses** (champs : article — les variables de scène sont acceptées —, quantité, liste) → résultats : `Article ajouté`, `Articles à acheter`. La liste est créée si elle n'existe pas.
- **Obtenir la liste de courses** (champ : liste) → résultats : `Articles à acheter`, `Liste` (un article par ligne, « • lait »).

Exemples : un bouton « Plus de lait » qui ajoute « Lait » ; en partant du travail, recevoir la liste de courses sur Telegram.

## Bon à savoir

- Bonap installé par Gladys est accessible sur votre réseau local **sans authentification** (le token Mealie est ajouté côté serveur) : n'exposez pas son port sur Internet.
- Les suggestions IA se configurent dans Bonap → Paramètres (clé de votre fournisseur IA, stockée dans votre navigateur).
