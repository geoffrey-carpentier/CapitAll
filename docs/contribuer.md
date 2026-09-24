# Contribuer à WalletWatch

Ce document répond à une seule question : **comment se déroule une contribution, du besoin à la livraison**. Le format des commits et le nommage des branches restent décrits par `convention-commits.md`. Les exigences de qualité sont dans `qualite.md`. Les choix structurants sont dans `adr/`.

## 1. Avant d'écrire une ligne

Toute contribution part d'une issue. Une issue est **prête** quand elle porte :

- l'objectif, en une phrase ;
- la valeur pour l'utilisateur, ou la raison technique si la valeur est indirecte ;
- des critères d'acceptation vérifiables, qui décrivent un comportement observable et non une implémentation ;
- les risques connus, y compris sur les données ;
- les tests attendus ;
- la documentation à mettre à jour, s'il y en a ;
- une taille estimée : au-delà de deux jours de travail, l'issue se découpe.

Une issue qui ne remplit pas ces conditions reste en découverte. On ne la commence pas, on l'instruit.

## 2. Le cycle

1. **Se placer sur un état propre.** `git fetch`, `git status`, puis une branche créée depuis `dev`.
2. **Travailler par petits commits verts.** Un commit qui casse le lint ou les tests n'est pas acceptable, même en cours de journée.
3. **Ouvrir une pull request vers `dev`.** Jamais vers `main`. La description liste les issues traitées, ce qui a été contrôlé, et ce qui ne l'a pas été.
4. **Attendre les contrôles automatiques.** Ils sont bloquants sur `main`, exigés sur `dev`.
5. **Relire.** Une relecture par une autre personne quand c'est possible ; à défaut, une relecture différée, jamais dans la foulée de l'écriture.
6. **Fusionner dans `dev`**, puis **fermer l'issue à la main** en indiquant la pull request. Le mot-clé `Closes #n` ne ferme rien automatiquement ici : la fermeture automatique n'a lieu que sur la branche par défaut, qui est `main`.
7. **Renseigner la version** sur l'issue au moment où le travail sort effectivement sur `main`.

`dev` n'est fusionnée dans `main` que pour une version : un ensemble cohérent, contrôlé, et accompagné de ses notes.

## 3. Definition of Done

Une contribution est terminée quand :

- les critères d'acceptation de l'issue sont remplis ;
- les tests correspondant au risque réel du changement existent et passent ;
- les contrôles automatiques sont verts ;
- la documentation est à jour **si** le changement touche un contrat d'API, un parcours utilisateur, l'architecture ou une procédure d'exploitation ;
- une décision structurante, si le changement en contient une, est écrite dans `adr/` **dans la même pull request** ;
- un changement visible par l'utilisateur ou important pour l'exploitation figure dans les notes de version ;
- une preuve est jointe **à la mesure du risque** : rien pour un changement de texte, une capture ou une sortie de commande pour un parcours, une mesure pour une performance ou une correction de sécurité.

La documentation fait partie de la livraison. Elle n'est pas un travail que l'on remet à plus tard.

## 4. Changements sensibles

**Migrations et changements de schéma.** La pull request porte le SQL, démontre que la migration est rejouable sans effet de bord, indique la sauvegarde prise avant application et le résultat d'un essai sur une copie. Un changement destructeur — colonne supprimée, échelle réduite, contrainte durcie — demande un accord explicite avant d'être appliqué ailleurs qu'en local. Il n'existe pas de retour arrière automatique : la reprise se fait par restauration ou par une migration corrective en avant.

**Dépendances.** Une dépendance nouvelle se justifie dans la pull request : ce qu'elle apporte, ce qu'elle coûte, et ce qu'elle remplacerait. Une dépendance structurante passe par une décision écrite dans `adr/`.

**Sécurité.** Tout changement touchant l'authentification, les autorisations, la validation des entrées ou les secrets est relu séparément du reste, et ne se mélange pas à un travail fonctionnel dans la même pull request.

## 5. Sessions de travail

Le projet avance par sessions, parfois espacées, parfois menées depuis des environnements différents. La continuité repose sur des fichiers et sur l'outil de suivi, jamais sur la mémoire de qui travaillait.

**Au début d'une session :**

1. `git fetch`, `git status --short --branch`, `git worktree list` ;
2. lire les éléments en cours dans le suivi, et le dernier compte rendu de passation de l'issue concernée ;
3. annoncer le travail pris, en s'assignant l'issue, pour éviter deux travaux concurrents sur les mêmes fichiers ;
4. travailler dans une copie de travail qui n'est partagée avec personne.

**À la fin d'une session**, systématiquement, même si rien n'a abouti : un compte rendu de passation en commentaire de l'issue, qui donne l'état, la branche, le dernier commit, les contrôles exécutés avec leur résultat, ce qui reste à faire et ce qui bloque.

Un commit n'est créé que si l'unité de travail se tient. Un push n'a lieu qu'après les contrôles. Une session qui se termine sans commit se termine quand même par une passation.

## 6. Ce qui n'est jamais fait sans accord explicite

- Supprimer des données, des branches distantes, des volumes ou des fichiers.
- Réécrire l'historique d'une branche partagée.
- Fusionner dans `main`.
- Appliquer une migration ailleurs qu'en local.
- Engager un compte externe, une dépense ou une publication.
