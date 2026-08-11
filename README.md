# CapitAll

Application web de suivi de patrimoine multi-actifs, conçue pour le mobile en premier lieu. Elle réunit sur un même tableau de bord des cryptomonnaies, des devises étrangères, des métaux précieux et une sélection d'actions américaines.

CapitAll enregistre les transactions d'achat et de vente de l'utilisateur, récupère automatiquement les cours auprès de fournisseurs publics, puis calcule le prix de revient moyen pondéré, la plus-value latente et la plus-value réalisée, actif par actif et sur l'ensemble du portefeuille. L'objectif est de remplacer le tableur que tiennent à la main la plupart des épargnants diversifiés, avec des cours recopiés au gré des connexions et des calculs approximatifs.

Projet réalisé dans le cadre du titre professionnel Développeur Web et Web Mobile, niveau 5.

## Aperçu

<!-- Captures à insérer en fin de développement : tableau de bord desktop, tableau de bord mobile, détail d'un actif. Dossier docs/images/. -->

*Captures d'écran ajoutées à la finalisation de l'interface.*

## Fonctionnalités

**Portefeuille**

- suivi d'actifs sur quatre classes : cryptomonnaie, devise, métal précieux, action
- enregistrement des achats et des ventes, avec quantité, prix unitaire, frais et date
- calcul du prix de revient moyen pondéré, frais d'achat inclus
- distinction entre plus-value latente, sur ce qui est encore détenu, et plus-value réalisée, effectivement encaissée lors d'une vente
- tableau de bord consolidé : valeur totale, coût de revient, répartition par classe d'actif, courbe d'évolution
- affichage au choix en euro ou en dollar, sans recalcul ni appel supplémentaire

**Cours**

- récupération automatique auprès de fournisseurs publics, interrogés exclusivement côté serveur
- mise en cache avec des durées de vie adaptées à chaque classe d'actif
- repli sur le dernier cours connu lorsqu'un fournisseur est indisponible, signalé comme tel avec sa date

**Suivi**

- alertes de seuil sur le cours d'un actif ou sur le capital total, évaluées automatiquement
- historique de valorisation journalier, alimenté à la première consultation de chaque jour
- fil d'annonces internes publiées par l'administration

**Sécurité**

- authentification par jeton, mots de passe hachés
- cloisonnement strict des données par utilisateur, appliqué au niveau des requêtes de base de données
- trois niveaux de contrôle d'accès : authentification, propriété de la ressource, rôle

## Architecture

```
Navigateur (React 18 + Vite)
        |  requêtes JSON, jeton dans l'en-tête Authorization
        v
API REST (Node.js + Express)
   routes -> intergiciels -> contrôleurs -> services -> modèles
        |                          |                        |
        v                          v                        v
   PostgreSQL 16                Redis 7            Fournisseurs de cours
   données persistantes      cache des cours    (Coinbase, Frankfurter,
                                                  gold-api, FMP)
```

Les fournisseurs de cours ne sont jamais appelés depuis le navigateur. Chacun est encapsulé dans un adaptateur exposant une interface commune : la logique métier ignore lequel a répondu, et ajouter une classe d'actifs revient à écrire un adaptateur.

Description détaillée : [architecture](docs/conception/architecture.md).

## Stack technique

| Brique | Choix | Version |
|---|---|---|
| Interface | React, Vite, React Router | React 18 |
| Serveur | Node.js, Express | Node 20 |
| Base de données | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Authentification | jsonwebtoken, bcrypt | jeton HS256, validité 2 h |
| Validation | Zod | schémas partagés serveur et interface |
| Graphiques | Recharts | anneau et courbe d'aire |
| Tests | Vitest | tests unitaires des services, adaptateurs et validations |
| Conteneurisation | Docker, Docker Compose | services de développement |

## Structure du dépôt

```
backend/
  db/            schéma SQL et jeu de données de démonstration
  src/
    adaptateurs/ fournisseurs de cours, derrière une interface commune
    cache/       client Redis résilient
    config/      chargement et contrôle de la configuration
    controllers/ lecture de la requête, code de statut, forme de la réponse
    db/          groupe de connexions et requêtes paramétrées
    middlewares/ authentification, rôle, validation, gestion des erreurs
    models/      accès aux données, requêtes paramétrées exclusivement
    routes/      déclaration des points d'entrée
    services/    logique métier : calcul, portefeuille, cours, alertes
    utils/       arithmétique décimale exacte
    validation/  schémas d'entrée
frontend/        application React
docs/            cadrage, cahier des charges, conception, planning, conventions
docker-compose.yml
```

## Démarrage rapide

**Prérequis** : Node.js 20 ou supérieur, Docker et Docker Compose.

```bash
# 1. Configuration
cp .env.example .env                  # variables des services conteneurisés
cp backend/.env.example backend/.env  # variables de l'application
# renseigner POSTGRES_PASSWORD dans .env et JWT_SECRET dans backend/.env

# 2. Services de développement
docker compose up -d                  # PostgreSQL et Redis
docker compose ps                     # vérifier que les deux sont "healthy"

# 3. Base de données
psql -h localhost -p 5432 -U capitall -d capitall -f backend/db/schema.sql
psql -h localhost -p 5432 -U capitall -d capitall -f backend/db/seed.sql

# 4. Dépendances et lancement
npm run install:all
npm run dev                           # API et interface simultanément
```

L'API répond sur `http://localhost:5000`, route de santé `/api/sante`. L'interface est servie par Vite sur le port qu'il annonce au démarrage.

Le port de PostgreSQL est paramétrable par `POSTGRES_PORT` dans le fichier `.env` de la racine. C'est utile en pratique : une installation locale de PostgreSQL occupe fréquemment le port par défaut. Si vous le changez, ajustez `DATABASE_URL` en conséquence.

Le script de création exige un rôle propriétaire : il installe une extension et crée le rôle applicatif à moindre privilège utilisé ensuite par l'API.

## Configuration

Deux fichiers d'environnement distincts, aucun n'étant versionné. Chacun dispose d'un modèle commenté.

**`.env`** à la racine, consommé par Docker Compose :

| Variable | Rôle | Défaut |
|---|---|---|
| `POSTGRES_USER` | utilisateur de la base | aucun |
| `POSTGRES_PASSWORD` | mot de passe | aucun |
| `POSTGRES_DB` | nom de la base | aucun |
| `POSTGRES_PORT` | port publié sur le poste | 5432 |
| `REDIS_PORT` | port publié sur le poste | 6379 |

**`backend/.env`**, consommé par l'API :

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | chaîne de connexion PostgreSQL | oui |
| `JWT_SECRET` | secret de signature des jetons, 32 caractères minimum | oui |
| `JWT_EXPIRATION` | durée de validité des jetons | non, 2h |
| `REDIS_URL` | adresse du cache | non |
| `PORT` | port d'écoute de l'API | non, 5000 |
| `NODE_ENV` | environnement d'exécution | non, development |

Les variables obligatoires sont contrôlées au démarrage. Si l'une manque, le serveur s'arrête immédiatement en indiquant l'ensemble des variables manquantes, et non la première rencontrée. L'absence de `REDIS_URL` n'empêche pas le démarrage : le cache est une optimisation, pas une dépendance dure.

## Jeu de données de démonstration

Le script `backend/db/seed.sql` crée deux comptes, un portefeuille couvrant les quatre classes d'actifs, douze transactions, deux alertes, trois annonces et quatre-vingt-dix jours d'historique de valorisation.

Il est idempotent : il vide les tables avant de réinsérer, et peut donc être rejoué autant que nécessaire pour repartir d'un état propre. Les identifiants de démonstration figurent en tête du fichier.

## Tests

```bash
npm test --prefix backend        # exécution unique
npm run test:watch --prefix backend
```

Les tests portent sur ce qui contient de la logique : validation des entrées, intergiciels, arithmétique décimale, moteur de calcul, adaptateurs de cours, stratégie de cache et évaluation des alertes. Les services métier reçoivent leurs dépendances en paramètre, ce qui permet de les tester sans base de données, sans réseau et sans cache.

## Interface de programmation

| Domaine | Routes |
|---|---|
| Authentification | `POST /api/auth/inscription`, `POST /api/auth/connexion`, `GET /api/auth/moi` |
| Actifs | `GET POST /api/actifs`, `GET PATCH DELETE /api/actifs/:id` |
| Transactions | `POST /api/actifs/:id/transactions`, `DELETE /api/actifs/:id/transactions/:idTransaction` |
| Portefeuille | `GET /api/portefeuille`, `GET /api/portefeuille/historique` |
| Alertes | `GET POST /api/alertes`, `PATCH /api/alertes/:id` |

Toutes les routes privées attendent le jeton dans l'en-tête `Authorization: Bearer`. Une ressource inexistante et une ressource appartenant à un autre utilisateur renvoient toutes deux un code 404, afin de ne pas confirmer l'existence d'un identifiant.

Tableau complet avec les codes de statut : [cahier des charges, section 8](docs/cahier-des-charges.md).

## Quelques partis pris

**Aucun calcul monétaire en virgule flottante.** Les montants sont conservés en base dans un type numérique à précision arbitraire et manipulés côté serveur en entiers à échelle fixe. Additionner deux dixièmes ne produit jamais une valeur approchée, ce qui serait inacceptable sur un prix de revient.

**Le cloisonnement est porté par le SQL.** Aucune ressource n'est chargée puis comparée en JavaScript à l'utilisateur courant. Chaque requête filtre sur le propriétaire, et pour les transactions, dont la table ne porte pas d'identifiant d'utilisateur, le filtrage se fait par jointure à l'intérieur de la même requête. Une insertion sur un actif qui n'appartient pas au demandeur n'insère simplement rien.

**Le prix de revient n'est jamais stocké.** C'est une valeur dérivée des transactions, recalculée à chaque demande. La conserver en base créerait un risque d'incohérence permanent, toute correction d'une transaction ancienne rendant la valeur stockée fausse sans que rien ne le signale.

**L'historique de valorisation, en revanche, est stocké.** Il déroge volontairement à la règle précédente, parce qu'il n'est pas reconstituable après coup : retrouver la valeur du portefeuille à une date passée exigerait des cours qui ne sont pas conservés.

**Le cache n'est jamais une dépendance dure.** Si Redis est arrêté, l'application démarre et fonctionne, les cours étant demandés directement aux fournisseurs. Si un fournisseur tombe, le dernier cours connu est renvoyé, explicitement signalé comme tel.

## Documentation

| Document | Contenu |
|---|---|
| [Note de cadrage](docs/note-de-cadrage.md) | contexte, objectifs, périmètre initial |
| [Cahier des charges](docs/cahier-des-charges.md) | acteurs, exigences, règles de gestion, critères de recette |
| [Architecture](docs/conception/architecture.md) | couches, flux, adaptateurs |
| [Modèle de données](docs/conception/modele-de-donnees.md) | modèle conceptuel, logique et physique |
| [Cas d'utilisation](docs/conception/cas-utilisation.md) | acteurs et cas d'utilisation |
| [Direction artistique](docs/conception/direction-artistique.md) | palette, typographie, écrans |
| [Jeu d'essai](docs/jeu-essai-calculs.md) | déroulé détaillé du calcul du prix de revient et des plus-values |
| [Planning](docs/planning.md) | calendrier et jalons |
| [Convention de commits](docs/convention-commits.md) | format des messages et flux de contribution |

## Statut

Projet de formation, en cours de développement. Il n'est pas destiné à un usage réel : les cours proviennent de sources publiques gratuites sans engagement de disponibilité, et ne constituent pas une donnée contractuelle.
