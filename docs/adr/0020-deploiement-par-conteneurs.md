# 0020 — Déploiement par conteneurs, pile de démonstration

- **Date** : août 2026
- **Statut** : à réexaminer

## Contexte

L'application a besoin de quatre composants pour tourner : l'interface servie en statique, l'API, PostgreSQL et Redis. Les installer à la main sur une machine rend l'environnement irreproductible et la mise en route impossible à documenter honnêtement.

## Décision

Une pile de conteneurs décrite en fichiers de composition, avec trois usages distincts : développement, test et exécution complète.

Choix retenus :

- images **multi-étapes** : l'image finale de l'API ne contient ni cache d'installation ni dépendance de développement ;
- l'API s'exécute sous un utilisateur **non privilégié** ;
- contrôles de santé sur chaque service, et démarrage ordonné : l'API attend une base et un cache sains ;
- l'API se connecte à PostgreSQL avec un **rôle restreint**, jamais le propriétaire du schéma ;
- un seul port publié, lié à l'interface de bouclage ;
- l'interface est servie par nginx, qui porte les en-têtes de sécurité et une politique de sécurité du contenu sans script en ligne, et relaie l'API ;
- les secrets viennent de variables d'environnement, jamais des images.

## Conséquences

- La pile se reconstruit à l'identique et se documente : c'est ce qui rend la démonstration reproductible.
- **Ce n'est pas un déploiement de production**, et la documentation le dit : pas de TLS, pas de cache persistant, sauvegardes manuelles et non testées, jeu de démonstration monté avec des comptes publics, images repérées par étiquette et non par empreinte, aucun suivi d'exécution.
- Le statut « à réexaminer » couvre ces manques : ils se traitent ensemble, au moment où une cible d'hébergement réelle est choisie, et non un par un.
- La procédure complète est dans `../deploiement.md`.
