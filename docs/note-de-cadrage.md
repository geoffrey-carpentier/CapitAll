# Note de cadrage - CapitAll

## Contexte et objectif

De nombreux particuliers répartissent leur épargne entre plusieurs supports (cryptomonnaies, comptes titres, devises étrangères, métaux précieux) sans disposer d'une vue consolidée de leur patrimoine. Le suivi se fait généralement à la main, dans un tableur, avec des cours mis à jour manuellement et des calculs de plus-value approximatifs.

CapitAll est une application web mobile-first qui centralise ces différents actifs, automatise la récupération des cours et calcule le prix de revient et la plus-value latente de chaque ligne de portefeuille.

## Public cible

Particulier gérant un patrimoine diversifié sur plusieurs classes d'actifs, qui souhaite une vue d'ensemble sans ressaisir manuellement les cours.

## Périmètre fonctionnel du MVP

Fonctionnalités couvertes :

- inscription et connexion sécurisées, chaque utilisateur ne consulte et ne modifie que son propre patrimoine
- création, modification et suppression d'actifs suivis (cryptomonnaie, devise, métal précieux, et une liste blanche d'actions américaines)
- enregistrement de transactions d'achat et de vente sur un actif
- calcul automatique du prix de revient moyen pondéré par actif et de la plus-value latente, à partir des cours récupérés en temps réel
- tableau de bord de répartition du patrimoine et d'évolution de sa valeur
- alertes de seuil (sur un actif ou sur le capital total)
- historique de valorisation journalière du portefeuille
- fil d'annonces internes publiées par un administrateur
- fiche d'actif enrichie (capitalisation, fourchette 52 semaines, moyennes mobiles)

Hors périmètre du MVP, pistes d'évolution à mentionner à l'oral :

- recherche libre de symboles boursiers et ETF
- export fiscal
- multi-devise de référence
- notifications par email
- partage social, paiement, règles automatiques de trading
- publications par les utilisateurs, widget Coin360

## Rôles utilisateurs

Deux rôles : utilisateur inscrit (défaut) et administrateur à moindre privilège. Le cloisonnement des données patrimoniales repose sur une vérification de propriété systématique côté serveur. Le rôle administrateur permet la publication d'annonces, la liste et la désactivation de comptes, sans jamais accéder aux portefeuilles d'autrui.

## Choix technique et justification

- front-end : React avec Vite, react-router pour le routing
- back-end : Node.js avec Express, architecture en couches (routes, middlewares, contrôleurs, services, modèles)
- base de données : PostgreSQL, pour son typage NUMERIC qui évite les approximations de calcul flottant sur des montants financiers
- authentification : JWT, hachage des mots de passe avec bcrypt

Ce choix est cohérent avec la nature du projet : un tableau de bord interactif consommant des API JSON externes et destiné en priorité à un usage mobile se prête mieux à une architecture front et back séparés qu'à un rendu de pages côté serveur.

## Sources de données externes retenues

| Classe d'actif | Fournisseur(s) | Clé requise | Commentaires |
|---|---|---|---|
| Devises | Frankfurter (taux BCE) | non | Testée le 09/07/2026, réponse JSON conforme. |
| Métaux précieux | gold-api.com | non | Testée le 09/07/2026, réponse JSON conforme. |
| Cryptomonnaies | Coinbase (principal), CoinGecko Demo (repli) | non (Coinbase), oui (CoinGecko Demo) | Coinbase testé le 09/07/2026. CoinGecko Demo avec clé (D25). |
| Actions | FMP (principal), Finnhub (secours 1), Alpha Vantage (secours 2 + historique) | oui | Testés, FMP fournit le plus de données en un appel (D26). Liste blanche d'environ 85 valeurs américaines (D27). |

Chaque fournisseur est encapsulé derrière une interface commune côté serveur, pour ne pas coupler la logique métier (calcul du prix de revient, calcul de la plus-value) à un fournisseur en particulier.

## Sécurité

Le patrimoine financier étant une donnée sensible, une attention particulière sera portée à : requêtes préparées systématiques, validation des entrées côté serveur, hachage des mots de passe, protection des routes par middleware d'authentification, secrets et clés d'API dans un fichier .env exclu du dépôt, HTTPS en production.

## Prochaine étape

Conception détaillée : diagramme de cas d'utilisation, modèle conceptuel de données puis modèle logique et physique, schéma d'architecture, maquettes des écrans principaux (tableau de bord, ajout de transaction, détail d'un actif) en version desktop et mobile.
