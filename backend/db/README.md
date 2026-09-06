# Base de données

Trois éléments, aux rôles distincts.

| Fichier | Rôle |
|---|---|
| `schema.sql` | état courant du schéma, à exécuter sur une base vide |
| `seed.sql` | jeu de développement court. **Vide toutes les tables** avant de réinsérer |
| `seed-demo.sql` | jeu de démonstration complet. Ne vide rien hors de ses propres comptes |
| `migrations/` | évolutions du schéma survenues après sa première mise en service |

`seed.sql` et `seed-demo.sql` ne servent pas le même besoin et ne se remplacent pas. Le
premier repart d'une base propre, ce qui suppose de pouvoir tout perdre ; le second
s'ajoute à une base déjà peuplée. Sur une base qui contient autre chose que du jetable,
c'est `seed-demo.sql` qu'il faut, et lui seul.

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

## Jeu de démonstration

```bash
psql -d capitall -f backend/db/seed-demo.sql
```

Le script s'exécute dans une transaction unique et affiche un récapitulatif en fin
d'exécution. Il crée trois comptes, mots de passe hachés en base par `pgcrypto`, avec
l'algorithme et le coût que le serveur emploie :

| Compte | Mot de passe | Ce qu'il sert à montrer |
|---|---|---|
| `demo@walletwatch.fr` | `Demo1234!` | portefeuille complet, treize mois d'historique |
| `demo-nouveau@walletwatch.fr` | `Demo1234!` | l'état vide, tel qu'un nouvel inscrit le voit |
| `demo-suspendu@walletwatch.fr` | `Demo1234!` | le refus de connexion d'un compte désactivé |

### Ce qu'il ne fait pas

Il ne vide aucune table et ne réinitialise aucune séquence. La seule suppression qu'il
exécute porte sur les trois adresses ci-dessus, nommément ; la cascade du schéma emporte
leurs actifs, mouvements, seuils et relevés. Tout autre compte, avec ses données, est
laissé intact — c'est vérifié par un compte témoin lors de la mise au point.

Il est rejouable : deux exécutions successives donnent le même état, sans doublon. C'est
aussi la procédure de remise à zéro du jeu, et elle ne peut atteindre que lui.

### Ce qu'il contient

Neuf positions sur les quatre classes d'actifs, vingt-deux mouvements et six seuils :

- des achats, des ventes partielles, et **une position entièrement soldée** dont la
  moins-value réalisée reste au compte ;
- des frais en euros, et **des frais retenus dans l'unité de l'actif** (D89) ;
- une **sortie non marchande**, transfert qui retire de la quantité sans dégager de
  produit ;
- des positions en plus-value et **des positions en moins-value** — le dollar perd, le
  Solana a été soldé à perte ;
- deux seuils déjà franchis, trois encore en cours, un désactivé ;
- treize mois de relevés quotidiens, alimentant les cinq plages du sélecteur.

Aucune position n'est servie par Finnhub. Les vingt valeurs que ce fournisseur couvre
restent sélectionnables, mais son offre gratuite plafonne à trente appels par jour : une
démonstration qui les épuiserait s'arrêterait au mauvais moment. Le catalogue complet se
montre par `GET /api/symboles`, qui n'interroge aucun fournisseur.

### Les cours passés sont synthétiques

Un historique de mouvements ne crée pas un historique de cours. Aucun des fournisseurs
employés ne rend ses cours passés, et c'est précisément pourquoi `snapshot_cours` et
`snapshot_valorisation` existent : un cours relevé est un fait daté, pas une valeur
recalculable.

Les séries écrites par ce script sont donc **fabriquées, et signalées comme telles dans
le script lui-même**. Elles sont déterministes — aucun tirage aléatoire — et interpolent
entre le prix du premier achat et un prix d'arrivée proche du cours réel, pour que la
courbe ne fasse pas de marche d'escalier le jour où les vrais cours arrivent. La
valorisation totale n'est pas une seconde série inventée : elle est la somme des
positions au cours du jour.

Les cours **courants**, eux, sont bien réels : ils viennent des fournisseurs, comme en
usage normal.

### Deux contrôles bloquants

Le script refuse de s'écrire s'il est incohérent, plutôt que de laisser découvrir le
défaut pendant une démonstration :

1. **aucun solde négatif**, à aucun instant de l'historique. Le contrôle rejoue les
   mouvements dans l'ordre et regarde le cumul après chacun d'eux, et non le seul solde
   final : c'est entre deux lignes qu'une erreur d'ordonnancement se voit ;
2. **la quantité de chaque relevé de cours** doit être celle qui découle des mouvements à
   cette date, sans quoi le graphe d'une fiche et le tableau des positions se
   contrediraient.

### Un mot sur les pourcentages d'évolution

« Sur un an » et « depuis le premier relevé » mesurent l'évolution de la valeur suivie,
pas une performance de marché : le portefeuille s'étant constitué au fil des mois, ces
plages affichent des pourcentages élevés qui reflètent surtout les sommes ajoutées. Le
chiffre qui répond à « ai-je gagné » est celui du bloc de patrimoine, explicitement
rapporté au coût des positions détenues.
