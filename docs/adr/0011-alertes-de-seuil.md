# 0011 — Alertes de seuil évaluées à l'actualisation

- **Date** : 29 et 30 juillet 2026
- **Statut** : acceptée

## Contexte

Une alerte sur le cours d'un actif ou sur le capital total suppose de comparer une valeur observée à un seuil. Deux moments sont possibles : en continu, par un processus qui surveille, ou au moment où l'utilisateur regarde.

Le projet n'a ni ordonnanceur, ni canal de notification — ni courriel, ni notification poussée. Une alerte déclenchée pendant que personne ne regarde n'aurait donc aucun moyen d'atteindre son destinataire.

## Décision

Les alertes actives sont évaluées **à l'actualisation du tableau de bord**, après le calcul des valeurs. Le franchissement est **inclusif** : un seuil « au-dessus » se déclenche dès que la valeur observée est supérieure ou égale au seuil, un seuil « en dessous » dès qu'elle lui est inférieure ou égale.

L'évaluation est un effet de bord de l'actualisation : son échec est journalisé, et la réponse part quand même. Un tableau de bord ne doit pas échouer parce qu'une alerte n'a pas pu être évaluée.

Quand la couverture des cours est incomplète, l'alerte sur le capital total n'est pas évaluée, plutôt que déclenchée sur un sous-total. Les alertes portant sur un actif précis restent évaluées, puisqu'elles ne dépendent que de son cours.

## Conséquences

- Une alerte franchie puis revenue en deçà entre deux consultations n'est pas vue. C'est une conséquence assumée : sans canal de notification, une détection en continu n'aurait rien apporté à l'utilisateur.
- L'interface n'évalue aucun seuil : elle affiche l'état reçu, conformément à `0005`.
- Un canal de notification réel changerait la donne et rouvrirait cette décision.
