# CapitAll

Application web mobile-first de suivi de patrimoine multi-actifs : cryptomonnaies, devises étrangères, métaux précieux et une sélection d'actions américaines.

CapitAll centralise les actifs suivis par l'utilisateur, enregistre ses transactions d'achat et de vente, récupère automatiquement les cours auprès d'API publiques et calcule le prix de revient moyen pondéré (PRU) et la plus-value latente, par actif et sur l'ensemble du portefeuille. Le tout est présenté dans un tableau de bord consolidé en euros.

Projet réalisé dans le cadre du Titre Professionnel Développeur Web et Web Mobile (DWWM, niveau 5).

## Fonctionnalités

- inscription et connexion sécurisées (JWT, bcrypt), cloisonnement strict des données par utilisateur
- gestion des actifs suivis sur quatre classes : crypto, devise, métal précieux, action
- enregistrement des transactions d'achat et de vente
- calcul automatique du PRU et de la plus-value latente
- tableau de bord consolidé : valeur totale, répartition, courbe d'évolution
- alertes de seuil (sur un actif ou sur le capital total)
- historique de valorisation journalière du portefeuille
- annonces internes publiées par l'administrateur

## Stack technique

| Brique | Choix |
|---|---|
| Front-end | React 18 + Vite, react-router (SPA mobile-first) |
| Back-end | Node.js + Express (API REST en couches) |
| Base de données | PostgreSQL (montants en NUMERIC) |
| Cache | Redis (cache court des cours externes) |
| Authentification | JWT + bcrypt |
| Déploiement | Docker + docker-compose |

Les cours sont récupérés exclusivement côté serveur, via des adaptateurs interchangeables par fournisseur (Coinbase, Frankfurter, gold-api.com, FMP). Les clés d'API résident dans un fichier `.env` non versionné.

## Structure du dépôt

```
backend/    API Express, schéma SQL, services métier
frontend/   application React (à initialiser)
docs/       cadrage, cahier des charges, conception, planning, conventions
```

## Documentation

- [Note de cadrage](docs/note-de-cadrage.md)
- [Cahier des charges](docs/cahier-des-charges.md)
- [Architecture](docs/conception/architecture.md)
- [Modèle de données](docs/conception/modele-de-donnees.md)
- [Cas d'utilisation](docs/conception/cas-utilisation.md)
- [Direction artistique](docs/conception/direction-artistique.md)
- [Planning](docs/planning.md)
- [Convention de commits](docs/convention-commits.md)

## Installation

Le projet est en cours de développement. La procédure d'installation complète (docker-compose, variables d'environnement, seed) sera documentée ici au fur et à mesure.
