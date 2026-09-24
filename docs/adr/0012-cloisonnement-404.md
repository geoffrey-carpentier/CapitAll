# 0012 — Cloisonnement des ressources : 404 plutôt que 403

- **Date** : 29 juillet 2026
- **Statut** : acceptée

## Contexte

Chaque ressource du portefeuille appartient à un utilisateur. Une requête authentifiée portant l'identifiant d'une ressource d'autrui doit être refusée. Reste à choisir le refus : `403`, qui dit « cette ressource existe, elle n'est pas à vous », ou `404`, qui dit « rien ici ».

Un `403` confirme l'existence de la ressource. En incrémentant des identifiants, un compte légitime peut alors dénombrer les ressources des autres, et parfois en déduire leur activité.

## Décision

Une ressource existante mais appartenant à un autre utilisateur renvoie **404**, jamais `403`, sur toutes les routes du portefeuille.

Le cloisonnement se prouve **dans la requête SQL**, par une jointure sur le propriétaire, et non par un test en JavaScript après lecture. Aucune ligne n'est lue, modifiée ou supprimée si elle n'appartient pas à l'utilisateur authentifié : la requête ne la sélectionne tout simplement pas.

## Conséquences

- La distinction entre « n'existe pas » et « ne vous appartient pas » disparaît des réponses, y compris pour le propriétaire légitime qui se tromperait d'identifiant. C'est le comportement voulu.
- Une route nouvelle hérite de la règle uniquement si sa requête porte le filtre sur le propriétaire : c'est le point à vérifier en relecture, systématiquement.
- Le `403` reste utilisé là où l'identité est établie et l'accès refusé pour une autre raison, par exemple un compte désactivé qui se connecte avec des identifiants valides.
