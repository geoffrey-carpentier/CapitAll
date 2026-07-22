# Planning de développement - CapitAll

Plan arrêté le 21/07/2026, en remplacement du planning initial de 5 semaines (établi le 09/07, devenu obsolète après l'achèvement du cadrage et de la conception).

**Échéance ferme : vendredi 21 août 2026, 23h59.** Soit 31 jours calendaires à compter du 21/07.

## Principes retenus

1. **La documentation est produite en continu, pas à la fin.** Le dossier de projet (30 à 50 pages) ne peut pas être écrit en trois jours : chaque semaine se termine par une session de rédaction alimentée par le travail réellement effectué, selon le plan des livrables établi. La dernière semaine assemble et met en forme, elle ne découvre pas.
2. **Le socle avant les extensions.** Les fonctionnalités décidées mais non essentielles (actions, annonces, RSS) sont placées après le socle démontrable, et sont explicitement abandonnables si le calendrier glisse.
3. **Une marge réelle en fin de parcours.** Les deux derniers jours ne contiennent aucun développement : ils absorbent les imprévus et servent aux répétitions.

## Semaine 1 - du mardi 21 au dimanche 26 juillet

Initialisation et fondations back-end.

- initialisation du monorepo, `.gitignore`, README, branches `main` et `dev`, premier commit
- board GitHub Projects et backlog d'issues
- exécution du script `backend/db/schema.sql`, création de l'utilisateur applicatif, script de seed
- connexion PostgreSQL, authentification (inscription, connexion, bcrypt, JWT, middleware)
- CRUD actifs et transactions avec vérification de propriété
- collection Insomnia au fil de l'eau

CP visées : CP1, CP5, CP6 (partiel).
Captures à prendre : structure du dépôt, premier commit, schéma dans pgAdmin, appels Insomnia d'inscription et de connexion.

## Semaine 2 - du lundi 27 juillet au dimanche 2 août

Logique métier et intégration des fournisseurs de cours.

- adaptateurs Coinbase, Frankfurter, gold-api derrière l'interface commune
- service de cache Redis branché, TTL différenciés (D21), repli « dernier cours connu »
- calcul du PRU moyen pondéré et de la plus-value latente, isolés et testables
- tests unitaires de la logique métier
- endpoint de portefeuille consolidé, alertes et snapshots
- démarrage du front : Vite, routing, page de connexion, liste des actifs

CP visées : CP6, CP7.
Captures : clé Redis en CLI (`GET` et `TTL`), tests unitaires au vert, appel Insomnia du portefeuille.

## Semaine 3 - du lundi 3 au dimanche 9 août

Front-end dynamique et accessibilité.

- tableau de bord : valeur totale, répartition en anneau, courbe d'évolution
- formulaire d'ajout de transaction, détail d'un actif, gestion des alertes
- gestion du jeton JWT côté client, gestion des erreurs d'API
- responsive mobile-first, vérifications RGAA (contrastes, labels, navigation clavier)
- fil d'annonces en lecture

CP visées : CP3, CP4.
Captures : tableau de bord en desktop et en mobile, contrôle d'accessibilité.

## Semaine 4 - du lundi 10 au dimanche 16 août

Extensions décidées, sécurité, déploiement.

- adaptateur FMP pour les actions (liste blanche), conversion USD→EUR, secours Finnhub (D20)
- espace d'administration : publication d'annonces, liste et désactivation de comptes (D22, D23)
- revue de sécurité complète : CORS, en-têtes, échappement, vérification `.env` et `.gitignore`
- Dockerfiles, `docker-compose.yml` incluant PostgreSQL et Redis, déploiement
- documentation : README final, tableau des endpoints, manuel utilisateur, procédure de déploiement

CP visées : CP8, consolidation de CP6 et CP7.
Captures : `docker compose up`, application déployée, espace d'administration.

Abandonnable sans regret si le calendrier glisse : le flux RSS (D24), puis l'espace d'administration, puis les actions. Dans cet ordre.

## Semaine 5 - du lundi 17 au vendredi 21 août

Livrables d'examen. **Aucun développement de fonctionnalité.**

- lundi 17 et mardi 18 : rédaction et assemblage du dossier de projet
- mercredi 19 : résumé de projet, corrections du dossier professionnel
- jeudi 20 : diaporama de soutenance, jeu d'essai documenté, section veille sécurité
- vendredi 21 : relecture, export des PDF, dépôt sur le dépôt de remise, marge d'imprévu

Gel du code le dimanche 16 août au soir. Seules les corrections de bugs bloquants sont admises après cette date.

## Points de vigilance

- Les maquettes Figma restent à produire et conditionnent CP2 : elles doivent être terminées pendant la semaine 1, en parallèle du back-end, sans attendre.
- Le quota Alpha Vantage (25 requêtes par jour) impose de ne jamais l'utiliser en première ligne pendant les phases de développement intensif.
- L'échéance du 21 août est traitée ici comme la date de remise de l'ensemble (code et documents). Si elle ne concerne en réalité que les documents, la marge de la semaine 5 est à reventiler vers le développement, mais le gel du code reste souhaitable.
