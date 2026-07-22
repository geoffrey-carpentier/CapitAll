# Note de cadrage - CapitAll

## Contexte et objectif

De nombreux particuliers répartissent leur épargne entre plusieurs supports (cryptomonnaies, comptes titres, devises étrangères, métaux précieux) sans disposer d'une vue consolidée de leur patrimoine. Le suivi se fait généralement à la main, dans un tableur, avec des cours mis à jour manuellement et des calculs de plus-value approximatifs.

CapitAll est une application web mobile-first qui centralise ces différents actifs, automatise la récupération des cours et calcule le prix de revient et la plus-value latente de chaque ligne de portefeuille.

## Public cible

Particulier gérant un patrimoine diversifié sur plusieurs classes d'actifs, qui souhaite une vue d'ensemble sans ressaisir manuellement les cours.

## Périmètre fonctionnel du MVP

Fonctionnalités couvertes :

- inscription et connexion sécurisées, chaque utilisateur ne consulte et ne modifie que son propre patrimoine
- création, modification et suppression d'actifs suivis (cryptomonnaie, devise, métal précieux)
- enregistrement de transactions d'achat et de vente sur un actif
- calcul automatique du prix de revient moyen pondéré par actif
- calcul de la plus-value latente par actif et sur l'ensemble du portefeuille, à partir des cours récupérés en temps réel
- tableau de bord de répartition du patrimoine et d'évolution de sa valeur

Hors périmètre du MVP, pistes d'évolution à mentionner à l'oral :

- suivi des actions et produits boursiers (nécessite un compte sur un fournisseur de données financières, voir section suivante)
- alertes de seuil de prix
- export fiscal
- affichage multi-devise de référence

Le choix d'écarter la bourse du MVP est délibéré : les fournisseurs de données boursières libres nécessitent tous une inscription et une clé d'API, ce qui introduit une dépendance externe non maîtrisée à ce stade. La crypto, les devises et les métaux couvrent déjà les trois classes d'actifs dont les API sont accessibles sans inscription, ce qui suffit à démontrer la logique métier (même moteur de calcul, trois fournisseurs de cours interchangeables) sans complexifier le MVP.

## Rôles utilisateurs

Un seul rôle : utilisateur inscrit. Le cloisonnement des données repose sur une vérification de propriété systématique côté serveur (l'identifiant de l'utilisateur authentifié doit correspondre au propriétaire de la ressource demandée), plutôt que sur une hiérarchie de rôles artificielle.

## Choix technique et justification

- front-end : React avec Vite, react-router pour le routing
- back-end : Node.js avec Express, architecture routes/controllers/models
- base de données : PostgreSQL, pour son typage NUMERIC qui évite les approximations de calcul flottant sur des montants financiers
- authentification : JWT, hachage des mots de passe avec bcrypt

Ce choix est cohérent avec la nature du projet : un tableau de bord interactif consommant des API JSON externes et destiné en priorité à un usage mobile se prête mieux à une architecture front et back séparés qu'à un rendu de pages côté serveur.

## Sources de données externes retenues

| Classe d'actif | Fournisseur | Clé requise | Vérification |
|---|---|---|---|
| Devises | Frankfurter (taux BCE) | non | testée le 09/07/2026, réponse JSON conforme |
| Métaux précieux | gold-api.com | non | testée le 09/07/2026, réponse JSON conforme |
| Cryptomonnaies | Coinbase (exchange-rates) | non | testée le 09/07/2026, réponse JSON conforme |
| Bourse (extension) | Finnhub ou Alpha Vantage | oui, gratuite sans CB | non testée depuis l'environnement de développement actuel, à confirmer lors de l'inscription |

Chaque fournisseur sera encapsulé derrière une interface commune côté serveur, pour ne pas coupler la logique métier (calcul du prix de revient, calcul de la plus-value) à un fournisseur en particulier.

## Sécurité

Le patrimoine financier étant une donnée sensible, une attention particulière sera portée à : requêtes préparées systématiques, validation des entrées côté serveur, hachage des mots de passe, protection des routes par middleware d'authentification, secrets et clés d'API dans un fichier .env exclu du dépôt, HTTPS en production.

## Prochaine étape

Conception détaillée : diagramme de cas d'utilisation, modèle conceptuel de données puis modèle logique et physique, schéma d'architecture, maquettes des écrans principaux (tableau de bord, ajout de transaction, détail d'un actif) en version desktop et mobile.
