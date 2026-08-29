# Déploiement de CapitAll

Procédure de mise en service de l'application complète en conteneurs, et procédure de
redéploiement après une modification du code. Elle décrit le fonctionnement réellement
constaté sur la pile décrite par `docker-compose.production.yml`, vérifiée le 27 août 2026.

Pour l'installation de l'environnement de développement, où l'API et l'interface tournent
directement sur le poste, voir le README à la racine.

## Portée de cette pile

C'est une **pile de démonstration**, pas une mise en production réelle. Elle sert à faire
tourner l'application entière en conteneurs, sur un poste ou une machine de présentation,
et à appuyer la compétence de déploiement du titre.

Ce qui l'en distingue tient à un point : elle monte `backend/db/seed.sql` parmi ses
scripts d'initialisation. La base créée porte donc le jeu de données de démonstration et
ses trois comptes, dont les identifiants sont écrits en clair en tête du fichier et
publiés dans le dépôt. C'est exactement ce que l'on veut pour une démonstration ; ce
serait inacceptable ailleurs.

Un déploiement destiné à de vrais utilisateurs reprendrait la même pile en deux points :
ne pas monter `02-seed.sql`, et tirer `POSTGRES_PASSWORD`, `CAPITALL_APP_PASSWORD` et
`JWT_SECRET` d'un magasin de secrets d'exploitation plutôt que d'un fichier `.env` posé
à côté du dépôt. Tout le reste — images, réseau, ports, rôle applicatif, ordre de
démarrage, persistance — vaut dans les deux cas.

## Ce que la pile contient

Quatre services sur un même réseau interne, créé par Docker Compose.

| Service | Image | Rôle | Publié sur l'hôte |
|---|---|---|---|
| `web` | construite depuis `frontend/Dockerfile` | fichiers de l'interface, servis par Nginx, et relais des appels d'API | oui, port 8080 par défaut |
| `api` | construite depuis `backend/Dockerfile` | serveur Express | non |
| `db` | `postgres:16-alpine` | données persistantes | non |
| `redis` | `redis:7-alpine` | cache des cours | non |

Un seul port est ouvert sur la machine hôte, celui de l'interface. La base, le cache et
l'API ne sont joignables que depuis le réseau de la pile, sous les noms `db`, `redis` et
`api` : rien d'autre que l'interface n'est exposé au réseau de la machine.

L'interface et l'API sont servies sous la même origine. Les appels du navigateur partent
en chemin relatif vers `/api/...` ; Nginx les relaie vers le conteneur `api`. Aucune
adresse d'API n'est donc compilée dans les fichiers de l'interface, et le partage entre
origines n'entre pas en jeu.

## Prérequis

Docker et Docker Compose. Rien d'autre : ni Node, ni PostgreSQL, ni Redis installés sur
la machine. Les versions utilisées pour la vérification sont Docker 29.7.2 et Docker
Compose v5.3.1 ; toute version prenant en charge la condition `service_healthy` de
`depends_on` convient.

Prévoir environ 350 Mo pour les deux images construites (265 Mo pour l'API, 74 Mo pour
l'interface), auxquels s'ajoutent les images officielles de PostgreSQL et de Redis.

## Configuration

Une seule source de configuration : le fichier `.env` à la racine du dépôt, jamais
versionné. `.env.example` en donne le modèle commenté.

| Variable | Rôle | Défaut |
|---|---|---|
| `POSTGRES_USER` | propriétaire de la base, qui crée le schéma | aucun |
| `POSTGRES_PASSWORD` | son mot de passe | aucun |
| `POSTGRES_DB` | nom de la base, à laisser à `capitall` | aucun |
| `CAPITALL_APP_PASSWORD` | mot de passe du rôle applicatif `capitall_app` | aucun |
| `JWT_SECRET` | secret de signature des jetons, 32 caractères minimum | aucun |
| `JWT_EXPIRATION` | durée de validité des jetons | `2h` |
| `PORT_APPLICATION` | port publié sur la machine hôte | `8080` |
| `ORIGINE_AUTORISEE` | origine admise par l'API | `http://localhost:8080` |

Les quatre premières et `JWT_SECRET` n'ont pas de valeur par défaut : elles doivent être
renseignées. L'API refuse de démarrer si `JWT_SECRET` est absent ou fait moins de trente-deux
caractères.

`POSTGRES_DB` doit rester `capitall` : `backend/db/schema.sql` accorde explicitement les
droits sur une base portant ce nom. Changer la valeur suppose d'adapter le script.

Aucun secret ne figure dans les Dockerfile, dans les fichiers de composition, ni dans les
images produites : l'inspection des deux images ne montre que `NODE_ENV=production` et les
variables des images de base.

## Premier déploiement

```bash
cp .env.example .env
# renseigner POSTGRES_PASSWORD, CAPITALL_APP_PASSWORD et JWT_SECRET

docker compose -f docker-compose.production.yml up -d --build
```

Compose construit les deux images, puis démarre les services dans l'ordre imposé par
leurs contrôles de santé : la base et le cache d'abord, l'API lorsque les deux répondent,
l'interface lorsque l'API répond à son tour. Aucun script d'attente n'est nécessaire.

Le premier démarrage crée le volume de données et y joue, dans l'ordre, les trois scripts
d'initialisation montés dans le conteneur de la base :

1. `backend/db/schema.sql` — les sept tables, les index et le rôle applicatif ;
2. `backend/db/seed.sql` — le jeu de données de démonstration ;
3. `backend/db/docker/03-role-applicatif.sh` — pose sur `capitall_app` le mot de passe
   tiré de `CAPITALL_APP_PASSWORD`, le schéma versionné n'en portant qu'un factice.

Ces scripts ne sont joués qu'à la création du volume. Un redémarrage ultérieur ne les
rejoue pas : la base conserve ses données.

### Vérification

```bash
docker compose -f docker-compose.production.yml ps
```

Les quatre services doivent apparaître `healthy`, et seul `web` doit publier un port :

```
NAME                          SERVICE   STATUS                    PORTS
capitall-production-api-1     api       Up (healthy)              5000/tcp
capitall-production-db-1      db        Up (healthy)              5432/tcp
capitall-production-redis-1   redis     Up (healthy)              6379/tcp
capitall-production-web-1     web       Up (healthy)              0.0.0.0:8080->80/tcp
```

Puis, depuis la machine hôte :

```bash
curl http://localhost:8080/api/sante        # {"statut":"ok"}
```

L'application est alors accessible sur `http://localhost:8080`. Les identifiants de
démonstration figurent en tête de `backend/db/seed.sql`.

## Arrêt et redémarrage

```bash
docker compose -f docker-compose.production.yml stop     # suspend sans supprimer
docker compose -f docker-compose.production.yml start    # reprend

docker compose -f docker-compose.production.yml down     # supprime conteneurs et réseau
docker compose -f docker-compose.production.yml up -d    # recrée à partir des images
```

`down` ne supprime pas le volume de données : les données sont retrouvées intactes au
démarrage suivant, et le journal de la base affiche alors
`Skipping initialization`, qui confirme que les scripts d'initialisation n'ont pas été
rejoués.

```bash
docker compose -f docker-compose.production.yml down -v  # supprime aussi les données
```

C'est la seule commande de cette page qui détruit des données. Elle est utile pour
repartir d'une base neuve et à nouveau peuplée par le jeu de démonstration, notamment
avant une présentation.

## Redéploiement après une modification du code

```bash
git pull
docker compose -f docker-compose.production.yml up -d --build
```

Compose reconstruit les images concernées et ne remplace que les conteneurs dont l'image
a changé. Le volume de données n'est pas touché. Un service seul peut être repris de la
même façon :

```bash
docker compose -f docker-compose.production.yml up -d --build web
```

Les couches d'installation des dépendances ne sont refaites que si un `package.json` ou
un fichier de verrouillage a changé : une modification de code seule ne relance pas
l'installation.

## Évolution du schéma sur une base déjà peuplée

Les scripts d'initialisation ne concernent que les bases neuves. Une base existante se
fait évoluer par les migrations de `backend/db/migrations/`, appliquées dans l'ordre
chronologique de leur nom :

```bash
docker compose -f docker-compose.production.yml exec -T db \
    psql -v ON_ERROR_STOP=1 -U capitall -d capitall \
    < backend/db/migrations/2026-08-23_historique-cours-par-position.sql
```

Les migrations sont écrites de façon rejouable : appliquer deux fois la même ne produit
ni erreur ni double effet. Convention et liste : `backend/db/README.md`.

## Sauvegarde et restauration

```bash
docker compose -f docker-compose.production.yml exec -T db \
    pg_dump -U capitall -d capitall > sauvegarde.sql

docker compose -f docker-compose.production.yml exec -T db \
    psql -U capitall -d capitall < sauvegarde.sql
```

La restauration vise une base **neuve ou vidée au préalable** : le fichier produit par
`pg_dump` sans option ne contient que des créations et des insertions, il ne supprime
rien. L'appliquer sur une base déjà peuplée échoue sur les objets existants et duplique
les lignes. Repartir d'un volume neuf (`down -v` puis `up -d`), ou produire la
sauvegarde avec `pg_dump --clean --if-exists`, qui la fait commencer par la suppression
des objets qu'elle recrée.

## Journaux et diagnostic

```bash
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs db | head -60
```

Trois situations valent d'être connues.

**L'API démarre mais ne joint pas la base.** Le message
`Connexion PostgreSQL indisponible au démarrage` apparaît dans le journal de `api`. La
cause habituelle est un `CAPITALL_APP_PASSWORD` modifié dans `.env` après la création du
volume : le mot de passe du rôle n'est posé qu'à l'initialisation, changer la variable
seule ne le met pas à jour. Le corriger en base, ou repartir d'un volume neuf.

**L'initialisation de la base a échoué.** Le conteneur redémarre alors sur une base
partiellement construite, et le journal montre l'erreur suivie de
`Skipping initialization` au démarrage suivant. Une initialisation incomplète ne se
répare pas en relançant la pile : il faut supprimer le volume (`down -v`) et recommencer.

**Le port est déjà occupé.** Changer `PORT_APPLICATION` dans `.env`, et `ORIGINE_AUTORISEE`
avec lui.

## Choix retenus et leurs raisons

**Deux fichiers de composition plutôt qu'un.** `docker-compose.yml` ne monte que la base
et le cache : c'est ce dont le développement a besoin, l'API et l'interface tournant sur
le poste avec le rechargement à chaud. `docker-compose.production.yml` monte les quatre
services. Les deux piles portent des noms de projet distincts, `capitall` et
`capitall-production` : elles ont leurs propres conteneurs et leur propre volume, peuvent
tourner en même temps, et démarrer la seconde ne touche jamais la base de développement.

**Images en deux étapes.** L'image de l'API installe ses dépendances de production dans
une première étape et n'embarque dans la seconde que le résultat, sans cache npm ni
trace d'installation. Aucune chaîne de compilation n'y figure, bien que `bcrypt` soit un
module natif : le paquet embarque ses propres binaires précompilés, dont celui de la
bibliothèque C d'Alpine. L'image de l'interface compile avec Vite puis ne conserve que
les fichiers produits : elle ne contient ni Node ni la moindre dépendance de
développement.

**Le relais vers l'API passe par une variable.** Nginx ne résout qu'une seule fois, au
démarrage, un nom d'hôte écrit directement dans `proxy_pass`. Recréer le conteneur de
l'API seul lui donnerait une nouvelle adresse que le relais ignorerait jusqu'au
redémarrage de l'interface. Le nom passe donc par une variable, ce qui impose une
résolution à chaque requête auprès du résolveur interne de Docker.

**Un serveur statique pour l'interface.** Les fichiers produits par Vite sont statiques.
Nginx les sert et relaie `/api`, ce qui suffit et évite un second processus Node en
production.

**L'API ne se connecte pas en superutilisateur.** Le schéma crée un rôle applicatif
`capitall_app` limité à la lecture et à l'écriture des données, sans aucun droit sur la
structure. C'est ce rôle que la pile utilise ; le propriétaire de la base ne sert qu'aux
scripts d'initialisation et aux migrations.

**Le serveur de l'API tourne sous un utilisateur non privilégié.** L'image officielle de
Node fournit l'utilisateur `node`, sous lequel le processus s'exécute ; il n'a pas de
droit d'écriture sur ses propres fichiers. Pour l'interface, l'image officielle de Nginx
conserve son comportement d'origine : le processus maître démarre en root le temps de
lier le port, ses processus de travail tournent sous l'utilisateur `nginx`.

**Le cache n'a pas de volume.** Perdre le contenu de Redis n'a aucune conséquence
fonctionnelle : les cours sont simplement redemandés aux fournisseurs au prochain appel.

## Ce qui a été vérifié

Sur la pile complète, le 27 août 2026 : construction des deux images ; démarrage dans
l'ordre des contrôles de santé ; connexion de l'API à PostgreSQL sous le rôle
`capitall_app` et à Redis, avec des clés de cours et leurs durées de vie ; réponse de
l'interface et repli des adresses inconnues sur le document principal ; connexion d'un
compte de démonstration, chargement du portefeuille avec des cours réellement récupérés
auprès des fournisseurs, création puis suppression d'un actif, d'un mouvement et d'un
seuil, export CSV des mouvements ; persistance des données après un arrêt et un
redémarrage complets ; application d'une migration et sauvegarde par `pg_dump` depuis le
conteneur ; absence de secret dans les images produites.
