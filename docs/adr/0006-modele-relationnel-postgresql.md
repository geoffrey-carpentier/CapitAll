# 0006 — Modèle relationnel PostgreSQL, intégrité par contraintes

- **Date** : juillet 2026, complété jusqu'en septembre 2026
- **Statut** : acceptée

## Contexte

Les données du domaine sont fortement relationnelles : un utilisateur détient des actifs, un actif porte des transactions, une transaction a une date, un type, une quantité, un prix. Les questions posées sont des agrégations et des parcours chronologiques. Rien dans ce domaine ne demande un schéma souple.

L'exactitude financière, elle, demande un type numérique exact et des contraintes que la base fait respecter, quel que soit le code qui écrit.

## Décision

PostgreSQL, avec huit tables : `utilisateur`, `actif`, `transaction`, `alerte`, `snapshot_valorisation`, `snapshot_cours`, `reinitialisation_mot_de_passe`, `annonce`.

Les invariants sont portés par le schéma quand c'est possible, plutôt que par le code seul :

- montants et quantités en `NUMERIC`, jamais en flottant, aux échelles fixées par `0003` ;
- clés étrangères avec suppression en cascade depuis l'utilisateur : supprimer un compte efface réellement ses données ;
- unicité de `(utilisateur_id, symbole)` sur un actif, unicité d'un relevé par jour et par portefeuille ;
- contraintes de cohérence sur les transactions : une sortie non marchande n'a pas de prix, un montant de frais exige son unité ;
- l'application se connecte avec un rôle restreint, distinct du propriétaire du schéma.

## Conséquences

- Une règle enfreinte est refusée par la base même si un défaut du code la laisse passer. Le message d'erreur est alors technique, et l'API doit le traduire.
- Le modèle est documenté dans `../conception/modele-de-donnees.md`, et le schéma de référence est `../../backend/db/schema.sql`.
- La table `annonce` n'est utilisée par aucune fonctionnalité livrée : elle a été créée pour un espace d'administration reporté. Elle est conservée en l'état, et son sort est à trancher — la garder sans usage a un coût de lecture pour qui découvre le schéma.
