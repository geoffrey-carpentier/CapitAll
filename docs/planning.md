# Planning de développement - CapitAll

Plan arrêté le 23/07/2026, en remplacement du plan du 21/07. **Échéance : dimanche 23 août 2026, dernier délai**, avec une semaine entière réservée aux livrables d'examen. Le développement s'étend du vendredi 24 juillet au dimanche 16 août, date du gel du code.

## Principes retenus

1. **La documentation est produite en continu, pas à la fin.** Le dossier de projet (30 à 50 pages) ne peut pas être écrit en une semaine en partant de zéro : chaque semaine se termine par une session de rédaction alimentée par le travail réellement effectué, selon le plan des livrables établi. La semaine 5 assemble et met en forme, elle ne découvre pas.
2. **Le socle avant les extensions.** Les fonctionnalités décidées mais non essentielles (actions, annonces, RSS) sont placées après le socle démontrable, et sont explicitement abandonnables si le calendrier glisse.
3. **Une marge réelle en fin de parcours.** La remise est visée le vendredi 21 août : le week-end du 22-23 n'absorbe que les imprévus, il n'est jamais planifié.

## Semaine 1 - du vendredi 24 au dimanche 26 juillet

Initialisation et fondations back-end (semaine courte, 3 jours).

- initialisation du monorepo : squelettes `/backend` et `/frontend`, `.env.example`, scripts de développement
- board GitHub Projects et backlog d'issues
- exécution du script `backend/db/schema.sql`, création de l'utilisateur applicatif, script de seed (compte admin, annonces et jeu de données d'exemple)
- connexion PostgreSQL, authentification (inscription, connexion, bcrypt, JWT, middleware), middleware de rôle
- CRUD actifs et transactions avec vérification de propriété
- collection Insomnia au fil de l'eau
- maquettes Figma des 5 écrans : à terminer sur cette période, en parallèle, sans attendre

CP visées : CP1, CP2, CP5, CP6 (partiel).
Captures : structure du dépôt et premiers commits, schéma dans pgAdmin, appels Insomnia d'inscription et de connexion.

## Semaine 2 - du lundi 27 juillet au dimanche 2 août

Logique métier et intégration des fournisseurs de cours.

- adaptateurs Coinbase, Frankfurter, gold-api derrière l'interface commune
- service de cache Redis branché, TTL différenciés par classe, repli « dernier cours connu »
- calcul du PRU moyen pondéré et de la plus-value latente, isolés et testables ; tests unitaires
- endpoint de portefeuille consolidé, alertes de seuil, snapshots de valorisation
- démarrage du front : Vite, routing, page de connexion et d'inscription, liste des actifs connectée à l'API

CP visées : CP6, CP7.
Captures : clé Redis en CLI (`GET` et `TTL`), tests unitaires au vert, appel Insomnia du portefeuille.

## Semaine 3 - du lundi 3 au dimanche 9 août

Front-end dynamique et accessibilité.

- tableau de bord : valeur totale, répartition en anneau, courbe d'évolution, alertes déclenchées
- formulaire d'ajout de transaction, détail d'un actif, gestion des alertes
- gestion du jeton JWT côté client, gestion des erreurs d'API
- responsive mobile-first, vérifications RGAA (contrastes, labels, navigation clavier)
- fil d'annonces en lecture

CP visées : CP3, CP4.
Captures : tableau de bord en desktop et en mobile, contrôle d'accessibilité.

## Semaine 4 - du lundi 10 au dimanche 16 août

Extensions décidées, sécurité, déploiement.

- adaptateur FMP pour les actions (liste blanche), conversion USD→EUR, secours Finnhub, fiche d'actif enrichie
- espace d'administration : publication d'annonces, liste et désactivation de comptes
- revue de sécurité complète : CORS, en-têtes, échappement, vérification `.env` et `.gitignore`
- Dockerfiles, `docker-compose.yml` incluant PostgreSQL et Redis, déploiement
- documentation : README final, tableau des endpoints, manuel utilisateur, procédure de déploiement

CP visées : CP8, consolidation de CP6 et CP7.
Captures : `docker compose up`, application déployée, espace d'administration.

Abandonnable sans regret si le calendrier glisse : le flux RSS, puis l'espace d'administration, puis les actions. Dans cet ordre.

**Gel du code le dimanche 16 août au soir.** Seules les corrections de bugs bloquants sont admises après cette date.

## Semaine 5 - du lundi 17 au dimanche 23 août

Livrables d'examen. **Aucun développement de fonctionnalité.**

- lundi 17 et mardi 18 : rédaction et assemblage du dossier de projet à partir des sections rédigées en continu
- mercredi 19 : résumé de projet, corrections du dossier professionnel
- jeudi 20 : diaporama de soutenance, jeu d'essai documenté, section veille sécurité
- vendredi 21 : relecture complète, export des PDF, dépôt sur le dépôt de remise (remise visée)
- samedi 22 et dimanche 23 : marge d'imprévu uniquement ; le dimanche 23 est le dernier délai absolu

## Points de vigilance

- Les maquettes Figma conditionnent CP2 : terminées au plus tard le dimanche 26 juillet, en parallèle du back-end, sans attendre.
- Le quota Alpha Vantage (25 requêtes par jour) impose de ne jamais l'utiliser en première ligne pendant les phases de développement intensif.
- L'échéance du 23 août est traitée ici comme la date limite de remise de l'ensemble (code et documents) ; la remise effective est visée le vendredi 21 pour conserver une marge réelle.
