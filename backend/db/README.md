# Base de données

Trois éléments, aux rôles distincts.

| Fichier | Rôle |
|---|---|
| `schema.sql` | état courant du schéma, à exécuter sur une base vide |
| `seed.sql` | jeu de données de démonstration, idempotent, rejouable |
| `migrations/` | évolutions du schéma survenues après sa première mise en service |

## Convention de migration

Tant que la base n'existait que sur le poste de développement, la faire évoluer revenait
à rejouer `schema.sql`, qui commence par supprimer les tables. Cette facilité disparaît
dès qu'une base contient des données à conserver : il faut alors décrire la modification
plutôt que reconstruire l'ensemble.

Chaque évolution du schéma donne donc lieu à deux écritures :

1. `schema.sql` est mis à jour pour refléter l'état courant. Une base créée à partir de
   zéro doit toujours obtenir la structure la plus récente en une seule exécution.
2. Un fichier est ajouté dans `migrations/`, nommé `AAAA-MM-JJ_objet.sql`, contenant la
   modification incrémentale correspondante. Il permet de faire évoluer une base déjà
   peuplée sans perdre ses données.

Les deux chemins mènent à la même structure : c'est la condition pour qu'une base créée
la semaine dernière et une base créée aujourd'hui se comportent de la même façon.

Les migrations sont écrites de façon rejouable, au moyen de clauses telles que
`IF NOT EXISTS`. Exécuter deux fois la même migration ne doit produire ni erreur ni
double effet, pour la même raison qui rend `seed.sql` idempotent : on doit pouvoir
relancer sans réfléchir à ce qui a déjà été appliqué.

Elles sont conservées après application. Elles constituent l'historique des décisions
prises sur le modèle de données, au même titre que l'historique des commits pour le code.

## Ordre d'exécution sur une base neuve

```bash
psql -d capitall -f backend/db/schema.sql
psql -d capitall -f backend/db/seed.sql
```

Les migrations n'ont pas à être rejouées dans ce cas : `schema.sql` les intègre déjà.

## Sur une base existante

Les migrations s'appliquent dans l'ordre chronologique de leur nom :

```bash
psql -d capitall -f backend/db/migrations/2026-08-06_activation-compte.sql
psql -d capitall -f backend/db/migrations/2026-08-23_historique-cours-par-position.sql
```

Un rôle propriétaire est nécessaire : le rôle applicatif `capitall_app` est volontairement
limité aux opérations de lecture et d'écriture, sans droit de modification du schéma.
