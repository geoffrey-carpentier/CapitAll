# 0010 — Relevés de valorisation en écriture paresseuse

- **Date** : 29 juillet 2026, étendue le 23 août et le 6 septembre 2026
- **Statut** : à réexaminer

## Contexte

La courbe d'évolution du patrimoine suppose des points de mesure dans le temps. Les produire demande soit une tâche planifiée, soit une écriture déclenchée par l'usage.

Au moment de la décision, le projet n'avait ni ordonnanceur, ni processus résident autre que l'API, et en ajouter un aurait demandé un composant d'infrastructure de plus à exploiter et à surveiller.

## Décision

Le relevé du jour est écrit **paresseusement** : à la première actualisation du tableau de bord d'une journée, si aucun point n'existe pour cette date, il est enregistré. Un relevé par jour et par portefeuille, l'unicité étant portée par la base. Les cours de chaque position sont historisés de la même manière, dans leur propre table.

La lecture et l'actualisation sont **deux opérations distinctes** : lire le portefeuille ne change rien, actualiser ajoute l'écriture du point du jour et l'évaluation des seuils. Une lecture peut donc être rejouée sans effet.

Deux garde-fous :

- le total du jour n'est enregistré que s'il représente le **capital complet** ; un sous-total se lirait comme une baisse, et l'unicité par date le figerait pour la journée. Un trou dans la courbe est préférable à un point faux ;
- les positions sans cours sont écartées plutôt qu'enregistrées à zéro.

## Conséquences

- Aucune infrastructure supplémentaire, et aucun point faux dans l'historique.
- **La courbe ne commence qu'à la première visite.** Un actif ajouté aujourd'hui n'a aucune profondeur d'historique, et une absence prolongée laisse un trou. C'est la limite qui motive le statut « à réexaminer » : elle touche la promesse centrale du produit, et se traite soit par une tâche planifiée, soit par une reprise d'historique auprès d'un fournisseur, soit par les deux. Une donnée reconstituée après coup devra être identifiée comme telle, et jamais présentée comme une mesure.
