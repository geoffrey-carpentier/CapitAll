# 0007 — Migrations versionnées avec registre d'empreintes

- **Date** : août 2026
- **Statut** : acceptée

## Contexte

Le dépôt contenait des migrations écrites et rejouables, mais rien ne disait lesquelles avaient déjà été passées sur une base donnée : la réponse vivait dans la mémoire de celui qui les avait lancées. Sur deux environnements, la question devient impossible à trancher autrement qu'en lisant le schéma colonne par colonne.

## Décision

Un script applique les migrations et tient leur registre **dans la base elle-même**, à côté des données qu'il décrit : `backend/db/migrer.js`, table `migration_appliquee`.

Trois garanties, et rien de plus :

1. un verrou consultatif PostgreSQL empêche deux exécutions simultanées de se marcher dessus ;
2. chaque migration s'applique dans sa propre transaction : elle passe entièrement ou pas du tout ;
3. l'empreinte SHA-256 de chaque fichier est conservée ; modifier une migration déjà appliquée est détecté et refusé, car deux bases prétendraient sinon porter le même schéma en ayant exécuté des instructions différentes.

Les fichiers sont préfixés par leur date, l'ordre lexicographique étant l'ordre chronologique. Les migrations sont écrites pour être rejouables sans effet de bord.

**Pas de retour arrière automatique.** Une migration qui rétrécit une échelle ou supprime une colonne détruit des données qu'un « down » ne reconstituerait pas ; la présenter comme réversible serait mensonger. La reprise se fait par restauration d'une sauvegarde, ou par une migration corrective en avant.

## Conséquences

- Le registre n'est **jamais** recalé à la main pour faire passer le contrôle d'empreinte : une divergence est une erreur de méthode, et se corrige en avant.
- Une base créée directement depuis `schema.sql` démarre avec toutes les migrations marquées comme restant à appliquer. Elles sont sans effet, puisque rejouables, mais le registre n'est pas amorcé : ce point est à corriger.
- La procédure d'exploitation est décrite dans `../deploiement.md` ; la sauvegarde précède toujours l'application.
