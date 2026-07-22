# Cahier des charges - CapitAll

Version de travail, non définitive. Structure adaptée d'un template de cahier des charges d'entreprise : les rubriques orientées contexte d'entreprise (RBAC multi-rôles, benchmarks de charge) ont été réduites ou reformulées, CapitAll étant un projet individuel réalisé en formation, sans commanditaire externe et avec un unique rôle utilisateur (décision D7). Les rubriques ainsi adaptées sont signalées explicitement.

## 1. Synopsis

CapitAll est une application web mobile-first de suivi de patrimoine multi-actifs. Elle s'adresse à un particulier qui répartit son épargne entre cryptomonnaies, devises étrangères et métaux précieux, et qui aujourd'hui tient ce suivi manuellement dans un tableur, avec des cours recopiés à la main et des calculs de plus-value approximatifs.

L'application centralise les actifs suivis par l'utilisateur sur quatre classes (cryptomonnaies, devises, métaux précieux et, depuis la révision du 16/07/2026 - D20, une sélection d'actions américaines), enregistre ses transactions d'achat et de vente, récupère automatiquement les cours auprès de fournisseurs externes encapsulés en adaptateurs (Coinbase, Frankfurter, gold-api.com sans clé ; FMP avec Finnhub et Alpha Vantage en secours pour les actions, D26) et calcule pour chaque actif et pour l'ensemble du portefeuille le prix de revient moyen pondéré (PRU) et la plus-value latente, présentés dans un tableau de bord consolidé en euros. Quatre fonctionnalités complémentaires enrichissent le MVP : des alertes de seuil (sur un actif ou sur le capital total), un historique de valorisation journalière du portefeuille, un fil d'annonces internes publiées par l'administrateur (D22) et une fiche d'actif enrichie (D27).

Contexte de réalisation : projet individuel réalisé pendant la formation au Titre Professionnel Développeur Web et Web Mobile (DWWM, niveau 5), sans expression de besoin d'un commanditaire réel. Le projet doit permettre de démontrer les 8 compétences professionnelles du REAC V04, en particulier la modélisation et l'exploitation d'une base de données relationnelle, le développement de composants métier sécurisés et l'intégration de services externes.

## 2. Cahier des charges client - Front-end

### Cahier des charges fonctionnel

**Besoin.** L'utilisateur doit pouvoir, depuis un mobile ou un ordinateur, consulter en un coup d'œil la valeur de son patrimoine et sa performance, sans ressaisir de cours ni recalculer lui-même son prix de revient. L'interface doit rester lisible en usage mobile en premier lieu (le tableur qu'elle remplace est aujourd'hui consulté depuis un ordinateur, l'ambition de CapitAll est de le rendre consultable n'importe où).

**User stories.**

- En tant que visiteur, je veux créer un compte avec mon email et un mot de passe, afin d'accéder à mon propre espace. Contrainte de validation : email au format valide et non déjà utilisé, mot de passe d'une longueur minimale imposée côté client et revalidée côté serveur, message d'erreur explicite en cas d'email déjà pris.
- En tant qu'utilisateur inscrit, je veux me connecter avec mon email et mon mot de passe, afin de retrouver mon portefeuille. Contrainte de validation : message d'erreur générique en cas d'échec (ne pas révéler si c'est l'email ou le mot de passe qui est incorrect), verrouillage du bouton de soumission pendant l'appel réseau.
- En tant qu'utilisateur connecté, je veux ajouter un actif que je souhaite suivre (crypto, devise ou métal, symbole, nom), afin de commencer à enregistrer mes transactions dessus. Contrainte de validation : impossible d'ajouter deux fois le même symbole (unicité utilisateur/symbole), type restreint aux trois valeurs autorisées.
- En tant qu'utilisateur connecté, je veux enregistrer une transaction d'achat ou de vente sur un actif suivi (quantité, prix unitaire, frais, date), afin que mon PRU et ma plus-value soient recalculés automatiquement. Contrainte de validation : quantité et prix strictement positifs, impossibilité de vendre une quantité supérieure à celle détenue, date non future.
- En tant qu'utilisateur connecté, je veux consulter le détail d'un actif (historique des transactions, PRU, plus-value latente, cours courant), afin de suivre sa performance individuelle.
- En tant qu'utilisateur connecté, je veux voir sur la fiche d'un actif ses informations de contexte (capitalisation, fourchette sur 52 semaines et position actuelle dans cette fourchette, moyennes mobiles 50 et 200 jours, secteur, place de cotation), afin de situer ma position sans quitter l'application. Contrainte : ces données proviennent de la même réponse que le cours, aucun appel supplémentaire ; elles sont absentes pour les devises et les métaux, la fiche s'adapte donc au type d'actif.
- En tant qu'utilisateur connecté, je veux consulter un tableau de bord consolidé (valeur totale, répartition par classe d'actif, courbe d'évolution), afin d'avoir une vue d'ensemble de mon patrimoine.
- En tant qu'utilisateur connecté, je veux définir une alerte sur le prix d'un actif ou sur mon capital total, afin d'être informé sans avoir à consulter l'application en continu. Contrainte de validation : un seuil doit être strictement positif, une alerte doit cibler soit un actif précis soit le capital total, jamais les deux ni aucun des deux.
- En tant qu'utilisateur connecté, je veux consulter et désactiver mes alertes, afin de garder leur liste pertinente.
- En tant qu'utilisateur connecté, je veux visualiser l'évolution de la valeur de mon portefeuille dans le temps, afin de juger de la performance globale de mes choix.
- En tant qu'utilisateur connecté, je veux consulter les annonces publiées par l'équipe CapitAll, afin d'être informé des évolutions du service. Contrainte : lecture seule, annonces épinglées en tête.
- En tant qu'administrateur, je veux publier, modifier, épingler et supprimer des annonces, afin de communiquer avec les utilisateurs. Contrainte de validation : titre et contenu obligatoires, action réservée au rôle admin (middleware de rôle).
- En tant qu'administrateur, je veux lister les comptes et désactiver un compte en cas d'abus, sans jamais accéder au détail des portefeuilles, afin d'assurer la gestion du service dans le respect du moindre privilège.

### Cahier des charges non fonctionnel

**Routes (SPA React Router).**

| Route | Accès | Contenu |
|---|---|---|
| `/connexion` | public | formulaire de connexion |
| `/inscription` | public | formulaire d'inscription |
| `/tableau-de-bord` | authentifié | vue consolidée, alertes déclenchées, courbe d'évolution |
| `/actifs` | authentifié | liste des actifs suivis |
| `/actifs/:id` | authentifié, propriétaire | détail d'un actif, historique des transactions |
| `/actifs/:id/transactions/nouvelle` | authentifié, propriétaire | formulaire d'ajout de transaction |
| `/alertes` | authentifié | gestion des alertes |

**Contraintes de sécurité.** Jeton JWT conservé côté client (choix définitif à trancher entre stockage mémoire avec rafraîchissement silencieux et `httpOnly` cookie : le stockage en mémoire, sans persistance en `localStorage`, est recommandé pour limiter l'exposition en cas de faille XSS), en-tête `Authorization: Bearer` sur chaque appel privé, redirection vers `/connexion` si le jeton est absent ou expiré, échappement systématique de tout contenu utilisateur affiché (React échappe par défaut, vigilance particulière sur les champs `note` de transaction).

**Accessibilité.** RGAA appliqué dès l'intégration : contrastes 4,5:1 minimum (validés par la palette de `conception/direction-artistique.md`), labels explicites sur tous les champs de formulaire, navigation clavier complète, plus-value jamais portée par la seule couleur (signe et flèche systématiques).

**Déploiement.** Build Vite statique, servi par un conteneur Nginx léger en production ou par le serveur de développement Vite en local ; orchestré avec le back-end via docker-compose (voir cahier des charges back-end). Pas de pipeline CI/CD complexe prévu pour le MVP au-delà de l'exécution des tests avant fusion sur `main` ; une automatisation GitHub Actions minimale (lint + tests) reste une amélioration possible, non bloquante pour l'examen.

## 3. Cahier des charges client - Back-end

### Cahier des charges fonctionnel

**Besoin.** *Rubrique adaptée* : le template envisage un dimensionnement multi-utilisateurs avec charge simultanée à évaluer. CapitAll est un projet individuel destiné à une démonstration devant un jury, pas à une mise en production à grande échelle : le nombre d'utilisateurs simultanés réels sera de un (le candidat lui-même, en démonstration), avec un jeu de données de démonstration représentatif plutôt qu'un volume réaliste de production. Le back-end reste néanmoins conçu sans dette technique bloquante pour une montée en charge ultérieure raisonnable : requêtes indexées, pas de calcul en O(n²) dans les services métier.

### Cahier des charges non fonctionnel

**Stack.** Node.js (LTS) et Express pour l'API REST, PostgreSQL 15+ pour la persistance relationnelle, Redis pour le cache des cours (D14, TTL différenciés par classe D21), JWT (bibliothèque `jsonwebtoken`) et bcrypt pour l'authentification. Fournisseurs de cours : Coinbase (crypto), Frankfurter (devises), gold-api.com (métaux), FMP pour les actions avec Finnhub puis Alpha Vantage en secours (D20, D26), CoinGecko Demo en repli crypto (D25). Liste blanche d'environ 85 valeurs américaines contrôlée côté serveur (D27).

**MCD.** Six entités : utilisateur, actif, transaction, alerte, snapshot_valorisation, annonce. Schéma complet, cardinalités et diagramme Mermaid : `conception/modele-de-donnees.md`. Script de création : `../backend/db/schema.sql`.

**Endpoints (draft, à affiner en phase de développement).**

| Méthode | Route | Auth | Description | Codes de statut |
|---|---|---|---|---|
| POST | `/api/auth/inscription` | non | création de compte | 201, 400, 409 |
| POST | `/api/auth/connexion` | non | authentification, émission du JWT | 200, 400, 401 |
| GET | `/api/actifs` | oui | liste des actifs de l'utilisateur | 200, 401 |
| POST | `/api/actifs` | oui | création d'un actif suivi | 201, 400, 401, 409 |
| GET | `/api/actifs/:id` | oui, propriétaire | détail d'un actif, PRU, plus-value | 200, 401, 403, 404 |
| DELETE | `/api/actifs/:id` | oui, propriétaire | suppression d'un actif (cascade) | 204, 401, 403, 404 |
| POST | `/api/actifs/:id/transactions` | oui, propriétaire | enregistrement d'une transaction | 201, 400, 401, 403, 404 |
| GET | `/api/portefeuille` | oui | tableau de bord consolidé | 200, 401 |
| GET | `/api/portefeuille/historique` | oui | snapshots de valorisation | 200, 401 |
| GET | `/api/alertes` | oui | liste des alertes de l'utilisateur | 200, 401 |
| POST | `/api/alertes` | oui | création d'une alerte | 201, 400, 401, 403 |
| PATCH | `/api/alertes/:id` | oui, propriétaire | désactivation d'une alerte | 200, 401, 403, 404 |
| GET | `/api/annonces` | oui | liste des annonces (épinglées en tête) | 200, 401 |
| POST | `/api/annonces` | oui, admin | publication d'une annonce | 201, 400, 401, 403 |
| PATCH | `/api/annonces/:id` | oui, admin | modification / épinglage | 200, 400, 401, 403, 404 |
| DELETE | `/api/annonces/:id` | oui, admin | suppression d'une annonce | 204, 401, 403, 404 |
| GET | `/api/admin/comptes` | oui, admin | liste des comptes (sans données patrimoniales) | 200, 401, 403 |
| PATCH | `/api/admin/comptes/:id` | oui, admin | désactivation d'un compte | 200, 401, 403, 404 |

Chaque endpoint documentera son DTO d'entrée et de sortie au fil du développement (collection Insomnia comme preuve d'examen, voir plan du dossier de projet).

**Contraintes de sécurité.**

- Authentification JWT signé, durée de vie courte à définir (proposition : 2 heures, sans refresh token pour le MVP, l'utilisateur se reconnecte au-delà), hachage bcrypt des mots de passe.
- *Rôles* : deux rôles applicatifs depuis la révision du 16/07/2026 (D23) : `utilisateur` (défaut) et `admin` à moindre privilège (annonces, liste/désactivation de comptes, statistiques agrégées ; jamais d'accès aux données patrimoniales d'autrui). Trois niveaux de contrôle d'accès : authentification (JWT valide), propriété (la ressource appartient au demandeur, règle inchangée de D7), rôle (routes d'administration). Le champ `role` n'est accepté dans aucune entrée utilisateur : assignation par seed ou SQL direct uniquement.
- Validation systématique des entrées côté serveur (bibliothèque de schémas à choisir, ex. Zod ou Joi), requêtes préparées exclusivement, CORS restreint au domaine du front.
- Clés d'API des fournisseurs d'actions (FMP, Finnhub, Alpha Vantage) et de CoinGecko exclusivement en `.env`, jamais exposées au front : les cours sont toujours servis par le back.
- Le dépôt Git est limité au dossier applicatif (D28) : les sujets d'examen, les clés et les documents de pilotage restent physiquement hors du dossier versionné, ce qui rend une publication accidentelle impossible indépendamment du `.gitignore`.
- **RGPD**, adapté à un MVP à faible volume de données personnelles : les seules données à caractère personnel collectées sont l'email, le pseudo et le mot de passe haché (aucune interdiction PII à formaliser au-delà de la minimisation déjà pratiquée, aucune donnée sensible au sens RGPD strict n'est collectée). Le patrimoine financier saisi (transactions, montants) est une donnée métier sensible commercialement, cloisonnée par utilisateur, mais n'entre pas dans les catégories particulières de l'article 9 du RGPD. Aucun journal ne conserve d'adresse IP ni d'identifiant en clair au-delà de la durée strictement nécessaire au débogage ; pas de mécanisme d'anonymisation dédié prévu pour le MVP, la suppression de compte entraînant la suppression en cascade des données (à confirmer comme fonctionnalité si le temps le permet, actuellement hors périmètre explicite).

**Déploiement.** Dockerfile back-end (image Node LTS alpine), Dockerfile front-end (build Vite + Nginx), service PostgreSQL et service Redis, orchestrés par un unique `docker-compose.yml` à la racine du monorepo. Variables sensibles (chaîne de connexion PostgreSQL, secret JWT, URL Redis) exclusivement en `.env`, avec `.env.example` versionné. Pas de pipeline CI/CD complet exigé par le référentiel pour un MVP candidat ; possible en amélioration.

**Logging.** Niveaux INFO (démarrage, requêtes réussies significatives) et ERROR (échecs d'authentification, erreurs d'appel aux fournisseurs de cours, erreurs Redis) sur la sortie standard, sans DEBUG activé en production. Pas de bibliothèque de logging structurée dédiée prévue pour le MVP (console suffisante à cette échelle) ; à revoir si le volume de code le justifie.

**Performance.** *Rubrique volontairement allégée* : le template appelle des preuves de benchmark de charge (k6, Locust, Apache Benchmark) pertinentes pour un service en production à fort trafic. CapitAll est démontré devant un jury sur un jeu de données de démonstration, sans exigence de charge concurrente. Le seul engagement de performance retenu est fonctionnel : le cache Redis des cours (D14) garantit qu'un rafraîchissement du tableau de bord ne déclenche pas systématiquement trois appels HTTP sortants, et les snapshots de valorisation (D16) évitent de reconstituer l'historique en rappelant les fournisseurs pour chaque point de la courbe. Un test de charge formel est noté comme piste d'amélioration hors MVP, à mentionner à l'oral si la question est posée.

## 4. Annexe des diagrammes

- Diagramme de cas d'utilisation (UML, PlantUML) : `conception/cas-utilisation.md`
- MCD, MLD, diagramme entité-association (Mermaid) : `conception/modele-de-donnees.md`
- Schéma d'architecture générale : `conception/architecture.md`
- Maquettes d'écrans (à venir) : Figma, référencées depuis `conception/direction-artistique.md`
